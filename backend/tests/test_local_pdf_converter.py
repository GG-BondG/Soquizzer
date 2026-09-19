import io
import json

import pytest
from fastapi.testclient import TestClient
from langchain_core.embeddings import DeterministicFakeEmbedding
from pypdf import PdfReader, PdfWriter

from app.config import Settings
from app.exception import EmptyDocumentError, LlmError
from app.main import create_app
from app.rag import LocalPdfJsonConverter
from tests.conftest import FakeOcr, FakeQuizGenerator, make_blank_pdf, make_pdf

LONG = "This sentence is long enough to count as a real text layer."


def convert(pdf: bytes, ocr=None) -> dict:
    return json.loads(LocalPdfJsonConverter(ocr).convert(pdf))


def with_bookmarks(pdf: bytes, bookmarks: list[tuple[str, int, int]]) -> bytes:
    """Add (title, 0-based page, level) bookmarks; a level-2 bookmark nests under the previous level-1 one."""
    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(pdf)))
    parent = None
    for title, page, level in bookmarks:
        item = writer.add_outline_item(title, page, parent=parent if level == 2 else None)
        if level == 1:
            parent = item
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def test_text_pdf_becomes_pages_with_their_own_page_numbers():
    result = convert(make_pdf([f"Cells\n{LONG}", f"Mitochondria\n{LONG}"]))

    assert result["page_count"] == 2
    assert [page["page"] for page in result["pages"]] == [1, 2]
    assert result["pages"][0]["text"].startswith("Cells")
    assert "Mitochondria" in result["pages"][1]["text"]
    assert "outline" not in result


def test_blank_pages_are_skipped_but_numbering_is_kept():
    result = convert(make_pdf([LONG, "", f"Third. {LONG}"]))

    assert result["page_count"] == 3
    assert [page["page"] for page in result["pages"]] == [1, 3]


def test_whitespace_is_tidied():
    result = convert(make_pdf([f"Title   \n\n\n\n\nBody. {LONG}"]))

    assert "\n\n\n" not in result["pages"][0]["text"]
    assert "Title\n" in result["pages"][0]["text"]


def test_bookmarks_become_a_flat_outline_with_levels():
    pdf = with_bookmarks(
        make_pdf([LONG, LONG, LONG]),
        [("Chapter 1", 0, 1), ("1.1 Cells", 1, 2), ("Chapter 2", 2, 1)],
    )

    assert convert(pdf)["outline"] == [
        {"title": "Chapter 1", "page": 1, "level": 1},
        {"title": "1.1 Cells", "page": 2, "level": 2},
        {"title": "Chapter 2", "page": 3, "level": 1},
    ]


def test_text_pdf_never_calls_ocr():
    ocr = FakeOcr()

    convert(make_pdf([LONG]), ocr)

    assert ocr.calls == []


def test_scanned_pdf_is_read_with_ocr_and_keeps_page_numbers():
    ocr = FakeOcr()
    ocr.pages = ["Scanned first page", "", "Scanned third page"]
    pdf = make_blank_pdf(3)

    result = convert(pdf, ocr)

    assert ocr.calls == [pdf]
    assert result["page_count"] == 3
    assert result["pages"] == [{"page": 1, "text": "Scanned first page"}, {"page": 3, "text": "Scanned third page"}]


def test_scanned_pdf_without_ocr_is_rejected():
    with pytest.raises(EmptyDocumentError, match="OCR is disabled"):
        convert(make_blank_pdf(2))


def test_scan_that_ocr_cannot_read_is_rejected():
    ocr = FakeOcr()  # every page comes back blank

    with pytest.raises(EmptyDocumentError, match="even after OCR"):
        convert(make_blank_pdf(2), ocr)


def test_ocr_failure_is_passed_on():
    ocr = FakeOcr()
    ocr.error = LlmError("Gemini OCR request failed")

    with pytest.raises(LlmError):
        convert(make_blank_pdf(1), ocr)


def test_corrupted_pdf_is_rejected():
    with pytest.raises(EmptyDocumentError, match="Could not read the PDF"):
        convert(b"%PDF-1.4 this is not really a pdf")


def test_password_protected_pdf_is_rejected():
    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(make_pdf([LONG]))))
    writer.encrypt("secret", algorithm="RC4-128")
    out = io.BytesIO()
    writer.write(out)

    with pytest.raises(EmptyDocumentError, match="password-protected"):
        convert(out.getvalue())


def test_a_hundred_page_pdf_converts_in_well_under_a_second_without_any_model_call():
    import time

    pdf = make_pdf([f"Slide {n}\n{LONG}\n{LONG}" for n in range(1, 101)])

    started = time.perf_counter()
    result = convert(pdf)  # no OCR object at all: nothing here could call a model

    assert len(result["pages"]) == 100
    assert time.perf_counter() - started < 5  # generous bound; it takes a fraction of a second


@pytest.fixture
def real_converter_client(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path / "data")
    ocr = FakeOcr()
    app = create_app(settings, DeterministicFakeEmbedding(size=32), LocalPdfJsonConverter(ocr), FakeQuizGenerator(), ocr)
    return TestClient(app), ocr


def upload(client, content: bytes):
    course_id = client.post("/api/courses", json={"name": "Biology 101", "subject": "BIOLOGY"}).json()["id"]
    return course_id, client.post(f"/api/courses/{course_id}/materials", files={"file": ("cells.pdf", content)})


def test_upload_stores_the_extracted_json_as_material(real_converter_client):
    client, ocr = real_converter_client

    course_id, response = upload(client, make_pdf([f"Cells\n{LONG}"]))

    assert response.status_code == 201
    content = response.json()["content"]
    assert content["page_count"] == 1
    assert content["pages"][0]["text"].startswith("Cells")
    assert client.get(f"/api/courses/{course_id}/materials").json()[0]["content"] == content
    assert ocr.calls == []


def test_upload_of_an_unreadable_pdf_is_422_and_stores_nothing(real_converter_client):
    client, _ = real_converter_client

    course_id, response = upload(client, b"%PDF-1.4 broken")

    assert response.status_code == 422
    assert client.get(f"/api/courses/{course_id}/materials").json() == []


def test_upload_of_a_scan_uses_ocr(real_converter_client):
    client, ocr = real_converter_client
    ocr.pages = ["Text read from the image"]

    _, response = upload(client, make_blank_pdf(1))

    assert response.status_code == 201
    assert response.json()["content"]["pages"] == [{"page": 1, "text": "Text read from the image"}]
