from langchain_core.documents import Document


def label(chunk: Document) -> str:
    """'[bio.pdf, p.3]': the file and, for a PDF, the page. Gemini uses it as the question's anchor_section."""
    name = chunk.metadata.get("filename", "textbook")
    page = chunk.metadata.get("page")
    return f"[{name}, p.{page}]" if page is not None else f"[{name}]"


def format_excerpts(found: list[list[Document]], max_chars: int) -> list[tuple[str, str]]:
    """Merge search results into one (title, text) pair per textbook, ready to sit beside the course material.

    A chunk found by several searches appears once. Chunks are kept in reading order inside a textbook, and results
    of earlier searches win when the character budget runs out (the first search is the one about the section itself).
    """
    seen: set[tuple[str, int]] = set()
    kept: list[Document] = []
    used = 0
    for results in found:
        for chunk in results:
            key = (chunk.metadata.get("textbook_id", ""), chunk.metadata.get("chunk_index", -1))
            if key in seen:
                continue
            if used + len(chunk.page_content) > max_chars:
                continue
            seen.add(key)
            kept.append(chunk)
            used += len(chunk.page_content)

    by_textbook: dict[str, list[Document]] = {}
    for chunk in kept:
        by_textbook.setdefault(chunk.metadata.get("textbook_id", ""), []).append(chunk)
    excerpts = []
    for chunks in by_textbook.values():
        chunks.sort(key=lambda c: c.metadata.get("chunk_index", 0))
        name = chunks[0].metadata.get("filename", "textbook")
        text = "\n\n".join(f"{label(chunk)}\n{chunk.page_content}" for chunk in chunks)
        excerpts.append((f"{name} (textbook excerpts)", text))
    return excerpts
