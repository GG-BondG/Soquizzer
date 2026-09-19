# Soquizzer Backend

Python 3.11+ / FastAPI. Layered architecture: controller -> service -> repository.

## Run

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # set GOOGLE_API_KEY
uvicorn app.main:create_app --factory --reload
pytest
```

The app refuses to start without `GOOGLE_API_KEY` (Gemini embeddings and quiz generation). Tests use fakes and need no key.

Data lives under `DATA_DIR` (default `./data`): `soquizzer.db` (SQLite: textbooks, courses, quizzes) and `chroma/` (vectors). Both are local files, no Docker or database server needed.

## Layout

```
app/
├── controller/   HTTP layer: routing, no business logic
├── service/      TextbookService, IngestionService (load -> chunk -> embed), CourseService, QuizService
├── repository/   Textbook/Course/Quiz repositories (SQLite via SQLAlchemy), ChunkRepository (ChromaDB)
├── entity/       Database models (Textbook, Course, Quiz)
├── dto/          Request/response schemas, QuizContent (the quiz JSON shape)
├── llm/          GeminiQuizGenerator (native Google GenAI SDK)
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

## Courses and quizzes

`Course` (`name`, `subject`) has many `Quiz` rows. `subject` is the `Subject` enum in `entity/course.py`: MATH, PHYSICS, CHEMISTRY, BIOLOGY, COMPUTER_SCIENCE, ENGLISH, HISTORY, GEOGRAPHY, ECONOMICS, OTHER. `Quiz.content` is a JSON text column holding `QuizContent`:

```json
{"title": "...", "questions": [{"question": "...", "options": ["...", "...", "...", "..."], "answer_index": 1, "explanation": "..."}]}
```

Endpoints:

- `POST /api/courses` `{name, subject}`, `GET /api/courses`, `GET /api/courses/{id}`, `DELETE /api/courses/{id}` (also deletes its quizzes)
- `POST /api/courses/{id}/quizzes` multipart `file` (PDF) + optional `num_questions` (1-50, default 10) -> 201 with the quiz
- `GET /api/courses/{id}/quizzes`, `GET /api/quizzes/{id}`, `DELETE /api/quizzes/{id}`

Upload flow: `QuizController` -> `QuizService.create_from_pdf` (check PDF, max 20 MB) -> `GeminiQuizGenerator` (PDF sent to Gemini as a native PDF part, response constrained to the `QuizContent` JSON schema, then validated) -> `QuizRepository.add` (JSON text into SQLite). The call is synchronous and can take several seconds; the PDF itself is not stored. If Gemini fails or returns an invalid quiz the request returns 502 and nothing is saved. This path does not use ChromaDB.
