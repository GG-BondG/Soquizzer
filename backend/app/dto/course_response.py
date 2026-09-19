from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.entity import Subject


class CourseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    subject: Subject
    created_at: datetime
