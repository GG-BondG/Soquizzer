from app.dto import (
    AnswerResult,
    CheckRequest,
    Mistake,
    ProgressResponse,
    RereadSuggestion,
    SubmissionRequest,
    SubmissionResponse,
    TypeStat,
)
from app.entity import Answer, Attempt, Question, Quiz
from app.exception import (
    FileTooLargeError,
    InvalidSubmissionError,
    NoMaterialError,
    QuestionNotFoundError,
    QuizNotFoundError,
)
from app.ports import PastMistake, QuizGenerator, TypeAccuracy
from app.repository import AnswerRepository, AttemptRepository, MaterialRepository, QuizRepository
from app.service.course_service import CourseService
from app.service.section_service import SectionService

_EARLIER_STEMS = 60  # questions of earlier quizzes in the section that the next quiz is told not to repeat
_REREAD_SCAN_LIMIT = 200  # how many still-wrong questions are grouped into reread suggestions
_REREAD_EXCERPTS = 3  # passages listed per suggestion
_REREAD_SUGGESTIONS = 10


def _reread_suggestions(mistakes: list[Question]) -> list[RereadSuggestion]:
    """Group still-wrong questions (newest mistake first) by the part of the material they come from; the biggest
    trouble spots first."""
    groups: dict[str, list[Question]] = {}
    for question in mistakes:
        anchor = question.anchor_section.strip()
        if anchor:  # quizzes made before source anchors existed have none
            groups.setdefault(anchor, []).append(question)
    ranked = sorted(groups.items(), key=lambda item: (-len(item[1]), item[0]))
    return [
        RereadSuggestion(
            anchor_section=anchor,
            mistake_count=len(questions),
            excerpts=list(dict.fromkeys(q.source_excerpt.strip() for q in questions if q.source_excerpt.strip()))[
                :_REREAD_EXCERPTS
            ],
        )
        for anchor, questions in ranked[:_REREAD_SUGGESTIONS]
    ]


class QuizService:
    def __init__(
        self,
        quizzes: QuizRepository,
        answers: AnswerRepository,
        attempts: AttemptRepository,
        materials: MaterialRepository,
        courses: CourseService,
        sections: SectionService,
        generator: QuizGenerator,
        questions_per_quiz: int,
        mistake_review_limit: int,
        max_material_chars: int,
    ):
        self._quizzes = quizzes
        self._answers = answers
        self._attempts = attempts
        self._materials = materials
        self._courses = courses
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

        mistakes = [
            PastMistake(q.stem, q.options, q.answer_index, a.selected_index, q.explanation, q.anchor_section)
            for q, a in self._answers.still_wrong(self._mistake_review_limit, section_id=section.id)
        ]
        accuracy = [
            TypeAccuracy(kind, total, correct) for kind, total, correct in self._answers.stats_by_type(section_id=section.id)
        ]
        earlier_stems = [q.stem for quiz in self._quizzes.list_by_section(section.id) for q in quiz.questions][:_EARLIER_STEMS]
        generated = self._generator.generate(materials, mistakes, accuracy, self._questions_per_quiz, earlier_stems)

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

    def list_by_section(self, section_id: str) -> list[Quiz]:
        section = self._sections.get(section_id)
        return self._quizzes.list_by_section(section.id)

    def delete(self, quiz_id: str) -> None:
        self._quizzes.delete(self.get(quiz_id))

    def check(self, quiz_id: str, question_id: str, request: CheckRequest) -> AnswerResult:
        """Grade one answer on the spot (Trivia shows the answer after every question). Nothing is stored: the
        attempt is still recorded by `submit`, once, at the end."""
        quiz = self.get(quiz_id)
        question = next((q for q in quiz.questions if q.id == question_id), None)
        if question is None:
            raise QuestionNotFoundError(f"Question {question_id} not found in quiz {quiz_id}")
        if not 0 <= request.selected_index < len(question.options):
            raise InvalidSubmissionError(f"Option {request.selected_index} does not exist for question {question.id}")
        return self._result(question, request.selected_index)

    @staticmethod
    def _result(question: Question, selected_index: int) -> AnswerResult:
        return AnswerResult(
            question_id=question.id,
            selected_index=selected_index,
            is_correct=selected_index == question.answer_index,
            answer_index=question.answer_index,
            explanation=question.explanation,
            anchor_section=question.anchor_section,
            source_excerpt=question.source_excerpt,
        )

    def submit(self, quiz_id: str, request: SubmissionRequest) -> SubmissionResponse:
        """Grade by comparing with the answer Gemini wrote; nothing is stored unless every answer is valid."""
        quiz = self.get(quiz_id)
        questions = {question.id: question for question in quiz.questions}
        answers: list[Answer] = []
        results: list[AnswerResult] = []
        for item in request.answers:
            question = questions.get(item.question_id)
            if question is None:
                raise InvalidSubmissionError(f"Question {item.question_id} is not part of this quiz")
            if any(a.question_id == question.id for a in answers):
                raise InvalidSubmissionError(f"Question {question.id} was answered more than once")
            if not 0 <= item.selected_index < len(question.options):
                raise InvalidSubmissionError(f"Option {item.selected_index} does not exist for question {question.id}")
            result = self._result(question, item.selected_index)
            answers.append(Answer(question_id=question.id, selected_index=item.selected_index, is_correct=result.is_correct))
            results.append(result)
        score = sum(a.is_correct for a in answers)
        attempt = self._attempts.add(
            Attempt(
                quiz_id=quiz.id,
                time_spent_seconds=request.time_spent_seconds,
                score=score,
                total=len(questions),
                answers=answers,
            )
        )
        return SubmissionResponse(attempt_id=attempt.id, score=score, total=len(questions), results=results)

    def progress(self, course_id: str) -> ProgressResponse:
        course = self._courses.get(course_id)
        return self._progress(course_id=course.id)

    def section_progress(self, section_id: str) -> ProgressResponse:
        section = self._sections.get(section_id)
        return self._progress(section_id=section.id)

    def _progress(self, *, section_id: str | None = None, course_id: str | None = None) -> ProgressResponse:
        still_wrong = self._answers.still_wrong(_REREAD_SCAN_LIMIT, section_id=section_id, course_id=course_id)
        return ProgressResponse(
            by_type=[
                TypeStat(type=kind, total=total, correct=correct)
                for kind, total, correct in self._answers.stats_by_type(section_id=section_id, course_id=course_id)
            ],
            mistakes=[
                Mistake(
                    question_id=q.id,
                    quiz_id=q.quiz_id,
                    type=q.type,
                    stem=q.stem,
                    options=q.options,
                    answer_index=q.answer_index,
                    explanation=q.explanation,
                    selected_index=a.selected_index,
                    answered_at=a.answered_at,
                    anchor_section=q.anchor_section,
                    source_excerpt=q.source_excerpt,
                )
                for q, a in still_wrong[: self._mistake_review_limit]
            ],
            reread=_reread_suggestions([q for q, _ in still_wrong]),
        )
