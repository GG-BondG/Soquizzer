from dataclasses import dataclass

from app.ports import PastMistake, TypeAccuracy
from app.repository import AnswerRepository


@dataclass(frozen=True)
class SectionProfile:
    """What the student's earlier answers in one section say about them: the mistakes still open and how they do
    on each question type. Handed to the quiz writer and to the pet tutor."""

    mistakes: list[PastMistake]
    accuracy: list[TypeAccuracy]


def load_section_profile(answers: AnswerRepository, section_id: str, mistake_limit: int) -> SectionProfile:
    return SectionProfile(
        mistakes=[
            PastMistake(q.stem, q.options, q.answer_index, a.selected_index, q.explanation, q.anchor_section)
            for q, a in answers.still_wrong(mistake_limit, section_id=section_id)
        ],
        accuracy=[
            TypeAccuracy(kind, total, correct) for kind, total, correct in answers.stats_by_type(section_id=section_id)
        ],
    )
