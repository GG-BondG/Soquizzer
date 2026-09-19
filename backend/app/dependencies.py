from collections.abc import Iterator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.container import Container
from app.repository import TextbookRepository
from app.service import IngestionService, TextbookService


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
