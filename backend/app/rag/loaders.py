from pathlib import Path

from langchain_core.documents import Document
from pypdf import PdfReader


def load_documents(path: Path) -> list[Document]:
    """One Document per PDF page (keeps page numbers for citations), one for a text file."""
    if path.suffix.lower() == ".pdf":
        reader = PdfReader(str(path))
        return [
            Document(page_content=page.extract_text() or "", metadata={"page": number})
            for number, page in enumerate(reader.pages, start=1)
        ]
    return [Document(page_content=path.read_text(encoding="utf-8"), metadata={})]
