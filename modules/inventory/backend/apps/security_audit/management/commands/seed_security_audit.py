from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
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
from apps.warehouses.models import Warehouse

User = get_user_model()

class Command(BaseCommand):
    help = "Seeds initial permissions, enterprise roles, default memberships, and demo audit events."

    def handle(self, *args, **options):
        self.stdout.write("Seeding permissions...")

        # 1. Standard Granular Permissions
        PERMISSIONS_DATA = [
            # Dashboard
            ("dashboard.view", "View Dashboard", "dashboard", "overview", Permission.Action.VIEW, "View executive KPIs and analytics"),
            
            # Items & Products
            ("inventory.items.view", "View Items", "inventory", "items", Permission.Action.VIEW, "View product catalog and variants"),
            ("inventory.items.create", "Create Item", "inventory", "items", Permission.Action.CREATE, "Create new inventory products"),
            ("inventory.items.edit", "Edit Item", "inventory", "items", Permission.Action.EDIT, "Update existing inventory products"),
            ("inventory.items.delete", "Delete Item", "inventory", "items", Permission.Action.DELETE, "Archive or delete inventory products"),
            ("inventory.items.import", "Import Items", "inventory", "items", Permission.Action.IMPORT, "Bulk import products from CSV/Excel"),
            ("inventory.items.export", "Export Items", "inventory", "items", Permission.Action.EXPORT, "Export products catalog"),
            
            # Warehouses
            ("inventory.warehouses.view", "View Warehouses", "inventory", "warehouses", Permission.Action.VIEW, "View warehouse and location hierarchy"),
            ("inventory.warehouses.manage", "Manage Warehouses", "inventory", "warehouses", Permission.Action.CONFIGURE, "Create and configure warehouses, zones, and bins"),
            
            # Goods Receipt
            ("inventory.receipts.view", "View Goods Receipts", "goods_receipt", "receipts", Permission.Action.VIEW, "View receipt register and lines"),
            ("inventory.receipts.create", "Create Goods Receipt", "goods_receipt", "receipts", Permission.Action.CREATE, "Create inbound goods receipt documents"),
            ("inventory.receipts.submit", "Submit Goods Receipt", "goods_receipt", "receipts", Permission.Action.SUBMIT, "Submit receipt for inspection/approval"),
            ("inventory.receipts.approve", "Approve Goods Receipt", "goods_receipt", "receipts", Permission.Action.APPROVE, "Approve submitted goods receipt"),
            ("inventory.receipts.inspect", "Inspect Goods", "goods_receipt", "inspections", Permission.Action.EDIT, "Perform receipt and quality inspection"),
            ("inventory.receipts.putaway", "Putaway Goods", "goods_receipt", "putaway", Permission.Action.EDIT, "Record putaway to destination bins"),
            ("inventory.receipts.post", "Post Receipt to Stock", "goods_receipt", "receipts", Permission.Action.POST, "Post accepted receipt quantities into ledger"),
            ("inventory.receipts.reverse", "Reverse Receipt", "goods_receipt", "receipts", Permission.Action.REVERSE, "Perform reversal on posted receipt"),
            
            # Stock Operations
            ("inventory.stock.view", "View Stock Balances", "inventory", "stock", Permission.Action.VIEW, "View real-time stock balances and ledger"),
            ("inventory.stock.transfer", "Transfer Stock", "inventory", "transfers", Permission.Action.CREATE, "Execute inter-warehouse and inter-location transfers"),
            ("inventory.stock.adjust", "Adjust Stock", "inventory", "adjustments", Permission.Action.CREATE, "Record stock adjustments"),
            ("inventory.stock.post", "Post Stock Ledger", "inventory", "stock", Permission.Action.POST, "Directly post stock transactions into immutable ledger"),
            ("inventory.stock.reconcile", "Stock Count & Reconciliation", "inventory", "reconciliation", Permission.Action.EDIT, "Perform physical stock count and variance reconciliation"),
            
            # Tracking
            ("inventory.tracking.view", "View Batch & Serial Tracking", "inventory", "tracking", Permission.Action.VIEW, "Inspect batch lifecycle, expiry, and serial history"),
            ("inventory.tracking.manage", "Manage Batches & Serials", "inventory", "tracking", Permission.Action.EDIT, "Perform batch release, quarantine, and recall"),
            
            # Reports & Analytics
            ("inventory.reports.view", "View Reports & Analytics", "inventory", "reports", Permission.Action.VIEW, "Access valuation, ageing, movement, and discrepancy reports"),
            ("inventory.reports.export", "Export Reports", "inventory", "reports", Permission.Action.EXPORT, "Download audit reports and spreadsheets"),
            
            # Security & Audit
            ("security.users.view", "View Users & Access", "security", "users", Permission.Action.VIEW, "View user access register and membership details"),
            ("security.users.manage", "Manage Users & Access", "security", "users", Permission.Action.EDIT, "Assign roles, company, and warehouse access"),
            ("security.roles.manage", "Manage Roles", "security", "roles", Permission.Action.CONFIGURE, "Create, edit, clone, and configure enterprise roles"),
            ("security.permissions.view", "View Permission Matrix", "security", "permissions", Permission.Action.VIEW, "Inspect role-permission and action matrices"),
            ("security.audit.view", "View Audit Trails & Logs", "security", "audit", Permission.Action.VIEW, "Access activity logs, document audit trails, and data changes"),
            ("security.audit.export", "Export Audit Records", "security", "audit", Permission.Action.EXPORT, "Export activity and document audit trails"),
            ("security.admin", "Full Security Administration", "security", "all", Permission.Action.CONFIGURE, "Full administrative control over security policies"),
        ]

        perm_objects = {}
        for code, name, module, resource, action, desc in PERMISSIONS_DATA:
            p, _ = Permission.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "module": module,
                    "resource": resource,
                    "action": action,
                    "description": desc,
                },
            )
            perm_objects[code] = p

        # 2. Configurable Enterprise Roles
        ROLES_DATA = [
            ("ROLE-SYSADMIN", "System Administrator", "Full uninhibited platform and system administration.", True, list(perm_objects.keys())),
            ("ROLE-ERP-ADMIN", "ERP Administrator", "Operational ERP management across all company units.", True, [c for c in perm_objects.keys() if c != "security.admin"]),
            ("ROLE-INV-ADMIN", "Inventory Administrator", "Complete control of inventory products, warehouses, and operations.", False, [c for c in perm_objects.keys() if c.startswith("inventory.") or c.startswith("dashboard.")]),
            ("ROLE-INV-MGR", "Inventory Manager", "Oversees stock levels, approvals, transfers, and warehouse activities.", False, [
                "dashboard.view",
                "inventory.items.view", "inventory.items.create", "inventory.items.edit", "inventory.items.export",
                "inventory.warehouses.view",
                "inventory.receipts.view", "inventory.receipts.approve", "inventory.receipts.post",
                "inventory.stock.view", "inventory.stock.transfer", "inventory.stock.adjust", "inventory.stock.reconcile",
                "inventory.tracking.view", "inventory.reports.view", "inventory.reports.export",
            ]),
            ("ROLE-WH-MGR", "Warehouse Manager", "Full operational authority over specific assigned warehouses.", False, [
                "dashboard.view",
                "inventory.items.view",
                "inventory.warehouses.view",
                "inventory.receipts.view", "inventory.receipts.create", "inventory.receipts.submit", "inventory.receipts.inspect", "inventory.receipts.putaway", "inventory.receipts.post",
                "inventory.stock.view", "inventory.stock.transfer", "inventory.stock.adjust",
                "inventory.tracking.view", "inventory.reports.view",
            ]),
            ("ROLE-STOREKEEPER", "Storekeeper", "Handles physical stock receipt, picking, and warehouse putaway.", False, [
                "inventory.items.view",
                "inventory.warehouses.view",
                "inventory.receipts.view", "inventory.receipts.create", "inventory.receipts.submit", "inventory.receipts.putaway",
                "inventory.stock.view", "inventory.stock.transfer",
            ]),
            ("ROLE-INSPECTOR", "Goods Receipt Inspector", "Conducts quantity count and visual receipt verification.", False, [
                "inventory.items.view",
                "inventory.receipts.view", "inventory.receipts.inspect",
            ]),
            ("ROLE-QC-INSPECTOR", "Quality Inspector", "Conducts quality checks, checklist tests, and lab validations.", False, [
                "inventory.items.view",
                "inventory.receipts.view", "inventory.receipts.inspect",
            ]),
            ("ROLE-AUDITOR", "Stock Auditor", "Read-only auditor with access to ledger history and audit records.", False, [
                "dashboard.view",
                "inventory.items.view",
                "inventory.warehouses.view",
                "inventory.receipts.view",
                "inventory.stock.view",
                "inventory.tracking.view",
                "inventory.reports.view",
                "inventory.reports.export",
                "security.audit.view",
                "security.audit.export",
            ]),
            ("ROLE-READONLY", "Read-only User", "Read-only viewer across standard inventory screens.", False, [
                "dashboard.view",
                "inventory.items.view",
                "inventory.warehouses.view",
                "inventory.receipts.view",
                "inventory.stock.view",
                "inventory.tracking.view",
                "inventory.reports.view",
            ]),
        ]

        self.stdout.write("Seeding roles and role-permission mappings...")
        for code, name, desc, is_sys, p_codes in ROLES_DATA:
            role, _ = Role.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "description": desc,
                    "is_system_role": is_sys,
                    "is_active": True,
                },
            )
            # Assign permissions
            for pc in p_codes:
                if pc in perm_objects:
                    RolePermission.objects.get_or_create(role=role, permission=perm_objects[pc])

        # 3. Create or Update Core Admin & Operator Users
        admin_user, _ = User.objects.get_or_create(
            username="admin",
            defaults={"email": "admin@apex-industries.corp", "first_name": "System", "last_name": "Administrator", "is_staff": True, "is_superuser": True},
        )
        if not admin_user.password:
            admin_user.set_password("Admin@1234")
            admin_user.save()

        mgr_user, _ = User.objects.get_or_create(
            username="inventory_manager",
            defaults={"email": "inv_mgr@apex-industries.corp", "first_name": "Sarah", "last_name": "Connor", "is_active": True},
        )
        if not mgr_user.password:
            mgr_user.set_password("Manager@1234")
            mgr_user.save()

        inspector_user, _ = User.objects.get_or_create(
            username="qc_inspector",
            defaults={"email": "qc@apex-industries.corp", "first_name": "John", "last_name": "Smith", "is_active": True},
        )
        if not inspector_user.password:
            inspector_user.set_password("Inspector@1234")
            inspector_user.save()

        # 4. Create User Memberships
        admin_mem, _ = UserMembership.objects.get_or_create(
            user=admin_user,
            tenant_id="default-tenant",
            company_id="APEX-GLOBAL",
            branch_id="HQ-PLANT",
            defaults={"status": UserMembership.Status.ACTIVE, "access_start_date": timezone.localdate()},
        )
        mgr_mem, _ = UserMembership.objects.get_or_create(
            user=mgr_user,
            tenant_id="default-tenant",
            company_id="APEX-GLOBAL",
            branch_id="EAST-DIST",
            defaults={"status": UserMembership.Status.ACTIVE, "access_start_date": timezone.localdate()},
        )
        inspector_mem, _ = UserMembership.objects.get_or_create(
            user=inspector_user,
            tenant_id="default-tenant",
            company_id="APEX-GLOBAL",
            branch_id="HQ-PLANT",
            defaults={"status": UserMembership.Status.ACTIVE, "access_start_date": timezone.localdate()},
        )

        # 5. Assign Membership Roles
        sys_role = Role.objects.get(code="ROLE-SYSADMIN")
        mgr_role = Role.objects.get(code="ROLE-INV-MGR")
        qc_role = Role.objects.get(code="ROLE-QC-INSPECTOR")

        MembershipRole.objects.get_or_create(membership=admin_mem, role=sys_role)
        MembershipRole.objects.get_or_create(membership=mgr_mem, role=mgr_role)
        MembershipRole.objects.get_or_create(membership=inspector_mem, role=qc_role)

        # 6. Assign Warehouse Access Grants
        warehouses = list(Warehouse.objects.all()[:4])
        if warehouses:
            # Admin has full access to all
            for w in warehouses:
                WarehouseAccess.objects.get_or_create(
                    membership=admin_mem,
                    warehouse=w,
                    defaults={"access_level": WarehouseAccess.AccessLevel.FULL_ACCESS},
                )
            
            # Manager has operational access to primary, read only to secondary
            WarehouseAccess.objects.get_or_create(
                membership=mgr_mem,
                warehouse=warehouses[0],
                defaults={"access_level": WarehouseAccess.AccessLevel.FULL_ACCESS},
            )
            if len(warehouses) > 1:
                WarehouseAccess.objects.get_or_create(
                    membership=mgr_mem,
                    warehouse=warehouses[1],
                    defaults={"access_level": WarehouseAccess.AccessLevel.OPERATIONAL},
                )

            # Inspector has operational access to primary receiving warehouse
            WarehouseAccess.objects.get_or_create(
                membership=inspector_mem,
                warehouse=warehouses[0],
                defaults={"access_level": WarehouseAccess.AccessLevel.OPERATIONAL},
            )

        # 7. Initial Seed Activity Logs
        if not ActivityLog.objects.exists():
            ActivityLog.objects.create(
                tenant_id="default-tenant",
                actor_username="admin",
                action="SYSTEM_INIT",
                module="security",
                resource_type="RoleMatrix",
                resource_id="ROLE-SYSADMIN",
                status="SUCCESS",
                ip_address="127.0.0.1",
                metadata={"message": "Initial enterprise roles and permissions provisioned."},
            )
            ActivityLog.objects.create(
                tenant_id="default-tenant",
                actor_username="admin",
                action="ASSIGN_ROLE",
                module="security",
                resource_type="UserMembership",
                resource_id=str(mgr_mem.id),
                status="SUCCESS",
                ip_address="127.0.0.1",
                metadata={"assigned_role": "ROLE-INV-MGR", "target_user": "inventory_manager"},
            )

        # 8. Initial Document Audit Events
        if not DocumentAuditEvent.objects.exists():
            DocumentAuditEvent.objects.create(
                tenant_id="default-tenant",
                document_type="Goods Receipt",
                document_number="GRN-00001",
                action="POSTED",
                previous_status="PUTAWAY_PENDING",
                new_status="POSTED",
                performed_by="admin",
                remarks="Initial verified receipt posted to stock ledger.",
                references={"warehouse": warehouses[0].code if warehouses else "MAIN-WH"},
            )

        # 9. Initial Data Change Records
        if not DataChangeRecord.objects.exists():
            DataChangeRecord.objects.create(
                tenant_id="default-tenant",
                entity_type="WarehouseAccess",
                entity_id=str(mgr_mem.id),
                entity_display_name="Warehouse Access Grant",
                field_name="access_level",
                old_value="READ_ONLY",
                new_value="FULL_ACCESS",
                changed_by="admin",
                change_reason="Promoted to regional inventory manager.",
                document_reference="AUTH-REQ-001",
            )

        self.stdout.write(self.style.SUCCESS("Security & Audit seed data created successfully!"))

