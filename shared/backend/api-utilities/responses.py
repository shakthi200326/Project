"""
Shared API Utilities & Standard Envelope Responses
Ensures consistent HTTP response payloads across all REST endpoints.
"""
from typing import Any, Dict, Optional


def success_envelope(data: Any, meta: Optional[Dict[str, Any]] = None, message: str = "Operation succeeded") -> Dict[str, Any]:
    return {
        "status": "success",
        "message": message,
        "data": data,
        "meta": meta or {},
    }


def error_envelope(code: str, message: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "status": "error",
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        },
    }

