"""
Platform API Gateway Configuration & Routing Table
Defines route maps, upstream targets, and path rewrites for module endpoints.
"""
from typing import Dict, Any, Optional

ROUTE_MAP = {
    "/api/v1/inventory/": {
        "upstream": "http://inventory_backend:8000/api/v1/inventory/",
        "auth_required": True,
        "rate_limit_rpm": 600,
        "strip_prefix": False,
    },
    "/api/v1/storage/": {
        "upstream": "http://inventory_backend:8000/api/v1/storage/",
        "auth_required": True,
        "rate_limit_rpm": 300,
        "strip_prefix": False,
    },
    "/api/v1/platform/": {
        "upstream": "http://platform_service:8000/api/v1/platform/",
        "auth_required": True,
        "rate_limit_rpm": 600,
        "strip_prefix": False,
    },
}

class GatewayConfig:
    @staticmethod
    def get_route(path: str) -> Optional[Dict[str, Any]]:
        for prefix, conf in ROUTE_MAP.items():
            if path.startswith(prefix):
                return conf
        return None
