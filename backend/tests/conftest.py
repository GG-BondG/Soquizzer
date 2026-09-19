import io

import pytest
from fastapi.testclient import TestClient
from langchain_core.embeddings import DeterministicFakeEmbedding
from pypdf import PdfWriter

from app.config import Settings
from app.dto import QuizContent, QuizQuestion
from app.main import create_app


@pytest.fixture
def settings(tmp_path):
    return Settings(data_dir=tmp_path / "data", chunk_size=200, chunk_overlap=40, max_upload_bytes=20_000)


class FakeQuizGenerator:
    def __init__(self):
        self.calls: list[tuple[bytes, int]] = []
        self.error: Exception | None = None

    def generate(self, pdf: bytes, num_questions: int) -> QuizContent:
        self.calls.append((pdf, num_questions))
        if self.error:
            raise self.error
        questions = [
            QuizQuestion(question=f"Question {i}?", options=["a", "b", "c", "d"], answer_index=1, explanation="Because.")
            for i in range(1, num_questions + 1)
        ]
        return QuizContent(title="Cell biology quiz", questions=questions)


@pytest.fixture
def generator():
    return FakeQuizGenerator()


@pytest.fixture
def app(settings, generator):
    return create_app(settings, DeterministicFakeEmbedding(size=32), generator)


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def chunks(app):
    return app.state.container.chunks


def make_pdf(pages: list[str]) -> bytes:
    """Minimal text PDF: one page per string, Helvetica, xref table computed by hand."""
    objects: list[bytes] = []
    page_ids = [4 + 2 * i for i in range(len(pages))]
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode())
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for pid, text in zip(page_ids, pages):
        safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 12 Tf 50 700 Td ({safe}) Tj ET".encode()
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {pid + 1} 0 R >>".encode()
        )
        objects.append(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{number} 0 obj\n".encode() + body + b"\nendobj\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets:
        out.write(f"{offset:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return out.getvalue()


def make_blank_pdf() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
