from collections.abc import Iterator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.container import Container
from app.repository import (
    AnswerRepository,
    AttemptRepository,
    CourseRepository,
    CourseTextbookRepository,
    SectionRepository,
    MaterialRepository,
    QuizRepository,
    TextbookRepository,
)
from app.service import (
    CourseService,
    CourseTextbookService,
    SectionService,
    HistoryService,
    IngestionService,
    MaterialService,
    QuizService,
    TextbookContextService,
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
        container.ocr,
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


def get_course_textbook_service(session: Session = Depends(get_session)) -> CourseTextbookService:
    return CourseTextbookService(
        CourseTextbookRepository(session), TextbookRepository(session), CourseService(CourseRepository(session))
    )


def get_section_service(session: Session = Depends(get_session)) -> SectionService:
    return SectionService(SectionRepository(session), CourseService(CourseRepository(session)))


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
        SectionService(SectionRepository(session), courses),
        TextbookContextService(
            CourseTextbookRepository(session), container.chunks, settings.rag_top_k, settings.max_textbook_chars
        ),
        container.quiz_generator,
        settings.questions_per_quiz,
        settings.mistake_review_limit,
        settings.max_material_chars,
    )


def get_history_service(session: Session = Depends(get_session)) -> HistoryService:
    courses = CourseService(CourseRepository(session))
    return HistoryService(AttemptRepository(session), courses, SectionService(SectionRepository(session), courses))
