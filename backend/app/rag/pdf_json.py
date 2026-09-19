import io
import json
import logging
import re

from pypdf import PdfReader

from app.exception import EmptyDocumentError
from app.rag.ocr import MIN_CHARS_PER_PAGE, PageOcr

logger = logging.getLogger(__name__)


class LocalPdfJsonConverter:
    """Turns a PDF into JSON without a model: the text layer is read locally, page by page (fast, and it can neither
    drop nor invent content). Only a scan with no text layer goes to `ocr` (Gemini reads the page images).

    {"page_count": 12,
     "outline": [{"title": "Cells", "page": 3, "level": 1}],   # only when the PDF has bookmarks
     "pages": [{"page": 1, "text": "..."}]}                     # pages with text; numbers are the PDF's own
    """

    def __init__(self, ocr: PageOcr | None = None):
        self._ocr = ocr

    def convert(self, pdf: bytes) -> str:
        reader = _open(pdf)
        texts = [_clean(_page_text(page, number)) for number, page in enumerate(reader.pages, start=1)]
        scanned = sum(len(text) for text in texts) < MIN_CHARS_PER_PAGE * len(texts)
        if scanned:
            if self._ocr is None:
                raise EmptyDocumentError("No extractable text found (scanned PDF, and OCR is disabled)")
            logger.info("PDF has no text layer; reading it with OCR")
            texts = [_clean(text) for text in self._ocr.transcribe(pdf)]

        pages = [{"page": number, "text": text} for number, text in enumerate(texts, start=1) if text]
        if not pages:
            raise EmptyDocumentError("No extractable text found" + (", even after OCR" if scanned else ""))

        document: dict = {"page_count": len(texts)}
        outline = _outline(reader)
        if outline:
            document["outline"] = outline
        document["pages"] = pages
        return json.dumps(document, ensure_ascii=False, separators=(",", ":"))


def _open(pdf: bytes) -> PdfReader:
    try:
        reader = PdfReader(io.BytesIO(pdf))
        if reader.is_encrypted and not reader.decrypt(""):
            raise ValueError("password-protected")
        if not reader.pages:
            raise ValueError("no pages")
    except Exception as exc:
        raise EmptyDocumentError(f"Could not read the PDF (corrupted or password-protected): {str(exc)[:200]}") from exc
    return reader


def _page_text(page, number: int) -> str:
    try:
        return page.extract_text() or ""
    except Exception:
        logger.warning("Could not extract the text of page %d", number, exc_info=True)
        return ""


def _clean(text: str) -> str:
    text = text.replace("\x00", "").encode("utf-8", "ignore").decode("utf-8")  # lone surrogates break UTF-8 storage
    text = "\n".join(line.rstrip() for line in text.splitlines())
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _outline(reader: PdfReader) -> list[dict]:
    """The PDF's bookmarks, flattened in reading order with their nesting level. Empty if there are none."""
    items: list[dict] = []
    total = len(reader.pages)

    def walk(nodes: list, level: int) -> None:
        for node in nodes:
            if isinstance(node, list):
                walk(node, level + 1)
                continue
            try:
                index = reader.get_destination_page_number(node)
            except Exception:
                continue  # a bookmark that points nowhere
            title = str(node.title or "").strip()
            if title and index is not None and 0 <= index < total:
                items.append({"title": title, "page": index + 1, "level": level})

    try:
        walk(reader.outline, 1)
    except Exception:
        logger.warning("Could not read the PDF outline", exc_info=True)
    return items
