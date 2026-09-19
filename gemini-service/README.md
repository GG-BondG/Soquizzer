# gemini-service

Gemini API 出题提示词的实验区，不参与后端运行。产出的好提示词会手动移植进
`backend/app/llm/quiz_generator.py`。

Experiment area for Gemini quiz-prompt engineering. The backend does not
depend on this folder; validated prompts get manually ported into
`backend/app/llm/quiz_generator.py`.

## 目录结构 / Layout

```
gemini-service/
├── fundamental/        最小可运行 demo / minimal runnable demo
│   ├── main.py             最小烟雾测试脚本 / smoke-test script
│   ├── gemini_client.py    Gemini API 最小封装 / minimal API wrapper
│   ├── requirements.txt
│   └── .env.example        环境变量模板 / env var template
├── claude-experiment/  Claude 的出题提示词实验 / Claude's prompt experiments
├── codex-experiment/   Codex 的出题提示词实验 / Codex's prompt experiments
└── outputs/            历次生成结果存档 / archived generated quiz outputs
```

## 环境准备 / Setup

```bash
cd gemini-service/fundamental
pip install -r requirements.txt
cp .env.example .env      # 填入 GEMINI_API_KEY / fill in GEMINI_API_KEY
python main.py            # 跑一下最小示例，确认调用链路通了 / smoke test
```

`claude-experiment/` 和 `codex-experiment/` 下的脚本都从各自目录往上找
`../fundamental/.env`，只需要配置这一份 `.env`，不用每个实验目录都建一份。/
Scripts in `claude-experiment/` and `codex-experiment/` both look for
`../fundamental/.env` — configure that one file, no need to duplicate it per
experiment folder.

跑实验脚本前，先给对应目录装依赖（额外需要 `pydantic`，通常作为
`google-genai` 的依赖已经装好了）：

```bash
cd gemini-service
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r fundamental/requirements.txt

python claude-experiment/quiz_prompt_engaging.py <path-to-pdf> [num_questions]
```

## `outputs/` 命名规则 / Naming convention

`<序号>_<脚本名>_<材料名>.json`，序号从 00 开始，按 `outputs/` 里已有文件
数量自动递增（`claude-experiment/save_output.py` 的 `save()` 函数负责），
表示这是第几次生成的 quiz，不用时间戳，一眼能看出先后顺序。

`<seq>_<script>_<material>.json`, sequence starting at 00 and auto-incrementing
based on how many files already exist in `outputs/` (handled by
`claude-experiment/save_output.py`'s `save()`). Indicates generation order
without needing a timestamp.

以后任何实验脚本生成 quiz，都应该调用 `save_output.save(script_name, pdf_name, data)`
把结果存进这里，不要只打印到终端。/ Any future experiment script that
generates a quiz should call `save_output.save(script_name, pdf_name, data)`
to persist the result here, instead of only printing it to the console.
