import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.entity.base import Base
from app.entity.quiz import Quiz

if TYPE_CHECKING:
    from app.entity.answer import Answer


class QuestionType(str, enum.Enum):
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"
    TRUE_FALSE = "TRUE_FALSE"


class Question(Base):
    """Every question has options and the index of the correct one, so grading is a comparison."""

    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id: Mapped[str] = mapped_column(ForeignKey("quizzes.id"), index=True)
    position: Mapped[int]
    type: Mapped[QuestionType]
    stem: Mapped[str] = mapped_column(Text)
    options: Mapped[list[str]] = mapped_column(JSON)
    answer_index: Mapped[int]  # 0-based index into options, written by Gemini when it made the question
    explanation: Mapped[str] = mapped_column(Text)
    # Where in the material the question comes from, so a wrong answer can point the student back to it.
    # Empty for quizzes made before these columns existed.
    anchor_section: Mapped[str] = mapped_column(String(255), default="", server_default="")
    source_excerpt: Mapped[str] = mapped_column(Text, default="", server_default="")

    quiz: Mapped[Quiz] = relationship(back_populates="questions")
    answers: Mapped[list["Answer"]] = relationship(back_populates="question", cascade="all, delete-orphan")
