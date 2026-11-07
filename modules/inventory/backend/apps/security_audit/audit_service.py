"""
Reusable Audit & Data Tracking Service.
Provides centralized append-only logging for:
  1. Activity Logs (Logins, Role changes, Permission assignment, Configuration updates, Security events)
  2. Document Audit Trail (Lifecycle step-by-step history of Goods Receipts, Transfers, Adjustments, etc.)
  3. Data Change History (Field-level before/after diffs with change reasons and document linking)
"""
import logging
from typing import Any, Dict, List, Optional
from django.utils import timezone
from apps.security_audit.models import (
    ActivityLog,
    DocumentAuditEvent,
    DataChangeRecord,
)

logger = logging.getLogger("security.audit")

# Sensitive fields that must NEVER be captured in plain-text logs
SENSITIVE_FIELD_NAMES = {
    "password",
    "password_hash",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "credit_card",
    "cvv",
}


class SecurityAuditService:

    @classmethod
    def sanitize_metadata(cls, data: Any) -> Any:
        if isinstance(data, dict):
            sanitized = {}
            for k, v in data.items():
                if any(sens in k.lower() for sens in SENSITIVE_FIELD_NAMES):
                    sanitized[k] = "********"
                else:
                    sanitized[k] = cls.sanitize_metadata(v)
            return sanitized
        elif isinstance(data, list):
            return [cls.sanitize_metadata(item) for item in data]
        return data

    @classmethod
    def log_activity(
        cls,
        actor: Any,
        action: str,
        module: str,
        resource_type: str,
        resource_id: str = "",
        status: str = "SUCCESS",
        ip_address: Optional[str] = None,
        correlation_id: str = "",
        metadata: Optional[Dict[str, Any]] = None,
        tenant_id: str = "default-tenant",
    ) -> ActivityLog:
        """
        Record an immutable activity log entry.
        """
        username = "anonymous"
        if hasattr(actor, "username"):
            username = actor.username
        elif isinstance(actor, str) and actor:
            username = actor

        clean_metadata = cls.sanitize_metadata(metadata or {})

        log_entry = ActivityLog.objects.create(
            tenant_id=tenant_id,
            actor_username=username,
            action=action.upper(),
            module=module.lower(),
            resource_type=resource_type,
            resource_id=str(resource_id),
            status=status.upper(),
            ip_address=ip_address,
            correlation_id=correlation_id,
            metadata=clean_metadata,
        )
        logger.info("SECURITY_ACTIVITY: %s", log_entry)
        return log_entry

    @classmethod
    def log_document_event(
        cls,
        document_type: str,
        document_number: str,
        action: str,
        performed_by: Any,
        new_status: str,
        previous_status: str = "",
        remarks: str = "",
        approval_info: Optional[Dict[str, Any]] = None,
        references: Optional[Dict[str, Any]] = None,
        tenant_id: str = "default-tenant",
    ) -> DocumentAuditEvent:
        """
        Record an immutable document lifecycle transition event.
        """
        username = "anonymous"
        if hasattr(performed_by, "username"):
            username = performed_by.username
        elif isinstance(performed_by, str) and performed_by:
            username = performed_by

        event = DocumentAuditEvent.objects.create(
            tenant_id=tenant_id,
            document_type=document_type,
            document_number=document_number,
            action=action.upper(),
            previous_status=previous_status,
            new_status=new_status,
            performed_by=username,
            remarks=remarks or "",
            approval_info=cls.sanitize_metadata(approval_info or {}),
            references=cls.sanitize_metadata(references or {}),
        )
        logger.info("DOCUMENT_AUDIT: %s", event)
        return event

    @classmethod
    def log_field_changes(
        cls,
        entity_type: str,
        entity_id: str,
        entity_display_name: str,
        changes: Dict[str, Tuple[Any, Any]],  # field_name -> (old_val, new_val)
        changed_by: Any,
        change_reason: str = "",
        document_reference: str = "",
        tenant_id: str = "default-tenant",
    ) -> List[DataChangeRecord]:
        """
        Record field-level modifications for audit comparison.
        """
        username = "anonymous"
        if hasattr(changed_by, "username"):
            username = changed_by.username
        elif isinstance(changed_by, str) and changed_by:
            username = changed_by

        records = []
        for field_name, (old_val, new_val) in changes.items():
            # Skip logging identical values
            if old_val == new_val:
                continue

            # Mask sensitive values
            if any(sens in field_name.lower() for sens in SENSITIVE_FIELD_NAMES):
                old_str = "********"
                new_str = "********"
            else:
                old_str = str(old_val) if old_val is not None else ""
                new_str = str(new_val) if new_val is not None else ""

            record = DataChangeRecord.objects.create(
                tenant_id=tenant_id,
                entity_type=entity_type,
                entity_id=str(entity_id),
                entity_display_name=entity_display_name or f"{entity_type} #{entity_id}",
                field_name=field_name,
                old_value=old_str,
                new_value=new_str,
                changed_by=username,
                change_reason=change_reason or "",
                document_reference=document_reference or "",
            )
            records.append(record)

        return records

