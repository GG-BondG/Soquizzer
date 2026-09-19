from types import SimpleNamespace

import pytest

from app.config import Settings
from app.entity import QuestionType
from app.exception import ConfigurationError, LlmError
from app.llm import ChatTurn, GeminiPetTutor, OwnAttempt, PastMistake, QuestionContext, TypeAccuracy
from app.llm.pet_tutor import build_prompt


class StubClient:
    def __init__(self, text=None, error=None):
        self.models = self
        self.text = text
        self.error = error
        self.kwargs = None

    def generate_content(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return SimpleNamespace(text=self.text)


def tutor(client):
    return GeminiPetTutor(Settings(_env_file=None, generation_model="test-model"), client=client)


QUESTION = QuestionContext(
    type=QuestionType.MULTIPLE_CHOICE,
    stem="What makes ATP?",
    options=["Golgi", "Mitochondria"],
    answer_index=1,
    explanation="Mitochondria run cellular respiration.",
    anchor_section="1.2 Cells",
)
MISTAKE = PastMistake(stem="Q?", options=["a", "b"], answer_index=1, selected_index=0, explanation="E.", anchor_section="1.2 Cells")
ACCURACY = [TypeAccuracy(QuestionType.MULTIPLE_CHOICE, 5, 3), TypeAccuracy(QuestionType.TRUE_FALSE, 4, 1)]


def test_prompt_includes_the_question_but_tells_the_model_not_to_reveal_the_answer_unprompted():
    prompt = build_prompt(QUESTION, [], [], [], [], "What should I think about?")

    assert "What makes ATP?" in prompt
    assert "0) Golgi" in prompt and "1) Mitochondria" in prompt
    assert "Correct option: 1" in prompt
    assert "Do not say which option is correct" in prompt
    assert "Student: What should I think about?\nYou:" in prompt


def test_prompt_carries_the_students_own_attempts_at_this_exact_question():
    prompt = build_prompt(QUESTION, [OwnAttempt(0, False), OwnAttempt(1, True)], [], [], [], "hi")

    assert "picked option 0 (wrong)" in prompt
    assert "picked option 1 (correct)" in prompt


def test_prompt_carries_broader_section_progress():
    prompt = build_prompt(QUESTION, [], [MISTAKE], ACCURACY, [], "hi")

    assert "MULTIPLE_CHOICE 3/5 correct, TRUE_FALSE 1/4 correct" in prompt
    assert "Still-open trouble spots: 1.2 Cells" in prompt


def test_prompt_with_no_progress_omits_the_progress_section():
    prompt = build_prompt(QUESTION, [], [], [], [], "hi")

    assert "broader progress" not in prompt


def test_prompt_includes_the_conversation_transcript_in_order():
    history = [ChatTurn(from_student=True, text="I'm stuck"), ChatTurn(from_student=False, text="What do mitochondria do?")]
    prompt = build_prompt(QUESTION, [], [], [], history, "no idea")

    transcript = "Student: I'm stuck\nYou: What do mitochondria do?"
    assert transcript in prompt
    assert prompt.index(transcript) < prompt.index("Student: no idea\nYou:")


def test_language_setting_is_forwarded_like_the_quiz_generator():
    client = StubClient(text="Hint!")
    settings = Settings(_env_file=None, generation_model="test-model", quiz_language="Spanish")
    GeminiPetTutor(settings, client=client).reply(QUESTION, [], [], [], [], "hi")

    assert "in Spanish." in client.kwargs["contents"]


def test_replies_with_the_models_text():
    client = StubClient(text="  Think about what organelle makes energy.  ")

    assert tutor(client).reply(QUESTION, [], [MISTAKE], ACCURACY, [], "help") == "Think about what organelle makes energy."
    assert client.kwargs["model"] == "test-model"
    assert client.kwargs["contents"] == build_prompt(QUESTION, [], [MISTAKE], ACCURACY, [], "help", "English")


@pytest.mark.parametrize("client", [StubClient(text=""), StubClient(text=None), StubClient(error=RuntimeError("503 overloaded"))])
def test_empty_reply_or_api_error_raises_llm_error(client):
    with pytest.raises(LlmError):
        tutor(client).reply(QUESTION, [], [], [], [], "help")


def test_missing_api_key_is_a_configuration_error():
    with pytest.raises(ConfigurationError):
        GeminiPetTutor(Settings(_env_file=None, google_api_key=""))
