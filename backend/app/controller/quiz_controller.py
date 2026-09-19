from fastapi import APIRouter, Depends, Query, Response

from app.dependencies import get_quiz_service
from app.dto import ProgressResponse, QuizResponse, SubmissionRequest, SubmissionResponse
from app.service import QuizService

router = APIRouter(tags=["quizzes"])


@router.post("/api/courses/{course_id}/quizzes", status_code=201, response_model=QuizResponse)
def generate_quiz(
    course_id: str,
    num_questions: int = Query(10, ge=1, le=50),
    service: QuizService = Depends(get_quiz_service),
):
    return service.generate(course_id, num_questions)


@router.get("/api/courses/{course_id}/quizzes", response_model=list[QuizResponse])
def list_quizzes(course_id: str, service: QuizService = Depends(get_quiz_service)):
    return service.list_by_course(course_id)


@router.get("/api/courses/{course_id}/progress", response_model=ProgressResponse)
def get_progress(course_id: str, service: QuizService = Depends(get_quiz_service)):
    return service.progress(course_id)


@router.get("/api/quizzes/{quiz_id}", response_model=QuizResponse)
def get_quiz(quiz_id: str, service: QuizService = Depends(get_quiz_service)):
    return service.get(quiz_id)


@router.delete("/api/quizzes/{quiz_id}", status_code=204)
def delete_quiz(quiz_id: str, service: QuizService = Depends(get_quiz_service)):
    service.delete(quiz_id)
    return Response(status_code=204)


@router.post("/api/quizzes/{quiz_id}/submissions", status_code=201, response_model=SubmissionResponse)
def submit_answers(quiz_id: str, request: SubmissionRequest, service: QuizService = Depends(get_quiz_service)):
    return service.submit(quiz_id, request)
