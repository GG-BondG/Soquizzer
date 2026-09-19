from langchain_core.documents import Document
from sqlalchemy import select

from app.entity import CourseTextbook
from app.rag import format_excerpts
from tests.conftest import make_blank_pdf, make_pdf
from tests.helpers import create_quiz, make_course, make_course_and_section, make_section, submit

BOOK = ("Mitochondria are the powerhouse of the cell. They produce ATP through respiration. " * 12).encode()


def upload_book(client, name="bio.txt", content=BOOK) -> str:
    response = client.post("/api/textbooks", files={"file": (name, content)})
    assert response.status_code == 202, response.text
    return response.json()["id"]


def attach(client, course_id, textbook_id):
    return client.put(f"/api/courses/{course_id}/textbooks/{textbook_id}")


def textbook_material(call):
    """The (title, text) pairs of one generator call that came from textbooks rather than uploaded PDFs."""
    return [(title, text) for title, text in call["materials"] if title.endswith("(textbook excerpts)")]


def test_attach_list_and_detach_a_textbook(client):
    course_id = make_course(client, with_material=False)
    book_id = upload_book(client)

    assert client.get(f"/api/courses/{course_id}/textbooks").json() == []
    assert attach(client, course_id, book_id).status_code == 204
    assert attach(client, course_id, book_id).status_code == 204  # idempotent
    (listed,) = client.get(f"/api/courses/{course_id}/textbooks").json()
    assert listed["id"] == book_id and listed["status"] == "READY"

    assert client.delete(f"/api/courses/{course_id}/textbooks/{book_id}").status_code == 204
    assert client.delete(f"/api/courses/{course_id}/textbooks/{book_id}").status_code == 204
    assert client.get(f"/api/courses/{course_id}/textbooks").json() == []
    assert client.get(f"/api/textbooks/{book_id}").status_code == 200  # the textbook itself is untouched


def test_unknown_course_or_textbook_is_404(client):
    course_id = make_course(client, with_material=False)
    book_id = upload_book(client)

    assert attach(client, "nope", book_id).status_code == 404
    assert attach(client, course_id, "nope").status_code == 404
    assert client.delete(f"/api/courses/{course_id}/textbooks/nope").status_code == 404
    assert client.get("/api/courses/nope/textbooks").status_code == 404


def test_quiz_prompt_gets_the_textbook_passages_next_to_the_uploaded_material(client, quiz_generator):
    course_id, section_id = make_course_and_section(client)
    attach(client, course_id, upload_book(client))

    assert create_quiz(client, section_id).status_code == 201

    (call,) = quiz_generator.calls
    assert call["materials"][0][0] == "cells.pdf"  # the uploaded material is still there, first
    ((title, text),) = textbook_material(call)
    assert title == "bio.txt (textbook excerpts)"
    assert "[bio.txt]" in text and "powerhouse of the cell" in text


def test_a_course_with_only_a_textbook_can_have_quizzes(client, quiz_generator):
    course_id, section_id = make_course_and_section(client, with_material=False)
    attach(client, course_id, upload_book(client))

    assert create_quiz(client, section_id).status_code == 201

    (call,) = quiz_generator.calls
    assert [title for title, _ in call["materials"]] == ["bio.txt (textbook excerpts)"]


def test_pdf_passages_are_labelled_with_their_page(client, quiz_generator):
    course_id, section_id = make_course_and_section(client, with_material=False)
    pages = ["Chapter one is about cells and their membranes. " * 4, "Chapter two is about DNA and its replication. " * 4]
    attach(client, course_id, upload_book(client, "bio.pdf", make_pdf(pages)))

    create_quiz(client, section_id)

    ((_, text),) = textbook_material(quiz_generator.calls[0])
    assert "[bio.pdf, p.1]" in text and "[bio.pdf, p.2]" in text


def test_without_material_or_a_ready_textbook_there_is_nothing_to_write_from(client, quiz_generator, ocr):
    course_id, section_id = make_course_and_section(client, with_material=False)
    failed = upload_book(client, "scan.pdf", make_blank_pdf(2))  # OCR finds nothing: FAILED
    assert client.get(f"/api/textbooks/{failed}").json()["status"] == "FAILED"
    attach(client, course_id, failed)

    assert create_quiz(client, section_id).status_code == 409
    assert quiz_generator.calls == []


def test_only_textbooks_attached_to_this_course_are_used(client, quiz_generator):
    course_id, section_id = make_course_and_section(client)
    other_course = make_course(client, with_material=False, name="Chemistry")
    attach(client, other_course, upload_book(client, "chem.txt", b"Atoms bond by sharing electrons. " * 20))

    create_quiz(client, section_id)

    assert textbook_material(quiz_generator.calls[0]) == []


def test_a_textbook_can_serve_several_courses(client, quiz_generator):
    first_course, first_section = make_course_and_section(client, with_material=False)
    second_course = make_course(client, with_material=False, name="Biology 102")
    second_section = make_section(client, second_course)
    book_id = upload_book(client)
    attach(client, first_course, book_id)
    attach(client, second_course, book_id)

    assert create_quiz(client, first_section).status_code == 201
    assert create_quiz(client, second_section).status_code == 201
    assert all(textbook_material(call) for call in quiz_generator.calls)


def test_the_search_uses_the_section_and_what_the_student_got_wrong(client, chunks, quiz_generator, monkeypatch):
    course_id, section_id = make_course_and_section(client)
    attach(client, course_id, upload_book(client))
    queries: list[str] = []
    original = chunks.search_in
    monkeypatch.setattr(chunks, "search_in", lambda query, ids, k=4: queries.append(query) or original(query, ids, k))

    create_quiz(client, section_id)
    assert queries == ["Biology 101: Chapter 1"]

    queries.clear()
    submit(client, create_quiz(client, section_id).json())  # wrong answers: the next search adds their stems
    queries.clear()
    create_quiz(client, section_id)
    assert queries[0] == "Biology 101: Chapter 1"
    newest_mistakes = [m.stem for m in quiz_generator.calls[-1]["mistakes"][:3]]
    assert len(queries) == 4 and queries[1:] == newest_mistakes


def test_the_search_is_limited_by_top_k_and_the_character_budget(client, settings, quiz_generator):
    course_id, section_id = make_course_and_section(client)
    attach(client, course_id, upload_book(client))
    settings.max_textbook_chars = 300

    create_quiz(client, section_id)

    ((_, text),) = textbook_material(quiz_generator.calls[0])
    assert 0 < text.count("[bio.txt]") <= 2  # 200-character chunks: at most one or two fit in 300 characters


def test_a_failing_textbook_search_still_writes_the_quiz_from_the_uploaded_material(client, chunks, quiz_generator, monkeypatch):
    course_id, section_id = make_course_and_section(client)
    attach(client, course_id, upload_book(client))
    monkeypatch.setattr(chunks, "search_in", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("quota")))

    assert create_quiz(client, section_id).status_code == 201
    assert textbook_material(quiz_generator.calls[0]) == []


def test_a_failing_textbook_search_is_an_error_when_the_textbook_is_all_there_is(client, chunks, quiz_generator, monkeypatch):
    course_id, section_id = make_course_and_section(client, with_material=False)
    attach(client, course_id, upload_book(client))
    monkeypatch.setattr(chunks, "search_in", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("quota")))

    response = create_quiz(client, section_id)

    assert response.status_code == 502 and "quota" in response.json()["detail"]
    assert quiz_generator.calls == []


def test_deleting_a_textbook_or_a_course_removes_the_links(client, app):
    course_id = make_course(client, with_material=False)
    other_course = make_course(client, with_material=False, name="Other")
    kept, dropped = upload_book(client), upload_book(client, "b.txt", b"Ribosomes make proteins. " * 30)
    for course in (course_id, other_course):
        attach(client, course, kept)
    attach(client, course_id, dropped)

    def links():
        with app.state.container.session_factory() as session:
            return {(link.course_id, link.textbook_id) for link in session.scalars(select(CourseTextbook))}

    assert client.delete(f"/api/textbooks/{dropped}").status_code == 204
    assert links() == {(course_id, kept), (other_course, kept)}
    assert client.delete(f"/api/courses/{course_id}").status_code == 204
    assert links() == {(other_course, kept)}


def chunk(textbook, index, text, page=None):
    metadata = {"textbook_id": textbook, "chunk_index": index, "filename": f"{textbook}.pdf"}
    if page is not None:
        metadata["page"] = page
    return Document(page_content=text, metadata=metadata)


def test_format_excerpts_dedupes_orders_and_labels():
    first_search = [chunk("a", 2, "two", page=5), chunk("b", 0, "b zero"), chunk("a", 1, "one", page=4)]
    second_search = [chunk("a", 1, "one", page=4), chunk("a", 3, "three", page=6)]

    excerpts = format_excerpts([first_search, second_search], max_chars=1000)

    assert excerpts == [
        ("a.pdf (textbook excerpts)", "[a.pdf, p.4]\none\n\n[a.pdf, p.5]\ntwo\n\n[a.pdf, p.6]\nthree"),
        ("b.pdf (textbook excerpts)", "[b.pdf]\nb zero"),
    ]


def test_format_excerpts_keeps_the_earlier_searches_when_the_budget_runs_out():
    about_the_section = [chunk("a", 0, "x" * 60)]
    about_a_mistake = [chunk("a", 1, "y" * 60), chunk("a", 2, "z" * 30)]

    ((_, text),) = format_excerpts([about_the_section, about_a_mistake], max_chars=100)

    assert "x" * 60 in text and "y" not in text and "z" * 30 in text  # the 60-char chunk did not fit, the 30 did


def test_format_excerpts_with_nothing_found_is_empty():
    assert format_excerpts([[], []], max_chars=100) == []
