from langchain_core.embeddings import Embeddings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.entity import Base
from app.llm import GeminiPdfJsonConverter, GeminiQuizGenerator, PdfJsonConverter, QuizGenerator
from app.rag import GeminiPageOcr, PageOcr, build_embeddings
from app.repository import ChunkRepository
from app.storage import LocalStorage


class Container:
    """Builds the long-lived dependencies once at startup."""

    def __init__(
        self,
        settings: Settings,
        embeddings: Embeddings | None = None,
        pdf_converter: PdfJsonConverter | None = None,
        quiz_generator: QuizGenerator | None = None,
        ocr: PageOcr | None = None,
    ):
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        self.settings = settings
        self.engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False)
        self.storage = LocalStorage(settings.upload_dir)
        self.chunks = ChunkRepository.create(
            settings.chroma_collection,
            settings.chroma_dir,
            embeddings or build_embeddings(settings),
        )
        self.pdf_converter = pdf_converter or GeminiPdfJsonConverter(settings)
        self.quiz_generator = quiz_generator or GeminiQuizGenerator(settings)
        self.ocr = ocr or (GeminiPageOcr(settings) if settings.ocr_enabled else None)
