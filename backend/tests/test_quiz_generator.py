from types import SimpleNamespace

import pytest

from app.config import Settings
from app.dto import QuizContent, QuizQuestion
from app.exception import ConfigurationError, QuizGenerationError
from app.llm import GeminiQuizGenerator


class StubClient:
    def __init__(self, parsed=None, error=None):
        self.models = self
        self.parsed = parsed
        self.error = error
        self.kwargs = None

    def generate_content(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return SimpleNamespace(parsed=self.parsed)


def quiz(answer_index=1, options=("a", "b", "c", "d")):
    question = QuizQuestion(question="Q?", options=list(options), answer_index=answer_index, explanation="E.")
    return QuizContent(title="T", questions=[question])


def generator(client):
    return GeminiQuizGenerator(Settings(_env_file=None, generation_model="test-model"), client=client)


def test_sends_pdf_and_json_schema_to_gemini():
    client = StubClient(parsed=quiz())

    result = generator(client).generate(b"%PDF-1.4 data", 5)

    assert result == quiz()
    assert client.kwargs["model"] == "test-model"
    pdf_part, prompt = client.kwargs["contents"]
    assert pdf_part.inline_data.mime_type == "application/pdf"
    assert pdf_part.inline_data.data == b"%PDF-1.4 data"
    assert "exactly 5 multiple-choice questions" in prompt
    assert client.kwargs["config"].response_schema is QuizContent
    assert client.kwargs["config"].response_mime_type == "application/json"


@pytest.mark.parametrize(
    "client",
    [
        StubClient(parsed=None),
        StubClient(parsed=QuizContent(title="T", questions=[])),
        StubClient(parsed=quiz(answer_index=4)),
        StubClient(parsed=quiz(answer_index=-1)),
        StubClient(parsed=quiz(options=("only one",), answer_index=0)),
        StubClient(error=RuntimeError("503 overloaded")),
    ],
)
def test_bad_model_output_or_api_error_raises_generation_error(client):
    with pytest.raises(QuizGenerationError):
        generator(client).generate(b"%PDF-", 1)


def test_missing_api_key_is_a_configuration_error():
    with pytest.raises(ConfigurationError):
        GeminiQuizGenerator(Settings(_env_file=None, google_api_key=""))
