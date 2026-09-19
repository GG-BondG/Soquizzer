"""
最小烟雾测试脚本 / Minimal smoke-test script.

跑一下这个脚本，确认 Gemini API 调用链路是通的：
Run this script to confirm the Gemini API call path works end to end:

    python main.py
"""

from src.gemini_client import generate_text


def main() -> None:
    prompt = "用一句话解释什么是长轮询（long polling）。"
    print(f"Prompt: {prompt}\n")

    answer = generate_text(prompt)
    print("Gemini says:")
    print(answer)


if __name__ == "__main__":
    main()
