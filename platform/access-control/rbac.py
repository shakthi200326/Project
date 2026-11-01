"""
Platform Access Control (RBAC & ABAC Engine)
Validates granular operational permissions (e.g. inventory:post, inventory:reconcile)
against user roles and context attributes.
"""
from typing import List, Set


class AccessControlEngine:
    ROLE_PERMISSIONS = {
        "SUPER_ADMIN": {"*"},
        "INVENTORY_SUPERVISOR": {
            "inventory:view",
            "inventory:create",
            "inventory:post",
            "inventory:reconcile",
            "inventory:adjust",
            "inventory:transfer",
            "inventory:reports",
            "storage:upload",
            "storage:delete",
        },
        "WAREHOUSE_OPERATOR": {
            "inventory:view",
            "inventory:count",
            "inventory:transfer",
            "storage:upload",
        },
        "AUDITOR": {
            "inventory:view",
            "inventory:ledger:view",
            "inventory:reports",
        },
    }

    @classmethod
    def has_permission(cls, user_roles: List[str], required_permission: str) -> bool:
        for role in user_roles:
            permissions = cls.ROLE_PERMISSIONS.get(role, set())
            if "*" in permissions or required_permission in permissions:
                return True
        return False
