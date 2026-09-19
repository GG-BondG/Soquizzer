# Gemini API Usage & Memory Management Report

*Soquizzer backend — three independent Gemini API integrations, and how the app manages "memory" around them.*

---

## English

### Overview

Soquizzer calls the Gemini API directly through the native `google-genai` Python SDK — no LangChain or other
agent framework is in the dependency list or the request path at all. There are exactly **three** independent
call sites, each a thin class in `backend/app/llm/` or `backend/app/rag/` that wraps one `genai.Client` and one
prompt. All three build their client the same way — API key + model name from `Settings`, with a configurable
request timeout — but serve three different purposes.

| # | File | Class | Purpose | Output |
|---|---|---|---|---|
| 1 | `backend/app/llm/quiz_generator.py` | `GeminiQuizGenerator` | Write a quiz from course material | Schema-constrained JSON |
| 2 | `backend/app/llm/pet_tutor.py` | `GeminiPetTutor` | Answer a student's question about the item on screen | Plain text |
| 3 | `backend/app/rag/ocr.py` | `GeminiPageOcr` | Transcribe a scanned (image-only) PDF | Schema-constrained JSON |

### 1. Quiz generation

`GeminiQuizGenerator.generate()` is called once per "create quiz" request. Its prompt combines:

- the section's course material (as JSON, produced from the uploaded PDF);
- this student's still-open mistakes in the section (`PastMistake`: the question, the correct option, what the
  student picked, and the explanation);
- their accuracy so far, broken down by question type (`TypeAccuracy`);
- the stems of questions already asked in earlier quizzes of the section, so the next quiz doesn't repeat itself.

The response is constrained to a Pydantic schema (`GeneratedQuiz`), so Gemini returns exactly the fields the app
needs — type, stem, options, the 0-based correct index, an explanation, and a pointer back into the source
material (`anchor_section` / `source_excerpt`) used to send a wrong answer back to the right page.

Notable prompt-design choices:
- an explicit menu of "engaging" framings (celebrity quotes, well-known memes, historical failures caused by the
  concept, cross-discipline analogies, ...) mixed into roughly half the questions, with an explicit instruction not
  to use the fact-dependent styles (celebrity quotes, historical incidents) unless the model is "genuinely
  confident" they're real — a deliberate guard against confidently-invented trivia;
- when there are open mistakes, a review section is appended asking the model to *diagnose* the likely
  misconception (not just re-ask the same question) and target new questions at it;
- a line added after noticing generated quizzes rendered as literal `n^2` instead of typeset math: questions must
  write any math notation as LaTeX (`$...$` / `$$...$$`), matching a frontend `MathText` component added later.

### 2. Pet tutor chat

The newest of the three: a Live2D "pet" character stands next to the quiz, and a student can click it while a
question is still unsubmitted to ask for help — `POST /api/quizzes/{quiz_id}/questions/{question_id}/chat`.

Each call rebuilds context fresh from the database:
- the question itself, **including its own answer index and explanation** — the model has the ground truth to
  reason with, it is not withheld;
- this student's own past attempts at that *exact* question (from earlier tries at the same quiz), reusing the
  `OwnAttempt` shape;
- the same section-wide `PastMistake` / `TypeAccuracy` the quiz generator uses, for broader personalization;
- the conversation so far, sent by the frontend as a plain `history` array — nothing is stored server-side.

The tutoring policy was a deliberate product decision made explicit before implementation: **Socratic by
default**. The system prompt tells the model to hint rather than state the answer, and only reveal which option is
correct once the student explicitly insists, says they give up, or has already picked that option themselves
earlier in the conversation. This is enforced purely through instructions to a model that always has the answer —
not by keeping the model in the dark — which keeps the same context useful for both "give a hint" and "confirm
you're right" without a second code path.

### 3. Scanned-PDF OCR

A fallback, not a primary path: uploaded PDFs are read locally first (`pypdf`); only pages with no usable text
layer (scans/photos) are sent to Gemini. The PDF bytes go in directly as a `Part.from_bytes(...,
mime_type="application/pdf")` — a multimodal call, not a text prompt — batched (10 pages per request by default)
and recursively split in half if a batch is too large for one request. The response schema is a flat list of
per-page strings; batches are independent, with no memory or context carried between them.

### Memory management, across all three

There is no Gemini-native memory or session (no persistent thread/assistant object, no context caching keyed to a
conversation id). All memory is:

1. **Persisted in the app's own SQLite database.** `Question`, `Answer` and `Attempt` are the single source of
   truth for what a student has seen and gotten right or wrong — Gemini never remembers a student between calls;
   the app does.
2. **Recomputed fresh on every call** from that database, through two small, shared repository queries
   (`AnswerRepository.still_wrong`, `.stats_by_type`, `.history_for_question`) reshaped into the same plain
   dataclasses (`PastMistake`, `TypeAccuracy`, `OwnAttempt`) that both the quiz generator and the pet tutor consume
   — one "memory" representation, two prompts.
3. **For the chat feature specifically, short-term conversational memory lives in the browser, not the server.**
   The frontend keeps the transcript in React state and resends it whole on every turn; the backend keeps nothing
   between requests. Long-term memory (what has this student struggled with, over every attempt) stays
   database-backed and durable; short-term memory (what did we just say to each other, in this one sitting) is
   client-supplied and disposable. This was a deliberate simplicity tradeoff over either persisting every chat
   message to the database (unnecessary durability for a scratch conversation) or reaching for Gemini's own
   session/caching primitives (more moving parts than the project's timeline called for).

One consequence of this split: restarting the backend loses no learner-facing state at all — it's all in SQLite.
Refreshing the browser mid-chat loses that one conversation's transcript, which is fine, since the transcript
itself was never the record of the student's progress; the underlying `Answer`/`Attempt` rows already are.

---

## 中文

### 概览

Soquizzer 后端直接通过官方的 `google-genai` Python SDK 调用 Gemini API，依赖列表和实际请求路径里都完全没有接入
LangChain 之类的 agent 框架。代码里一共只有**三处**独立的调用点，每一处都是 `backend/app/llm/` 或 `backend/app/rag/` 下的一个小类，包一个
`genai.Client` 加一个 prompt。三处构造 client 的方式完全一样——从 `Settings` 里取 API key、模型名、超时时间——但各自
承担不同的职责。

| # | 文件 | 类 | 作用 | 输出 |
|---|---|---|---|---|
| 1 | `backend/app/llm/quiz_generator.py` | `GeminiQuizGenerator` | 根据课程材料出题 | 受 schema 约束的 JSON |
| 2 | `backend/app/llm/pet_tutor.py` | `GeminiPetTutor` | 回答学生对当前题目的提问 | 纯文本 |
| 3 | `backend/app/rag/ocr.py` | `GeminiPageOcr` | 转录扫描版（图片型）PDF | 受 schema 约束的 JSON |

### 一、出题（Quiz generation）

`GeminiQuizGenerator.generate()` 在每次"生成新一轮 quiz"的请求里被调用一次。它的 prompt 由这几部分拼起来：

- 这个 section 的课程材料（从上传的 PDF 转成的 JSON）；
- 这个学生在这个 section 里还没搞懂的错题(`PastMistake`)：题干、正确选项、学生当时选了什么、以及解析；
- 学生目前按题型分类的正确率(`TypeAccuracy`)；
- 这个 section 前几轮 quiz 已经问过的题干，避免新一轮重复出题。

返回结果被限定成一个 Pydantic schema(`GeneratedQuiz`)，这样 Gemini 只会返回 app 真正需要的字段——题型、题干、选项、
从 0 开始的正确答案下标、解析，以及指回原材料的位置(`anchor_section` / `source_excerpt`)，答错时可以把学生指回材料
里该看的那一段。

几个值得一提的 prompt 设计取舍：
- 明确列了一份"有趣化"的出题风格菜单(名人名言、经典 meme、因为搞错这个概念而出的历史事故、跨学科类比……)，混进大约
  一半的题目里；同时明确要求，涉及事实的风格(名人名言、历史事件)只有在模型"真的确定"是真实且广为人知的情况下才能用
  ——这是刻意防止模型自信地编造"冷知识"；
- 当学生有还没搞懂的错题时，会额外拼一段"复习"指令，要求模型先**诊断**学生大概率的误解点(而不是简单地把原题再问一
  遍)，让新题目针对性地打这个点；
- 后来发现生成出来的题目里数学符号是字面的 `n^2` 而不是排版好的数学公式，于是加了一条：数学符号一律写成 LaTeX
  (`$...$` / `$$...$$`)，这条指令和后来加的前端 `MathText` 渲染组件是配套的。

### 二、女生/宠物答疑聊天(Pet tutor chat)

三处里最新加的一个：答题界面旁边站着一个 Live2D "宠物"角色，学生在还没提交当前题目之前可以点她提问求助——对应接口
`POST /api/quizzes/{quiz_id}/questions/{question_id}/chat`。

每次调用都是从数据库里重新、完整地拼一遍上下文，而不是维护一个持续的会话：
- 当前这道题本身，**包括正确答案下标和解析**——模型是拿着标准答案去推理的，并没有对它隐瞒;
- 这个学生在**这道题上**自己的历史作答记录(同一份 quiz 更早几次尝试留下的),复用了 `OwnAttempt` 这个结构;
- 和出题功能共用的、整个 section 范围的 `PastMistake` / `TypeAccuracy`，用来让回答更贴合这个学生的整体情况；
- 到目前为止的对话记录，由前端作为 `history` 数组整体传过来——服务端不落库、不保留任何东西。

答疑的尺度是在动手写代码之前就明确定下来的一个产品决定：**默认走苏格拉底式引导**。system prompt 明确要求模型优先给
提示、引导学生自己想明白，只有在学生明确表示"直接告诉我答案"、"我放弃了"，或者学生自己在对话里已经选过那个选项时，
才可以直接说出正确选项。这套规则完全靠"指令"来约束一个本来就拿着答案的模型，而不是不让模型看到答案——好处是"给提示"
和"确认你选对了"可以用同一份上下文，不需要另外写一套逻辑。

### 三、扫描版 PDF 的 OCR

这是一条兜底路径，不是主路径：上传的 PDF 会先用 `pypdf` 在本地抽文字，只有那些没有可用文字层的页面(扫描件/拍照件)
才会被送去给 Gemini。PDF 的原始字节直接作为 `Part.from_bytes(..., mime_type="application/pdf")` 传过去——这是一次
多模态调用，不是纯文本 prompt——按批次发送(默认每批 10 页)，如果某一批太大超出单次请求限制，就递归对半拆分。返回
的 schema 是一个按页排列的字符串列表；各批次之间彼此独立，不携带任何记忆或上下文。

### 三处共通的"记忆管理"

Gemini 本身没有提供任何原生的记忆/会话机制(没有持久化的 thread/assistant 对象，也没有按会话 id 做 context
caching)。所有的"记忆"其实都是：

1. **落在 app 自己的 SQLite 数据库里。** `Question`、`Answer`、`Attempt` 这几张表才是"这个学生看过什么题、哪些做对
   了哪些做错了"的唯一真相来源——Gemini 从来不会在两次调用之间自己记住某个学生，是 app 在记。
2. **每次调用都从数据库里现算一遍**，通过两个很小的、共用的 repository 查询(`AnswerRepository.still_wrong`、
   `.stats_by_type`、`.history_for_question`)，整理成同一套 dataclass(`PastMistake`、`TypeAccuracy`、
   `OwnAttempt`)，出题功能和答疑聊天功能各自拿去拼自己的 prompt——一套"记忆"的表示，两处消费。
3. **聊天功能里，短期的对话记忆是放在浏览器里的，不是服务端。** 前端把对话记录存在 React 的 state 里，每一轮都整份
   重新发过去；后端两次请求之间什么都不留。长期记忆(这个学生一直以来卡在哪)持久化在数据库里、可靠且长期有效；短期
   记忆(这一次聊天里刚刚说了什么)由前端提供、用完即扔。这是一个刻意做的简化取舍——比起把每一条聊天消息都存进数据库
   (对一次随手的对话来说没必要这么"耐久")，或者直接用 Gemini 自己的会话/缓存机制(对一个黑客松的时间线来说环节太多
   了)，这个方案更轻。

这个拆分带来一个直接的好处：后端重启完全不会丢失任何"学生学习进度"相关的状态——因为那些都在 SQLite 里；但刷新一下
浏览器会丢掉正在进行的这一次聊天记录，这没关系，因为这份聊天记录本来就不是学生进度的记录，真正的记录是底层的
`Answer`/`Attempt` 数据。
