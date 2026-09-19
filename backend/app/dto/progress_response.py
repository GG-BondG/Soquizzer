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
    anchor_section: str
    source_excerpt: str


class RereadSuggestion(BaseModel):
    """A part of the material the student keeps getting wrong, so they should read it again."""

    anchor_section: str
    mistake_count: int  # questions from this part whose latest answer is still wrong
    excerpts: list[str]  # up to 3 different passages from it


class ProgressResponse(BaseModel):
    by_type: list[TypeStat]  # every answer given in the course, grouped by question type
    mistakes: list[Mistake]  # questions whose latest answer is still wrong, newest first
    reread: list[RereadSuggestion]  # parts of the material behind those mistakes, most mistakes first
