import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.entity.base import Base, UtcDateTime
from app.entity.quiz import Quiz

if TYPE_CHECKING:
    from app.entity.answer import Answer


class Attempt(Base):
    """One submission of a quiz. Taking the same quiz again is a new attempt."""

    __tablename__ = "attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id: Mapped[str] = mapped_column(ForeignKey("quizzes.id"), index=True)
    submitted_at: Mapped[datetime] = mapped_column(UtcDateTime, default=lambda: datetime.now(timezone.utc))
    time_spent_seconds: Mapped[int | None]  # measured by the frontend, so it may be missing
    score: Mapped[int]  # correct answers
    total: Mapped[int]  # questions in the quiz when it was submitted

    quiz: Mapped[Quiz] = relationship(back_populates="attempts")
    answers: Mapped[list["Answer"]] = relationship(back_populates="attempt", cascade="all, delete-orphan")
