from fastapi import APIRouter, Depends, Response

from app.dependencies import get_quiz_service
from app.dto import (
    AnswerResult,
    CheckRequest,
    ProgressResponse,
    QuizResponse,
    QuizSummaryResponse,
    SubmissionRequest,
    SubmissionResponse,
)
from app.service import QuizService

router = APIRouter(tags=["quizzes"])


@router.post("/api/sections/{section_id}/quizzes", status_code=201, response_model=QuizResponse)
def create_quiz(section_id: str, service: QuizService = Depends(get_quiz_service)):
    """Creates the next quiz in the section and returns its questions (20 by default)."""
    return service.generate(section_id)


@router.get("/api/sections/{section_id}/quizzes", response_model=list[QuizSummaryResponse])
def list_quizzes(section_id: str, service: QuizService = Depends(get_quiz_service)):
    return service.list_by_section(section_id)


@router.get("/api/quizzes/{quiz_id}", response_model=QuizResponse)
def get_quiz(quiz_id: str, service: QuizService = Depends(get_quiz_service)):
    return service.get(quiz_id)


@router.delete("/api/quizzes/{quiz_id}", status_code=204)
def delete_quiz(quiz_id: str, service: QuizService = Depends(get_quiz_service)):
    service.delete(quiz_id)
    return Response(status_code=204)


@router.post("/api/quizzes/{quiz_id}/questions/{question_id}/check", response_model=AnswerResult)
def check_answer(quiz_id: str, question_id: str, request: CheckRequest, service: QuizService = Depends(get_quiz_service)):
    """Grades one answer right away and reveals the answer and explanation; nothing is recorded."""
    return service.check(quiz_id, question_id, request)


@router.post("/api/quizzes/{quiz_id}/submissions", status_code=201, response_model=SubmissionResponse)
def submit_answers(quiz_id: str, request: SubmissionRequest, service: QuizService = Depends(get_quiz_service)):
    return service.submit(quiz_id, request)


@router.get("/api/courses/{course_id}/progress", response_model=ProgressResponse)
def get_progress(course_id: str, service: QuizService = Depends(get_quiz_service)):
    return service.progress(course_id)


@router.get("/api/sections/{section_id}/progress", response_model=ProgressResponse)
def get_section_progress(section_id: str, service: QuizService = Depends(get_quiz_service)):
    return service.section_progress(section_id)
