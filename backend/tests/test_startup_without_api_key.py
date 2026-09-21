from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.helpers import create_quiz, make_course_and_section


def test_the_app_starts_without_an_api_key_and_only_the_gemini_features_fail(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path / "data", google_api_key="")
    client = TestClient(create_app(settings))  # real adapters, no key

    _, section_id = make_course_and_section(client)  # courses, sections and PDF upload (local text layer) still work

    response = create_quiz(client, section_id)
    assert response.status_code == 500
    assert response.json() == {"detail": "GEMINI_API_KEY is not set"}
