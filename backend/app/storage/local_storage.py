import hashlib
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from app.exception import FileTooLargeError

_READ_SIZE = 1024 * 1024


@dataclass(frozen=True)
class StoredFile:
    key: str
    size: int
    sha256: str


class LocalStorage:
    """Stores raw uploads on local disk under a generated key, never the user's filename."""

    def __init__(self, root: Path):
        self._root = root
        self._root.mkdir(parents=True, exist_ok=True)

    def save(self, source: BinaryIO, suffix: str, max_bytes: int) -> StoredFile:
        key = f"{uuid.uuid4().hex}{suffix}"
        path = self._root / key
        digest = hashlib.sha256()
        size = 0
        try:
            with path.open("wb") as out:
                while chunk := source.read(_READ_SIZE):
                    size += len(chunk)
                    if size > max_bytes:
                        raise FileTooLargeError(f"File exceeds the {max_bytes} byte upload limit")
                    digest.update(chunk)
                    out.write(chunk)
        except BaseException:
            path.unlink(missing_ok=True)
            raise
        return StoredFile(key=key, size=size, sha256=digest.hexdigest())

    def path(self, key: str) -> Path:
        return self._root / key

    def delete(self, key: str) -> None:
        (self._root / key).unlink(missing_ok=True)
