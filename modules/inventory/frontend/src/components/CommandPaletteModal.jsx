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
} from "lucide-react";
import { useTheme } from "@shared/shell-app/ThemeProvider.jsx";
import { useWorkspace } from "@shared/shell-app/ContextSelector.jsx";

export function CommandPaletteModal({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { mode, toggleMode } = useTheme();
  const { facilities, setActiveFacility } = useWorkspace();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent or custom event
        }
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
    { label: "Products & Catalog", path: "/inventory/products", icon: Package, category: "Navigation" },
    { label: "Warehouses & Facilities", path: "/inventory/warehouses", icon: Building2, category: "Navigation" },
    { label: "Stock In (Goods Receipt)", path: "/inventory/operations/stock-in", icon: ArrowDownLeft, category: "Operations" },
    { label: "Stock Out (Stock Issue)", path: "/inventory/operations/stock-out", icon: ArrowUpRight, category: "Operations" },
    { label: "Warehouse Transfers", path: "/inventory/operations/transfers", icon: ArrowLeftRight, category: "Operations" },
    { label: "Physical Stock Reconciliation", path: "/inventory/operations/reconciliation", icon: CheckCircle2, category: "Operations" },
    { label: "Immutable Stock Ledger", path: "/inventory/control/ledger", icon: FileSpreadsheet, category: "Stock Control" },
    { label: "Batch & Lot Tracking", path: "/inventory/control/batches", icon: Hash, category: "Stock Control" },
    { label: "Serial Number Registry", path: "/inventory/control/serials", icon: Cpu, category: "Stock Control" },
    { label: "Inventory Valuation (WAV)", path: "/inventory/analytics/valuation", icon: DollarSign, category: "Analytics" },
  ];

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (action) => {
    navigate(action.path);
    onClose();
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
            placeholder="Type a command or search screens (Esc to close)..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 text-xs">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-slate-400">No matching commands found.</div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  onClick={() => handleSelect(item)}
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
            })
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
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-zinc-800 rounded">Toggle</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
