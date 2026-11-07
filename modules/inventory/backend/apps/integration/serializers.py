from rest_framework import serializers
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from apps.integration.models import (
    OutboxEvent,
    ProcessedEvent,
    EventProcessingAttempt,
    IntegrationSubscription,
    IntegrationSettings,
    IntegrationError,
    InventoryAlert,
    NotificationSettings,
)
from apps.stock.models import StockInTransit


class OutboxEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = OutboxEvent
        fields = "__all__"


class EventProcessingAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventProcessingAttempt
        fields = "__all__"


class ProcessedEventSerializer(serializers.ModelSerializer):
    attempts = EventProcessingAttemptSerializer(many=True, read_only=True)

    class Meta:
        model = ProcessedEvent
        fields = "__all__"


class IntegrationSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntegrationSubscription
        fields = "__all__"


class IntegrationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntegrationSettings
        fields = "__all__"


class NotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationSettings
        fields = (
            "alert_types",
            "channels",
            "recipient_emails",
            "webhook_url",
            "expiry_warning_days",
            "pending_receipt_days",
            "pending_approval_hours",
            "updated_at",
        )
        read_only_fields = ("updated_at",)

    def validate_alert_types(self, value):
        keys = {
            "low_stock",
            "out_of_stock",
            "expiry",
            "overstock",
            "pending_receipt",
            "pending_approval",
            "stock_discrepancy",
        }
        if not isinstance(value, dict) or set(value) != keys or not all(isinstance(v, bool) for v in value.values()):
            raise serializers.ValidationError("Provide a boolean value for every supported alert type.")
        return value

    def validate_channels(self, value):
        keys = {"in_app", "email", "webhook"}
        if not isinstance(value, dict) or set(value) != keys or not all(isinstance(v, bool) for v in value.values()):
            raise serializers.ValidationError("Provide a boolean value for in_app, email, and webhook.")
        return value

    def validate_recipient_emails(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Recipient emails must be a list.")
        for email in value:
            try:
                validate_email(email)
            except (DjangoValidationError, TypeError):
                raise serializers.ValidationError(f"Invalid email address: {email}")
        return value

    def validate_webhook_url(self, value):
        if value and not value.lower().startswith("https://"):
            raise serializers.ValidationError("Webhook URL must use HTTPS.")
        return value

    def validate(self, attrs):
        channels = attrs.get("channels", getattr(self.instance, "channels", {}))
        recipients = attrs.get("recipient_emails", getattr(self.instance, "recipient_emails", []))
        webhook_url = attrs.get("webhook_url", getattr(self.instance, "webhook_url", ""))
        if channels.get("email") and not recipients:
            raise serializers.ValidationError({"recipient_emails": "Add at least one recipient when email notifications are enabled."})
        if channels.get("webhook") and not webhook_url:
            raise serializers.ValidationError({"webhook_url": "Add a webhook URL when webhook notifications are enabled."})
        return attrs


class InventoryAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryAlert
        fields = (
            "id",
            "alert_type",
            "severity",
            "title",
            "description",
            "action_url",
            "payload",
            "is_read",
            "is_active",
            "first_seen_at",
            "last_seen_at",
            "resolved_at",
            "delivery_error",
        )


class IntegrationErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntegrationError
        fields = "__all__"


class StockInTransitSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    source_warehouse_code = serializers.CharField(source="source_warehouse.code", read_only=True)
    destination_warehouse_code = serializers.CharField(source="destination_warehouse.code", read_only=True)

    class Meta:
        model = StockInTransit
        fields = "__all__"
