from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    sukses: bool = Field(default=True, description="Status keberhasilan request")
    pesan: str = Field(default="Operasi berhasil dijalankan", description="Pesan respon dalam Bahasa Indonesia")
    data: Optional[T] = Field(default=None, description="Payload data respon")


class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int


class PaginatedResponse(BaseModel, Generic[T]):
    sukses: bool = True
    pesan: str = "Data berhasil diambil"
    data: list[T]
    meta: PaginationMeta
