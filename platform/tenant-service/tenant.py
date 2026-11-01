"""
Platform Tenant Service
Manages multi-tenant isolation, database schema resolution, and tenant lifecycles.
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class TenantProfile:
    tenant_id: str
    code: str
    name: str
    subscription_tier: str = "ENTERPRISE"
    schema_prefix: str = "tenant_"
    is_active: bool = True

    @classmethod
    def default(cls) -> "TenantProfile":
        return cls(
            tenant_id="default-tenant",
            code="enterprise-default",
            name="Apex Industrial Global Holdings",
            subscription_tier="ENTERPRISE_UNLIMITED",
        )

