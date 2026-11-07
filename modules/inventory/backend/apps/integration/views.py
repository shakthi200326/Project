import logging
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from django.db.models import Count, Q

from apps.integration.models import (
    OutboxEvent,
    ProcessedEvent,
    EventProcessingAttempt,
    IntegrationSubscription,
    IntegrationSettings,
    IntegrationError,
)
from apps.stock.models import StockInTransit
from apps.integration.serializers import (
    OutboxEventSerializer,
    ProcessedEventSerializer,
    IntegrationSubscriptionSerializer,
    IntegrationSettingsSerializer,
    IntegrationErrorSerializer,
    StockInTransitSerializer,
    NotificationSettingsSerializer,
    InventoryAlertSerializer,
)
from apps.integration.models import InventoryAlert, NotificationSettings
from apps.integration.services.outbox_service import OutboxService
from apps.integration.services.inbox_service import InboxConsumerService
from apps.integration.services.event_contracts import CloudEventSchema

logger = logging.getLogger("ecosystem.integration.api")


class IntegrationDashboardView(APIView):
    """
    Returns aggregated metrics for the Integration Dashboard.
    """
    def get(self, request):
        now = timezone.now()

        # Outbox stats
        outbox_stats = OutboxEvent.objects.aggregate(
            total=Count("id"),
            pending=Count("id", filter=Q(status=OutboxEvent.Status.PENDING)),
            published=Count("id", filter=Q(status=OutboxEvent.Status.PUBLISHED)),
            failed=Count("id", filter=Q(status=OutboxEvent.Status.FAILED)),
        )

        # Inbox stats
        inbox_stats = ProcessedEvent.objects.aggregate(
            total=Count("id"),
            processed=Count("id", filter=Q(status=ProcessedEvent.Status.PROCESSED)),
            processing=Count("id", filter=Q(status=ProcessedEvent.Status.PROCESSING)),
            failed=Count("id", filter=Q(status=ProcessedEvent.Status.FAILED)),
            dead_letter=Count("id", filter=Q(status=ProcessedEvent.Status.DEAD_LETTER)),
        )

        # DLQ stats
        dlq_stats = IntegrationError.objects.aggregate(
            total=Count("id"),
            unresolved=Count("id", filter=Q(status=IntegrationError.Status.UNRESOLVED)),
            resolved=Count("id", filter=Q(status=IntegrationError.Status.RESOLVED)),
        )

        # Transit stats
        transit_active = StockInTransit.objects.filter(status=StockInTransit.Status.IN_TRANSIT).count()

        # Recent activities
        recent_outbox = OutboxEventSerializer(
            OutboxEvent.objects.order_by("-created_at")[:5], many=True
        ).data
        recent_inbox = ProcessedEventSerializer(
            ProcessedEvent.objects.order_by("-created_at")[:5], many=True
        ).data
        recent_errors = IntegrationErrorSerializer(
            IntegrationError.objects.filter(status=IntegrationError.Status.UNRESOLVED).order_by("-created_at")[:5],
            many=True,
        ).data

        settings = IntegrationSettings.get_settings()

        return Response({
            "outbox": outbox_stats,
            "inbox": inbox_stats,
            "dlq": dlq_stats,
            "in_transit_count": transit_active,
            "settings": IntegrationSettingsSerializer(settings).data,
            "recent_outbox": recent_outbox,
            "recent_inbox": recent_inbox,
            "recent_errors": recent_errors,
        })


class OutboxEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OutboxEvent.objects.order_by("-created_at")
    serializer_class = OutboxEventSerializer
    search_fields = ["event_id", "event_type", "aggregate_id", "correlation_id"]
    filterset_fields = ["status", "event_type"]

    @action(detail=False, methods=["post"], url_path="drain")
    def drain(self, request):
        """Force manual drain of pending outbox events."""
        count = OutboxService.drain_pending_events(batch_size=100)
        return Response({"status": "SUCCESS", "published_count": count})

    @action(detail=True, methods=["post"], url_path="publish-now")
    def publish_now(self, request, pk=None):
        """Force immediate publish of a single outbox event."""
        event = self.get_object()
        settings = IntegrationSettings.get_settings()
        success = OutboxService._publish_single_event(event, settings)
        return Response({"status": "SUCCESS" if success else "FAILED", "event_id": event.event_id})


class ProcessedEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProcessedEvent.objects.prefetch_related("attempts").order_by("-created_at")
    serializer_class = ProcessedEventSerializer
    search_fields = ["event_id", "event_type", "correlation_id"]
    filterset_fields = ["status", "event_type", "event_source"]


class IntegrationErrorViewSet(viewsets.ModelViewSet):
    queryset = IntegrationError.objects.order_by("-created_at")
    serializer_class = IntegrationErrorSerializer
    search_fields = ["event_id", "event_type", "error_message"]
    filterset_fields = ["status", "direction", "event_type"]

    @action(detail=True, methods=["post"], url_path="retry")
    def retry_error(self, request, pk=None):
        """Manually retries a failed event from the dead-letter queue."""
        error = self.get_object()
        user = str(request.user if request.user and request.user.is_authenticated else "operator")
        success = OutboxService.retry_dead_letter_event(str(error.id), resolved_by=user)
        if success:
            return Response({"status": "SUCCESS", "message": "Event retried and successfully published."})
        return Response({"status": "FAILED", "message": "Event retry attempted but failed again."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve_error(self, request, pk=None):
        """Manually mark an error as resolved/ignored."""
        error = self.get_object()
        notes = request.data.get("notes", "Manually resolved by administrator.")
        error.status = IntegrationError.Status.RESOLVED
        error.resolved_by = str(request.user if request.user and request.user.is_authenticated else "operator")
        error.resolved_at = timezone.now()
        error.resolution_notes = notes
        error.save()
        return Response({"status": "RESOLVED", "id": str(error.id)})


class IntegrationSettingsView(APIView):
    def get(self, request):
        settings = IntegrationSettings.get_settings()
        return Response(IntegrationSettingsSerializer(settings).data)

    def put(self, request):
        settings = IntegrationSettings.get_settings()
        serializer = IntegrationSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NotificationSettingsView(APIView):
    def get(self, request):
        config = NotificationSettings.get_settings()
        return Response(NotificationSettingsSerializer(config).data)

    def put(self, request):
        config = NotificationSettings.get_settings()
        serializer = NotificationSettingsSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InventoryAlertListView(APIView):
    def get(self, request):
        config = NotificationSettings.get_settings()
        if not config.channels.get("in_app", True):
            return Response({"count": 0, "next": None, "previous": None, "results": [], "unread_count": 0})
        alerts = InventoryAlert.objects.all()
        alert_type = request.query_params.get("type")
        active = request.query_params.get("active")
        unread = request.query_params.get("unread")
        if alert_type:
            alerts = alerts.filter(alert_type=alert_type)
        if active in ("true", "false"):
            alerts = alerts.filter(is_active=active == "true")
        if unread == "true":
            alerts = alerts.filter(is_read=False)
        alerts = alerts.order_by("-last_seen_at", "-id")
        page = self.paginate_queryset(alerts, request)
        data = InventoryAlertSerializer(page, many=True).data
        response = self.get_paginated_response(data)
        response.data["unread_count"] = InventoryAlert.objects.filter(is_read=False, is_active=True).count()
        return response

    def paginate_queryset(self, queryset, request):
        from rest_framework.pagination import PageNumberPagination
        self.paginator = PageNumberPagination()
        self.paginator.page_size = 50
        return self.paginator.paginate_queryset(queryset, request, view=self)

    def get_paginated_response(self, data):
        return self.paginator.get_paginated_response(data)


class InventoryAlertReadView(APIView):
    def post(self, request, alert_id=None):
        if alert_id is None:
            InventoryAlert.objects.filter(is_read=False).update(is_read=True)
            return Response({"marked_read": "all"})
        alert = InventoryAlert.objects.filter(pk=alert_id).first()
        if alert is None:
            return Response({"detail": "Alert not found."}, status=status.HTTP_404_NOT_FOUND)
        alert.is_read = True
        alert.save(update_fields=["is_read"])
        return Response(InventoryAlertSerializer(alert).data)


class StockInTransitViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockInTransit.objects.select_related("item", "source_warehouse", "destination_warehouse").order_by("-dispatched_at")
    serializer_class = StockInTransitSerializer
    search_fields = ["transfer_number", "item__code", "tracking_number"]
    filterset_fields = ["status", "source_warehouse", "destination_warehouse"]


class InboundEventWebhookView(APIView):
    """
    HTTP Webhook Endpoint for receiving external CloudEvents packets.
    Passes directly into the idempotent InboxConsumerService.
    """
    def post(self, request):
        packet = request.data
        if not isinstance(packet, dict):
            return Response({"error": "Payload must be a JSON object."}, status=status.HTTP_400_BAD_REQUEST)

        # Allow raw payload to be wrapped in CloudEvents if necessary
        if "type" not in packet and "event_type" in packet:
            packet = CloudEventSchema.create_event(
                event_type=packet["event_type"],
                payload=packet.get("payload") or packet.get("data") or {},
                source=packet.get("source", "external.webhook"),
                tenant_id=packet.get("tenant_id", "default-tenant"),
                project_id=packet.get("project_id", "prj-default"),
                correlation_id=packet.get("correlation_id"),
            )

        result = InboxConsumerService.receive_event(packet)
        status_code = status.HTTP_200_OK if result.get("status") in ("SUCCESS", "ALREADY_PROCESSED") else status.HTTP_400_BAD_REQUEST
        return Response(result, status=status_code)


class SimulateIntegrationEventView(APIView):
    """
    Simulation utility for testing Purchase and Sales integrations interactively.
    """
    def post(self, request):
        event_name = request.data.get("event_type")
        payload = request.data.get("payload", {})
        tenant_id = request.data.get("tenant_id", "default-tenant")
        project_id = request.data.get("project_id", "prj-default")

        packet = CloudEventSchema.create_event(
            event_type=event_name,
            payload=payload,
            source="integration.test_simulator",
            tenant_id=tenant_id,
            project_id=project_id,
        )

        result = InboxConsumerService.receive_event(packet)
        return Response(result)
