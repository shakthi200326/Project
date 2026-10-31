import io
from pathlib import Path
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from shared_file_storage.models.file_record import StoredFile
from shared_file_storage.services.storage_service import FileStorageService

class UniversalFileStorageTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_file_upload_and_lifecycle(self):
        # Create a valid test PDF file (with %PDF- header)
        pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF"
        dummy_file = SimpleUploadedFile("spec_sheet.pdf", pdf_content, content_type="application/pdf")

        # 1. Test Service Upload
        record = FileStorageService.upload_file(
            file_obj=dummy_file,
            filename="spec_sheet.pdf",
            owner_type="inventory.product",
            owner_id="PROD-TEST-001",
            uploaded_by="qa_engineer",
            is_public=False,
            custom_metadata={"specification_version": "v1.2"},
        )
        self.assertIsNotNone(record.id)
        self.assertEqual(record.owner_type, "inventory.product")
        self.assertEqual(record.owner_id, "PROD-TEST-001")
        self.assertEqual(record.mime_type, "application/pdf")
        self.assertEqual(record.metadata.get("specification_version"), "v1.2")

        # 2. Test API List with owner filters
        response = self.client.get("/api/v1/storage/files/?owner_type=inventory.product&owner_id=PROD-TEST-001")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["file_name"], "spec_sheet.pdf")

        # 3. Test Download URL generation
        download_url = record.metadata.get("download_url") or FileStorageService.get_download_url(record)
        self.assertTrue(len(download_url) > 0)

        # 4. Test API Download View
        download_response = self.client.get(f"/api/v1/storage/download/{record.id}/")
        self.assertEqual(download_response.status_code, 200)
        self.assertEqual(download_response["Content-Type"], "application/pdf")
        content_bytes = b"".join(download_response.streaming_content)
        self.assertIn(b"%PDF-1.4", content_bytes)

        # 5. Test Cleanup
        FileStorageService.delete_file(record)
        self.assertFalse(StoredFile.objects.filter(id=record.id).exists())
