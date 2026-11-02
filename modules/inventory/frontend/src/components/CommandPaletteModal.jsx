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
    { label: "Products & Catalog", path: "/inventory/products", icon: Package, category: "Catalog" },
    { label: "Categories & Taxonomy", path: "/inventory/categories", icon: Layers, category: "Catalog" },
    { label: "Brands & Manufacturers", path: "/inventory/brands", icon: Tag, category: "Catalog" },
    { label: "Units of Measure (UOM)", path: "/inventory/units", icon: Ruler, category: "Catalog" },
    { label: "Barcodes & QR Station", path: "/inventory/barcodes", icon: Barcode, category: "Catalog" },
    { label: "Warehouses & Facilities", path: "/inventory/warehouses", icon: Building2, category: "Facilities" },
    { label: "Storage Locations & Bins", path: "/inventory/locations", icon: MapPin, category: "Facilities" },
    { label: "Stock In (Goods Receipt)", path: "/inventory/operations/stock-in", icon: ArrowDownLeft, category: "Operations" },
    { label: "Stock Out (Stock Issue)", path: "/inventory/operations/stock-out", icon: ArrowUpRight, category: "Operations" },
    { label: "Warehouse Transfers", path: "/inventory/operations/transfers", icon: ArrowLeftRight, category: "Operations" },
    { label: "Cycle Adjustments", path: "/inventory/operations/adjustments", icon: SlidersHorizontal, category: "Operations" },
    { label: "Stock Reservations", path: "/inventory/operations/reservations", icon: BookmarkCheck, category: "Operations" },
    { label: "Physical Reconciliation", path: "/inventory/operations/reconciliation", icon: CheckCircle2, category: "Operations" },
    { label: "Stock Balances & Liquidity", path: "/inventory/control/balances", icon: Package, category: "Stock Control" },
    { label: "Immutable Stock Ledger", path: "/inventory/control/ledger", icon: FileSpreadsheet, category: "Stock Control" },
    { label: "Batch & Lot Tracking", path: "/inventory/control/batches", icon: Hash, category: "Stock Control" },
    { label: "Serial Number Registry", path: "/inventory/control/serials", icon: Cpu, category: "Stock Control" },
    { label: "Replenishment & Alerts", path: "/inventory/planning/replenishment", icon: TrendingUp, category: "Planning" },
    { label: "Valuation Reports (WAV)", path: "/inventory/analytics/valuation", icon: DollarSign, category: "Analytics" },
    { label: "Analytics & KPI Reports", path: "/inventory/analytics/reports", icon: PieChart, category: "Analytics" },
    { label: "Inventory Settings", path: "/inventory/settings", icon: Settings, category: "Configuration" },
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
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded">
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
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-900/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                        <Scan className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{p.name}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                            {p.sku}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Barcode: <strong className="text-slate-600 dark:text-zinc-300">{p.barcode || p.sku}</strong> • Available: <strong className="text-emerald-600 dark:text-emerald-400">{p.available ?? p.on_hand ?? 0} {p.unit || "EA"}</strong> • WAV: ${Number(p.unit_cost || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
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
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/70 cursor-pointer text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors"
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
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
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
