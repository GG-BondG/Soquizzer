from sqlalchemy import select
from sqlalchemy.orm import Session

from app.entity import Material


class MaterialRepository:
    def __init__(self, session: Session):
        self._session = session

    def add(self, material: Material) -> Material:
        self._session.add(material)
        self._session.commit()
        return material

    def get(self, material_id: str) -> Material | None:
        return self._session.get(Material, material_id)

    def list_by_course(self, course_id: str) -> list[Material]:
        query = select(Material).where(Material.course_id == course_id).order_by(Material.created_at)
        return list(self._session.scalars(query))

    def delete(self, material: Material) -> None:
        self._session.delete(material)
        self._session.commit()
