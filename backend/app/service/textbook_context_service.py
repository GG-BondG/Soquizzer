import logging

from app.entity import Textbook
from app.exception import LlmError
from app.rag import format_excerpts
from app.repository import ChunkRepository, CourseTextbookRepository

logger = logging.getLogger(__name__)


class TextbookContextService:
    """Retrieval for quiz generation: the textbook passages most relevant to a section and to what the student got wrong."""

    def __init__(self, links: CourseTextbookRepository, chunks: ChunkRepository, top_k: int, max_chars: int):
        self._links = links
        self._chunks = chunks
        self._top_k = top_k
        self._max_chars = max_chars

    def ready_textbooks(self, course_id: str) -> list[Textbook]:
        """The course's attached textbooks that finished ingesting (the others have no chunks to search yet)."""
        return self._links.list_textbooks(course_id, ready_only=True)

    def excerpts(self, textbooks: list[Textbook], queries: list[str], *, required: bool) -> list[tuple[str, str]]:
        """(title, text) pairs to add to the prompt. If searching fails, quiz generation goes on with the course's
        uploaded material unless the textbooks are all it has (required)."""
        if not textbooks:
            return []
        ids = [textbook.id for textbook in textbooks]
        try:
            found = [self._chunks.search_in(query, ids, self._top_k) for query in queries if query.strip()]
        except Exception as exc:
            if required:
                raise LlmError(f"Could not search the textbooks: {str(exc)[:300]}") from exc
            logger.warning("Textbook search failed, writing the quiz from the uploaded material only: %s", exc)
            return []
        return format_excerpts(found, self._max_chars)
