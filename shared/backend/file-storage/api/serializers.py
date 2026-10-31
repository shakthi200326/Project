from rest_framework import serializers
from ..models.file_record import StoredFile

class StoredFileSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = StoredFile
        fields = [
            "id",
            "owner_type",
            "owner_id",
            "file_name",
            "file_size",
            "mime_type",
            "storage_provider",
            "storage_key",
            "is_public",
            "uploaded_by",
            "metadata",
            "download_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "storage_key", "created_at", "updated_at", "download_url"]

    def get_download_url(self, obj):
        from ..services.storage_service import FileStorageService
        try:
            return FileStorageService.get_download_url(obj)
        except Exception:
            return ""

