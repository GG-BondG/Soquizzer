from fastapi import APIRouter, Depends, Response, UploadFile

from app.dependencies import get_quiz_service
from app.dto import QuizResponse
from app.service import QuizService

router = APIRouter(tags=["quizzes"])


@router.post("/api/courses/{course_id}/quizzes", status_code=201, response_model=QuizResponse)
def create_quiz(course_id: str, file: UploadFile, service: QuizService = Depends(get_quiz_service)):
    return service.create_from_pdf(course_id, file.filename or "", file.file)


@router.get("/api/courses/{course_id}/quizzes", response_model=list[QuizResponse])
def list_quizzes(course_id: str, service: QuizService = Depends(get_quiz_service)):
    return service.list_by_course(course_id)


@router.get("/api/quizzes/{quiz_id}", response_model=QuizResponse)
def get_quiz(quiz_id: str, service: QuizService = Depends(get_quiz_service)):
    return service.get(quiz_id)


@router.delete("/api/quizzes/{quiz_id}", status_code=204)
def delete_quiz(quiz_id: str, service: QuizService = Depends(get_quiz_service)):
    service.delete(quiz_id)
    return Response(status_code=204)
