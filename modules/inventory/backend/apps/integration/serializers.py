from rest_framework import serializers
from apps.integration.models import (
    OutboxEvent,
    ProcessedEvent,
    EventProcessingAttempt,
    IntegrationSubscription,
    IntegrationSettings,
    IntegrationError,
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

