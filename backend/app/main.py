from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.embeddings import Embeddings

from app.config import Settings
from app.container import Container
from app.controller import course_router, section_router, history_router, material_router, quiz_router, textbook_router
from app.exception import register_exception_handlers
from app.llm import PdfJsonConverter, QuizGenerator
from app.rag import PageOcr


def create_app(
    settings: Settings | None = None,
    embeddings: Embeddings | None = None,
    pdf_converter: PdfJsonConverter | None = None,
    quiz_generator: QuizGenerator | None = None,
    ocr: PageOcr | None = None,
) -> FastAPI:
    app = FastAPI(title="Soquizzer")
    container = Container(settings or Settings(), embeddings, pdf_converter, quiz_generator, ocr)
    app.state.container = container
    app.add_middleware(
        CORSMiddleware,
        allow_origins=container.settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(textbook_router)
    app.include_router(course_router)
    app.include_router(section_router)
    app.include_router(material_router)
    app.include_router(quiz_router)
    app.include_router(history_router)
    return app
