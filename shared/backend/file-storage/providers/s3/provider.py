from typing import BinaryIO
from django.conf import settings
from ..base import BaseStorageProvider

class S3StorageProvider(BaseStorageProvider):
    """AWS S3 storage provider using boto3."""

    def __init__(self):
        self.bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "ecosystem-files")
        self.region_name = getattr(settings, "AWS_REGION", "us-east-1")
        self._s3_client = None

    @property
    def client(self):
        if self._s3_client is None:
            import boto3
            self._s3_client = boto3.client("s3", region_name=self.region_name)
        return self._s3_client

    def save(self, file_obj: BinaryIO, storage_key: str, content_type: str) -> str:
        self.client.upload_fileobj(
            file_obj,
            self.bucket_name,
            storage_key,
            ExtraArgs={"ContentType": content_type},
        )
        return storage_key

    def open(self, storage_key: str) -> BinaryIO:
        import io
        buffer = io.BytesIO()
        self.client.download_fileobj(self.bucket_name, storage_key, buffer)
        buffer.seek(0)
        return buffer

    def delete(self, storage_key: str) -> bool:
        self.client.delete_object(Bucket=self.bucket_name, Key=storage_key)
        return True

    def exists(self, storage_key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=storage_key)
            return True
        except Exception:
            return False

    def get_url(self, storage_key: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": storage_key},
            ExpiresIn=expires_in,
        )
