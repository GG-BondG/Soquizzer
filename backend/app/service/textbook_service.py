from pathlib import Path
from typing import BinaryIO

from sqlalchemy.exc import IntegrityError

from app.entity import Textbook
from app.exception import DuplicateTextbookError, TextbookNotFoundError, UnsupportedFileTypeError
from app.repository import ChunkRepository, TextbookRepository
from app.storage import LocalStorage

ALLOWED_SUFFIXES = {".pdf", ".txt", ".md"}


class TextbookService:
    def __init__(
        self,
        textbooks: TextbookRepository,
        chunks: ChunkRepository,
        storage: LocalStorage,
        max_upload_bytes: int,
    ):
        self._textbooks = textbooks
        self._chunks = chunks
        self._storage = storage
        self._max_upload_bytes = max_upload_bytes

    def upload(self, source: BinaryIO, filename: str) -> Textbook:
        """Store the file and register it as PROCESSING; chunking happens in IngestionService."""
        name = Path(filename).name
        suffix = Path(name).suffix.lower()
        if suffix not in ALLOWED_SUFFIXES:
            raise UnsupportedFileTypeError(
                f"Unsupported file type '{suffix}'; allowed: {', '.join(sorted(ALLOWED_SUFFIXES))}"
            )

        stored = self._storage.save(source, suffix, self._max_upload_bytes)
        existing = self._textbooks.get_by_sha256(stored.sha256)
        if existing:
            self._storage.delete(stored.key)
            raise DuplicateTextbookError(f"This file was already uploaded as textbook {existing.id}")

        textbook = Textbook(
            original_name=name,
            size_bytes=stored.size,
            sha256=stored.sha256,
            storage_key=stored.key,
        )
        try:
            return self._textbooks.add(textbook)
        except IntegrityError:
            self._storage.delete(stored.key)
            raise DuplicateTextbookError("This file was already uploaded")

    def get(self, textbook_id: str) -> Textbook:
        textbook = self._textbooks.get(textbook_id)
        if textbook is None:
            raise TextbookNotFoundError(f"Textbook {textbook_id} not found")
        return textbook

    def list_all(self) -> list[Textbook]:
        return self._textbooks.list_all()

    def delete(self, textbook_id: str) -> None:
        textbook = self.get(textbook_id)
        self._chunks.delete_by_textbook(textbook.id)
        self._storage.delete(textbook.storage_key)
        self._textbooks.delete(textbook)
