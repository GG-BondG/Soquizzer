from tests.helpers import create_quiz, make_course_and_section, picks, submit


def ask(client, quiz, question_id, message="Can you help?", history=()):
    return client.post(
        f"/api/quizzes/{quiz['id']}/questions/{question_id}/chat",
        json={"message": message, "history": list(history)},
    )


def test_the_pet_answers_about_the_question_currently_on_screen(client, pet_tutor):
    _, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()
    question_id = quiz["questions"][0]["id"]

    response = ask(client, quiz, question_id, message="What should I look at first?")

    assert response.status_code == 200
    assert response.json() == {"reply": pet_tutor.reply_text}
    (call,) = pet_tutor.calls
    assert call["message"] == "What should I look at first?"
    assert call["question"].stem == quiz["questions"][0]["stem"]
    assert call["own_attempts"] == []


def test_the_frontends_transcript_is_forwarded_as_conversation_history(client, pet_tutor):
    _, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()
    question_id = quiz["questions"][0]["id"]

    ask(
        client,
        quiz,
        question_id,
        message="I still don't get it",
        history=[{"role": "student", "text": "hi"}, {"role": "pet", "text": "Think about X"}],
    )

    (call,) = pet_tutor.calls
    assert [(t.from_student, t.text) for t in call["history"]] == [(True, "hi"), (False, "Think about X")]


def test_earlier_attempts_at_this_exact_question_are_passed_as_own_history(client, pet_tutor):
    _, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()
    question_id = quiz["questions"][0]["id"]
    submit(client, quiz, only=[question_id])  # answers this one question wrong (picks() default)

    ask(client, quiz, question_id)

    (call,) = pet_tutor.calls
    assert len(call["own_attempts"]) == 1
    assert call["own_attempts"][0].is_correct is False


def test_section_wide_mistakes_and_accuracy_are_passed_for_broader_context(client, pet_tutor):
    _, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()
    submit(client, quiz)  # every question answered wrong by default

    ask(client, quiz, quiz["questions"][0]["id"])

    (call,) = pet_tutor.calls
    assert len(call["mistakes"]) == len(quiz["questions"])
    assert sum(a.total for a in call["accuracy"]) == len(quiz["questions"])


def test_chat_on_a_missing_quiz_is_404(client):
    response = client.post("/api/quizzes/nope/questions/nope/chat", json={"message": "hi", "history": []})
    assert response.status_code == 404


def test_chat_on_a_question_not_in_the_quiz_is_404(client):
    _, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()

    assert ask(client, quiz, "not-a-real-question-id").status_code == 404


def test_an_empty_message_is_rejected(client):
    _, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()

    assert ask(client, quiz, quiz["questions"][0]["id"], message="").status_code == 422


def test_gemini_failure_is_a_502(client, pet_tutor):
    from app.exception import LlmError

    _, section_id = make_course_and_section(client)
    quiz = create_quiz(client, section_id).json()
    pet_tutor.error = LlmError("Gemini request failed")

    assert ask(client, quiz, quiz["questions"][0]["id"]).status_code == 502
