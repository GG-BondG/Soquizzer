# Soquizzer
Soquizzer organizes your course content and generate quizzes to help enhance your understanding of the material.

## 快速开始 / Quick Start

本项目使用 Gemini API 作为 IO 模块（input/output module），负责接收 prompt
并生成文本内容（例如题目、答案）。目前仓库里只有一个最小可运行的调用示例，
后续的"课程材料解析"、"出题逻辑"等功能会在这个基础上继续搭建。

This project uses the Gemini API as its IO module (input/output module),
responsible for taking a prompt and generating text content (e.g. quiz
questions and answers). The repo currently contains only a minimal,
runnable call example — "parse course material", "generate questions",
etc. will be built on top of this foundation.

Gemini 模块单独放在 `gemini-service/` 目录下，前端在 `frontend/` 目录下
（在该目录里运行 `npm install`、`npm run dev` 或 `npm run desktop`）。/
The Gemini module lives in its own `gemini-service/` directory; the
frontend lives in `frontend/` (run `npm install`, `npm run dev` or
`npm run desktop` from inside it).

### 环境准备 / Setup

```bash
cd gemini-service

# 1. 安装依赖 / Install dependencies
pip install -r requirements.txt

# 2. 配置 API Key / Configure your API key
cp .env.example .env
# 然后编辑 .env，把 GEMINI_API_KEY 换成你自己在
# https://aistudio.google.com/apikey 申请的 key
# Then edit .env and replace GEMINI_API_KEY with your own key from
# https://aistudio.google.com/apikey

# 3. 跑一下最小示例 / Run the minimal example
python main.py
```

如果看到 Gemini 返回的文本，说明调用链路（call path）已经跑通。
If you see text returned from Gemini, the call path is working end to end.

### 目录结构 / Project Structure

```
Soquizzer/
├── backend/               # Java (Spring) 后端 / Java (Spring) backend
├── src/, index.html, ...  # 前端 (Vite) / frontend (Vite)
└── gemini-service/        # Gemini API IO 模块 / Gemini API IO module
    ├── main.py            # 最小烟雾测试脚本 / minimal smoke-test script
    ├── gemini_client.py   # Gemini API 最小封装 / minimal Gemini API wrapper
    ├── requirements.txt   # Python 依赖 / Python dependencies
    └── .env.example       # 环境变量模板 / env var template
```

**注意 / Note:** 千万不要把 `.env` 文件提交到 git 里，里面是你自己的私密
API Key。仓库的 `.gitignore` 已经把它排除掉了。
Never commit your `.env` file — it holds your private API key. It's
already excluded via `.gitignore`.
