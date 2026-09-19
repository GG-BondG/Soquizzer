import json
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.dto.quiz_content import QuizContent


class QuizResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    source_filename: str
    content: QuizContent
    created_at: datetime

    @field_validator("content", mode="before")
    @classmethod
    def parse_stored_json(cls, value):
        return json.loads(value) if isinstance(value, str) else value
