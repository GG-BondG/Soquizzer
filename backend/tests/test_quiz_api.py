import json

from app.exception import LlmError
from tests.conftest import FakePdfConverter, make_pdf

PDF = make_pdf(["Cells are the basic unit of life."])


def make_course(client, with_material=True) -> str:
    course_id = client.post("/api/courses", json={"name": "Biology 101", "subject": "BIOLOGY"}).json()["id"]
    if with_material:
        client.post(f"/api/courses/{course_id}/materials", files={"file": ("cells.pdf", PDF)})
    return course_id


def generate(client, course_id, num_questions=4):
    return client.post(f"/api/courses/{course_id}/quizzes", params={"num_questions": num_questions})


def picks(quiz, correct_ids=(), only=None):
    """Answers for a quiz: correct for the given question ids, wrong for the rest.

    The fake generator makes odd questions multiple choice (right option 1) and even ones true/false (right option 0).
    """
    answers = []
    for question in quiz["questions"]:
        right = 1 if question["type"] == "MULTIPLE_CHOICE" else 0
        selected = right if question["id"] in correct_ids else 1 - right
        if only is None or question["id"] in only:
            answers.append({"question_id": question["id"], "selected_index": selected})
    return {"answers": answers}


def submit(client, quiz, **kwargs):
    return client.post(f"/api/quizzes/{quiz['id']}/submissions", json=picks(quiz, **kwargs))


def test_generated_quiz_has_questions_but_hides_the_answers(client, quiz_generator):
    course_id = make_course(client)

    response = generate(client, course_id, num_questions=4)

    assert response.status_code == 201
    quiz = response.json()
    assert quiz["course_id"] == course_id
    assert [q["position"] for q in quiz["questions"]] == [1, 2, 3, 4]
    assert [q["type"] for q in quiz["questions"]] == ["MULTIPLE_CHOICE", "TRUE_FALSE"] * 2
    assert all(set(q) == {"id", "position", "type", "stem", "options"} for q in quiz["questions"])
    assert client.get(f"/api/quizzes/{quiz['id']}").json() == quiz
    assert client.get(f"/api/courses/{course_id}/quizzes").json() == [quiz]

    (call,) = quiz_generator.calls
    assert call["num_questions"] == 4 and call["mistakes"] == []
    assert call["materials"] == [("cells.pdf", json.dumps(FakePdfConverter.RESULT))]


def test_generating_needs_course_material(client, quiz_generator):
    course_id = make_course(client, with_material=False)

    assert generate(client, course_id).status_code == 409
    assert quiz_generator.calls == []


def test_material_too_large_for_one_prompt_is_rejected(client, settings, quiz_generator):
    course_id = make_course(client)
    settings.max_material_chars = 5

    assert generate(client, course_id).status_code == 413
    assert quiz_generator.calls == []


def test_num_questions_out_of_range_is_rejected(client, quiz_generator):
    course_id = make_course(client)

    assert generate(client, course_id, num_questions=0).status_code == 422
    assert generate(client, course_id, num_questions=51).status_code == 422
    assert quiz_generator.calls == []


def test_unknown_course_and_quiz_are_404(client):
    assert generate(client, "nope").status_code == 404
    assert client.get("/api/courses/nope/quizzes").status_code == 404
    assert client.get("/api/courses/nope/progress").status_code == 404
    assert client.get("/api/quizzes/nope").status_code == 404
    assert client.post("/api/quizzes/nope/submissions", json={"answers": [{"question_id": "x", "selected_index": 0}]}).status_code == 404


def test_generation_failure_returns_502_and_stores_nothing(client, quiz_generator):
    course_id = make_course(client)
    quiz_generator.error = LlmError("Gemini did not return a valid quiz")

    assert generate(client, course_id).status_code == 502
    assert client.get(f"/api/courses/{course_id}/quizzes").json() == []


def test_submission_is_graded_against_the_answer_gemini_wrote(client):
    quiz = generate(client, make_course(client)).json()
    first, second = quiz["questions"][0]["id"], quiz["questions"][1]["id"]

    response = submit(client, quiz, correct_ids={first, second})

    assert response.status_code == 201
    body = response.json()
    assert (body["score"], body["total"]) == (2, 4)
    by_id = {r["question_id"]: r for r in body["results"]}
    assert by_id[first] == {
        "question_id": first, "selected_index": 1, "is_correct": True, "answer_index": 1, "explanation": "Because 1.",
    }
    wrong = by_id[quiz["questions"][2]["id"]]
    assert wrong["is_correct"] is False and wrong["answer_index"] == 1 and wrong["selected_index"] == 0


def test_partial_submission_only_records_answered_questions(client):
    course_id = make_course(client)
    quiz = generate(client, course_id).json()
    first = quiz["questions"][0]["id"]

    body = submit(client, quiz, correct_ids={first}, only={first}).json()

    assert (body["score"], body["total"], len(body["results"])) == (1, 4, 1)
    assert client.get(f"/api/courses/{course_id}/progress").json()["by_type"] == [
        {"type": "MULTIPLE_CHOICE", "total": 1, "correct": 1}
    ]


def test_invalid_submission_is_rejected_and_nothing_is_stored(client):
    course_id = make_course(client)
    quiz = generate(client, course_id).json()
    real = quiz["questions"][0]["id"]
    url = f"/api/quizzes/{quiz['id']}/submissions"

    bad_bodies = [
        {"answers": [{"question_id": real, "selected_index": 1}, {"question_id": "not-in-quiz", "selected_index": 0}]},
        {"answers": [{"question_id": real, "selected_index": 1}, {"question_id": real, "selected_index": 2}]},
        {"answers": [{"question_id": real, "selected_index": 4}]},
        {"answers": [{"question_id": real, "selected_index": -1}]},
        {"answers": []},
    ]
    assert [client.post(url, json=body).status_code for body in bad_bodies] == [422] * 5
    assert client.get(f"/api/courses/{course_id}/progress").json() == {"by_type": [], "mistakes": []}


def test_progress_lists_mistakes_and_accuracy_by_question_type(client):
    course_id = make_course(client)
    quiz = generate(client, course_id).json()
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


def test_next_quiz_is_generated_from_the_mistakes_still_open(client, quiz_generator):
    course_id = make_course(client)
    first_quiz = generate(client, course_id).json()
    first_ids = [q["id"] for q in first_quiz["questions"]]
    submit(client, first_quiz)  # everything wrong

    generate(client, course_id)
    second_call = quiz_generator.calls[1]
    assert sorted(m.stem for m in second_call["mistakes"]) == [f"Round 1 question {n}?" for n in (1, 2, 3, 4)]
    assert all(m.selected_index != m.answer_index for m in second_call["mistakes"])
    assert {(a.type.value, a.total, a.correct) for a in second_call["accuracy"]} == {
        ("MULTIPLE_CHOICE", 2, 0), ("TRUE_FALSE", 2, 0),
    }

    submit(client, first_quiz, correct_ids={first_ids[0]}, only={first_ids[0]})  # question 1 is now right
    generate(client, course_id)
    third_stems = {m.stem for m in quiz_generator.calls[2]["mistakes"]}
    assert third_stems == {f"Round 1 question {n}?" for n in (2, 3, 4)}


def test_only_the_newest_mistakes_up_to_the_limit_are_re_read(client, settings, quiz_generator):
    course_id = make_course(client)
    quiz = generate(client, course_id).json()
    settings.mistake_review_limit = 2
    for question in quiz["questions"]:  # answer one at a time so each mistake has its own timestamp
        submit(client, quiz, only={question["id"]})

    generate(client, course_id)

    assert [m.stem for m in quiz_generator.calls[1]["mistakes"]] == ["Round 1 question 4?", "Round 1 question 3?"]


def test_deleting_a_quiz_removes_its_questions_and_answers(client):
    course_id = make_course(client)
    quiz = generate(client, course_id).json()
    submit(client, quiz)

    assert client.delete(f"/api/quizzes/{quiz['id']}").status_code == 204

    assert client.get(f"/api/quizzes/{quiz['id']}").status_code == 404
    assert client.get(f"/api/courses/{course_id}/progress").json() == {"by_type": [], "mistakes": []}


def test_deleting_a_course_removes_materials_quizzes_and_answers(client, app):
    from sqlalchemy import func, select

    from app.entity import Answer, Material, Question, Quiz

    course_id = make_course(client)
    submit(client, generate(client, course_id).json())

    assert client.delete(f"/api/courses/{course_id}").status_code == 204

    with app.state.container.session_factory() as session:
        counts = [session.scalar(select(func.count()).select_from(model)) for model in (Material, Quiz, Question, Answer)]
    assert counts == [0, 0, 0, 0]
