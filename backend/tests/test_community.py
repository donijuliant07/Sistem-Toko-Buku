"""Pengujian Book Community — tanpa database, tanpa jaringan.

Repository palsu diinjeksi lewat `app.dependency_overrides` pada provider
service (`get_group_service`, `get_member_service`, `get_message_service`),
sehingga seluruh aturan otorisasi, bentuk respons, dan kontrak HTTP diuji
tanpa menyentuh Supabase.

Yang dijaga di sini adalah hal-hal yang paling mudah rusak diam-diam:

1. **Keanggotaan** — non-anggota tidak bisa membaca/mengirim pesan; grup privat
   tidak bocor lewat daftar, detail, maupun join.
2. **Identitas** — `sender_id` selalu dari token; field asing di body diabaikan.
3. **Role** — matriks owner/moderator/member/admin ditegakkan server.
4. **Idempotensi** — `client_message_id` yang sama tidak membuat pesan ganda.
5. **Paginasi** — kursor keyset stabil saat ada pesan baru.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.exc import IntegrityError

from app.api.v1.community import (
    get_group_service,
    get_member_service,
    get_message_service,
)
from app.core.security import UserPayload, get_current_user
from app.main import app
from app.models.community import ChatGroup, ChatGroupMember, ChatMessage
from app.schemas.community import GroupCategory, GroupVisibility, MessageType
from app.services.community import permissions
from app.services.community.errors import CommunityError
from app.services.community.group_service import GroupService
from app.services.community.member_service import MemberService
from app.services.community.message_service import MessageService
from app.services.community.rate_limit import SendRateLimiter
from app.services.community.repository import GroupRow, MemberRow, MessageRow

NOW = datetime(2026, 10, 19, 9, 0, tzinfo=UTC)

ADMIN = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
OWNER = UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
MOD = UUID("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
MEMBER = UUID("dddddddd-dddd-4ddd-8ddd-dddddddddddd")
OUTSIDER = UUID("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")
NEWBIE = UUID("ffffffff-ffff-4fff-8fff-ffffffffffff")

PUBLIC_ID = UUID("11111111-1111-4111-8111-111111111111")
PRIVATE_ID = UUID("22222222-2222-4222-8222-222222222222")
BOOK_ID = UUID("33333333-3333-4333-8333-333333333333")

PROFILES = {
    uid: SimpleNamespace(
        id=uid,
        username=f"user{index}",
        full_name=f"Pengguna {index}",
        avatar_url=None,
    )
    for index, uid in enumerate([ADMIN, OWNER, MOD, MEMBER, OUTSIDER, NEWBIE])
}


def _group(group_id: UUID, *, visibility: str, name: str) -> ChatGroup:
    group = ChatGroup(
        name=name,
        description="",
        category="book_club",
        visibility=visibility,
        created_by=ADMIN,
    )
    group.id = group_id
    group.created_at = NOW
    group.updated_at = NOW
    return group


def _member(group_id: UUID, user_id: UUID, role: str) -> ChatGroupMember:
    member = ChatGroupMember(group_id=group_id, user_id=user_id, role=role)
    member.joined_at = NOW
    return member


class FakeGroupRepository:
    def __init__(self) -> None:
        self.groups: dict[UUID, ChatGroup] = {
            PUBLIC_ID: _group(PUBLIC_ID, visibility="public", name="Book Club Publik"),
            PRIVATE_ID: _group(PRIVATE_ID, visibility="private", name="Klub Privat"),
        }
        self.members: dict[tuple[UUID, UUID], ChatGroupMember] = {
            (PUBLIC_ID, OWNER): _member(PUBLIC_ID, OWNER, "owner"),
            (PUBLIC_ID, MOD): _member(PUBLIC_ID, MOD, "moderator"),
            (PUBLIC_ID, MEMBER): _member(PUBLIC_ID, MEMBER, "member"),
            (PRIVATE_ID, OWNER): _member(PRIVATE_ID, OWNER, "owner"),
        }
        self.commits = 0
        self.rollbacks = 0
        self.fail_create = False

    def _role(self, group_id: UUID, user_id: UUID) -> str | None:
        member = self.members.get((group_id, user_id))
        return member.role if member else None

    def _row(self, group: ChatGroup, user_id: UUID) -> GroupRow:
        count = sum(1 for (gid, _) in self.members if gid == group.id)
        return GroupRow(group=group, member_count=count, my_role=self._role(group.id, user_id))

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        self.rollbacks += 1

    async def list_page(self, *, user_id, is_admin, q, category, only_mine, page, page_size):
        rows = []
        for group in self.groups.values():
            role = self._role(group.id, user_id)
            if only_mine and role is None:
                continue
            if not only_mine and not is_admin and group.visibility != "public" and role is None:
                continue
            if q and q.lower() not in group.name.lower():
                continue
            if category and group.category != category:
                continue
            rows.append(self._row(group, user_id))
        rows.sort(key=lambda row: row.group.created_at, reverse=True)
        start = (page - 1) * page_size
        return rows[start : start + page_size], len(rows)

    async def get(self, group_id: UUID, *, user_id: UUID):
        group = self.groups.get(group_id)
        return self._row(group, user_id) if group else None

    async def get_for_update(self, group_id: UUID):
        return self.groups.get(group_id)

    async def name_exists(self, name: str, *, exclude_id: UUID | None = None) -> bool:
        return any(
            group.name.strip().lower() == name.strip().lower()
            for group_id, group in self.groups.items()
            if group_id != exclude_id
        )

    async def create(self, *, name, description, category, visibility, created_by):
        if self.fail_create:
            raise IntegrityError("insert", {}, Exception("duplicate key"))
        group = _group(uuid4(), visibility=visibility, name=name)
        group.description = description
        group.category = category
        group.created_by = created_by
        self.groups[group.id] = group
        self.members[(group.id, created_by)] = _member(group.id, created_by, "owner")
        return group

    async def update(self, group: ChatGroup, changes):
        for field, value in changes.items():
            setattr(group, field, value)
        return group

    async def delete(self, group_id: UUID) -> None:
        self.groups.pop(group_id, None)
        for key in [key for key in self.members if key[0] == group_id]:
            del self.members[key]


class FakeMemberRepository:
    def __init__(self, groups: FakeGroupRepository) -> None:
        self.groups = groups

    async def get(self, group_id: UUID, user_id: UUID):
        return self.groups.members.get((group_id, user_id))

    async def list(self, group_id: UUID):
        order = {"owner": 0, "moderator": 1, "member": 2}
        rows = [
            MemberRow(
                user_id=member.user_id,
                role=member.role,
                joined_at=member.joined_at,
                username=PROFILES[member.user_id].username,
                full_name=PROFILES[member.user_id].full_name,
                avatar_url=None,
            )
            for (gid, _), member in self.groups.members.items()
            if gid == group_id
        ]
        rows.sort(key=lambda row: (order[row.role], row.user_id))
        return rows

    async def find_users(self, q: str, *, limit: int = 10):
        term = q.strip().lower()
        return [
            profile
            for profile in PROFILES.values()
            if term in (profile.username or "").lower()
            or term in (profile.full_name or "").lower()
        ][:limit]

    async def get_profile(self, user_id: UUID):
        return PROFILES.get(user_id)

    async def add(self, group_id: UUID, user_id: UUID, role: str = "member") -> bool:
        if (group_id, user_id) in self.groups.members:
            return False
        self.groups.members[(group_id, user_id)] = _member(group_id, user_id, role)
        return True

    async def remove(self, group_id: UUID, user_id: UUID) -> bool:
        return self.groups.members.pop((group_id, user_id), None) is not None

    async def set_role(self, group_id: UUID, user_id: UUID, role: str) -> None:
        member = self.groups.members[(group_id, user_id)]
        member.role = role

    async def transfer_owner(self, group_id: UUID, current_owner: UUID, new_owner: UUID) -> None:
        await self.set_role(group_id, current_owner, "moderator")
        await self.set_role(group_id, new_owner, "owner")


class FakeMessageRepository:
    def __init__(self) -> None:
        self.rows: list[ChatMessage] = []

    def _read(self, message: ChatMessage) -> MessageRow:
        sender = PROFILES.get(message.sender_id)
        book = (
            SimpleNamespace(
                id=BOOK_ID,
                title="Bumi Manusia",
                author="Pramoedya Ananta Toer",
                price=Decimal("98000.00"),
                cover_url=None,
            )
            if message.book_id == BOOK_ID
            else None
        )
        return MessageRow(message=message, sender=sender, book=book)

    async def list_page(self, group_id: UUID, *, before, limit):
        rows = [row for row in self.rows if row.group_id == group_id and row.deleted_at is None]
        if before is not None:
            created_at, message_id = before
            rows = [
                row
                for row in rows
                if (row.created_at, row.id) < (created_at, message_id)
            ]
        rows.sort(key=lambda row: (row.created_at, row.id), reverse=True)
        has_more = len(rows) > limit
        return [self._read(row) for row in rows[:limit]], has_more

    async def get(self, message_id: UUID):
        return next((row for row in self.rows if row.id == message_id), None)

    async def book_exists(self, book_id: UUID) -> bool:
        return book_id == BOOK_ID

    async def find_by_client_id(self, group_id, sender_id, client_message_id):
        row = next(
            (
                item
                for item in self.rows
                if item.group_id == group_id
                and item.sender_id == sender_id
                and item.client_message_id == client_message_id
            ),
            None,
        )
        return self._read(row) if row else None

    async def get_row(self, message_id: UUID):
        row = await self.get(message_id)
        return self._read(row) if row else None

    async def insert(self, *, group_id, sender_id, message_type, content, book_id, client_message_id):
        if client_message_id is not None:
            existing = await self.find_by_client_id(group_id, sender_id, client_message_id)
            if existing is not None:
                return existing.message.id, False
        message = ChatMessage(
            group_id=group_id,
            sender_id=sender_id,
            message_type=message_type,
            content=content,
            book_id=book_id,
            client_message_id=client_message_id,
        )
        message.id = uuid4()
        message.created_at = NOW + timedelta(seconds=len(self.rows))
        self.rows.append(message)
        return message.id, True

    async def soft_delete(self, message_id: UUID) -> None:
        message = await self.get(message_id)
        if message is not None:
            message.deleted_at = NOW


class Stack:
    """Kumpulan fake repository + service yang siap dipasang ke dependency override."""

    def __init__(self) -> None:
        self.groups = FakeGroupRepository()
        self.members = FakeMemberRepository(self.groups)
        self.messages = FakeMessageRepository()
        self.clock = [0.0]
        self.limiter = SendRateLimiter(clock=lambda: self.clock[0])
        self.group_service = GroupService(self.groups, self.members)
        self.member_service = MemberService(self.group_service, self.members)
        self.message_service = MessageService(
            self.group_service, self.members, self.messages, self.limiter
        )

    def install(self) -> None:
        app.dependency_overrides[get_group_service] = lambda: self.group_service
        app.dependency_overrides[get_member_service] = lambda: self.member_service
        app.dependency_overrides[get_message_service] = lambda: self.message_service


def _login(user_id: UUID, *, role: str = "user") -> None:
    app.dependency_overrides[get_current_user] = lambda: UserPayload(
        id=str(user_id), email=f"{user_id}@example.test", role=role
    )


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http


@pytest.fixture
def stack() -> Stack:
    return Stack()


# ---------------------------------------------------------------------------
# Autentikasi & pembuatan grup
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/v1/community/groups"),
        ("get", f"/api/v1/community/groups/{PUBLIC_ID}"),
        ("post", "/api/v1/community/groups"),
        ("post", f"/api/v1/community/groups/{PUBLIC_ID}/join"),
        ("get", f"/api/v1/community/groups/{PUBLIC_ID}/messages"),
        ("post", f"/api/v1/community/groups/{PUBLIC_ID}/messages"),
    ],
)
async def test_anonymous_is_rejected(client, method, path):
    """Tanpa token, semua endpoint komunitas menolak (401)."""
    response = await getattr(client, method)(path)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_only_admin_can_create_group(client, stack):
    stack.install()
    _login(MEMBER)

    response = await client.post(
        "/api/v1/community/groups",
        json={"name": "Grup Baru", "category": "technology", "visibility": "public"},
    )

    assert response.status_code == 403
    assert "administrator" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_admin_creation_records_owner(client, stack):
    stack.install()
    _login(ADMIN, role="admin")

    response = await client.post(
        "/api/v1/community/groups",
        json={"name": "Grup Baru", "category": "technology", "visibility": "private"},
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["my_role"] == "owner"
    assert data["can_manage_group"] is True
    created_id = UUID(data["id"])
    assert stack.groups.members[(created_id, ADMIN)].role == "owner"
    assert stack.groups.commits == 1


@pytest.mark.asyncio
async def test_duplicate_group_name_is_conflict(client, stack):
    stack.install()
    _login(ADMIN, role="admin")

    response = await client.post(
        "/api/v1/community/groups",
        json={"name": "  book club publik ", "category": "book_club"},
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_integrity_error_during_create_is_409_and_rolled_back(client, stack):
    stack.install()
    stack.groups.fail_create = True
    _login(ADMIN, role="admin")

    response = await client.post(
        "/api/v1/community/groups",
        json={"name": "Balapan Nama", "category": "general"},
    )

    assert response.status_code == 409
    assert stack.groups.rollbacks == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"name": "ab", "category": "general"},
        {"name": "   ", "category": "general"},
        {"name": "x" * 81, "category": "general"},
        {"name": "Valid", "category": "tidak-ada"},
        {"name": "Valid", "category": "general", "description": "y" * 1001},
    ],
)
async def test_invalid_group_payload_is_422(client, stack, payload):
    stack.install()
    _login(ADMIN, role="admin")

    response = await client.post("/api/v1/community/groups", json=payload)

    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Visibilitas & keanggotaan
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_private_group_is_hidden_from_outsider(client, stack):
    stack.install()
    _login(OUTSIDER)

    listing = await client.get("/api/v1/community/groups")
    detail = await client.get(f"/api/v1/community/groups/{PRIVATE_ID}")
    join = await client.post(f"/api/v1/community/groups/{PRIVATE_ID}/join")

    assert [item["id"] for item in listing.json()["data"]["items"]] == [str(PUBLIC_ID)]
    assert detail.status_code == 404
    assert join.status_code == 404


@pytest.mark.asyncio
async def test_admin_sees_private_groups_but_cannot_send(client, stack):
    stack.install()
    _login(ADMIN, role="admin")

    listing = await client.get("/api/v1/community/groups")
    detail = await client.get(f"/api/v1/community/groups/{PRIVATE_ID}")
    send = await client.post(
        f"/api/v1/community/groups/{PRIVATE_ID}/messages",
        json={"content": "halo", "message_type": "text"},
    )

    assert {item["id"] for item in listing.json()["data"]["items"]} == {
        str(PUBLIC_ID),
        str(PRIVATE_ID),
    }
    assert detail.status_code == 200
    assert detail.json()["data"]["can_send"] is False
    assert send.status_code == 403


@pytest.mark.asyncio
async def test_mine_filter_only_returns_joined_groups(client, stack):
    stack.install()
    _login(OUTSIDER)
    await client.post(f"/api/v1/community/groups/{PUBLIC_ID}/join")

    response = await client.get("/api/v1/community/groups", params={"mine": "true"})

    assert [item["id"] for item in response.json()["data"]["items"]] == [str(PUBLIC_ID)]


@pytest.mark.asyncio
async def test_join_is_idempotent(client, stack):
    stack.install()
    _login(OUTSIDER)

    first = await client.post(f"/api/v1/community/groups/{PUBLIC_ID}/join")
    second = await client.post(f"/api/v1/community/groups/{PUBLIC_ID}/join")

    assert first.status_code == 200 and second.status_code == 200
    assert stack.groups.members[(PUBLIC_ID, OUTSIDER)].role == "member"


@pytest.mark.asyncio
async def test_owner_cannot_leave_but_member_can(client, stack):
    stack.install()
    _login(OWNER)
    owner_leave = await client.post(f"/api/v1/community/groups/{PUBLIC_ID}/leave")

    _login(MEMBER)
    member_leave = await client.post(f"/api/v1/community/groups/{PUBLIC_ID}/leave")

    assert owner_leave.status_code == 409
    assert member_leave.status_code == 204
    assert (PUBLIC_ID, MEMBER) not in stack.groups.members


@pytest.mark.asyncio
async def test_non_member_cannot_read_or_send_in_public_group(client, stack):
    stack.install()
    _login(OUTSIDER)

    read = await client.get(f"/api/v1/community/groups/{PUBLIC_ID}/messages")
    send = await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages", json={"content": "halo"}
    )

    assert read.status_code == 403
    assert send.status_code == 403


# ---------------------------------------------------------------------------
# Pesan
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_sender_identity_comes_from_token_not_body(client, stack):
    stack.install()
    _login(MEMBER)

    response = await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages",
        json={
            "content": "  pesan saya  ",
            "sender_id": str(OUTSIDER),
            "user_id": str(OUTSIDER),
            "group_id": str(PRIVATE_ID),
        },
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["sender"]["id"] == str(MEMBER)
    assert data["content"] == "pesan saya"
    assert data["group_id"] == str(PUBLIC_ID)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"content": ""},
        {"content": "   "},
        {"content": "x" * 2001},
        {"content": "teks", "book_id": str(BOOK_ID)},
        {"message_type": "book"},
        {"message_type": "book", "book_id": str(BOOK_ID), "content": "caption"},
        {"message_type": "suara", "content": "halo"},
    ],
)
async def test_invalid_message_payload_is_422(client, stack, payload):
    stack.install()
    _login(MEMBER)

    response = await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages", json=payload
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_unknown_book_is_404(client, stack):
    stack.install()
    _login(MEMBER)

    response = await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages",
        json={"message_type": "book", "book_id": str(uuid4())},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_book_message_carries_current_catalog_data(client, stack):
    stack.install()
    _login(MEMBER)

    response = await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages",
        json={"message_type": "book", "book_id": str(BOOK_ID)},
    )

    assert response.status_code == 201
    book = response.json()["data"]["book"]
    assert book["title"] == "Bumi Manusia"
    assert Decimal(str(book["price"])) == Decimal("98000.00")


@pytest.mark.asyncio
async def test_duplicate_client_message_id_returns_existing_message(client, stack):
    stack.install()
    _login(MEMBER)
    client_message_id = str(uuid4())

    first = await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages",
        json={"content": "sekali", "client_message_id": client_message_id},
    )
    second = await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages",
        json={"content": "sekali", "client_message_id": client_message_id},
    )

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["data"]["id"] == second.json()["data"]["id"]
    assert len(stack.messages.rows) == 1


@pytest.mark.asyncio
async def test_rate_limit_blocks_eleventh_message(client, stack):
    stack.install()
    _login(MEMBER)
    statuses = []
    for index in range(11):
        response = await client.post(
            f"/api/v1/community/groups/{PUBLIC_ID}/messages",
            json={"content": f"pesan {index}"},
        )
        statuses.append(response.status_code)
        stack.clock[0] += 0.5  # masih dalam jendela 10 detik

    assert statuses[:10] == [201] * 10
    assert statuses[10] == 429


@pytest.mark.asyncio
async def test_pagination_is_keyset_and_stable(client, stack):
    stack.install()
    _login(MEMBER)
    for index in range(5):
        await client.post(
            f"/api/v1/community/groups/{PUBLIC_ID}/messages",
            json={"content": f"pesan {index}"},
        )

    first = await client.get(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages", params={"limit": 2}
    )
    payload = first.json()["data"]
    assert [item["content"] for item in payload["items"]] == ["pesan 3", "pesan 4"]
    assert payload["next_cursor"]

    # Pesan baru masuk di antara dua permintaan — halaman lama tidak bergeser.
    await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages", json={"content": "pesan 5"}
    )
    second = await client.get(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages",
        params={"limit": 2, "cursor": payload["next_cursor"]},
    )
    assert [item["content"] for item in second.json()["data"]["items"]] == [
        "pesan 1",
        "pesan 2",
    ]


@pytest.mark.asyncio
async def test_invalid_cursor_is_422(client, stack):
    stack.install()
    _login(MEMBER)

    response = await client.get(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages",
        params={"cursor": "bukan-kursor"},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_message_delete_permissions(client, stack):
    stack.install()
    _login(MEMBER)
    sent = await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages", json={"content": "hapus aku"}
    )
    message_id = sent.json()["data"]["id"]

    _login(OUTSIDER)
    outsider = await client.delete(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages/{message_id}"
    )

    _login(MOD)
    moderator = await client.delete(
        f"/api/v1/community/groups/{PUBLIC_ID}/messages/{message_id}"
    )

    assert outsider.status_code == 403  # publik tetapi bukan anggota
    assert moderator.status_code == 204
    assert stack.messages.rows[0].deleted_at is not None


# ---------------------------------------------------------------------------
# Anggota & role
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_moderator_can_add_member_but_not_change_role(client, stack):
    stack.install()
    _login(MOD)

    added = await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/members",
        json={"user_id": str(OUTSIDER)},
    )
    promote = await client.patch(
        f"/api/v1/community/groups/{PUBLIC_ID}/members/{OUTSIDER}",
        json={"role": "moderator"},
    )

    assert added.status_code == 201
    assert added.json()["data"]["role"] == "member"
    assert promote.status_code == 403


@pytest.mark.asyncio
async def test_owner_can_promote_and_transfer(client, stack):
    stack.install()
    _login(OWNER)

    promote = await client.patch(
        f"/api/v1/community/groups/{PUBLIC_ID}/members/{MEMBER}",
        json={"role": "moderator"},
    )
    transfer = await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/transfer-owner",
        json={"user_id": str(MEMBER)},
    )

    assert promote.status_code == 200
    assert transfer.status_code == 200
    assert stack.groups.members[(PUBLIC_ID, MEMBER)].role == "owner"
    assert stack.groups.members[(PUBLIC_ID, OWNER)].role == "moderator"


@pytest.mark.asyncio
async def test_owner_row_cannot_be_removed_or_demoted(client, stack):
    stack.install()
    _login(OWNER)

    remove = await client.delete(
        f"/api/v1/community/groups/{PUBLIC_ID}/members/{OWNER}"
    )
    demote = await client.patch(
        f"/api/v1/community/groups/{PUBLIC_ID}/members/{OWNER}",
        json={"role": "member"},
    )
    set_owner = await client.patch(
        f"/api/v1/community/groups/{PUBLIC_ID}/members/{MEMBER}",
        json={"role": "owner"},
    )

    assert remove.status_code == 409
    assert demote.status_code == 409
    assert set_owner.status_code == 422


@pytest.mark.asyncio
async def test_member_cannot_manage_members(client, stack):
    stack.install()
    _login(MEMBER)

    listing = await client.get(f"/api/v1/community/groups/{PUBLIC_ID}/members")
    add = await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/members",
        json={"user_id": str(OUTSIDER)},
    )

    assert listing.status_code == 200
    assert add.status_code == 403


@pytest.mark.asyncio
async def test_adding_existing_member_is_409(client, stack):
    stack.install()
    _login(OWNER)

    response = await client.post(
        f"/api/v1/community/groups/{PUBLIC_ID}/members",
        json={"user_id": str(MEMBER)},
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_member_candidates_require_management(client, stack):
    stack.install()
    _login(MEMBER)
    forbidden_response = await client.get(
        f"/api/v1/community/groups/{PUBLIC_ID}/member-candidates", params={"q": "Pengguna"}
    )

    _login(OWNER)
    ok_response = await client.get(
        f"/api/v1/community/groups/{PUBLIC_ID}/member-candidates", params={"q": "Pengguna"}
    )

    assert forbidden_response.status_code == 403
    assert ok_response.status_code == 200
    assert all(item["id"] not in {str(OWNER), str(MOD), str(MEMBER)} for item in ok_response.json()["data"])


# ---------------------------------------------------------------------------
# Unit: matriks izin & konstanta
# ---------------------------------------------------------------------------


def test_permission_matrix():
    """Tabel izin dijaga sebagai kontrak, bukan tersebar di route."""
    assert permissions.can_create_group(True) and not permissions.can_create_group(False)
    assert permissions.can_view_group("private", None, False) is False
    assert permissions.can_view_group("private", "member", False) is True
    assert permissions.can_view_group("private", None, True) is True
    assert permissions.can_send(None) is False
    assert permissions.can_send("member") is True
    assert permissions.can_remove_member("moderator", "moderator") is False
    assert permissions.can_remove_member("moderator", "member") is True
    assert permissions.can_remove_member("owner", "owner") is False
    assert permissions.can_leave("owner") is False
    assert permissions.can_delete_message(None, False, True) is True
    assert permissions.can_delete_message("member", False, False) is False


def test_schema_enums_match_model_constants():
    from app.models.community import GROUP_CATEGORIES, GROUP_VISIBILITIES

    assert tuple(item.value for item in GroupCategory) == GROUP_CATEGORIES
    assert tuple(item.value for item in GroupVisibility) == GROUP_VISIBILITIES
    assert tuple(item.value for item in MessageType) == ("text", "book")


def test_cursor_roundtrip():
    from app.services.community.message_service import decode_cursor, encode_cursor

    message_id = uuid4()
    assert decode_cursor(encode_cursor(NOW, message_id)) == (NOW, message_id)
    with pytest.raises(CommunityError):
        decode_cursor("###")
