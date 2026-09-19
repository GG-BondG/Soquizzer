from fastapi import APIRouter, Depends

from app.dependencies import get_pet_chat_service
from app.dto import ChatRequest, ChatResponse
from app.service import PetChatService

router = APIRouter(tags=["chat"])


@router.post("/api/quizzes/{quiz_id}/questions/{question_id}/chat", response_model=ChatResponse)
def chat_about_question(
    quiz_id: str,
    question_id: str,
    request: ChatRequest,
    service: PetChatService = Depends(get_pet_chat_service),
):
    """The pet's reply to one message about this (not-yet-submitted) question. Stateless: the frontend resends the
    conversation transcript as `history` each turn."""
    return service.reply(quiz_id, question_id, request)
