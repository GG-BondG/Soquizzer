from fastapi import APIRouter, Depends, Response

from app.dependencies import get_course_service, get_course_textbook_service
from app.dto import CourseCreateRequest, CourseResponse, TextbookResponse
from app.service import CourseService, CourseTextbookService

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.post("", status_code=201, response_model=CourseResponse)
def create_course(request: CourseCreateRequest, service: CourseService = Depends(get_course_service)):
    return service.create(request)


@router.get("", response_model=list[CourseResponse])
def list_courses(service: CourseService = Depends(get_course_service)):
    return service.list_all()


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(course_id: str, service: CourseService = Depends(get_course_service)):
    return service.get(course_id)


@router.delete("/{course_id}", status_code=204)
def delete_course(course_id: str, service: CourseService = Depends(get_course_service)):
    service.delete(course_id)
    return Response(status_code=204)


@router.get("/{course_id}/textbooks", response_model=list[TextbookResponse])
def list_course_textbooks(course_id: str, service: CourseTextbookService = Depends(get_course_textbook_service)):
    return service.list(course_id)


@router.put("/{course_id}/textbooks/{textbook_id}", status_code=204)
def attach_textbook(
    course_id: str, textbook_id: str, service: CourseTextbookService = Depends(get_course_textbook_service)
):
    service.attach(course_id, textbook_id)
    return Response(status_code=204)


@router.delete("/{course_id}/textbooks/{textbook_id}", status_code=204)
def detach_textbook(
    course_id: str, textbook_id: str, service: CourseTextbookService = Depends(get_course_textbook_service)
):
    service.detach(course_id, textbook_id)
    return Response(status_code=204)
