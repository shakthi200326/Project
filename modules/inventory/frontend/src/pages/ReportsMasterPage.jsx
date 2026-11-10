import React, { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LayoutGrid,
  BarChart3,
  FileSpreadsheet,
  ArrowLeftRight,
  BookOpen,
  DollarSign,
  AlertTriangle,
  Clock,
  Calendar,
  Warehouse,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight,
  Search,
  Filter,
  Sparkles,
  ArrowLeft,
  Layers,
  TrendingUp,
} from "lucide-react";

import { StockSummaryReportPage } from "./StockSummaryReportPage.jsx";
import { StockMovementReportPage } from "./StockMovementReportPage.jsx";
import { StockLedgerReportPage } from "./StockLedgerReportPage.jsx";
import { StockValuationReportPage } from "./StockValuationReportPage.jsx";
import { LowStockReportPage } from "./LowStockReportPage.jsx";
import { StockAgeingReportPage } from "./StockAgeingReportPage.jsx";
import { ExpiryReportPage } from "./ExpiryReportPage.jsx";
import { WarehouseReportPage } from "./WarehouseReportPage.jsx";
import { TabStrip } from "../components/ScrollableTabs.jsx";
import { FaGreaterThan, FaLessThan } from "react-icons/fa";

const REPORT_CARDS = [
  {
    id: "summary",
    title: "Stock Summary Report",
    category: "Operational",
    badge: "ON-HAND BALANCES",
    icon: FileSpreadsheet,
    iconBg: "from-emerald-500 to-teal-600",
    borderHover: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
    badgeStyle: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800",
    description: "Consolidated SKU inventory levels, available units, warehouse allocations, and reorder threshold buffers.",
    tags: ["SKU Quantities", "Allocated vs Available", "Multi-Warehouse"],
    metric: "Real-Time",
    metricLabel: "Inventory Feed",
  },
  {
    id: "movement",
    title: "Stock Movement Report",
    category: "Operational",
    badge: "MOVEMENT VELOCITY",
    icon: ArrowLeftRight,
    iconBg: "from-blue-500 to-indigo-600",
    borderHover: "hover:border-blue-500/50 hover:shadow-blue-500/10",
    badgeStyle: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800",
    description: "Chronological inward receipts, outward dispatches, transfers between facilities, and stock adjustments.",
    tags: ["Inward Receipts", "Dispatches", "Intra-Facility Transfers"],
    metric: "Complete Log",
    metricLabel: "Transaction Trail",
  },
  {
    id: "ledger",
    title: "Stock Ledger Report",
    category: "Financial & Valuation",
    badge: "PERPETUAL ACCOUNTING",
    icon: BookOpen,
    iconBg: "from-purple-500 to-violet-600",
    borderHover: "hover:border-purple-500/50 hover:shadow-purple-500/10",
    badgeStyle: "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800",
    description: "Perpetual double-entry transaction journal with opening balances, debit/credit quantities, and closing valuations.",
    tags: ["Perpetual Journal", "Debit / Credit Units", "Audit Ledger"],
    metric: "Immutable",
    metricLabel: "Double-Entry Book",
  },
  {
    id: "valuation",
    title: "Stock Valuation Report",
    category: "Financial & Valuation",
    badge: "BALANCE SHEET ASSETS",
    icon: DollarSign,
    iconBg: "from-amber-500 to-yellow-600",
    borderHover: "hover:border-amber-500/50 hover:shadow-amber-500/10",
    badgeStyle: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800",
    description: "Total capital held across inventory calculated via Moving Weighted Average Cost (MWAC) and FIFO rules.",
    tags: ["Asset Valuation", "Unit Cost Analysis", "Category Valuation"],
    metric: "MWAC / FIFO",
    metricLabel: "Costing Engine",
  },
  {
    id: "low-stock",
    title: "Low Stock Report",
    category: "Risk & Replenishment",
    badge: "DEFICIT ALERTS",
    icon: AlertTriangle,
    iconBg: "from-rose-500 to-red-600",
    borderHover: "hover:border-rose-500/50 hover:shadow-rose-500/10",
    badgeStyle: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800",
    description: "Critical shortage tracking for items currently falling below safety stock limits or reorder thresholds.",
    tags: ["Shortage Warnings", "Min/Max Triggers", "Purchase Signals"],
    metric: "Urgent",
    metricLabel: "Replenish Action",
  },
  {
    id: "ageing",
    title: "Stock Ageing Report",
    category: "Risk & Replenishment",
    badge: "DWELLING DURATION",
    icon: Clock,
    iconBg: "from-cyan-500 to-sky-600",
    borderHover: "hover:border-cyan-500/50 hover:shadow-cyan-500/10",
    badgeStyle: "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200/60 dark:border-cyan-800",
    description: "Inventory holding durations grouped into 0–30, 31–60, 61–90, and 90+ day ageing buckets to identify slow-moving stock.",
    tags: ["Dwelling Buckets", "Stagnant Inventory", "Obsolescence Risk"],
    metric: "0–90+ Days",
    metricLabel: "Age Profiling",
  },
  {
    id: "expiry",
    title: "Expiry Report",
    category: "Quality & Compliance",
    badge: "FEFO SHELF-LIFE",
    icon: Calendar,
    iconBg: "from-orange-500 to-amber-600",
    borderHover: "hover:border-orange-500/50 hover:shadow-orange-500/10",
    badgeStyle: "bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200/60 dark:border-orange-800",
    description: "Perishable product tracking, upcoming batch expirations, FEFO fulfillment, and quarantined lots.",
    tags: ["Upcoming Expiry", "Batch Lot Tracking", "Quarantine Review"],
    metric: "FEFO Compliant",
    metricLabel: "Quality Assurance",
  },
  {
    id: "warehouse",
    title: "Warehouse Report",
    category: "Logistics & Facilities",
    badge: "FACILITY CAPACITY",
    icon: Warehouse,
    iconBg: "from-indigo-500 to-blue-600",
    borderHover: "hover:border-indigo-500/50 hover:shadow-indigo-500/10",
    badgeStyle: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800",
    description: "Warehouse space utilization, rack and bin volume fill rates, and inter-facility inventory balances.",
    tags: ["Capacity Utilization", "Bin Occupancy", "Facility Totals"],
    metric: "Multi-Facility",
    metricLabel: "Space Analytics",
  },
];

const SUB_MODULE_TABS = [
  {
    id: "all",
    label: "All Reports Directory",
    icon: LayoutGrid,
    badge: "Grid Overview",
    description: "Interactive directory of all 8 enterprise inventory reporting modules and analytics engines",
  },
  {
    id: "summary",
    label: "Stock Summary",
    icon: FileSpreadsheet,
    badge: "Balances",
    description: "Consolidated SKU balances, available vs reserved units, and warehouse distribution",
  },
  {
    id: "movement",
    label: "Stock Movement",
    icon: ArrowLeftRight,
    badge: "Velocity",
    description: "Chronological inward, outward, and transfer movements with velocity tracking",
  },
  {
    id: "ledger",
    label: "Stock Ledger",
    icon: BookOpen,
    badge: "Ledger",
    description: "Perpetual double-entry transaction journal with opening, debit/credit, and closing balances",
  },
  {
    id: "valuation",
    label: "Stock Valuation",
    icon: DollarSign,
    badge: "Valuation",
    description: "Capital inventory valuation calculated using MWAC and FIFO costing methodologies",
  },
  {
    id: "low-stock",
    label: "Low Stock",
    icon: AlertTriangle,
    badge: "Deficits",
    description: "Shortage alerts and replenishment triggers for items below critical safety levels",
  },
  {
    id: "ageing",
    label: "Stock Ageing",
    icon: Clock,
    badge: "Dwelling",
    description: "Inventory age distribution and dwelling durations across 0–30, 31–60, 61–90, 90+ days",
  },
  {
    id: "expiry",
    label: "Expiry Report",
    icon: Calendar,
    badge: "Shelf-Life",
    description: "Batch expiry tracking, shelf-life monitoring, and FEFO inventory scheduling",
  },
  {
    id: "warehouse",
    label: "Warehouse Report",
    icon: Warehouse,
    badge: "Facilities",
    description: "Facility storage capacity, bin occupancy rates, and location utilization metrics",
  },
];

export function ReportsMasterPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = (searchParams.get("tab") || "all").toLowerCase();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const tabsContainerRef = useRef(null);

  const [tabsOverflow, setTabsOverflow] = useState(false);
  const activeTabRef = useRef(null);

  const activeTab = useMemo(() => {
    const validTabs = ["all", "summary", "movement", "ledger", "valuation", "low-stock", "ageing", "expiry", "warehouse"];
    if (validTabs.includes(rawTab)) return rawTab;
    if (rawTab === "grid" || rawTab === "directory" || rawTab === "hub" || rawTab === "reports") return "all";
    if (rawTab === "stock-summary") return "summary";
    if (rawTab === "stock-movement") return "movement";
    if (rawTab === "stock-ledger") return "ledger";
    if (rawTab === "stock-valuation") return "valuation";
    if (rawTab === "lowstock" || rawTab === "shortage") return "low-stock";
    if (rawTab === "aging" || rawTab === "stock-ageing") return "ageing";
    if (rawTab === "expiration" || rawTab === "batch-expiry") return "expiry";
    if (rawTab === "facility" || rawTab === "warehouses") return "warehouse";
    return "all";
  }, [rawTab]);

  const currentIndex = SUB_MODULE_TABS.findIndex((t) => t.id === activeTab);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < SUB_MODULE_TABS.length - 1;

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeTab]);

  const handleTabChange = (tabId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabId === "all") {
        next.set("tab", "all");
      } else {
        next.set("tab", tabId);
      }
      return next;
    });
  };

  const goToPrevTab = () => {
    if (canGoPrev) {
      handleTabChange(SUB_MODULE_TABS[currentIndex - 1].id);
    }
  };

  const goToNextTab = () => {
    if (canGoNext) {
      handleTabChange(SUB_MODULE_TABS[currentIndex + 1].id);
    }
  };

  const categories = useMemo(() => {
    const set = new Set(REPORT_CARDS.map((r) => r.category));
    return ["ALL", ...Array.from(set)];
  }, []);

  const filteredReportCards = useMemo(() => {
    return REPORT_CARDS.filter((card) => {
      const matchesCategory = selectedCategory === "ALL" || card.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        card.title.toLowerCase().includes(q) ||
        card.description.toLowerCase().includes(q) ||
        card.badge.toLowerCase().includes(q) ||
        card.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const currentReportConfig = useMemo(() => {
    return REPORT_CARDS.find((r) => r.id === activeTab);
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Sub-Module Master Header */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Reports & Analytics Center
                </h1>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50">
                  CONSOLIDATED SUB-MODULE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Centralized hub for all 8 enterprise inventory reports. Browse the interactive grid or switch tabs directly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
              <span>8 Active Enterprise Reports Synced</span>
            </span>
          </div>
        </div>

        {/* Sub-Module Navigation Tabs with < and > controls */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-zinc-800 dark:bg-zinc-950/60">
          {/* Less Than (<) Navigation Button */}
          {tabsOverflow && (<button
            type="button"
            onClick={goToPrevTab}
            disabled={!canGoPrev}
            title={canGoPrev ? `Previous: ${SUB_MODULE_TABS[currentIndex - 1]?.label} (<)` : "Start of tabs (<)"}
            aria-label="Previous tab (<)"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-all ${
              canGoPrev
                ? "border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                : "border-transparent text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-30"
            }`}
          >
            <FaLessThan className="h-3 w-3" />
          </button>)}

          {/* Tabs Strip - Scrollbar hidden completely, no moving line */}
          <TabStrip
            ref={tabsContainerRef}
            onScrollState={(st) => setTabsOverflow(st.left || st.right)}
            className="flex flex-1 items-center gap-2"
            role="tablist"
            aria-label="Reports & Analytics sub-module sections"
          >
            {SUB_MODULE_TABS.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  ref={selected ? activeTabRef : null}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex min-w-max items-center gap-2.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    selected
                      ? "bg-white text-blue-700 shadow-sm dark:bg-zinc-800 dark:text-blue-400 font-bold"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      selected
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400 dark:text-zinc-500"
                    }`}
                  />
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      selected
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
                        : "bg-slate-200/70 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </TabStrip>

          {/* Greater Than (>) Navigation Button */}
          {tabsOverflow && (<button
            type="button"
            onClick={goToNextTab}
            disabled={!canGoNext}
            title={canGoNext ? `Next: ${SUB_MODULE_TABS[currentIndex + 1]?.label} (>)` : "End of tabs (>)"}
            aria-label="Next tab (>)"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-all ${
              canGoNext
                ? "border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                : "border-transparent text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-30"
            }`}
          >
            <FaGreaterThan className="h-3 w-3" />
          </button>)}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "all" ? (
        /* GRID BOX DIRECTORY VIEW */
        <div className="space-y-6">
          {/* Directory Toolbar with Search and Filters */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports by title, tags, description..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
              <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filter:
              </span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-blue-600 text-white shadow-2xs font-semibold"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {cat === "ALL" ? "All Categories" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Reports</span>
              <span className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">8 Modules</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operational</span>
              <span className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5 block">2 Reports</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Financial</span>
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">2 Reports</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Risk & Compliance</span>
              <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 block">4 Reports</span>
            </div>
          </div>

          {/* Report Grid Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredReportCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  onClick={() => handleTabChange(card.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleTabChange(card.id);
                    }
                  }}
                  className={`group relative flex flex-col justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:shadow-lg ${card.borderHover}`}
                >
                  <div className="space-y-3.5">
                    {/* Top Row: Icon and Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`h-11 w-11 rounded-xl bg-gradient-to-tr ${card.iconBg} text-white flex items-center justify-center shadow-md transition-transform duration-200 group-hover:scale-105`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border ${card.badgeStyle}`}>
                        {card.badge}
                      </span>
                    </div>

                    {/* Title and Category */}
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                        {card.category}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center justify-between">
                        <span>{card.title}</span>
                        <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 dark:text-blue-400 shrink-0" />
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {card.description}
                    </p>

                    {/* Feature Tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Footer: Metric and Launch Button */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {card.metricLabel}
                      </div>
                      <div className="text-xs font-bold font-mono text-slate-800 dark:text-zinc-200">
                        {card.metric}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                      <span>Open Report</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredReportCards.length === 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-10 text-center space-y-3">
              <Search className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                No reports found matching "{searchQuery}"
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("ALL");
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Clear search and filters
              </button>
            </div>
          )}
        </div>
      ) : (
        /* INDIVIDUAL REPORT VIEW */
        <div className="space-y-4">
          {/* Quick Breadcrumb Bar for active report */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700/60 rounded-xl px-4 py-2.5 text-xs shadow-2xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300 min-w-0">
              <span className="font-bold text-slate-900 dark:text-white shrink-0">Active Report:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 truncate">{currentReportConfig?.title}</span>
              <span className="hidden sm:inline-block text-slate-400 shrink-0">•</span>
              <span className="hidden sm:inline-block text-slate-500 dark:text-zinc-400 truncate">{currentReportConfig?.category}</span>
            </div>
            <button
              type="button"
              onClick={() => handleTabChange("all")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-zinc-700 font-bold border border-blue-200/80 dark:border-blue-900/60 transition-colors shadow-2xs cursor-pointer shrink-0"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Back to All Reports Grid</span>
            </button>
          </div>

          {/* Mount Active Report Component */}
          <div role="tabpanel" className="transition-all duration-150">
            {activeTab === "summary" && <StockSummaryReportPage />}
            {activeTab === "movement" && <StockMovementReportPage />}
            {activeTab === "ledger" && <StockLedgerReportPage />}
            {activeTab === "valuation" && <StockValuationReportPage />}
            {activeTab === "low-stock" && <LowStockReportPage />}
            {activeTab === "ageing" && <StockAgeingReportPage />}
            {activeTab === "expiry" && <ExpiryReportPage />}
            {activeTab === "warehouse" && <WarehouseReportPage />}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportsMasterPage;
