from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.entity import Subject


class CourseCreateRequest(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    subject: Subject
