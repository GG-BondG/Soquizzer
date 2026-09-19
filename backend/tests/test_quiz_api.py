import json

from app.config import Settings
from app.exception import LlmError
from tests.conftest import FakePdfConverter
from tests.helpers import PDF, create_quiz, make_course, make_course_and_section, make_section, picks, submit


def test_creating_a_quiz_returns_its_questions_without_the_answers(client, quiz_generator):
    course_id, section_id = make_course_and_section(client)

    response = create_quiz(client, section_id)

    assert response.status_code == 201
    quiz = response.json()
    assert quiz["section_id"] == section_id
    assert [q["position"] for q in quiz["questions"]] == [1, 2, 3, 4]
    assert [q["type"] for q in quiz["questions"]] == ["MULTIPLE_CHOICE", "TRUE_FALSE"] * 2
    assert all(set(q) == {"id", "position", "type", "stem", "options"} for q in quiz["questions"])
    assert client.get(f"/api/quizzes/{quiz['id']}").json() == quiz

    (call,) = quiz_generator.calls
    assert call["mistakes"] == [] and call["num_questions"] == 4
    assert call["materials"] == [("cells.pdf", json.dumps(FakePdfConverter.RESULT))]


def test_a_quiz_has_twenty_questions_by_default(client, settings):
    assert Settings(_env_file=None).questions_per_quiz == 20
    settings.questions_per_quiz = 20
    _, section_id = make_course_and_section(client)

    assert len(create_quiz(client, section_id).json()["questions"]) == 20


def test_quiz_list_has_summaries_without_questions(client):
    _, section_id = make_course_and_section(client)
    first = create_quiz(client, section_id).json()
    second = create_quiz(client, section_id).json()
    submit(client, second)

    listed = client.get(f"/api/sections/{section_id}/quizzes").json()

    assert [q["id"] for q in listed] == [second["id"], first["id"]]  # newest first
    assert listed[0] == {
        "id": second["id"], "section_id": section_id, "created_at": second["created_at"], "question_count": 4, "attempt_count": 1,
    }
    assert listed[1]["attempt_count"] == 0


def test_generating_needs_course_material(client, quiz_generator):
    _, section_id = make_course_and_section(client, with_material=False)

    assert create_quiz(client, section_id).status_code == 409
    assert quiz_generator.calls == []


def test_material_too_large_for_one_prompt_is_rejected(client, settings, quiz_generator):
    _, section_id = make_course_and_section(client)
    settings.max_material_chars = 5

    assert create_quiz(client, section_id).status_code == 413
    assert quiz_generator.calls == []


def test_unknown_section_course_quiz_are_404(client):
    assert create_quiz(client, "nope").status_code == 404
    assert client.get("/api/sections/nope/quizzes").status_code == 404
    assert client.get("/api/courses/nope/progress").status_code == 404
    assert client.get("/api/quizzes/nope").status_code == 404
    assert client.delete("/api/quizzes/nope").status_code == 404
    body = {"answers": [{"question_id": "x", "selected_index": 0}]}
    assert client.post("/api/quizzes/nope/submissions", json=body).status_code == 404


def test_generation_failure_returns_502_and_stores_nothing(client, quiz_generator):
    _, section_id = make_course_and_section(client)
    quiz_generator.error = LlmError("Gemini did not return a valid quiz")

    assert create_quiz(client, section_id).status_code == 502
    assert client.get(f"/api/sections/{section_id}/quizzes").json() == []


def test_submission_is_graded_against_the_answer_gemini_wrote(client):
    _, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()
    first, second = quiz["questions"][0]["id"], quiz["questions"][1]["id"]

    response = submit(client, quiz, correct_ids={first, second})

    assert response.status_code == 201
    body = response.json()
    assert (body["score"], body["total"]) == (2, 4) and body["attempt_id"]
    by_id = {r["question_id"]: r for r in body["results"]}
    assert by_id[first] == {
        "question_id": first, "selected_index": 1, "is_correct": True, "answer_index": 1, "explanation": "Because 1.",
    }
    wrong = by_id[quiz["questions"][2]["id"]]
    assert wrong["is_correct"] is False and wrong["answer_index"] == 1 and wrong["selected_index"] == 0


def test_partial_submission_only_records_answered_questions(client):
    course_id, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()
    first = quiz["questions"][0]["id"]

    body = submit(client, quiz, correct_ids={first}, only={first}).json()

    assert (body["score"], body["total"], len(body["results"])) == (1, 4, 1)
    assert client.get(f"/api/courses/{course_id}/progress").json()["by_type"] == [
        {"type": "MULTIPLE_CHOICE", "total": 1, "correct": 1}
    ]


def test_invalid_submission_is_rejected_and_nothing_is_stored(client):
    course_id, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()
    real = quiz["questions"][0]["id"]
    url = f"/api/quizzes/{quiz['id']}/submissions"

    bad_bodies = [
        {"answers": [{"question_id": real, "selected_index": 1}, {"question_id": "not-in-quiz", "selected_index": 0}]},
        {"answers": [{"question_id": real, "selected_index": 1}, {"question_id": real, "selected_index": 2}]},
        {"answers": [{"question_id": real, "selected_index": 4}]},
        {"answers": [{"question_id": real, "selected_index": -1}]},
        {"answers": []},
        {"answers": [{"question_id": real, "selected_index": 1}], "time_spent_seconds": -5},
    ]
    assert [client.post(url, json=body).status_code for body in bad_bodies] == [422] * 6
    assert client.get(f"/api/courses/{course_id}/progress").json() == {"by_type": [], "mistakes": []}
    assert client.get("/api/history").json()["summary"]["attempts"] == 0


def test_progress_lists_mistakes_and_accuracy_by_question_type(client):
    course_id, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()
    q1, q2, q3, q4 = [q["id"] for q in quiz["questions"]]
    submit(client, quiz, correct_ids={q1, q3})  # multiple choice both right, true/false both wrong

    progress = client.get(f"/api/courses/{course_id}/progress").json()

    assert progress["by_type"] == [
        {"type": "MULTIPLE_CHOICE", "total": 2, "correct": 2},
        {"type": "TRUE_FALSE", "total": 2, "correct": 0},
    ]
    assert {m["question_id"] for m in progress["mistakes"]} == {q2, q4}
    mistake = progress["mistakes"][0]
    assert mistake["quiz_id"] == quiz["id"] and mistake["type"] == "TRUE_FALSE"
    assert (mistake["selected_index"], mistake["answer_index"]) == (1, 0)


def test_next_quiz_in_a_section_re_reads_the_mistakes_still_open(client, quiz_generator):
    _, section_id = make_course_and_section(client)
    first_quiz = create_quiz(client, section_id).json()
    first_ids = [q["id"] for q in first_quiz["questions"]]
    submit(client, first_quiz)  # everything wrong

    create_quiz(client, section_id)
    second_call = quiz_generator.calls[1]
    assert sorted(m.stem for m in second_call["mistakes"]) == [f"Round 1 question {n}?" for n in (1, 2, 3, 4)]
    assert all(m.selected_index != m.answer_index for m in second_call["mistakes"])
    assert {(a.type.value, a.total, a.correct) for a in second_call["accuracy"]} == {
        ("MULTIPLE_CHOICE", 2, 0), ("TRUE_FALSE", 2, 0),
    }

    submit(client, first_quiz, correct_ids={first_ids[0]}, only={first_ids[0]})  # question 1 is now right
    create_quiz(client, section_id)
    third_stems = {m.stem for m in quiz_generator.calls[2]["mistakes"]}
    assert third_stems == {f"Round 1 question {n}?" for n in (2, 3, 4)}


def test_mistakes_of_one_section_are_not_used_for_another_section(client, quiz_generator):
    course_id, section_a = make_course_and_section(client)
    section_b = make_section(client, course_id, "Chapter 2")
    submit(client, create_quiz(client, section_a).json())  # all wrong, in section A

    create_quiz(client, section_b)

    assert quiz_generator.calls[1]["mistakes"] == [] and quiz_generator.calls[1]["accuracy"] == []


def test_only_the_newest_mistakes_up_to_the_limit_are_re_read(client, settings, quiz_generator):
    _, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()
    settings.mistake_review_limit = 2
    for question in quiz["questions"]:  # answer one at a time so each mistake has its own timestamp
        submit(client, quiz, only={question["id"]})

    create_quiz(client, section_id)

    assert [m.stem for m in quiz_generator.calls[1]["mistakes"]] == ["Round 1 question 4?", "Round 1 question 3?"]


def test_deleting_a_quiz_removes_its_questions_attempts_and_answers(client, app):
    from sqlalchemy import func, select

    from app.entity import Answer, Attempt, Question

    course_id, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()
    submit(client, quiz)

    assert client.delete(f"/api/quizzes/{quiz['id']}").status_code == 204

    assert client.get(f"/api/quizzes/{quiz['id']}").status_code == 404
    assert client.get(f"/api/courses/{course_id}/progress").json() == {"by_type": [], "mistakes": []}
    with app.state.container.session_factory() as session:
        counts = [session.scalar(select(func.count()).select_from(model)) for model in (Question, Attempt, Answer)]
    assert counts == [0, 0, 0]


def test_deleting_a_course_removes_everything_under_it(client, app):
    from sqlalchemy import func, select

    from app.entity import Answer, Attempt, Material, Question, Quiz, Section

    course_id, section_id = make_course_and_section(client)
    submit(client, create_quiz(client, section_id).json())

    assert client.delete(f"/api/courses/{course_id}").status_code == 204

    with app.state.container.session_factory() as session:
        models = (Material, Section, Quiz, Question, Attempt, Answer)
        counts = [session.scalar(select(func.count()).select_from(model)) for model in models]
    assert counts == [0] * 6
