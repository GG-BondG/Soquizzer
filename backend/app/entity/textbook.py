import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.entity.base import Base, UtcDateTime


class TextbookStatus(str, enum.Enum):
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"


class Textbook(Base):
    __tablename__ = "textbooks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    original_name: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int]
    sha256: Mapped[str] = mapped_column(String(64), unique=True)
    storage_key: Mapped[str] = mapped_column(String(255))
    status: Mapped[TextbookStatus] = mapped_column(default=TextbookStatus.PROCESSING)
    chunk_count: Mapped[int] = mapped_column(default=0)
    error: Mapped[str | None] = mapped_column(String(500), default=None)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=lambda: datetime.now(timezone.utc))
