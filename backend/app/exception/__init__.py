from app.exception.errors import (
    AppError,
    ConfigurationError,
    DuplicateTextbookError,
    EmptyDocumentError,
    FileTooLargeError,
    TextbookNotFoundError,
    UnsupportedFileTypeError,
)
from app.exception.handlers import register_exception_handlers

__all__ = [
    "AppError",
    "ConfigurationError",
    "DuplicateTextbookError",
    "EmptyDocumentError",
    "FileTooLargeError",
    "TextbookNotFoundError",
    "UnsupportedFileTypeError",
    "register_exception_handlers",
]
