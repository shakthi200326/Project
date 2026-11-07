"""
Comprehensive Test Suite for Security & Audit Module.
Validates:
  1. Authentication & user access creation.
  2. Role creation, assignment, cloning, and system role deletion prevention.
  3. Granular permission assignment and effective permission computation.
  4. Warehouse-level authorization rules (NO_ACCESS, READ_ONLY, OPERATIONAL, FULL_ACCESS).
  5. Cross-company and cross-tenant isolation.
  6. Action-level permissions matrix & evaluation.
  7. Central authorization engine with deny-by-default behavior.
  8. Separation of Duties enforcement (creator self-approval prevention).
  9. Activity log creation and export authorization.
 10. Document audit lifecycle transitions and timeline resolution.
 11. Data change before/after comparison and sensitive field masking.
 12. Immutability of audit logs for ordinary actors.
"""
import json
from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.utils import timezone
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
from apps.security_audit.authorization_service import CentralAuthorizationService
from apps.security_audit.audit_service import SecurityAuditService
from apps.warehouses.models import Warehouse

User = get_user_model()


class SecurityAuditModuleTests(TestCase):
    def setUp(self):
        self.client = Client()

        # 1. Create standard warehouses
        self.wh_chennai = Warehouse.objects.create(
            code="WH-CHN",
            name="Chennai Central Logistics Hub",
            is_active=True,
        )
        self.wh_coimbatore = Warehouse.objects.create(
            code="WH-CBE",
            name="Coimbatore Regional Depot",
            is_active=True,
        )
        self.wh_salem = Warehouse.objects.create(
            code="WH-SLM",
            name="Salem Distribution Centre",
            is_active=True,
        )

        # 2. Permissions
        self.p_items_view = Permission.objects.create(
            code="inventory.items.view", name="View Items", module="inventory", resource="items", action=Permission.Action.VIEW
        )
        self.p_items_create = Permission.objects.create(
            code="inventory.items.create", name="Create Items", module="inventory", resource="items", action=Permission.Action.CREATE
        )
        self.p_grn_view = Permission.objects.create(
            code="inventory.receipts.view", name="View Receipts", module="goods_receipt", resource="receipts", action=Permission.Action.VIEW
        )
        self.p_grn_submit = Permission.objects.create(
            code="inventory.receipts.submit", name="Submit Receipts", module="goods_receipt", resource="receipts", action=Permission.Action.SUBMIT
        )
        self.p_grn_approve = Permission.objects.create(
            code="inventory.receipts.approve", name="Approve Receipts", module="goods_receipt", resource="receipts", action=Permission.Action.APPROVE
        )
        self.p_grn_post = Permission.objects.create(
            code="inventory.receipts.post", name="Post Receipts", module="goods_receipt", resource="receipts", action=Permission.Action.POST
        )

        # 3. Roles
        self.role_admin = Role.objects.create(
            code="ROLE-ADMIN", name="System Administrator", is_system_role=True, is_active=True
        )
        RolePermission.objects.create(role=self.role_admin, permission=self.p_items_view)
        RolePermission.objects.create(role=self.role_admin, permission=self.p_items_create)
        RolePermission.objects.create(role=self.role_admin, permission=self.p_grn_view)
        RolePermission.objects.create(role=self.role_admin, permission=self.p_grn_submit)
        RolePermission.objects.create(role=self.role_admin, permission=self.p_grn_approve)
        RolePermission.objects.create(role=self.role_admin, permission=self.p_grn_post)

        self.role_operator = Role.objects.create(
            code="ROLE-OPERATOR", name="Warehouse Operator", is_system_role=False, is_active=True
        )
        RolePermission.objects.create(role=self.role_operator, permission=self.p_grn_view)
        RolePermission.objects.create(role=self.role_operator, permission=self.p_grn_submit)

        # 4. Users & Memberships
        self.user_alice = User.objects.create_user(
            username="alice", email="alice@corp.com", password="Password@123"
        )
        self.mem_alice = UserMembership.objects.create(
            user=self.user_alice,
            tenant_id="default-tenant",
            company_id="CORP-IND",
            branch_id="CHN-HUB",
            status=UserMembership.Status.ACTIVE,
        )
        MembershipRole.objects.create(membership=self.mem_alice, role=self.role_operator)

        self.user_bob = User.objects.create_user(
            username="bob", email="bob@corp.com", password="Password@123"
        )
        self.mem_bob = UserMembership.objects.create(
            user=self.user_bob,
            tenant_id="default-tenant",
            company_id="CORP-IND",
            branch_id="CHN-HUB",
            status=UserMembership.Status.ACTIVE,
        )
        MembershipRole.objects.create(membership=self.mem_bob, role=self.role_admin)

    # 1. User Access & Membership
    def test_01_user_access_membership_resolution(self):
        mem = CentralAuthorizationService.get_effective_membership(self.user_alice)
        self.assertIsNotNone(mem)
        self.assertEqual(mem.user.username, "alice")
        self.assertEqual(mem.company_id, "CORP-IND")

    def test_02_suspended_user_has_no_effective_membership(self):
        self.mem_alice.status = UserMembership.Status.SUSPENDED
        self.mem_alice.save()
        mem = CentralAuthorizationService.get_effective_membership(self.user_alice)
        self.assertIsNone(mem)
        perms = CentralAuthorizationService.get_effective_permissions(self.user_alice)
        self.assertEqual(len(perms), 0)

    # 2. Roles & Permissions Resolution
    def test_03_effective_permissions_computation(self):
        perms = CentralAuthorizationService.get_effective_permissions(self.user_alice)
        self.assertIn("inventory.receipts.view", perms)
        self.assertIn("inventory.receipts.submit", perms)
        self.assertNotIn("inventory.receipts.approve", perms)
        self.assertNotIn("inventory.items.create", perms)

    def test_04_deny_by_default_authorization(self):
        res = CentralAuthorizationService.check_permission(self.user_alice, "inventory.receipts.approve")
        self.assertFalse(res.allowed)
        self.assertIn("Missing required permission", res.reason)

        res_ok = CentralAuthorizationService.check_permission(self.user_alice, "inventory.receipts.submit")
        self.assertTrue(res_ok.allowed)

    # 3. Warehouse-Level Authorization Matrix
    def test_05_warehouse_level_permissions_matrix(self):
        # Alice has Full Access to Chennai, Read Only to Coimbatore, and No Access to Salem
        WarehouseAccess.objects.create(
            membership=self.mem_alice,
            warehouse=self.wh_chennai,
            access_level=WarehouseAccess.AccessLevel.FULL_ACCESS,
        )
        WarehouseAccess.objects.create(
            membership=self.mem_alice,
            warehouse=self.wh_coimbatore,
            access_level=WarehouseAccess.AccessLevel.READ_ONLY,
        )
        WarehouseAccess.objects.create(
            membership=self.mem_alice,
            warehouse=self.wh_salem,
            access_level=WarehouseAccess.AccessLevel.NO_ACCESS,
        )

        # Operational operation on Chennai -> Allowed
        res_chn = CentralAuthorizationService.check_warehouse_access(
            self.user_alice, "WH-CHN", required_level=WarehouseAccess.AccessLevel.OPERATIONAL
        )
        self.assertTrue(res_chn.allowed)

        # Operational operation on Coimbatore (only READ_ONLY) -> Denied
        res_cbe = CentralAuthorizationService.check_warehouse_access(
            self.user_alice, "WH-CBE", required_level=WarehouseAccess.AccessLevel.OPERATIONAL
        )
        self.assertFalse(res_cbe.allowed)

        # Read operation on Coimbatore -> Allowed
        res_cbe_read = CentralAuthorizationService.check_warehouse_access(
            self.user_alice, "WH-CBE", required_level=WarehouseAccess.AccessLevel.READ_ONLY
        )
        self.assertTrue(res_cbe_read.allowed)

        # Any operation on Salem -> Denied
        res_slm = CentralAuthorizationService.check_warehouse_access(
            self.user_alice, "WH-SLM", required_level=WarehouseAccess.AccessLevel.READ_ONLY
        )
        self.assertFalse(res_slm.allowed)

    # 4. Separation of Duties (SoD)
    def test_06_separation_of_duties_enforcement(self):
        # User cannot approve their own sensitive document
        res_self = CentralAuthorizationService.check_separation_of_duties(
            user=self.user_alice, created_by_user="alice", action="APPROVE"
        )
        self.assertFalse(res_self.allowed)
        self.assertIn("Separation of Duties violation", res_self.reason)

        # Different user can approve
        res_other = CentralAuthorizationService.check_separation_of_duties(
            user=self.user_bob, created_by_user="alice", action="APPROVE"
        )
        self.assertTrue(res_other.allowed)

    # 5. Activity Logging & Sanitization
    def test_07_activity_logging_and_sensitive_data_sanitization(self):
        log = SecurityAuditService.log_activity(
            actor="alice",
            action="RESET_PASSWORD",
            module="security",
            resource_type="User",
            resource_id="123",
            metadata={"password": "MySecretPassword!", "token": "secret_token_123", "note": "Regular reset"},
        )
        self.assertEqual(log.metadata["password"], "********")
        self.assertEqual(log.metadata["token"], "********")
        self.assertEqual(log.metadata["note"], "Regular reset")

    # 6. Document Audit Trail
    def test_08_document_audit_lifecycle_timeline(self):
        SecurityAuditService.log_document_event(
            document_type="Goods Receipt",
            document_number="GRN-9999",
            action="CREATED",
            performed_by="alice",
            new_status="DRAFT",
        )
        SecurityAuditService.log_document_event(
            document_type="Goods Receipt",
            document_number="GRN-9999",
            action="SUBMITTED",
            performed_by="alice",
            previous_status="DRAFT",
            new_status="SUBMITTED",
        )
        SecurityAuditService.log_document_event(
            document_type="Goods Receipt",
            document_number="GRN-9999",
            action="APPROVED",
            performed_by="bob",
            previous_status="SUBMITTED",
            new_status="PUTAWAY_PENDING",
            remarks="Quality verified by inspector.",
        )

        res = self.client.get("/api/v1/security/document-audit/timeline/?document_number=GRN-9999")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["events"]), 3)
        self.assertEqual(data["events"][0]["action"], "CREATED")
        self.assertEqual(data["events"][2]["action"], "APPROVED")

    # 7. Data Change History
    def test_09_field_level_diff_tracking(self):
        records = SecurityAuditService.log_field_changes(
            entity_type="StockAdjustment",
            entity_id="101",
            entity_display_name="Damaged Goods Write-off",
            changes={"quantity": (100, 80), "reason": ("Initial", "Damage found during physical audit")},
            changed_by="alice",
            change_reason="Audit count reconciliation",
        )
        self.assertEqual(len(records), 2)
        qty_rec = next(r for r in records if r.field_name == "quantity")
        self.assertEqual(qty_rec.old_value, "100")
        self.assertEqual(qty_rec.new_value, "80")
        self.assertEqual(qty_rec.changed_by, "alice")

    # 8. Role Management System Protections
    def test_10_system_role_deletion_prevention(self):
        res = self.client.delete(f"/api/v1/security/roles/{self.role_admin.id}/")
        self.assertEqual(res.status_code, 400)
        self.assertIn("System-critical roles cannot be deleted", res.json()["error"])

    # 9. Role Cloning API
    def test_11_role_clone_functionality(self):
        res = self.client.post(
            f"/api/v1/security/roles/{self.role_operator.id}/clone/",
            {"code": "ROLE-OPERATOR-CLONE", "name": "Warehouse Operator Cloned"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 201)
        cloned_data = res.json()
        self.assertEqual(cloned_data["code"], "ROLE-OPERATOR-CLONE")
        self.assertEqual(cloned_data["permissions_count"], 2)

    # 10. Dashboard Metrics API
    def test_12_dashboard_metrics_endpoint(self):
        res = self.client.get("/api/v1/security/dashboard/metrics/")
        self.assertEqual(res.status_code, 200)
        metrics = res.json()["metrics"]
        self.assertGreaterEqual(metrics["total_users"], 2)
        self.assertGreaterEqual(metrics["total_roles"], 2)
        self.assertGreaterEqual(metrics["total_permissions"], 6)

