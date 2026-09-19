from datetime import datetime

from pydantic import BaseModel

from app.entity import QuestionType


class TypeStat(BaseModel):
    type: QuestionType
    total: int
    correct: int


class Mistake(BaseModel):
    question_id: str
    quiz_id: str
    type: QuestionType
    stem: str
    options: list[str]
    answer_index: int
    explanation: str
    selected_index: int
    answered_at: datetime


class ProgressResponse(BaseModel):
    by_type: list[TypeStat]  # every answer given in the course, grouped by question type
    mistakes: list[Mistake]  # questions whose latest answer is still wrong, newest first
