# Quiz 提示词版本命名与迭代报告 / Quiz Prompt Versioning & Iteration Report

## 命名规则 / Naming convention

给所有做过的出题提示词版本统一编号，避免以后口头讨论对不上是哪一版。
Claude 这边用 `V` 编号，Codex 那边用 `C` 编号，跟目录结构（`claude-experiment/`
`codex-experiment/`）对应；编号按每条线各自的时间顺序递增，数字越大代表越
新、通常也代表在那条线上验证过更好的效果（但不代表新版本一定完全取代旧
版本——见下面"现状"一节）。

Every quiz-prompt version we've built gets one label, so we stop losing track
of which one we mean in conversation. Claude's line uses `V`, Codex's line
uses `C`, matching the `claude-experiment/` / `codex-experiment/` folders.
Numbers increase in chronological order within each line; a higher number is
newer and usually better-validated on that line, but does not automatically
mean it replaces every earlier one in production — see **Current status**
below.

`gemini-service/` 里的所有出题提示词实验都遵循这个规则：产出结果存进
`outputs/<序号>_<脚本名>_<材料名>.json`（见 `gemini-service/README.md`），
提示词本身的版本号记录在这份文件里。/ Every quiz-prompt experiment under
`gemini-service/` follows this scheme: generated results are saved as
`outputs/<seq>_<script>_<material>.json` (see `gemini-service/README.md`),
and the prompt version itself is tracked here.

## Claude 版本线 / Claude's version line

| 版本 Version | 名字 Name | 文件 File | 格式 Format | 说明 Notes |
|---|---|---|---|---|
| **V1** | 结构衔接题·原始版 / Structural checkpoint (original) | 设计保留在 `docs/quiz-generator-design.md`（原文件被 Codex 覆盖）/ design preserved in `docs/quiz-generator-design.md` (original file was overwritten by Codex) | 开放问答 / open Q&A (prompt/answer/hint_on_wrong) | 只做"结构衔接题"三个子类型：predict_next / why_generalize / restate_concept，按 reading 逻辑主线逐节出题 / three sub-types only, anchored to the reading's own logical flow |
| **V2** | 调味题·7类版 / Seasoning, 7 categories | `claude-experiment/quiz_prompt_experiment_seasoning.py` | 开放问答 / open Q&A (hook/prompt/answer/hint_on_wrong) | 名言/梗/预告/反直觉/历史事故/类比/情景 7 类；celebrity_quote 和 historical_failure 要求实际调用 Google 搜索核实 / 7 styles; celebrity_quote and historical_failure require an actual Google Search call to verify |
| **V3** | 合并·选择题版 / Merged, multiple-choice | `claude-experiment/quiz_prompt_experiment_mc.py` | MULTIPLE_CHOICE/TRUE_FALSE | V1+V2 内容合并，输出格式对齐后端；风格描述压缩成一段话；带搜索工具 / V1+V2 merged, output aligned to the backend schema; styles compressed into one paragraph; search tool attached |
| **V4** | 生产·压缩版（曾经）/ Production, compressed (formerly live) | `backend/app/llm/quiz_generator.py`（V6 之前的版本，见下）/ (superseded by V6 below) | MULTIPLE_CHOICE/TRUE_FALSE | 从 V3 精简、去掉搜索工具；同学后续加了 `anchor_section`/`source_excerpt`（原文定位）、`earlier_stems`（避免重复出题）、`language`（多语言）三个字段 / trimmed from V3, search tool dropped; a teammate later added `anchor_section`/`source_excerpt` (locate back to the material), `earlier_stems` (avoid repeats) and `language` (i18n) |
| **V5** | 引人入胜·详细修复版 / Engaging, detailed + fixed | `claude-experiment/quiz_prompt_engaging.py` | MULTIPLE_CHOICE/TRUE_FALSE | 7 种风格各配真实例子（Dijkstra/Deutsch 名言，Drake/Expanding Brain 梗图等），风格覆盖比 V4 更稳定（4+种 vs 常见 1-2 种）；修了 V4 没管的 TRUE_FALSE 泄题问题 / each style gets a real named example; noticeably more style variety than V4 in testing; fixes the TRUE_FALSE leak V4 didn't address |
| **V6** ⭐当前生产版 / current production | 最佳风趣版 / Best-humor edition | `backend/app/llm/quiz_generator.py` 的 `INSTRUCTIONS` | MULTIPLE_CHOICE/TRUE_FALSE | **V5 的详细风格例子 + TRUE_FALSE 修复，合并 V4 独有的 `anchor_section`/`source_excerpt`/`earlier_stems`/`language`，再把风趣题比例从"约三分之一"提到"至少一半"**（全员一致认为风趣幽默效果最好）；`_check_quiz` 新增代码层校验：TRUE_FALSE 选项超过20字符直接判失败，不只靠提示词自觉。真实集成测试（CSC236 Complete Induction）里两轮各10题，风趣题占比过半，用到了真实的 Dijkstra 名言、2006年二分查找溢出bug、Drake/Galaxy Brain梗图。/ **V5's detailed style examples + TRUE_FALSE fix, merged with V4's unique `anchor_section`/`source_excerpt`/`earlier_stems`/`language`, plus raising the witty-question ratio from "about a third" to "at least half"** (unanimous team call that humor works best). Added a code-level check in `_check_quiz`: a TRUE_FALSE option over 20 characters fails outright, not just a prompt-level ask. A real integration test (CSC236 Complete Induction) produced two 10-question rounds where over half the questions were flavored, correctly using a real Dijkstra quote, the real 2006 binary-search overflow bug, and the Drake / Galaxy Brain meme formats. |

## Codex 版本线 / Codex's version line

| 版本 Version | 名字 Name | 文件 File | 格式 Format | 说明 Notes |
|---|---|---|---|---|
| **C1** | 结构衔接题·Codex版 / Structural checkpoint (Codex) | `codex-experiment/quiz_prompt_experiment_codex.py`（`quiz_prompt_experiment.py` 是同一份内容 / identical content) | 开放问答 / open Q&A | 跟 V1 几乎一样的设计，Codex 独立实现的版本 / near-identical design to V1, implemented independently |
| **C2** | 组件化·hook pack版 / Componentized, hook-pack | `codex-experiment/quiz_prompt_experiment_components.py` + `codex-experiment/hook_pack_recursive_correctness.json` | 扩展 schema，含 `learning_intent`/`presentation_style`/`anchor_section`/`source_excerpt`/`answer_evidence` / extended schema | 最复杂的一版：真实 few-shot 对话、三种 profile（`balanced`/`engaging`/`seven-hooks`）、本地质量校验。核心思路是**不依赖模型临时搜索**——名言/历史事故这类需要事实核验的内容，提前查好放进 `hook_pack` JSON 里再喂给模型，比靠模型自己搜索更可靠。详见 `codex/prompt-components-experiment` 分支的 `docs/prompt-components-experiment.md` / The most elaborate version: real few-shot dialogue, three profiles, local quality checks. Its core idea is to **not rely on the model searching on its own** — quotes and historical facts get pre-verified into a `hook_pack` JSON and handed to the model, more reliable than live search. Full write-up in `docs/prompt-components-experiment.md` on the `codex/prompt-components-experiment` branch. |

## 现状 / Current status

- **生产环境用的是 V6**（`backend/app/llm/quiz_generator.py`），已经跑过完整
  的 backend 测试套件（93 passed）和一次真实 Gemini 调用的集成测试。/
  **V6 is what's live in production** (`backend/app/llm/quiz_generator.py`);
  the full backend test suite (93 passed) and a real-Gemini integration test
  both pass with it.
- **C2 的 hook pack 思路没有被合并进 V6**：它能更彻底地解决"搜索不一定真的
  被调用"这个问题，但需要新的基础设施（怎么给每门课/每份材料录入、存储
  经过核实的事实包），这次没有做，作为后续可以考虑的方向。/ **C2's
  hook-pack approach was not folded into V6**: it more thoroughly solves the
  "search isn't reliably invoked" problem, but needs new infrastructure (how
  to author and store verified fact packs per course/material) that wasn't
  built this round — a good candidate for future work.
- V6 靠的是"只在有把握时才用真实名言/历史事故，否则换成不需要查证的风格"
  这条提示词规则，加上模型本身对非常著名事实的准确记忆，实测目前效果不错，
  但跟 C2 的预先核验比起来，理论上仍有更小的出错概率。/ V6 relies on the
  prompt rule "only use a real quote/historical event when confident,
  otherwise switch to a style that needs no fact-checking" plus the model's
  own memory of very famous facts — testing so far has gone well, but in
  theory it still carries more residual risk than C2's pre-verification.
