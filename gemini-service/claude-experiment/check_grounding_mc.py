import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
from quiz_prompt_experiment_mc import SYSTEM_INSTRUCTION, TASK_INSTRUCTION, GeneratedQuiz

load_dotenv(Path(__file__).resolve().parent.parent / "fundamental" / ".env")
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
model = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview")
pdf_path = Path(r"D:\Download\READINGs\complete-induction-I.pdf")

response = client.models.generate_content(
    model=model,
    contents=[types.Part.from_bytes(data=pdf_path.read_bytes(), mime_type="application/pdf"), TASK_INSTRUCTION],
    config=types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        tools=[types.Tool(google_search=types.GoogleSearch())],
        response_mime_type="application/json",
        response_schema=GeneratedQuiz,
    ),
)
gm = response.candidates[0].grounding_metadata
print("web_search_queries:", gm.web_search_queries if gm else None)
