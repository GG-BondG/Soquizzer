import io
import json

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from app.config import Settings
from app.llm import GeneratedQuestion, GeneratedQuiz
from app.main import create_app


@pytest.fixture
def settings(tmp_path):
    return Settings(
        _env_file=None,
        data_dir=tmp_path / "data",
        questions_per_quiz=4,
    )


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


class FakeQuizGenerator:
    """Odd questions are multiple choice (answer index 1), even ones true/false (answer index 0)."""

    def __init__(self):
        self.calls: list[dict] = []
        self.error: Exception | None = None

    def generate(self, materials, mistakes, accuracy, num_questions, earlier_stems=None):
        self.calls.append(
            {
                "materials": materials,
                "mistakes": mistakes,
                "accuracy": accuracy,
                "num_questions": num_questions,
                "earlier_stems": earlier_stems or [],
            }
        )
        if self.error:
            raise self.error
        round_number = len(self.calls)
        questions = []
        for number in range(1, num_questions + 1):
            if number % 2:
                kind, options, answer = "MULTIPLE_CHOICE", ["a", "b", "c", "d"], 1
            else:
                kind, options, answer = "TRUE_FALSE", ["True", "False"], 0
            questions.append(
                GeneratedQuestion(
                    type=kind,
                    stem=f"Round {round_number} question {number}?",
                    options=options,
                    answer_index=answer,
                    explanation=f"Because {number}.",
                    anchor_section=f"Section {(number + 1) // 2}",
                    source_excerpt=f"Passage for question {number}.",
                )
            )
        return GeneratedQuiz(questions=questions)


@pytest.fixture
def quiz_generator():
    return FakeQuizGenerator()


class FakeOcr:
    """Returns the text set in `pages` (one string per page); by default every page is blank."""

    def __init__(self):
        self.calls: list[bytes] = []
        self.pages: list[str] | None = None
        self.error: Exception | None = None

    def transcribe(self, pdf: bytes) -> list[str]:
        self.calls.append(pdf)
        if self.error:
            raise self.error
        return self.pages if self.pages is not None else [""]


@pytest.fixture
def ocr():
    return FakeOcr()


class FakePetTutor:
    """Echoes back the inputs it was given so tests can assert on the context the service assembled."""

    def __init__(self):
        self.calls: list[dict] = []
        self.error: Exception | None = None
        self.reply_text = "Think about it this way..."

    def reply(self, question, own_attempts, mistakes, accuracy, history, message):
        self.calls.append(
            {
                "question": question,
                "own_attempts": own_attempts,
                "mistakes": mistakes,
                "accuracy": accuracy,
                "history": history,
                "message": message,
            }
        )
        if self.error:
            raise self.error
        return self.reply_text


@pytest.fixture
def pet_tutor():
    return FakePetTutor()


@pytest.fixture
def app(settings, converter, quiz_generator, ocr, pet_tutor):
    return create_app(settings, converter, quiz_generator, ocr, pet_tutor)


@pytest.fixture
def client(app):
    return TestClient(app)



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


def make_blank_pdf(pages: int = 1) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=612, height=792)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
