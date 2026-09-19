from tests.conftest import make_pdf

PDF = make_pdf(["Cells are the basic unit of life."])


def make_course(client, name="Biology 101") -> str:
    return client.post("/api/courses", json={"name": name, "subject": "BIOLOGY"}).json()["id"]


def make_section(client, course_id, name="Chapter 1", with_material=True) -> str:
    section_id = client.post(f"/api/courses/{course_id}/sections", json={"name": name}).json()["id"]
    if with_material:
        client.post(f"/api/sections/{section_id}/materials", files={"file": ("cells.pdf", PDF)})
    return section_id


def make_course_and_section(client, with_material=True):
    course_id = make_course(client)
    return course_id, make_section(client, course_id, with_material=with_material)


def create_quiz(client, section_id):
    return client.post(f"/api/sections/{section_id}/quizzes")


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
