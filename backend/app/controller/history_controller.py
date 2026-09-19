from fastapi import APIRouter, Depends, Query

from app.dependencies import get_history_service
from app.dto import AttemptDetail, HistoryResponse
from app.service import HistoryService

router = APIRouter(tags=["history"])


@router.get("/api/history", response_model=HistoryResponse)
def get_history(
    course_id: str | None = None,
    section_id: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    service: HistoryService = Depends(get_history_service),
):
    """Every quiz attempt, newest first, with score, accuracy and time spent. Filter by course or section."""
    return service.history(course_id, section_id, limit)


@router.get("/api/attempts/{attempt_id}", response_model=AttemptDetail)
def get_attempt(attempt_id: str, service: HistoryService = Depends(get_history_service)):
    """One attempt with every question, what the student picked, the right answer and the explanation."""
    return service.attempt(attempt_id)
