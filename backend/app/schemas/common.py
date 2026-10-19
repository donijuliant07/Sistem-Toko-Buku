from pydantic import BaseModel, Field


class ApiResponse[T](BaseModel):
    sukses: bool = Field(default=True, description="Status keberhasilan request")
    pesan: str = Field(default="Operasi berhasil dijalankan", description="Pesan respon dalam Bahasa Indonesia")
    data: T | None = Field(default=None, description="Payload data respon")


class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int


class PaginatedResponse[T](BaseModel):
    sukses: bool = True
    pesan: str = "Data berhasil diambil"
    data: list[T]
    meta: PaginationMeta
