from tests.conftest import make_pdf

PDF = make_pdf(["Cells are the basic unit of life."])


def make_course(client, with_material=True, name="Biology 101") -> str:
    course_id = client.post("/api/courses", json={"name": name, "subject": "BIOLOGY"}).json()["id"]
    if with_material:
        client.post(f"/api/courses/{course_id}/materials", files={"file": ("cells.pdf", PDF)})
    return course_id


def make_group(client, course_id, name="Chapter 1") -> str:
    return client.post(f"/api/courses/{course_id}/groups", json={"name": name}).json()["id"]


def make_course_and_group(client, with_material=True):
    course_id = make_course(client, with_material)
    return course_id, make_group(client, course_id)


def create_quiz(client, group_id):
    return client.post(f"/api/groups/{group_id}/quizzes")


def picks(quiz, correct_ids=(), only=None, **extra):
    """Answers for a quiz: correct for the given question ids, wrong for the rest.

    The fake generator makes odd questions multiple choice (right option 1) and even ones true/false (right option 0).
    """
    answers = []
    for question in quiz["questions"]:
        right = 1 if question["type"] == "MULTIPLE_CHOICE" else 0
        selected = right if question["id"] in correct_ids else 1 - right
        if only is None or question["id"] in only:
            answers.append({"question_id": question["id"], "selected_index": selected})
    return {"answers": answers, **extra}


def submit(client, quiz, **kwargs):
    return client.post(f"/api/quizzes/{quiz['id']}/submissions", json=picks(quiz, **kwargs))
