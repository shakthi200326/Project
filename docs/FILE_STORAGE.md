# Universal File Storage Specification

## 1. Provider Implementations

Located in `shared/backend/file-storage/providers/`:
- **Local Provider (`providers/local/`)**: Writes to `uploads/` path using hashed subdirectories (`uploads/ab/cd/<uuid>`).
- **MinIO Provider (`providers/minio/`)**: Uses MinIO Python SDK for local containerized S3 storage.
- **S3 Provider (`providers/s3/`)**: Uses `boto3` with pre-signed URL generation and server-side encryption.

## 2. Polymorphic Ownership Model

The `shared_files` table captures:
- `id` (UUID PK)
- `owner_type` (CharField): E.g., `inventory.item`, `inventory.movement`, `inventory.count`, `platform.user`
- `owner_id` (CharField): ID of the owning entity
- `file_name` (CharField): Sanitized original file name
- `file_size` (BigIntegerField): File size in bytes
- `mime_type` (CharField): Sniffed and verified MIME type
- `storage_provider` (CharField): `local`, `minio`, or `s3`
- `storage_key` (CharField): Path or S3 object key
- `is_public` (BooleanField): Whether access requires signed authentication
- `uploaded_by` (CharField): User identifier
- `created_at` (DateTimeField)

## 3. Security Inspection Pipeline

All uploads pass through `shared/backend/file-storage/services/validator.py`:
1. Safe filename sanitization (Unicode normalization, path traversal prevention).
2. Extension allowlist (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.csv`, `.xlsx`, `.docx`).
3. Magic byte signature verification (verifying `%PDF-`, PNG, JPEG headers).
4. Maximum file size enforcement (25 MB default).

