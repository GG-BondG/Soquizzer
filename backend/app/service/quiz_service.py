from pathlib import Path
from typing import BinaryIO

from app.entity import Quiz
from app.exception import FileTooLargeError, QuizNotFoundError, UnsupportedFileTypeError
from app.llm import QuizGenerator
from app.repository import QuizRepository
from app.service.course_service import CourseService


class QuizService:
    def __init__(
        self,
        quizzes: QuizRepository,
        courses: CourseService,
        generator: QuizGenerator,
        max_pdf_bytes: int,
    ):
        self._quizzes = quizzes
        self._courses = courses
        self._generator = generator
        self._max_pdf_bytes = max_pdf_bytes

    def create_from_pdf(self, course_id: str, filename: str, pdf: BinaryIO, num_questions: int) -> Quiz:
        """Turn an uploaded PDF into quiz JSON and store it under the course. The PDF itself is not kept."""
        course = self._courses.get(course_id)
        name = Path(filename).name
        data = pdf.read(self._max_pdf_bytes + 1)
        if len(data) > self._max_pdf_bytes:
            raise FileTooLargeError(f"PDF exceeds the {self._max_pdf_bytes} byte limit")
        if Path(name).suffix.lower() != ".pdf" or not data.startswith(b"%PDF-"):
            raise UnsupportedFileTypeError("Only PDF files can be turned into a quiz")

        content = self._generator.generate(data, num_questions)
        return self._quizzes.add(
            Quiz(course_id=course.id, source_filename=name, content=content.model_dump_json())
        )

    def get(self, quiz_id: str) -> Quiz:
        quiz = self._quizzes.get(quiz_id)
        if quiz is None:
            raise QuizNotFoundError(f"Quiz {quiz_id} not found")
        return quiz

    def list_by_course(self, course_id: str) -> list[Quiz]:
        course = self._courses.get(course_id)
        return self._quizzes.list_by_course(course.id)

    def delete(self, quiz_id: str) -> None:
        self._quizzes.delete(self.get(quiz_id))
