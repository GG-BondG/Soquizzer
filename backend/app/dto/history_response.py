from datetime import datetime

from pydantic import BaseModel

from app.entity import QuestionType


class AttemptSummary(BaseModel):
    attempt_id: str
    quiz_id: str
    section_id: str
    section_name: str
    course_id: str
    course_name: str
    submitted_at: datetime
    score: int
    total: int
    accuracy: float  # score / total, 0 to 1
    time_spent_seconds: int | None


class HistorySummary(BaseModel):
    attempts: int
    accuracy: float | None  # correct answers / questions over all attempts, None when there are none
    total_time_seconds: int  # attempts without a recorded time count as 0


class HistoryResponse(BaseModel):
    summary: HistorySummary  # covers every matching attempt, not only the ones listed
    attempts: list[AttemptSummary]  # newest first


class AttemptQuestion(BaseModel):
    question_id: str
    position: int
    type: QuestionType
    stem: str
    options: list[str]
    answer_index: int
    explanation: str
    anchor_section: str
    source_excerpt: str
    selected_index: int | None  # None if the student left the question unanswered
    is_correct: bool | None


class AttemptDetail(AttemptSummary):
    questions: list[AttemptQuestion]
