import uuid
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.entity.base import Base, UtcDateTime
from app.entity.course import Course
from app.entity.section import Section


class Material(Base):
    """A section's PDF (slides, notes, a chapter), converted into JSON. The section's quizzes are written from it.

    section_id is empty only on rows uploaded back when material belonged to the whole course; they are not used.
    """

    __tablename__ = "materials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    section_id: Mapped[str | None] = mapped_column(ForeignKey("sections.id"), index=True, default=None)
    source_filename: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)  # JSON text extracted from the PDF (see LocalPdfJsonConverter)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=lambda: datetime.now(timezone.utc))

    course: Mapped[Course] = relationship(back_populates="materials")
    section: Mapped[Section | None] = relationship(back_populates="materials")
