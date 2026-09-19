from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    name: str
    created_at: datetime
