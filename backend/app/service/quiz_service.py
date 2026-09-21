from app.entity import Question, Quiz
from app.exception import FileTooLargeError, NoMaterialError, QuestionNotFoundError, QuizNotFoundError
from app.ports import QuizGenerator
from app.repository import AnswerRepository, MaterialRepository, QuizRepository
from app.service.section_profile import load_section_profile
from app.service.section_service import SectionService

_EARLIER_STEMS = 60  # questions of earlier quizzes in the section that the next quiz is told not to repeat


class QuizService:
    def __init__(
        self,
        quizzes: QuizRepository,
        answers: AnswerRepository,
        materials: MaterialRepository,
        sections: SectionService,
        generator: QuizGenerator,
        questions_per_quiz: int,
        mistake_review_limit: int,
        max_material_chars: int,
    ):
        self._quizzes = quizzes
        self._answers = answers
        self._materials = materials
        self._sections = sections
        self._generator = generator
        self._questions_per_quiz = questions_per_quiz
        self._mistake_review_limit = mistake_review_limit
        self._max_material_chars = max_material_chars

    def generate(self, section_id: str) -> Quiz:
        """Add a new round to the section. Callers only get questions back; whether earlier rounds shaped them is
        this method's business: the mistakes still open in this section are re-read and handed to Gemini."""
        section = self._sections.get(section_id)
        # The questions come from the section's own PDF, nothing else.
        materials = [(m.source_filename, m.content) for m in self._materials.list_by_section(section.id)]
        if not materials:
            raise NoMaterialError("Upload a PDF to this section before generating a quiz")
        if sum(len(content) for _, content in materials) > self._max_material_chars:
            raise FileTooLargeError("The section's PDF is too large to fit in one quiz prompt")

        profile = load_section_profile(self._answers, section.id, self._mistake_review_limit)
        earlier_stems = [q.stem for quiz in self._quizzes.list_by_section(section.id) for q in quiz.questions][:_EARLIER_STEMS]
        generated = self._generator.generate(
            materials, profile.mistakes, profile.accuracy, self._questions_per_quiz, earlier_stems
        )

        questions = [
            Question(
                position=position,
                type=item.type,
                stem=item.stem,
                options=item.options,
                answer_index=item.answer_index,
                explanation=item.explanation,
                anchor_section=item.anchor_section.strip()[:255],
                source_excerpt=item.source_excerpt.strip()[:1000],
            )
            for position, item in enumerate(generated.questions, start=1)
        ]
        return self._quizzes.add(Quiz(section_id=section.id, questions=questions))

    def get(self, quiz_id: str) -> Quiz:
        quiz = self._quizzes.get(quiz_id)
        if quiz is None:
            raise QuizNotFoundError(f"Quiz {quiz_id} not found")
        return quiz

    def get_question(self, quiz_id: str, question_id: str) -> Question:
        quiz = self.get(quiz_id)
        question = next((q for q in quiz.questions if q.id == question_id), None)
        if question is None:
            raise QuestionNotFoundError(f"Question {question_id} not found in quiz {quiz_id}")
        return question

    def list_by_section(self, section_id: str) -> list[Quiz]:
        section = self._sections.get(section_id)
        return self._quizzes.list_by_section(section.id)

    def delete(self, quiz_id: str) -> None:
        self._quizzes.delete(self.get(quiz_id))
