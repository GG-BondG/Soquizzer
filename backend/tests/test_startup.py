import pytest

from app.config import Settings
from app.exception import ConfigurationError
from app.main import create_app


def test_the_app_refuses_to_start_without_an_api_key(tmp_path):
    with pytest.raises(ConfigurationError, match="GEMINI_API_KEY"):
        create_app(Settings(_env_file=None, data_dir=tmp_path / "data", google_api_key=""))


def test_no_key_is_needed_when_nothing_uses_gemini(tmp_path, converter, quiz_generator, ocr, pet_tutor):
    create_app(Settings(_env_file=None, data_dir=tmp_path / "data", google_api_key=""), converter, quiz_generator, ocr, pet_tutor)
