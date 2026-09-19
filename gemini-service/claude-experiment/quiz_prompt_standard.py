"""
标准版提示词 / Standard prompt.

最简化的出题提示词：直接把 PDF 原文件喂给 Gemini，只要求"写N道选择题/判断题"，
不做逻辑主线覆盖、不做风格调味、不管干扰项质量。作为跟"引人入胜版"
(quiz_prompt_engaging.py) 对比质量的基线(baseline)。

跳过了 backend 现在的"PDF->JSON->出题"两步流程，直接一步到位：
PDF -> 出题。这是在验证"转JSON是不是出题必须的一步"时顺手做的发现——
转JSON那一步经常超时，直接传PDF反而更快更稳（详见跟用户的讨论）。

跑法 / Run:
    python claude-experiment/quiz_prompt_standard.py <path-to-pdf> [num_questions]
"""

import json
import os
import sys
import time
from enum import Enum
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel

import save_output

load_dotenv(Path(__file__).resolve().parent.parent / "fundamental" / ".env")

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview")

PROMPT_TEMPLATE = (
    "Write a study quiz from the attached course material. Write exactly {num_questions} questions, "
    "each MULTIPLE_CHOICE (4 options) or TRUE_FALSE (2 options)."
)


class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"
    TRUE_FALSE = "TRUE_FALSE"


class GeneratedQuestion(BaseModel):
    type: QuestionType
    stem: str
    options: list[str]
    answer_index: int
    explanation: str


class GeneratedQuiz(BaseModel):
    questions: list[GeneratedQuestion]


def generate_quiz(pdf_path: Path, num_questions: int = 10) -> GeneratedQuiz:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not found — check gemini-service/.env.")
    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Part.from_bytes(data=pdf_path.read_bytes(), mime_type="application/pdf"),
            PROMPT_TEMPLATE.format(num_questions=num_questions),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GeneratedQuiz,
        ),
    )
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, GeneratedQuiz):
        return parsed
    return GeneratedQuiz.model_validate_json(response.text)


def main() -> None:
    if len(sys.argv) < 2:
        print("用法 / Usage: python claude-experiment/quiz_prompt_standard.py <path-to-pdf> [num_questions]")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    num_questions = int(sys.argv[2]) if len(sys.argv) > 2 else 10

    start = time.time()
    quiz = generate_quiz(pdf_path, num_questions)
    elapsed = time.time() - start
    print(f"# {pdf_path.name}: {len(quiz.questions)} questions in {elapsed:.1f}s")
    print(json.dumps(quiz.model_dump(), ensure_ascii=False, indent=2))

    saved_path = save_output.save("standard", pdf_path.name, quiz.model_dump())
    print(f"# Saved to {saved_path}")


if __name__ == "__main__":
    main()
