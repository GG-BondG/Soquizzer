from sqlalchemy import select
from sqlalchemy.orm import Session

from app.entity import Quiz


class QuizRepository:
    def __init__(self, session: Session):
        self._session = session

    def add(self, quiz: Quiz) -> Quiz:
        self._session.add(quiz)
        self._session.commit()
        return quiz

    def get(self, quiz_id: str) -> Quiz | None:
        return self._session.get(Quiz, quiz_id)

    def list_by_section(self, section_id: str) -> list[Quiz]:
        query = select(Quiz).where(Quiz.section_id == section_id).order_by(Quiz.created_at.desc())
        return list(self._session.scalars(query))

    def delete(self, quiz: Quiz) -> None:
        self._session.delete(quiz)
        self._session.commit()
