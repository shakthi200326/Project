import os
import shutil
from pathlib import Path
from typing import BinaryIO
from django.conf import settings
from ..base import BaseStorageProvider

class LocalStorageProvider(BaseStorageProvider):
    """Local filesystem storage provider."""

    def __init__(self, root_dir: str = None):
        self.root_dir = Path(root_dir or getattr(settings, "LOCAL_STORAGE_ROOT", "uploads"))
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, storage_key: str) -> Path:
        clean_key = storage_key.lstrip("/\\")
        full_path = (self.root_dir / clean_key).resolve()
        if not str(full_path).startswith(str(self.root_dir.resolve())):
            raise ValueError("Path traversal attempt detected")
        return full_path

    def save(self, file_obj: BinaryIO, storage_key: str, content_type: str) -> str:
        dest_path = self._resolve_path(storage_key)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(file_obj, f)
        return storage_key

    def open(self, storage_key: str) -> BinaryIO:
        dest_path = self._resolve_path(storage_key)
        if not dest_path.is_file():
            raise FileNotFoundError(f"File {storage_key} not found")
        return open(dest_path, "rb")

    def delete(self, storage_key: str) -> bool:
        dest_path = self._resolve_path(storage_key)
        if dest_path.is_file():
            dest_path.unlink()
            return True
        return False

    def exists(self, storage_key: str) -> bool:
        return self._resolve_path(storage_key).is_file()

    def get_url(self, storage_key: str, expires_in: int = 3600) -> str:
        return f"/api/v1/storage/files/download/{storage_key}"
