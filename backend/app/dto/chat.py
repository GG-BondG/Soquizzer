from typing import Literal

from pydantic import BaseModel, Field


class ChatTurnInput(BaseModel):
    role: Literal["student", "pet"]
    text: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    # The frontend resends the transcript each turn; nothing is stored server-side between requests.
    history: list[ChatTurnInput] = Field(default_factory=list, max_length=40)


class ChatResponse(BaseModel):
    reply: str
