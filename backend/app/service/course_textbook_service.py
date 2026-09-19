from app.entity import Textbook
from app.exception import TextbookNotFoundError
from app.repository import CourseTextbookRepository, TextbookRepository
from app.service.course_service import CourseService


class CourseTextbookService:
    """Which textbooks a course's quizzes may draw on."""

    def __init__(self, links: CourseTextbookRepository, textbooks: TextbookRepository, courses: CourseService):
        self._links = links
        self._textbooks = textbooks
        self._courses = courses

    def attach(self, course_id: str, textbook_id: str) -> None:
        course = self._courses.get(course_id)
        self._get_textbook(textbook_id)
        self._links.attach(course.id, textbook_id)

    def detach(self, course_id: str, textbook_id: str) -> None:
        course = self._courses.get(course_id)
        self._get_textbook(textbook_id)
        self._links.detach(course.id, textbook_id)

    def list(self, course_id: str) -> list[Textbook]:
        return self._links.list_textbooks(self._courses.get(course_id).id)

    def _get_textbook(self, textbook_id: str) -> Textbook:
        textbook = self._textbooks.get(textbook_id)
        if textbook is None:
            raise TextbookNotFoundError(f"Textbook {textbook_id} not found")
        return textbook
