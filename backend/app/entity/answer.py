import uuid
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.entity.attempt import Attempt
from app.entity.base import Base, UtcDateTime
from app.entity.question import Question


class Answer(Base):
    """One answer to one question within an attempt."""

    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id: Mapped[str] = mapped_column(ForeignKey("attempts.id"), index=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id"), index=True)
    selected_index: Mapped[int]
    is_correct: Mapped[bool]
    answered_at: Mapped[datetime] = mapped_column(UtcDateTime, default=lambda: datetime.now(timezone.utc))

    attempt: Mapped[Attempt] = relationship(back_populates="answers")
    question: Mapped[Question] = relationship(back_populates="answers")
