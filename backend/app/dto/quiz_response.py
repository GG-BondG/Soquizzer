from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.entity import QuestionType


class QuestionResponse(BaseModel):
    """What the student sees: no answer and no explanation until they submit."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    position: int
    type: QuestionType
    stem: str
    options: list[str]


class AnswerReveal(BaseModel):
    """The answer to one question, asked for before submitting (Trivia shows it as soon as the student picks)."""

    model_config = ConfigDict(from_attributes=True)

    question_id: str
    answer_index: int
    explanation: str
    anchor_section: str
    source_excerpt: str


class QuizResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    section_id: str
    created_at: datetime
    questions: list[QuestionResponse]


class QuizSummaryResponse(BaseModel):
    """A quiz in a list: no questions."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    section_id: str
    created_at: datetime
    question_count: int
    attempt_count: int
