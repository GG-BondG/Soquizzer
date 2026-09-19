from app.dto import CourseCreateRequest
from app.entity import Course
from app.exception import CourseNotFoundError
from app.repository import CourseRepository


class CourseService:
    def __init__(self, courses: CourseRepository):
        self._courses = courses

    def create(self, request: CourseCreateRequest) -> Course:
        return self._courses.add(Course(name=request.name, subject=request.subject))

    def get(self, course_id: str) -> Course:
        course = self._courses.get(course_id)
        if course is None:
            raise CourseNotFoundError(f"Course {course_id} not found")
        return course

    def list_all(self) -> list[Course]:
        return self._courses.list_all()

    def delete(self, course_id: str) -> None:
        self._courses.delete(self.get(course_id))
