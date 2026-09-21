from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.entity import Base, add_missing_columns
from app.exception import ConfigurationError
from app.gemini_gateway import GeminiGateway
from app.llm import GeminiPetTutor, GeminiQuizGenerator
from app.ports import PageOcr, PdfJsonConverter, PetTutor, QuizGenerator
from app.rag import GeminiPageOcr, LocalPdfJsonConverter


class Container:
    """Builds the long-lived dependencies once at startup."""

    def __init__(
        self,
        settings: Settings,
        pdf_converter: PdfJsonConverter | None = None,
        quiz_generator: QuizGenerator | None = None,
        ocr: PageOcr | None = None,
        pet_tutor: PetTutor | None = None,
    ):
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        self.settings = settings
        self.engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
        Base.metadata.create_all(self.engine)
        add_missing_columns(self.engine)
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False)
        uses_gemini = quiz_generator is None or pet_tutor is None or (ocr is None and settings.ocr_enabled)
        if uses_gemini and not settings.google_api_key:
            raise ConfigurationError("GEMINI_API_KEY is not set")  # fail at startup, not on the first quiz
        self.gemini = GeminiGateway(settings)  # shared by every Gemini-backed adapter below
        self.ocr = ocr or (GeminiPageOcr(settings, self.gemini) if settings.ocr_enabled else None)
        self.pdf_converter = pdf_converter or LocalPdfJsonConverter(self.ocr)
        self.quiz_generator = quiz_generator or GeminiQuizGenerator(settings, self.gemini)
        self.pet_tutor = pet_tutor or GeminiPetTutor(settings, self.gemini)
