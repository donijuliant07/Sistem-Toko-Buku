from typing import Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=2, description="Nama kategori")
    slug: str = Field(..., min_length=2, description="Slug URL kategori")
    type: Literal["Buku", "Non-Buku"] = Field(default="Buku", description="Tipe produk kategori")
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2)
    slug: Optional[str] = Field(None, min_length=2)
    type: Optional[Literal["Buku", "Non-Buku"]] = None
    description: Optional[str] = None


class CategoryResponse(CategoryBase):
    id: str
    created_at: str | datetime
