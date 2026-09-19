from fastapi import APIRouter, Depends, Response

from app.dependencies import get_group_service
from app.dto import GroupCreateRequest, GroupResponse
from app.service import GroupService

router = APIRouter(tags=["groups"])


@router.post("/api/courses/{course_id}/groups", status_code=201, response_model=GroupResponse)
def create_group(course_id: str, request: GroupCreateRequest, service: GroupService = Depends(get_group_service)):
    return service.create(course_id, request)


@router.get("/api/courses/{course_id}/groups", response_model=list[GroupResponse])
def list_groups(course_id: str, service: GroupService = Depends(get_group_service)):
    return service.list_by_course(course_id)


@router.get("/api/groups/{group_id}", response_model=GroupResponse)
def get_group(group_id: str, service: GroupService = Depends(get_group_service)):
    return service.get(group_id)


@router.delete("/api/groups/{group_id}", status_code=204)
def delete_group(group_id: str, service: GroupService = Depends(get_group_service)):
    service.delete(group_id)
    return Response(status_code=204)
