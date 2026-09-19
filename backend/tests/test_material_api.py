import json

from app.entity import Material
from app.exception import LlmError
from tests.conftest import FakePdfConverter, make_pdf

PDF = make_pdf(["Cells are the basic unit of life."])


def create_course(client, name="Biology 101", subject="BIOLOGY"):
    return client.post("/api/courses", json={"name": name, "subject": subject})


def create_section(client, course_id=None, name="Chapter 1"):
    course_id = course_id or create_course(client).json()["id"]
    return client.post(f"/api/courses/{course_id}/sections", json={"name": name}).json()["id"]


def create_material(client, section_id, content=PDF, filename="cells.pdf"):
    return client.post(f"/api/sections/{section_id}/materials", files={"file": (filename, content)})


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


def test_pdf_becomes_json_stored_in_database(client, app, converter):
    course_id = create_course(client).json()["id"]
    section_id = create_section(client, course_id)

    response = create_material(client, section_id)

    assert response.status_code == 201
    material = response.json()
    assert material["course_id"] == course_id
    assert material["section_id"] == section_id
    assert material["source_filename"] == "cells.pdf"
    assert material["content"] == FakePdfConverter.RESULT
    assert converter.calls == [PDF]

    with app.state.container.session_factory() as session:
        stored = session.get(Material, material["id"]).content
    assert json.loads(stored) == FakePdfConverter.RESULT


def test_non_pdf_is_rejected(client, converter):
    section_id = create_section(client)

    assert create_material(client, section_id, b"just text", "notes.txt").status_code == 415
    assert create_material(client, section_id, b"just text", "fake.pdf").status_code == 415
    assert converter.calls == []


def test_oversized_pdf_is_rejected(client, settings, converter):
    section_id = create_section(client)
    too_big = b"%PDF-" + b"a" * settings.max_material_pdf_bytes

    assert create_material(client, section_id, too_big).status_code == 413
    assert converter.calls == []


def test_material_for_unknown_section_is_404(client, converter):
    assert create_material(client, "nope").status_code == 404
    assert client.get("/api/sections/nope/materials").status_code == 404
    assert converter.calls == []


def test_conversion_failure_returns_502_and_stores_nothing(client, converter):
    section_id = create_section(client)
    converter.error = LlmError("Gemini returned invalid JSON")

    response = create_material(client, section_id)

    assert response.status_code == 502
    assert client.get(f"/api/sections/{section_id}/materials").json() == []


def test_list_get_and_delete_material(client):
    section_id = create_section(client)
    material = create_material(client, section_id).json()

    assert client.get(f"/api/sections/{section_id}/materials").json() == [material]
    assert client.get(f"/api/materials/{material['id']}").json() == material
    assert client.delete(f"/api/materials/{material['id']}").status_code == 204
    assert client.get(f"/api/materials/{material['id']}").status_code == 404


def test_each_section_has_its_own_materials(client):
    course_id = create_course(client).json()["id"]
    first, second = create_section(client, course_id, "Chapter 1"), create_section(client, course_id, "Chapter 2")
    in_first = create_material(client, first, filename="one.pdf").json()

    assert client.get(f"/api/sections/{first}/materials").json() == [in_first]
    assert client.get(f"/api/sections/{second}/materials").json() == []


def test_deleting_a_section_deletes_its_materials(client):
    section_id = create_section(client)
    material_id = create_material(client, section_id).json()["id"]

    assert client.delete(f"/api/sections/{section_id}").status_code == 204
    assert client.get(f"/api/materials/{material_id}").status_code == 404


def test_deleting_course_deletes_its_materials(client):
    course_id = create_course(client).json()["id"]
    material_id = create_material(client, create_section(client, course_id)).json()["id"]

    assert client.delete(f"/api/courses/{course_id}").status_code == 204
    assert client.get(f"/api/courses/{course_id}").status_code == 404
    assert client.get(f"/api/materials/{material_id}").status_code == 404
