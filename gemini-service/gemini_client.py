"""
Gemini API 最小封装模块 / Minimal Gemini API wrapper module.

这是整个项目的 IO 模块(input/output module)的基础：负责把一段文本 prompt
发送给 Gemini 模型，并拿回生成的文本结果。后面做"课程材料 -> 生成题目"
的功能时，只需要在这一层之上组装更复杂的 prompt 即可，不需要改这里的
底层调用逻辑。

This is the base of the project's IO module: it sends a text prompt to
the Gemini model and returns the generated text. When we later build the
"course material -> quiz generation" feature, we can build more complex
prompts on top of this layer without touching the low-level call logic
here.
"""

import os

from dotenv import load_dotenv
from google import genai

# 加载 .env 文件里的环境变量（比如 GEMINI_API_KEY）
# Load environment variables (e.g. GEMINI_API_KEY) from a local .env file.
load_dotenv()

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

_client: genai.Client | None = None


def get_client() -> genai.Client:
    """
    获取（并缓存）Gemini 客户端 / Get (and cache) the Gemini client.

    API Key 从环境变量 GEMINI_API_KEY 读取，不要把 Key 直接写死在代码里。
    The API key is read from the GEMINI_API_KEY environment variable —
    never hard-code the key in source code.
    """
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "没有找到 GEMINI_API_KEY，请复制 .env.example 为 .env 并填入你的 API Key。\n"
                "GEMINI_API_KEY not found. Copy .env.example to .env and fill in your API key."
            )
        _client = genai.Client(api_key=api_key)
    return _client


def generate_text(prompt: str, model: str = DEFAULT_MODEL) -> str:
    """
    最小可用的调用：传入一个 prompt 字符串，返回 Gemini 生成的文本。
    Minimal usable call: pass in a prompt string, get back Gemini's
    generated text.
    """
    client = get_client()
    response = client.models.generate_content(
        model=model,
        contents=prompt,
    )
    return response.text
