from app.dto import AttemptDetail, AttemptQuestion, AttemptSummary, HistoryResponse, HistorySummary
from app.entity import Attempt
from app.exception import AttemptNotFoundError
from app.repository import AttemptRepository
from app.service.course_service import CourseService
from app.service.group_service import GroupService


def _summary(attempt: Attempt) -> dict:
    group = attempt.quiz.group
    return {
        "attempt_id": attempt.id,
        "quiz_id": attempt.quiz_id,
        "group_id": group.id,
        "group_name": group.name,
        "course_id": group.course_id,
        "course_name": group.course.name,
        "submitted_at": attempt.submitted_at,
        "score": attempt.score,
        "total": attempt.total,
        "accuracy": attempt.score / attempt.total if attempt.total else 0.0,
        "time_spent_seconds": attempt.time_spent_seconds,
    }


class HistoryService:
    def __init__(self, attempts: AttemptRepository, courses: CourseService, groups: GroupService):
        self._attempts = attempts
        self._courses = courses
        self._groups = groups

    def history(self, course_id: str | None, group_id: str | None, limit: int) -> HistoryResponse:
        if course_id is not None:
            self._courses.get(course_id)
        if group_id is not None:
            self._groups.get(group_id)
        totals = self._attempts.totals(course_id=course_id, group_id=group_id)
        attempts = self._attempts.list_recent(limit, course_id=course_id, group_id=group_id)
        return HistoryResponse(
            summary=HistorySummary(
                attempts=totals.attempts,
                accuracy=totals.score / totals.total if totals.total else None,
                total_time_seconds=totals.time_spent_seconds,
            ),
            attempts=[AttemptSummary(**_summary(attempt)) for attempt in attempts],
        )

    def attempt(self, attempt_id: str) -> AttemptDetail:
        attempt = self._attempts.get(attempt_id)
        if attempt is None:
            raise AttemptNotFoundError(f"Attempt {attempt_id} not found")
        answers = {answer.question_id: answer for answer in attempt.answers}
        questions = []
        for question in attempt.quiz.questions:
            answer = answers.get(question.id)
            questions.append(
                AttemptQuestion(
                    question_id=question.id,
                    position=question.position,
                    type=question.type,
                    stem=question.stem,
                    options=question.options,
                    answer_index=question.answer_index,
                    explanation=question.explanation,
                    selected_index=answer.selected_index if answer else None,
                    is_correct=answer.is_correct if answer else None,
                )
            )
        return AttemptDetail(**_summary(attempt), questions=questions)
