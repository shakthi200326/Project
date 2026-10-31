import os
import re
import unicodedata
from typing import BinaryIO
from django.core.exceptions import ValidationError

DEFAULT_MAX_UPLOAD_SIZE = 25 * 1024 * 1024  # 25 MB
MAX_FILENAME_LENGTH = 200

ALLOWED_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".json": "application/json",
}

MAGIC_SIGNATURES = (
    (b"%PDF-", "application/pdf"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"RIFF", "image/webp"),
    (b"PK\x03\x04", "application/zip"),  # Office formats & zip
)

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal or special character injection."""
    cleaned = unicodedata.normalize("NFKD", filename)
    cleaned = os.path.basename(cleaned)
    cleaned = re.sub(r"[^\w\.\-\_]", "_", cleaned)
    if len(cleaned) > MAX_FILENAME_LENGTH:
        name, ext = os.path.splitext(cleaned)
        cleaned = name[:MAX_FILENAME_LENGTH - len(ext)] + ext
    return cleaned

def validate_uploaded_file(file_obj: BinaryIO, filename: str, declared_content_type: str = "") -> dict:
    """
    Inspects file bytes, verifies magic numbers, extensions, and limits.
    Returns cleaned metadata dict or raises ValidationError.
    """
    safe_name = sanitize_filename(filename)
    ext = os.path.splitext(safe_name)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(f"File extension '{ext}' is not permitted.")

    # Size check
    file_obj.seek(0, os.SEEK_END)
    file_size = file_obj.tell()
    file_obj.seek(0)

    if file_size > DEFAULT_MAX_UPLOAD_SIZE:
        raise ValidationError(f"File size exceeds maximum allowed size of {DEFAULT_MAX_UPLOAD_SIZE // (1024*1024)}MB.")

    if file_size == 0:
        raise ValidationError("Empty files cannot be uploaded.")

    # Header check
    header = file_obj.read(32)
    file_obj.seek(0)

    inferred_mime = ALLOWED_EXTENSIONS[ext]

    # Verify binary signatures where applicable
    if ext in [".png", ".jpg", ".jpeg", ".pdf"]:
        matches = [mime for sig, mime in MAGIC_SIGNATURES if header.startswith(sig)]
        if not matches and ext != ".webp":
            raise ValidationError(f"File content does not match extension '{ext}'.")

    return {
        "safe_filename": safe_name,
        "file_size": file_size,
        "mime_type": inferred_mime,
        "extension": ext,
    }
