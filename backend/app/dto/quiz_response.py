import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator


class QuizResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    source_filename: str
    content: Any  # the JSON Gemini produced; its structure is decided by the model
    created_at: datetime

    @field_validator("content", mode="before")
    @classmethod
    def parse_stored_json(cls, value):
        return json.loads(value) if isinstance(value, str) else value
