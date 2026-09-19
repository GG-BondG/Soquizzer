from tests.helpers import create_quiz, make_course, make_section, submit


def test_create_list_get_and_delete_section(client):
    course_id = make_course(client, with_material=False)

    response = client.post(f"/api/courses/{course_id}/sections", json={"name": "  Chapter 1  "})

    assert response.status_code == 201
    section = response.json()
    assert (section["course_id"], section["name"]) == (course_id, "Chapter 1")
    assert client.get(f"/api/sections/{section['id']}").json() == section
    second = client.post(f"/api/courses/{course_id}/sections", json={"name": "Chapter 2"}).json()
    assert client.get(f"/api/courses/{course_id}/sections").json() == [section, second]

    assert client.delete(f"/api/sections/{section['id']}").status_code == 204
    assert client.get(f"/api/sections/{section['id']}").status_code == 404
    assert client.get(f"/api/courses/{course_id}/sections").json() == [second]


def test_section_needs_a_name_and_an_existing_course(client):
    course_id = make_course(client, with_material=False)

    assert client.post(f"/api/courses/{course_id}/sections", json={"name": "   "}).status_code == 422
    assert client.post(f"/api/courses/{course_id}/sections", json={}).status_code == 422
    assert client.post("/api/courses/nope/sections", json={"name": "x"}).status_code == 404
    assert client.get("/api/courses/nope/sections").status_code == 404
    assert client.delete("/api/sections/nope").status_code == 404


def test_sections_of_different_courses_are_separate(client):
    first, second = make_course(client, False, "A"), make_course(client, False, "B")
    section = make_section(client, first)

    assert client.get(f"/api/courses/{first}/sections").json()[0]["id"] == section
    assert client.get(f"/api/courses/{second}/sections").json() == []


def test_deleting_a_section_deletes_its_quizzes_and_attempts(client):
    course_id = make_course(client)
    section_id = make_section(client, course_id)
    quiz = create_quiz(client, section_id).json()
    submit(client, quiz)

    assert client.delete(f"/api/sections/{section_id}").status_code == 204

    assert client.get(f"/api/quizzes/{quiz['id']}").status_code == 404
    assert client.get("/api/history").json()["summary"]["attempts"] == 0
    assert client.get(f"/api/courses/{course_id}").status_code == 200  # the course stays
