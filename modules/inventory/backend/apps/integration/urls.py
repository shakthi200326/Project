from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.integration.views import (
    IntegrationDashboardView,
    OutboxEventViewSet,
    ProcessedEventViewSet,
    IntegrationErrorViewSet,
    IntegrationSettingsView,
    StockInTransitViewSet,
    InboundEventWebhookView,
    SimulateIntegrationEventView,
)

router = DefaultRouter()
router.register(r"outbox", OutboxEventViewSet, basename="outbox")
router.register(r"inbox", ProcessedEventViewSet, basename="inbox")
router.register(r"errors", IntegrationErrorViewSet, basename="errors")
router.register(r"in-transit", StockInTransitViewSet, basename="in-transit")

urlpatterns = [
    path("dashboard/", IntegrationDashboardView.as_view(), name="integration-dashboard"),
    path("settings/", IntegrationSettingsView.as_view(), name="integration-settings"),
    path("webhook/", InboundEventWebhookView.as_view(), name="integration-webhook"),
    path("simulate/", SimulateIntegrationEventView.as_view(), name="integration-simulate"),
    path("", include(router.urls)),
]

