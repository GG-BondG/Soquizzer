from fastapi import APIRouter, BackgroundTasks, Depends, Response, UploadFile

from app.dependencies import get_ingestion_service, get_textbook_service
from app.dto import TextbookResponse
from app.service import IngestionService, TextbookService

router = APIRouter(prefix="/api/textbooks", tags=["textbooks"])


@router.post("", status_code=202, response_model=TextbookResponse)
def upload_textbook(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    service: TextbookService = Depends(get_textbook_service),
    ingestion: IngestionService = Depends(get_ingestion_service),
):
    textbook = service.upload(file.file, file.filename or "")
    background_tasks.add_task(ingestion.ingest, textbook.id)
    return textbook


@router.get("", response_model=list[TextbookResponse])
def list_textbooks(service: TextbookService = Depends(get_textbook_service)):
    return service.list_all()


@router.get("/{textbook_id}", response_model=TextbookResponse)
def get_textbook(textbook_id: str, service: TextbookService = Depends(get_textbook_service)):
    return service.get(textbook_id)


@router.delete("/{textbook_id}", status_code=204)
def delete_textbook(textbook_id: str, service: TextbookService = Depends(get_textbook_service)):
    service.delete(textbook_id)
    return Response(status_code=204)
