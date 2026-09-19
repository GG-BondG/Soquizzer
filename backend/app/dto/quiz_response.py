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


class QuizResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    created_at: datetime
    questions: list[QuestionResponse]
