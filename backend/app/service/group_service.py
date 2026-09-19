from app.dto import GroupCreateRequest
from app.entity import QuizGroup
from app.exception import GroupNotFoundError
from app.repository import GroupRepository
from app.service.course_service import CourseService


class GroupService:
    def __init__(self, groups: GroupRepository, courses: CourseService):
        self._groups = groups
        self._courses = courses

    def create(self, course_id: str, request: GroupCreateRequest) -> QuizGroup:
        course = self._courses.get(course_id)
        return self._groups.add(QuizGroup(course_id=course.id, name=request.name))

    def get(self, group_id: str) -> QuizGroup:
        group = self._groups.get(group_id)
        if group is None:
            raise GroupNotFoundError(f"Group {group_id} not found")
        return group

    def list_by_course(self, course_id: str) -> list[QuizGroup]:
        course = self._courses.get(course_id)
        return self._groups.list_by_course(course.id)

    def delete(self, group_id: str) -> None:
        self._groups.delete(self.get(group_id))
