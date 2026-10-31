import React, { useState } from "react";
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
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useWorkspace } from "./ContextSelector";

export function AppShell({ children }) {
  const location = useLocation();
  const { mode, toggleMode } = useTheme();
  const { activeFacility, facilities, setActiveFacility } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({
    catalog: true,
    warehouses: true,
    operations: true,
    control: false,
    planning: false,
    analytics: false,
  });

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
        { label: "Product Variants", path: "/inventory/variants", icon: Boxes },
        { label: "Units of Measure", path: "/inventory/units", icon: Ruler },
        { label: "Barcodes", path: "/inventory/barcodes", icon: Barcode },
      ],
    },
    {
      key: "warehouses",
      title: "Warehouses",
      items: [
        { label: "Facility Overview", path: "/inventory/warehouses/overview", icon: Warehouse },
        { label: "Warehouses", path: "/inventory/warehouses", icon: Building2 },
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
        { label: "Stock Ledger", path: "/inventory/control/ledger", icon: FileSpreadsheet },
        { label: "Stock Balances", path: "/inventory/control/balances", icon: Boxes },
        { label: "Batch Tracking", path: "/inventory/control/batches", icon: Hash },
        { label: "Serial Tracking", path: "/inventory/control/serials", icon: Cpu },
        { label: "Expiry Management", path: "/inventory/control/expiry", icon: Clock },
      ],
    },
    {
      key: "planning",
      title: "Planning",
      items: [
        { label: "Replenishment", path: "/inventory/planning/replenishment", icon: TrendingUp },
        { label: "Low Stock Alerts", path: "/inventory/planning/low-stock", icon: AlertTriangle },
      ],
    },
    {
      key: "analytics",
      title: "Analytics",
      items: [
        { label: "Inventory Reports", path: "/inventory/analytics/reports", icon: PieChart },
        { label: "Stock Valuation", path: "/inventory/analytics/valuation", icon: DollarSign },
        { label: "Movement Analytics", path: "/inventory/analytics/movement", icon: Activity },
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
                  Inventory Module
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

        {/* Footer / User Scope */}
        <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300">
              AD
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="truncate text-xs font-medium text-slate-800 dark:text-zinc-200">
                  Admin User
                </span>
                <span className="truncate text-[10px] text-slate-400 dark:text-zinc-500">
                  Universal Modules
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
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 rounded-md text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Context Selector: Facility / Warehouse */}
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
          </div>

          {/* Actions & Utilities */}
          <div className="flex items-center gap-2">
            {/* Global Search / Command Bar trigger */}
            <div className="relative hidden sm:flex items-center">
              <Search className="absolute left-3 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search catalog, movements (Ctrl+K)..."
                className="w-64 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Notification Bell */}
            <button className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-zinc-900" />
            </button>

            {/* Dark/Light Mode Toggle */}
            <button
              onClick={toggleMode}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
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
    </div>
  );
}
