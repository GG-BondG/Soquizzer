from sqlalchemy import select
from sqlalchemy.orm import Session

from app.entity import Textbook


class TextbookRepository:
    def __init__(self, session: Session):
        self._session = session

    def add(self, textbook: Textbook) -> Textbook:
        self._session.add(textbook)
        self._session.commit()
        return textbook

    def save(self, textbook: Textbook) -> Textbook:
        self._session.commit()
        return textbook

    def get(self, textbook_id: str) -> Textbook | None:
        return self._session.get(Textbook, textbook_id)

    def get_by_sha256(self, sha256: str) -> Textbook | None:
        return self._session.scalar(select(Textbook).where(Textbook.sha256 == sha256))

    def list_all(self) -> list[Textbook]:
        return list(self._session.scalars(select(Textbook).order_by(Textbook.created_at.desc())))

    def delete(self, textbook: Textbook) -> None:
        self._session.delete(textbook)
        self._session.commit()
