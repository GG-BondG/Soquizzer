from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    # Same variable names as gemini-service/ (GEMINI_*); the older GOOGLE_API_KEY / GENERATION_MODEL still work.
    google_api_key: str = Field("", validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY"))
    embedding_model: str = "models/gemini-embedding-001"
    data_dir: Path = Path("data")
    max_upload_bytes: int = 50 * 1024 * 1024
    chunk_size: int = 1000
    chunk_overlap: int = 200
    chroma_collection: str = "textbooks"
    generation_model: str = Field("gemini-2.5-flash", validation_alias=AliasChoices("GEMINI_MODEL", "GENERATION_MODEL"))
    generation_timeout_seconds: int = 120
    max_material_pdf_bytes: int = 20 * 1024 * 1024  # Gemini inline PDF limit
    ocr_enabled: bool = True  # scanned textbook PDFs (no text layer) are read by Gemini instead of failing
    ocr_pages_per_request: int = 10
    ocr_max_pages: int = 300
    max_material_chars: int = 400_000  # all of a course's material JSON goes into one quiz prompt
    mistake_review_limit: int = 20
    questions_per_quiz: int = 20
    quiz_language: str = "English"  # the language Gemini writes quizzes in, whatever language the material is in
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "null"]  # Vite dev server, Electron file://

    @property
    def upload_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def chroma_dir(self) -> Path:
        return self.data_dir / "chroma"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.data_dir / 'soquizzer.db'}"
