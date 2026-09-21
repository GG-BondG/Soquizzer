from fastapi import APIRouter, Depends, Response

from app.dependencies import get_section_service
from app.dto import SectionCreateRequest, SectionResponse
from app.service import SectionService

router = APIRouter(tags=["sections"])


@router.post("/api/courses/{course_id}/sections", status_code=201, response_model=SectionResponse)
def create_section(course_id: str, request: SectionCreateRequest, service: SectionService = Depends(get_section_service)):
    return service.create(course_id, request.name)


@router.get("/api/courses/{course_id}/sections", response_model=list[SectionResponse])
def list_sections(course_id: str, service: SectionService = Depends(get_section_service)):
    return service.list_by_course(course_id)


@router.get("/api/sections/{section_id}", response_model=SectionResponse)
def get_section(section_id: str, service: SectionService = Depends(get_section_service)):
    return service.get(section_id)


@router.delete("/api/sections/{section_id}", status_code=204)
def delete_section(section_id: str, service: SectionService = Depends(get_section_service)):
    service.delete(section_id)
    return Response(status_code=204)
