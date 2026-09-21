from app.ports import ChatTurn, OwnAttempt, PetTutor, QuestionContext
from app.repository import AnswerRepository
from app.service.quiz_service import QuizService
from app.service.section_profile import load_section_profile


class PetChatService:
    def __init__(
        self,
        quizzes: QuizService,
        answers: AnswerRepository,
        tutor: PetTutor,
        mistake_review_limit: int,
    ):
        self._quizzes = quizzes
        self._answers = answers
        self._tutor = tutor
        self._mistake_review_limit = mistake_review_limit

    def reply(self, quiz_id: str, question_id: str, message: str, history: list[ChatTurn]) -> str:
        """Builds this question's context (plus the student's own history on it and in the section) fresh from the
        database on every call — nothing about the conversation is kept on the server between requests."""
        question = self._quizzes.get_question(quiz_id, question_id)

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
        profile = load_section_profile(self._answers, question.quiz.section_id, self._mistake_review_limit)
        return self._tutor.reply(context, own_attempts, profile.mistakes, profile.accuracy, history, message)
