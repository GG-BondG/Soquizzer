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
├── controller/   HTTP layer: routing, no business logic
├── service/      TextbookService, IngestionService (load -> chunk -> embed), CourseService, MaterialService, QuizService
├── repository/   SQLite repositories via SQLAlchemy (textbook, course, material, quiz, answer), ChunkRepository (ChromaDB)
├── entity/       Database models (Textbook, Course, Material, Quiz, Question, Answer)
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

## Courses, materials, quizzes and memory

```
courses ─1─∞─ materials
courses ─1─∞─ quizzes ─1─∞─ questions ─1─∞─ answers
```

| Table | Columns |
|---|---|
| `courses` | name, `subject` (`Subject` enum: MATH, PHYSICS, CHEMISTRY, BIOLOGY, COMPUTER_SCIENCE, ENGLISH, HISTORY, GEOGRAPHY, ECONOMICS, OTHER) |
| `materials` | course_id, source_filename, `content` (JSON text Gemini wrote from an uploaded PDF) |
| `quizzes` | course_id, created_at |
| `questions` | quiz_id, position, `type` (MULTIPLE_CHOICE / TRUE_FALSE), stem, options (JSON list), `answer_index`, explanation |
| `answers` | question_id, selected_index, is_correct, answered_at (answering again adds a row) |

The uploaded PDF is course material (slides, notes), not a quiz. The flow:

1. `POST /api/courses/{id}/materials` (PDF, max 20 MB): the PDF goes to Gemini as a native PDF part with `response_mime_type="application/json"` and no fixed schema, so Gemini works out the structure and writes the JSON itself. Stored in `materials`. The PDF itself is not kept.
2. `POST /api/courses/{id}/quizzes?num_questions=10` (1-50): Gemini gets all of the course's material JSON and writes questions in a fixed schema, **including the correct answer and an explanation** for each. Only multiple choice and true/false are generated, so grading is a comparison, no LLM needed. The response hides `answer_index` and `explanation`.
3. `POST /api/quizzes/{id}/submissions` `{"answers": [{"question_id", "selected_index"}]}`: graded against the stored answer, saved in `answers`, and the response reveals the right answers and explanations. Unanswered questions are not recorded. An invalid submission (unknown question, duplicate, option out of range) stores nothing.
4. `GET /api/courses/{id}/progress`: accuracy by question type (all answers) and the mistakes still open (questions whose latest answer is wrong, newest first, at most `MISTAKE_REVIEW_LIMIT`).

**Memory is the raw answer history, not a summary.** Every time a quiz is generated, the questions the student still gets wrong (stem, options, right answer, their answer, explanation) plus the per-type accuracy are re-read from the database and put into the prompt. Gemini is asked to work out what the student probably does not understand and to aim at least half of the new questions there. A question answered wrongly and later correctly drops out. There are no concept or topic tables: nothing is inferred and stored, so nothing can drift or lose detail.

Other endpoints: courses (`POST/GET /api/courses`, `GET/DELETE /api/courses/{id}`, deleting cascades to everything below it), `GET /api/courses/{id}/materials`, `GET/DELETE /api/materials/{id}`, `GET /api/courses/{id}/quizzes`, `GET/DELETE /api/quizzes/{id}`.

Errors: 409 if the course has no material, 413 if the material JSON is over `MAX_MATERIAL_CHARS`, 502 if Gemini fails or returns an invalid result (nothing is saved). Both Gemini calls are synchronous and can take several seconds. This path does not use ChromaDB.

If you ran an earlier version, delete `data/soquizzer.db`: the old `quizzes` table had different columns and tables are not migrated.

## Tests

```bash
pytest                          # everything; unit tests use fakes, no key needed
pytest -m integration -s        # integration tests only, -s prints the JSON Gemini produced
QUIZ_PDF_PATH=~/my_slides.pdf pytest -m integration -s     # try your own PDF
```

The integration tests (`tests/test_integration.py`) start the app on a real SQLite file (created on startup, no server or Docker), inspect every table with `sqlite3`, and check that materials, quizzes, answers and mistakes survive an app restart. The last one calls the real Gemini API for the whole flow (PDF -> material -> quiz -> wrong answers -> next quiz) and is skipped unless `GEMINI_API_KEY` is set (environment or `backend/.env`). It prints what Gemini produced and the path of the SQLite file.
