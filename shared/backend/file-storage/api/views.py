import mimetypes
from pathlib import Path
from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework import status, views, viewsets
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from ..models.file_record import StoredFile
from ..services.storage_service import FileStorageService
from .serializers import StoredFileSerializer

class StoredFileViewSet(viewsets.ModelViewSet):
    """
    CRUD API for universal polymorphic file attachments.
    Supports filtering by ?owner_type=inventory.item&owner_id=123
    """
    queryset = StoredFile.objects.all()
    serializer_class = StoredFileSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        qs = super().get_queryset()
        owner_type = self.request.query_params.get("owner_type")
        owner_id = self.request.query_params.get("owner_id")
        if owner_type:
            qs = qs.filter(owner_type=owner_type)
        if owner_id:
            qs = qs.filter(owner_id=owner_id)
        return qs

    def create(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "No file provided under key 'file'"}, status=status.HTTP_400_BAD_REQUEST)

        owner_type = request.data.get("owner_type", "general")
        owner_id = request.data.get("owner_id", "unassigned")
        is_public = str(request.data.get("is_public", "false")).lower() in ("true", "1")
        uploaded_by = request.data.get("uploaded_by", getattr(request.user, "username", "system"))

        try:
            record = FileStorageService.upload_file(
                file_obj=uploaded_file,
                filename=uploaded_file.name,
                owner_type=owner_type,
                owner_id=owner_id,
                uploaded_by=uploaded_by,
                is_public=is_public,
            )
            serializer = self.get_serializer(record)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValueError as err:
            return Response({"error": str(err)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as err:
            return Response({"error": f"Upload failed: {str(err)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            FileStorageService.delete_file(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as err:
            return Response({"error": str(err)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class FileDownloadView(views.APIView):
    """
    Serves physical file content for local storage or redirects to pre-signed URL.
    """
    def get(self, request, file_id):
        try:
            record = StoredFile.objects.get(id=file_id)
        except (StoredFile.DoesNotExist, ValueError):
            raise Http404("File not found")

        provider = FileStorageService.get_provider(record.storage_provider)
        if record.storage_provider == "local":
            root = getattr(settings, "LOCAL_STORAGE_ROOT", str(Path(settings.BASE_DIR) / "uploads"))
            target_path = Path(root) / record.storage_key
            if not target_path.exists():
                raise Http404("Physical file missing on server")
            response = FileResponse(open(target_path, "rb"), content_type=record.mime_type)
            response["Content-Disposition"] = f'inline; filename="{record.file_name}"'
            return response
        else:
            url = provider.get_url(record.storage_key)
            from django.shortcuts import redirect
            return redirect(url)

