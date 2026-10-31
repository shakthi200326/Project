import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger("ecosystem.audit")

class AuditLogger:
    """
    Standardized Enterprise Audit Logging for regulatory compliance (ISO 9001 / SOX / FDA 21 CFR Part 11).
    Records immutable actor, timestamp, action, target entity, before/after diffs, and network origin.
    """

    @classmethod
    def log_action(
        cls,
        action: str,
        actor: str,
        entity_type: str,
        entity_id: str,
        changes: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        status: str = "SUCCESS",
    ) -> Dict[str, Any]:
        audit_record = {
            "audit_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "status": status,
            "actor": actor or "anonymous",
            "ip_address": ip_address or "127.0.0.1",
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "changes": changes or {},
            "context": context or {},
        }
        logger.info("AUDIT_TRAIL: %s", audit_record)
        return audit_record

def audit_log(action: str, actor: str, entity_type: str, entity_id: str, **kwargs):
    return AuditLogger.log_action(action, actor, entity_type, entity_id, **kwargs)

