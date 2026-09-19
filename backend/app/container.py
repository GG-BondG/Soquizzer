from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.entity import Base, add_missing_columns
from app.llm import GeminiQuizGenerator, PdfJsonConverter, QuizGenerator
from app.rag import GeminiPageOcr, LocalPdfJsonConverter, PageOcr


class Container:
    """Builds the long-lived dependencies once at startup."""

    def __init__(
        self,
        settings: Settings,
        pdf_converter: PdfJsonConverter | None = None,
        quiz_generator: QuizGenerator | None = None,
        ocr: PageOcr | None = None,
    ):
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        self.settings = settings
        self.engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
        Base.metadata.create_all(self.engine)
        add_missing_columns(self.engine)
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False)
        self.ocr = ocr or (GeminiPageOcr(settings) if settings.ocr_enabled else None)
        self.pdf_converter = pdf_converter or LocalPdfJsonConverter(self.ocr)
        self.quiz_generator = quiz_generator or GeminiQuizGenerator(settings)
