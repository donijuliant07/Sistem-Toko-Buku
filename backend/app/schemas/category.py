from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=2, description="Nama kategori")
    slug: str = Field(..., min_length=2, description="Slug URL kategori")
    type: Literal["Buku", "Non-Buku"] = Field(default="Buku", description="Tipe produk kategori")
    description: str | None = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=2)
    slug: str | None = Field(None, min_length=2)
    type: Literal["Buku", "Non-Buku"] | None = None
    description: str | None = None


class CategoryResponse(CategoryBase):
    id: str
    # `type`/`description`/`created_at` tidak selalu ada di tabel live: skema
    # Supabase diverge dari migrasi repo dan default kolom memakai nilai ini.
    type: Literal["Buku", "Non-Buku"] = "Buku"
    description: str | None = None
    created_at: str | datetime | None = None
