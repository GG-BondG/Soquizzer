import json

from app.entity import Quiz
from app.exception import QuizGenerationError
from tests.conftest import make_pdf

PDF = make_pdf(["Cells are the basic unit of life."])


def create_course(client, name="Biology 101", subject="BIOLOGY"):
    return client.post("/api/courses", json={"name": name, "subject": subject})


def create_quiz(client, course_id, content=PDF, filename="cells.pdf", **data):
    return client.post(f"/api/courses/{course_id}/quizzes", files={"file": (filename, content)}, data=data)


def test_create_and_fetch_course(client):
    response = create_course(client, name="  Biology 101  ")

    assert response.status_code == 201
    course = response.json()
    assert course["name"] == "Biology 101"
    assert course["subject"] == "BIOLOGY"
    assert client.get(f"/api/courses/{course['id']}").json() == course
    assert client.get("/api/courses").json() == [course]


def test_course_rejects_unknown_subject_and_blank_name(client):
    assert create_course(client, subject="ASTROLOGY").status_code == 422
    assert create_course(client, name="   ").status_code == 422


def test_pdf_becomes_quiz_json_stored_in_database(client, app, generator):
    course_id = create_course(client).json()["id"]

    response = create_quiz(client, course_id, num_questions="3")

    assert response.status_code == 201
    quiz = response.json()
    assert quiz["course_id"] == course_id
    assert quiz["source_filename"] == "cells.pdf"
    assert quiz["content"]["title"] == "Cell biology quiz"
    assert len(quiz["content"]["questions"]) == 3
    assert generator.calls == [(PDF, 3)]

    with app.state.container.session_factory() as session:
        stored = session.get(Quiz, quiz["id"]).content
    assert json.loads(stored) == quiz["content"]


def test_quiz_defaults_to_ten_questions(client, generator):
    create_quiz(client, create_course(client).json()["id"])

    assert generator.calls[0][1] == 10


def test_num_questions_out_of_range_is_rejected(client, generator):
    course_id = create_course(client).json()["id"]

    assert create_quiz(client, course_id, num_questions="0").status_code == 422
    assert create_quiz(client, course_id, num_questions="51").status_code == 422
    assert generator.calls == []


def test_non_pdf_is_rejected(client, generator):
    course_id = create_course(client).json()["id"]

    assert create_quiz(client, course_id, b"just text", "notes.txt").status_code == 415
    assert create_quiz(client, course_id, b"just text", "fake.pdf").status_code == 415
    assert generator.calls == []


def test_oversized_pdf_is_rejected(client, settings, generator):
    course_id = create_course(client).json()["id"]
    too_big = b"%PDF-" + b"a" * settings.max_quiz_pdf_bytes

    assert create_quiz(client, course_id, too_big).status_code == 413
    assert generator.calls == []


def test_quiz_for_unknown_course_is_404(client, generator):
    assert create_quiz(client, "nope").status_code == 404
    assert client.get("/api/courses/nope/quizzes").status_code == 404
    assert generator.calls == []


def test_generation_failure_returns_502_and_stores_nothing(client, generator):
    course_id = create_course(client).json()["id"]
    generator.error = QuizGenerationError("Gemini did not return a valid quiz")

    response = create_quiz(client, course_id)

    assert response.status_code == 502
    assert client.get(f"/api/courses/{course_id}/quizzes").json() == []


def test_list_get_and_delete_quiz(client):
    course_id = create_course(client).json()["id"]
    quiz = create_quiz(client, course_id).json()

    assert client.get(f"/api/courses/{course_id}/quizzes").json() == [quiz]
    assert client.get(f"/api/quizzes/{quiz['id']}").json() == quiz
    assert client.delete(f"/api/quizzes/{quiz['id']}").status_code == 204
    assert client.get(f"/api/quizzes/{quiz['id']}").status_code == 404


def test_deleting_course_deletes_its_quizzes(client):
    course_id = create_course(client).json()["id"]
    quiz_id = create_quiz(client, course_id).json()["id"]

    assert client.delete(f"/api/courses/{course_id}").status_code == 204
    assert client.get(f"/api/courses/{course_id}").status_code == 404
    assert client.get(f"/api/quizzes/{quiz_id}").status_code == 404


def test_quiz_survives_restart(settings, generator):
    from fastapi.testclient import TestClient
    from langchain_core.embeddings import DeterministicFakeEmbedding

    from app.main import create_app

    first = TestClient(create_app(settings, DeterministicFakeEmbedding(size=32), generator))
    course_id = create_course(first).json()["id"]
    quiz = create_quiz(first, course_id).json()

    second = TestClient(create_app(settings, DeterministicFakeEmbedding(size=32), generator))
    assert second.get(f"/api/quizzes/{quiz['id']}").json() == quiz
