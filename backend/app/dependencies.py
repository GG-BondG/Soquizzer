from collections.abc import Iterator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.container import Container
from app.repository import (
    AnswerRepository,
    AttemptRepository,
    CourseRepository,
    GroupRepository,
    MaterialRepository,
    QuizRepository,
    TextbookRepository,
)
from app.service import (
    CourseService,
    GroupService,
    HistoryService,
    IngestionService,
    MaterialService,
    QuizService,
    TextbookService,
)


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_session(container: Container = Depends(get_container)) -> Iterator[Session]:
    with container.session_factory() as session:
        yield session


def get_textbook_service(
    container: Container = Depends(get_container),
    session: Session = Depends(get_session),
) -> TextbookService:
    return TextbookService(
        TextbookRepository(session),
        container.chunks,
        container.storage,
        container.settings.max_upload_bytes,
    )


def get_ingestion_service(container: Container = Depends(get_container)) -> IngestionService:
    return IngestionService(
        container.session_factory,
        container.chunks,
        container.storage,
        container.settings,
    )


def get_course_service(session: Session = Depends(get_session)) -> CourseService:
    return CourseService(CourseRepository(session))


def get_material_service(
    container: Container = Depends(get_container),
    session: Session = Depends(get_session),
) -> MaterialService:
    return MaterialService(
        MaterialRepository(session),
        CourseService(CourseRepository(session)),
        container.pdf_converter,
        container.settings.max_material_pdf_bytes,
    )


def get_group_service(session: Session = Depends(get_session)) -> GroupService:
    return GroupService(GroupRepository(session), CourseService(CourseRepository(session)))


def get_quiz_service(
    container: Container = Depends(get_container),
    session: Session = Depends(get_session),
) -> QuizService:
    courses = CourseService(CourseRepository(session))
    settings = container.settings
    return QuizService(
        QuizRepository(session),
        AnswerRepository(session),
        AttemptRepository(session),
        MaterialRepository(session),
        courses,
        GroupService(GroupRepository(session), courses),
        container.quiz_generator,
        settings.questions_per_quiz,
        settings.mistake_review_limit,
        settings.max_material_chars,
    )


def get_history_service(session: Session = Depends(get_session)) -> HistoryService:
    courses = CourseService(CourseRepository(session))
    return HistoryService(AttemptRepository(session), courses, GroupService(GroupRepository(session), courses))
