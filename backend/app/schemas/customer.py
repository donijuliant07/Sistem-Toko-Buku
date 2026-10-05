from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime


class CustomerResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    total_orders: int = 0
    total_spent: float = 0.0
    created_at: str | datetime
