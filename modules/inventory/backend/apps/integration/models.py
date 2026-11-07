import uuid
from django.db import models
from django.utils import timezone


class OutboxEvent(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PUBLISHED = "PUBLISHED", "Published"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_id = models.CharField(max_length=100, unique=True, default=uuid.uuid4, db_index=True)
    event_type = models.CharField(max_length=120, db_index=True)
    event_version = models.CharField(max_length=20, default="1.0")
    aggregate_type = models.CharField(max_length=80, db_index=True)
    aggregate_id = models.CharField(max_length=100, db_index=True)
    tenant_id = models.CharField(max_length=100, default="default-tenant", db_index=True)
    project_id = models.CharField(max_length=100, default="prj-default", db_index=True)
    payload = models.JSONField(default=dict)
    correlation_id = models.CharField(max_length=100, blank=True, db_index=True)
    causation_id = models.CharField(max_length=100, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    retry_count = models.IntegerField(default=0)
    max_retries = models.IntegerField(default=5)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)

    class Meta:
        db_table = "outbox_event"
        ordering = ["created_at"]

    def __str__(self):
        return f"Outbox[{self.event_type}:{self.event_id}] - {self.status}"


class ProcessedEvent(models.Model):
    class Status(models.TextChoices):
        RECEIVED = "RECEIVED", "Received"
        PROCESSING = "PROCESSING", "Processing"
        PROCESSED = "PROCESSED", "Processed"
        FAILED = "FAILED", "Failed"
        DEAD_LETTER = "DEAD_LETTER", "Dead Letter"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_id = models.CharField(max_length=100, unique=True, db_index=True)
    event_type = models.CharField(max_length=120, db_index=True)
    event_source = models.CharField(max_length=120, default="external")
    event_version = models.CharField(max_length=20, default="1.0")
    tenant_id = models.CharField(max_length=100, default="default-tenant", db_index=True)
    project_id = models.CharField(max_length=100, default="prj-default", db_index=True)
    correlation_id = models.CharField(max_length=100, blank=True, db_index=True)
    causation_id = models.CharField(max_length=100, blank=True)
    payload = models.JSONField(default=dict)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.RECEIVED, db_index=True
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    last_error = models.TextField(blank=True)

    class Meta:
        db_table = "processed_event"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Inbox[{self.event_type}:{self.event_id}] - {self.status}"


class EventProcessingAttempt(models.Model):
    class Status(models.TextChoices):
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"

    id = models.BigAutoField(primary_key=True)
    event = models.ForeignKey(
        ProcessedEvent, on_delete=models.CASCADE, related_name="attempts"
    )
    attempt_number = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=Status.choices)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    stack_trace = models.TextField(blank=True)

    class Meta:
        db_table = "event_processing_attempt"
        ordering = ["-started_at"]

    def __str__(self):
        return f"Attempt {self.attempt_number} for {self.event.event_id}: {self.status}"


class IntegrationSubscription(models.Model):
    id = models.AutoField(primary_key=True)
    subscriber_name = models.CharField(max_length=100)
    event_pattern = models.CharField(max_length=120, db_index=True)
    handler_path = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "integration_subscription"
        ordering = ["subscriber_name"]

    def __str__(self):
        return f"{self.subscriber_name} -> {self.event_pattern}"


class IntegrationSettings(models.Model):
    id = models.AutoField(primary_key=True)
    module_name = models.CharField(max_length=50, default="inventory", unique=True)
    outbox_poll_interval_seconds = models.IntegerField(default=5)
    outbox_batch_size = models.IntegerField(default=50)
    max_retry_attempts = models.IntegerField(default=5)
    backoff_multiplier = models.FloatField(default=2.0)
    dead_letter_threshold = models.IntegerField(default=5)
    enable_purchase_integration = models.BooleanField(default=True)
    enable_sales_integration = models.BooleanField(default=True)
    enable_low_stock_alerts = models.BooleanField(default=True)
    low_stock_suppression_hours = models.IntegerField(default=24)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "integration_settings"

    @classmethod
    def get_settings(cls) -> "IntegrationSettings":
        obj, _ = cls.objects.get_or_create(module_name="inventory")
        return obj

    def __str__(self):
        return f"IntegrationSettings({self.module_name})"


class NotificationSettings(models.Model):
    module_name = models.CharField(max_length=50, default="inventory", unique=True)
    alert_types = models.JSONField(default=dict)
    channels = models.JSONField(default=dict)
    recipient_emails = models.JSONField(default=list, blank=True)
    webhook_url = models.URLField(blank=True, default="")
    expiry_warning_days = models.PositiveIntegerField(default=30)
    pending_receipt_days = models.PositiveIntegerField(default=1)
    pending_approval_hours = models.PositiveIntegerField(default=24)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inventory_notification_settings"

    @classmethod
    def get_settings(cls):
        defaults = {
            "alert_types": {
                "low_stock": True,
                "out_of_stock": True,
                "expiry": True,
                "overstock": True,
                "pending_receipt": True,
                "pending_approval": True,
                "stock_discrepancy": True,
            },
            "channels": {"in_app": True, "email": False, "webhook": False},
        }
        obj, _ = cls.objects.get_or_create(module_name="inventory", defaults=defaults)
        return obj


class InventoryAlert(models.Model):
    class AlertType(models.TextChoices):
        LOW_STOCK = "low_stock", "Low Stock"
        OUT_OF_STOCK = "out_of_stock", "Out of Stock"
        EXPIRY = "expiry", "Expiry"
        OVERSTOCK = "overstock", "Overstock"
        PENDING_RECEIPT = "pending_receipt", "Pending Receipt"
        PENDING_APPROVAL = "pending_approval", "Pending Approval"
        STOCK_DISCREPANCY = "stock_discrepancy", "Stock Discrepancy"

    source_key = models.CharField(max_length=180, unique=True)
    alert_type = models.CharField(max_length=32, choices=AlertType.choices, db_index=True)
    severity = models.CharField(max_length=20, default="WARNING")
    title = models.CharField(max_length=240)
    description = models.TextField(blank=True)
    action_url = models.CharField(max_length=500, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    webhook_sent_at = models.DateTimeField(null=True, blank=True)
    delivery_error = models.TextField(blank=True)

    class Meta:
        db_table = "inventory_alert"
        ordering = ["-last_seen_at", "-id"]

    def __str__(self):
        return f"{self.get_alert_type_display()}: {self.title}"


class IntegrationError(models.Model):
    class Direction(models.TextChoices):
        INBOUND = "INBOUND", "Inbound"
        OUTBOUND = "OUTBOUND", "Outbound"

    class Status(models.TextChoices):
        UNRESOLVED = "UNRESOLVED", "Unresolved"
        RETRIED = "RETRIED", "Retried"
        RESOLVED = "RESOLVED", "Resolved"
        IGNORED = "IGNORED", "Ignored"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_id = models.CharField(max_length=100, db_index=True)
    event_type = models.CharField(max_length=120, db_index=True)
    direction = models.CharField(max_length=10, choices=Direction.choices)
    payload = models.JSONField(default=dict)
    error_type = models.CharField(max_length=120)
    error_message = models.TextField()
    stack_trace = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.UNRESOLVED, db_index=True
    )
    resolved_by = models.CharField(max_length=100, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "integration_error"
        ordering = ["-created_at"]

    def __str__(self):
        return f"DLQ[{self.direction}:{self.event_type}] {self.status}: {self.error_message[:60]}"
