from app.dto import AttemptDetail, AttemptQuestion, AttemptSummary, HistoryResponse, HistorySummary
from app.entity import Attempt
from app.exception import AttemptNotFoundError
from app.repository import AttemptRepository
from app.service.course_service import CourseService
from app.service.section_service import SectionService


def _summary(attempt: Attempt) -> dict:
    section = attempt.quiz.section
    return {
        "attempt_id": attempt.id,
        "quiz_id": attempt.quiz_id,
        "section_id": section.id,
        "section_name": section.name,
        "course_id": section.course_id,
        "course_name": section.course.name,
        "submitted_at": attempt.submitted_at,
        "score": attempt.score,
        "total": attempt.total,
        "accuracy": attempt.score / attempt.total if attempt.total else 0.0,
        "time_spent_seconds": attempt.time_spent_seconds,
    }


class HistoryService:
    def __init__(self, attempts: AttemptRepository, courses: CourseService, sections: SectionService):
        self._attempts = attempts
        self._courses = courses
        self._sections = sections

    def history(self, course_id: str | None, section_id: str | None, limit: int) -> HistoryResponse:
        if course_id is not None:
            self._courses.get(course_id)
        if section_id is not None:
            self._sections.get(section_id)
        totals = self._attempts.totals(course_id=course_id, section_id=section_id)
        attempts = self._attempts.list_recent(limit, course_id=course_id, section_id=section_id)
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
                    anchor_section=question.anchor_section,
                    source_excerpt=question.source_excerpt,
                    selected_index=answer.selected_index if answer else None,
                    is_correct=answer.is_correct if answer else None,
                )
            )
        return AttemptDetail(**_summary(attempt), questions=questions)
