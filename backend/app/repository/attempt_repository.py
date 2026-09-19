from dataclasses import dataclass

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, joinedload

from app.entity import Attempt, Quiz, QuizGroup


@dataclass(frozen=True)
class AttemptTotals:
    attempts: int
    score: int
    total: int
    time_spent_seconds: int


def _filtered(query: Select, course_id: str | None, group_id: str | None) -> Select:
    query = query.join(Quiz, Quiz.id == Attempt.quiz_id).join(QuizGroup, QuizGroup.id == Quiz.group_id)
    if course_id is not None:
        query = query.where(QuizGroup.course_id == course_id)
    if group_id is not None:
        query = query.where(QuizGroup.id == group_id)
    return query


class AttemptRepository:
    def __init__(self, session: Session):
        self._session = session

    def add(self, attempt: Attempt) -> Attempt:
        self._session.add(attempt)
        self._session.commit()
        return attempt

    def get(self, attempt_id: str) -> Attempt | None:
        return self._session.get(Attempt, attempt_id)

    def list_recent(self, limit: int, *, course_id: str | None = None, group_id: str | None = None) -> list[Attempt]:
        query = _filtered(select(Attempt), course_id, group_id)
        query = query.options(joinedload(Attempt.quiz).joinedload(Quiz.group).joinedload(QuizGroup.course))
        query = query.order_by(Attempt.submitted_at.desc()).limit(limit)
        return list(self._session.scalars(query))

    def totals(self, *, course_id: str | None = None, group_id: str | None = None) -> AttemptTotals:
        query = _filtered(
            select(
                func.count(Attempt.id),
                func.coalesce(func.sum(Attempt.score), 0),
                func.coalesce(func.sum(Attempt.total), 0),
                func.coalesce(func.sum(Attempt.time_spent_seconds), 0),
            ),
            course_id,
            group_id,
        )
        return AttemptTotals(*self._session.execute(query).one())
