from app.exception.errors import (
    AppError,
    ConfigurationError,
    CourseNotFoundError,
    DuplicateTextbookError,
    EmptyDocumentError,
    FileTooLargeError,
    QuizGenerationError,
    QuizNotFoundError,
    TextbookNotFoundError,
    UnsupportedFileTypeError,
)
from app.exception.handlers import register_exception_handlers

__all__ = [
    "AppError",
    "ConfigurationError",
    "CourseNotFoundError",
    "DuplicateTextbookError",
    "EmptyDocumentError",
    "FileTooLargeError",
    "QuizGenerationError",
    "QuizNotFoundError",
    "TextbookNotFoundError",
    "UnsupportedFileTypeError",
    "register_exception_handlers",
]
