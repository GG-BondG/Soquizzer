from sqlalchemy import select
from sqlalchemy.orm import Session

from app.entity import QuizGroup


class GroupRepository:
    def __init__(self, session: Session):
        self._session = session

    def add(self, group: QuizGroup) -> QuizGroup:
        self._session.add(group)
        self._session.commit()
        return group

    def get(self, group_id: str) -> QuizGroup | None:
        return self._session.get(QuizGroup, group_id)

    def list_by_course(self, course_id: str) -> list[QuizGroup]:
        query = select(QuizGroup).where(QuizGroup.course_id == course_id).order_by(QuizGroup.created_at)
        return list(self._session.scalars(query))

    def delete(self, group: QuizGroup) -> None:
        self._session.delete(group)
        self._session.commit()
