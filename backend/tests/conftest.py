import io
import json

import pytest
from fastapi.testclient import TestClient
from langchain_core.embeddings import DeterministicFakeEmbedding
from pypdf import PdfWriter

from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings(tmp_path):
    return Settings(data_dir=tmp_path / "data", chunk_size=200, chunk_overlap=40, max_upload_bytes=20_000)


class FakePdfConverter:
    RESULT = {"title": "Cell biology quiz", "questions": [{"question": "What is the powerhouse of the cell?", "answer": "Mitochondria"}]}

    def __init__(self):
        self.calls: list[bytes] = []
        self.error: Exception | None = None

    def convert(self, pdf: bytes) -> str:
        self.calls.append(pdf)
        if self.error:
            raise self.error
        return json.dumps(self.RESULT)


@pytest.fixture
def converter():
    return FakePdfConverter()


@pytest.fixture
def app(settings, converter):
    return create_app(settings, DeterministicFakeEmbedding(size=32), converter)


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def chunks(app):
    return app.state.container.chunks


def make_pdf(pages: list[str]) -> bytes:
    """Minimal text PDF: one page per string (newlines start a new line), Helvetica, hand-built xref table."""
    objects: list[bytes] = []
    page_ids = [4 + 2 * i for i in range(len(pages))]
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode())
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for pid, text in zip(page_ids, pages):
        lines = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in text.split("\n")]
        shown = " T* ".join(f"({line}) Tj" for line in lines)
        stream = f"BT /F1 12 Tf 16 TL 50 700 Td {shown} ET".encode()
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
