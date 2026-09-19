from sqlalchemy import Integer, Select, and_, case, func, select
from sqlalchemy.orm import Session

from app.entity import Answer, Question, QuestionType, Quiz, QuizGroup


def _in_scope(query: Select, group_id: str | None, course_id: str | None) -> Select:
    """Restrict a query on questions to one group, or to every group of one course."""
    query = query.join(Quiz, Quiz.id == Question.quiz_id)
    if group_id is not None:
        return query.where(Quiz.group_id == group_id)
    return query.join(QuizGroup, QuizGroup.id == Quiz.group_id).where(QuizGroup.course_id == course_id)


class AnswerRepository:
    def __init__(self, session: Session):
        self._session = session

    def still_wrong(
        self, limit: int, *, group_id: str | None = None, course_id: str | None = None
    ) -> list[tuple[Question, Answer]]:
        """Questions whose most recent answer is wrong, newest mistake first."""
        latest = (
            select(Answer.question_id, func.max(Answer.answered_at).label("answered_at"))
            .group_by(Answer.question_id)
            .subquery()
        )
        query = (
            select(Question, Answer)
            .join(Answer, Answer.question_id == Question.id)
            .join(latest, and_(latest.c.question_id == Answer.question_id, latest.c.answered_at == Answer.answered_at))
        )
        query = _in_scope(query, group_id, course_id)
        query = query.where(Answer.is_correct.is_(False)).order_by(Answer.answered_at.desc()).limit(limit)
        return [(question, answer) for question, answer in self._session.execute(query)]

    def stats_by_type(
        self, *, group_id: str | None = None, course_id: str | None = None
    ) -> list[tuple[QuestionType, int, int]]:
        """(type, answers given, answers correct) over every answer in scope."""
        query = select(
            Question.type, func.count(Answer.id), func.sum(case((Answer.is_correct, 1), else_=0), type_=Integer)
        ).join(Answer, Answer.question_id == Question.id)
        query = _in_scope(query, group_id, course_id).group_by(Question.type).order_by(Question.type)
        return [(kind, total, correct) for kind, total, correct in self._session.execute(query)]
