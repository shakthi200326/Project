import abc
from typing import BinaryIO, Optional

class BaseStorageProvider(abc.ABC):
    """Abstract storage provider interface."""

    @abc.abstractmethod
    def save(self, file_obj: BinaryIO, storage_key: str, content_type: str) -> str:
        """Save a file stream and return its storage key/path."""
        pass

    @abc.abstractmethod
    def open(self, storage_key: str) -> BinaryIO:
        """Open a file stream by storage key."""
        pass

    @abc.abstractmethod
    def delete(self, storage_key: str) -> bool:
        """Delete file from storage."""
        pass

    @abc.abstractmethod
    def exists(self, storage_key: str) -> bool:
        """Check if file exists in storage."""
        pass

    @abc.abstractmethod
    def get_url(self, storage_key: str, expires_in: int = 3600) -> str:
        """Generate a secure download URL or path."""
        pass
