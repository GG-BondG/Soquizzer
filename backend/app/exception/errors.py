class AppError(Exception):
    status_code = 500

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class ConfigurationError(AppError):
    status_code = 500


class TextbookNotFoundError(AppError):
    status_code = 404


class DuplicateTextbookError(AppError):
    status_code = 409


class FileTooLargeError(AppError):
    status_code = 413


class UnsupportedFileTypeError(AppError):
    status_code = 415


class EmptyDocumentError(AppError):
    status_code = 422
