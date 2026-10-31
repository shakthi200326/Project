import uuid
from django.db import models
from django.utils import timezone

class StoredFile(models.Model):
    """
    Polymorphic file metadata record supporting ownership across:
    Platform, User, Organisation, Tenant, Company, Branch, Module, Business Record.
    """
    class StorageProvider(models.TextChoices):
        LOCAL = "local", "Local File System"
        MINIO = "minio", "MinIO S3"
        S3 = "s3", "Amazon S3"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_type = models.CharField(max_length=80, db_index=True)  # e.g. "inventory.item", "inventory.movement"
    owner_id = models.CharField(max_length=120, db_index=True)
    file_name = models.CharField(max_length=255)
    file_size = models.BigIntegerField()
    mime_type = models.CharField(max_length=120)
    storage_provider = models.CharField(max_length=20, choices=StorageProvider.choices, default=StorageProvider.LOCAL)
    storage_key = models.CharField(max_length=500, unique=True)
    is_public = models.BooleanField(default=False)
    uploaded_by = models.CharField(max_length=120, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shared_stored_files"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["owner_type", "owner_id"]),
        ]

    def __str__(self):
        return f"{self.file_name} ({self.owner_type}:{self.owner_id})"
