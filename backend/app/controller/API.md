# Soquizzer 后端 API(给前端)

这里列的是 `backend/app/controller/` 里目前暴露的全部接口。交互式文档:后端启动后打开 `http://localhost:8000/docs`。

## 启动后端

```bash
cd backend
source .venv/bin/activate          # 第一次的环境准备见 backend/README.md
uvicorn app.main:create_app --factory --reload
```

基础地址:`http://localhost:8000`。

## 通用约定

- 请求和响应都是 JSON(上传文件的接口除外,用 `multipart/form-data`)。
- id 都是字符串(UUID)。时间是 UTC 的 ISO 8601,带 `Z`,比如 `2026-09-19T15:01:15.328228Z`。
- 允许跨域的来源:`http://localhost:5173`(Vite 开发服务器)、`http://127.0.0.1:5173`、`null`(Electron 用 `loadFile` 加载页面时的来源)。要加别的来源,用环境变量 `CORS_ORIGINS`。
- 出错时返回 `{"detail": ...}`。**注意 `detail` 有两种形状:**
  - 业务错误,`detail` 是字符串:`{"detail": "Quiz nope not found"}`
  - 参数校验失败(422),`detail` 是数组:`{"detail": [{"loc": ["body", "name"], "msg": "String should have at least 1 character", ...}]}`

| 状态码 | 含义 |
|---|---|
| 200 / 201 / 204 | 成功 / 创建成功 / 删除成功(无响应体) |
| 404 | 课程、分组、quiz、教材、作答记录不存在 |
| 409 | 这门课还没有上传教材,不能出题 |
| 413 | PDF 太大(超过 20 MB),或这门课的教材内容太长 |
| 415 | 上传的不是 PDF |
| 422 | 参数不合法(名字为空、选项下标越界、重复作答同一道题等) |
| 502 | 调用 Gemini 失败或返回了无效内容,没有保存任何东西,可以重试 |

**耗时接口:** `POST .../materials`(Gemini 读 PDF)和 `POST .../quizzes`(Gemini 出 20 道题)各需要几秒到几十秒。请显示加载状态,并把请求超时设成至少 120 秒。

## 数据层级

```
Course(课程)
├── Material(教材,上传的 PDF)
└── Group(分组,也就是课程里的 section)
    └── Quiz(分组里一次次的测验,每个 20 道题)
        └── Attempt(每次提交答案,记录得分和用时)
```

## 典型流程

1. `POST /api/courses` 创建课程
2. `POST /api/courses/{id}/materials` 上传这门课的教材 PDF(出题需要它)
3. `POST /api/courses/{id}/groups` 创建分组
4. `POST /api/groups/{id}/quizzes` 创建 quiz,响应里直接是 20 道题
5. 用户做题,前端计时,然后 `POST /api/quizzes/{id}/submissions` 提交,响应里有对错、正确答案和解析
6. `GET /api/history` 看历史记录、正确率和用时

再点一次"创建 quiz",就是这个分组的下一份测验。后端会自己参考用户之前答错的题,**前端不需要传任何参数,也不用关心这件事**。

---

## 课程 Course

`subject` 的取值:`MATH` `PHYSICS` `CHEMISTRY` `BIOLOGY` `COMPUTER_SCIENCE` `ENGLISH` `HISTORY` `GEOGRAPHY` `ECONOMICS` `OTHER`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/courses` | 创建课程,body `{"name": "Biology 101", "subject": "BIOLOGY"}`,`name` 1~100 字,首尾空格会去掉。返回 201 |
| GET | `/api/courses` | 课程列表,新的在前 |
| GET | `/api/courses/{course_id}` | 单个课程 |
| DELETE | `/api/courses/{course_id}` | 删除课程,**同时删除**它的教材、分组、quiz 和作答记录。返回 204 |

```json
{
  "id": "9da23c53-b719-4893-aba2-19b297cdb949",
  "name": "Biology 101",
  "subject": "BIOLOGY",
  "created_at": "2026-09-19T15:01:15.328228Z"
}
```

## 分组 Group

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/courses/{course_id}/groups` | 在课程下创建分组,body `{"name": "Chapter 1"}`,`name` 1~100 字。返回 201 |
| GET | `/api/courses/{course_id}/groups` | 课程下的分组,按创建时间从早到晚 |
| GET | `/api/groups/{group_id}` | 单个分组 |
| DELETE | `/api/groups/{group_id}` | 删除分组,**同时删除**它的 quiz 和作答记录。返回 204 |

```json
{
  "id": "6caad8ec-b1f4-4298-af15-65d9b0ca87ed",
  "course_id": "9da23c53-b719-4893-aba2-19b297cdb949",
  "name": "Chapter 1",
  "created_at": "2026-09-19T15:01:15.332348Z"
}
```

## 教材 Material

用户上传的 PDF(课件、讲义等),后端会让 Gemini 读懂并保存,之后用来出题。PDF 本身不保存。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/courses/{course_id}/materials` | 上传 PDF,`multipart/form-data`,字段名 `file`,最大 20 MB。返回 201。**耗时接口** |
| GET | `/api/courses/{course_id}/materials` | 课程下的教材 |
| GET | `/api/materials/{material_id}` | 单个教材 |
| DELETE | `/api/materials/{material_id}` | 删除教材。返回 204 |

```js
const form = new FormData();
form.append("file", pdfFile);
await fetch(`${BASE}/api/courses/${courseId}/materials`, { method: "POST", body: form });
```

响应里 `content` 是 Gemini 自己决定结构写出来的 JSON,每份教材的形状可能不同。前端一般只需要展示 `source_filename`,不要依赖 `content` 的结构。

```json
{
  "id": "3cde0873-5e47-4a60-acc1-591d488d3c6c",
  "course_id": "9da23c53-b719-4893-aba2-19b297cdb949",
  "source_filename": "slides.pdf",
  "content": { "...": "结构由 Gemini 决定" },
  "created_at": "2026-09-19T15:01:15.337293Z"
}
```

## 测验 Quiz

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/groups/{group_id}/quizzes` | 创建分组里的下一份 quiz,**响应里直接就是 20 道题**,不需要任何参数。返回 201。**耗时接口**。这门课没有教材时返回 409 |
| GET | `/api/groups/{group_id}/quizzes` | 分组里的 quiz 列表(不含题目),新的在前 |
| GET | `/api/quizzes/{quiz_id}` | 一份 quiz 和它的全部题目 |
| DELETE | `/api/quizzes/{quiz_id}` | 删除 quiz,**同时删除**它的作答记录。返回 204 |

题目里**没有答案和解析**,提交之后才会给。`type` 有两种:`MULTIPLE_CHOICE`(选择题,4 个选项)和 `TRUE_FALSE`(判断题,2 个选项)。选项都用数组下标(从 0 开始)表示。

```json
{
  "id": "806f05a9-2b89-4a74-a318-d904c56adb6b",
  "group_id": "6caad8ec-b1f4-4298-af15-65d9b0ca87ed",
  "created_at": "2026-09-19T15:01:15.344166Z",
  "questions": [
    { "id": "2d1f95a6-...", "position": 1, "type": "MULTIPLE_CHOICE", "stem": "线粒体的主要功能是什么?", "options": ["合成蛋白质", "产生 ATP", "储存 DNA", "包装蛋白质"] },
    { "id": "7a090a84-...", "position": 2, "type": "TRUE_FALSE", "stem": "细胞核储存遗传信息。", "options": ["正确", "错误"] }
  ]
}
```

列表里每项(没有 `questions`):

```json
{ "id": "806f05a9-...", "group_id": "6caad8ec-...", "created_at": "...", "question_count": 20, "attempt_count": 1 }
```

## 提交答案 Submission

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/quizzes/{quiz_id}/submissions` | 提交一次作答,返回 201 |

请求:

```json
{
  "answers": [
    { "question_id": "2d1f95a6-...", "selected_index": 1 },
    { "question_id": "7a090a84-...", "selected_index": 0 }
  ],
  "time_spent_seconds": 95
}
```

- `answers` 至少 1 项。没答的题可以不带,不会算错也不会被记录。
- `selected_index` 是用户选的选项下标。
- `time_spent_seconds` 可选,**由前端计时**(从用户看到题目到点提交)。不传的话历史记录里用时显示为空。
- 同一道题不能重复出现,下标不能越界,否则返回 422 并且什么都不保存。
- 同一份 quiz 可以再次提交,每次提交是一条新的作答记录。

响应:

```json
{
  "attempt_id": "a9667b02-871e-4cea-8c26-9412a2d1bdef",
  "score": 1,
  "total": 2,
  "results": [
    { "question_id": "2d1f95a6-...", "selected_index": 1, "is_correct": true,  "answer_index": 1, "explanation": "线粒体通过细胞呼吸产生 ATP。" },
    { "question_id": "7a090a84-...", "selected_index": 1, "is_correct": false, "answer_index": 0, "explanation": "细胞核储存 DNA。" }
  ]
}
```

`score` 是答对的题数,`total` 是这份 quiz 的题数。`answer_index` 是正确选项的下标,`explanation` 是解析。

## 历史记录 History

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/history` | 所有作答记录,新的在前。可选参数:`course_id`、`group_id`(按课程或分组筛选)、`limit`(默认 50,1~200) |
| GET | `/api/attempts/{attempt_id}` | 一次作答的详情:每道题、用户选了什么、正确答案、解析 |

`GET /api/history` 响应:

```json
{
  "summary": { "attempts": 1, "accuracy": 0.5, "total_time_seconds": 95 },
  "attempts": [
    {
      "attempt_id": "a9667b02-...",
      "quiz_id": "806f05a9-...",
      "group_id": "6caad8ec-...",
      "group_name": "Chapter 1",
      "course_id": "9da23c53-...",
      "course_name": "Biology 101",
      "submitted_at": "2026-09-19T15:01:15.349919Z",
      "score": 1,
      "total": 2,
      "accuracy": 0.5,
      "time_spent_seconds": 95
    }
  ]
}
```

- `summary` 统计的是**所有符合筛选的记录**,不受 `limit` 影响。`accuracy` 是总答对数 / 总题数,没有记录时是 `null`。`total_time_seconds` 里没记录用时的按 0 算。
- 每条记录的 `accuracy` = `score / total`,范围 0~1。`time_spent_seconds` 可能是 `null`。

`GET /api/attempts/{attempt_id}` 响应,在上面每条记录的字段基础上多一个 `questions`:

```json
{
  "attempt_id": "a9667b02-...", "score": 1, "total": 2, "accuracy": 0.5, "time_spent_seconds": 95, "...": "同上",
  "questions": [
    {
      "question_id": "2d1f95a6-...", "position": 1, "type": "MULTIPLE_CHOICE",
      "stem": "线粒体的主要功能是什么?", "options": ["合成蛋白质", "产生 ATP", "储存 DNA", "包装蛋白质"],
      "answer_index": 1, "explanation": "线粒体通过细胞呼吸产生 ATP。",
      "selected_index": 1, "is_correct": true
    }
  ]
}
```

用户没答的题,`selected_index` 和 `is_correct` 是 `null`。

## 学习进度 Progress

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/courses/{course_id}/progress` | 这门课各题型的正确率,以及目前还没改对的错题 |

```json
{
  "by_type": [
    { "type": "MULTIPLE_CHOICE", "total": 1, "correct": 1 },
    { "type": "TRUE_FALSE", "total": 1, "correct": 0 }
  ],
  "mistakes": [
    {
      "question_id": "7a090a84-...", "quiz_id": "806f05a9-...", "type": "TRUE_FALSE",
      "stem": "细胞核储存遗传信息。", "options": ["正确", "错误"],
      "answer_index": 0, "explanation": "细胞核储存 DNA。",
      "selected_index": 1, "answered_at": "2026-09-19T15:01:15.350252Z"
    }
  ]
}
```

- `by_type` 统计这门课里所有的作答(同一题答多次会算多次)。
- `mistakes` 是"最近一次作答仍然答错"的题,新的在前,最多 20 道。之后答对了就会消失。

---

## 暂不需要前端对接

`/api/textbooks`(教材分块 + 向量库)目前没有被出题使用,前端可以先不管它。
