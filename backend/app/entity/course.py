import enum
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.entity.base import Base, UtcDateTime

if TYPE_CHECKING:
    from app.entity.group import QuizGroup
    from app.entity.material import Material


class Subject(str, enum.Enum):
    MATH = "MATH"
    PHYSICS = "PHYSICS"
    CHEMISTRY = "CHEMISTRY"
    BIOLOGY = "BIOLOGY"
    COMPUTER_SCIENCE = "COMPUTER_SCIENCE"
    ENGLISH = "ENGLISH"
    HISTORY = "HISTORY"
    GEOGRAPHY = "GEOGRAPHY"
    ECONOMICS = "ECONOMICS"
    OTHER = "OTHER"


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100))
    subject: Mapped[Subject]
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=lambda: datetime.now(timezone.utc))

    materials: Mapped[list["Material"]] = relationship(
        back_populates="course", cascade="all, delete-orphan", order_by="Material.created_at.desc()"
    )
    groups: Mapped[list["QuizGroup"]] = relationship(
        back_populates="course", cascade="all, delete-orphan", order_by="QuizGroup.created_at"
    )
