from tests.helpers import create_quiz, make_course, make_course_and_group, make_group, submit


def all_ids(quiz):
    return {q["id"] for q in quiz["questions"]}


def test_history_is_empty_before_any_attempt(client):
    make_course_and_group(client)

    assert client.get("/api/history").json() == {
        "summary": {"attempts": 0, "accuracy": None, "total_time_seconds": 0},
        "attempts": [],
    }


def test_history_lists_attempts_newest_first_with_score_accuracy_and_time(client):
    course_id, group_id = make_course_and_group(client)
    quiz = create_quiz(client, group_id).json()
    first_id = submit(client, quiz, correct_ids=set(list(all_ids(quiz))[:2]), time_spent_seconds=90).json()["attempt_id"]
    second_id = submit(client, quiz, correct_ids=all_ids(quiz), time_spent_seconds=60).json()["attempt_id"]

    history = client.get("/api/history").json()

    assert history["summary"] == {"attempts": 2, "accuracy": 0.75, "total_time_seconds": 150}
    newest, oldest = history["attempts"]
    assert newest == {
        "attempt_id": second_id, "quiz_id": quiz["id"], "group_id": group_id, "group_name": "Chapter 1",
        "course_id": course_id, "course_name": "Biology 101", "submitted_at": newest["submitted_at"],
        "score": 4, "total": 4, "accuracy": 1.0, "time_spent_seconds": 60,
    }
    assert (oldest["attempt_id"], oldest["score"], oldest["accuracy"], oldest["time_spent_seconds"]) == (first_id, 2, 0.5, 90)
    assert newest["submitted_at"] > oldest["submitted_at"]


def test_attempt_without_a_recorded_time_shows_null_and_counts_as_zero(client):
    _, group_id = make_course_and_group(client)
    quiz = create_quiz(client, group_id).json()
    submit(client, quiz)
    submit(client, quiz, time_spent_seconds=45)

    history = client.get("/api/history").json()

    assert [a["time_spent_seconds"] for a in history["attempts"]] == [45, None]
    assert history["summary"]["total_time_seconds"] == 45


def test_history_can_be_filtered_by_course_and_by_group(client):
    course_a = make_course(client, name="Biology 101")
    group_a1, group_a2 = make_group(client, course_a, "Chapter 1"), make_group(client, course_a, "Chapter 2")
    course_b = make_course(client, name="Chemistry 101")
    group_b = make_group(client, course_b, "Chapter 1")
    for group_id in (group_a1, group_a2, group_b):
        submit(client, create_quiz(client, group_id).json())

    assert client.get("/api/history").json()["summary"]["attempts"] == 3
    by_course = client.get("/api/history", params={"course_id": course_a}).json()
    assert {a["group_id"] for a in by_course["attempts"]} == {group_a1, group_a2}
    assert {a["course_name"] for a in by_course["attempts"]} == {"Biology 101"}
    by_group = client.get("/api/history", params={"group_id": group_b}).json()
    assert [a["course_name"] for a in by_group["attempts"]] == ["Chemistry 101"]
    both = client.get("/api/history", params={"course_id": course_b, "group_id": group_a1}).json()
    assert both["attempts"] == [] and both["summary"]["attempts"] == 0


def test_limit_shortens_the_list_but_not_the_summary(client):
    _, group_id = make_course_and_group(client)
    quiz = create_quiz(client, group_id).json()
    for _ in range(3):
        submit(client, quiz, correct_ids=all_ids(quiz))

    history = client.get("/api/history", params={"limit": 2}).json()

    assert len(history["attempts"]) == 2 and history["summary"]["attempts"] == 3


def test_history_rejects_unknown_filters_and_bad_limits(client):
    assert client.get("/api/history", params={"course_id": "nope"}).status_code == 404
    assert client.get("/api/history", params={"group_id": "nope"}).status_code == 404
    assert client.get("/api/history", params={"limit": 0}).status_code == 422
    assert client.get("/api/history", params={"limit": 201}).status_code == 422


def test_attempt_detail_shows_each_question_with_the_pick_and_the_right_answer(client):
    _, group_id = make_course_and_group(client)
    quiz = create_quiz(client, group_id).json()
    q1, q2 = quiz["questions"][0]["id"], quiz["questions"][1]["id"]
    attempt_id = submit(client, quiz, correct_ids={q1}, only={q1, q2}, time_spent_seconds=30).json()["attempt_id"]

    detail = client.get(f"/api/attempts/{attempt_id}").json()

    assert (detail["score"], detail["total"], detail["accuracy"], detail["time_spent_seconds"]) == (1, 4, 0.25, 30)
    assert detail["group_name"] == "Chapter 1" and detail["course_name"] == "Biology 101"
    first, second, third, fourth = detail["questions"]
    assert first == {
        "question_id": q1, "position": 1, "type": "MULTIPLE_CHOICE", "stem": "Round 1 question 1?",
        "options": ["a", "b", "c", "d"], "answer_index": 1, "explanation": "Because 1.",
        "selected_index": 1, "is_correct": True,
    }
    assert (second["selected_index"], second["is_correct"], second["answer_index"]) == (1, False, 0)
    assert (third["selected_index"], third["is_correct"]) == (None, None)  # left unanswered
    assert (fourth["selected_index"], fourth["is_correct"]) == (None, None)


def test_unknown_attempt_is_404(client):
    assert client.get("/api/attempts/nope").status_code == 404
