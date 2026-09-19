from typing import Protocol


class PdfJsonConverter(Protocol):
    def convert(self, pdf: bytes) -> str:
        """Return the PDF's content as JSON text."""
        ...
