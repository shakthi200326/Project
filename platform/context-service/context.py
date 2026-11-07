from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class RequestContext:
    """Universal execution context for reusable modules."""
    organization_id: str
    facility_id: str
    user_id: str
    username: str = "system"
    roles: List[str] = field(default_factory=list)
    permissions: List[str] = field(default_factory=list)
    currency: str = "USD"
    timezone: str = "UTC"
    tenant_id: Optional[str] = None

    def has_permission(self, codename: str) -> bool:
        if "platform.admin" in self.roles or "inventory.admin" in self.roles:
            return True
        return codename in self.permissions

class DefaultContextResolver:
    """Default standalone and header-based context resolver."""

    @staticmethod
    def resolve(request) -> RequestContext:
        org_id = (
            request.headers.get("X-Organization-ID")
            or getattr(request, "organization_id", None)
            or "org_default_001"
        )
        facility_id = (
            request.headers.get("X-Facility-ID")
            or getattr(request, "facility_id", None)
            or "fac_main_wh_01"
        )
        user_id = "user_anonymous"
        username = "anonymous"
        roles = []
        permissions = [
            "inventory.view_catalog",
            "inventory.manage_catalog",
            "inventory.view_warehouses",
            "inventory.manage_warehouses",
            "inventory.view_stock",
            "inventory.post_movement",
            "inventory.reverse_movement",
            "inventory.manage_reservations",
            "inventory.manage_reconciliation",
            "inventory.view_valuation",
            "inventory.manage_configuration",
            "inventory.grn.view",
            "inventory.grn.create",
            "inventory.grn.approve",
            "inventory.grn.inspect",
            "inventory.grn.quality",
            "inventory.grn.putaway",
            "inventory.grn.post",
            "inventory.grn.reverse",
            "inventory.grn.discrepancy",
            "inventory.grn.configure",
            "inventory.stock_reclassification.create",
            "inventory.stock_reclassification.approve",
            "storage.upload_file",
            "storage.view_file",
            "storage.delete_file",
        ]

        if hasattr(request, "user") and request.user.is_authenticated:
            user_id = str(getattr(request.user, "id", request.user.pk))
            username = getattr(request.user, "username", str(request.user))
            if request.user.is_superuser:
                roles.append("platform.admin")

        return RequestContext(
            organization_id=org_id,
            facility_id=facility_id,
            user_id=user_id,
            username=username,
            roles=roles,
            permissions=permissions,
            currency="USD",
        )

