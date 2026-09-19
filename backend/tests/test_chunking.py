from langchain_core.documents import Document

from app.rag import build_splitter, chunk_documents

SPLITTER = build_splitter(chunk_size=100, chunk_overlap=20)


def test_chunks_respect_size_and_carry_metadata():
    text = " ".join(f"Sentence number {i} explains a concept." for i in range(30))
    chunks = chunk_documents([Document(page_content=text, metadata={"page": 7})], SPLITTER, "tb1", "book.pdf")

    assert len(chunks) > 1
    assert all(len(c.page_content) <= 100 for c in chunks)
    assert [c.metadata["chunk_index"] for c in chunks] == list(range(len(chunks)))
    assert all(c.id == f"tb1:{c.metadata['chunk_index']}" for c in chunks)
    assert all(c.metadata["page"] == 7 and c.metadata["filename"] == "book.pdf" for c in chunks)


def test_consecutive_chunks_overlap():
    text = " ".join(f"word{i}" for i in range(80))
    chunks = chunk_documents([Document(page_content=text)], SPLITTER, "tb1", "a.txt")

    first_tail = chunks[0].page_content.split()[-1]
    assert first_tail in chunks[1].page_content.split()


def test_prefers_sentence_boundaries():
    text = "Photosynthesis converts light into chemical energy. " * 6
    chunks = chunk_documents([Document(page_content=text)], SPLITTER, "tb1", "a.txt")

    assert all(c.page_content.endswith(".") for c in chunks)


def test_splits_chinese_at_sentence_end():
    text = "光合作用是植物把光能转化为化学能的过程。" * 10
    chunks = chunk_documents([Document(page_content=text)], SPLITTER, "tb1", "a.txt")

    assert len(chunks) > 1
    assert all(c.page_content.endswith("。") for c in chunks)


def test_drops_tiny_fragments_and_omits_page_for_plain_text():
    pages = [Document(page_content="42", metadata={"page": 1})]
    assert chunk_documents(pages, SPLITTER, "tb1", "a.pdf") == []

    chunks = chunk_documents([Document(page_content="A long enough sentence to keep as a chunk.")], SPLITTER, "tb1", "a.txt")
    assert "page" not in chunks[0].metadata
