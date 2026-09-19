# Soquizzer
Soquizzer organizes your course content and generate quizzes to help enhance your understanding of the material.

## 一键启动 / One-Click Start

```bash
./start.sh
```

就这一条。它会同时启动后端（FastAPI，`localhost:8000`）和桌面应用（Electron）。
That's it. It starts the backend (FastAPI, `localhost:8000`) and the desktop app (Electron) together.

**前提 / Prerequisites:** Python 3.11+、Node.js 20.19+（或 22.12+）、一个
[Gemini API Key](https://aistudio.google.com/apikey)。/ Python 3.11+, Node.js 20.19+ (or 22.12+), and a
[Gemini API key](https://aistudio.google.com/apikey).

- **第一次运行 / First run:** 脚本会自动建 Python 虚拟环境、装后端和前端依赖、下载 Live2D 素材，
  并提示你粘贴 `GEMINI_API_KEY`（写入 `backend/.env`，不会提交到 git）。第一次比较慢，之后几秒就能启动。
  The script creates the Python venv, installs backend and frontend dependencies, downloads the Live2D
  files, and asks you to paste your `GEMINI_API_KEY` (saved to `backend/.env`, never committed). The first
  run is slow; later runs start in seconds.
- **只想用浏览器 / Browser only:** `./start.sh --web`，然后打开 http://localhost:5173。/ then open http://localhost:5173.
- **退出 / Quit:** 在终端按 `Ctrl+C`，前后端会一起关掉。/ Press `Ctrl+C` in the terminal; both stop together.
- **后端日志 / Backend log:** `backend/backend.log`
- **提示端口被占用 / "Port already in use":** 8000 或 5173 已被别的程序占用（比如上一次没关的开发服务器），先关掉它再运行。/
  something (e.g. an earlier dev server) already holds 8000 or 5173 — stop it and rerun.

脚本适用于 macOS / Linux；Windows 请用 WSL 或参考 [`backend/README.md`](backend/README.md) 和 `frontend/` 手动启动。/
The script targets macOS / Linux; on Windows use WSL, or start things by hand per
[`backend/README.md`](backend/README.md) and `frontend/`.

## Gemini 最小示例 / Gemini Minimal Example

本项目使用 Gemini API 作为 IO 模块（input/output module），负责接收 prompt
并生成文本内容（例如题目、答案）。`gemini-service/` 是一个独立的最小可运行调用示例
（烟雾测试）；课程材料解析、出题等正式功能已经在 `backend/` 里直接调用 Gemini 实现。

This project uses the Gemini API as its IO module (input/output module),
responsible for taking a prompt and generating text content (e.g. quiz
questions and answers). `gemini-service/` is a standalone minimal, runnable
call example (a smoke test); the real features — parsing course material and
generating quizzes — already live in `backend/` and call Gemini directly.

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
├── start.sh               # 一键启动 / one-click launcher
├── backend/               # FastAPI 后端 (Python) / FastAPI backend (Python)
├── frontend/              # 前端 (Vite + React + Electron) / frontend (Vite + React + Electron)
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
