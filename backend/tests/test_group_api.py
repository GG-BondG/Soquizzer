from tests.helpers import create_quiz, make_course, make_group, submit


def test_create_list_get_and_delete_group(client):
    course_id = make_course(client, with_material=False)

    response = client.post(f"/api/courses/{course_id}/groups", json={"name": "  Chapter 1  "})

    assert response.status_code == 201
    group = response.json()
    assert (group["course_id"], group["name"]) == (course_id, "Chapter 1")
    assert client.get(f"/api/groups/{group['id']}").json() == group
    second = client.post(f"/api/courses/{course_id}/groups", json={"name": "Chapter 2"}).json()
    assert client.get(f"/api/courses/{course_id}/groups").json() == [group, second]

    assert client.delete(f"/api/groups/{group['id']}").status_code == 204
    assert client.get(f"/api/groups/{group['id']}").status_code == 404
    assert client.get(f"/api/courses/{course_id}/groups").json() == [second]


def test_group_needs_a_name_and_an_existing_course(client):
    course_id = make_course(client, with_material=False)

    assert client.post(f"/api/courses/{course_id}/groups", json={"name": "   "}).status_code == 422
    assert client.post(f"/api/courses/{course_id}/groups", json={}).status_code == 422
    assert client.post("/api/courses/nope/groups", json={"name": "x"}).status_code == 404
    assert client.get("/api/courses/nope/groups").status_code == 404
    assert client.delete("/api/groups/nope").status_code == 404


def test_groups_of_different_courses_are_separate(client):
    first, second = make_course(client, False, "A"), make_course(client, False, "B")
    group = make_group(client, first)

    assert client.get(f"/api/courses/{first}/groups").json()[0]["id"] == group
    assert client.get(f"/api/courses/{second}/groups").json() == []


def test_deleting_a_group_deletes_its_quizzes_and_attempts(client):
    course_id = make_course(client)
    group_id = make_group(client, course_id)
    quiz = create_quiz(client, group_id).json()
    submit(client, quiz)

    assert client.delete(f"/api/groups/{group_id}").status_code == 204

    assert client.get(f"/api/quizzes/{quiz['id']}").status_code == 404
    assert client.get("/api/history").json()["summary"]["attempts"] == 0
    assert client.get(f"/api/courses/{course_id}").status_code == 200  # the course stays
