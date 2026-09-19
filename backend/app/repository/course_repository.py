from sqlalchemy import select
from sqlalchemy.orm import Session

from app.entity import Course


class CourseRepository:
    def __init__(self, session: Session):
        self._session = session

    def add(self, course: Course) -> Course:
        self._session.add(course)
        self._session.commit()
        return course

    def get(self, course_id: str) -> Course | None:
        return self._session.get(Course, course_id)

    def list_all(self) -> list[Course]:
        return list(self._session.scalars(select(Course).order_by(Course.created_at.desc())))

    def delete(self, course: Course) -> None:
        self._session.delete(course)
        self._session.commit()
