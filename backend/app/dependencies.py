from collections.abc import Iterator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.container import Container
from app.repository import (
    AnswerRepository,
    AttemptRepository,
    CourseRepository,
    SectionRepository,
    MaterialRepository,
    QuizRepository,
)
from app.service import (
    CourseService,
    SectionService,
    HistoryService,
    MaterialService,
    PetChatService,
    QuizService,
)


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_session(container: Container = Depends(get_container)) -> Iterator[Session]:
    with container.session_factory() as session:
        yield session


def get_course_service(session: Session = Depends(get_session)) -> CourseService:
    return CourseService(CourseRepository(session))


def get_section_service(
    session: Session = Depends(get_session),
    courses: CourseService = Depends(get_course_service),
) -> SectionService:
    return SectionService(SectionRepository(session), courses)


def get_material_service(
    container: Container = Depends(get_container),
    session: Session = Depends(get_session),
    sections: SectionService = Depends(get_section_service),
) -> MaterialService:
    return MaterialService(
        MaterialRepository(session),
        sections,
        container.pdf_converter,
        container.settings.max_material_pdf_bytes,
    )


def get_quiz_service(
    container: Container = Depends(get_container),
    session: Session = Depends(get_session),
    courses: CourseService = Depends(get_course_service),
    sections: SectionService = Depends(get_section_service),
) -> QuizService:
    settings = container.settings
    return QuizService(
        QuizRepository(session),
        AnswerRepository(session),
        AttemptRepository(session),
        MaterialRepository(session),
        courses,
        sections,
        container.quiz_generator,
        settings.questions_per_quiz,
        settings.mistake_review_limit,
        settings.max_material_chars,
    )


def get_pet_chat_service(
    container: Container = Depends(get_container),
    session: Session = Depends(get_session),
) -> PetChatService:
    return PetChatService(
        QuizRepository(session),
        AnswerRepository(session),
        container.pet_tutor,
        container.settings.mistake_review_limit,
    )


def get_history_service(
    session: Session = Depends(get_session),
    courses: CourseService = Depends(get_course_service),
    sections: SectionService = Depends(get_section_service),
) -> HistoryService:
    return HistoryService(AttemptRepository(session), courses, sections)
