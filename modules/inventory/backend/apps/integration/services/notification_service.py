import ipaddress
import json
import logging
import socket
from datetime import timedelta
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from django.conf import settings as django_settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from apps.batches.models import Batch
from apps.goods_receipt.models import ReceiptDiscrepancy
from apps.integration.models import InventoryAlert, NotificationSettings
from apps.movements.models import StockTransaction
from apps.planning.models import StockLevel
from apps.reconciliation.models import StockCount
from apps.stock.models import StockBalance

logger = logging.getLogger("ecosystem.integration.notifications")


class _RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


ALERT_LINKS = {
    "low_stock": "/inventory/reports/low-stock",
    "out_of_stock": "/inventory/reports/low-stock",
    "expiry": "/inventory/reports/expiry",
    "overstock": "/inventory/planning/min-max-levels",
    "pending_receipt": "/inventory/goods-receipt/register",
    "pending_approval": "/inventory/operations/movements",
    "stock_discrepancy": "/inventory/goods-receipt/discrepancies",
}


class NotificationService:
    @classmethod
    def scan(cls):
        config = NotificationSettings.get_settings()
        enabled = {key for key, value in config.alert_types.items() if value}
        candidates = cls._collect_candidates(config, enabled)
        active_keys = {candidate["source_key"] for candidate in candidates}

        pending_delivery = []
        with transaction.atomic():
            InventoryAlert.objects.filter(is_active=True).exclude(
                source_key__in=active_keys
            ).update(is_active=False, resolved_at=timezone.now())

            for candidate in candidates:
                alert, created = InventoryAlert.objects.get_or_create(
                    source_key=candidate["source_key"], defaults=candidate
                )
                reactivated = not created and not alert.is_active
                for key, value in candidate.items():
                    setattr(alert, key, value)
                alert.is_active = True
                if created or reactivated:
                    alert.is_read = False
                alert.resolved_at = None
                alert.save()
                if created or reactivated:
                    logger.info("Created inventory alert %s", alert.source_key)
                pending_delivery.append(alert)
        for alert in pending_delivery:
            cls._deliver(alert, config)
        return len(candidates)

    @classmethod
    def _collect_candidates(cls, config, enabled):
        candidates = []

        def add(alert_type, source_key, title, description, severity="WARNING", action_url=None, payload=None):
            candidates.append({
                "alert_type": alert_type,
                "source_key": source_key,
                "title": title,
                "description": description,
                "severity": severity,
                "action_url": action_url or ALERT_LINKS[alert_type],
                "payload": payload or {},
            })

        if {"low_stock", "out_of_stock"} & enabled:
            default_threshold = None
            if "low_stock" in enabled:
                from apps.configuration.models import InventoryConfiguration
                default_threshold = InventoryConfiguration.get_solo().default_low_stock_threshold
            for balance in StockBalance.objects.select_related("item", "warehouse").iterator():
                available = balance.available_qty
                item_code = balance.item.code
                warehouse_code = balance.warehouse.code
                common = f"{item_code} at {warehouse_code}"
                if available <= 0 and "out_of_stock" in enabled:
                    add(
                        "out_of_stock",
                        f"balance:{balance.pk}:out_of_stock",
                        f"Out of stock: {item_code}",
                        f"{balance.item.name} has no available stock at {balance.warehouse.name}.",
                        "CRITICAL",
                        payload={"balance_id": balance.pk, "item_code": item_code, "warehouse_code": warehouse_code},
                    )
                elif "low_stock" in enabled:
                    threshold = balance.item.reorder_point
                    if threshold <= 0:
                        threshold = default_threshold
                    if available <= threshold:
                        add(
                            "low_stock",
                            f"balance:{balance.pk}:low_stock",
                            f"Low stock: {item_code}",
                            f"{common} has {available} available; reorder threshold is {threshold}.",
                            payload={"balance_id": balance.pk, "item_code": item_code, "warehouse_code": warehouse_code},
                        )

        if "expiry" in enabled:
            today = timezone.localdate()
            deadline = today + timedelta(days=config.expiry_warning_days)
            for batch in Batch.objects.filter(
                remaining_quantity__gt=0, expiry_date__lte=deadline
            ).select_related("item", "warehouse").iterator():
                days = (batch.expiry_date - today).days
                add(
                    "expiry",
                    f"batch:{batch.pk}:expiry",
                    f"{'Expired' if days < 0 else 'Expiry alert'}: {batch.batch_number}",
                    f"{batch.item.name} batch {batch.batch_number} has {batch.remaining_quantity} remaining and "
                    f"{'expired' if days < 0 else f'expires in {days} days'}.",
                    "CRITICAL" if days < 0 else "WARNING",
                    payload={"batch_id": batch.pk, "batch_number": batch.batch_number, "days_to_expiry": days},
                )

        if "overstock" in enabled:
            available_by_item_warehouse = {}
            for balance in StockBalance.objects.iterator():
                key = (balance.item_id, balance.warehouse_id)
                available_by_item_warehouse[key] = (
                    available_by_item_warehouse.get(key, 0) + balance.available_qty
                )
            for level in StockLevel.objects.select_related("product", "warehouse").iterator():
                available = available_by_item_warehouse.get((level.product_id, level.warehouse_id), 0)
                if level.max_stock > 0 and available > level.max_stock:
                    add(
                        "overstock",
                        f"stock-level:{level.pk}:overstock",
                        f"Overstock: {level.product.code}",
                        f"{level.product.name} at {level.warehouse.name} has {available} available; "
                        f"maximum stock is {level.max_stock}.",
                        payload={"stock_level_id": level.pk, "item_code": level.product.code},
                    )

        now = timezone.now()
        if "pending_receipt" in enabled:
            cutoff = now - timedelta(days=config.pending_receipt_days)
            receipt_statuses = [
                StockTransaction.Status.SUBMITTED,
                StockTransaction.Status.UNDER_INSPECTION,
                StockTransaction.Status.PARTIALLY_ACCEPTED,
                StockTransaction.Status.ACCEPTED,
                StockTransaction.Status.PUTAWAY_PENDING,
                StockTransaction.Status.READY_TO_POST,
            ]
            receipts = StockTransaction.objects.filter(
                transaction_type=StockTransaction.TransactionType.RECEIPT,
                status__in=receipt_statuses,
            ).filter(
                models_q_expected_or_old(cutoff, today=timezone.localdate())
            )
            for receipt in receipts.iterator():
                add(
                    "pending_receipt",
                    f"receipt:{receipt.pk}:pending",
                    f"Pending receipt: {receipt.document_number}",
                    f"Receipt at {receipt.warehouse.name} is still {receipt.get_status_display()}.",
                    payload={"receipt_id": receipt.pk, "document_number": receipt.document_number},
                )

        if "pending_approval" in enabled:
            cutoff = now - timedelta(hours=config.pending_approval_hours)
            for tx in StockTransaction.objects.filter(
                status=StockTransaction.Status.SUBMITTED, submitted_at__lte=cutoff
            ).select_related("warehouse").iterator():
                add(
                    "pending_approval",
                    f"transaction:{tx.pk}:approval",
                    f"Approval pending: {tx.document_number}",
                    f"{tx.get_transaction_type_display()} submitted by {tx.submitted_by or tx.created_by or 'a user'} "
                    f"has been awaiting approval.",
                    payload={"transaction_id": tx.pk, "document_number": tx.document_number},
                )

        if "stock_discrepancy" in enabled:
            for discrepancy in ReceiptDiscrepancy.objects.filter(
                resolution_status__in=[
                    ReceiptDiscrepancy.ResolutionStatus.OPEN,
                    ReceiptDiscrepancy.ResolutionStatus.UNDER_REVIEW,
                ]
            ).select_related("receipt").iterator():
                add(
                    "stock_discrepancy",
                    f"receipt-discrepancy:{discrepancy.pk}",
                    f"Stock discrepancy: {discrepancy.discrepancy_number}",
                    f"{discrepancy.get_resolution_status_display()} discrepancy on "
                    f"{discrepancy.receipt.document_number}: {discrepancy.reason or discrepancy.discrepancy_type}.",
                    payload={"discrepancy_id": discrepancy.pk, "receipt_id": discrepancy.receipt_id},
                )
            for count in StockCount.objects.filter(
                status__in=[StockCount.Status.SUBMITTED, StockCount.Status.PENDING]
            ).exclude(difference_quantity=0).select_related("warehouse").iterator():
                add(
                    "stock_discrepancy",
                    f"stock-count:{count.pk}:discrepancy",
                    f"Stock variance: {count.count_number}",
                    f"Count at {count.warehouse.name} has a variance of {count.difference_quantity}.",
                    action_url="/inventory/audit/variance",
                    payload={"stock_count_id": count.pk, "count_number": count.count_number},
                )
        return candidates

    @classmethod
    def _deliver(cls, alert, config):
        channels = config.channels
        errors = []
        if channels.get("email") and not alert.email_sent_at:
            if not config.recipient_emails:
                errors.append("Email is enabled but no recipient addresses are configured.")
            else:
                try:
                    sent = send_mail(
                        subject=f"[Inventory {alert.severity}] {alert.title}",
                        message=f"{alert.description}\n\nOpen: {alert.action_url}",
                        from_email=getattr(django_settings, "DEFAULT_FROM_EMAIL", None),
                        recipient_list=config.recipient_emails,
                        fail_silently=False,
                    )
                    if not sent:
                        raise RuntimeError("The configured email backend did not send the alert.")
                    alert.email_sent_at = timezone.now()
                except Exception as exc:
                    errors.append(f"Email delivery failed: {exc}")
                    logger.exception("Email delivery failed for inventory alert %s", alert.pk)

        if channels.get("webhook") and not alert.webhook_sent_at:
            if not config.webhook_url:
                errors.append("Webhook is enabled but no webhook URL is configured.")
            else:
                try:
                    cls._post_webhook(config.webhook_url, alert)
                    alert.webhook_sent_at = timezone.now()
                except Exception as exc:
                    errors.append(f"Webhook delivery failed: {exc}")
                    logger.exception("Webhook delivery failed for inventory alert %s", alert.pk)
        alert.delivery_error = "\n".join(errors)
        alert.save(update_fields=["email_sent_at", "webhook_sent_at", "delivery_error", "last_seen_at"])

    @staticmethod
    def _post_webhook(url, alert):
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.hostname:
            raise ValueError("Webhook URL must use HTTPS.")
        if parsed.username or parsed.password:
            raise ValueError("Webhook URL must not include credentials.")
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
        if any(not ipaddress.ip_address(result[4][0]).is_global for result in addresses):
            raise ValueError("Webhook host must resolve only to public IP addresses.")
        payload = {
            "id": alert.pk,
            "type": alert.alert_type,
            "severity": alert.severity,
            "title": alert.title,
            "description": alert.description,
            "action_url": alert.action_url,
            "created_at": alert.first_seen_at.isoformat(),
            "data": alert.payload,
        }
        request = Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
        opener = build_opener(_RejectRedirects())
        with opener.open(request, timeout=5) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"Webhook returned HTTP {response.status}.")


def models_q_expected_or_old(cutoff, today):
    from django.db.models import Q
    return Q(created_at__lte=cutoff) | Q(expected_date__lt=today)
