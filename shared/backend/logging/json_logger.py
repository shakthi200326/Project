"""
Shared Structured JSON Logging Service
Formats log records with correlation IDs, tenant contexts, and machine-readable JSON.
"""
import json
import logging
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "line": record.lineno,
            "correlation_id": getattr(record, "correlation_id", "none"),
            "tenant_id": getattr(record, "tenant_id", "default"),
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data)

