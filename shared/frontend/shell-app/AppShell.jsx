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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: "notif-1",
      title: "Low Stock Alert",
      description: "Hydraulic Pump HP-400 dropped below reorder threshold (8 units on-hand vs 25 min).",
      time: "10m ago",
      unread: true,
      type: "warning",
    },
    {
      id: "notif-2",
      title: "Stock Reconciliation Completed",
      description: "Cycle count REC-2026-001 reconciled with zero variance across Zone A.",
      time: "1h ago",
      unread: true,
      type: "success",
    },
    {
      id: "notif-3",
      title: "Goods Receipt Posted",
      description: "GRN-2026-089: 150 EA Precision Bearings received and quarantined.",
      time: "3h ago",
      unread: false,
      type: "info",
    },
  ]);
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
        className={`hidden md:flex flex-col border-r border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 transition-all duration-200 z-30 select-none shadow-xs ${
          collapsed ? "w-18" : "w-64"
        }`}
      >
        {/* Brand / Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white font-bold shadow-md shadow-blue-500/20 ring-1 ring-white/20">
              <Boxes className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  ONE ERP
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
                    v3.1
                  </span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate">
                  Inventory Management
                </span>
              </div>
            )}
          </div>
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
                      const isActive = location.pathname === item.path;
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

          <div className="flex items-center gap-3 p-1 rounded-xl hover:bg-slate-100/60 dark:hover:bg-zinc-800/40 transition-colors">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-xs">
              AD
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  Operations Admin
                </span>
                <span className="truncate text-[10px] text-slate-500 dark:text-zinc-400">
                  Universal Modules Host
                </span>
              </div>
            )}
          </div>
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
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow-sm">
                  <Boxes className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                    ONE ERP
                  </span>
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    Inventory Ecosystem v3.1
                  </span>
                </div>
              </div>
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
                          const Icon = item.icon;
                          const isActive = location.pathname === item.path;

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
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
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
                            onClick={() =>
                              setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
                            }
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
                            className={`p-3 flex items-start gap-3 hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors ${
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
                                <span className="font-semibold text-slate-900 dark:text-white truncate">
                                  {n.title}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-0.5">
                                {n.description}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                setNotifications((prev) => prev.filter((item) => item.id !== n.id))
                              }
                              className="p-1 rounded text-slate-300 hover:text-rose-500 dark:text-zinc-600 dark:hover:text-rose-400 shrink-0 cursor-pointer"
                              title="Dismiss"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <div className="p-2 px-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          {notifications.length} active alert{notifications.length > 1 ? "s" : ""}
                        </span>
                        <button
                          onClick={() => setNotifications([])}
                          className="text-[10px] text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 font-medium cursor-pointer"
                        >
                          Clear all
                        </button>
                      </div>
                    )}
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
