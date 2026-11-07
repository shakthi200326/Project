from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.security_audit.views import (
    SecurityDashboardMetricsView,
    UserAccessViewSet,
    RoleViewSet,
    PermissionViewSet,
    WarehouseAccessViewSet,
    ActionPermissionsView,
    ActivityLogViewSet,
    DocumentAuditEventViewSet,
    DataChangeRecordViewSet,
)

router = DefaultRouter()
router.register(r"users", UserAccessViewSet, basename="sec-users")
router.register(r"roles", RoleViewSet, basename="sec-roles")
router.register(r"permissions", PermissionViewSet, basename="sec-permissions")
router.register(r"warehouse-access", WarehouseAccessViewSet, basename="sec-warehouse-access")
router.register(r"activity-logs", ActivityLogViewSet, basename="sec-activity-logs")
router.register(r"document-audit", DocumentAuditEventViewSet, basename="sec-document-audit")
router.register(r"data-changes", DataChangeRecordViewSet, basename="sec-data-changes")

urlpatterns = [
    path("dashboard/metrics/", SecurityDashboardMetricsView.as_view(), name="sec-dashboard-metrics"),
    path("actions/matrix/", ActionPermissionsView.as_view(), name="sec-actions-matrix"),
    path("", include(router.urls)),
]

