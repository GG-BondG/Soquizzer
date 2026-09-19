"""Integration tests with a real SQLite database file and the real FastAPI app.

    pytest -m integration -s                      # -s shows what Gemini produced
    QUIZ_PDF_PATH=~/my_slides.pdf pytest -m integration -s

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
from tests.conftest import FakeOcr, FakePdfConverter, FakeQuizGenerator, make_pdf

pytestmark = pytest.mark.integration

SAMPLE_SLIDES = (
    "Cell Biology - Lecture 3\n"
    "Mitochondria are the powerhouse of the cell: they make ATP by cellular respiration.\n"
    "The nucleus stores DNA, which carries genetic information.\n"
    "Ribosomes build proteins. The Golgi apparatus packages and ships them."
)


def read_rows(db_file: Path, sql: str, *params) -> list[tuple]:
    connection = sqlite3.connect(db_file)
    try:
        return connection.execute(sql, params).fetchall()
    finally:
        connection.close()


def fake_app(settings):
    return create_app(settings, DeterministicFakeEmbedding(size=32), FakePdfConverter(), FakeQuizGenerator(), FakeOcr())


def make_section(client: TestClient, course: dict) -> dict:
    return client.post(f"/api/courses/{course['id']}/sections", json={"name": "Chapter 1"}).json()


def upload_material(client: TestClient, pdf: bytes, filename: str):
    course = client.post("/api/courses", json={"name": "Biology 101", "subject": "BIOLOGY"}).json()
    response = client.post(f"/api/courses/{course['id']}/materials", files={"file": (filename, pdf)})
    return course, response


def answer_everything_wrong(client: TestClient, quiz: dict):
    """Answer option 0 everywhere (the API hides the answers); whatever turns out wrong becomes a mistake."""
    first = {
        "answers": [{"question_id": q["id"], "selected_index": 0} for q in quiz["questions"]],
        "time_spent_seconds": 42,
    }
    graded = client.post(f"/api/quizzes/{quiz['id']}/submissions", json=first).json()
    wrong_now = {r["question_id"] for r in graded["results"] if not r["is_correct"]}
    return graded, wrong_now


def test_database_is_created_and_pdf_json_is_stored_as_material(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path / "data")
    db_file = settings.data_dir / "soquizzer.db"
    assert not db_file.exists()

    client = TestClient(fake_app(settings))

    tables = {row[0] for row in read_rows(db_file, "select name from sqlite_master where type = 'table'")}
    assert {"courses", "materials", "sections", "quizzes", "questions", "attempts", "answers", "textbooks"} <= tables

    course, response = upload_material(client, make_pdf([SAMPLE_SLIDES]), "slides.pdf")

    assert response.status_code == 201
    assert read_rows(db_file, "select name, subject from courses") == [("Biology 101", "BIOLOGY")]
    rows = read_rows(db_file, "select course_id, source_filename, content from materials")
    assert [(r[0], r[1]) for r in rows] == [(course["id"], "slides.pdf")]
    assert json.loads(rows[0][2]) == FakePdfConverter.RESULT


def test_quiz_questions_answers_and_mistakes_are_stored_in_the_tables(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path / "data")
    db_file = settings.data_dir / "soquizzer.db"
    client = TestClient(fake_app(settings))
    course, _ = upload_material(client, make_pdf([SAMPLE_SLIDES]), "slides.pdf")
    section = make_section(client, course)

    quiz = client.post(f"/api/sections/{section['id']}/quizzes").json()
    graded, wrong = answer_everything_wrong(client, quiz)

    assert read_rows(db_file, "select name, course_id from sections") == [("Chapter 1", course["id"])]
    assert read_rows(db_file, "select section_id from quizzes") == [(section["id"],)]
    assert read_rows(db_file, "select quiz_id, score, total, time_spent_seconds from attempts") == [(quiz["id"], 10, 20, 42)]
    assert read_rows(db_file, "select count(*) from answers where attempt_id = ?", graded["attempt_id"]) == [(20,)]

    questions = read_rows(db_file, "select position, type, options, answer_index from questions order by position")
    assert len(questions) == 20  # a quiz has 20 questions by default
    assert [(q[0], q[1], q[3]) for q in questions[:4]] == [
        (1, "MULTIPLE_CHOICE", 1), (2, "TRUE_FALSE", 0), (3, "MULTIPLE_CHOICE", 1), (4, "TRUE_FALSE", 0),
    ]
    assert json.loads(questions[1][2]) == ["True", "False"]  # options are stored as a JSON list
    answers = read_rows(db_file, "select selected_index, is_correct from answers order by selected_index, is_correct")
    assert len(answers) == 20 and sum(is_correct for _, is_correct in answers) == 10  # option 0 is right for true/false
    still_wrong = client.get(f"/api/courses/{course['id']}/progress").json()["mistakes"]
    assert {m["question_id"] for m in still_wrong} == wrong


def test_everything_is_still_there_after_the_app_is_restarted(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path / "data")
    first = TestClient(fake_app(settings))
    course, _ = upload_material(first, make_pdf([SAMPLE_SLIDES]), "slides.pdf")
    section = make_section(first, course)
    quiz = first.post(f"/api/sections/{section['id']}/quizzes").json()
    answer_everything_wrong(first, quiz)
    progress = first.get(f"/api/courses/{course['id']}/progress").json()
    history = first.get("/api/history").json()

    second = TestClient(fake_app(settings))

    assert second.get(f"/api/quizzes/{quiz['id']}").json() == quiz
    assert second.get(f"/api/courses/{course['id']}/progress").json() == progress
    assert second.get("/api/history").json() == history
    assert second.get(f"/api/courses/{course['id']}/sections").json()[0]["id"] == section["id"]
    assert len(second.get(f"/api/courses/{course['id']}/materials").json()) == 1


@pytest.mark.skipif(not Settings().google_api_key, reason="GEMINI_API_KEY is not set")
def test_real_gemini_full_flow_pdf_to_quiz_to_mistakes_to_next_quiz(tmp_path):
    custom_pdf = os.environ.get("QUIZ_PDF_PATH")
    pdf = Path(custom_pdf).expanduser().read_bytes() if custom_pdf else make_pdf([SAMPLE_SLIDES])
    filename = Path(custom_pdf).name if custom_pdf else "slides.pdf"

    settings = Settings(data_dir=tmp_path / "data")
    db_file = settings.data_dir / "soquizzer.db"
    client = TestClient(create_app(settings, embeddings=DeterministicFakeEmbedding(size=32)))

    course, response = upload_material(client, pdf, filename)
    assert response.status_code == 201, response.text
    material = response.json()["content"]
    print(f"\nDatabase: {db_file}\nMaterial JSON from Gemini:\n{json.dumps(material, ensure_ascii=False, indent=2)}")
    assert isinstance(material, (dict, list)) and material

    section = make_section(client, course)
    quiz_url = f"/api/sections/{section['id']}/quizzes"
    first = client.post(quiz_url)
    assert first.status_code == 201, first.text
    quiz = first.json()
    assert quiz["questions"] and all(len(q["options"]) >= 2 for q in quiz["questions"])
    print("\nFirst quiz:\n" + json.dumps(quiz["questions"], ensure_ascii=False, indent=2))

    graded, wrong = answer_everything_wrong(client, quiz)
    print(f"\nAnswered option 0 everywhere: {graded['score']}/{graded['total']} correct")
    stored = read_rows(db_file, "select answer_index, explanation from questions")
    assert len(stored) == len(quiz["questions"]) and all(explanation for _, explanation in stored)

    second = client.post(quiz_url)
    assert second.status_code == 201, second.text
    print("\nSecond quiz, generated after re-reading the mistakes:\n" + json.dumps(second.json()["questions"], ensure_ascii=False, indent=2))
    assert second.json()["questions"]
