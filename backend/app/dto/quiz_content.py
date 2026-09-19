from pydantic import BaseModel


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    answer_index: int  # 0-based index into options
    explanation: str


class QuizContent(BaseModel):
    """The JSON stored in Quiz.content. Also the response schema handed to Gemini."""

    title: str
    questions: list[QuizQuestion]
