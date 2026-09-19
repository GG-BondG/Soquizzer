from fastapi import FastAPI
from langchain_core.embeddings import Embeddings

from app.config import Settings
from app.container import Container
from app.controller import textbook_router
from app.exception import register_exception_handlers


def create_app(settings: Settings | None = None, embeddings: Embeddings | None = None) -> FastAPI:
    app = FastAPI(title="Soquizzer")
    app.state.container = Container(settings or Settings(), embeddings)
    register_exception_handlers(app)
    app.include_router(textbook_router)
    return app
