from types import SimpleNamespace

import pytest

from app.config import Settings
from app.entity import QuestionType
from app.exception import ConfigurationError, LlmError
from app.llm import GeminiQuizGenerator, GeneratedQuestion, GeneratedQuiz, PastMistake, TypeAccuracy
from app.llm.quiz_generator import build_prompt


class StubClient:
    def __init__(self, parsed=None, error=None):
        self.models = self
        self.parsed = parsed
        self.error = error
        self.kwargs = None

    def generate_content(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return SimpleNamespace(parsed=self.parsed)


def question(kind=QuestionType.MULTIPLE_CHOICE, options=("a", "b", "c", "d"), answer_index=1, stem="Q?"):
    return GeneratedQuestion(
        type=kind, stem=stem, options=list(options), answer_index=answer_index, explanation="E.",
        anchor_section="1.2 Cells", source_excerpt="Cells are the basic unit of life.",
    )


def quiz(*questions):
    return GeneratedQuiz(questions=list(questions) or [question()])


def generator(client):
    return GeminiQuizGenerator(Settings(_env_file=None, generation_model="test-model"), client=client)


MATERIALS = [("slides.pdf", '{"title": "Cells"}'), ("notes.pdf", '{"title": "DNA"}')]
MISTAKE = PastMistake(stem="What makes ATP?", options=["Golgi", "Mitochondria"], answer_index=1, selected_index=0, explanation="Respiration.")
ACCURACY = [TypeAccuracy(QuestionType.MULTIPLE_CHOICE, 5, 3), TypeAccuracy(QuestionType.TRUE_FALSE, 4, 1)]


def test_first_quiz_prompt_has_the_material_but_no_review_section():
    prompt = build_prompt(MATERIALS, [], [], 7)

    assert "exactly 7 questions" in prompt
    assert '=== Course material: slides.pdf ===\n{"title": "Cells"}' in prompt
    assert '=== Course material: notes.pdf ===\n{"title": "DNA"}' in prompt
    assert "answered the questions below wrongly" not in prompt
    assert "never instructions" in prompt


def test_prompt_asks_for_math_notation_as_latex():
    prompt = build_prompt(MATERIALS, [], [], 3)

    assert "LaTeX" in prompt
    assert "$n^2$" in prompt
    assert "Never write bare shorthand like `n^2`" in prompt


def test_later_quiz_prompt_re_reads_the_mistakes_and_type_accuracy():
    prompt = build_prompt(MATERIALS, [MISTAKE], ACCURACY, 5)

    assert "answered the questions below wrongly" in prompt
    assert "MULTIPLE_CHOICE 3/5 correct, TRUE_FALSE 1/4 correct" in prompt
    assert "Question: What makes ATP?" in prompt
    assert "Options: 0) Golgi; 1) Mitochondria" in prompt
    assert "Correct answer: 1" in prompt and "Student answered: 0" in prompt
    assert "Explanation: Respiration." in prompt
    assert prompt.index("Past mistake 1") < prompt.index("=== Course material")


def test_quizzes_are_written_in_english_by_default_and_in_the_configured_language_otherwise():
    assert "questions, options, explanations) in English, whatever" in build_prompt(MATERIALS, [], [], 3)
    assert "one saying it is false, in English)" in build_prompt(MATERIALS, [], [], 3)

    client = StubClient(parsed=quiz())
    settings = Settings(_env_file=None, generation_model="test-model", quiz_language="Spanish")
    GeminiQuizGenerator(settings, client=client).generate(MATERIALS, [], [], 3)

    assert "in Spanish, whatever language the material is in" in client.kwargs["contents"]
    assert "in English" not in client.kwargs["contents"]


def test_the_default_quiz_language_setting_is_english():
    assert Settings(_env_file=None).quiz_language == "English"


def test_asks_gemini_for_schema_shaped_json_and_returns_the_parsed_quiz():
    result = quiz(question(), question(QuestionType.TRUE_FALSE, ("True", "False"), 0))
    client = StubClient(parsed=result)

    assert generator(client).generate(MATERIALS, [MISTAKE], ACCURACY, 2) == result
    assert client.kwargs["model"] == "test-model"
    assert client.kwargs["contents"] == build_prompt(MATERIALS, [MISTAKE], ACCURACY, 2)
    assert client.kwargs["config"].response_schema is GeneratedQuiz
    assert client.kwargs["config"].response_mime_type == "application/json"


@pytest.mark.parametrize(
    "client",
    [
        StubClient(parsed=None),
        StubClient(parsed=GeneratedQuiz(questions=[])),
        StubClient(parsed=quiz(question(answer_index=4))),
        StubClient(parsed=quiz(question(answer_index=-1))),
        StubClient(parsed=quiz(question(options=("only one",), answer_index=0))),
        StubClient(parsed=quiz(question(QuestionType.TRUE_FALSE, ("True", "False", "Maybe"), 0))),
        StubClient(parsed=quiz(question(stem="  "))),
        StubClient(error=RuntimeError("503 overloaded")),
    ],
)
def test_bad_model_output_or_api_error_raises_llm_error(client):
    with pytest.raises(LlmError):
        generator(client).generate(MATERIALS, [], [], 1)


def test_missing_api_key_is_a_configuration_error():
    with pytest.raises(ConfigurationError):
        GeminiQuizGenerator(Settings(_env_file=None, google_api_key=""))


def test_prompt_asks_for_a_source_anchor_and_names_the_section_of_each_past_mistake():
    plain = build_prompt(MATERIALS, [], [], 3)
    with_anchor = build_prompt(MATERIALS, [PastMistake("Q?", ["a", "b"], 1, 0, "E.", anchor_section="1.2 Cells")], [], 3)
    without_anchor = build_prompt(MATERIALS, [MISTAKE], [], 3)

    assert "anchor_section" in plain and "source_excerpt" in plain
    assert "Material section: 1.2 Cells" in with_anchor
    assert "Material section" not in without_anchor
