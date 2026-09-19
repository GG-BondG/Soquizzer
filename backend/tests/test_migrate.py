from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session

from app.entity import Base, Course, Question, QuestionType, Quiz, Section, Subject, add_missing_columns


def test_columns_added_to_an_older_database_are_created_with_their_defaults(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        course = Course(name="Bio", subject=Subject.BIOLOGY)
        section = Section(name="Ch 1", course=course)
        question = Question(
            position=1, type=QuestionType.TRUE_FALSE, stem="Old question?", options=["True", "False"],
            answer_index=0, explanation="Because.",
        )
        session.add_all([course, section, Quiz(section=section, questions=[question])])
        session.commit()
    with engine.begin() as connection:  # simulate a database made before the source columns existed
        connection.execute(text("ALTER TABLE questions DROP COLUMN anchor_section"))
        connection.execute(text("ALTER TABLE questions DROP COLUMN source_excerpt"))

    add_missing_columns(engine)
    add_missing_columns(engine)  # a second run changes nothing

    columns = {column["name"] for column in inspect(engine).get_columns("questions")}
    assert {"anchor_section", "source_excerpt"} <= columns
    with engine.connect() as connection:
        row = connection.execute(text("SELECT anchor_section, source_excerpt FROM questions")).one()
    assert tuple(row) == ("", "")
    with Session(engine) as session:
        assert session.scalars(select(Question)).one().stem == "Old question?"


def test_a_fresh_database_needs_no_changes(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'new.db'}")
    Base.metadata.create_all(engine)

    add_missing_columns(engine)

    assert "anchor_section" in {column["name"] for column in inspect(engine).get_columns("questions")}
