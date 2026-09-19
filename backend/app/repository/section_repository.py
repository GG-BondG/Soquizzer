from sqlalchemy import select
from sqlalchemy.orm import Session

from app.entity import Section


class SectionRepository:
    def __init__(self, session: Session):
        self._session = session

    def add(self, section: Section) -> Section:
        self._session.add(section)
        self._session.commit()
        return section

    def get(self, section_id: str) -> Section | None:
        return self._session.get(Section, section_id)

    def list_by_course(self, course_id: str) -> list[Section]:
        query = select(Section).where(Section.course_id == course_id).order_by(Section.created_at)
        return list(self._session.scalars(query))

    def delete(self, section: Section) -> None:
        self._session.delete(section)
        self._session.commit()
