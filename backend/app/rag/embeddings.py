from langchain_core.embeddings import Embeddings

from app.config import Settings
from app.exception import ConfigurationError


def build_embeddings(settings: Settings) -> Embeddings:
    if not settings.google_api_key:
        raise ConfigurationError("GEMINI_API_KEY is not set")
    from langchain_google_genai import GoogleGenerativeAIEmbeddings

    return GoogleGenerativeAIEmbeddings(
        model=settings.embedding_model,
        google_api_key=settings.google_api_key,
    )
