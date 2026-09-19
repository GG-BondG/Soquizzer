from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Tried in order: paragraph, line, sentence end (English then Chinese), clause, word, character.
# A chunk is only cut mid-sentence when no coarser boundary fits in chunk_size.
SEPARATORS = ["\n\n", "\n", "。", "！", "？", ". ", "! ", "? ", "；", "; ", "，", ", ", " ", ""]

# Drops page numbers, running headers and other fragments that carry no meaning on their own.
MIN_CHUNK_CHARS = 30


def build_splitter(chunk_size: int, chunk_overlap: int) -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=SEPARATORS,
        keep_separator="end",
        add_start_index=True,
    )


def chunk_documents(
    documents: list[Document],
    splitter: RecursiveCharacterTextSplitter,
    textbook_id: str,
    filename: str,
) -> list[Document]:
    """Split pages into chunks with stable ids and the metadata needed to cite the source."""
    chunks: list[Document] = []
    for piece in splitter.split_documents(documents):
        text = piece.page_content.strip()
        if len(text) < MIN_CHUNK_CHARS:
            continue
        index = len(chunks)
        metadata = {
            "textbook_id": textbook_id,
            "filename": filename,
            "chunk_index": index,
            "start_index": piece.metadata["start_index"],
        }
        if "page" in piece.metadata:
            metadata["page"] = piece.metadata["page"]
        chunks.append(Document(id=f"{textbook_id}:{index}", page_content=text, metadata=metadata))
    return chunks
