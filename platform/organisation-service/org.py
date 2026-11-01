"""
Platform Organisation Service
Resolves organization boundaries, default currencies, and fiscal calendars.
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class OrganisationContext:
    org_id: str
    org_code: str
    name: str
    base_currency: str = "USD"
    is_active: bool = True

    @classmethod
    def default(cls) -> "OrganisationContext":
        return cls(
            org_id="default-org-id",
            org_code="ORG-DEFAULT",
            name="Default Corporate Organisation",
            base_currency="USD",
        )

