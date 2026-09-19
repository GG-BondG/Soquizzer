from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    google_api_key: str = ""
    embedding_model: str = "models/gemini-embedding-001"
    data_dir: Path = Path("data")
    max_upload_bytes: int = 50 * 1024 * 1024
    chunk_size: int = 1000
    chunk_overlap: int = 200
    chroma_collection: str = "textbooks"
    generation_model: str = "gemini-2.5-flash"
    generation_timeout_seconds: int = 120
    max_quiz_pdf_bytes: int = 20 * 1024 * 1024  # Gemini inline PDF limit

    @property
    def upload_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def chroma_dir(self) -> Path:
        return self.data_dir / "chroma"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.data_dir / 'soquizzer.db'}"
