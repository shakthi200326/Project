import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.warehouses.models import Warehouse

class Role(models.Model):
    """
    Enterprise Role definition (e.g. Warehouse Manager, Inventory Admin, Inspector).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.CharField(max_length=64, default="default-tenant", db_index=True)
    code = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, default="")
    is_system_role = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sec_roles"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Permission(models.Model):
    """
    Granular permission catalog (e.g. inventory.receipts.submit).
    """
    class Action(models.TextChoices):
        VIEW = "VIEW", "View"
        CREATE = "CREATE", "Create"
        EDIT = "EDIT", "Edit"
        DELETE = "DELETE", "Delete"
        SUBMIT = "SUBMIT", "Submit"
        APPROVE = "APPROVE", "Approve"
        REJECT = "REJECT", "Reject"
        POST = "POST", "Post"
        CANCEL = "CANCEL", "Cancel"
        REVERSE = "REVERSE", "Reverse"
        IMPORT = "IMPORT", "Import"
        EXPORT = "EXPORT", "Export"
        CONFIGURE = "CONFIGURE", "Configure"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    module = models.CharField(max_length=64, db_index=True)  # e.g. "inventory", "goods_receipt", "security"
    resource = models.CharField(max_length=64, db_index=True)  # e.g. "receipts", "items", "warehouses"
    action = models.CharField(max_length=32, choices=Action.choices, default=Action.VIEW)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "sec_permissions"
        ordering = ["module", "resource", "action"]

    def __str__(self):
        return f"{self.code} - {self.name}"


class RolePermission(models.Model):
    """
    Mapping between Roles and Permissions.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="permission_roles")
    granted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "sec_role_permissions"
        unique_together = ("role", "permission")

    def __str__(self):
        return f"{self.role.code} -> {self.permission.code}"


class UserMembership(models.Model):
    """
    Organizational Membership connecting a User to Tenant, Company, and Branch.
    """
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"
        SUSPENDED = "SUSPENDED", "Suspended"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    tenant_id = models.CharField(max_length=64, default="default-tenant", db_index=True)
    company_id = models.CharField(max_length=64, default="company-001", db_index=True)
    branch_id = models.CharField(max_length=64, default="branch-main", db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    access_start_date = models.DateField(default=timezone.localdate)
    access_expiry_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sec_user_memberships"
        unique_together = ("user", "tenant_id", "company_id", "branch_id")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} @ {self.company_id}/{self.branch_id} ({self.status})"

    @property
    def is_currently_valid(self):
        if self.status != self.Status.ACTIVE:
            return False
        today = timezone.localdate()
        if self.access_start_date and self.access_start_date > today:
            return False
        if self.access_expiry_date and self.access_expiry_date < today:
            return False
        return True


class MembershipRole(models.Model):
    """
    Roles assigned to an organizational membership.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membership = models.ForeignKey(UserMembership, on_delete=models.CASCADE, related_name="membership_roles")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_memberships")
    assigned_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "sec_membership_roles"
        unique_together = ("membership", "role")

    def __str__(self):
        return f"{self.membership.user.username} has role {self.role.code}"


class WarehouseAccess(models.Model):
    """
    Warehouse-level authorization matrix per user/membership.
    """
    class AccessLevel(models.TextChoices):
        NO_ACCESS = "NO_ACCESS", "No Access"
        READ_ONLY = "READ_ONLY", "Read Only"
        OPERATIONAL = "OPERATIONAL", "Operational"
        FULL_ACCESS = "FULL_ACCESS", "Full Access"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membership = models.ForeignKey(UserMembership, on_delete=models.CASCADE, related_name="warehouse_accesses")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="user_accesses")
    access_level = models.CharField(max_length=20, choices=AccessLevel.choices, default=AccessLevel.READ_ONLY)
    valid_from = models.DateField(default=timezone.localdate)
    valid_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sec_warehouse_access"
        unique_together = ("membership", "warehouse")
        ordering = ["warehouse__code"]

    def __str__(self):
        return f"{self.membership.user.username} -> {self.warehouse.code}: {self.access_level}"

    @property
    def is_currently_valid(self):
        if not self.is_active or self.access_level == self.AccessLevel.NO_ACCESS:
            return False
        today = timezone.localdate()
        if self.valid_from and self.valid_from > today:
            return False
        if self.valid_until and self.valid_until < today:
            return False
        return True


class ActivityLog(models.Model):
    """
    Append-only cross-cutting event log recording user activities and system actions.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.CharField(max_length=64, default="default-tenant", db_index=True)
    actor_username = models.CharField(max_length=150, db_index=True)
    action = models.CharField(max_length=64, db_index=True)  # LOGIN, LOGOUT, CREATE_ROLE, ASSIGN_PERM, etc.
    module = models.CharField(max_length=64, db_index=True)  # security, inventory, goods_receipt, etc.
    resource_type = models.CharField(max_length=100, db_index=True)  # User, Role, GoodsReceipt, StockTransaction
    resource_id = models.CharField(max_length=100, db_index=True, blank=True, default="")
    status = models.CharField(max_length=32, default="SUCCESS", db_index=True)  # SUCCESS, FAILED, DENIED
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    correlation_id = models.CharField(max_length=120, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "sec_activity_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.created_at}] {self.actor_username} - {self.action} on {self.resource_type}:{self.resource_id} ({self.status})"


class DocumentAuditEvent(models.Model):
    """
    Lifecycle tracking for business documents (GoodsReceipt, StockTransfer, StockAdjustment, etc.).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.CharField(max_length=64, default="default-tenant", db_index=True)
    document_type = models.CharField(max_length=64, db_index=True)  # Goods Receipt, Stock Transfer, Stock Adjustment
    document_number = models.CharField(max_length=100, db_index=True)  # GRN-00001, TR-00002
    action = models.CharField(max_length=64)  # CREATED, SUBMITTED, INSPECTED, APPROVED, PUTAWAY, POSTED, REVERSED
    previous_status = models.CharField(max_length=50, blank=True, default="")
    new_status = models.CharField(max_length=50)
    performed_by = models.CharField(max_length=150, db_index=True)
    remarks = models.TextField(blank=True, default="")
    approval_info = models.JSONField(default=dict, blank=True)
    references = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "sec_document_audit_events"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.document_number} [{self.document_type}]: {self.action} ({self.previous_status} -> {self.new_status}) by {self.performed_by}"


class DataChangeRecord(models.Model):
    """
    Field-level before and after comparison audit record.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.CharField(max_length=64, default="default-tenant", db_index=True)
    entity_type = models.CharField(max_length=100, db_index=True)  # StockAdjustment, Item, Warehouse, GoodsReceipt
    entity_id = models.CharField(max_length=100, db_index=True)
    entity_display_name = models.CharField(max_length=200, blank=True, default="")
    field_name = models.CharField(max_length=100, db_index=True)
    old_value = models.TextField(blank=True, default="")
    new_value = models.TextField(blank=True, default="")
    changed_by = models.CharField(max_length=150, db_index=True)
    change_reason = models.TextField(blank=True, default="")
    document_reference = models.CharField(max_length=100, blank=True, default="", db_index=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "sec_data_change_records"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.entity_type}#{self.entity_id}.{self.field_name}: '{self.old_value}' -> '{self.new_value}' by {self.changed_by}"

