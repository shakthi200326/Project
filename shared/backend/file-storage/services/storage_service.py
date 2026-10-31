import uuid
from typing import BinaryIO, Optional
from django.conf import settings
from ..models.file_record import StoredFile
from ..services.validator import validate_uploaded_file
from ..providers.local.provider import LocalStorageProvider
from ..providers.minio.provider import MinioStorageProvider
from ..providers.s3.provider import S3StorageProvider

class FileStorageService:
    """Universal File Storage Coordinator."""

    @staticmethod
    def get_provider(provider_name: str = None):
        target = provider_name or getattr(settings, "STORAGE_PROVIDER", "local")
        if target == "minio":
            return MinioStorageProvider()
        elif target == "s3":
            return S3StorageProvider()
        return LocalStorageProvider()

    @classmethod
    def upload_file(
        cls,
        file_obj: BinaryIO,
        filename: str,
        owner_type: str,
        owner_id: str,
        uploaded_by: str = "",
        is_public: bool = False,
        provider_name: str = None,
        custom_metadata: dict = None,
    ) -> StoredFile:
        """Validates, stores physical bytes, and records database metadata."""
        meta = validate_uploaded_file(file_obj, filename)
        provider = cls.get_provider(provider_name)

        storage_key = f"{owner_type}/{owner_id}/{uuid.uuid4().hex[:12]}_{meta['safe_filename']}"
        provider.save(file_obj, storage_key, meta["mime_type"])

        record = StoredFile.objects.create(
            owner_type=owner_type,
            owner_id=owner_id,
            file_name=meta["safe_filename"],
            file_size=meta["file_size"],
            mime_type=meta["mime_type"],
            storage_provider=provider_name or getattr(settings, "STORAGE_PROVIDER", "local"),
            storage_key=storage_key,
            is_public=is_public,
            uploaded_by=uploaded_by,
            metadata=custom_metadata or {},
        )
        return record

    @classmethod
    def get_download_url(cls, stored_file: StoredFile, expires_in: int = 3600) -> str:
        provider = cls.get_provider(stored_file.storage_provider)
        return provider.get_url(stored_file.storage_key, expires_in=expires_in)

    @classmethod
    def delete_file(cls, stored_file: StoredFile) -> bool:
        provider = cls.get_provider(stored_file.storage_provider)
        provider.delete(stored_file.storage_key)
        stored_file.delete()
        return True
