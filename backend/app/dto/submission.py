from pydantic import BaseModel, Field


class AnswerInput(BaseModel):
    question_id: str
    selected_index: int


class SubmissionRequest(BaseModel):
    answers: list[AnswerInput] = Field(min_length=1)


class AnswerResult(BaseModel):
    question_id: str
    selected_index: int
    is_correct: bool
    answer_index: int
    explanation: str


class SubmissionResponse(BaseModel):
    score: int  # correct answers
    total: int  # questions in the quiz; unanswered ones are not recorded
    results: list[AnswerResult]
