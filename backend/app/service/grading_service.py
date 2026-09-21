from dataclasses import dataclass

from app.dto import AnswerResult, SubmissionResponse
from app.entity import Answer, Attempt, Question
from app.exception import InvalidSubmissionError
from app.repository import AttemptRepository
from app.service.quiz_service import QuizService


@dataclass(frozen=True)
class SubmittedAnswer:
    question_id: str
    selected_index: int


class GradingService:
    def __init__(self, quizzes: QuizService, attempts: AttemptRepository):
        self._quizzes = quizzes
        self._attempts = attempts

    def check(self, quiz_id: str, question_id: str, selected_index: int) -> AnswerResult:
        """Grade one answer on the spot (Trivia shows the answer after every question). Nothing is stored: the
        attempt is still recorded by `submit`, once, at the end."""
        question = self._quizzes.get_question(quiz_id, question_id)
        if not 0 <= selected_index < len(question.options):
            raise InvalidSubmissionError(f"Option {selected_index} does not exist for question {question.id}")
        return self._result(question, selected_index)

    @staticmethod
    def _result(question: Question, selected_index: int) -> AnswerResult:
        return AnswerResult(
            question_id=question.id,
            selected_index=selected_index,
            is_correct=selected_index == question.answer_index,
            answer_index=question.answer_index,
            explanation=question.explanation,
            anchor_section=question.anchor_section,
            source_excerpt=question.source_excerpt,
        )

    def submit(
        self, quiz_id: str, submitted: list[SubmittedAnswer], time_spent_seconds: int | None
    ) -> SubmissionResponse:
        """Grade by comparing with the answer Gemini wrote; nothing is stored unless every answer is valid."""
        quiz = self._quizzes.get(quiz_id)
        questions = {question.id: question for question in quiz.questions}
        answers: list[Answer] = []
        results: list[AnswerResult] = []
        for item in submitted:
            question = questions.get(item.question_id)
            if question is None:
                raise InvalidSubmissionError(f"Question {item.question_id} is not part of this quiz")
            if any(a.question_id == question.id for a in answers):
                raise InvalidSubmissionError(f"Question {question.id} was answered more than once")
            if not 0 <= item.selected_index < len(question.options):
                raise InvalidSubmissionError(f"Option {item.selected_index} does not exist for question {question.id}")
            result = self._result(question, item.selected_index)
            answers.append(Answer(question_id=question.id, selected_index=item.selected_index, is_correct=result.is_correct))
            results.append(result)
        score = sum(a.is_correct for a in answers)
        attempt = self._attempts.add(
            Attempt(
                quiz_id=quiz.id,
                time_spent_seconds=time_spent_seconds,
                score=score,
                total=len(questions),
                answers=answers,
            )
        )
        return SubmissionResponse(attempt_id=attempt.id, score=score, total=len(questions), results=results)
