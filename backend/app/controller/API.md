# Soquizzer backend API (for the frontend)

Every endpoint currently exposed by `backend/app/controller/`. Interactive docs: open `http://localhost:8000/docs` once the backend is running.

## Running the backend

```bash
cd backend
source .venv/bin/activate          # first-time setup: see backend/README.md
uvicorn app.main:create_app --factory --reload
```

Base URL: `http://localhost:8000`.

## Conventions

- Requests and responses are JSON (except file uploads, which use `multipart/form-data`).
- Ids are strings (UUIDs). Times are ISO 8601 in UTC with a `Z`, e.g. `2026-09-19T15:01:15.328228Z`.
- Allowed CORS origins: `http://localhost:5173` (Vite dev server), `http://127.0.0.1:5173`, and `null` (the origin of pages Electron loads with `loadFile`). Add more with the `CORS_ORIGINS` environment variable.
- Errors return `{"detail": ...}`. **`detail` has two shapes:**
  - Business errors: `detail` is a string, e.g. `{"detail": "Quiz nope not found"}`
  - Validation failures (422): `detail` is an array, e.g. `{"detail": [{"loc": ["body", "name"], "msg": "String should have at least 1 character", ...}]}`

| Status | Meaning |
|---|---|
| 200 / 201 / 204 | OK / created / deleted (no body) |
| 404 | The course, section, quiz, material or attempt does not exist |
| 409 | The course has no material yet, so no quiz can be made |
| 413 | The PDF is too large (over 20 MB), or the course's material is too long |
| 415 | The uploaded file is not a PDF |
| 422 | Invalid input (empty name, option index out of range, the same question answered twice, ...) |
| 502 | Gemini failed or returned something invalid. Nothing was saved; retrying is fine |

**Slow endpoints:** `POST .../materials` (Gemini reads the PDF) and `POST .../quizzes` (Gemini writes the questions) each take from a few seconds to tens of seconds. Show a loading state and set the request timeout to at least 120 seconds.

**Language:** quizzes (questions, options, explanations) are written in English by default, whatever language the material is in. The backend setting `QUIZ_LANGUAGE` changes that. The frontend does not need to do anything.

## Data hierarchy

```
Course
├── Material (an uploaded PDF)
└── Section
    └── Quiz (one round in a section, 20 questions each)
        └── Attempt (one submission of answers, with score and time spent)
```

## Typical flow

1. `POST /api/courses` creates a course
2. `POST /api/courses/{id}/materials` uploads the course's material PDF (needed before any quiz can be made)
3. `POST /api/courses/{id}/sections` creates a section
4. `POST /api/sections/{id}/quizzes` creates a quiz; the response already contains the 20 questions
5. The student answers (the frontend times it), then `POST /api/quizzes/{id}/submissions`; the response has what was right, the correct answers and the explanations
6. `GET /api/history` shows the history, accuracy and time spent

Creating another quiz gives the next round in the same section. The backend takes the student's earlier mistakes into account by itself, so **the frontend passes no parameters and does not need to know about it**.

---

## Course

`subject` is one of: `MATH` `PHYSICS` `CHEMISTRY` `BIOLOGY` `COMPUTER_SCIENCE` `ENGLISH` `HISTORY` `GEOGRAPHY` `ECONOMICS` `OTHER`

| Method | Path | Description |
|---|---|---|
| POST | `/api/courses` | Create a course. Body `{"name": "Biology 101", "subject": "BIOLOGY"}`; `name` is 1 to 100 characters, surrounding spaces are trimmed. Returns 201 |
| GET | `/api/courses` | List courses, newest first |
| GET | `/api/courses/{course_id}` | One course |
| DELETE | `/api/courses/{course_id}` | Delete a course **and** its materials, sections, quizzes and attempts. Returns 204 |

```json
{
  "id": "9da23c53-b719-4893-aba2-19b297cdb949",
  "name": "Biology 101",
  "subject": "BIOLOGY",
  "created_at": "2026-09-19T15:01:15.328228Z"
}
```

## Section

| Method | Path | Description |
|---|---|---|
| POST | `/api/courses/{course_id}/sections` | Create a section in a course. Body `{"name": "Chapter 1"}`; `name` is 1 to 100 characters. Returns 201 |
| GET | `/api/courses/{course_id}/sections` | The course's sections, oldest first |
| GET | `/api/sections/{section_id}` | One section |
| DELETE | `/api/sections/{section_id}` | Delete a section **and** its quizzes and attempts. Returns 204 |

```json
{
  "id": "6caad8ec-b1f4-4298-af15-65d9b0ca87ed",
  "course_id": "9da23c53-b719-4893-aba2-19b297cdb949",
  "name": "Chapter 1",
  "created_at": "2026-09-19T15:01:15.332348Z"
}
```

## Material

A PDF the user uploads (slides, lecture notes, ...). The backend has Gemini read it and stores the result, which is later used to write quizzes. The PDF itself is not kept.

| Method | Path | Description |
|---|---|---|
| POST | `/api/courses/{course_id}/materials` | Upload a PDF as `multipart/form-data`, field name `file`, at most 20 MB. Returns 201. **Slow endpoint** |
| GET | `/api/courses/{course_id}/materials` | The course's materials |
| GET | `/api/materials/{material_id}` | One material |
| DELETE | `/api/materials/{material_id}` | Delete a material. Returns 204 |

```js
const form = new FormData();
form.append("file", pdfFile);
await fetch(`${BASE}/api/courses/${courseId}/materials`, { method: "POST", body: form });
```

In the response, `content` is JSON whose structure Gemini decided by itself, so its shape can differ from one material to the next. The frontend normally only needs to show `source_filename` and should not depend on the structure of `content`.

```json
{
  "id": "3cde0873-5e47-4a60-acc1-591d488d3c6c",
  "course_id": "9da23c53-b719-4893-aba2-19b297cdb949",
  "source_filename": "slides.pdf",
  "content": { "...": "structure decided by Gemini" },
  "created_at": "2026-09-19T15:01:15.337293Z"
}
```

## Quiz

| Method | Path | Description |
|---|---|---|
| POST | `/api/sections/{section_id}/quizzes` | Create the section's next quiz. **The response is the 20 questions**, and no parameters are needed. Returns 201. **Slow endpoint.** Returns 409 if the course has no material |
| GET | `/api/sections/{section_id}/quizzes` | The section's quizzes (without questions), newest first |
| GET | `/api/quizzes/{quiz_id}` | One quiz with all its questions |
| DELETE | `/api/quizzes/{quiz_id}` | Delete a quiz **and** its attempts. Returns 204 |

Questions carry **no answer and no explanation**; those come back when the student submits. `type` is `MULTIPLE_CHOICE` (4 options) or `TRUE_FALSE` (2 options). Options are referred to by their array index, starting at 0.

```json
{
  "id": "806f05a9-2b89-4a74-a318-d904c56adb6b",
  "section_id": "6caad8ec-b1f4-4298-af15-65d9b0ca87ed",
  "created_at": "2026-09-19T15:01:15.344166Z",
  "questions": [
    { "id": "2d1f95a6-...", "position": 1, "type": "MULTIPLE_CHOICE", "stem": "What is the main job of mitochondria?", "options": ["Making proteins", "Producing ATP", "Storing DNA", "Packaging proteins"] },
    { "id": "7a090a84-...", "position": 2, "type": "TRUE_FALSE", "stem": "The nucleus stores the cell's genetic information.", "options": ["True", "False"] }
  ]
}
```

Each item in the list (no `questions`):

```json
{ "id": "806f05a9-...", "section_id": "6caad8ec-...", "created_at": "...", "question_count": 20, "attempt_count": 1 }
```

## Submission

| Method | Path | Description |
|---|---|---|
| POST | `/api/quizzes/{quiz_id}/submissions` | Submit one attempt. Returns 201 |

Request:

```json
{
  "answers": [
    { "question_id": "2d1f95a6-...", "selected_index": 1 },
    { "question_id": "7a090a84-...", "selected_index": 0 }
  ],
  "time_spent_seconds": 95
}
```

- `answers` needs at least 1 item. Questions left out are neither counted wrong nor recorded.
- `selected_index` is the index of the option the student picked.
- `time_spent_seconds` is optional and **measured by the frontend** (from the moment the student sees the questions to the moment they submit). Without it, the time spent shows as empty in the history.
- A question may appear only once and the index must exist, otherwise the request returns 422 and nothing is saved.
- The same quiz can be submitted again; every submission is a new attempt.

Response:

```json
{
  "attempt_id": "a9667b02-871e-4cea-8c26-9412a2d1bdef",
  "score": 1,
  "total": 2,
  "results": [
    { "question_id": "2d1f95a6-...", "selected_index": 1, "is_correct": true,  "answer_index": 1, "explanation": "Mitochondria produce ATP through cellular respiration." },
    { "question_id": "7a090a84-...", "selected_index": 1, "is_correct": false, "answer_index": 0, "explanation": "The nucleus stores DNA." }
  ]
}
```

`score` is the number of correct answers and `total` is the number of questions in the quiz. `answer_index` is the index of the correct option and `explanation` says why.

## History

| Method | Path | Description |
|---|---|---|
| GET | `/api/history` | Every attempt, newest first. Optional parameters: `course_id`, `section_id` (filter by course or section) and `limit` (default 50, 1 to 200) |
| GET | `/api/attempts/{attempt_id}` | One attempt in detail: every question, what the student picked, the correct answer and the explanation |

`GET /api/history` response:

```json
{
  "summary": { "attempts": 1, "accuracy": 0.5, "total_time_seconds": 95 },
  "attempts": [
    {
      "attempt_id": "a9667b02-...",
      "quiz_id": "806f05a9-...",
      "section_id": "6caad8ec-...",
      "section_name": "Chapter 1",
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

- `summary` covers **every attempt that matches the filters**, not just the ones listed, so `limit` does not affect it. `accuracy` is total correct answers divided by total questions, and `null` when there are no attempts. Attempts without a recorded time count as 0 in `total_time_seconds`.
- Each attempt's `accuracy` is `score / total`, from 0 to 1. `time_spent_seconds` can be `null`.

`GET /api/attempts/{attempt_id}` returns the fields above plus `questions`:

```json
{
  "attempt_id": "a9667b02-...", "score": 1, "total": 2, "accuracy": 0.5, "time_spent_seconds": 95, "...": "as above",
  "questions": [
    {
      "question_id": "2d1f95a6-...", "position": 1, "type": "MULTIPLE_CHOICE",
      "stem": "What is the main job of mitochondria?", "options": ["Making proteins", "Producing ATP", "Storing DNA", "Packaging proteins"],
      "answer_index": 1, "explanation": "Mitochondria produce ATP through cellular respiration.",
      "selected_index": 1, "is_correct": true
    }
  ]
}
```

For questions the student left unanswered, `selected_index` and `is_correct` are `null`.

## Progress

| Method | Path | Description |
|---|---|---|
| GET | `/api/courses/{course_id}/progress` | Accuracy by question type for the course, and the mistakes that are still open |

```json
{
  "by_type": [
    { "type": "MULTIPLE_CHOICE", "total": 1, "correct": 1 },
    { "type": "TRUE_FALSE", "total": 1, "correct": 0 }
  ],
  "mistakes": [
    {
      "question_id": "7a090a84-...", "quiz_id": "806f05a9-...", "type": "TRUE_FALSE",
      "stem": "The nucleus stores the cell's genetic information.", "options": ["True", "False"],
      "answer_index": 0, "explanation": "The nucleus stores DNA.",
      "selected_index": 1, "answered_at": "2026-09-19T15:01:15.350252Z"
    }
  ]
}
```

- `by_type` counts every answer given in the course (answering the same question several times counts several times).
- `mistakes` are the questions whose latest answer is still wrong, newest first, at most 20. A question drops out once it is answered correctly.

---

## Not needed by the frontend yet

`/api/textbooks` (textbook chunks and a vector store) is not used by quiz generation, so the frontend can ignore it for now.
