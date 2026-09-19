from pathlib import Path

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

_BATCH_SIZE = 100


class ChunkRepository:
    """Chunk vectors in ChromaDB. Every chunk carries its textbook_id in metadata."""

    def __init__(self, store: Chroma):
        self._store = store

    @classmethod
    def create(cls, collection: str, persist_dir: Path, embeddings: Embeddings) -> "ChunkRepository":
        store = Chroma(
            collection_name=collection,
            embedding_function=embeddings,
            persist_directory=str(persist_dir),
        )
        return cls(store)

    def add(self, chunks: list[Document]) -> None:
        for start in range(0, len(chunks), _BATCH_SIZE):
            batch = chunks[start : start + _BATCH_SIZE]
            self._store.add_documents(batch, ids=[chunk.id for chunk in batch])

    def delete_by_textbook(self, textbook_id: str) -> None:
        self._store.delete(where={"textbook_id": textbook_id})

    def search(self, query: str, k: int = 4, textbook_id: str | None = None) -> list[Document]:
        where = {"textbook_id": textbook_id} if textbook_id else None
        return self._store.similarity_search(query, k=k, filter=where)
