# Soquizzer Backend

Python 3.11+ / FastAPI. Layered architecture: controller -> service -> repository.

## Run

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # set GEMINI_API_KEY
uvicorn app.main:create_app --factory --reload
pytest
```

The app refuses to start without `GEMINI_API_KEY` (quiz generation and OCR of scanned PDFs; `GOOGLE_API_KEY` also works). Unit tests use fakes and need no key.

Data lives under `DATA_DIR` (default `./data`): `soquizzer.db` (SQLite: courses, sections, PDFs as JSON, quizzes). It is a local file, no Docker or database server needed.

## Layout

```
app/
├── controller/   HTTP layer: routing, no business logic. API.md documents every endpoint for the frontend
├── service/      CourseService, SectionService, MaterialService, QuizService (make/read quizzes), GradingService, ProgressService, HistoryService, PetChatService
├── repository/   SQLite repositories via SQLAlchemy (course, section, material, quiz, attempt, answer)
├── entity/       Database models (Course, Section, Material, Quiz, Question, Attempt, Answer)
├── dto/          Request/response schemas
├── ports.py      What services need from outside (QuizGenerator, PetTutor, PdfJsonConverter, PageOcr) and the data they exchange; no SDK imports
├── gemini_gateway.py  The only module that imports the Google GenAI SDK; the adapters below call Gemini through it
├── llm/          Gemini adapters: GeminiQuizGenerator (prompt + validation), GeminiPetTutor
├── rag/          GeminiPageOcr, LocalPdfJsonConverter (PDF in, JSON out, no model)
├── config/       Settings (env vars / .env)
├── exception/    AppError subclasses + handler that maps them to HTTP errors
├── container.py  Builds long-lived dependencies at startup
├── dependencies.py  FastAPI dependency wiring
└── main.py       create_app()
tests/
```

## Section PDF: PDF -> JSON

Every section has its own PDF(s), and its quizzes are written from those and nothing else. `POST /api/sections/{id}/materials` turns the PDF into JSON **locally with pypdf, no model call**, so it is fast (a 30-page deck takes well under a second, a long book a few seconds) and cannot drop or invent content the way a model-written conversion could.

```json
{"page_count": 12,
 "outline": [{"title": "Cells", "page": 3, "level": 1}],
 "pages": [{"page": 1, "text": "..."}]}
```

- `pages` holds every page that has text, with the PDF's own page numbers; `outline` is the PDF's bookmarks (flattened, with nesting `level`) and is left out when the PDF has none. The quiz prompt uses the headings and page numbers to anchor questions.
- A scan with no text layer (under 20 characters per page on average) is read with Gemini OCR (`OCR_ENABLED`, `OCR_PAGES_PER_REQUEST`, `OCR_MAX_PAGES`). That is the only case that calls a model, and it is slow.
- A corrupted or password-protected PDF, or a scan OCR cannot read, returns 422 and stores nothing.

## Courses, sections, quizzes and memory

The endpoints the frontend uses are documented in [`app/controller/API.md`](app/controller/API.md).

```
courses ─1─∞─ sections ─1─∞─ materials
courses ─1─∞─ sections ─1─∞─ quizzes ─1─∞─ questions ─1─∞─ answers
                                   quizzes ─1─∞─ attempts ─1─∞─ answers
```

| Table | Columns |
|---|---|
| `courses` | name, `subject` (`Subject` enum: MATH, PHYSICS, CHEMISTRY, BIOLOGY, COMPUTER_SCIENCE, ENGLISH, HISTORY, GEOGRAPHY, ECONOMICS, OTHER) |
| `materials` | course_id, `section_id`, source_filename, `content` (JSON text extracted from the section's PDF). Rows with no `section_id` are from before PDFs belonged to sections; they are ignored |
| `sections` | course_id, name. A section of a course; its quizzes are successive rounds |
| `quizzes` | section_id, created_at |
| `questions` | quiz_id, position, `type` (MULTIPLE_CHOICE / TRUE_FALSE), stem, options (JSON list), `answer_index`, explanation, `anchor_section` and `source_excerpt` (where in the material the question comes from) |
| `attempts` | quiz_id, submitted_at, `time_spent_seconds` (sent by the frontend, may be null), score, total |
| `answers` | attempt_id, question_id, selected_index, is_correct, answered_at |

The uploaded PDF is a section's source material (slides, notes), not a quiz. The flow:

1. `POST /api/sections/{id}/materials` (PDF, max 20 MB): the text is extracted locally (see above) and stored in `materials` under that section. The PDF itself is not kept.
2. `POST /api/sections/{id}/quizzes`: no parameters. Gemini gets the JSON of all of **this section's** PDFs (no other section's, no textbook) and writes `QUESTIONS_PER_QUIZ` (default 20) questions in `QUIZ_LANGUAGE` (default English, whatever language the material is in) in a fixed schema, **including the correct answer and an explanation** for each. Only multiple choice and true/false are generated, so grading is a comparison, no LLM needed. Each question also gets an `anchor_section` (heading or page) and a short `source_excerpt` of the material it is based on. The response hides `answer_index`, `explanation` and the source anchor.
3. `POST /api/quizzes/{id}/submissions`: graded against the stored answer, saved as an `attempt` with its `answers`, and the response reveals the right answers, explanations and source anchors. Unanswered questions are not recorded. An invalid submission (unknown question, duplicate, option out of range) stores nothing.
4. `GET /api/history` and `GET /api/attempts/{id}`: every attempt with score, accuracy and time spent, and one attempt in detail. `GET /api/courses/{id}/progress`: accuracy by question type and the mistakes still open.

**Memory is the raw answer history, not a summary.** Every time a quiz is generated, the questions the student still gets wrong **in that section** (stem, options, right answer, their answer, explanation) plus the section's per-type accuracy are re-read from the database and put into the prompt (at most `MISTAKE_REVIEW_LIMIT`, default 20). Gemini is asked to work out what the student probably does not understand and to aim at least half of the new questions there. The stems of the section's earlier questions (the newest `60`) are listed too, so each new quiz asks about something different. A question answered wrongly and later correctly drops out.

**Reread suggestions (confusion tracking).** `GET /api/courses/{id}/progress` also returns `reread`: the still-wrong questions grouped by `anchor_section`, so the student is told which parts of the material to read again, most mistakes first. Only wrongly answered questions count; skipped questions are not recorded. There is no cross-student view. Tables that gain columns in a new version are upgraded when the app starts (`add_missing_columns`), so an existing `soquizzer.db` keeps working. The frontend never sees any of this: it just asks for the next quiz. There are no concept or topic tables: nothing is inferred and stored, so nothing can drift or lose detail.

Deleting a course deletes its sections (with their PDFs), quizzes and attempts; deleting a section or a quiz deletes everything below it.

Errors: 409 if the section has no PDF, 413 if its JSON is over `MAX_MATERIAL_CHARS`, 502 if Gemini fails or returns an invalid result (nothing is saved). The quiz call is synchronous and can take several seconds.

CORS allows the Vite dev server (`http://localhost:5173`) and Electron's `file://` pages (origin `null`); change it with `CORS_ORIGINS` (a JSON list).

If you already have a `data/soquizzer.db` from an earlier version, delete it: tables are created but never migrated.

## Tests

```bash
pytest                          # everything; unit tests use fakes, no key needed
pytest -m integration -s        # integration tests only, -s prints the extracted JSON and the quiz
QUIZ_PDF_PATH=~/my_slides.pdf pytest -m integration -s     # try your own PDF
```

The integration tests (`tests/test_integration.py`) start the app on a real SQLite file (created on startup, no server or Docker), inspect every table with `sqlite3`, and check that materials, sections, quizzes, attempts and mistakes survive an app restart. The last one calls the real Gemini API for the whole flow (PDF -> material -> quiz -> wrong answers -> next quiz) and is skipped unless `GEMINI_API_KEY` is set (environment or `backend/.env`). It prints what was produced and the path of the SQLite file.
