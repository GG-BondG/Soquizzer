# Soquizzer Backend

Assumed stack: Java + Spring Boot (layered architecture). Base package: `com.soquizzer`.

## Layout

```
backend/src/main/java/com/soquizzer/
├── controller/   HTTP layer: routing, request validation, no business logic
├── service/      Business logic: upload workflow (validate -> store -> persist)
├── storage/      File storage abstraction (local disk now, S3/OSS later)
├── repository/   Data access (Spring Data JPA interfaces)
├── entity/       Database models
├── dto/
│   ├── request/  Inbound payloads
│   └── response/ Outbound payloads (never expose entities directly)
├── config/       Spring config (upload limits, storage properties, CORS)
└── exception/    Custom exceptions + global exception handler
```

Tests mirror the main tree under `backend/src/test/java/com/soquizzer/`.

## File upload design

Flow for `POST /api/files` (multipart/form-data):

```
Client
  -> FileController          receives MultipartFile, returns FileResponse
  -> FileService             checks type/size, computes SHA-256, orchestrates
       -> StorageService     saves bytes, returns a storage key
       -> FileRepository     saves metadata as an UploadedFile entity
```

Planned classes (not yet created):

| Layer      | Class                     | Responsibility                                                   |
|------------|---------------------------|------------------------------------------------------------------|
| controller | `FileController`          | `POST /api/files`, `GET /api/files`, `GET /api/files/{id}`, `DELETE /api/files/{id}` |
| service    | `FileService`             | Validate, deduplicate by hash, coordinate storage + metadata     |
| storage    | `StorageService`          | Interface: `store`, `load`, `delete`                             |
| storage    | `LocalStorageService`     | Disk implementation; swap for a cloud one without touching callers |
| repository | `UploadedFileRepository`  | CRUD + lookup by content hash                                    |
| entity     | `UploadedFile`            | `id`, `originalName`, `contentType`, `size`, `sha256`, `storageKey`, `status`, `createdAt` |
| dto        | `FileResponse`            | Metadata returned to the client                                  |
| config     | `StorageProperties`       | Upload dir, max size, allowed content types                      |
| exception  | `GlobalExceptionHandler`  | Maps `InvalidFileException`, `FileNotFoundException`, etc. to HTTP errors |

Design decisions:

- Metadata lives in the DB, bytes live behind `StorageService`, so the storage backend can change without a schema change.
- Files are stored under a generated key, never the user-supplied filename (avoids path traversal and name collisions); the original name is kept only as metadata.
- `status` (`UPLOADED` -> `PARSED` -> ...) leaves room for the next stage, where course content is extracted and quizzes are generated from it.
