import io
from types import SimpleNamespace

import pytest
from pypdf import PdfReader

from app.config import Settings
from app.exception import ConfigurationError, EmptyDocumentError, LlmError
from app.rag import GeminiPageOcr
from app.rag.ocr import OcrPages
from tests.conftest import make_blank_pdf, make_pdf


class StubClient:
    """Answers every request with the next item of `answers` (a list of page texts, or an exception)."""

    def __init__(self, *answers):
        self.models = self
        self.answers = list(answers)
        self.requests: list[dict] = []

    def generate_content(self, **kwargs):
        self.requests.append(kwargs)
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return SimpleNamespace(parsed=OcrPages(pages=answer) if answer is not None else None)

    def pages_sent(self, index: int) -> int:
        part = self.requests[index]["contents"][0]
        return len(PdfReader(io.BytesIO(part.inline_data.data)).pages)


def ocr(client, **overrides):
    overrides.setdefault("ocr_pages_per_request", 2)
    return GeminiPageOcr(Settings(_env_file=None, **overrides), client=client)


def test_pages_are_sent_in_batches_and_come_back_in_order():
    client = StubClient(["p1", "p2"], ["p3", "p4"], ["p5"])

    assert ocr(client).transcribe(make_blank_pdf(5)) == ["p1", "p2", "p3", "p4", "p5"]
    assert [client.pages_sent(i) for i in range(3)] == [2, 2, 1]
    assert "exactly 2 strings" in client.requests[0]["contents"][1]
    assert client.requests[0]["config"].response_mime_type == "application/json"


def test_a_batch_with_the_wrong_number_of_pages_keeps_the_text_on_its_first_page():
    client = StubClient(["only one string for two pages"])

    assert ocr(client).transcribe(make_blank_pdf(2)) == ["only one string for two pages", ""]


def test_a_batch_that_is_too_large_is_split_in_half():
    pdf = make_blank_pdf(4)
    # Between the size of a 2-page request and a 4-page one, so the first attempt must be split.
    limit = (len(make_blank_pdf(2)) + len(pdf)) // 2
    client = StubClient(["a", "b"], ["c", "d"])

    result = ocr(client, ocr_pages_per_request=4, max_material_pdf_bytes=limit).transcribe(pdf)

    assert result == ["a", "b", "c", "d"]
    assert [client.pages_sent(i) for i in range(2)] == [2, 2]  # the 4-page request was never sent


def test_a_single_page_over_the_limit_fails():
    with pytest.raises(LlmError, match="too large"):
        ocr(StubClient(), max_material_pdf_bytes=10).transcribe(make_blank_pdf(1))


def test_too_many_pages_is_refused_before_calling_gemini():
    client = StubClient()

    with pytest.raises(EmptyDocumentError, match="limited to 3"):
        ocr(client, ocr_max_pages=3).transcribe(make_blank_pdf(4))
    assert client.requests == []


def test_gemini_errors_and_empty_answers_become_llm_errors():
    with pytest.raises(LlmError, match="OCR request failed: boom"):
        ocr(StubClient(RuntimeError("boom"))).transcribe(make_blank_pdf(1))
    with pytest.raises(LlmError, match="valid OCR text"):
        ocr(StubClient(None)).transcribe(make_blank_pdf(1))


def test_missing_api_key_is_a_configuration_error():
    with pytest.raises(ConfigurationError):
        GeminiPageOcr(Settings(_env_file=None, gemini_api_key=""))
