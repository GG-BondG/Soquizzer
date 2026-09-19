from pydantic import BaseModel, Field


class AnswerInput(BaseModel):
    question_id: str
    selected_index: int


class CheckRequest(BaseModel):
    selected_index: int


class SubmissionRequest(BaseModel):
    answers: list[AnswerInput] = Field(min_length=1)
    time_spent_seconds: int | None = Field(default=None, ge=0)  # how long the student took, measured by the frontend


class AnswerResult(BaseModel):
    question_id: str
    selected_index: int
    is_correct: bool
    answer_index: int
    explanation: str
    anchor_section: str  # where in the material the question comes from ("" for quizzes made before this existed)
    source_excerpt: str  # the passage to re-read; shown only after submitting, since it can give the answer away


class SubmissionResponse(BaseModel):
    attempt_id: str
    score: int  # correct answers
    total: int  # questions in the quiz; unanswered ones are not recorded
    results: list[AnswerResult]
