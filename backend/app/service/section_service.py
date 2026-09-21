from app.entity import Section
from app.exception import SectionNotFoundError
from app.repository import SectionRepository
from app.service.course_service import CourseService


class SectionService:
    def __init__(self, sections: SectionRepository, courses: CourseService):
        self._sections = sections
        self._courses = courses

    def create(self, course_id: str, name: str) -> Section:
        course = self._courses.get(course_id)
        return self._sections.add(Section(course_id=course.id, name=name))

    def get(self, section_id: str) -> Section:
        section = self._sections.get(section_id)
        if section is None:
            raise SectionNotFoundError(f"Section {section_id} not found")
        return section

    def list_by_course(self, course_id: str) -> list[Section]:
        course = self._courses.get(course_id)
        return self._sections.list_by_course(course.id)

    def delete(self, section_id: str) -> None:
        self._sections.delete(self.get(section_id))
