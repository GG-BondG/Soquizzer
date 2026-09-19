"""临时调试脚本：确认 google_search 工具真的发起了搜索，而不是没生效。"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

from quiz_prompt_experiment_seasoning import SYSTEM_INSTRUCTION, TASK_INSTRUCTION, SeasoningQuiz

load_dotenv(Path(__file__).resolve().parent.parent / "fundamental" / ".env")

api_key = os.getenv("GEMINI_API_KEY")
model = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview")
client = genai.Client(api_key=api_key)

pdf_path = Path(sys.argv[1])
response = client.models.generate_content(
    model=model,
    contents=[
        types.Part.from_bytes(data=pdf_path.read_bytes(), mime_type="application/pdf"),
        TASK_INSTRUCTION,
    ],
    config=types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        tools=[types.Tool(google_search=types.GoogleSearch())],
        response_mime_type="application/json",
        response_schema=SeasoningQuiz,
    ),
)

gm = response.candidates[0].grounding_metadata
print("web_search_queries:", gm.web_search_queries if gm else None)
if gm and gm.grounding_chunks:
    for chunk in gm.grounding_chunks:
        if chunk.web:
            print("source:", chunk.web.title, "-", chunk.web.uri)
