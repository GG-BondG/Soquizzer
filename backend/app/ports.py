"""What the services need from the outside world (a quiz writer, a tutor, PDF reading), and the plain data that
crosses those boundaries. Nothing here imports a vendor SDK: the Gemini adapters in `app.llm` / `app.rag` implement
these, and tests substitute fakes."""

from dataclasses import dataclass
from typing import Protocol

from pydantic import BaseModel

from app.entity import QuestionType


class GeneratedQuestion(BaseModel):
    type: QuestionType
    stem: str
    options: list[str]
    answer_index: int  # 0-based index of the correct option
    explanation: str
    anchor_section: str  # the heading / section / page of the material the question is based on
    source_excerpt: str  # a short passage of the material the student should re-read after a wrong answer


class GeneratedQuiz(BaseModel):
    """The quiz a QuizGenerator returns. It is also the response schema the Gemini adapter hands to the model."""

    questions: list[GeneratedQuestion]


@dataclass(frozen=True)
class PastMistake:
    """A question the student still gets wrong, as they last answered it."""

    stem: str
    options: list[str]
    answer_index: int
    selected_index: int
    explanation: str
    anchor_section: str = ""


@dataclass(frozen=True)
class TypeAccuracy:
    type: QuestionType
    total: int
    correct: int


@dataclass(frozen=True)
class QuestionContext:
    """The question currently on the student's screen. The quiz has not been submitted yet."""

    type: QuestionType
    stem: str
    options: list[str]
    answer_index: int
    explanation: str
    anchor_section: str = ""


@dataclass(frozen=True)
class OwnAttempt:
    """One earlier answer this student gave to this exact question (from a previous attempt at the same quiz)."""

    selected_index: int
    is_correct: bool


@dataclass(frozen=True)
class ChatTurn:
    """One turn of the chat so far. `from_student` is False for the pet's own earlier replies."""

    from_student: bool
    text: str


class QuizGenerator(Protocol):
    def generate(
        self,
        materials: list[tuple[str, str]],
        mistakes: list[PastMistake],
        accuracy: list[TypeAccuracy],
        num_questions: int,
        earlier_stems: list[str] | None = None,
    ) -> GeneratedQuiz:
        """materials are (filename, JSON text) pairs; earlier_stems are questions already asked in this section."""
        ...


class PetTutor(Protocol):
    def reply(
        self,
        question: QuestionContext,
        own_attempts: list[OwnAttempt],
        mistakes: list[PastMistake],
        accuracy: list[TypeAccuracy],
        history: list[ChatTurn],
        message: str,
    ) -> str:
        """Answers `message` about `question`. `history` is the conversation so far, oldest first."""
        ...


class PdfJsonConverter(Protocol):
    def convert(self, pdf: bytes) -> str:
        """Return the PDF's content as JSON text."""
        ...


class PageOcr(Protocol):
    def transcribe(self, pdf: bytes) -> list[str]:
        """Return the text of each page of a scanned PDF, one string per page (blank for an empty page)."""
        ...
