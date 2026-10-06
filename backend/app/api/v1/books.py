from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.session import get_db
from app.models import Book
from app.schemas.book import BookCreate, BookPage, BookRead, BookUpdate
from app.schemas.ai_review import AIReviewRequest, AIReviewResponse
from app.services.ai_review_service import generate_ai_book_review

router = APIRouter(prefix="/books", tags=["books"])


def is_isbn_unique_violation(error: IntegrityError) -> bool:
    """Identify the books ISBN unique constraint violation."""
    constraint_name = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
    return constraint_name == "uq_books_isbn" or "uq_books_isbn" in str(error.orig)


async def get_book(book_id: UUID, db: AsyncSession) -> Book | dict:
    """Load one book or raise 404."""
    try:
        book = await db.get(Book, book_id)
        if book is not None:
            return book
    except Exception:
        pass

    # Fallback to Supabase REST client
    from app.core.supabase import supabase_admin
    res = supabase_admin.table("books").select("*").eq("id", str(book_id)).single().execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return res.data


@router.get("", response_model=BookPage)
async def list_books(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
) -> BookPage:
    """List books with optional search and pagination."""
    filters = []
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        filters.append(or_(Book.title.ilike(pattern), Book.author.ilike(pattern), Book.isbn.ilike(pattern)))

    try:
        query = select(Book).where(*filters)
        count_query = select(func.count()).select_from(Book).where(*filters)
        total = (await db.execute(count_query)).scalar_one()
        books = (
            await db.execute(
                query.order_by(Book.created_at.desc(), Book.id).offset((page - 1) * page_size).limit(page_size)
            )
        ).scalars().all()
        return BookPage(items=books, total=total, page=page, page_size=page_size)
    except Exception:
        # Fallback to Supabase REST client if Direct DB Connection (SQLAlchemy) fails
        from app.core.supabase import supabase_admin
        offset = (page - 1) * page_size
        sb_query = supabase_admin.table("books").select("*", count="exact")
        if q and q.strip():
            st = q.strip()
            sb_query = sb_query.or_(f"title.ilike.%{st}%,author.ilike.%{st}%,isbn.ilike.%{st}%")
        res = sb_query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
        items = res.data or []
        total = res.count if res.count is not None else len(items)
        return BookPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/{book_id}", response_model=BookRead)
async def read_book(
    book_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Book:
    """Return one book by ID."""
    return await get_book(book_id, db)


@router.post("", response_model=BookRead, status_code=status.HTTP_201_CREATED)
async def create_book(
    data: BookCreate,
    _payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Book:
    """Create a book for an admin user."""
    values = data.model_dump()
    if values.get("cover_url") is not None:
        values["cover_url"] = str(values["cover_url"])
    book = Book(**values)
    db.add(book)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if is_isbn_unique_violation(exc):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="ISBN already exists") from exc
        raise
    await db.refresh(book)
    return book


@router.put("/{book_id}", response_model=BookRead)
@router.patch("/{book_id}", response_model=BookRead)
async def update_book(
    book_id: UUID,
    data: BookUpdate,
    _payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Book:
    """Update a book for an admin user."""
    book = await get_book(book_id, db)
    values = data.model_dump(exclude_unset=True)
    if values.get("cover_url") is not None:
        values["cover_url"] = str(values["cover_url"])
    for field, value in values.items():
        setattr(book, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if is_isbn_unique_violation(exc):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="ISBN already exists") from exc
        raise
    await db.refresh(book)
    return book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: UUID,
    _payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a book for an admin user."""
    book = await get_book(book_id, db)
    await db.delete(book)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{book_id}/ai-review", response_model=AIReviewResponse)
async def get_ai_book_review(
    book_id: UUID,
    payload: AIReviewRequest,
    db: AsyncSession = Depends(get_db),
) -> AIReviewResponse:
    """Generate or retrieve AI Book Review with strict spoiler level control."""
    book = await get_book(book_id, db)

    # Extract fields cleanly whether book is SQLAlchemy model or dict
    b_id = str(getattr(book, "id", book.get("id") if isinstance(book, dict) else book_id))
    title = getattr(book, "title", book.get("title") if isinstance(book, dict) else "Buku")
    author = getattr(book, "author", book.get("author") if isinstance(book, dict) else "Penulis")
    description = getattr(book, "description", book.get("description") if isinstance(book, dict) else "")
    isbn = getattr(book, "isbn", book.get("isbn") if isinstance(book, dict) else "")

    return await generate_ai_book_review(
        book_id=b_id,
        title=title,
        author=author,
        description=description or "",
        isbn=isbn or "",
        spoiler_level=payload.spoiler_level,
    )
