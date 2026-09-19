import uuid
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.entity.base import Base, UtcDateTime
from app.entity.course import Course


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    source_filename: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)  # JSON text produced by Gemini from the PDF
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=lambda: datetime.now(timezone.utc))

    course: Mapped[Course] = relationship(back_populates="quizzes")
