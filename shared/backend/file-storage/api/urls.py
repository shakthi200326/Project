from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import FileDownloadView, StoredFileViewSet

router = DefaultRouter()
router.register(r"files", StoredFileViewSet, basename="stored-file")

urlpatterns = [
    path("", include(router.urls)),
    path("download/<uuid:file_id>/", FileDownloadView.as_view(), name="file-download"),
]
