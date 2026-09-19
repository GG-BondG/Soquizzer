import json
from types import SimpleNamespace

import pytest

from app.config import Settings
from app.exception import ConfigurationError, LlmError
from app.llm import GeminiPdfJsonConverter


class StubClient:
    def __init__(self, text=None, error=None):
        self.models = self
        self.text = text
        self.error = error
        self.kwargs = None

    def generate_content(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return SimpleNamespace(text=self.text)


def converter(client):
    return GeminiPdfJsonConverter(Settings(_env_file=None, generation_model="test-model"), client=client)


def test_sends_pdf_to_gemini_and_asks_for_free_form_json():
    client = StubClient(text='{"title": "光合作用", "sections": []}')

    result = converter(client).convert(b"%PDF-1.4 data")

    assert json.loads(result) == {"title": "光合作用", "sections": []}
    assert "光合作用" in result  # non-ASCII is kept readable
    assert client.kwargs["model"] == "test-model"
    pdf_part, prompt = client.kwargs["contents"]
    assert pdf_part.inline_data.mime_type == "application/pdf"
    assert pdf_part.inline_data.data == b"%PDF-1.4 data"
    assert "structure yourself" in prompt
    config = client.kwargs["config"]
    assert config.response_mime_type == "application/json"
    assert config.response_schema is None


@pytest.mark.parametrize(
    "client",
    [
        StubClient(text=None),
        StubClient(text=""),
        StubClient(text='{"title": "cut off'),
        StubClient(text="{}"),
        StubClient(text="[]"),
        StubClient(text="42"),
        StubClient(error=RuntimeError("503 overloaded")),
    ],
)
def test_bad_model_output_or_api_error_raises_conversion_error(client):
    with pytest.raises(LlmError):
        converter(client).convert(b"%PDF-")


def test_missing_api_key_is_a_configuration_error():
    with pytest.raises(ConfigurationError):
        GeminiPdfJsonConverter(Settings(_env_file=None, google_api_key=""))
