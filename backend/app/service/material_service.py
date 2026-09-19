from pathlib import Path
from typing import BinaryIO

from app.entity import Material
from app.exception import FileTooLargeError, MaterialNotFoundError, UnsupportedFileTypeError
from app.llm import PdfJsonConverter
from app.repository import MaterialRepository
from app.service.course_service import CourseService


class MaterialService:
    def __init__(
        self,
        materials: MaterialRepository,
        courses: CourseService,
        converter: PdfJsonConverter,
        max_pdf_bytes: int,
    ):
        self._materials = materials
        self._courses = courses
        self._converter = converter
        self._max_pdf_bytes = max_pdf_bytes

    def create_from_pdf(self, course_id: str, filename: str, pdf: BinaryIO) -> Material:
        """Turn an uploaded PDF into JSON and store it under the course. The PDF itself is not kept."""
        course = self._courses.get(course_id)
        name = Path(filename).name
        data = pdf.read(self._max_pdf_bytes + 1)
        if len(data) > self._max_pdf_bytes:
            raise FileTooLargeError(f"PDF exceeds the {self._max_pdf_bytes} byte limit")
        if Path(name).suffix.lower() != ".pdf" or not data.startswith(b"%PDF-"):
            raise UnsupportedFileTypeError("Only PDF files can be used as course material")

        content = self._converter.convert(data)
        return self._materials.add(Material(course_id=course.id, source_filename=name, content=content))

    def get(self, material_id: str) -> Material:
        material = self._materials.get(material_id)
        if material is None:
            raise MaterialNotFoundError(f"Material {material_id} not found")
        return material

    def list_by_course(self, course_id: str) -> list[Material]:
        course = self._courses.get(course_id)
        return self._materials.list_by_course(course.id)

    def delete(self, material_id: str) -> None:
        self._materials.delete(self.get(material_id))
