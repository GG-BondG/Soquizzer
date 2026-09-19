"""Integration tests with a real SQLite database file and the real FastAPI app.

    pytest -m integration -s                      # -s shows the JSON Gemini produced
    QUIZ_PDF_PATH=~/my_quiz.pdf pytest -m integration -s

The Gemini test needs GEMINI_API_KEY (environment or backend/.env) and is skipped without it.
QUIZ_PDF_PATH points it at your own PDF instead of the generated sample.
"""

import json
import os
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from langchain_core.embeddings import DeterministicFakeEmbedding

from app.config import Settings
from app.main import create_app
from tests.conftest import FakePdfConverter, make_pdf

pytestmark = pytest.mark.integration

SAMPLE_QUIZ = (
    "Biology Quiz\n"
    "1. What is the powerhouse of the cell?\n"
    "A. Nucleus   B. Mitochondria   C. Ribosome   D. Golgi apparatus\n"
    "Answer: B\n"
    "2. Which molecule carries genetic information?\n"
    "A. ATP   B. DNA   C. Lipid   D. Glucose\n"
    "Answer: B"
)


def read_rows(db_file: Path, sql: str, *params) -> list[tuple]:
    connection = sqlite3.connect(db_file)
    try:
        return connection.execute(sql, params).fetchall()
    finally:
        connection.close()


def create_course_and_upload(client: TestClient, pdf: bytes, filename: str):
    course = client.post("/api/courses", json={"name": "Biology 101", "subject": "BIOLOGY"}).json()
    response = client.post(f"/api/courses/{course['id']}/quizzes", files={"file": (filename, pdf)})
    return course, response


def test_database_is_created_and_pdf_json_is_persisted(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path / "data")
    db_file = settings.data_dir / "soquizzer.db"
    assert not db_file.exists()

    client = TestClient(create_app(settings, DeterministicFakeEmbedding(size=32), FakePdfConverter()))

    tables = {row[0] for row in read_rows(db_file, "select name from sqlite_master where type = 'table'")}
    assert {"courses", "quizzes", "textbooks"} <= tables

    course, response = create_course_and_upload(client, make_pdf([SAMPLE_QUIZ]), "quiz.pdf")

    assert response.status_code == 201
    assert read_rows(db_file, "select name, subject from courses") == [("Biology 101", "BIOLOGY")]
    rows = read_rows(db_file, "select course_id, source_filename, content from quizzes")
    assert [(r[0], r[1]) for r in rows] == [(course["id"], "quiz.pdf")]
    assert json.loads(rows[0][2]) == FakePdfConverter.RESULT


def test_quiz_is_still_there_after_the_app_is_restarted(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path / "data")
    embeddings = DeterministicFakeEmbedding(size=32)

    first = TestClient(create_app(settings, embeddings, FakePdfConverter()))
    _, response = create_course_and_upload(first, make_pdf([SAMPLE_QUIZ]), "quiz.pdf")
    quiz = response.json()

    second = TestClient(create_app(settings, embeddings, FakePdfConverter()))
    assert second.get(f"/api/quizzes/{quiz['id']}").json() == quiz


@pytest.mark.skipif(not Settings().google_api_key, reason="GEMINI_API_KEY is not set")
def test_real_gemini_turns_pdf_into_json_and_stores_it(tmp_path):
    custom_pdf = os.environ.get("QUIZ_PDF_PATH")
    pdf = Path(custom_pdf).expanduser().read_bytes() if custom_pdf else make_pdf([SAMPLE_QUIZ])
    filename = Path(custom_pdf).name if custom_pdf else "quiz.pdf"

    settings = Settings(data_dir=tmp_path / "data")
    db_file = settings.data_dir / "soquizzer.db"
    client = TestClient(create_app(settings, embeddings=DeterministicFakeEmbedding(size=32)))

    _, response = create_course_and_upload(client, pdf, filename)

    assert response.status_code == 201, response.text
    content = response.json()["content"]
    print(f"\nDatabase: {db_file}\nGemini produced:\n{json.dumps(content, ensure_ascii=False, indent=2)}")
    assert isinstance(content, (dict, list)) and content

    (stored,) = read_rows(db_file, "select content from quizzes")[0]
    assert json.loads(stored) == content
    if not custom_pdf:
        assert "Mitochondria" in stored
