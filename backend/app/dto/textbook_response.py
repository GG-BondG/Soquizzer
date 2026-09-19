from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.entity import TextbookStatus


class TextbookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_name: str
    size_bytes: int
    sha256: str
    status: TextbookStatus
    chunk_count: int
    error: str | None
    created_at: datetime
