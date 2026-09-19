import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.entity.base import Base, UtcDateTime
from app.entity.course import Course

if TYPE_CHECKING:
    from app.entity.quiz import Quiz


class QuizGroup(Base):
    """A section of a course. Its quizzes are the successive rounds, and each round builds on the last."""

    __tablename__ = "quiz_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=lambda: datetime.now(timezone.utc))

    course: Mapped[Course] = relationship(back_populates="groups")
    quizzes: Mapped[list["Quiz"]] = relationship(
        back_populates="group", cascade="all, delete-orphan", order_by="Quiz.created_at.desc()"
    )
