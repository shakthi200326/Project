from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/inventory/", include("api.urls")),
    path("api/v1/storage/", include("shared_file_storage.api.urls")),
]


