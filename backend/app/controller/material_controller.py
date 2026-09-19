from fastapi import APIRouter, Depends, Response, UploadFile

from app.dependencies import get_material_service
from app.dto import MaterialResponse
from app.service import MaterialService

router = APIRouter(tags=["materials"])


@router.post("/api/courses/{course_id}/materials", status_code=201, response_model=MaterialResponse)
def create_material(course_id: str, file: UploadFile, service: MaterialService = Depends(get_material_service)):
    return service.create_from_pdf(course_id, file.filename or "", file.file)


@router.get("/api/courses/{course_id}/materials", response_model=list[MaterialResponse])
def list_materials(course_id: str, service: MaterialService = Depends(get_material_service)):
    return service.list_by_course(course_id)


@router.get("/api/materials/{material_id}", response_model=MaterialResponse)
def get_material(material_id: str, service: MaterialService = Depends(get_material_service)):
    return service.get(material_id)


@router.delete("/api/materials/{material_id}", status_code=204)
def delete_material(material_id: str, service: MaterialService = Depends(get_material_service)):
    service.delete(material_id)
    return Response(status_code=204)
