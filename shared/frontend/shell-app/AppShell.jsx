import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
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
  BookmarkCheck,
  CheckCircle2,
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
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useWorkspace } from "./ContextSelector";
import { CommandPaletteModal } from "../../../modules/inventory/frontend/src/components/CommandPaletteModal.jsx";
import { getApiStatus, subscribeApiStatus } from "../../../modules/inventory/frontend/src/services/api.js";

export function AppShell({ children }) {
  const location = useLocation();
  const { mode, toggleMode } = useTheme();
  const { activeFacility, facilities, setActiveFacility } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isApiLive, setIsApiLive] = useState(getApiStatus());
  const [openGroups, setOpenGroups] = useState({
    catalog: true,
    warehouses: true,
    operations: true,
    control: false,
    planning: false,
    analytics: false,
  });

  useEffect(() => {
    const unsub = subscribeApiStatus(setIsApiLive);
    return unsub;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
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
      key: "catalog",
      title: "Products & Catalog",
      items: [
        { label: "Products", path: "/inventory/products", icon: Package },
        { label: "Categories", path: "/inventory/categories", icon: Layers },
        { label: "Brands", path: "/inventory/brands", icon: Tag },
        { label: "Units of Measure", path: "/inventory/units", icon: Ruler },
        { label: "Barcodes & Tags", path: "/inventory/barcodes", icon: Barcode },
      ],
    },
    {
      key: "warehouses",
      title: "Warehouses",
      items: [
        { label: "Facility Overview", path: "/inventory/warehouses", icon: Warehouse },
        { label: "Storage Locations", path: "/inventory/locations", icon: MapPin },
      ],
    },
    {
      key: "operations",
      title: "Stock Operations",
      items: [
        { label: "Stock In (Receipt)", path: "/inventory/operations/stock-in", icon: ArrowDownLeft },
        { label: "Stock Out (Issue)", path: "/inventory/operations/stock-out", icon: ArrowUpRight },
        { label: "Transfers", path: "/inventory/operations/transfers", icon: ArrowLeftRight },
        { label: "Adjustments", path: "/inventory/operations/adjustments", icon: SlidersHorizontal },
        { label: "Reservations", path: "/inventory/operations/reservations", icon: BookmarkCheck },
        { label: "Reconciliation", path: "/inventory/operations/reconciliation", icon: CheckCircle2 },
      ],
    },
    {
      key: "control",
      title: "Stock Control",
      items: [
        { label: "Stock Balances", path: "/inventory/control/balances", icon: Boxes },
        { label: "Stock Ledger", path: "/inventory/control/ledger", icon: FileSpreadsheet },
        { label: "Batch Tracking", path: "/inventory/control/batches", icon: Hash },
        { label: "Serial Tracking", path: "/inventory/control/serials", icon: Cpu },
      ],
    },
    {
      key: "planning",
      title: "Planning",
      items: [
        { label: "Replenishment & Alerts", path: "/inventory/planning/replenishment", icon: TrendingUp },
      ],
    },
    {
      key: "analytics",
      title: "Analytics",
      items: [
        { label: "Valuation Reports", path: "/inventory/analytics/valuation", icon: DollarSign },
        { label: "Inventory Analytics", path: "/inventory/analytics/reports", icon: PieChart },
      ],
    },
    {
      title: "Configuration",
      items: [{ label: "Inventory Settings", path: "/inventory/settings", icon: Settings }],
    },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans antialiased">
      {/* Sidebar Desktop */}
      <aside
        className={`hidden md:flex flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all duration-200 z-30 select-none ${
          collapsed ? "w-18" : "w-64"
        }`}
      >
        {/* Brand / Logo */}
        <div className="flex h-15 items-center justify-between px-4 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold shadow-sm">
              <Boxes className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white leading-tight">
                  ONE ERP
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  Inventory Ecosystem v3.1
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Group Items */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {navGroups.map((group, gIdx) => {
            const hasKey = !!group.key;
            const isOpen = hasKey ? openGroups[group.key] : true;

            return (
              <div key={gIdx} className="space-y-1">
                {!collapsed && (
                  <div
                    onClick={() => hasKey && toggleGroup(group.key)}
                    className={`flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 ${
                      hasKey ? "cursor-pointer hover:text-slate-600 dark:hover:text-zinc-300" : ""
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
                      const isActive = location.pathname === item.path;
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          title={collapsed ? item.label : undefined}
                          className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 font-semibold"
                              : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-zinc-200"
                          } ${collapsed ? "justify-center px-0" : ""}`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-zinc-400"}`} />
                          {!collapsed && <span>{item.label}</span>}
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
        <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 space-y-2">
          {!collapsed && (
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500">
              <span className="flex items-center gap-1">
                <Database className="h-3 w-3 text-blue-500" /> PostgreSQL 16
              </span>
              <span className="font-mono">v3.1.0</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/80 text-xs font-bold text-blue-700 dark:text-blue-300">
              AD
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="truncate text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  Operations Admin
                </span>
                <span className="truncate text-[10px] text-slate-400 dark:text-zinc-500">
                  Universal Modules Host
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

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

            {/* Notification Bell */}
            <button className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 relative cursor-pointer">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-zinc-900" />
            </button>

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
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50/60 dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto space-y-6">
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
