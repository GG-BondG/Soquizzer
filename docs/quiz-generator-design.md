# Quiz Generator 设计草案 / Design Draft

> 状态 / Status: 讨论稿，还没定案，用于同步团队思路。/ Discussion draft, not final —
> shared to sync the team's thinking before we start prompt-engineering.

## 目标 / Goal

输入课程材料（大纲 / outline、slides、textbook 等），生成 10 道有趣的小 quiz，
帮助学生在上课前做预习：对即将学的内容有个大致的了解，并确认自己真的看懂了
指定的 reading，而不是囫囵吞枣地扫一遍。

Take course material (outline, slides, textbook, etc.) as input and generate
10 engaging quiz questions to help students prepare before class: get a rough
sense of what's coming, and confirm they actually understood the assigned
reading rather than just skimming it.

## 参考的 reading 样本 / Reference reading samples

分析了三份真实课程 reading（`D:\Download\READINGs`）：

- CSC236《Complete Induction》《Correctness of Recursive Algorithms》—— 典型的
  "定义 → 例子1 → 例子2 → 总结模板"结构，段落衔接很紧。
- CSC413《Backpropagation》讲义 —— 用 LaTeX 编号小节（1 Introduction → 2 Chain
  Rule revisited → 2.1/2.2/2.3/2.4 → 3 多层网络 → 4 附录），前一节的结论是
  后一节的前提，层层递进。

结论：这类课程 reading 普遍有清晰的行文逻辑（章节结构、循序渐进的例子），
非常适合按"逻辑节点"而不是"随机位置"来插入检查题。

Analyzed three real course readings. Conclusion: this kind of course reading
usually has a clear logical flow (section structure, progressively-building
examples), which is well suited to inserting checkpoint questions at logical
beats rather than random positions.

## 核心思路 / Core idea

**主力题型（backbone）：结构衔接题 / structural checkpoint questions**

按 reading 自身的行文逻辑，在关键节点（一个概念讲完、一个例子做完、要过渡到
下一个更复杂的想法之前）插入问题，确认学生的思路跟上了，而不是在考记忆。
例如：

- **"接下来会怎样"预测题**：讲完 A，问"你觉得接下来要解决什么问题/为什么需要
  引入 B"，倒逼学生带着问题继续读。
- **"为什么要一般化"**：问"前面手算的方法在这里会遇到什么问题"，检查有没有
  理解从简单情形到复杂情形的动机，而不只是记住公式。
- **概念复述题**：让学生用自己的话解释刚出现的术语/记号，比选择题更能测出
  真懂假懂。

**调味题型（seasoning）：菜单形式，用户/AI 可选**

- 名人名言/轶事：某个大牛在这个领域说过的话，或一个小故事。
- 梗/笑话：把概念做成 meme 式类比，或者一句圈内老梗。
- "这玩意后面有什么用"预告：告诉学生这节课学的东西在后面哪个项目/哪节课会
  用到。
- 反直觉/纠错题：先给一个大部分人会答错的常见误解，猜完再揭晓真相。
- 历史事故/名场面：某个著名失败案例是因为不懂这个知识点导致的。
- 跨学科类比：把概念对应到学生更熟悉的领域（生物、经济、游戏机制等）。
- "你来当xxx"情景题：把知识点包装成一个小情景选择题，让学生代入角色决策。

**比例建议 / Suggested ratio**：10 题里大约 6~7 题是结构衔接题，3~4 题从调味
菜单里选，穿插在中间，避免 10 题全是同一个套路、也避免全是轻松向内容丢失了
预习检查的实用性。

## 卡壳追踪 / Confusion tracking

- **MVP（先做）**：记录学生在哪道题答错/跳过/重试多次，把该题对应的原文
  段落标记为"建议重读"，直接反馈给学生本人。
- **Stretch goal（有余力再做）**：跨学生聚合，给老师/助教一个"全班在哪一节
  卡壳最多"的视图，用于课堂上重点讲解——如果做出来会是很好的 demo 亮点，
  但工作量明显更大，先不列入 v1 范围。

为了让 MVP 能做卡壳追踪，生成的每道题最好带上"来源章节/原文片段"这个字段
（见下面的对接点）。

## 和现有后端的对接点 / Integration with the current backend

现状（`backend/app/llm/pdf_json_converter.py` + `QuizService.create_from_pdf`）：

```
POST /api/courses/{id}/quizzes (PDF)
  -> QuizService.create_from_pdf
  -> GeminiPdfJsonConverter.convert()   # 现在的 PROMPT 只是把 PDF 转成
                                         # "文档结构 JSON"（title/sections），
                                         # 还没有真正生成 quiz 题目
  -> QuizRepository.add                 # JSON 存进 SQLite 的 Quiz.content
```

这正是本设计要落地的地方。下一步（另开工作）有两种做法，需要和 backend 的
同学一起定：

1. **扩展/替换现有 PROMPT**：让 `GeminiPdfJsonConverter`（或新起一个
   `GeminiQuizGenerator`）直接根据上面的题型设计，产出"10 道题"的 JSON，
   而不是泛泛的文档结构 JSON。
2. **两段式**：保留现有"PDF → 文档结构 JSON"这一步，再加一步"文档结构 JSON
   → quiz JSON"，方便调试和复用（比如以后要对着已经入库的 textbook chunk
   而不是单个 PDF 生成题目时，可以跳过第一步）。

无论哪种做法，quiz JSON 里每道题建议至少包含：`type`（题型）、`prompt`（题干）、
`answer_or_rubric`、`source_excerpt` 或 `anchor_section`（对应原文位置，供
卡壳追踪定位）。

## Next Steps

先只针对"结构衔接题"这一个类型，专门打磨 prompt（包括如何让模型自己找到
reading 的章节/逻辑节点、如何控制题干难度和长度），跑通一份可用的 JSON
输出，再逐步把调味题型加进菜单。
