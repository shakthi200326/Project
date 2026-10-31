from pathlib import Path
from django.apps import AppConfig

class FileStorageConfig(AppConfig):
    name = "shared_file_storage"
    path = str(Path(__file__).resolve().parent)
    verbose_name = "Shared Universal File Storage"
    default_auto_field = "django.db.models.BigAutoField"
