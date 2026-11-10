import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  Download,
  Camera,
  Package,
  Layers,
  Tag,
  Boxes,
  Ruler,
  Barcode,
  Warehouse,
  MapPin,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  RotateCcw,
  BookmarkCheck,
  CheckCircle2,
  Scale,
  Truck,
  ShieldAlert,
  FileSpreadsheet,
  Cpu,
  Hash,
  Clock,
  TrendingUp,
  AlertTriangle,
  PieChart,
  DollarSign,
  Activity,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  Building2,
  ShieldCheck,
  Database,
  Radio,
  History,
  Calendar,
  ShoppingCart,
  BarChart3,
  ClipboardCheck,
  RefreshCw,
  Zap,
  BookOpen,
  ClipboardList,
  ScanSearch,
  FlaskConical,
  PackageCheck,
  PackageX,
  Split,
  Layers3,
  FileWarning,
  Users,
  KeyRound,
  FileText,
  FileDiff,
  Shield,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useWorkspace } from "./ContextSelector";
import { CommandPaletteModal } from "../../../modules/inventory/frontend/src/components/CommandPaletteModal.jsx";
import { API_BASE, getApiStatus, subscribeApiStatus } from "../../../modules/inventory/frontend/src/services/api.js";

export function AppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, toggleMode } = useTheme();
  const { activeFacility, facilities, setActiveFacility } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isApiLive, setIsApiLive] = useState(getApiStatus());
  const [openGroups, setOpenGroups] = useState({
    product_management: true,
    warehouse_management: false,
    operations: true,
    goods_receipt: true,
    control: true,
    tracking: false,
    planning: false,
    audit: false,
    analytics: false,
  });

  useEffect(() => {
    const unsub = subscribeApiStatus(setIsApiLive);
    return unsub;
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/inventory/notifications/alerts/?active=true&unread=true`);
      if (!response.ok) throw new Error(`Notification request failed (HTTP ${response.status}).`);
      const data = await response.json();
      setNotifications((data.results || []).map((alert) => ({
        id: alert.id,
        title: alert.title,
        description: alert.description,
        time: new Date(alert.last_seen_at).toLocaleString(),
        unread: !alert.is_read,
        type: alert.severity === "CRITICAL" ? "warning" : "info",
        path: alert.action_url,
      })));
    } catch (error) {
      console.error("Failed to load in-app inventory notifications.", error);
    }
  }, []);

  const markNotificationRead = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE}/inventory/notifications/alerts/${id}/read/`, { method: "POST" });
      if (!response.ok) throw new Error(`Mark-read request failed (HTTP ${response.status}).`);
      setNotifications((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Failed to mark inventory notification as read.", error);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/inventory/notifications/alerts/read-all/`, { method: "POST" });
      if (!response.ok) throw new Error(`Mark-all-read request failed (HTTP ${response.status}).`);
      setNotifications([]);
    } catch (error) {
      console.error("Failed to mark all inventory notifications as read.", error);
    }
  }, []);

  useEffect(() => {
    refreshNotifications();
    const timer = setInterval(refreshNotifications, 60000);
    return () => clearInterval(timer);
  }, [refreshNotifications]);

  useEffect(() => {
    const path = location.pathname;
    if (
      path.startsWith("/inventory/products") ||
      path.startsWith("/inventory/categories") ||
      path.startsWith("/inventory/brands") ||
      path.startsWith("/inventory/units") ||
      path.startsWith("/inventory/attributes") ||
      path.startsWith("/inventory/skus") ||
      path.startsWith("/inventory/barcodes") ||
      path === "/inventory/variants"
    ) {
      setOpenGroups((p) => ({ ...p, product_management: true }));
    } else if (
      path.startsWith("/inventory/warehouses") ||
      path.startsWith("/inventory/locations") ||
      path.startsWith("/inventory/storage-structure") ||
      path.startsWith("/inventory/racks-bins") ||
      path.startsWith("/inventory/zones") ||
      path.startsWith("/inventory/racks") ||
      path.startsWith("/inventory/bins")
    ) {
      setOpenGroups((p) => ({ ...p, warehouse_management: true }));
    } else if (path.startsWith("/inventory/operations")) {
      setOpenGroups((p) => ({ ...p, operations: true }));
    } else if (path.startsWith("/inventory/goods-receipt")) {
      setOpenGroups((p) => ({ ...p, goods_receipt: true }));
    } else if (path.startsWith("/inventory/control")) {
      setOpenGroups((p) => ({ ...p, control: true }));
    } else if (path.startsWith("/inventory/reports")) {
      setOpenGroups((p) => ({ ...p, analytics: true }));
    } else if (path.startsWith("/inventory/tracking")) {
      setOpenGroups((p) => ({ ...p, tracking: true }));
    } else if (path.startsWith("/inventory/planning")) {
      setOpenGroups((p) => ({ ...p, planning: true }));
    } else if (path.startsWith("/inventory/audit")) {
      setOpenGroups((p) => ({ ...p, audit: true }));
    } else if (path.startsWith("/inventory/analytics")) {
      setOpenGroups((p) => ({ ...p, analytics: true }));
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const getBreadcrumbs = (pathname) => {
    const map = {
      "/inventory": [{ label: "Inventory", path: "/inventory" }, { label: "Executive Dashboard" }],
      "/inventory/products/overview": [{ label: "Inventory", path: "/inventory" }, { label: "Items & Products", path: "/inventory/products/overview" }, { label: "Product Overview" }],
      "/inventory/products": [{ label: "Inventory", path: "/inventory" }, { label: "Product Management", path: "/inventory/products" }, { label: "Item Master" }],
      "/inventory/products/data-management": [{ label: "Inventory", path: "/inventory" }, { label: "Product Management", path: "/inventory/products" }, { label: "Item Data Management" }],
      "/inventory/products/variants": [{ label: "Inventory", path: "/inventory" }, { label: "Product Management", path: "/inventory/products" }, { label: "Product Variants" }],
      "/inventory/attributes": [{ label: "Inventory", path: "/inventory" }, { label: "Product Classification", path: "/inventory/categories" }, { label: "Product Attributes" }],
      "/inventory/skus": [{ label: "Inventory", path: "/inventory" }, { label: "Product Identification", path: "/inventory/skus" }, { label: "SKU Management" }],
      "/inventory/products/media": [{ label: "Inventory", path: "/inventory" }, { label: "Product Media", path: "/inventory/products/media" }, { label: "Images & Attachments" }],
      "/inventory/products/import": [{ label: "Inventory", path: "/inventory" }, { label: "Data Management", path: "/inventory/products/import" }, { label: "Import Items" }],
      "/inventory/products/export": [{ label: "Inventory", path: "/inventory" }, { label: "Data Management", path: "/inventory/products/export" }, { label: "Export Items" }],
      "/inventory/products/import-history": [{ label: "Inventory", path: "/inventory" }, { label: "Data Management", path: "/inventory/products/import-history" }, { label: "Import History" }],
      "/inventory/categories": [{ label: "Inventory", path: "/inventory" }, { label: "Catalog", path: "/inventory/products" }, { label: "Categories" }],
      "/inventory/brands": [{ label: "Inventory", path: "/inventory" }, { label: "Catalog", path: "/inventory/products" }, { label: "Brands" }],
      "/inventory/units": [{ label: "Inventory", path: "/inventory" }, { label: "Catalog", path: "/inventory/products" }, { label: "Units of Measure" }],
      "/inventory/barcodes": [{ label: "Inventory", path: "/inventory" }, { label: "Catalog", path: "/inventory/products" }, { label: "Barcodes & Tags" }],
      "/inventory/warehouses": [{ label: "Inventory", path: "/inventory" }, { label: "Warehouse Management", path: "/inventory/warehouses" }, { label: "Warehouse Master" }],
      "/inventory/locations": [{ label: "Inventory", path: "/inventory" }, { label: "Storage Locations" }],
      "/inventory/locations/utilization": [{ label: "Inventory", path: "/inventory" }, { label: "Capacity Management", path: "/inventory/locations/utilization" }, { label: "Location Utilization" }],
      "/inventory/warehouses/configuration": [{ label: "Inventory", path: "/inventory" }, { label: "Warehouse Configuration", path: "/inventory/warehouses/configuration" }, { label: "Facility Configuration" }],
      "/inventory/goods-receipt/register": [{ label: "Inventory", path: "/inventory" }, { label: "Goods Receipt & Inspection", path: "/inventory/goods-receipt/register" }, { label: "Receipt Register" }],
      "/inventory/goods-receipt/inspection": [{ label: "Inventory", path: "/inventory" }, { label: "Goods Receipt & Inspection", path: "/inventory/goods-receipt/register" }, { label: "Receipt Inspection" }],
      "/inventory/goods-receipt/discrepancies": [{ label: "Inventory", path: "/inventory" }, { label: "Goods Receipt & Inspection", path: "/inventory/goods-receipt/register" }, { label: "Receipt Discrepancy" }],
      "/inventory/goods-receipt/partial": [{ label: "Inventory", path: "/inventory" }, { label: "Goods Receipt & Inspection", path: "/inventory/goods-receipt/register" }, { label: "Partial Acceptance" }],
      "/inventory/goods-receipt/outcomes": [{ label: "Inventory", path: "/inventory" }, { label: "Goods Receipt & Inspection", path: "/inventory/goods-receipt/outcomes" }, { label: "Accepted & Rejected Goods" }],
      "/inventory/goods-receipt/accepted": [{ label: "Inventory", path: "/inventory" }, { label: "Goods Receipt & Inspection", path: "/inventory/goods-receipt/outcomes" }, { label: "Accepted Goods" }],
      "/inventory/goods-receipt/rejected": [{ label: "Inventory", path: "/inventory" }, { label: "Goods Receipt & Inspection", path: "/inventory/goods-receipt/outcomes" }, { label: "Rejected Goods" }],
      "/inventory/goods-receipt/putaway": [{ label: "Inventory", path: "/inventory" }, { label: "Goods Receipt & Inspection", path: "/inventory/goods-receipt/register" }, { label: "Putaway Management" }],
      "/inventory/goods-receipt/history": [{ label: "Inventory", path: "/inventory" }, { label: "Goods Receipt & Inspection", path: "/inventory/goods-receipt/register" }, { label: "Receipt History" }],
      "/inventory/operations/stock-in": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-in" }, { label: "Stock In" }],
      "/inventory/operations/goods-receipt": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-in" }, { label: "Goods Receipt (GRN)" }],
      "/inventory/operations/stock-out": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-in" }, { label: "Stock Out" }],
      "/inventory/operations/stock-issue": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-in" }, { label: "Stock Issue" }],
      "/inventory/operations/transfers": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-transfer" }, { label: "Stock Transfer" }],
      "/inventory/operations/stock-transfer": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-transfer" }, { label: "Stock Transfer" }],
      "/inventory/operations/inter-warehouse-transfer": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-transfer" }, { label: "Inter-Warehouse Transfer" }],
      "/inventory/operations/adjustments": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-adjustment" }, { label: "Stock Adjustment" }],
      "/inventory/operations/stock-adjustment": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-adjustment" }, { label: "Stock Adjustment" }],
      "/inventory/operations/stock-reclassification": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-adjustment" }, { label: "Stock Reclassification" }],
      "/inventory/operations/returns": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-in" }, { label: "Stock Returns" }],
      "/inventory/operations/stock-return": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-in" }, { label: "Stock Returns" }],
      "/inventory/returns": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-in" }, { label: "Stock Returns" }],
      "/inventory/operations/reservations": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-reservation" }, { label: "Stock Reservation" }],
      "/inventory/operations/stock-reservation": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-reservation" }, { label: "Stock Reservation" }],
      "/inventory/operations/stock-release": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-reservation" }, { label: "Stock Release" }],
      "/inventory/operations/reconciliation": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-in" }, { label: "Physical Reconciliation" }],
      "/inventory/control/overview": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock Overview & Levels" }],
      "/inventory/control/balances": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock Balances" }],
      "/inventory/control/transit": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock in Transit" }],
      "/inventory/control/reorder-levels": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Reorder Level" }],
      "/inventory/control/aging": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/aging" }, { label: "Stock Aging & History" }],
      "/inventory/control/history": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/aging" }, { label: "Stock History" }],
      "/inventory/control/ledger": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/balances" }, { label: "Immutable Ledger" }],
      "/inventory/control/batches": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/balances" }, { label: "Batch Tracking" }],
      "/inventory/control/serials": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/balances" }, { label: "Serial Registry" }],
      "/inventory/planning/reorder-rules": [{ label: "Inventory", path: "/inventory" }, { label: "Planning & Replenishment", path: "/inventory/planning/reorder-rules" }, { label: "Reorder Rules" }],
      "/inventory/planning/min-max-levels": [{ label: "Inventory", path: "/inventory" }, { label: "Planning & Replenishment", path: "/inventory/planning/reorder-rules" }, { label: "Min / Max Stock Levels" }],
      "/inventory/planning/replenishment": [{ label: "Inventory", path: "/inventory" }, { label: "Planning & Replenishment", path: "/inventory/planning/reorder-rules" }, { label: "Replenishment Planning" }],
      "/inventory/planning/purchase-suggestions": [{ label: "Inventory", path: "/inventory" }, { label: "Planning & Replenishment", path: "/inventory/planning/reorder-rules" }, { label: "Purchase Suggestions" }],
      "/inventory/planning/stock-forecast": [{ label: "Inventory", path: "/inventory" }, { label: "Planning & Replenishment", path: "/inventory/planning/reorder-rules" }, { label: "Stock Forecast" }],
      "/inventory/audit/stock-count": [{ label: "Inventory", path: "/inventory" }, { label: "Physical Inventory & Audit", path: "/inventory/audit/stock-count" }, { label: "Physical Stock Count" }],
      "/inventory/audit/cycle-count": [{ label: "Inventory", path: "/inventory" }, { label: "Physical Inventory & Audit", path: "/inventory/audit/stock-count" }, { label: "Cycle Count" }],
      "/inventory/audit/full-count": [{ label: "Inventory", path: "/inventory" }, { label: "Physical Inventory & Audit", path: "/inventory/audit/stock-count" }, { label: "Full Stock Count" }],
      "/inventory/audit/variance": [{ label: "Inventory", path: "/inventory" }, { label: "Physical Inventory & Audit", path: "/inventory/audit/stock-count" }, { label: "Stock Variance" }],
      "/inventory/audit/history": [{ label: "Inventory", path: "/inventory" }, { label: "Physical Inventory & Audit", path: "/inventory/audit/stock-count" }, { label: "Audit History" }],
      "/inventory/reports": [{ label: "Inventory", path: "/inventory" }, { label: "Reports & Analytics", path: "/inventory/reports" }, { label: "Reports & Analytics Center" }],
      "/inventory/reports/stock-summary": [{ label: "Inventory", path: "/inventory" }, { label: "Reports & Analytics", path: "/inventory/reports" }, { label: "Stock Summary Report" }],
      "/inventory/reports/stock-movement": [{ label: "Inventory", path: "/inventory" }, { label: "Reports & Analytics", path: "/inventory/reports" }, { label: "Stock Movement Report" }],
      "/inventory/reports/stock-ledger": [{ label: "Inventory", path: "/inventory" }, { label: "Reports & Analytics", path: "/inventory/reports" }, { label: "Stock Ledger Report" }],
      "/inventory/reports/valuation": [{ label: "Inventory", path: "/inventory" }, { label: "Reports & Analytics", path: "/inventory/reports" }, { label: "Stock Valuation Report" }],
      "/inventory/reports/low-stock": [{ label: "Inventory", path: "/inventory" }, { label: "Reports & Analytics", path: "/inventory/reports" }, { label: "Low Stock Report" }],
      "/inventory/reports/ageing": [{ label: "Inventory", path: "/inventory" }, { label: "Reports & Analytics", path: "/inventory/reports" }, { label: "Stock Ageing Report" }],
      "/inventory/reports/expiry": [{ label: "Inventory", path: "/inventory" }, { label: "Reports & Analytics", path: "/inventory/reports" }, { label: "Expiry Report" }],
      "/inventory/reports/warehouse": [{ label: "Inventory", path: "/inventory" }, { label: "Reports & Analytics", path: "/inventory/reports" }, { label: "Warehouse Report" }],
      "/inventory/analytics/valuation": [{ label: "Inventory", path: "/inventory" }, { label: "Reports & Analytics", path: "/inventory/reports" }, { label: "Stock Valuation Report" }],
      "/inventory/analytics/reports": [{ label: "Inventory", path: "/inventory" }, { label: "Reports & Analytics", path: "/inventory/reports" }, { label: "Reports & Analytics Center" }],
      "/inventory/configuration/general": [{ label: "Inventory", path: "/inventory" }, { label: "Inventory Configuration", path: "/inventory/configuration/general" }, { label: "General Settings" }],
      "/inventory/configuration/stock": [{ label: "Inventory", path: "/inventory" }, { label: "Inventory Configuration", path: "/inventory/configuration/general" }, { label: "Stock Settings" }],
      "/inventory/configuration/tracking": [{ label: "Inventory", path: "/inventory" }, { label: "Inventory Configuration", path: "/inventory/configuration/general" }, { label: "Product Tracking Settings" }],
      "/inventory/configuration/valuation": [{ label: "Inventory", path: "/inventory" }, { label: "Inventory Configuration", path: "/inventory/configuration/general" }, { label: "Valuation Settings" }],
      "/inventory/configuration/numbering": [{ label: "Inventory", path: "/inventory" }, { label: "Inventory Configuration", path: "/inventory/configuration/general" }, { label: "Document Numbering" }],
      "/inventory/configuration/approvals": [{ label: "Inventory", path: "/inventory" }, { label: "Inventory Configuration", path: "/inventory/configuration/general" }, { label: "Approval Settings" }],
      "/inventory/notifications": [{ label: "Inventory", path: "/inventory" }, { label: "Notifications & Alerts" }],
      "/inventory/settings": [{ label: "Inventory", path: "/inventory" }, { label: "Inventory Configuration", path: "/inventory/configuration/general" }, { label: "General Settings" }],
      "/inventory/integrations": [{ label: "Inventory", path: "/inventory" }, { label: "Integration & Events", path: "/inventory/integrations/dashboard" }, { label: "Integration Dashboard" }],
      "/inventory/integrations/dashboard": [{ label: "Inventory", path: "/inventory" }, { label: "Integration & Events", path: "/inventory/integrations/dashboard" }, { label: "Integration Dashboard" }],
      "/inventory/integrations/incoming": [{ label: "Inventory", path: "/inventory" }, { label: "Integration & Events", path: "/inventory/integrations/dashboard" }, { label: "Incoming Events" }],
      "/inventory/integrations/outgoing": [{ label: "Inventory", path: "/inventory" }, { label: "Integration & Events", path: "/inventory/integrations/dashboard" }, { label: "Outgoing Events" }],
      "/inventory/integrations/failed": [{ label: "Inventory", path: "/inventory" }, { label: "Integration & Events", path: "/inventory/integrations/dashboard" }, { label: "Failed Events" }],
      "/inventory/integrations/history": [{ label: "Inventory", path: "/inventory" }, { label: "Integration & Events", path: "/inventory/integrations/dashboard" }, { label: "Event History" }],
      "/inventory/integrations/settings": [{ label: "Inventory", path: "/inventory" }, { label: "Integration & Events", path: "/inventory/integrations/dashboard" }, { label: "Integration Settings" }],
      "/security/users": [{ label: "Security & Audit", path: "/security/users" }, { label: "User Access Management" }],
      "/security/roles": [{ label: "Security & Audit", path: "/security/roles" }, { label: "Role Management" }],
      "/security/permissions": [{ label: "Security & Audit", path: "/security/permissions" }, { label: "Permission Management" }],
      "/security/warehouse-access": [{ label: "Security & Audit", path: "/security/warehouse-access" }, { label: "Warehouse-level Permissions" }],
      "/security/actions": [{ label: "Security & Audit", path: "/security/actions" }, { label: "Action-level Permissions" }],
      "/security/activity-logs": [{ label: "Security & Audit", path: "/security/activity-logs" }, { label: "Activity Logs" }],
      "/security/document-audit": [{ label: "Security & Audit", path: "/security/document-audit" }, { label: "Document Audit Trail" }],
      "/security/data-history": [{ label: "Security & Audit", path: "/security/data-history" }, { label: "Data Change History" }],
    };
    return map[pathname] || [{ label: "Inventory", path: "/inventory" }, { label: "Module View" }];
  };

  return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navGroups = [
    {
      title: "Overview",
      items: [{ label: "Dashboard", path: "/inventory", icon: LayoutDashboard }],
    },
    {
      key: "product_management",
      title: "Product Management",
      items: [
        { label: "Product Overview", path: "/inventory/products/overview", icon: LayoutDashboard },
        { label: "Item Master", path: "/inventory/products", icon: Package },
        { label: "Product Classification", path: "/inventory/classification", icon: Layers },
        { label: "SKU Management", path: "/inventory/skus", icon: Hash },
        { label: "Barcode & QR Management", path: "/inventory/barcodes", icon: Barcode },
      ],
    },
    {
      key: "warehouse_management",
      title: "Warehouse Management",
      items: [
        { label: "Warehouse Master", path: "/inventory/warehouses", icon: Warehouse },
        { label: "Storage Locations", path: "/inventory/locations", icon: MapPin },
        { label: "Zone & Rack & Bin Management", path: "/inventory/racks-bins?tab=zones", icon: Layers },
        { label: "Location Utilization", path: "/inventory/locations/utilization", icon: TrendingUp },
        { label: "Warehouse Configuration", path: "/inventory/warehouses/configuration", icon: Settings },
      ],
    },
    {
      key: "goods_receipt",
      title: "Goods Receipt & Inspection",
      items: [
        { label: "Receipt Register", path: "/inventory/goods-receipt/register", icon: ClipboardList },
        { label: "Accepted & Rejected Goods", path: "/inventory/goods-receipt/outcomes", icon: PackageCheck },
        { label: "Putaway Management", path: "/inventory/goods-receipt/putaway", icon: Layers3 },
        { label: "Receipt History", path: "/inventory/goods-receipt/history", icon: History },
      ],
    },
    {
      key: "operations",
      title: "Stock Operations",
      items: [
        { label: "Stock In", path: "/inventory/operations/stock-in", icon: ArrowDownLeft },
        { label: "Stock Transfer", path: "/inventory/operations/stock-transfer", icon: ArrowLeftRight },
        { label: "Stock Adjustment", path: "/inventory/operations/stock-adjustment", icon: SlidersHorizontal },
        { label: "Opening Stock", path: "/inventory/operations/opening-stock", icon: FileSpreadsheet },
        { label: "Stock Reservation", path: "/inventory/operations/stock-reservation", icon: BookmarkCheck },
      ],
    },
    {
      key: "control",
      title: "Stock Control",
      items: [
        { label: "Stock Overview & Levels", path: "/inventory/control/overview", icon: Boxes },
        { label: "Stock Aging & History", path: "/inventory/control/aging", icon: Clock },
        { label: "Stock Ledger", path: "/inventory/control/ledger", icon: FileSpreadsheet },
        { label: "Stock Reconciliation", path: "/inventory/control/reconciliation", icon: Scale },
      ],
    },
    {
      key: "tracking",
      title: "Batch, Lot & Serial Tracking",
      items: [
        { label: "Batch & Lot Management", path: "/inventory/tracking/batches", icon: Layers },
        { label: "Serial Number Management", path: "/inventory/tracking/serials", icon: Cpu },
        { label: "Date & Shelf Life", path: "/inventory/tracking/expiry", icon: Calendar },
        { label: "Stock Allocation", path: "/inventory/tracking/allocation", icon: SlidersHorizontal },
        { label: "Traceability & Recall", path: "/inventory/tracking/traceability", icon: Activity },
      ],
    },
    {
      key: "planning",
      title: "Planning & Replenishment",
      items: [
        { label: "Reorder Rules", path: "/inventory/planning/reorder-rules", icon: SlidersHorizontal },
        { label: "Min / Max Stock Levels", path: "/inventory/planning/min-max-levels", icon: Layers },
        { label: "Replenishment Planning", path: "/inventory/planning/replenishment", icon: TrendingUp },
        { label: "Purchase Suggestions", path: "/inventory/planning/purchase-suggestions", icon: ShoppingCart },
        { label: "Stock Forecast", path: "/inventory/planning/stock-forecast", icon: BarChart3 },
      ],
    },
    {
      key: "audit",
      title: "Physical Inventory & Audit",
      items: [
        { label: "Physical Stock Count", path: "/inventory/audit/stock-count", icon: ClipboardCheck },
        { label: "Cycle Count", path: "/inventory/audit/cycle-count", icon: RefreshCw },
        { label: "Full Stock Count", path: "/inventory/audit/full-count", icon: Boxes },
        { label: "Stock Variance", path: "/inventory/audit/variance", icon: Scale },
        { label: "Audit History", path: "/inventory/audit/history", icon: History },
      ],
    },
    {
      key: "analytics",
      title: "Reports & Analytics",
      items: [
        { label: "Reports & Analytics", path: "/inventory/reports", icon: BarChart3 },
      ],
    },
    {
      key: "configuration",
      title: "Inventory Configuration",
      items: [
        { label: "General Settings", path: "/inventory/configuration/general", icon: Settings },
        { label: "Stock Settings", path: "/inventory/configuration/stock", icon: Boxes },
        { label: "Product Tracking Settings", path: "/inventory/configuration/tracking", icon: Cpu },
        { label: "Valuation Settings", path: "/inventory/configuration/valuation", icon: DollarSign },
        { label: "Document Numbering", path: "/inventory/configuration/numbering", icon: Hash },
        { label: "Approval Settings", path: "/inventory/configuration/approvals", icon: ShieldCheck },
        { label: "Goods Receipt & Inspection", path: "/inventory/configuration/goods-receipt", icon: ClipboardCheck },
      ],
    },
    {
      key: "integrations",
      title: "Integration & Events",
      items: [
        { label: "Integration Dashboard", path: "/inventory/integrations/dashboard", icon: LayoutDashboard },
        { label: "Incoming Events", path: "/inventory/integrations/incoming", icon: ArrowDownLeft },
        { label: "Outgoing Events", path: "/inventory/integrations/outgoing", icon: ArrowUpRight },
        { label: "Failed Events", path: "/inventory/integrations/failed", icon: ShieldAlert },
        { label: "Event History", path: "/inventory/integrations/history", icon: History },
        { label: "Integration Settings", path: "/inventory/integrations/settings", icon: Settings },
      ],
    },
    {
      key: "security_audit",
      title: "Security & Audit",
      items: [
        { label: "User Access", path: "/security/users", icon: Users },
        { label: "Role Management", path: "/security/roles", icon: KeyRound },
        { label: "Permission Management", path: "/security/permissions", icon: ShieldAlert },
        { label: "Warehouse-level Permissions", path: "/security/warehouse-access", icon: Warehouse },
        { label: "Action-level Permissions", path: "/security/actions", icon: Shield },
        { label: "Activity Logs", path: "/security/activity-logs", icon: Activity },
        { label: "Document Audit Trail", path: "/security/document-audit", icon: FileText },
        { label: "Data Change History", path: "/security/data-history", icon: FileDiff },
      ],
    },
  ];

  const getBreadcrumbs = (pathname) => {
    const map = {
      "/inventory": [{ label: "Inventory", path: "/inventory" }, { label: "Executive Dashboard" }],
      "/inventory/products": [{ label: "Inventory", path: "/inventory" }, { label: "Catalog", path: "/inventory/products" }, { label: "Products" }],
      "/inventory/categories": [{ label: "Inventory", path: "/inventory" }, { label: "Catalog", path: "/inventory/products" }, { label: "Categories" }],
      "/inventory/brands": [{ label: "Inventory", path: "/inventory" }, { label: "Catalog", path: "/inventory/products" }, { label: "Brands" }],
      "/inventory/units": [{ label: "Inventory", path: "/inventory" }, { label: "Catalog", path: "/inventory/products" }, { label: "Units of Measure" }],
      "/inventory/barcodes": [{ label: "Inventory", path: "/inventory" }, { label: "Catalog", path: "/inventory/products" }, { label: "Barcodes & Tags" }],
      "/inventory/warehouses": [{ label: "Inventory", path: "/inventory" }, { label: "Warehouse Management", path: "/inventory/warehouses" }, { label: "Warehouse Master" }],
      "/inventory/locations": [{ label: "Inventory", path: "/inventory" }, { label: "Storage Locations" }],
      "/inventory/racks-bins": [{ label: "Inventory", path: "/inventory" }, { label: "Zone & Rack & Bin Management" }],
      "/inventory/locations/utilization": [{ label: "Inventory", path: "/inventory" }, { label: "Capacity Management", path: "/inventory/locations/utilization" }, { label: "Location Utilization" }],
      "/inventory/warehouses/configuration": [{ label: "Inventory", path: "/inventory" }, { label: "Warehouse Configuration", path: "/inventory/warehouses/configuration" }, { label: "Facility Configuration" }],
      "/inventory/operations/stock-in": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-in" }, { label: "Goods Receipt" }],
      "/inventory/operations/stock-out": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/stock-out" }, { label: "Stock Issue" }],
      "/inventory/operations/transfers": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/transfers" }, { label: "Stock Transfer" }],
      "/inventory/operations/adjustments": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/adjustments" }, { label: "Stock Adjustment" }],
      "/inventory/operations/returns": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/returns" }, { label: "Stock Return" }],
      "/inventory/returns": [{ label: "Inventory", path: "/inventory" }, { label: "Operations", path: "/inventory/operations/returns" }, { label: "Stock Return" }],
      "/inventory/operations/reservations": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/reservations" }, { label: "Stock Reservation" }],
      "/inventory/operations/reconciliation": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/reconciliation" }, { label: "Stock Reconciliation" }],
      "/inventory/control/overview": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock Overview & Levels" }],
      "/inventory/control/balances": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock Overview & Levels" }],
      "/inventory/control/transit": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock in Transit" }],
      "/inventory/control/reorder-levels": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Reorder Level" }],
      "/inventory/control/aging": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock Aging" }],
      "/inventory/control/ledger": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock Ledger" }],
      "/inventory/control/history": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock History" }],
      "/inventory/control/reconciliation": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock Reconciliation" }],
      "/inventory/control/stock-in-history": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock History" }],
      "/inventory/control/stock-out-history": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock History" }],
      "/inventory/control/reservations": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Stock Reservation" }],
      "/inventory/control/damaged": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Damaged Stock" }],
      "/inventory/control/batches": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Batch Tracking" }],
      "/inventory/control/serials": [{ label: "Inventory", path: "/inventory" }, { label: "Stock Control", path: "/inventory/control/overview" }, { label: "Serial Registry" }],
      "/inventory/tracking/batches": [{ label: "Inventory", path: "/inventory" }, { label: "Batch, Lot & Serial Tracking", path: "/inventory/tracking/batches" }, { label: "Batch & Lot Management" }],
      "/inventory/tracking/serials": [{ label: "Inventory", path: "/inventory" }, { label: "Batch, Lot & Serial Tracking", path: "/inventory/tracking/serials" }, { label: "Serial Number Management" }],
      "/inventory/tracking/expiry": [{ label: "Inventory", path: "/inventory" }, { label: "Batch, Lot & Serial Tracking", path: "/inventory/tracking/expiry" }, { label: "Date & Shelf Life" }],
      "/inventory/tracking/allocation": [{ label: "Inventory", path: "/inventory" }, { label: "Batch, Lot & Serial Tracking", path: "/inventory/tracking/allocation" }, { label: "Stock Allocation" }],
      "/inventory/tracking/traceability": [{ label: "Inventory", path: "/inventory" }, { label: "Batch, Lot & Serial Tracking", path: "/inventory/tracking/traceability" }, { label: "Traceability & Recall" }],
      "/inventory/tracking/batch-movements": [{ label: "Inventory", path: "/inventory" }, { label: "Batch, Lot & Serial Tracking", path: "/inventory/tracking/batches" }, { label: "Batch & Lot Management" }],
      "/inventory/tracking/batch-quarantine": [{ label: "Inventory", path: "/inventory" }, { label: "Batch, Lot & Serial Tracking", path: "/inventory/tracking/batches" }, { label: "Batch & Lot Management" }],
      "/inventory/tracking/batch-release": [{ label: "Inventory", path: "/inventory" }, { label: "Batch, Lot & Serial Tracking", path: "/inventory/tracking/batches" }, { label: "Batch & Lot Management" }],
      "/inventory/tracking/serial-movements": [{ label: "Inventory", path: "/inventory" }, { label: "Batch, Lot & Serial Tracking", path: "/inventory/tracking/serials" }, { label: "Serial Number Management" }],
      "/inventory/planning/reorder-rules": [{ label: "Inventory", path: "/inventory" }, { label: "Planning & Replenishment", path: "/inventory/planning/reorder-rules" }, { label: "Reorder Rules" }],
      "/inventory/planning/min-max-levels": [{ label: "Inventory", path: "/inventory" }, { label: "Planning & Replenishment", path: "/inventory/planning/reorder-rules" }, { label: "Min / Max Stock Levels" }],
      "/inventory/planning/replenishment": [{ label: "Inventory", path: "/inventory" }, { label: "Planning & Replenishment", path: "/inventory/planning/reorder-rules" }, { label: "Replenishment Planning" }],
      "/inventory/planning/purchase-suggestions": [{ label: "Inventory", path: "/inventory" }, { label: "Planning & Replenishment", path: "/inventory/planning/reorder-rules" }, { label: "Purchase Suggestions" }],
      "/inventory/planning/stock-forecast": [{ label: "Inventory", path: "/inventory" }, { label: "Planning & Replenishment", path: "/inventory/planning/reorder-rules" }, { label: "Stock Forecast" }],
      "/inventory/audit/stock-count": [{ label: "Inventory", path: "/inventory" }, { label: "Physical Inventory & Audit", path: "/inventory/audit/stock-count" }, { label: "Physical Stock Count" }],
      "/inventory/audit/cycle-count": [{ label: "Inventory", path: "/inventory" }, { label: "Physical Inventory & Audit", path: "/inventory/audit/stock-count" }, { label: "Cycle Count" }],
      "/inventory/audit/full-count": [{ label: "Inventory", path: "/inventory" }, { label: "Physical Inventory & Audit", path: "/inventory/audit/stock-count" }, { label: "Full Stock Count" }],
      "/inventory/audit/variance": [{ label: "Inventory", path: "/inventory" }, { label: "Physical Inventory & Audit", path: "/inventory/audit/stock-count" }, { label: "Stock Variance" }],
      "/inventory/audit/history": [{ label: "Inventory", path: "/inventory" }, { label: "Physical Inventory & Audit", path: "/inventory/audit/stock-count" }, { label: "Audit History" }],
      "/inventory/analytics/valuation": [{ label: "Inventory", path: "/inventory" }, { label: "Analytics", path: "/inventory/analytics/reports" }, { label: "Valuation Reports" }],
      "/inventory/analytics/reports": [{ label: "Inventory", path: "/inventory" }, { label: "Analytics", path: "/inventory/analytics/reports" }, { label: "Analytics Reports" }],
      "/inventory/settings": [{ label: "Inventory", path: "/inventory" }, { label: "Configuration" }, { label: "Inventory Settings" }],
    };
    if (pathname === "/inventory/products" || pathname.startsWith("/inventory/products/variants") || pathname.startsWith("/inventory/products/data-management")) {
      const search = location.search;
      if (search.includes("tab=variants") || pathname.includes("/variants")) {
        return [{ label: "Inventory", path: "/inventory" }, { label: "Item Master", path: "/inventory/products" }, { label: "Product Variants" }];
      }
      if (
        search.includes("tab=data-management") ||
        search.includes("tab=attachments") ||
        search.includes("tab=import") ||
        search.includes("tab=export") ||
        search.includes("tab=history") ||
        pathname.includes("/data-management") ||
        pathname.includes("/media")
      ) {
        return [{ label: "Inventory", path: "/inventory" }, { label: "Item Master", path: "/inventory/products" }, { label: "Item Data Management" }];
      }
      return [{ label: "Inventory", path: "/inventory" }, { label: "Catalog", path: "/inventory/products" }, { label: "Item Master" }];
    }
    if (
      pathname === "/inventory/classification" ||
      pathname.startsWith("/inventory/categories") ||
      pathname.startsWith("/inventory/brands") ||
      pathname.startsWith("/inventory/units") ||
      pathname.startsWith("/inventory/attributes")
    ) {
      const search = location.search;
      if (search.includes("tab=brands") || pathname.includes("/brands")) {
        return [{ label: "Inventory", path: "/inventory" }, { label: "Product Classification", path: "/inventory/classification" }, { label: "Brands" }];
      }
      if (search.includes("tab=units") || pathname.includes("/units")) {
        return [{ label: "Inventory", path: "/inventory" }, { label: "Product Classification", path: "/inventory/classification" }, { label: "Units of Measurement" }];
      }
      if (search.includes("tab=attributes") || pathname.includes("/attributes")) {
        return [{ label: "Inventory", path: "/inventory" }, { label: "Product Classification", path: "/inventory/classification" }, { label: "Product Attributes" }];
      }
      return [{ label: "Inventory", path: "/inventory" }, { label: "Product Classification", path: "/inventory/classification" }, { label: "Categories" }];
    }
    if (pathname.startsWith("/inventory/goods-receipt")) {
      const grnRoot = [{ label: "Inventory", path: "/inventory" }, { label: "Goods Receipt & Inspection", path: "/inventory/goods-receipt/register" }];
      const leaf = navGroups.find((g) => g.key === "goods_receipt").items.find((i) => pathname === i.path);
      if (leaf) return [...grnRoot, { label: leaf.label }];
      if (pathname.startsWith("/inventory/goods-receipt/receipts/")) {
        return [...grnRoot, { label: pathname.endsWith("/edit") ? "Edit Receipt" : "Receipt Detail" }];
      }
      return grnRoot;
    }
    if (pathname === "/inventory/configuration/goods-receipt") {
      return [{ label: "Inventory", path: "/inventory" }, { label: "Inventory Configuration", path: "/inventory/configuration/general" }, { label: "Goods Receipt & Inspection" }];
    }
    return map[pathname] || [{ label: "Inventory", path: "/inventory" }, { label: "Module View" }];
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans antialiased">
      {/* Sidebar Desktop */}
      <aside
        className={`hidden md:flex flex-col border-r border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 transition-all duration-200 z-30 select-none shadow-xs ${
          collapsed ? "w-18" : "w-64"
        }`}
      >
        {/* Brand / Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50">
          <Link
            to="/inventory"
            className="flex items-center gap-3 overflow-hidden group cursor-pointer"
            title="Go to Inventory Dashboard"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white font-bold shadow-md shadow-blue-500/20 ring-1 ring-white/20 group-hover:scale-105 transition-transform">
              <Boxes className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Business Ecosystem
                </span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate">
                  Inventory Management
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Group Items */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {navGroups.map((group, gIdx) => {
            const hasKey = !!group.key;
            const isOpen = hasKey ? openGroups[group.key] : true;

            return (
              <div key={gIdx} className="space-y-1">
                {!collapsed && (
                  <div
                    onClick={() => hasKey && toggleGroup(group.key)}
                    className={`flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 ${
                      hasKey ? "cursor-pointer hover:text-slate-600 dark:hover:text-zinc-300 transition-colors" : ""
                    }`}
                  >
                    <span>{group.title}</span>
                    {hasKey && (
                      <span className="text-slate-400">
                        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </span>
                    )}
                  </div>
                )}

                {(isOpen || collapsed) && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isItemMaster = item.path === "/inventory/products";
                      const isItemMasterActive =
                        isItemMaster &&
                        (location.pathname === "/inventory/products" ||
                          location.pathname.startsWith("/inventory/products/variants") ||
                          location.pathname.startsWith("/inventory/products/data-management") ||
                          location.pathname.startsWith("/inventory/products/media"));

                      const isClassification = item.path === "/inventory/classification";
                      const isClassificationActive =
                        isClassification &&
                        (location.pathname === "/inventory/classification" ||
                          location.pathname.startsWith("/inventory/categories") ||
                          location.pathname.startsWith("/inventory/brands") ||
                          location.pathname.startsWith("/inventory/units") ||
                          location.pathname.startsWith("/inventory/attributes"));

                      const isGrnOperations = item.path === "/inventory/goods-receipt/register";
                      const isGrnOperationsActive =
                        isGrnOperations &&
                        (location.pathname === "/inventory/goods-receipt/register" ||
                          location.pathname.startsWith("/inventory/goods-receipt/inspection") ||
                          location.pathname.startsWith("/inventory/goods-receipt/discrepancies") ||
                          location.pathname.startsWith("/inventory/goods-receipt/partial"));

                      const isOutcomesOperations = item.path === "/inventory/goods-receipt/outcomes";
                      const isOutcomesOperationsActive =
                        isOutcomesOperations &&
                        (location.pathname === "/inventory/goods-receipt/outcomes" ||
                          location.pathname.startsWith("/inventory/goods-receipt/accepted") ||
                          location.pathname.startsWith("/inventory/goods-receipt/rejected"));

                      const isStockOperations = item.path === "/inventory/operations/stock-in";
                      const isStockOperationsActive =
                        isStockOperations &&
                        (location.pathname === "/inventory/operations/stock-in" ||
                          location.pathname.startsWith("/inventory/operations/stock-issue") ||
                          location.pathname.startsWith("/inventory/operations/stock-out") ||
                          location.pathname.startsWith("/inventory/operations/stock-return") ||
                          location.pathname.startsWith("/inventory/operations/returns") ||
                          location.pathname === "/inventory/returns" ||
                          location.pathname === "/stock-in" ||
                          location.pathname === "/stock-issue" ||
                          location.pathname === "/stock-out" ||
                          location.pathname === "/stock-return");

                      const isTransferOperations = item.path === "/inventory/operations/stock-transfer";
                      const isTransferOperationsActive =
                        isTransferOperations &&
                        (location.pathname === "/inventory/operations/stock-transfer" ||
                          location.pathname === "/inventory/operations/transfers" ||
                          location.pathname.startsWith("/inventory/operations/inter-warehouse-transfer") ||
                          location.pathname.startsWith("/inventory/operations/inter-location-transfer") ||
                          location.pathname === "/inventory/transfers" ||
                          location.pathname.startsWith("/inventory/transfers/inter-warehouse") ||
                          location.pathname.startsWith("/inventory/transfers/same-city") ||
                          location.pathname.startsWith("/inventory/transfers/inter-city") ||
                          location.pathname === "/stock-transfer" ||
                          location.pathname === "/transfers" ||
                          location.pathname === "/inter-warehouse-transfer" ||
                          location.pathname === "/inter-location-transfer");

                      const isAdjustmentOperations = item.path === "/inventory/operations/stock-adjustment";
                      const isAdjustmentOperationsActive =
                        isAdjustmentOperations &&
                        (location.pathname === "/inventory/operations/stock-adjustment" ||
                          location.pathname === "/inventory/operations/adjustments" ||
                          location.pathname.startsWith("/inventory/operations/stock-reclassification") ||
                          location.pathname === "/stock-adjustment" ||
                          location.pathname === "/adjustments" ||
                          location.pathname === "/stock-reclassification");

                      const isReservationOperations = item.path === "/inventory/operations/stock-reservation";
                      const isReservationOperationsActive =
                        isReservationOperations &&
                        (location.pathname === "/inventory/operations/stock-reservation" ||
                          location.pathname === "/inventory/operations/reservations" ||
                          location.pathname.startsWith("/inventory/operations/stock-release") ||
                          location.pathname === "/stock-reservation" ||
                          location.pathname === "/stock-release");

                      const isControlOverview = item.path === "/inventory/control/overview";
                      const isControlOverviewActive =
                        isControlOverview &&
                        (location.pathname === "/inventory/control/overview" ||
                          location.pathname === "/inventory/control/balances" ||
                          location.pathname.startsWith("/inventory/control/transit") ||
                          location.pathname.startsWith("/inventory/control/reorder-levels") ||
                          location.pathname === "/overview" ||
                          location.pathname === "/balances" ||
                          location.pathname === "/transit" ||
                          location.pathname === "/reorder-levels");

                      const isAgingHistory = item.path === "/inventory/control/aging";
                      const isAgingHistoryActive =
                        isAgingHistory &&
                        (location.pathname === "/inventory/control/aging" ||
                          location.pathname === "/inventory/control/history" ||
                          location.pathname === "/inventory/control/stock-in-history" ||
                          location.pathname === "/inventory/control/stock-out-history" ||
                          location.pathname === "/stock-aging" ||
                          location.pathname === "/stock-history" ||
                          location.pathname === "/aging" ||
                          location.pathname === "/history");

                      const isAnalyticsReports = item.path === "/inventory/reports";
                      const isAnalyticsReportsActive =
                        isAnalyticsReports &&
                        (location.pathname === "/inventory/reports" ||
                          location.pathname.startsWith("/inventory/reports/") ||
                          location.pathname.startsWith("/inventory/analytics/") ||
                          location.pathname === "/reports" ||
                          location.pathname.startsWith("/reports/"));

                      const isActive =
                        location.pathname === item.path ||
                        (item.path.includes("?") && location.pathname === item.path.split("?")[0]) ||
                        isItemMasterActive ||
                        isClassificationActive ||
                        isGrnOperationsActive ||
                        isOutcomesOperationsActive ||
                        isStockOperationsActive ||
                        isTransferOperationsActive ||
                        isAdjustmentOperationsActive ||
                        isReservationOperationsActive ||
                        isControlOverviewActive ||
                        isAgingHistoryActive ||
                        isAnalyticsReportsActive;
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          title={collapsed ? item.label : undefined}
                          className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 font-semibold shadow-2xs"
                              : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-zinc-200"
                          } ${collapsed ? "justify-center px-0" : ""}`}
                        >
                          {isActive && !collapsed && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-blue-600 dark:bg-blue-400" />
                          )}
                          <Icon
                            className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-105 ${
                              isActive
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300"
                            }`}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer / User Scope & Environment status */}
        <div className="p-3 border-t border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-900/70 space-y-2.5">
          {!collapsed && (
            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 font-medium px-1">
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${isApiLive ? "bg-emerald-500 animate-pulse" : "bg-blue-500"}`} />
                {isApiLive ? "LIVE ENGINE SYNC" : "PRE-SEEDED DEMO"}
              </span>
              <span className="font-mono text-[9px] bg-slate-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-zinc-400 font-bold">
                PROD-READY
              </span>
            </div>
          )}

          <Link
            to="/inventory/settings"
            title="System & Account Settings"
            className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer group"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-xs group-hover:scale-105 transition-transform">
              AD
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Operations Admin
                </span>
                <span className="truncate text-[10px] text-slate-500 dark:text-zinc-400">
                  Universal Modules Host
                </span>
              </div>
            )}
          </Link>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
            aria-label="Inventory navigation"
          >
            <div className="flex h-15 items-center justify-between border-b border-slate-200 px-4 dark:border-zinc-800">
              <Link
                to="/inventory"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 cursor-pointer group"
                title="Go to Inventory Dashboard"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow-sm group-hover:scale-105 transition-transform">
                  <Boxes className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Business Ecosystem
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                    Inventory Management v3.1
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
              {navGroups.map((group) => {
                const hasKey = !!group.key;
                const isOpen = hasKey ? openGroups[group.key] : true;

                return (
                  <div key={group.title} className="space-y-1">
                    {hasKey ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        className="flex w-full items-center justify-between px-2.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                        aria-expanded={isOpen}
                      >
                        <span>{group.title}</span>
                        {isOpen ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </button>
                    ) : (
                      <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {group.title}
                      </div>
                    )}
                    {isOpen && (
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const isItemMaster = item.path === "/inventory/products";
                          const isItemMasterActive =
                            isItemMaster &&
                            (location.pathname === "/inventory/products" ||
                              location.pathname.startsWith("/inventory/products/variants") ||
                              location.pathname.startsWith("/inventory/products/data-management") ||
                              location.pathname.startsWith("/inventory/products/media"));

                          const isClassification = item.path === "/inventory/classification";
                          const isClassificationActive =
                            isClassification &&
                            (location.pathname === "/inventory/classification" ||
                              location.pathname.startsWith("/inventory/categories") ||
                              location.pathname.startsWith("/inventory/brands") ||
                              location.pathname.startsWith("/inventory/units") ||
                              location.pathname.startsWith("/inventory/attributes"));

                          const isGrnOperations = item.path === "/inventory/goods-receipt/register";
                          const isGrnOperationsActive =
                            isGrnOperations &&
                            (location.pathname === "/inventory/goods-receipt/register" ||
                              location.pathname.startsWith("/inventory/goods-receipt/inspection") ||
                              location.pathname.startsWith("/inventory/goods-receipt/discrepancies") ||
                              location.pathname.startsWith("/inventory/goods-receipt/partial"));

                          const isOutcomesOperations = item.path === "/inventory/goods-receipt/outcomes";
                          const isOutcomesOperationsActive =
                            isOutcomesOperations &&
                            (location.pathname === "/inventory/goods-receipt/outcomes" ||
                              location.pathname.startsWith("/inventory/goods-receipt/accepted") ||
                              location.pathname.startsWith("/inventory/goods-receipt/rejected"));

                          const isStockOperations = item.path === "/inventory/operations/stock-in";
                          const isStockOperationsActive =
                            isStockOperations &&
                            (location.pathname === "/inventory/operations/stock-in" ||
                              location.pathname.startsWith("/inventory/operations/stock-issue") ||
                              location.pathname.startsWith("/inventory/operations/stock-out") ||
                              location.pathname.startsWith("/inventory/operations/stock-return") ||
                              location.pathname.startsWith("/inventory/operations/returns") ||
                              location.pathname === "/inventory/returns" ||
                              location.pathname === "/stock-in" ||
                              location.pathname === "/stock-issue" ||
                              location.pathname === "/stock-out" ||
                              location.pathname === "/stock-return");

                          const isTransferOperations = item.path === "/inventory/operations/stock-transfer";
                          const isTransferOperationsActive =
                            isTransferOperations &&
                            (location.pathname === "/inventory/operations/stock-transfer" ||
                              location.pathname === "/inventory/operations/transfers" ||
                              location.pathname.startsWith("/inventory/operations/inter-warehouse-transfer") ||
                              location.pathname.startsWith("/inventory/operations/inter-location-transfer") ||
                              location.pathname === "/inventory/transfers" ||
                              location.pathname.startsWith("/inventory/transfers/inter-warehouse") ||
                              location.pathname.startsWith("/inventory/transfers/same-city") ||
                              location.pathname.startsWith("/inventory/transfers/inter-city") ||
                              location.pathname === "/stock-transfer" ||
                              location.pathname === "/transfers" ||
                              location.pathname === "/inter-warehouse-transfer" ||
                              location.pathname === "/inter-location-transfer");

                          const isAdjustmentOperations = item.path === "/inventory/operations/stock-adjustment";
                          const isAdjustmentOperationsActive =
                            isAdjustmentOperations &&
                            (location.pathname === "/inventory/operations/stock-adjustment" ||
                              location.pathname === "/inventory/operations/adjustments" ||
                              location.pathname.startsWith("/inventory/operations/stock-reclassification") ||
                              location.pathname === "/stock-adjustment" ||
                              location.pathname === "/adjustments" ||
                              location.pathname === "/stock-reclassification");

                          const isReservationOperations = item.path === "/inventory/operations/stock-reservation";
                          const isReservationOperationsActive =
                            isReservationOperations &&
                            (location.pathname === "/inventory/operations/stock-reservation" ||
                              location.pathname === "/inventory/operations/reservations" ||
                              location.pathname.startsWith("/inventory/operations/stock-release") ||
                              location.pathname === "/stock-reservation" ||
                              location.pathname === "/stock-release");

                          const isControlOverview = item.path === "/inventory/control/overview";
                          const isControlOverviewActive =
                            isControlOverview &&
                            (location.pathname === "/inventory/control/overview" ||
                              location.pathname === "/inventory/control/balances" ||
                              location.pathname.startsWith("/inventory/control/transit") ||
                              location.pathname.startsWith("/inventory/control/reorder-levels") ||
                              location.pathname === "/overview" ||
                              location.pathname === "/balances" ||
                              location.pathname === "/transit" ||
                              location.pathname === "/reorder-levels");

                          const isAgingHistory = item.path === "/inventory/control/aging";
                          const isAgingHistoryActive =
                            isAgingHistory &&
                            (location.pathname === "/inventory/control/aging" ||
                              location.pathname === "/inventory/control/history" ||
                              location.pathname === "/inventory/control/stock-in-history" ||
                              location.pathname === "/inventory/control/stock-out-history" ||
                              location.pathname === "/stock-aging" ||
                              location.pathname === "/stock-history" ||
                              location.pathname === "/aging" ||
                              location.pathname === "/history");

                          const isAnalyticsReports = item.path === "/inventory/reports";
                          const isAnalyticsReportsActive =
                            isAnalyticsReports &&
                            (location.pathname === "/inventory/reports" ||
                              location.pathname.startsWith("/inventory/reports/") ||
                              location.pathname.startsWith("/inventory/analytics/") ||
                              location.pathname === "/reports" ||
                              location.pathname.startsWith("/reports/"));

                          const isActive =
                            location.pathname === item.path ||
                            (item.path.includes("?") && location.pathname === item.path.split("?")[0]) ||
                            isItemMasterActive ||
                            isClassificationActive ||
                            isGrnOperationsActive ||
                            isOutcomesOperationsActive ||
                            isStockOperationsActive ||
                            isTransferOperationsActive ||
                            isAdjustmentOperationsActive ||
                            isReservationOperationsActive ||
                            isControlOverviewActive ||
                            isAgingHistoryActive ||
                            isAnalyticsReportsActive;
                          const Icon = item.icon;

                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onClick={() => setMobileOpen(false)}
                              className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                                isActive
                                  ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
                              }`}
                            >
                              <Icon
                                className={`h-4 w-4 shrink-0 ${
                                  isActive
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-slate-500 dark:text-zinc-400"
                                }`}
                              />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation */}
        <header className="h-15 flex items-center justify-between px-4 lg:px-6 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 rounded-md text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Context Selector: Facility / Warehouse & Live API Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs">
              <Warehouse className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-slate-500 dark:text-zinc-400">Warehouse:</span>
              <select
                value={activeFacility.id}
                onChange={(e) => {
                  const sel = facilities.find((f) => f.id === e.target.value);
                  if (sel) setActiveFacility(sel);
                }}
                className="bg-transparent font-medium text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
              >
                {facilities.map((fac) => (
                  <option key={fac.id} value={fac.id} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">
                    {fac.name} ({fac.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Connectivity status indicator */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                isApiLive
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                  : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isApiLive ? "bg-emerald-500 animate-pulse" : "bg-blue-500"
                }`}
              />
              <span>{isApiLive ? "Live Engine Sync" : "Pre-Seeded Demo Mode"}</span>
            </div>
          </div>

          {/* Actions & Utilities */}
          <div className="flex items-center gap-2">
            {/* Global Search / Command Bar trigger */}
            <div
              onClick={() => setIsCommandOpen(true)}
              className="relative hidden sm:flex items-center cursor-pointer select-none"
            >
              <Search className="absolute left-3 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
              <div className="w-60 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 flex items-center justify-between">
                <span>Quick search (Ctrl+K)...</span>
                <kbd className="px-1.5 py-0.2 text-[9px] font-mono bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded">
                  ⌘K
                </kbd>
              </div>
            </div>

            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  refreshNotifications();
                  setIsNotificationsOpen((prev) => !prev);
                }}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 relative cursor-pointer"
                title="Notifications"
                aria-label="Toggle notifications menu"
              >
                <Bell className="h-4 w-4" />
                {notifications.some((n) => n.unread) && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-zinc-900" />
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsNotificationsOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-50 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/40">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">System Notifications</span>
                        {notifications.filter((n) => n.unread).length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                            {notifications.filter((n) => n.unread).length} new
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {notifications.length > 0 && (
                          <button
                            onClick={markAllNotificationsRead}
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          onClick={() => setIsNotificationsOpen(false)}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-400">
                          <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500 opacity-60" />
                          <span>All caught up! No notifications.</span>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (n.path) {
                                navigate(n.path);
                                setIsNotificationsOpen(false);
                              }
                              markNotificationRead(n.id);
                            }}
                            className={`p-3 flex items-start gap-3 hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                              n.unread ? "bg-blue-50/30 dark:bg-blue-950/20" : ""
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {n.type === "warning" && (
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              )}
                              {n.type === "success" && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              )}
                              {n.type === "info" && (
                                <Package className="h-4 w-4 text-blue-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold text-slate-900 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400">
                                  {n.title}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-0.5">
                                {n.description}
                              </p>
                              {n.path && (
                                <span className="inline-block mt-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                  Inspect Details →
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                markNotificationRead(n.id);
                              }}
                              className="p-1 rounded text-slate-300 hover:text-rose-500 dark:text-zinc-600 dark:hover:text-rose-400 shrink-0 cursor-pointer"
                              title="Dismiss"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-2 px-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {notifications.length} unread alert{notifications.length === 1 ? "" : "s"}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            navigate("/inventory/notifications");
                            setIsNotificationsOpen(false);
                          }}
                          className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          View all
                        </button>
                        {notifications.length > 0 && (
                        <button
                          onClick={markAllNotificationsRead}
                          className="text-[10px] text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 font-medium cursor-pointer"
                        >
                          Mark all read
                        </button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Dark/Light Mode Toggle */}
            <button
              onClick={toggleMode}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
            >
              {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Viewport / Scrollable page body */}
        <main className={`flex-1 overflow-y-auto bg-slate-50/60 dark:bg-zinc-950 ${
            location.pathname.includes("/inventory/tracking/") ||
            location.pathname.includes("/inventory/control/batches") ||
            location.pathname.includes("/inventory/control/serials") ||
            location.pathname.includes("/inventory/control/expiry")
              ? "p-0"
              : "p-4 lg:p-6"
          }`}>
          <div className={`inventory-module-page inventory-dashboard-contract max-w-7xl mx-auto space-y-6 ${
            location.pathname.includes("/inventory/operations/")
              ? "inventory-stock-operations "
              : ""
          }${
            location.pathname.includes("/inventory/goods-receipt")
              ? "inventory-grn-page "
              : ""
          }${
            location.pathname.includes("/inventory/tracking/") ||
            location.pathname.includes("/inventory/control/batches") ||
            location.pathname.includes("/inventory/control/serials") ||
            location.pathname.includes("/inventory/control/expiry")
              ? "inventory-tracking-page "
              : ""
          }${
            location.pathname.includes("/inventory/product") ||
            location.pathname.includes("/inventory/products") ||
            location.pathname.includes("/inventory/variants") ||
            location.pathname.includes("/inventory/categories") ||
            location.pathname.includes("/inventory/brands") ||
            location.pathname.includes("/inventory/units") ||
            location.pathname.includes("/inventory/attributes") ||
            location.pathname.includes("/inventory/sku") ||
            location.pathname.includes("/inventory/skus") ||
            location.pathname.includes("/inventory/barcodes") ||
            location.pathname.includes("/inventory/item-data")
              ? "inventory-product-page"
              : ""
          }`}>
            {children}
          </div>
        </main>
      </div>

      {/* Global Command Palette Modal */}
      <CommandPaletteModal
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
      />
    </div>
  );
}
