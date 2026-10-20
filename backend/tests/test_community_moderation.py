"""Pengujian moderasi kontribusi & tanda "membantu" (Book Community).

Fokus pada hal yang menentukan apakah poin komunitas nanti diberikan kepada
orang yang tepat:

1. **Izin** — hanya moderator/owner (atau admin global) menilai kontribusi,
   dan tidak boleh menilai pesannya sendiri.
2. **Isolasi grup** — pesan grup lain tidak bisa dimoderasi/ditandai lewat
   path grup ini.
3. **Idempoten** — tanda "membantu" berulang tidak menambah hitungan.
4. **Hanya balasan** — pesan induk tidak bisa ditandai "membantu".
5. **Bukan anggota / pengirim sendiri** tidak bisa menandai.
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api.v1.community import (
    get_group_service,
    get_member_service,
    get_message_service,
)
from app.core.security import UserPayload, get_current_user
from app.main import app
from app.models.community import ChatGroup, ChatMessage
from app.services.community.group_service import GroupService
from app.services.community.member_service import MemberService
from app.services.community.message_service import MessageService
from app.services.community.repository import (
    GroupRow,
    MemberRow,
    MessageInteraction,
    MessageRow,
)

NOW = datetime(2026, 10, 19, 9, 0, tzinfo=UTC)

ADMIN = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
OWNER = UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
MOD = UUID("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
MEMBER = UUID("dddddddd-dddd-4ddd-8ddd-dddddddddddd")
OTHER = UUID("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")

GROUP = UUID("11111111-1111-4111-8111-111111111111")
OTHER_GROUP = UUID("22222222-2222-4222-8222-222222222222")

PROFILES = {
    uid: SimpleNamespace(id=uid, username=f"u{index}", full_name=None, avatar_url=None)
    for index, uid in enumerate([ADMIN, OWNER, MOD, MEMBER, OTHER])
}


def _group(group_id: UUID) -> ChatGroup:
    group = ChatGroup(
        name="Diskusi",
        description="",
        category="book_club",
        visibility="public",
        created_by=ADMIN,
    )
    group.id = group_id
    group.created_at = NOW
    group.updated_at = NOW
    return group


class FakeGroups:
    """Dua grup publik; `OTHER` tidak menjadi anggota keduanya."""

    def __init__(self) -> None:
        self.members = {
            (GROUP, OWNER): "owner",
            (GROUP, MOD): "moderator",
            (GROUP, MEMBER): "member",
            (OTHER_GROUP, OWNER): "owner",
            (OTHER_GROUP, MEMBER): "member",
        }

    async def commit(self) -> None:
        pass

    async def rollback(self) -> None:
        pass

    async def get(self, group_id: UUID, *, user_id: UUID):
        if group_id not in (GROUP, OTHER_GROUP):
            return None
        count = sum(1 for (gid, _) in self.members if gid == group_id)
        return GroupRow(
            group=_group(group_id),
            member_count=count,
            my_role=self.members.get((group_id, user_id)),
        )


class FakeMembers:
    async def get(self, group_id: UUID, user_id: UUID):
        return None

    async def list(self, group_id: UUID) -> list[MemberRow]:
        return []


class FakeMessages:
    def __init__(self) -> None:
        self.rows: list[ChatMessage] = []

    def add(
        self, group_id: UUID, sender_id: UUID, *, parent=None, content: str = "halo"
    ) -> ChatMessage:
        message = ChatMessage(
            group_id=group_id,
            sender_id=sender_id,
            message_type="text",
            content=content,
            parent_message_id=parent,
        )
        message.id = uuid4()
        message.created_at = NOW
        message.deleted_at = None
        message.moderation_status = "none"
        self.rows.append(message)
        return message

    def _row(self, message: ChatMessage) -> MessageRow:
        return MessageRow(
            message=message, sender=PROFILES.get(message.sender_id), book=None
        )

    async def get(self, message_id: UUID) -> ChatMessage | None:
        return next((row for row in self.rows if row.id == message_id), None)

    async def get_row(self, message_id: UUID) -> MessageRow | None:
        message = await self.get(message_id)
        return self._row(message) if message else None

    async def list_page(self, group_id: UUID, *, before, limit):
        rows = [row for row in self.rows if row.group_id == group_id]
        return [self._row(row) for row in rows][::-1], False

    async def soft_delete(self, message_id: UUID) -> None:
        message = await self.get(message_id)
        if message:
            message.deleted_at = NOW


class FakeInteractions:
    def __init__(self, messages: FakeMessages) -> None:
        self.messages = messages
        self.marks: dict[UUID, set[UUID]] = {}

    async def lock_message(self, message_id: UUID) -> ChatMessage | None:
        return await self.messages.get(message_id)

    async def insert_reply(
        self, *, group_id, sender_id, content, parent_message_id, client_message_id
    ):
        message = self.messages.add(
            group_id, sender_id, parent=parent_message_id, content=content
        )
        return message.id, True

    async def set_moderation_status(self, message_id: UUID, *, status: str) -> None:
        message = await self.messages.get(message_id)
        assert message is not None
        message.moderation_status = status

    async def add_helpful(self, message_id: UUID, user_id: UUID) -> bool:
        marks = self.marks.setdefault(message_id, set())
        if user_id in marks:
            return False
        marks.add(user_id)
        return True

    async def count_helpful(self, message_id: UUID) -> int:
        return len(self.marks.get(message_id, set()))

    async def helpful_map(self, message_ids, *, user_id: UUID):
        return {
            mid: MessageInteraction(
                helpful_count=len(self.marks.get(mid, set())),
                helpful_by_me=user_id in self.marks.get(mid, set()),
            )
            for mid in message_ids
            if mid in self.marks
        }


@pytest.fixture
def stack() -> SimpleNamespace:
    groups = FakeGroups()
    messages = FakeMessages()
    interactions = FakeInteractions(messages)
    members = FakeMembers()
    group_service = GroupService(groups, members)  # type: ignore[arg-type]
    message_service = MessageService(
        group_service,
        members,  # type: ignore[arg-type]
        messages,  # type: ignore[arg-type]
        interactions=interactions,  # type: ignore[arg-type]
    )
    app.dependency_overrides[get_group_service] = lambda: group_service
    app.dependency_overrides[get_member_service] = lambda: MemberService(
        group_service, members  # type: ignore[arg-type]
    )
    app.dependency_overrides[get_message_service] = lambda: message_service
    yield SimpleNamespace(messages=messages, interactions=interactions)
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as http:
        yield http


def _login(user_id: UUID, *, role: str = "user") -> None:
    app.dependency_overrides[get_current_user] = lambda: UserPayload(
        id=str(user_id), email=f"{user_id}@example.test", role=role
    )


def _answer(stack: SimpleNamespace, sender: UUID = MEMBER, group: UUID = GROUP):
    """Balasan dari `sender` atas pesan milik OWNER."""
    prompt = stack.messages.add(group, OWNER)
    return stack.messages.add(group, sender, parent=prompt.id)


# ---------------------------------------------------------------------------
# Moderasi kontribusi
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_moderator_approves_contribution(client, stack):
    answer = _answer(stack)
    _login(MOD)

    response = await client.post(
        f"/api/v1/community/groups/{GROUP}/messages/{answer.id}/moderate",
        json={"status": "approved"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["data"]["moderation_status"] == "approved"
    assert answer.moderation_status == "approved"


@pytest.mark.asyncio
async def test_regular_member_cannot_moderate(client, stack):
    answer = _answer(stack)
    _login(MEMBER)

    response = await client.post(
        f"/api/v1/community/groups/{GROUP}/messages/{answer.id}/moderate",
        json={"status": "approved"},
    )

    assert response.status_code == 403
    assert answer.moderation_status == "none"


@pytest.mark.asyncio
async def test_sender_cannot_moderate_own_message(client, stack):
    _answer(stack)
    prompt = stack.messages.add(GROUP, OWNER)
    own = stack.messages.add(GROUP, MOD, parent=prompt.id)
    _login(MOD)

    response = await client.post(
        f"/api/v1/community/groups/{GROUP}/messages/{own.id}/moderate",
        json={"status": "approved"},
    )

    assert response.status_code == 403
    assert own.moderation_status == "none"


@pytest.mark.asyncio
async def test_message_from_other_group_is_not_found(client, stack):
    foreign = _answer(stack, group=OTHER_GROUP)
    _login(MOD)

    response = await client.post(
        f"/api/v1/community/groups/{GROUP}/messages/{foreign.id}/moderate",
        json={"status": "approved"},
    )

    assert response.status_code == 404
    assert foreign.moderation_status == "none"


@pytest.mark.asyncio
async def test_moderation_status_must_be_a_decision(client, stack):
    answer = _answer(stack)
    _login(MOD)

    response = await client.post(
        f"/api/v1/community/groups/{GROUP}/messages/{answer.id}/moderate",
        json={"status": "pending"},
    )

    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Tanda "membantu"
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mark_helpful_is_idempotent(client, stack):
    answer = _answer(stack)
    path = f"/api/v1/community/groups/{GROUP}/messages/{answer.id}/helpful"
    _login(MOD)

    first = await client.post(path)
    second = await client.post(path)

    assert first.status_code == 200, first.text
    assert first.json()["data"] == {
        "message_id": str(answer.id),
        "helpful_count": 1,
        "helpful_by_me": True,
        "created": True,
    }
    assert second.status_code == 200
    assert second.json()["data"]["created"] is False
    assert second.json()["data"]["helpful_count"] == 1


@pytest.mark.asyncio
async def test_sender_cannot_mark_own_answer(client, stack):
    answer = _answer(stack, sender=MOD)
    _login(MOD)

    response = await client.post(
        f"/api/v1/community/groups/{GROUP}/messages/{answer.id}/helpful"
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_prompt_message_cannot_be_marked(client, stack):
    prompt = stack.messages.add(GROUP, OWNER)
    _login(MOD)

    response = await client.post(
        f"/api/v1/community/groups/{GROUP}/messages/{prompt.id}/helpful"
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_non_member_cannot_mark(client, stack):
    answer = _answer(stack)
    _login(OTHER)

    response = await client.post(
        f"/api/v1/community/groups/{GROUP}/messages/{answer.id}/helpful"
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_helpful_counts_are_returned_with_messages(client, stack):
    answer = _answer(stack)
    stack.interactions.marks[answer.id] = {MOD}
    _login(MEMBER)

    response = await client.get(f"/api/v1/community/groups/{GROUP}/messages")

    assert response.status_code == 200
    items = {item["id"]: item for item in response.json()["data"]["items"]}
    assert items[str(answer.id)]["helpful_count"] == 1
    assert items[str(answer.id)]["helpful_by_me"] is False


@pytest.mark.asyncio
async def test_reply_is_created_with_parent(client, stack):
    prompt = stack.messages.add(GROUP, OWNER)
    _login(MEMBER)

    response = await client.post(
        f"/api/v1/community/groups/{GROUP}/messages",
        json={
            "message_type": "text",
            "content": "Menurut saya jawabannya ada di bab 3.",
            "parent_message_id": str(prompt.id),
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["data"]["parent_message_id"] == str(prompt.id)
