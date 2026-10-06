from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class SpoilerLevel(str, Enum):
    NO_SPOILER = "no_spoiler"
    LOW = "low"
    MEDIUM = "medium"
    HEAVY = "heavy"


class AIReviewRequest(BaseModel):
    spoiler_level: SpoilerLevel = Field(
        default=SpoilerLevel.NO_SPOILER,
        description="Tingkat spoiler review: no_spoiler, low, medium, heavy",
    )


class AIReviewResponse(BaseModel):
    book_id: str
    title: str
    author: str
    spoiler_level: SpoilerLevel
    overview: str
    writing_style: str
    characters: str
    strengths: list[str]
    weaknesses: list[str]
    who_should_read: str
    verdict: str
    plot_analysis: Optional[str] = None
    character_development: Optional[str] = None
    ending_analysis: Optional[str] = None
    cached: bool = False
