from typing import Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime
from app.schemas.category import CategoryResponse


class ProductBase(BaseModel):
    title: str = Field(..., min_length=3, description="Judul produk atau buku")
    author: str = Field(..., min_length=2, description="Penulis atau Brand")
    publisher: str = Field(..., min_length=2, description="Penerbit atau Produsen")
    isbn: str = Field(..., min_length=3, description="ISBN atau nomor SKU")
    category_id: str = Field(..., description="ID Kategori produk")
    type: Literal["Buku", "Non-Buku"] = Field(default="Buku")
    language: Literal["Indonesia", "Inggris", "Lainnya"] = Field(default="Indonesia")
    pages: int = Field(default=0, ge=0, description="Jumlah halaman")
    weight: int = Field(default=1, ge=1, description="Berat produk dalam gram")
    normal_price: float = Field(..., ge=1000, description="Harga normal sebelum diskon")
    discount_percent: int = Field(default=0, ge=0, le=100, description="Persentase diskon")
    stock: int = Field(default=0, ge=0, description="Jumlah ketersediaan stok")
    status: Literal["Aktif", "Draft", "Habis"] = Field(default="Aktif")
    description: str = Field(..., min_length=10, description="Deskripsi lengkap produk")
    cover_url: str = Field(..., description="URL gambar cover produk")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3)
    author: Optional[str] = Field(None, min_length=2)
    publisher: Optional[str] = Field(None, min_length=2)
    isbn: Optional[str] = Field(None, min_length=3)
    category_id: Optional[str] = None
    type: Optional[Literal["Buku", "Non-Buku"]] = None
    language: Optional[Literal["Indonesia", "Inggris", "Lainnya"]] = None
    pages: Optional[int] = Field(None, ge=0)
    weight: Optional[int] = Field(None, ge=1)
    normal_price: Optional[float] = Field(None, ge=1000)
    discount_percent: Optional[int] = Field(None, ge=0, le=100)
    stock: Optional[int] = Field(None, ge=0)
    status: Optional[Literal["Aktif", "Draft", "Habis"]] = None
    description: Optional[str] = Field(None, min_length=10)
    cover_url: Optional[str] = None


class ProductResponse(ProductBase):
    id: str
    final_price: float
    rating: float
    created_at: str | datetime
    updated_at: str | datetime
    category: Optional[CategoryResponse] = None
