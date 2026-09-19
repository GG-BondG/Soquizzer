import logging

from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.entity import TextbookStatus
from app.exception import EmptyDocumentError
from app.rag import build_splitter, chunk_documents, load_documents
from app.repository import ChunkRepository, TextbookRepository
from app.storage import LocalStorage

logger = logging.getLogger(__name__)


class IngestionService:
    """Load -> chunk -> embed and store. Runs after the upload response, with its own DB session."""

    def __init__(
        self,
        session_factory: sessionmaker[Session],
        chunks: ChunkRepository,
        storage: LocalStorage,
        settings: Settings,
    ):
        self._session_factory = session_factory
        self._chunks = chunks
        self._storage = storage
        self._splitter = build_splitter(settings.chunk_size, settings.chunk_overlap)

    def ingest(self, textbook_id: str) -> None:
        with self._session_factory() as session:
            textbooks = TextbookRepository(session)
            textbook = textbooks.get(textbook_id)
            if textbook is None:
                return
            try:
                documents = load_documents(self._storage.path(textbook.storage_key))
                chunks = chunk_documents(documents, self._splitter, textbook.id, textbook.original_name)
                if not chunks:
                    raise EmptyDocumentError("No extractable text found (scanned PDF?)")
                self._chunks.add(chunks)
                textbook.chunk_count = len(chunks)
                textbook.status = TextbookStatus.READY
            except Exception as exc:
                logger.exception("Ingestion failed for textbook %s", textbook_id)
                self._discard_partial_chunks(textbook_id)
                textbook.status = TextbookStatus.FAILED
                textbook.error = str(exc)[:500]
            textbooks.save(textbook)

    def _discard_partial_chunks(self, textbook_id: str) -> None:
        try:
            self._chunks.delete_by_textbook(textbook_id)
        except Exception:
            logger.exception("Could not clean up chunks for textbook %s", textbook_id)
