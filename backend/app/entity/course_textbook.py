from datetime import datetime, timezone

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.entity.base import Base, UtcDateTime


class CourseTextbook(Base):
    """A textbook attached to a course. Quizzes for the course search its chunks; one textbook can serve many courses."""

    __tablename__ = "course_textbooks"

    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), primary_key=True)
    textbook_id: Mapped[str] = mapped_column(ForeignKey("textbooks.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=lambda: datetime.now(timezone.utc))
