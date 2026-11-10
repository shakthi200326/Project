import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  LayoutDashboard,
  Package,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  FileSpreadsheet,
  CheckCircle2,
  Cpu,
  Hash,
  DollarSign,
  Sun,
  Moon,
  Warehouse,
  ChevronRight,
  Barcode,
  Scan,
  Layers,
  Tag,
  Ruler,
  MapPin,
  SlidersHorizontal,
  BookmarkCheck,
  TrendingUp,
  PieChart,
  Settings,
  ShoppingCart,
  BarChart3,
  ClipboardCheck,
  Boxes,
  Database,
  Scale,
  History,
  RefreshCw,
  AlertTriangle,
  Clock,
  Calendar,
  ShieldCheck,
  Bell,
  FlaskConical,
  PackageCheck,
  PackageX,
  Upload,
  RotateCcw,
  Truck,
} from "lucide-react";
import { useTheme } from "@shared/shell-app/ThemeProvider.jsx";
import { useWorkspace } from "@shared/shell-app/ContextSelector.jsx";
import { fetchProducts, playScanBeep, lookupProductByBarcode } from "../services/api";

export function CommandPaletteModal({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();
  const { mode, toggleMode } = useTheme();
  const { facilities, setActiveFacility } = useWorkspace();

  useEffect(() => {
    fetchProducts().then((res) => setProducts(res.results || res || []));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { label: "Dashboard Overview", path: "/inventory", icon: LayoutDashboard, category: "Navigation" },
    { label: "Item Master (Catalog)", path: "/inventory/products?tab=items", icon: Package, category: "Catalog" },
    { label: "Product Variants Matrix", path: "/inventory/products?tab=variants", icon: Boxes, category: "Catalog" },
    { label: "Item Data Management (Import / Export / Media)", path: "/inventory/products?tab=data-management", icon: Database, category: "Catalog" },
    { label: "Product Classification", path: "/inventory/classification", icon: Layers, category: "Catalog" },
    { label: "Categories & Taxonomy Hierarchy", path: "/inventory/classification?tab=categories", icon: Layers, category: "Catalog" },
    { label: "Brands & Manufacturers", path: "/inventory/classification?tab=brands", icon: Tag, category: "Catalog" },
    { label: "Units of Measure (UOM)", path: "/inventory/classification?tab=units", icon: Ruler, category: "Catalog" },
    { label: "Product Attributes & Specs", path: "/inventory/classification?tab=attributes", icon: SlidersHorizontal, category: "Catalog" },
    { label: "Barcodes & QR Station", path: "/inventory/barcodes", icon: Barcode, category: "Catalog" },
    { label: "Warehouses & Facilities", path: "/inventory/warehouses", icon: Building2, category: "Facilities" },
    { label: "Storage Locations & Bins", path: "/inventory/locations", icon: MapPin, category: "Facilities" },
    { label: "Receipt Register (Goods Receipt Operations)", path: "/inventory/goods-receipt/register?tab=register", icon: ArrowDownLeft, category: "Goods Receipt" },
    { label: "Receipt Inspection (Queue & Results)", path: "/inventory/goods-receipt/register?tab=inspection", icon: ArrowDownLeft, category: "Goods Receipt" },
    { label: "Receipt Discrepancy & Variance Log", path: "/inventory/goods-receipt/register?tab=discrepancies", icon: ArrowDownLeft, category: "Goods Receipt" },
    { label: "Partial Acceptance Management", path: "/inventory/goods-receipt/register?tab=partial", icon: ArrowDownLeft, category: "Goods Receipt" },
    { label: "Accepted Goods (Clearance & Release)", path: "/inventory/goods-receipt/outcomes?tab=accepted", icon: PackageCheck, category: "Goods Receipt" },
    { label: "Rejected Goods (Dispositions & Returns)", path: "/inventory/goods-receipt/outcomes?tab=rejected", icon: PackageX, category: "Goods Receipt" },
    { label: "Create Goods Receipt", path: "/inventory/goods-receipt/create", icon: ArrowDownLeft, category: "Goods Receipt" },
    { label: "Putaway Management", path: "/inventory/goods-receipt/putaway", icon: ArrowDownLeft, category: "Goods Receipt" },
    { label: "Stock In (Inward Receipts)", path: "/inventory/operations/stock-in?tab=stock-in", icon: ArrowDownLeft, category: "Operations" },
    { label: "Stock Issue (Goods Issue GIN)", path: "/inventory/operations/stock-in?tab=stock-issue", icon: ArrowUpRight, category: "Operations" },
    { label: "Stock Out (Outward Dispatches)", path: "/inventory/operations/stock-in?tab=stock-out", icon: Upload, category: "Operations" },
    { label: "Stock Return (Returns & Reversals)", path: "/inventory/operations/stock-in?tab=stock-return", icon: RotateCcw, category: "Operations" },
    { label: "Stock Transfer (Intra & Inter-Facility)", path: "/inventory/operations/stock-transfer?tab=stock-transfer", icon: ArrowLeftRight, category: "Operations" },
    { label: "Inter-Warehouse Transfer (Facility Transit)", path: "/inventory/operations/stock-transfer?tab=inter-warehouse", icon: Building2, category: "Operations" },
    { label: "Stock Adjustment (Cycle & Write-offs)", path: "/inventory/operations/stock-adjustment?tab=adjustment", icon: SlidersHorizontal, category: "Operations" },
    { label: "Stock Reclassification (Status & Quality)", path: "/inventory/operations/stock-adjustment?tab=reclassification", icon: RefreshCw, category: "Operations" },
    { label: "Stock Reservation (Order Allocations)", path: "/inventory/operations/stock-reservation?tab=reservation", icon: BookmarkCheck, category: "Operations" },
    { label: "Stock Release (De-allocation & Restock)", path: "/inventory/operations/stock-reservation?tab=release", icon: CheckCircle2, category: "Operations" },
    { label: "Physical Reconciliation", path: "/inventory/operations/reconciliation", icon: CheckCircle2, category: "Operations" },
    { label: "Stock Overview & Levels (Balances)", path: "/inventory/control/overview?tab=overview", icon: Boxes, category: "Stock Control" },
    { label: "Reorder Level (Safety Stock Alerts)", path: "/inventory/control/overview?tab=reorder", icon: AlertTriangle, category: "Stock Control" },
    { label: "Stock in Transit (Inter-Facility Transit)", path: "/inventory/control/overview?tab=transit", icon: Truck, category: "Stock Control" },
    { label: "Stock Aging (Dwelling & Obsolescence)", path: "/inventory/control/aging?tab=aging", icon: Clock, category: "Stock Control" },
    { label: "Stock History (Audit Movement Log)", path: "/inventory/control/aging?tab=history", icon: History, category: "Stock Control" },
    { label: "Immutable Stock Ledger", path: "/inventory/control/ledger", icon: FileSpreadsheet, category: "Stock Control" },
    { label: "Batch & Lot Tracking", path: "/inventory/control/batches", icon: Hash, category: "Stock Control" },
    { label: "Serial Number Registry", path: "/inventory/control/serials", icon: Cpu, category: "Stock Control" },
    { label: "Reorder Rules", path: "/inventory/planning/reorder-rules", icon: SlidersHorizontal, category: "Planning & Replenishment" },
    { label: "Min / Max Stock Levels", path: "/inventory/planning/min-max-levels", icon: Layers, category: "Planning & Replenishment" },
    { label: "Replenishment Planning", path: "/inventory/planning/replenishment", icon: TrendingUp, category: "Planning & Replenishment" },
    { label: "Purchase Suggestions", path: "/inventory/planning/purchase-suggestions", icon: ShoppingCart, category: "Planning & Replenishment" },
    { label: "Stock Forecast", path: "/inventory/planning/stock-forecast", icon: BarChart3, category: "Planning & Replenishment" },
    { label: "Physical Stock Count", path: "/inventory/audit/stock-count", icon: ClipboardCheck, category: "Physical Inventory & Audit" },
    { label: "Cycle Count", path: "/inventory/audit/cycle-count", icon: RefreshCw, category: "Physical Inventory & Audit" },
    { label: "Full Stock Count", path: "/inventory/audit/full-count", icon: Boxes, category: "Physical Inventory & Audit" },
    { label: "Stock Variance Review", path: "/inventory/audit/variance", icon: Scale, category: "Physical Inventory & Audit" },
    { label: "Audit History", path: "/inventory/audit/history", icon: History, category: "Physical Inventory & Audit" },
    { label: "Reports & Analytics Center", path: "/inventory/reports?tab=all", icon: BarChart3, category: "Reports & Analytics" },
    { label: "Stock Summary Report", path: "/inventory/reports?tab=summary", icon: FileSpreadsheet, category: "Reports & Analytics" },
    { label: "Stock Movement Report", path: "/inventory/reports?tab=movement", icon: ArrowLeftRight, category: "Reports & Analytics" },
    { label: "Stock Ledger Report", path: "/inventory/reports?tab=ledger", icon: FileSpreadsheet, category: "Reports & Analytics" },
    { label: "Stock Valuation Report", path: "/inventory/reports?tab=valuation", icon: DollarSign, category: "Reports & Analytics" },
    { label: "Low Stock Report", path: "/inventory/reports?tab=low-stock", icon: AlertTriangle, category: "Reports & Analytics" },
    { label: "Stock Ageing Report", path: "/inventory/reports?tab=ageing", icon: Clock, category: "Reports & Analytics" },
    { label: "Expiry Report", path: "/inventory/reports?tab=expiry", icon: Calendar, category: "Reports & Analytics" },
    { label: "Warehouse Report", path: "/inventory/reports?tab=warehouse", icon: Warehouse, category: "Reports & Analytics" },
    { label: "General Settings", path: "/inventory/configuration/general", icon: Settings, category: "Inventory Configuration" },
    { label: "Stock Settings", path: "/inventory/configuration/stock", icon: Boxes, category: "Inventory Configuration" },
    { label: "Product Tracking Settings", path: "/inventory/configuration/tracking", icon: Cpu, category: "Inventory Configuration" },
    { label: "Valuation Settings", path: "/inventory/configuration/valuation", icon: DollarSign, category: "Inventory Configuration" },
    { label: "Document Numbering", path: "/inventory/configuration/numbering", icon: Hash, category: "Inventory Configuration" },
    { label: "Approval Settings", path: "/inventory/configuration/approvals", icon: ShieldCheck, category: "Inventory Configuration" },
    { label: "Notifications & Alerts", path: "/inventory/notifications", icon: Bell, category: "Inventory Configuration" },
  ];

  const q = query.trim().toLowerCase();

  const filteredActions = actions.filter((a) =>
    !q || a.label.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
  );

  const matchedProducts = q
    ? products
        .filter(
          (p) =>
            p.name?.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.brand?.toLowerCase().includes(q) ||
            (p.barcode && String(p.barcode).toLowerCase().includes(q))
        )
        .slice(0, 5)
    : [];

  const handleSelectAction = (action) => {
    navigate(action.path);
    onClose();
  };

  const handleSelectProduct = (product) => {
    playScanBeep();
    navigate(`/inventory/products?sku=${encodeURIComponent(product.sku)}`);
    onClose();
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && q) {
      // Check if product exact matches barcode
      const match = lookupProductByBarcode(query, products);
      if (match) {
        e.preventDefault();
        handleSelectProduct(match);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-start justify-center p-4 pt-20 animate-in fade-in duration-100">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-3">
          <Search className="h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a screen, command, or scan barcode / SKU (Esc to close)..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          <kbd className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1 text-xs">
          {/* Matched Products / Barcodes Section */}
          {matchedProducts.length > 0 && (
            <div className="mb-2">
              <div className="px-2.5 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Barcode className="h-3.5 w-3.5" />
                Scanned & Catalog Products ({matchedProducts.length})
              </div>
              <div className="space-y-1">
                {matchedProducts.map((p) => (
                  <div
                    key={p.id || p.sku}
                    onClick={() => handleSelectProduct(p)}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-900/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 p-2 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                        <Scan className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span>{p.name}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                            {p.sku}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono tabular-nums mt-0.5">
                          Barcode: <strong className="text-slate-600 dark:text-zinc-300">{p.barcode || p.sku}</strong> • Available: <strong className="text-emerald-600 dark:text-emerald-400">{p.available ?? p.on_hand ?? 0} {p.unit || "EA"}</strong> • WAV: ${Number(p.unit_cost || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation & System Actions */}
          {filteredActions.length > 0 && (
            <div>
              {matchedProducts.length > 0 && (
                <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  System Commands
                </div>
              )}
              {filteredActions.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectAction(item)}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/70 cursor-pointer text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{item.label}</div>
                        <div className="text-[10px] text-slate-400">{item.category}</div>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </div>
                );
              })}
            </div>
          )}

          {filteredActions.length === 0 && matchedProducts.length === 0 && (
            <div className="p-6 text-center text-slate-400">
              No matching commands or products found for "{query}".
            </div>
          )}

          {/* Quick Actions Section */}
          <div className="pt-2 mt-2 border-t border-slate-100 dark:border-zinc-800 px-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Quick System Toggles
          </div>

          <div
            onClick={() => {
              toggleMode();
              onClose();
            }}
            className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/70 cursor-pointer text-slate-700 dark:text-zinc-300"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </div>
              <span className="font-medium">Switch to {mode === "dark" ? "Light" : "Dark"} Mode</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-zinc-800 rounded">
              Toggle
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
