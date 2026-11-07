from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.security_audit.models import (
    Permission,
    Role,
    RolePermission,
    UserMembership,
    MembershipRole,
    WarehouseAccess,
    ActivityLog,
    DocumentAuditEvent,
    DataChangeRecord,
)
from apps.warehouses.models import Warehouse

User = get_user_model()


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "name", "module", "resource", "action", "description", "created_at"]


class RolePermissionSerializer(serializers.ModelSerializer):
    permission = PermissionSerializer(read_only=True)
    permission_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = RolePermission
        fields = ["id", "role", "permission", "permission_id", "granted_at"]


class RoleSerializer(serializers.ModelSerializer):
    permissions_count = serializers.SerializerMethodField()
    users_count = serializers.SerializerMethodField()
    permission_codes = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            "id",
            "tenant_id",
            "code",
            "name",
            "description",
            "is_system_role",
            "is_active",
            "permissions_count",
            "users_count",
            "permission_codes",
            "created_at",
            "updated_at",
        ]

    def get_permissions_count(self, obj):
        return obj.role_permissions.count()

    def get_users_count(self, obj):
        return obj.role_memberships.count()

    def get_permission_codes(self, obj):
        return list(obj.role_permissions.values_list("permission__code", flat=True))


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_active", "is_superuser", "last_login", "date_joined"]


class WarehouseAccessSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    username = serializers.CharField(source="membership.user.username", read_only=True)
    user_email = serializers.CharField(source="membership.user.email", read_only=True)
    user_full_name = serializers.SerializerMethodField()

    class Meta:
        model = WarehouseAccess
        fields = [
            "id",
            "membership",
            "warehouse",
            "warehouse_code",
            "warehouse_name",
            "username",
            "user_email",
            "user_full_name",
            "access_level",
            "valid_from",
            "valid_until",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_user_full_name(self, obj):
        u = obj.membership.user
        name = f"{u.first_name} {u.last_name}".strip()
        return name if name else u.username


class UserMembershipSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source="user", read_only=True)
    roles = serializers.SerializerMethodField()
    warehouse_grants = serializers.SerializerMethodField()

    class Meta:
        model = UserMembership
        fields = [
            "id",
            "user",
            "user_details",
            "tenant_id",
            "company_id",
            "branch_id",
            "status",
            "access_start_date",
            "access_expiry_date",
            "roles",
            "warehouse_grants",
            "created_at",
            "updated_at",
        ]

    def get_roles(self, obj):
        return [
            {
                "id": str(mr.role.id),
                "code": mr.role.code,
                "name": mr.role.name,
                "is_system_role": mr.role.is_system_role,
            }
            for mr in obj.membership_roles.select_related("role").all()
        ]

    def get_warehouse_grants(self, obj):
        return [
            {
                "id": str(wa.id),
                "warehouse_id": wa.warehouse.id,
                "warehouse_code": wa.warehouse.code,
                "warehouse_name": wa.warehouse.name,
                "access_level": wa.access_level,
                "is_active": wa.is_active,
            }
            for wa in obj.warehouse_accesses.select_related("warehouse").all()
        ]


class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "tenant_id",
            "actor_username",
            "action",
            "module",
            "resource_type",
            "resource_id",
            "status",
            "ip_address",
            "correlation_id",
            "metadata",
            "created_at",
        ]


class DocumentAuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentAuditEvent
        fields = [
            "id",
            "tenant_id",
            "document_type",
            "document_number",
            "action",
            "previous_status",
            "new_status",
            "performed_by",
            "remarks",
            "approval_info",
            "references",
            "created_at",
        ]


class DataChangeRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataChangeRecord
        fields = [
            "id",
            "tenant_id",
            "entity_type",
            "entity_id",
            "entity_display_name",
            "field_name",
            "old_value",
            "new_value",
            "changed_by",
            "change_reason",
            "document_reference",
            "created_at",
        ]

