import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.entity.base import Base, UtcDateTime
from app.entity.section import Section

if TYPE_CHECKING:
    from app.entity.attempt import Attempt
    from app.entity.question import Question


class Quiz(Base):
    """One round in a section: the questions Gemini wrote for it, and every attempt at them."""

    __tablename__ = "quizzes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    section_id: Mapped[str] = mapped_column(ForeignKey("sections.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=lambda: datetime.now(timezone.utc))

    section: Mapped[Section] = relationship(back_populates="quizzes")
    questions: Mapped[list["Question"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", order_by="Question.position"
    )
    attempts: Mapped[list["Attempt"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", order_by="Attempt.submitted_at.desc()"
    )

    @property
    def question_count(self) -> int:
        return len(self.questions)

    @property
    def attempt_count(self) -> int:
        return len(self.attempts)
