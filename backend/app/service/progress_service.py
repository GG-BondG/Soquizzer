from app.dto import Mistake, ProgressResponse, RereadSuggestion, TypeStat
from app.entity import Question
from app.repository import AnswerRepository
from app.service.course_service import CourseService
from app.service.section_service import SectionService

_REREAD_SCAN_LIMIT = 200  # how many still-wrong questions are grouped into reread suggestions
_REREAD_EXCERPTS = 3  # passages listed per suggestion
_REREAD_SUGGESTIONS = 10


def _reread_suggestions(mistakes: list[Question]) -> list[RereadSuggestion]:
    """Group still-wrong questions (newest mistake first) by the part of the material they come from; the biggest
    trouble spots first."""
    groups: dict[str, list[Question]] = {}
    for question in mistakes:
        anchor = question.anchor_section.strip()
        if anchor:  # quizzes made before source anchors existed have none
            groups.setdefault(anchor, []).append(question)
    ranked = sorted(groups.items(), key=lambda item: (-len(item[1]), item[0]))
    return [
        RereadSuggestion(
            anchor_section=anchor,
            mistake_count=len(questions),
            excerpts=list(dict.fromkeys(q.source_excerpt.strip() for q in questions if q.source_excerpt.strip()))[
                :_REREAD_EXCERPTS
            ],
        )
        for anchor, questions in ranked[:_REREAD_SUGGESTIONS]
    ]


class ProgressService:
    def __init__(
        self,
        answers: AnswerRepository,
        courses: CourseService,
        sections: SectionService,
        mistake_review_limit: int,
    ):
        self._answers = answers
        self._courses = courses
        self._sections = sections
        self._mistake_review_limit = mistake_review_limit

    def progress(self, course_id: str) -> ProgressResponse:
        course = self._courses.get(course_id)
        return self._progress(course_id=course.id)

    def section_progress(self, section_id: str) -> ProgressResponse:
        section = self._sections.get(section_id)
        return self._progress(section_id=section.id)

    def _progress(self, *, section_id: str | None = None, course_id: str | None = None) -> ProgressResponse:
        still_wrong = self._answers.still_wrong(_REREAD_SCAN_LIMIT, section_id=section_id, course_id=course_id)
        return ProgressResponse(
            by_type=[
                TypeStat(type=kind, total=total, correct=correct)
                for kind, total, correct in self._answers.stats_by_type(section_id=section_id, course_id=course_id)
            ],
            mistakes=[
                Mistake(
                    question_id=q.id,
                    quiz_id=q.quiz_id,
                    type=q.type,
                    stem=q.stem,
                    options=q.options,
                    answer_index=q.answer_index,
                    explanation=q.explanation,
                    selected_index=a.selected_index,
                    answered_at=a.answered_at,
                    anchor_section=q.anchor_section,
                    source_excerpt=q.source_excerpt,
                )
                for q, a in still_wrong[: self._mistake_review_limit]
            ],
            reread=_reread_suggestions([q for q, _ in still_wrong]),
        )
