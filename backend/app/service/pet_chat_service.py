from app.dto import ChatRequest, ChatResponse
from app.exception import QuestionNotFoundError, QuizNotFoundError
from app.llm import ChatTurn, OwnAttempt, PastMistake, PetTutor, QuestionContext, TypeAccuracy
from app.repository import AnswerRepository, QuizRepository


class PetChatService:
    def __init__(
        self,
        quizzes: QuizRepository,
        answers: AnswerRepository,
        tutor: PetTutor,
        mistake_review_limit: int,
    ):
        self._quizzes = quizzes
        self._answers = answers
        self._tutor = tutor
        self._mistake_review_limit = mistake_review_limit

    def reply(self, quiz_id: str, question_id: str, request: ChatRequest) -> ChatResponse:
        """Builds this question's context (plus the student's own history on it and in the section) fresh from the
        database on every call — nothing about the conversation is kept on the server between requests."""
        quiz = self._quizzes.get(quiz_id)
        if quiz is None:
            raise QuizNotFoundError(f"Quiz {quiz_id} not found")
        question = next((q for q in quiz.questions if q.id == question_id), None)
        if question is None:
            raise QuestionNotFoundError(f"Question {question_id} not found in quiz {quiz_id}")

        context = QuestionContext(
            type=question.type,
            stem=question.stem,
            options=question.options,
            answer_index=question.answer_index,
            explanation=question.explanation,
            anchor_section=question.anchor_section,
        )
        own_attempts = [
            OwnAttempt(selected_index=a.selected_index, is_correct=a.is_correct)
            for a in self._answers.history_for_question(question.id)
        ]
        mistakes = [
            PastMistake(q.stem, q.options, q.answer_index, a.selected_index, q.explanation, q.anchor_section)
            for q, a in self._answers.still_wrong(self._mistake_review_limit, section_id=quiz.section_id)
        ]
        accuracy = [
            TypeAccuracy(kind, total, correct)
            for kind, total, correct in self._answers.stats_by_type(section_id=quiz.section_id)
        ]
        history = [ChatTurn(from_student=turn.role == "student", text=turn.text) for turn in request.history]

        reply = self._tutor.reply(context, own_attempts, mistakes, accuracy, history, request.message)
        return ChatResponse(reply=reply)
