from typing import TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import Settings
from app.exception import ConfigurationError, LlmError

T = TypeVar("T", bound=BaseModel)


class GeminiGateway:
    """The one place that talks to the Google GenAI SDK: it builds the client, sends the request and turns every
    failure into an `LlmError`. The adapters (quiz writer, pet tutor, OCR) only decide what to ask.

    The SDK client is created on the first request, so building an adapter needs no API key. Whether a missing key
    stops the app is the container's decision (it does, at startup)."""

    def __init__(self, settings: Settings, client: genai.Client | None = None):
        self._settings = settings
        self._client = client
        self._model = settings.generation_model

    def _get_client(self) -> genai.Client:
        if self._client is None:
            if not self._settings.google_api_key:
                raise ConfigurationError("GEMINI_API_KEY is not set")
            self._client = genai.Client(
                api_key=self._settings.google_api_key,
                http_options=types.HttpOptions(timeout=self._settings.generation_timeout_seconds * 1000),
            )
        return self._client

    def _generate(self, contents, config: types.GenerateContentConfig | None, task: str):
        client = self._get_client()
        try:
            if config is None:
                return client.models.generate_content(model=self._model, contents=contents)
            return client.models.generate_content(model=self._model, contents=contents, config=config)
        except Exception as exc:
            raise LlmError(f"Gemini {task + ' ' if task else ''}request failed: {str(exc)[:300]}") from exc

    def generate_text(self, prompt: str) -> str:
        """A plain text reply (a chat, not structured data). May be empty; the caller decides if that is an error."""
        return (self._generate(prompt, None, "").text or "").strip()

    def generate_structured(
        self,
        prompt: str,
        schema: type[T],
        *,
        pdf: bytes | None = None,
        task: str = "",
        expected: str = "a valid response",
    ) -> T:
        """Ask for JSON shaped like `schema` and return it parsed. `pdf` is sent along with the prompt. `task` and
        `expected` only word the `LlmError` messages ("Gemini OCR request failed", "did not return valid OCR text")."""
        contents = [types.Part.from_bytes(data=pdf, mime_type="application/pdf"), prompt] if pdf is not None else prompt
        config = types.GenerateContentConfig(response_mime_type="application/json", response_schema=schema)
        parsed = self._generate(contents, config, task).parsed
        if not isinstance(parsed, schema):
            raise LlmError(f"Gemini did not return {expected}")
        return parsed
