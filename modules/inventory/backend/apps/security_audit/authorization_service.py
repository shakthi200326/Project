"""
Centralized Enterprise Authorization Engine.
Evaluates:
  1. Authenticated User & Superuser Bypass
  2. Active Organizational Membership (Tenant -> Company -> Branch)
  3. Assigned Roles & Effective Permissions
  4. Warehouse-level Access Level (NO_ACCESS, READ_ONLY, OPERATIONAL, FULL_ACCESS)
  5. Action-level Authorization (VIEW, CREATE, EDIT, DELETE, SUBMIT, APPROVE, POST, REVERSE, etc.)
  6. Separation of Duties (e.g. Creator cannot self-approve sensitive documents)
"""
import logging
from typing import List, Optional, Set, Tuple
from django.utils import timezone
from apps.security_audit.models import (
    Permission,
    Role,
    RolePermission,
    UserMembership,
    MembershipRole,
    WarehouseAccess,
)
from apps.warehouses.models import Warehouse

logger = logging.getLogger("security.authz")


class AuthorizationResult:
    def __init__(self, allowed: bool, reason: str = "", effective_permissions: Optional[Set[str]] = None):
        self.allowed = allowed
        self.reason = reason
        self.effective_permissions = effective_permissions or set()

    def __bool__(self):
        return self.allowed

    def to_dict(self):
        return {
            "allowed": self.allowed,
            "reason": self.reason,
            "effective_permissions": sorted(list(self.effective_permissions)),
        }


class CentralAuthorizationService:
    """
    Unified authorization evaluation service used across DRF views, middleware, and business services.
    """

    @classmethod
    def get_effective_membership(
        cls, user, tenant_id: str = "default-tenant", company_id: Optional[str] = None, branch_id: Optional[str] = None
    ) -> Optional[UserMembership]:
        if not user or not user.is_authenticated:
            return None

        qs = UserMembership.objects.filter(
            user=user,
            tenant_id=tenant_id,
            status=UserMembership.Status.ACTIVE,
        )
        if company_id:
            qs = qs.filter(company_id=company_id)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        today = timezone.localdate()
        for membership in qs:
            if membership.access_start_date and membership.access_start_date > today:
                continue
            if membership.access_expiry_date and membership.access_expiry_date < today:
                continue
            return membership
        return None

    @classmethod
    def get_effective_permissions(cls, user, tenant_id: str = "default-tenant") -> Set[str]:
        """
        Returns all permission codes granted to the user via active memberships and assigned active roles.
        Superusers have all permissions.
        """
        if not user or not user.is_authenticated:
            return set()

        if getattr(user, "is_superuser", False):
            # Superusers implicitly possess all permissions in the system
            return set(Permission.objects.values_list("code", flat=True)) | {"*"}

        # Resolve permissions from active memberships and active roles
        today = timezone.localdate()
        active_memberships = UserMembership.objects.filter(
            user=user,
            tenant_id=tenant_id,
            status=UserMembership.Status.ACTIVE,
        )

        valid_membership_ids = [
            m.id
            for m in active_memberships
            if (not m.access_start_date or m.access_start_date <= today)
            and (not m.access_expiry_date or m.access_expiry_date >= today)
        ]

        if not valid_membership_ids:
            return set()

        active_roles = Role.objects.filter(
            role_memberships__membership_id__in=valid_membership_ids,
            is_active=True,
        )

        perms = RolePermission.objects.filter(
            role__in=active_roles
        ).values_list("permission__code", flat=True)

        return set(perms)

    @classmethod
    def check_permission(
        cls,
        user,
        permission_code: str,
        tenant_id: str = "default-tenant",
    ) -> AuthorizationResult:
        if not user or not user.is_authenticated:
            return AuthorizationResult(False, "User is not authenticated.")

        if getattr(user, "is_superuser", False):
            return AuthorizationResult(True, "Superuser access granted.", {"*"})

        perms = cls.get_effective_permissions(user, tenant_id=tenant_id)
        if "*" in perms or permission_code in perms:
            return AuthorizationResult(True, f"Permission '{permission_code}' granted.", perms)

        return AuthorizationResult(False, f"Missing required permission '{permission_code}'.", perms)

    @classmethod
    def check_warehouse_access(
        cls,
        user,
        warehouse_id_or_code,
        required_level: str = WarehouseAccess.AccessLevel.READ_ONLY,
        tenant_id: str = "default-tenant",
    ) -> AuthorizationResult:
        """
        Validates whether user has the minimum required access level for a specific warehouse:
          NO_ACCESS < READ_ONLY < OPERATIONAL < FULL_ACCESS
        """
        if not user or not user.is_authenticated:
            return AuthorizationResult(False, "User is not authenticated.")

        if getattr(user, "is_superuser", False):
            return AuthorizationResult(True, "Superuser has full warehouse access.")

        LEVEL_HIERARCHY = {
            WarehouseAccess.AccessLevel.NO_ACCESS: 0,
            WarehouseAccess.AccessLevel.READ_ONLY: 1,
            WarehouseAccess.AccessLevel.OPERATIONAL: 2,
            WarehouseAccess.AccessLevel.FULL_ACCESS: 3,
        }

        req_score = LEVEL_HIERARCHY.get(required_level, 1)

        # Lookup warehouse
        warehouse = None
        if isinstance(warehouse_id_or_code, int) or (isinstance(warehouse_id_or_code, str) and warehouse_id_or_code.isdigit()):
            warehouse = Warehouse.objects.filter(id=int(warehouse_id_or_code)).first()
        elif isinstance(warehouse_id_or_code, str):
            warehouse = Warehouse.objects.filter(code=warehouse_id_or_code).first()

        if not warehouse:
            return AuthorizationResult(False, f"Warehouse '{warehouse_id_or_code}' not found.")

        # Find user active memberships
        today = timezone.localdate()
        memberships = UserMembership.objects.filter(
            user=user,
            tenant_id=tenant_id,
            status=UserMembership.Status.ACTIVE,
        )

        valid_membership_ids = [
            m.id
            for m in memberships
            if (not m.access_start_date or m.access_start_date <= today)
            and (not m.access_expiry_date or m.access_expiry_date >= today)
        ]

        if not valid_membership_ids:
            return AuthorizationResult(False, "User has no active membership.")

        # Find specific warehouse access grant
        access = WarehouseAccess.objects.filter(
            membership_id__in=valid_membership_ids,
            warehouse=warehouse,
            is_active=True,
        ).first()

        if not access:
            # If no explicit access is found, check if user has an inventory administrator role
            perms = cls.get_effective_permissions(user, tenant_id=tenant_id)
            if "inventory.warehouses.manage" in perms or "security.admin" in perms:
                return AuthorizationResult(True, "Administrative warehouse override granted.")
            return AuthorizationResult(False, f"No warehouse access grant configured for {warehouse.code}.")

        if not access.is_currently_valid:
            return AuthorizationResult(False, f"Warehouse access grant for {warehouse.code} has expired or is inactive.")

        user_score = LEVEL_HIERARCHY.get(access.access_level, 0)
        if user_score >= req_score:
            return AuthorizationResult(True, f"Warehouse access '{access.access_level}' satisfies requirement '{required_level}'.")

        return AuthorizationResult(
            False,
            f"Insufficient warehouse access for {warehouse.code}: user has '{access.access_level}', requires '{required_level}'.",
        )

    @classmethod
    def check_separation_of_duties(
        cls,
        user,
        created_by_user,
        action: str = "APPROVE",
    ) -> AuthorizationResult:
        """
        Enforces policy: A user cannot approve or post their own transaction when strict SoD is active.
        """
        if not user or not user.is_authenticated:
            return AuthorizationResult(False, "User is not authenticated.")

        username = getattr(user, "username", str(user))
        creator_name = getattr(created_by_user, "username", str(created_by_user)) if created_by_user else ""

        if action in ("APPROVE", "POST") and creator_name and username.lower() == creator_name.lower():
            # Allow superuser override if configured or fail SoD
            if getattr(user, "is_superuser", False):
                return AuthorizationResult(True, "Superuser bypass for Separation of Duties.")
            return AuthorizationResult(
                False,
                f"Separation of Duties violation: User '{username}' cannot {action.lower()} a document they created.",
            )

        return AuthorizationResult(True, "Separation of duties policy satisfied.")

