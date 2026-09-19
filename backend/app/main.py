from fastapi import FastAPI
from langchain_core.embeddings import Embeddings

from app.config import Settings
from app.container import Container
from app.controller import course_router, quiz_router, textbook_router
from app.exception import register_exception_handlers
from app.llm import PdfJsonConverter


def create_app(
    settings: Settings | None = None,
    embeddings: Embeddings | None = None,
    pdf_converter: PdfJsonConverter | None = None,
) -> FastAPI:
    app = FastAPI(title="Soquizzer")
    app.state.container = Container(settings or Settings(), embeddings, pdf_converter)
    register_exception_handlers(app)
    app.include_router(textbook_router)
    app.include_router(course_router)
    app.include_router(quiz_router)
    return app
