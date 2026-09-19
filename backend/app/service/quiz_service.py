from app.dto import AnswerResult, Mistake, ProgressResponse, SubmissionRequest, SubmissionResponse, TypeStat
from app.entity import Answer, Attempt, Question, Quiz
from app.exception import FileTooLargeError, InvalidSubmissionError, NoMaterialError, QuizNotFoundError
from app.llm import PastMistake, QuizGenerator, TypeAccuracy
from app.repository import AnswerRepository, AttemptRepository, MaterialRepository, QuizRepository
from app.service.course_service import CourseService
from app.service.group_service import GroupService


class QuizService:
    def __init__(
        self,
        quizzes: QuizRepository,
        answers: AnswerRepository,
        attempts: AttemptRepository,
        materials: MaterialRepository,
        courses: CourseService,
        groups: GroupService,
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
        self._groups = groups
        self._generator = generator
        self._questions_per_quiz = questions_per_quiz
        self._mistake_review_limit = mistake_review_limit
        self._max_material_chars = max_material_chars

    def generate(self, group_id: str) -> Quiz:
        """Add a new round to the group. Callers only get questions back; whether earlier rounds shaped them is
        this method's business: the mistakes still open in this group are re-read and handed to Gemini."""
        group = self._groups.get(group_id)
        materials = [(m.source_filename, m.content) for m in self._materials.list_by_course(group.course_id)]
        if not materials:
            raise NoMaterialError("Upload course material before generating a quiz")
        if sum(len(content) for _, content in materials) > self._max_material_chars:
            raise FileTooLargeError("The course material is too large to fit in one quiz prompt")

        mistakes = [
            PastMistake(q.stem, q.options, q.answer_index, a.selected_index, q.explanation)
            for q, a in self._answers.still_wrong(self._mistake_review_limit, group_id=group.id)
        ]
        accuracy = [
            TypeAccuracy(kind, total, correct) for kind, total, correct in self._answers.stats_by_type(group_id=group.id)
        ]
        generated = self._generator.generate(materials, mistakes, accuracy, self._questions_per_quiz)

        questions = [
            Question(
                position=position,
                type=item.type,
                stem=item.stem,
                options=item.options,
                answer_index=item.answer_index,
                explanation=item.explanation,
            )
            for position, item in enumerate(generated.questions, start=1)
        ]
        return self._quizzes.add(Quiz(group_id=group.id, questions=questions))

    def get(self, quiz_id: str) -> Quiz:
        quiz = self._quizzes.get(quiz_id)
        if quiz is None:
            raise QuizNotFoundError(f"Quiz {quiz_id} not found")
        return quiz

    def list_by_group(self, group_id: str) -> list[Quiz]:
        group = self._groups.get(group_id)
        return self._quizzes.list_by_group(group.id)

    def delete(self, quiz_id: str) -> None:
        self._quizzes.delete(self.get(quiz_id))

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
            is_correct = item.selected_index == question.answer_index
            answers.append(Answer(question_id=question.id, selected_index=item.selected_index, is_correct=is_correct))
            results.append(
                AnswerResult(
                    question_id=question.id,
                    selected_index=item.selected_index,
                    is_correct=is_correct,
                    answer_index=question.answer_index,
                    explanation=question.explanation,
                )
            )
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
        return ProgressResponse(
            by_type=[
                TypeStat(type=kind, total=total, correct=correct)
                for kind, total, correct in self._answers.stats_by_type(course_id=course.id)
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
                )
                for q, a in self._answers.still_wrong(self._mistake_review_limit, course_id=course.id)
            ],
        )
