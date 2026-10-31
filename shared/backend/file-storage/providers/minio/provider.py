import io
from datetime import timedelta
from typing import BinaryIO
from django.conf import settings
from ..base import BaseStorageProvider

class MinioStorageProvider(BaseStorageProvider):
    """MinIO S3-compatible storage provider."""

    def __init__(self):
        self.endpoint = getattr(settings, "MINIO_ENDPOINT", "localhost:9000")
        self.access_key = getattr(settings, "MINIO_ACCESS_KEY", "minioadmin")
        self.secret_key = getattr(settings, "MINIO_SECRET_KEY", "minioadmin")
        self.bucket_name = getattr(settings, "MINIO_BUCKET_NAME", "ecosystem-files")
        self.secure = getattr(settings, "MINIO_SECURE", False)
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from minio import Minio
            self._client = Minio(
                self.endpoint,
                access_key=self.access_key,
                secret_key=self.secret_key,
                secure=self.secure,
            )
            if not self._client.bucket_exists(self.bucket_name):
                self._client.make_bucket(self.bucket_name)
        return self._client

    def save(self, file_obj: BinaryIO, storage_key: str, content_type: str) -> str:
        # Seek end to get size
        file_obj.seek(0, io.SEEK_END)
        size = file_obj.tell()
        file_obj.seek(0)
        self.client.put_object(
            self.bucket_name,
            storage_key,
            file_obj,
            size,
            content_type=content_type,
        )
        return storage_key

    def open(self, storage_key: str) -> BinaryIO:
        response = self.client.get_object(self.bucket_name, storage_key)
        return io.BytesIO(response.read())

    def delete(self, storage_key: str) -> bool:
        self.client.remove_object(self.bucket_name, storage_key)
        return True

    def exists(self, storage_key: str) -> bool:
        try:
            self.client.stat_object(self.bucket_name, storage_key)
            return True
        except Exception:
            return False

    def get_url(self, storage_key: str, expires_in: int = 3600) -> str:
        return self.client.presigned_get_object(
            self.bucket_name,
            storage_key,
            expires=timedelta(seconds=expires_in),
        )
