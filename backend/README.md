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

The app refuses to start without `GEMINI_API_KEY` (Gemini embeddings and PDF-to-JSON conversion; `GOOGLE_API_KEY` also works). Unit tests use fakes and need no key.

Data lives under `DATA_DIR` (default `./data`): `soquizzer.db` (SQLite: textbooks, courses, quizzes) and `chroma/` (vectors). Both are local files, no Docker or database server needed.

## Layout

```
app/
├── controller/   HTTP layer: routing, no business logic. API.md documents every endpoint for the frontend
├── service/      TextbookService, IngestionService (load -> chunk -> embed), CourseService, SectionService, MaterialService, QuizService, HistoryService
├── repository/   SQLite repositories via SQLAlchemy (textbook, course, section, material, quiz, attempt, answer), ChunkRepository (ChromaDB)
├── entity/       Database models (Textbook, Course, Material, Section, Quiz, Question, Attempt, Answer)
├── dto/          Request/response schemas
├── llm/          Native Google GenAI SDK: GeminiPdfJsonConverter (PDF in, JSON out), GeminiQuizGenerator
├── rag/          Loaders, chunking, embeddings
├── storage/      LocalStorage for raw uploads
├── config/       Settings (env vars / .env)
├── exception/    AppError subclasses + handler that maps them to HTTP errors
├── container.py  Builds long-lived dependencies at startup
├── dependencies.py  FastAPI dependency wiring
└── main.py       create_app()
tests/
```

## RAG: textbook ingestion

`POST /api/textbooks` (multipart `file`; `.pdf`, `.txt`, `.md`)

```
Client
  -> TextbookController        returns 202 + {id, status: PROCESSING}
  -> TextbookService.upload    validate type, stream to disk while hashing, reject duplicates (409)
  -> (background) IngestionService.ingest
       -> load_documents       PDF: one Document per page (page number kept)
       -> chunk_documents      split + metadata + stable ids
       -> ChunkRepository.add  embed with Gemini, store in ChromaDB
       -> Textbook.status = READY (or FAILED with an error message)
Client polls GET /api/textbooks/{id}
```

Other endpoints: `GET /api/textbooks`, `GET /api/textbooks/{id}`, `DELETE /api/textbooks/{id}` (also removes the file and its chunks).

### Chunking

`RecursiveCharacterTextSplitter`, 1000 characters with 200 overlap (20%), configurable via `CHUNK_SIZE` / `CHUNK_OVERLAP`.

- **Size:** ~1000 characters is a few paragraphs, enough to hold one concept and its explanation, small enough that a retrieved chunk stays on topic.
- **Overlap:** a definition or example cut at a boundary still appears whole in one of the two neighbours.
- **Boundaries:** paragraph, then line, then sentence end (English and Chinese: `. ! ? 。！？`), then clause, word, character. A chunk is only cut mid-sentence when nothing coarser fits.
- **Pages:** PDFs are split page by page, so every chunk keeps its `page` for citations. Text that continues across a page break is split there.
- **Noise:** chunks under 30 characters (page numbers, running headers) are dropped.
- **Metadata per chunk:** `textbook_id`, `filename`, `chunk_index`, `start_index`, `page` (PDF only). Chunk id is `{textbook_id}:{chunk_index}`.

### Storage

- Raw files are saved under a generated name, never the user's filename; the original name is kept only as metadata.
- Textbook records (status, hash, chunk count) live in SQLite, vectors in ChromaDB under `DATA_DIR`.
- Scanned PDFs without a text layer end up `FAILED` ("No extractable text"); OCR is not supported.

### Next: retrieval and generation over the textbook chunks

`ChunkRepository.search()` already does filtered similarity search. Answering questions from retrieved chunks (join them into a context string, call the native Google GenAI SDK's `generate_content`) is not built yet.

## Courses, sections, quizzes and memory

The endpoints the frontend uses are documented in [`app/controller/API.md`](app/controller/API.md).

```
courses ─1─∞─ materials
courses ─1─∞─ sections ─1─∞─ quizzes ─1─∞─ questions ─1─∞─ answers
                                   quizzes ─1─∞─ attempts ─1─∞─ answers
```

| Table | Columns |
|---|---|
| `courses` | name, `subject` (`Subject` enum: MATH, PHYSICS, CHEMISTRY, BIOLOGY, COMPUTER_SCIENCE, ENGLISH, HISTORY, GEOGRAPHY, ECONOMICS, OTHER) |
| `materials` | course_id, source_filename, `content` (JSON text Gemini wrote from an uploaded PDF) |
| `sections` | course_id, name. A section of a course; its quizzes are successive rounds |
| `quizzes` | section_id, created_at |
| `questions` | quiz_id, position, `type` (MULTIPLE_CHOICE / TRUE_FALSE), stem, options (JSON list), `answer_index`, explanation |
| `attempts` | quiz_id, submitted_at, `time_spent_seconds` (sent by the frontend, may be null), score, total |
| `answers` | attempt_id, question_id, selected_index, is_correct, answered_at |

The uploaded PDF is course material (slides, notes), not a quiz. The flow:

1. `POST /api/courses/{id}/materials` (PDF, max 20 MB): the PDF goes to Gemini as a native PDF part with `response_mime_type="application/json"` and no fixed schema, so Gemini works out the structure and writes the JSON itself. Stored in `materials`. The PDF itself is not kept.
2. `POST /api/sections/{id}/quizzes`: no parameters. Gemini gets all of the course's material JSON and writes `QUESTIONS_PER_QUIZ` (default 20) questions in `QUIZ_LANGUAGE` (default English, whatever language the material is in) in a fixed schema, **including the correct answer and an explanation** for each. Only multiple choice and true/false are generated, so grading is a comparison, no LLM needed. The response hides `answer_index` and `explanation`.
3. `POST /api/quizzes/{id}/submissions`: graded against the stored answer, saved as an `attempt` with its `answers`, and the response reveals the right answers and explanations. Unanswered questions are not recorded. An invalid submission (unknown question, duplicate, option out of range) stores nothing.
4. `GET /api/history` and `GET /api/attempts/{id}`: every attempt with score, accuracy and time spent, and one attempt in detail. `GET /api/courses/{id}/progress`: accuracy by question type and the mistakes still open.

**Memory is the raw answer history, not a summary.** Every time a quiz is generated, the questions the student still gets wrong **in that section** (stem, options, right answer, their answer, explanation) plus the section's per-type accuracy are re-read from the database and put into the prompt (at most `MISTAKE_REVIEW_LIMIT`, default 20). Gemini is asked to work out what the student probably does not understand and to aim at least half of the new questions there. A question answered wrongly and later correctly drops out. The frontend never sees any of this: it just asks for the next quiz. There are no concept or topic tables: nothing is inferred and stored, so nothing can drift or lose detail.

Deleting a course deletes its materials, sections, quizzes and attempts; deleting a section or a quiz deletes everything below it.

Errors: 409 if the course has no material, 413 if the material JSON is over `MAX_MATERIAL_CHARS`, 502 if Gemini fails or returns an invalid result (nothing is saved). Both Gemini calls are synchronous and can take several seconds. This path does not use ChromaDB.

CORS allows the Vite dev server (`http://localhost:5173`) and Electron's `file://` pages (origin `null`); change it with `CORS_ORIGINS` (a JSON list).

If you already have a `data/soquizzer.db` from an earlier version, delete it: tables are created but never migrated.

## Tests

```bash
pytest                          # everything; unit tests use fakes, no key needed
pytest -m integration -s        # integration tests only, -s prints the JSON Gemini produced
QUIZ_PDF_PATH=~/my_slides.pdf pytest -m integration -s     # try your own PDF
```

The integration tests (`tests/test_integration.py`) start the app on a real SQLite file (created on startup, no server or Docker), inspect every table with `sqlite3`, and check that materials, sections, quizzes, attempts and mistakes survive an app restart. The last one calls the real Gemini API for the whole flow (PDF -> material -> quiz -> wrong answers -> next quiz) and is skipped unless `GEMINI_API_KEY` is set (environment or `backend/.env`). It prints what Gemini produced and the path of the SQLite file.
