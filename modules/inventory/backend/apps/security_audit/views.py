import csv
import io
from django.http import HttpResponse
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

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
from apps.security_audit.serializers import (
    PermissionSerializer,
    RoleSerializer,
    UserMembershipSerializer,
    WarehouseAccessSerializer,
    ActivityLogSerializer,
    DocumentAuditEventSerializer,
    DataChangeRecordSerializer,
    UserSerializer,
)
from apps.security_audit.authorization_service import CentralAuthorizationService
from apps.security_audit.audit_service import SecurityAuditService
from apps.warehouses.models import Warehouse

User = get_user_model()


class SecurityDashboardMetricsView(APIView):
    """
    Consolidated real-time KPIs for the Security & Audit module.
    """
    def get(self, request):
        total_users = User.objects.count()
        active_memberships = UserMembership.objects.filter(status=UserMembership.Status.ACTIVE).count()
        total_roles = Role.objects.count()
        total_permissions = Permission.objects.count()
        total_warehouse_grants = WarehouseAccess.objects.filter(is_active=True).count()
        total_activity_logs = ActivityLog.objects.count()
        total_audit_events = DocumentAuditEvent.objects.count()
        total_data_changes = DataChangeRecord.objects.count()

        # Recent activities
        recent_activities = ActivityLogSerializer(ActivityLog.objects.all()[:8], many=True).data

        return Response({
            "metrics": {
                "total_users": total_users,
                "active_memberships": active_memberships,
                "total_roles": total_roles,
                "total_permissions": total_permissions,
                "total_warehouse_grants": total_warehouse_grants,
                "total_activity_logs": total_activity_logs,
                "total_audit_events": total_audit_events,
                "total_data_changes": total_data_changes,
            },
            "recent_activities": recent_activities,
        })


class UserAccessViewSet(viewsets.ModelViewSet):
    """
    Manages user memberships, organizational assignments, roles, and status.
    """
    queryset = UserMembership.objects.select_related("user").prefetch_related("membership_roles__role", "warehouse_accesses__warehouse").all()
    serializer_class = UserMembershipSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()
        status_filter = self.request.query_params.get("status", "").strip()
        company = self.request.query_params.get("company", "").strip()

        if search:
            qs = qs.filter(
                Q(user__username__icontains=search)
                | Q(user__email__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(company_id__icontains=search)
                | Q(branch_id__icontains=search)
            )
        if status_filter:
            qs = qs.filter(status=status_filter)
        if company:
            qs = qs.filter(company_id=company)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        username = data.get("username", "").strip()
        email = data.get("email", "").strip()
        first_name = data.get("first_name", "").strip()
        last_name = data.get("last_name", "").strip()
        password = data.get("password", "").strip()
        company_id = data.get("company_id", "APEX-GLOBAL").strip()
        branch_id = data.get("branch_id", "HQ-PLANT").strip()
        role_ids = data.get("role_ids", [])
        status_val = data.get("status", UserMembership.Status.ACTIVE)

        if not username or not email:
            return Response({"error": "Username and Email are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Get or create identity user
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email, "first_name": first_name, "last_name": last_name, "is_active": True},
        )
        if not created:
            user.email = email
            if first_name: user.first_name = first_name
            if last_name: user.last_name = last_name
        if password:
            user.set_password(password)
        user.save()

        # Create or update membership
        membership, _ = UserMembership.objects.update_or_create(
            user=user,
            tenant_id="default-tenant",
            company_id=company_id,
            branch_id=branch_id,
            defaults={
                "status": status_val,
                "access_start_date": data.get("access_start_date") or timezone.localdate(),
                "access_expiry_date": data.get("access_expiry_date") or None,
            },
        )

        # Assign roles
        if role_ids:
            MembershipRole.objects.filter(membership=membership).delete()
            for r_id in role_ids:
                role = Role.objects.filter(id=r_id).first()
                if role:
                    MembershipRole.objects.create(membership=membership, role=role)

        # Audit
        actor = getattr(request.user, "username", "admin")
        SecurityAuditService.log_activity(
            actor=actor,
            action="CREATE_USER_ACCESS",
            module="security",
            resource_type="UserMembership",
            resource_id=str(membership.id),
            metadata={"username": username, "company": company_id, "branch": branch_id},
        )

        return Response(UserMembershipSerializer(membership).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def assign_roles(self, request, pk=None):
        membership = self.get_object()
        role_ids = request.data.get("role_ids", [])
        roles = Role.objects.filter(id__in=role_ids)

        MembershipRole.objects.filter(membership=membership).delete()
        for r in roles:
            MembershipRole.objects.create(membership=membership, role=r)

        SecurityAuditService.log_activity(
            actor=getattr(request.user, "username", "admin"),
            action="UPDATE_USER_ROLES",
            module="security",
            resource_type="UserMembership",
            resource_id=str(membership.id),
            metadata={"assigned_roles": [r.code for r in roles], "username": membership.user.username},
        )
        return Response(UserMembershipSerializer(membership).data)

    @action(detail=True, methods=["post"])
    def toggle_status(self, request, pk=None):
        membership = self.get_object()
        new_status = request.data.get("status")
        if new_status not in [UserMembership.Status.ACTIVE, UserMembership.Status.INACTIVE, UserMembership.Status.SUSPENDED]:
            return Response({"error": "Invalid status value."}, status=status.HTTP_400_BAD_REQUEST)

        old_status = membership.status
        membership.status = new_status
        membership.save()

        # Field-level change audit
        SecurityAuditService.log_field_changes(
            entity_type="UserMembership",
            entity_id=str(membership.id),
            entity_display_name=f"Membership {membership.user.username}",
            changes={"status": (old_status, new_status)},
            changed_by=getattr(request.user, "username", "admin"),
            change_reason=request.data.get("reason", "Administrative status toggle"),
        )

        return Response(UserMembershipSerializer(membership).data)


class RoleViewSet(viewsets.ModelViewSet):
    """
    CRUD for enterprise roles and permission assignment.
    """
    queryset = Role.objects.prefetch_related("role_permissions__permission").all()
    serializer_class = RoleSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search) | Q(description__icontains=search))
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        code = data.get("code", "").strip().upper()
        name = data.get("name", "").strip()
        description = data.get("description", "").strip()
        permission_codes = data.get("permission_codes", [])

        if not code or not name:
            return Response({"error": "Role code and name are required."}, status=status.HTTP_400_BAD_REQUEST)

        if Role.objects.filter(code=code).exists():
            return Response({"error": f"Role with code '{code}' already exists."}, status=status.HTTP_400_BAD_REQUEST)

        role = Role.objects.create(
            code=code,
            name=name,
            description=description,
            is_system_role=False,
            is_active=True,
        )

        # Assign permissions
        if permission_codes:
            perms = Permission.objects.filter(code__in=permission_codes)
            for p in perms:
                RolePermission.objects.create(role=role, permission=p)

        SecurityAuditService.log_activity(
            actor=getattr(request.user, "username", "admin"),
            action="CREATE_ROLE",
            module="security",
            resource_type="Role",
            resource_id=str(role.id),
            metadata={"code": code, "name": name, "permissions_count": len(permission_codes)},
        )

        return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        role = self.get_object()
        data = request.data

        if role.is_system_role and "code" in data and data["code"] != role.code:
            return Response({"error": "Cannot modify the code of a system-critical role."}, status=status.HTTP_400_BAD_REQUEST)

        role.name = data.get("name", role.name)
        role.description = data.get("description", role.description)
        role.is_active = data.get("is_active", role.is_active)
        role.save()

        if "permission_codes" in data:
            RolePermission.objects.filter(role=role).delete()
            perms = Permission.objects.filter(code__in=data["permission_codes"])
            for p in perms:
                RolePermission.objects.create(role=role, permission=p)

        SecurityAuditService.log_activity(
            actor=getattr(request.user, "username", "admin"),
            action="UPDATE_ROLE",
            module="security",
            resource_type="Role",
            resource_id=str(role.id),
            metadata={"code": role.code, "name": role.name},
        )
        return Response(RoleSerializer(role).data)

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system_role:
            return Response({"error": "System-critical roles cannot be deleted."}, status=status.HTTP_400_BAD_REQUEST)

        assigned_count = role.role_memberships.count()
        if assigned_count > 0:
            return Response(
                {"error": f"Role is currently assigned to {assigned_count} user membership(s). Please unassign before deleting."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        role_code = role.code
        role_id = str(role.id)
        role.delete()

        SecurityAuditService.log_activity(
            actor=getattr(request.user, "username", "admin"),
            action="DELETE_ROLE",
            module="security",
            resource_type="Role",
            resource_id=role_id,
            metadata={"code": role_code},
        )
        return Response({"success": True, "message": f"Role '{role_code}' deleted."})

    @action(detail=True, methods=["post"])
    def clone(self, request, pk=None):
        source = self.get_object()
        new_code = request.data.get("code", "").strip().upper()
        new_name = request.data.get("name", "").strip()

        if not new_code or not new_name:
            return Response({"error": "New role code and name are required."}, status=status.HTTP_400_BAD_REQUEST)

        if Role.objects.filter(code=new_code).exists():
            return Response({"error": f"Role with code '{new_code}' already exists."}, status=status.HTTP_400_BAD_REQUEST)

        cloned = Role.objects.create(
            code=new_code,
            name=new_name,
            description=f"Cloned from {source.code}: {source.description}",
            is_system_role=False,
            is_active=True,
        )

        for rp in source.role_permissions.all():
            RolePermission.objects.create(role=cloned, permission=rp.permission)

        SecurityAuditService.log_activity(
            actor=getattr(request.user, "username", "admin"),
            action="CLONE_ROLE",
            module="security",
            resource_type="Role",
            resource_id=str(cloned.id),
            metadata={"source_role": source.code, "cloned_role": new_code},
        )
        return Response(RoleSerializer(cloned).data, status=status.HTTP_201_CREATED)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Catalog of all granular permissions grouped by module, resource, and action.
    """
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        module = self.request.query_params.get("module", "").strip()
        resource = self.request.query_params.get("resource", "").strip()
        search = self.request.query_params.get("search", "").strip()

        if module:
            qs = qs.filter(module=module)
        if resource:
            qs = qs.filter(resource=resource)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search) | Q(description__icontains=search))
        return qs

    @action(detail=False, methods=["get"])
    def categories(self, request):
        modules = list(Permission.objects.values_list("module", flat=True).distinct())
        resources = list(Permission.objects.values_list("resource", flat=True).distinct())
        actions = list(Permission.objects.values_list("action", flat=True).distinct())
        return Response({
            "modules": sorted(modules),
            "resources": sorted(resources),
            "actions": sorted(actions),
        })

    @action(detail=False, methods=["get"])
    def effective(self, request):
        username = request.query_params.get("username", "").strip()
        user = User.objects.filter(username=username).first() if username else request.user
        if not user or not user.is_authenticated:
            return Response({"error": "User not found or unauthenticated."}, status=status.HTTP_404_NOT_FOUND)

        perms = CentralAuthorizationService.get_effective_permissions(user)
        return Response({
            "username": user.username,
            "is_superuser": getattr(user, "is_superuser", False),
            "permissions": sorted(list(perms)),
        })


class WarehouseAccessViewSet(viewsets.ModelViewSet):
    """
    Dual-view for warehouse-level authorization (User-wise and Warehouse-wise).
    """
    queryset = WarehouseAccess.objects.select_related("membership__user", "warehouse").all()
    serializer_class = WarehouseAccessSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        membership_id = self.request.query_params.get("membership_id", "").strip()
        warehouse_id = self.request.query_params.get("warehouse_id", "").strip()
        search = self.request.query_params.get("search", "").strip()

        if membership_id:
            qs = qs.filter(membership_id=membership_id)
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)
        if search:
            qs = qs.filter(
                Q(membership__user__username__icontains=search)
                | Q(warehouse__code__icontains=search)
                | Q(warehouse__name__icontains=search)
            )
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        membership_id = data.get("membership_id")
        warehouse_id = data.get("warehouse_id")
        access_level = data.get("access_level", WarehouseAccess.AccessLevel.READ_ONLY)

        if not membership_id or not warehouse_id:
            return Response({"error": "Membership ID and Warehouse ID are required."}, status=status.HTTP_400_BAD_REQUEST)

        grant, created = WarehouseAccess.objects.update_or_create(
            membership_id=membership_id,
            warehouse_id=warehouse_id,
            defaults={
                "access_level": access_level,
                "valid_from": data.get("valid_from") or timezone.localdate(),
                "valid_until": data.get("valid_until") or None,
                "is_active": data.get("is_active", True),
            },
        )

        SecurityAuditService.log_activity(
            actor=getattr(request.user, "username", "admin"),
            action="ASSIGN_WAREHOUSE_ACCESS",
            module="security",
            resource_type="WarehouseAccess",
            resource_id=str(grant.id),
            metadata={
                "user": grant.membership.user.username,
                "warehouse": grant.warehouse.code,
                "access_level": access_level,
            },
        )
        return Response(WarehouseAccessSerializer(grant).data, status=status.HTTP_201_CREATED)


class ActionPermissionsView(APIView):
    """
    Provides the comprehensive Action Matrix and evaluates specific user action feasibility.
    """
    def get(self, request):
        roles = Role.objects.prefetch_related("role_permissions__permission").all()
        actions = [c[0] for c in Permission.Action.choices]
        resources = sorted(list(Permission.objects.values_list("resource", flat=True).distinct()))

        matrix = []
        for r in roles:
            assigned = set(r.role_permissions.values_list("permission__code", flat=True))
            matrix.append({
                "role_id": str(r.id),
                "role_code": r.code,
                "role_name": r.name,
                "permissions": list(assigned),
            })

        return Response({
            "actions": actions,
            "resources": resources,
            "matrix": matrix,
        })


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Append-only register for searching, filtering, and exporting activity logs.
    """
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        module = self.request.query_params.get("module", "").strip()
        status_filter = self.request.query_params.get("status", "").strip()
        actor = self.request.query_params.get("actor", "").strip()
        date_from = self.request.query_params.get("date_from", "").strip()
        date_to = self.request.query_params.get("date_to", "").strip()
        search = self.request.query_params.get("search", "").strip()

        if module:
            qs = qs.filter(module=module)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if actor:
            qs = qs.filter(actor_username__icontains=actor)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        if search:
            qs = qs.filter(
                Q(actor_username__icontains=search)
                | Q(action__icontains=search)
                | Q(resource_type__icontains=search)
                | Q(resource_id__icontains=search)
            )
        return qs

    @action(detail=False, methods=["get"])
    def export(self, request):
        qs = self.get_queryset()[:1000]
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Event ID", "Timestamp", "Actor", "Action", "Module", "Resource Type", "Resource ID", "Status", "IP Address"])
        for item in qs:
            writer.writerow([
                str(item.id),
                item.created_at.isoformat(),
                item.actor_username,
                item.action,
                item.module,
                item.resource_type,
                item.resource_id,
                item.status,
                item.ip_address or "",
            ])
        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="activity_logs.csv"'
        return response


class DocumentAuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Lifecycle timeline stream for business documents (Goods Receipt, Transfer, Adjustment, etc.).
    """
    queryset = DocumentAuditEvent.objects.all()
    serializer_class = DocumentAuditEventSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        doc_type = self.request.query_params.get("document_type", "").strip()
        doc_number = self.request.query_params.get("document_number", "").strip()
        search = self.request.query_params.get("search", "").strip()

        if doc_type:
            qs = qs.filter(document_type=doc_type)
        if doc_number:
            qs = qs.filter(document_number__icontains=doc_number)
        if search:
            qs = qs.filter(
                Q(document_number__icontains=search)
                | Q(document_type__icontains=search)
                | Q(performed_by__icontains=search)
                | Q(action__icontains=search)
                | Q(remarks__icontains=search)
            )
        return qs

    @action(detail=False, methods=["get"])
    def timeline(self, request):
        doc_number = request.query_params.get("document_number", "").strip()
        if not doc_number:
            return Response({"error": "document_number query param is required."}, status=status.HTTP_400_BAD_REQUEST)

        events = DocumentAuditEvent.objects.filter(document_number=doc_number).order_by("created_at")
        return Response({
            "document_number": doc_number,
            "events": DocumentAuditEventSerializer(events, many=True).data,
        })


class DataChangeRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Before and after field diff inspection and comparison.
    """
    queryset = DataChangeRecord.objects.all()
    serializer_class = DataChangeRecordSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        entity_type = self.request.query_params.get("entity_type", "").strip()
        entity_id = self.request.query_params.get("entity_id", "").strip()
        changed_by = self.request.query_params.get("changed_by", "").strip()
        search = self.request.query_params.get("search", "").strip()

        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        if changed_by:
            qs = qs.filter(changed_by__icontains=changed_by)
        if search:
            qs = qs.filter(
                Q(entity_type__icontains=search)
                | Q(entity_id__icontains=search)
                | Q(field_name__icontains=search)
                | Q(changed_by__icontains=search)
                | Q(change_reason__icontains=search)
                | Q(document_reference__icontains=search)
            )
        return qs

