from sqlalchemy import select
from sqlalchemy.orm import Session

from app.entity import CourseTextbook, Textbook, TextbookStatus


class CourseTextbookRepository:
    def __init__(self, session: Session):
        self._session = session

    def attach(self, course_id: str, textbook_id: str) -> None:
        """Idempotent: attaching twice keeps one link."""
        if self._session.get(CourseTextbook, (course_id, textbook_id)) is None:
            self._session.add(CourseTextbook(course_id=course_id, textbook_id=textbook_id))
            self._session.commit()

    def detach(self, course_id: str, textbook_id: str) -> None:
        link = self._session.get(CourseTextbook, (course_id, textbook_id))
        if link is not None:
            self._session.delete(link)
            self._session.commit()

    def list_textbooks(self, course_id: str, *, ready_only: bool = False) -> list[Textbook]:
        query = (
            select(Textbook)
            .join(CourseTextbook, CourseTextbook.textbook_id == Textbook.id)
            .where(CourseTextbook.course_id == course_id)
            .order_by(CourseTextbook.created_at, Textbook.original_name)
        )
        if ready_only:
            query = query.where(Textbook.status == TextbookStatus.READY)
        return list(self._session.scalars(query))
