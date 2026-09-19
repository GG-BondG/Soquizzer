from sqlalchemy import Integer, and_, case, func, select
from sqlalchemy.orm import Session

from app.entity import Answer, Question, QuestionType, Quiz


class AnswerRepository:
    def __init__(self, session: Session):
        self._session = session

    def add_many(self, answers: list[Answer]) -> None:
        self._session.add_all(answers)
        self._session.commit()

    def still_wrong(self, course_id: str, limit: int) -> list[tuple[Question, Answer]]:
        """Questions of this course whose most recent answer is wrong, newest mistake first."""
        latest = (
            select(Answer.question_id, func.max(Answer.answered_at).label("answered_at"))
            .group_by(Answer.question_id)
            .subquery()
        )
        query = (
            select(Question, Answer)
            .join(Answer, Answer.question_id == Question.id)
            .join(latest, and_(latest.c.question_id == Answer.question_id, latest.c.answered_at == Answer.answered_at))
            .join(Quiz, Quiz.id == Question.quiz_id)
            .where(Quiz.course_id == course_id, Answer.is_correct.is_(False))
            .order_by(Answer.answered_at.desc())
            .limit(limit)
        )
        return [(question, answer) for question, answer in self._session.execute(query)]

    def stats_by_type(self, course_id: str) -> list[tuple[QuestionType, int, int]]:
        """(type, answers given, answers correct) over every answer in this course."""
        query = (
            select(Question.type, func.count(Answer.id), func.sum(case((Answer.is_correct, 1), else_=0), type_=Integer))
            .join(Answer, Answer.question_id == Question.id)
            .join(Quiz, Quiz.id == Question.quiz_id)
            .where(Quiz.course_id == course_id)
            .group_by(Question.type)
            .order_by(Question.type)
        )
        return [(kind, total, correct) for kind, total, correct in self._session.execute(query)]
