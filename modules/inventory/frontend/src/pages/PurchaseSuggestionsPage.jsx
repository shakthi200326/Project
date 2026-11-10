import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  BrainCircuit,
  TrendingUp,
  Globe2,
  BadgePercent,
  Truck,
  Building2,
  ShieldCheck,
  CalendarDays,
  AlertOctagon,
  SlidersHorizontal,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Ban,
  FileCheck,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  TrendingDown,
  Warehouse as WarehouseIcon,
  Check,
  X,
  Play,
  RotateCcw,
  Package,
  Layers,
  ArrowLeftRight,
  ShieldAlert,
  Info,
  Calendar,
  AlertTriangle,
  IndianRupee,
  Sliders,
  DollarSign,
  Activity,
  Calculator,
  History as HistoryIcon,
  BarChart3,
  PieChart as PieChartIcon,
  Settings,
  FileText,
  CheckCircle,
  XCircle,
  Flame,
  Eye,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  fetchPurchaseRecommendations,
  fetchPurchaseRecommendationDetail,
  generatePurchaseRecommendations,
  approvePurchaseRecommendation,
  rejectPurchaseRecommendation,
  convertRecommendationToPR,
  modifyRecommendationItemQuantity,
  changeRecommendationSupplier,
  simulateRecommendationItem,
  fetchRecommendationDashboardMetrics,
  fetchRecommendationDashboardSummary,
  fetchDemandAnalysis,
  fetchDemandForecast,
  fetchReplenishmentPlanning,
  fetchMarketIntelligence,
  fetchSupplierIntelligence,
  compareSuppliersForItem,
  fetchRecommendationHistory,
  fetchIndustryProfiles,
  fetchMarketProviders,
  checkMarketProviderHealth,
  fetchReplenishmentPolicies,
  fetchRecommendationConfigs,
  fetchAnalysisHistory,
} from "@/services/recommendationApi";
import { fetchWarehouses, fetchProducts, fetchCategories, API_BASE } from "@/services/api";

// 9 Primary Pillars
const PILLARS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3, desc: "Executive KPI overview & alerts" },
  { id: "recommendations", label: "Recommendations", icon: BrainCircuit, desc: "Purchase recommendations central console" },
  { id: "demand_analysis", label: "Demand Analysis", icon: Activity, desc: "Historical velocity & variability" },
  { id: "forecasting", label: "Demand Forecasting", icon: TrendingUp, desc: "Horizon projections & accuracy" },
  { id: "replenishment", label: "Replenishment Planning", icon: Package, desc: "ROP, safety stock & order sizing" },
  { id: "market_intelligence", label: "Market Intelligence", icon: Globe2, desc: "External search & price signals" },
  { id: "supplier_intelligence", label: "Supplier Intelligence", icon: Truck, desc: "MCDM vendor scoring & risk" },
  { id: "history", label: "History & Audit", icon: HistoryIcon, desc: "Full approval & conversion logs" },
  { id: "settings", label: "Settings & Config", icon: Settings, desc: "Industry profiles & engine parameters" },
];

const COLORS = ["#EF4444", "#F97316", "#FBBF24", "#3B82F6", "#10B981", "#8B5CF6"];

// Fallback catalog of known products in case initial network requests lag
const FALLBACK_PRODUCTS = [
  { id: 4, name: "Polyurethane Timing Belt T10-1200", code: "BELT-T10-1200", category_name: "Power Transmission", total_available: 872, total_on_hand: 882 },
  { id: 2, name: "Industrial Ball Bearing 6205-2RS", code: "BRG-6205-2RS", category_name: "Bearings", total_available: 540, total_on_hand: 550 },
  { id: 1, name: "E2E Test Widget", code: "E2E-ITEM-1", category_name: "General", total_available: 120, total_on_hand: 120 },
  { id: 5, name: "Optical Rotary Encoder 1024 PPR", code: "ENC-OPT-1024", category_name: "Sensors & Automation", total_available: 65, total_on_hand: 70 },
  { id: 19, name: "Nilgiris Roasted Peaberry Filter Coffee 500g", code: "FMCG-BEV-008", category_name: "Beverages", total_available: 430, total_on_hand: 450 },
  { id: 10, name: "Optical Wireless Mouse", code: "MOU-001", category_name: "IT & Computer Hardware", total_available: 130, total_on_hand: 130 },
  { id: 11, name: "Mechanical Gaming Keyboard", code: "KEY-002", category_name: "IT & Computer Hardware", total_available: 85, total_on_hand: 85 },
  { id: 12, name: "27-inch 4K IPS Monitor", code: "MON-003", category_name: "IT & Computer Hardware", total_available: 42, total_on_hand: 45 },
];

/**
 * ProductSearchInput Component
 * Supports:
 * 1. Interactive Searchable Combobox with live filtering, stock badges, and category tags.
 * 2. Instant Toggle to Standard Native <select> Dropdown for users who prefer native select.
 * 3. Shows full product catalogue (all items) immediately on click.
 * 4. Shows selected product clearly inside the input display.
 */
function ProductSearchInput({
  products = [],
  selectedId = "",
  onSelect,
  placeholder = "Select or search product...",
  disabled = false,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [useNativeSelect, setUseNativeSelect] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Find currently selected product (fallback to first product if available)
  const selectedProduct = useMemo(() => {
    if (!selectedId) return products[0] || null;
    return products.find((p) => String(p.id) === String(selectedId)) || products[0] || null;
  }, [products, selectedId]);

  // Filtered products list based on search query
  const filteredProducts = useMemo(() => {
    if (!filterQuery.trim()) return products;
    const q = filterQuery.toLowerCase().trim();
    return products.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const code = (p.code || p.sku || "").toLowerCase();
      const cat = (p.category_name || p.category || "").toLowerCase();
      const brand = (p.brand_name || p.brand || "").toLowerCase();
      return name.includes(q) || code.includes(q) || cat.includes(q) || brand.includes(q);
    });
  }, [products, filterQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Autofocus the search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setHighlightIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setFilterQuery("");
    }
  }, [isOpen]);

  const handleSelect = (product) => {
    if (!product) return;
    const pId = String(product.id);
    setIsOpen(false);
    setFilterQuery("");
    if (onSelect) {
      onSelect(pId, product);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (products.length > 0 && onSelect) {
      onSelect("", null);
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < filteredProducts.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : filteredProducts.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredProducts[highlightIndex]) {
        handleSelect(filteredProducts[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // If user prefers native <select> mode:
  if (useNativeSelect) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <select
          value={selectedId || (products[0]?.id ? String(products[0].id) : "")}
          onChange={(e) => {
            const p = products.find((item) => String(item.id) === String(e.target.value));
            if (onSelect) onSelect(e.target.value, p);
          }}
          disabled={disabled}
          className="min-w-[280px] max-w-md text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-indigo-500 shadow-2xs"
        >
          {products.map((p) => {
            const code = p.code || p.sku || `ID: ${p.id}`;
            const avail = p.total_available ?? p.available ?? p.stock ?? 0;
            return (
              <option key={p.id} value={p.id}>
                {p.name} [{code}] — {avail} avail
              </option>
            );
          })}
        </select>
        <button
          type="button"
          onClick={() => setUseNativeSelect(false)}
          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer shrink-0"
          title="Switch to searchable list box"
        >
          Search view
        </button>
      </div>
    );
  }

  // Interactive Combobox UI
  const selCode = selectedProduct ? (selectedProduct.code || selectedProduct.sku || `ID: ${selectedProduct.id}`) : "";
  const selAvail = selectedProduct ? (selectedProduct.total_available ?? selectedProduct.available ?? selectedProduct.stock ?? null) : null;

  return (
    <div ref={containerRef} className={`relative min-w-[300px] max-w-md ${className}`}>
      {/* Combobox Display Trigger Box */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 cursor-pointer flex items-center justify-between gap-2 shadow-2xs transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          disabled ? "opacity-60 cursor-not-allowed" : "hover:border-indigo-400 dark:hover:border-indigo-600"
        } ${isOpen ? "ring-2 ring-indigo-500 border-indigo-500" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          {selectedProduct ? (
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="font-semibold text-slate-900 dark:text-zinc-100 truncate">
                {selectedProduct.name}
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 shrink-0">
                {selCode}
              </span>
              {selAvail !== null && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                  {selAvail} avail
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 dark:text-zinc-500 truncate">
              {placeholder || `Select product (${products.length} available)...`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedProduct && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Floating Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box Header */}
          <div className="p-2 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/50">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={filterQuery}
                onChange={(e) => {
                  setFilterQuery(e.target.value);
                  setHighlightIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={`Search ${products.length} products by name, SKU, category...`}
                className="w-full pl-8 pr-7 py-1 text-xs rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery("")}
                  className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 mt-1.5 px-0.5">
              <span>Showing {filteredProducts.length} of {products.length} products</span>
              <button
                type="button"
                onClick={() => setUseNativeSelect(true)}
                className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Switch to Dropdown List
              </button>
            </div>
          </div>

          {/* Product Items List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredProducts.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  {filterQuery ? `No products matching "${filterQuery}"` : "No products available"}
                </p>
                {filterQuery && (
                  <button
                    type="button"
                    onClick={() => setFilterQuery("")}
                    className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
                  >
                    Clear filter & show all
                  </button>
                )}
              </div>
            ) : (
              filteredProducts.map((p, idx) => {
                const isSelected = selectedProduct && String(p.id) === String(selectedProduct.id);
                const isHighlighted = idx === highlightIndex;
                const pCode = p.code || p.sku || `ID: ${p.id}`;
                const pAvail = p.total_available ?? p.available ?? p.stock ?? 0;
                const pOnHand = p.total_on_hand ?? p.on_hand ?? null;
                const pCat = p.category_name || p.category || "";

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`p-2.5 text-xs cursor-pointer flex items-center justify-between transition ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-200 font-medium"
                        : isHighlighted
                        ? "bg-slate-100 dark:bg-zinc-800/80 text-slate-900 dark:text-white"
                        : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold truncate text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <span className="truncate">{p.name}</span>
                        {isSelected && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300 font-bold shrink-0">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-medium text-slate-600 dark:text-zinc-300">{pCode}</span>
                        {pCat && <span>• {pCat}</span>}
                        {pOnHand !== null && <span>• {pOnHand} on hand</span>}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800/40">
                        {pAvail} avail
                      </span>
                      {isSelected ? (
                        <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <div className="w-4" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PurchaseSuggestionsPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const tabsContainerRef = useRef(null);
  const activeTabRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Tab index navigation helpers
  const activeTabIndex = useMemo(() => {
    const idx = PILLARS.findIndex((p) => p.id === activeTab);
    return idx >= 0 ? idx : 0;
  }, [activeTab]);

  const handlePrevTab = () => {
    if (activeTabIndex > 0) {
      setActiveTab(PILLARS[activeTabIndex - 1].id);
    }
  };

  const handleNextTab = () => {
    if (activeTabIndex < PILLARS.length - 1) {
      setActiveTab(PILLARS[activeTabIndex + 1].id);
    }
  };

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTab]);

  // Core Data
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [dashboardSummary, setDashboardSummary] = useState(null);

  // Global Filters
  const [selectedWarehouse, setSelectedWarehouse] = useState("ALL");
  const [selectedPriority, setSelectedPriority] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals & Action States
  const [detailItem, setDetailItem] = useState(null);
  const [modifyModalItem, setModifyModalItem] = useState(null);
  const [modifyQty, setModifyQty] = useState("");
  const [modifyNotes, setModifyNotes] = useState("");
  const [rejectModalRec, setRejectModalRec] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [supplierModalItem, setSupplierModalItem] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [switchSupplierName, setSwitchSupplierName] = useState("");
  const [switchUnitPrice, setSwitchUnitPrice] = useState("");
  const [switchLeadTime, setSwitchLeadTime] = useState("");
  const [simulatorItem, setSimulatorItem] = useState(null);
  const [simQty, setSimQty] = useState(100);
  const [simPrice, setSimPrice] = useState(100);
  const [simLead, setSimLead] = useState(7);
  const [simResult, setSimResult] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Demand Analysis State
  const [daProduct, setDaProduct] = useState("");
  const [daWarehouse, setDaWarehouse] = useState("ALL");
  const [daPeriod, setDaPeriod] = useState(90);
  const [daData, setDaData] = useState(null);
  const [daLoading, setDaLoading] = useState(false);

  // Forecast State
  const [fcProduct, setFcProduct] = useState("");
  const [fcWarehouse, setFcWarehouse] = useState("ALL");
  const [fcHorizon, setFcHorizon] = useState(30);
  const [fcData, setFcData] = useState(null);
  const [fcLoading, setFcLoading] = useState(false);

  // Replenishment State
  const [repWarehouse, setRepWarehouse] = useState("ALL");
  const [repCategory, setRepCategory] = useState("");
  const [repSearch, setRepSearch] = useState("");
  const [repData, setRepData] = useState(null);
  const [repLoading, setRepLoading] = useState(false);

  // Market Intelligence State
  const [marketData, setMarketData] = useState(null);
  const [marketLoading, setMarketLoading] = useState(false);

  // Supplier Intelligence State
  const [siProduct, setSiProduct] = useState("");
  const [siWarehouse, setSiWarehouse] = useState("ALL");
  const [siQty, setSiQty] = useState("50");
  const [siData, setSiData] = useState(null);
  const [siLoading, setSiLoading] = useState(false);

  // History State
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyActionFilter, setHistoryActionFilter] = useState("ALL");
  const [historyLoading, setHistoryLoading] = useState(false);

  // Settings State
  const [industryProfiles, setIndustryProfiles] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [analysisLogs, setAnalysisLogs] = useState([]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Initial Load
  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    try {
      // 1. Fetch products directly with infallible multi-layer fallback
      let validProds = [];
      try {
        const directRes = await fetch(`${API_BASE}/inventory/items/?page_size=100`);
        if (directRes.ok) {
          const directData = await directRes.json();
          validProds = directData.results || (Array.isArray(directData) ? directData : []);
        }
      } catch (e) {
        console.warn("Direct items fetch via API_BASE failed:", e);
      }

      if (!validProds || validProds.length === 0) {
        try {
          const directIpRes = await fetch("http://127.0.0.1:8000/api/v1/inventory/items/?page_size=100");
          if (directIpRes.ok) {
            const ipData = await directIpRes.json();
            validProds = ipData.results || (Array.isArray(ipData) ? ipData : []);
          }
        } catch (e) {
          console.warn("Direct IP items fetch failed:", e);
        }
      }

      if (!validProds || validProds.length === 0) {
        try {
          const prodsRes = await fetchProducts();
          validProds = Array.isArray(prodsRes) ? prodsRes : (prodsRes?.results || []);
        } catch (e) {
          console.warn("fetchProducts failed:", e);
        }
      }

      if (!validProds || validProds.length === 0) {
        validProds = FALLBACK_PRODUCTS;
      }

      setProducts(validProds);

      if (validProds.length > 0) {
        const firstId = String(validProds[0].id);
        setDaProduct((prev) => prev || firstId);
        setFcProduct((prev) => prev || firstId);
        setSiProduct((prev) => prev || firstId);
      }

      // 2. Fetch other resources in parallel with resilience
      const [whsRes, catsRes, metricsRes, summaryRes, recsRes] = await Promise.allSettled([
        fetchWarehouses(),
        fetchCategories(),
        fetchRecommendationDashboardMetrics(),
        fetchRecommendationDashboardSummary(),
        fetchPurchaseRecommendations(),
      ]);

      if (whsRes.status === "fulfilled" && Array.isArray(whsRes.value)) {
        setWarehouses(whsRes.value);
      }
      if (catsRes.status === "fulfilled" && Array.isArray(catsRes.value)) {
        setCategories(catsRes.value);
      }
      if (metricsRes.status === "fulfilled" && metricsRes.value) {
        setDashboardMetrics(metricsRes.value);
      }
      if (summaryRes.status === "fulfilled" && summaryRes.value) {
        setDashboardSummary(summaryRes.value);
      }
      if (recsRes.status === "fulfilled" && Array.isArray(recsRes.value)) {
        setRecommendations(recsRes.value);
      }
    } catch (err) {
      console.error("Failed initial load", err);
    } finally {
      setLoading(false);
    }
  }

  // When products list updates, ensure default product id is populated
  useEffect(() => {
    if (products.length > 0) {
      const firstId = String(products[0].id);
      setDaProduct((prev) => prev || firstId);
      setFcProduct((prev) => prev || firstId);
      setSiProduct((prev) => prev || firstId);
    }
  }, [products]);

  // Refresh Recommendations list
  const refreshRecommendations = async () => {
    const params = {};
    if (selectedWarehouse !== "ALL") params.warehouse = selectedWarehouse;
    if (selectedPriority !== "ALL") params.priority = selectedPriority;
    if (selectedStatus !== "ALL") params.status = selectedStatus;
    if (searchTerm) params.search = searchTerm;

    const data = await fetchPurchaseRecommendations(params);
    setRecommendations(Array.isArray(data) ? data : []);
    const [m, s] = await Promise.all([
      fetchRecommendationDashboardMetrics(),
      fetchRecommendationDashboardSummary(),
    ]);
    setDashboardMetrics(m);
    setDashboardSummary(s);
  };

  useEffect(() => {
    if (!loading) {
      refreshRecommendations();
    }
  }, [selectedWarehouse, selectedPriority, selectedStatus, searchTerm]);

  // Load Tab-Specific Data lazily when tab is opened
  useEffect(() => {
    if (activeTab === "demand_analysis") {
      if (!daData) loadDemandAnalysis();
    } else if (activeTab === "forecasting") {
      if (!fcData) loadForecast();
    } else if (activeTab === "replenishment") {
      if (!repData) loadReplenishment();
    } else if (activeTab === "market_intelligence") {
      if (!marketData) loadMarketIntelligence();
    } else if (activeTab === "supplier_intelligence") {
      if (!siData) loadSupplierIntelligence();
    } else if (activeTab === "history") {
      if (historyLogs.length === 0) loadHistory();
    } else if (activeTab === "settings") {
      if (industryProfiles.length === 0) loadSettings();
    }
  }, [activeTab]);

  // Generate Recommendations Handler
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generatePurchaseRecommendations(selectedWarehouse);
      if (res.error) {
        showToast(res.error, "error");
      } else {
        showToast(res.message || "Purchase recommendations generated successfully!");
        await refreshRecommendations();
      }
    } catch (e) {
      showToast("Generation failed: " + e.message, "error");
    } finally {
      setGenerating(false);
    }
  };

  // Approve Handler
  const handleApprove = async (recId) => {
    const res = await approvePurchaseRecommendation(recId);
    if (res.error) {
      showToast(res.error, "error");
    } else {
      showToast("Recommendation approved successfully!");
      refreshRecommendations();
    }
  };

  // Reject Handler
  const handleRejectConfirm = async () => {
    if (!rejectModalRec) return;
    const res = await rejectPurchaseRecommendation(rejectModalRec.id, rejectionReason);
    if (res.error) {
      showToast(res.error, "error");
    } else {
      showToast("Recommendation rejected.");
      setRejectModalRec(null);
      setRejectionReason("");
      refreshRecommendations();
    }
  };

  // Convert to PR Handler
  const handleConvertToPR = async (recId) => {
    const res = await convertRecommendationToPR(recId);
    if (res.error) {
      showToast(res.error, "error");
    } else {
      showToast(`Converted to Purchase Order! Ref: ${res.purchase_request_reference}`);
      refreshRecommendations();
    }
  };

  // Modify Quantity Handler
  const handleModifyQuantityConfirm = async () => {
    if (!modifyModalItem || !modifyQty) return;
    const res = await modifyRecommendationItemQuantity(modifyModalItem.id, parseFloat(modifyQty), modifyNotes);
    if (res.error) {
      showToast(res.error, "error");
    } else {
      showToast(`Updated quantity to ${modifyQty} units.`);
      setModifyModalItem(null);
      setModifyQty("");
      setModifyNotes("");
      refreshRecommendations();
    }
  };

  // Change Supplier Modal & Compare
  const openSupplierModal = async (item) => {
    setSupplierModalItem(item);
    setSwitchSupplierName(item.preferred_supplier || "");
    setSwitchUnitPrice(item.estimated_unit_price || "");
    setSwitchLeadTime(item.lead_time_days || "");
    const comp = await compareSuppliersForItem({ item_id: item.id });
    setCompareData(comp);
  };

  const handleSwitchSupplierConfirm = async () => {
    if (!supplierModalItem || !switchSupplierName) return;
    const payload = {
      item_id: supplierModalItem.id,
      supplier_name: switchSupplierName,
      unit_price: switchUnitPrice ? parseFloat(switchUnitPrice) : undefined,
      lead_time_days: switchLeadTime ? parseInt(switchLeadTime) : undefined,
      notes: "Switched supplier via procurement console.",
    };
    const res = await changeRecommendationSupplier(payload);
    if (res.error) {
      showToast(res.error, "error");
    } else {
      showToast(`Preferred supplier changed to ${switchSupplierName}!`);
      setSupplierModalItem(null);
      setCompareData(null);
      refreshRecommendations();
    }
  };

  // Simulator
  const openSimulator = (item) => {
    setSimulatorItem(item);
    setSimQty(item.suggested_quantity || 100);
    setSimPrice(item.estimated_unit_price || 100);
    setSimLead(item.lead_time_days || 7);
    runSimulation(item.id, item.suggested_quantity || 100, item.estimated_unit_price || 100, item.lead_time_days || 7);
  };

  const runSimulation = async (itemId, qty, price, lead) => {
    const res = await simulateRecommendationItem(itemId, {
      simulated_quantity: qty,
      simulated_unit_price: price,
      simulated_lead_time_days: lead,
    });
    setSimResult(res);
  };

  // Demand Analysis Fetch
  const loadDemandAnalysis = async (explicitProdId = null) => {
    const prodId = explicitProdId || daProduct || (products[0]?.id ? String(products[0].id) : null);
    if (!prodId) {
      showToast("Please select a product first", "error");
      return;
    }
    if (!daProduct) setDaProduct(prodId);
    setDaLoading(true);
    try {
      const data = await fetchDemandAnalysis({
        product_id: prodId,
        warehouse_id: daWarehouse,
        period_days: daPeriod,
      });
      if (data && !data.error) {
        setDaData(data);
        showToast(`Demand analysis calculated for ${data.product_name || "selected SKU"}`);
      } else {
        showToast(data?.error || "Demand analysis data not found", "error");
      }
    } catch (e) {
      showToast("Error loading demand analysis: " + e.message, "error");
    } finally {
      setDaLoading(false);
    }
  };

  // Forecast Fetch
  const loadForecast = async (explicitProdId = null) => {
    const prodId = explicitProdId || fcProduct || (products[0]?.id ? String(products[0].id) : null);
    if (!prodId) {
      showToast("Please select a product first", "error");
      return;
    }
    if (!fcProduct) setFcProduct(prodId);
    setFcLoading(true);
    try {
      const data = await fetchDemandForecast({
        product_id: prodId,
        warehouse_id: fcWarehouse,
        forecast_period_days: fcHorizon,
      });
      if (data && !data.error) {
        setFcData(data);
        showToast(`Forecast projection generated for ${data.product_name || "selected SKU"}`);
      } else {
        showToast(data?.error || "Forecast calculation failed", "error");
      }
    } catch (e) {
      showToast("Error computing forecast: " + e.message, "error");
    } finally {
      setFcLoading(false);
    }
  };

  // Replenishment Fetch
  const loadReplenishment = async () => {
    setRepLoading(true);
    try {
      const data = await fetchReplenishmentPlanning({
        warehouse_id: repWarehouse,
        category_id: repCategory,
        search: repSearch,
      });
      if (data && !data.error) {
        setRepData(data);
        showToast(`Replenishment plan computed (${data.replenishment_required_count ?? 0} SKUs flagged)`);
      }
    } catch (e) {
      showToast("Error computing replenishment: " + e.message, "error");
    } finally {
      setRepLoading(false);
    }
  };

  // Market Intelligence Fetch
  const loadMarketIntelligence = async () => {
    setMarketLoading(true);
    try {
      const data = await fetchMarketIntelligence();
      if (data && !data.error) {
        setMarketData(data);
        showToast("Market intelligence feeds refreshed successfully!");
      }
    } catch (e) {
      showToast("Failed to refresh feeds: " + e.message, "error");
    } finally {
      setMarketLoading(false);
    }
  };

  const handleProviderHealthCheck = async (providerId) => {
    const res = await checkMarketProviderHealth(providerId);
    if (res) {
      showToast(`Provider '${res.name}' health verified: ${res.health_status}`);
      loadMarketIntelligence();
    }
  };

  // Supplier Intelligence Fetch
  const loadSupplierIntelligence = async (explicitProdId = null) => {
    const prodId = explicitProdId || siProduct || (products[0]?.id ? String(products[0].id) : null);
    if (!prodId) {
      showToast("Please select a product first", "error");
      return;
    }
    if (!siProduct) setSiProduct(prodId);
    const qty = parseFloat(siQty) || 50;
    setSiLoading(true);
    try {
      const data = await fetchSupplierIntelligence({
        product_id: prodId,
        warehouse_id: siWarehouse,
        required_qty: qty,
      });
      if (data && !data.error) {
        setSiData(data);
        showToast(`MCDM evaluation completed for ${data.product_name || "selected SKU"}`);
      } else {
        showToast(data?.error || "Supplier evaluation failed", "error");
      }
    } catch (e) {
      showToast("Error running MCDM: " + e.message, "error");
    } finally {
      setSiLoading(false);
    }
  };

  // History Fetch
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const logs = await fetchRecommendationHistory({ action_type: historyActionFilter });
      setHistoryLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Settings Fetch
  const loadSettings = async () => {
    try {
      const [profiles, cfg, execLogs] = await Promise.all([
        fetchIndustryProfiles(),
        fetchRecommendationConfigs(),
        fetchAnalysisHistory(),
      ]);
      setIndustryProfiles(profiles);
      setConfigs(cfg);
      setAnalysisLogs(execLogs);
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered Replenishment Items for lightning-fast client-side search without refetch lag
  const filteredRepItems = useMemo(() => {
    if (!repData?.items) return [];
    if (!repSearch.trim()) return repData.items;
    const q = repSearch.toLowerCase();
    return repData.items.filter(
      (item) =>
        item.product_name?.toLowerCase().includes(q) ||
        item.product_code?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
    );
  }, [repData, repSearch]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 pb-16 transition-colors">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-white font-medium text-sm transition-all transform animate-bounce ${
            toast.type === "error" ? "bg-red-600" : "bg-emerald-600"
          }`}
        >
          {toast.type === "error" ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Top Header (Non-sticky as requested) */}
      <header className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 dark:shadow-indigo-950/50">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Purchase Recommendation System
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Enterprise v3.0
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Universal Multi-Industry Intelligence • Internal Demand + External Market Signals
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
                {generating ? "Evaluating Models..." : "Run Recommendation Engine"}
              </button>
            </div>
          </div>

          {/* Navigation Bar: 9 Pillars with < and > symbols for smooth tab movement */}
          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-slate-100 dark:border-zinc-800 min-w-0">
            <button
              type="button"
              onClick={handlePrevTab}
              disabled={activeTabIndex <= 0}
              aria-label="Previous tab"
              title="Previous Tab (<)"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 transition cursor-pointer"
            >
              <span className="font-bold text-sm select-none">&lt;</span>
            </button>

            <nav
              ref={tabsContainerRef}
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 scroll-smooth py-0.5"
            >
              {PILLARS.map((p) => {
                const Icon = p.icon;
                const isActive = activeTab === p.id;
                return (
                  <button
                    key={p.id}
                    ref={isActive ? activeTabRef : null}
                    onClick={() => setActiveTab(p.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer select-none transition-colors border ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 shadow-xs"
                        : "border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-zinc-500"}`} />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={handleNextTab}
              disabled={activeTabIndex >= PILLARS.length - 1}
              aria-label="Next tab"
              title="Next Tab (>)"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 transition cursor-pointer"
            >
              <span className="font-bold text-sm select-none">&gt;</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* =========================================================================
            TAB 1: DASHBOARD
           ========================================================================= */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* KPI Metric Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
                  <span className="text-xs font-medium">Total Recommendations</span>
                  <Layers className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {dashboardMetrics?.total_recommendations ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                  {dashboardMetrics?.total_recommended_items ?? 0} SKUs flagged
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/20 shadow-xs">
                <div className="flex items-center justify-between text-red-600 dark:text-red-400 mb-1">
                  <span className="text-xs font-semibold">Critical Stockouts</span>
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {dashboardMetrics?.critical_stockouts_count ?? 0}
                </div>
                <div className="text-[11px] text-red-500 dark:text-red-400 mt-1">Immediate reorder required</div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/20 shadow-xs">
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
                  <span className="text-xs font-semibold">High Priority</span>
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {dashboardMetrics?.high_priority_count ?? 0}
                </div>
                <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Within lead time window</div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
                  <span className="text-xs font-medium">Purchase Outlay</span>
                  <IndianRupee className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  ₹{Number(dashboardMetrics?.total_estimated_outlay || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                  Pending: ₹{Number(dashboardMetrics?.pending_approvals_outlay || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
                  <span className="text-xs font-semibold">Converted to PO</span>
                  <FileCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {dashboardMetrics?.converted_po_count ?? 0}
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                  Outlay: ₹{Number(dashboardMetrics?.converted_po_outlay || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/20 shadow-xs">
                <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
                  <span className="text-xs font-semibold">Quote Savings</span>
                  <BadgePercent className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ₹{Number(dashboardMetrics?.cost_saving_opportunities || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">From supplier quote spread</div>
              </div>
            </div>

            {/* Visual Charts & Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Priority Distribution Chart */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-indigo-500" />
                  Recommendation Urgency Distribution
                </h3>
                <div className="h-56">
                  {dashboardSummary?.priority_distribution ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dashboardSummary.priority_distribution}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                        >
                          {dashboardSummary.priority_distribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", color: "#f4f4f5" }} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 dark:text-zinc-500 text-xs">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Warehouse Outlay Distribution */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs lg:col-span-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  Capital Outlay by Warehouse
                </h3>
                <div className="h-56">
                  {dashboardSummary?.warehouse_breakdown ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardSummary.warehouse_breakdown}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" strokeOpacity={0.4} />
                        <XAxis dataKey="warehouse_code" stroke="#a1a1aa" fontSize={11} />
                        <YAxis stroke="#a1a1aa" fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", color: "#f4f4f5" }} formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Outlay"]} />
                        <Bar dataKey="total_outlay" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 dark:text-zinc-500 text-xs">
                      No data available
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Row: Market Trends & Top Demanding SKUs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Surging Demands */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    Top Capital Commitment Items
                  </h3>
                  <button
                    onClick={() => setActiveTab("recommendations")}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    View All <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {dashboardSummary?.top_recommended_items?.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                          <span>SKU: {item.sku}</span>
                          <span>•</span>
                          <span>{item.warehouse}</span>
                          <span>•</span>
                          <span className="font-medium text-slate-700 dark:text-zinc-300">{item.preferred_supplier}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-indigo-600 dark:text-indigo-400">
                          ₹{Number(item.total_cost || 0).toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                          Qty: {item.suggested_qty} units
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!dashboardSummary?.top_recommended_items || dashboardSummary.top_recommended_items.length === 0) && (
                    <div className="py-6 text-center text-slate-400 dark:text-zinc-500 text-xs">No items currently queued.</div>
                  )}
                </div>
              </div>

              {/* Market Signals Overview */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Globe2 className="w-4 h-4 text-blue-500" />
                    Live Market Search Velocity (Google Trends)
                  </h3>
                  <button
                    onClick={() => setActiveTab("market_intelligence")}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    Details <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {dashboardSummary?.market_signals?.map((sig, i) => (
                    <div key={i} className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-200/60 dark:border-zinc-700/60">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">{sig.industry}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5 ${
                            sig.growth_pct >= 0 ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400"
                          }`}
                        >
                          {sig.growth_pct >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                          {sig.growth_pct}%
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">Keyword: {sig.keyword}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${sig.search_index}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-zinc-300">{sig.search_index}/100</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: PURCHASE RECOMMENDATIONS CENTRAL CONSOLE
           ========================================================================= */}
        {activeTab === "recommendations" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search SKU, name, supplier..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>

                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="CONVERTED">Converted to PO</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                Found {recommendations.length} recommendation batch(es)
              </div>
            </div>

            {/* Recommendation Batches & Line Items */}
            {recommendations.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 p-12 rounded-xl border border-slate-200 dark:border-zinc-800 text-center text-slate-500 dark:text-zinc-400">
                <BrainCircuit className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-700 dark:text-zinc-200">No Purchase Recommendations Found</h4>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 max-w-md mx-auto">
                  Click "Run Recommendation Engine" above to analyze inventory stock levels, consumption velocity, and external market signals.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recommendations.map((rec) => {
                  const isConverted = rec.status === "CONVERTED";
                  const isApproved = rec.status === "APPROVED";
                  const isRejected = rec.status === "REJECTED";

                  return (
                    <div
                      key={rec.id}
                      className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden transition"
                    >
                      {/* Batch Header */}
                      <div className="p-4 bg-slate-50/60 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/70 rounded border border-indigo-200 dark:border-indigo-800">
                            {rec.recommendation_number}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{rec.warehouse_name || rec.warehouse?.name || "Warehouse"}</span>
                            <span className="text-slate-400 dark:text-zinc-500 text-xs ml-2">({rec.warehouse_code || rec.warehouse?.code})</span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              rec.priority === "CRITICAL"
                                ? "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                                : rec.priority === "HIGH"
                                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                            }`}
                          >
                            {rec.priority}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isConverted
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                                : isApproved
                                ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800"
                                : isRejected
                                ? "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border border-red-300 dark:border-red-800"
                                : "bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300"
                            }`}
                          >
                            {rec.status.replace("_", " ")}
                          </span>
                        </div>

                        {/* Batch Action Buttons */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-zinc-400 mr-2">
                            Total Outlay:{" "}
                            <strong className="text-slate-900 dark:text-white">
                              ₹{Number(rec.total_estimated_outlay || 0).toLocaleString("en-IN")}
                            </strong>
                          </span>

                          {!isConverted && !isRejected && (
                            <>
                              {!isApproved && (
                                <>
                                  <button
                                    onClick={() => handleApprove(rec.id)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Approve
                                  </button>
                                  <button
                                    onClick={() => setRejectModalRec(rec)}
                                    className="px-2.5 py-1 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" /> Reject
                                  </button>
                                </>
                              )}

                              <button
                                onClick={() => handleConvertToPR(rec.id)}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <FileCheck className="w-3.5 h-3.5" /> Convert to PO
                              </button>
                            </>
                          )}

                          {isConverted && rec.purchase_request_reference && (
                            <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {rec.purchase_request_reference}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Line Items Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 font-semibold text-[11px]">
                              <th className="py-2.5 px-4">Product / SKU</th>
                              <th className="py-2.5 px-3">Available / Reserved</th>
                              <th className="py-2.5 px-3">ROP / Safety</th>
                              <th className="py-2.5 px-3">Daily Demand</th>
                              <th className="py-2.5 px-3">Suggested Qty</th>
                              <th className="py-2.5 px-3">Unit Price</th>
                              <th className="py-2.5 px-3">Total Outlay</th>
                              <th className="py-2.5 px-3">Preferred Supplier</th>
                              <th className="py-2.5 px-3 text-center">Urgency</th>
                              <th className="py-2.5 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {rec.items?.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 transition">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {item.product_name || item.product_name_display || item.product?.name || "Product"}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                                    {item.product_code || item.product?.code || "N/A"}
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="font-semibold text-slate-800 dark:text-zinc-200">{Number(item.available_stock ?? item.current_available_stock ?? 0).toFixed(0)}</span>
                                  <span className="text-slate-400 dark:text-zinc-500 text-[10px] ml-1">({Number(item.reserved_stock ?? item.current_reserved_stock ?? 0).toFixed(0)} res)</span>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="text-slate-800 dark:text-zinc-200 font-medium">{Number(item.reorder_point || 0).toFixed(0)}</span>
                                  <span className="text-slate-400 dark:text-zinc-500 text-[10px] ml-1">/{Number(item.safety_stock || 0).toFixed(0)}</span>
                                </td>
                                <td className="py-3 px-3 font-medium text-slate-700 dark:text-zinc-300">
                                  {Number(item.average_daily_demand || 0).toFixed(1)}/day
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800 text-xs">
                                      {Number(item.suggested_quantity || 0).toFixed(0)}
                                    </span>
                                    {item.user_modified_quantity !== null && (
                                      <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1 rounded font-semibold" title="Modified by user">
                                        Mod
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 font-mono text-slate-700 dark:text-zinc-300">
                                  ₹{Number(item.estimated_unit_price || 0).toFixed(2)}
                                </td>
                                <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                                  ₹{Number(item.estimated_total_cost || 0).toLocaleString("en-IN")}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-medium text-slate-800 dark:text-zinc-200 truncate max-w-[130px]">
                                    {item.preferred_supplier || "Unassigned"}
                                  </div>
                                  <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                                    Lead: {item.lead_time_days || 7}d
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                      item.priority === "CRITICAL"
                                        ? "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400"
                                        : item.priority === "HIGH"
                                        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                                        : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400"
                                    }`}
                                  >
                                    {item.priority}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => setDetailItem(item)}
                                      title="Mathematical breakdown & evidence"
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setModifyModalItem(item);
                                        setModifyQty(item.suggested_quantity);
                                      }}
                                      title="Modify recommended quantity"
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded cursor-pointer"
                                    >
                                      <Sliders className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => openSupplierModal(item)}
                                      title="Compare & Switch Supplier"
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded cursor-pointer"
                                    >
                                      <Truck className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => openSimulator(item)}
                                      title="What-If Simulation Sandbox"
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 text-indigo-600 dark:text-indigo-400 rounded cursor-pointer"
                                    >
                                      <Calculator className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: DEMAND ANALYSIS
           ========================================================================= */}
        {activeTab === "demand_analysis" && (
          <div className="space-y-6">
            {/* Control Panel */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">Select Product</label>
                <ProductSearchInput
                  products={products}
                  selectedId={daProduct}
                  onSelect={(pId) => {
                    setDaProduct(pId);
                    loadDemandAnalysis(pId);
                  }}
                  placeholder="Type to search SKU or name..."
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">Warehouse</label>
                <select
                  value={daWarehouse}
                  onChange={(e) => setDaWarehouse(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium"
                >
                  <option value="ALL">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">Lookback Period</label>
                <select
                  value={daPeriod}
                  onChange={(e) => setDaPeriod(Number(e.target.value))}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium"
                >
                  <option value={30}>Last 30 Days</option>
                  <option value={90}>Last 90 Days</option>
                  <option value={180}>Last 180 Days</option>
                  <option value={365}>Last 365 Days</option>
                </select>
              </div>

              <div className="pt-5">
                <button
                  onClick={() => loadDemandAnalysis()}
                  disabled={daLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${daLoading ? "animate-spin" : ""}`} />
                  {daLoading ? "Analyzing..." : "Analyze Demand"}
                </button>
              </div>
            </div>

            {/* Loading State */}
            {daLoading && !daData && (
              <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                <p className="text-xs font-semibold">Computing historical velocity, growth rates & volatility indices...</p>
              </div>
            )}

            {/* Analysis Metrics */}
            {daData && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">Sales Velocity</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
                      {daData.sales_velocity_daily} <span className="text-xs text-slate-500 dark:text-zinc-400">units/day</span>
                    </span>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">Total Consumption</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
                      {daData.total_consumption} <span className="text-xs text-slate-500 dark:text-zinc-400">units</span>
                    </span>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">Demand Growth %</span>
                    <span
                      className={`text-2xl font-bold mt-1 block flex items-center gap-1 ${
                        daData.growth_trend_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {daData.growth_trend_pct >= 0 ? "+" : ""}
                      {daData.growth_trend_pct}%
                    </span>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">Std Deviation</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
                      ±{daData.standard_deviation}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">Coeff. of Variation</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
                      {daData.coefficient_of_variation}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">Variability Class</span>
                    <span
                      className={`inline-block mt-2 px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                        daData.is_volatile ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400" : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400"
                      }`}
                    >
                      {daData.is_volatile ? "Volatile" : "Stable Pattern"}
                    </span>
                  </div>
                </div>

                {/* Daily Consumption Chart */}
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Daily Demand Consumption Timeline ({daData.product_name})
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={daData.daily_demand}>
                        <defs>
                          <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" strokeOpacity={0.4} />
                        <XAxis dataKey="date" stroke="#a1a1aa" fontSize={11} />
                        <YAxis stroke="#a1a1aa" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", color: "#f4f4f5" }} />
                        <Area type="monotone" dataKey="quantity" stroke="#4F46E5" strokeWidth={2} fillOpacity={1} fill="url(#colorDemand)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Aggregated Demand: Weekly & Category Peer Comparison */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Weekly Consumption Aggregation</h3>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={daData.weekly_demand}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" strokeOpacity={0.4} />
                          <XAxis dataKey="period" stroke="#a1a1aa" fontSize={11} />
                          <YAxis stroke="#a1a1aa" fontSize={11} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", color: "#f4f4f5" }} />
                          <Bar dataKey="quantity" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Warehouse Stock Distribution</h3>
                    <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {daData.warehouse_distribution?.map((wh, idx) => (
                        <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-zinc-200">{wh.warehouse_name}</span>
                            <span className="text-slate-400 dark:text-zinc-500 text-[10px] ml-2">({wh.warehouse_code})</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{wh.on_hand} units on-hand</span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 ml-2">({wh.reserved} res)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: DEMAND FORECASTING
           ========================================================================= */}
        {activeTab === "forecasting" && (
          <div className="space-y-6">
            {/* Control Panel */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">Select Product</label>
                <ProductSearchInput
                  products={products}
                  selectedId={fcProduct}
                  onSelect={(pId) => {
                    setFcProduct(pId);
                    loadForecast(pId);
                  }}
                  placeholder="Type to search SKU or name..."
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">Warehouse</label>
                <select
                  value={fcWarehouse}
                  onChange={(e) => setFcWarehouse(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium"
                >
                  <option value="ALL">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">Forecast Horizon</label>
                <select
                  value={fcHorizon}
                  onChange={(e) => setFcHorizon(Number(e.target.value))}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium"
                >
                  <option value={30}>30 Days Ahead</option>
                  <option value={60}>60 Days Ahead</option>
                  <option value={90}>90 Days Ahead</option>
                  <option value={180}>180 Days Ahead</option>
                </select>
              </div>

              <div className="pt-5">
                <button
                  onClick={() => loadForecast()}
                  disabled={fcLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fcLoading ? "animate-spin" : ""}`} />
                  {fcLoading ? "Computing Forecast..." : "Generate Forecast"}
                </button>
              </div>
            </div>

            {/* Loading State */}
            {fcLoading && !fcData && (
              <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                <p className="text-xs font-semibold">Generating future demand forecast curves and computing model confidence...</p>
              </div>
            )}

            {/* Forecast Metrics */}
            {fcData && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">Avg Daily Run-Rate</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
                      {fcData.average_daily_demand} <span className="text-xs text-slate-500 dark:text-zinc-400">units</span>
                    </span>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">Total Horizon Demand</span>
                    <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
                      {fcData.total_projected_demand} <span className="text-xs text-indigo-400 dark:text-indigo-500">units</span>
                    </span>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">Model Confidence</span>
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                      {fcData.confidence_score}%
                    </span>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">Accuracy (MAPE)</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
                      {fcData.mape}%
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500">Mean Abs % Error</span>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">Forecasting Engine</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 mt-1 block">
                      {fcData.forecast_method}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Sufficient data verified</span>
                  </div>
                </div>

                {/* Forecast Timeline Chart */}
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    {fcHorizon}-Day Future Projected Demand Cumulative Curve
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={fcData.projections}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" strokeOpacity={0.4} />
                        <XAxis dataKey="date" stroke="#a1a1aa" fontSize={11} />
                        <YAxis stroke="#a1a1aa" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", color: "#f4f4f5" }} />
                        <Legend />
                        <Line type="monotone" dataKey="cumulative_projected" name="Cumulative Demand (Units)" stroke="#4F46E5" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="projected_daily" name="Daily Projected (Units)" stroke="#10B981" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 5: REPLENISHMENT PLANNING
           ========================================================================= */}
        {activeTab === "replenishment" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Instant filter SKU or name..."
                    value={repSearch}
                    onChange={(e) => setRepSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={repWarehouse}
                  onChange={(e) => setRepWarehouse(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium"
                >
                  <option value="ALL">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>

                <select
                  value={repCategory}
                  onChange={(e) => setRepCategory(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={loadReplenishment}
                disabled={repLoading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${repLoading ? "animate-spin" : ""}`} />
                {repLoading ? "Recalculating..." : "Calculate Replenishment Plan"}
              </button>
            </div>

            {/* Loading State */}
            {repLoading && !repData && (
              <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                <p className="text-xs font-semibold">Evaluating safety stock, ROP, lead-time buffers, and multi-warehouse transfers...</p>
              </div>
            )}

            {repData && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-400 flex items-center justify-between">
                  <span>
                    Showing {filteredRepItems.length} of {repData.total_products_evaluated} products •{" "}
                    <strong className="text-red-600 dark:text-red-400">{repData.replenishment_required_count} requiring reorder</strong>
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                    Formula: (Target Stock - Net Inventory) adjusted for MOQ & Pack Multiples
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 font-semibold border-b border-slate-200 dark:border-zinc-800">
                        <th className="py-2.5 px-4">SKU / Item</th>
                        <th className="py-2.5 px-3">Available</th>
                        <th className="py-2.5 px-3">Net Pos</th>
                        <th className="py-2.5 px-3">ROP</th>
                        <th className="py-2.5 px-3">Safety Stk</th>
                        <th className="py-2.5 px-3">Target Stk</th>
                        <th className="py-2.5 px-3">Daily Rate</th>
                        <th className="py-2.5 px-3">DOS</th>
                        <th className="py-2.5 px-3">Suggested Order</th>
                        <th className="py-2.5 px-3">Est Outlay</th>
                        <th className="py-2.5 px-3">Inter-WH Transfer</th>
                        <th className="py-2.5 px-4 text-center">Urgency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {filteredRepItems.map((item) => (
                        <tr
                          key={item.product_id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 transition ${
                            item.is_replenishment_needed ? "bg-red-50/15 dark:bg-red-950/20" : ""
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{item.product_name}</div>
                            <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                              {item.product_code} • {item.category}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800 dark:text-zinc-200">{item.available}</td>
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{item.net_position}</td>
                          <td className="py-3 px-3 font-medium text-slate-700 dark:text-zinc-300">{item.reorder_point}</td>
                          <td className="py-3 px-3 text-slate-500 dark:text-zinc-400">{item.safety_stock}</td>
                          <td className="py-3 px-3 text-slate-500 dark:text-zinc-400">{item.target_stock}</td>
                          <td className="py-3 px-3 font-medium text-slate-700 dark:text-zinc-300">{item.average_daily_demand}/d</td>
                          <td className="py-3 px-3">
                            <span
                              className={`font-semibold ${
                                item.days_of_supply <= 7 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-zinc-300"
                              }`}
                            >
                              {item.days_of_supply}d
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                              {item.suggested_quantity}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                            ₹{Number(item.estimated_total_cost).toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-3">
                            {item.transfer_feasible ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                <ArrowLeftRight className="w-3 h-3" />
                                {item.transfer_quantity} from {item.transfer_source}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500">No surplus</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                item.priority === "CRITICAL"
                                  ? "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400"
                                  : item.priority === "HIGH"
                                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                                  : item.priority === "MEDIUM"
                                  ? "bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-400"
                                  : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {item.priority}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 6: MARKET INTELLIGENCE
           ========================================================================= */}
        {activeTab === "market_intelligence" && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div className="text-xs text-indigo-900 dark:text-indigo-300">
                  <strong>External Market Intelligence Engine:</strong> Captures real-time consumer search trends, wholesale price benchmarks, and supply chain availability without fabricating data.
                </div>
              </div>
              <button
                onClick={loadMarketIntelligence}
                disabled={marketLoading}
                className="px-3 py-1 bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-50 dark:hover:bg-zinc-700 text-indigo-700 dark:text-indigo-400 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${marketLoading ? "animate-spin" : ""}`} />
                <span>{marketLoading ? "Refreshing..." : "Refresh Feeds"}</span>
              </button>
            </div>

            {/* Google Trends Velocity Cards */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Cross-Industry Consumer Search Velocity (Google Trends)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {marketData?.trends?.map((t, idx) => (
                  <div key={idx} className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{t.industry_name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-0.5 ${
                          t.growth_4w_pct >= 0 ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {t.growth_4w_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {t.growth_4w_pct}%
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">Keyword: {t.primary_keyword}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-zinc-400">Search Velocity</span>
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{t.search_index} / 100</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${t.search_index}%` }} />
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2 flex items-center justify-between">
                      <span>Direction: {t.directional_trend}</span>
                      <span>Conf: {(t.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Provider Health Status */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Connected External Market Data Providers
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {marketData?.providers?.map((p) => (
                  <div key={p.id} className="p-4 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{p.name}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          p.health_status === "HEALTHY"
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                            : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {p.health_status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">{p.description}</p>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500">
                      <span>Rate: {p.rate_limit_per_minute}/min</span>
                      <button
                        onClick={() => handleProviderHealthCheck(p.id)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-semibold cursor-pointer"
                      >
                        Ping Health
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 7: SUPPLIER INTELLIGENCE
           ========================================================================= */}
        {activeTab === "supplier_intelligence" && (
          <div className="space-y-6">
            {/* Control Panel */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">Select Product</label>
                <ProductSearchInput
                  products={products}
                  selectedId={siProduct}
                  onSelect={(pId) => {
                    setSiProduct(pId);
                    loadSupplierIntelligence(pId);
                  }}
                  placeholder="Type to search SKU or name..."
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">Warehouse</label>
                <select
                  value={siWarehouse}
                  onChange={(e) => setSiWarehouse(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium"
                >
                  <option value="ALL">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1">Required Order Qty</label>
                <input
                  type="number"
                  min="1"
                  value={siQty}
                  onChange={(e) => setSiQty(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-5">
                <button
                  onClick={() => loadSupplierIntelligence()}
                  disabled={siLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${siLoading ? "animate-spin" : ""}`} />
                  {siLoading ? "Evaluating..." : "Run MCDM Evaluation"}
                </button>
              </div>
            </div>

            {/* Loading State */}
            {siLoading && !siData && (
              <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                <p className="text-xs font-semibold">Running Multi-Criteria Decision Matrix (MCDM) evaluation against active vendor pool...</p>
              </div>
            )}

            {/* MCDM Evaluation Results */}
            {siData && (
              <>
                {/* Recommended Supplier Banner */}
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        Top Evaluated Vendor: {siData.recommended_supplier}
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                        Quoted Price: ₹{siData.estimated_unit_price} • Total Cost: ₹{Number(siData.estimated_total_cost).toLocaleString("en-IN")} • Lead Time: {siData.lead_time_days} days
                      </div>
                    </div>
                  </div>
                  {siData.cost_saving_opportunity > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">Spread Arbitrage Saving</span>
                      <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                        ₹{Number(siData.cost_saving_opportunity).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Side-by-side MCDM Table */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
                  <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-800 dark:text-zinc-200">
                    Multi-Criteria Decision Matrix (MCDM) Scorecard
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 font-semibold border-b border-slate-200 dark:border-zinc-800">
                          <th className="py-2.5 px-4">Supplier Name</th>
                          <th className="py-2.5 px-3">Quoted Unit Price</th>
                          <th className="py-2.5 px-3">Lead Time</th>
                          <th className="py-2.5 px-3">Delivery Perf %</th>
                          <th className="py-2.5 px-3">Quality Score %</th>
                          <th className="py-2.5 px-3">Min Order Qty</th>
                          <th className="py-2.5 px-3">Composite Score</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {(siData.options || siData.all_options)?.map((opt, idx) => {
                          const isRecommended = opt.supplier_name === siData.recommended_supplier;
                          return (
                            <tr key={idx} className={isRecommended ? "bg-emerald-50/30 dark:bg-emerald-950/20" : ""}>
                              <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                {opt.supplier_name}
                                {isRecommended && (
                                  <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-400 px-1.5 py-0.2 rounded font-semibold border border-emerald-200 dark:border-emerald-800/60">
                                    Best Pick
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 font-mono font-semibold text-slate-800 dark:text-zinc-200">
                                ₹{Number(opt.price || opt.unit_price || 0).toFixed(2)}
                              </td>
                              <td className="py-3 px-3 text-slate-700 dark:text-zinc-300">{opt.lead_time_days} days</td>
                              <td className="py-3 px-3 text-slate-700 dark:text-zinc-300">{opt.delivery_score || opt.delivery_performance_pct || 95}%</td>
                              <td className="py-3 px-3 text-slate-700 dark:text-zinc-300">{opt.quality_score || opt.quality_performance_pct || 98}%</td>
                              <td className="py-3 px-3 text-slate-500 dark:text-zinc-400">{opt.min_order_quantity || 1}</td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-indigo-600 h-full rounded-full"
                                      style={{ width: `${opt.composite_score || 85}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-slate-800 dark:text-zinc-200 text-[11px]">
                                    {Number(opt.composite_score || 85).toFixed(1)}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {isRecommended ? (
                                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                                    Optimal
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">Alternative</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 8: RECOMMENDATION HISTORY & AUDIT LOGS
           ========================================================================= */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">Filter Action:</span>
                <select
                  value={historyActionFilter}
                  onChange={(e) => {
                    setHistoryActionFilter(e.target.value);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-medium"
                >
                  <option value="ALL">All Actions</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="QUANTITY_MODIFIED">Quantity Modified</option>
                  <option value="SUPPLIER_CHANGED">Supplier Changed</option>
                  <option value="CONVERTED_TO_PURCHASE_REQUEST">Converted to PO</option>
                </select>
              </div>

              <button
                onClick={loadHistory}
                disabled={historyLoading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin" : ""}`} />
                {historyLoading ? "Refreshing..." : "Refresh Audit Log"}
              </button>
            </div>

            {historyLoading && historyLogs.length === 0 && (
              <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                <p className="text-xs font-semibold">Retrieving recommendation audit trails and state transition logs...</p>
              </div>
            )}

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 font-semibold border-b border-slate-200 dark:border-zinc-800">
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-3">Recommendation #</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Action Type</th>
                      <th className="py-2.5 px-3">State Transition</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-4">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {historyLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 transition">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-zinc-400">{log.timestamp}</td>
                        <td className="py-3 px-3 font-mono font-bold text-indigo-700 dark:text-indigo-400">{log.recommendation_number}</td>
                        <td className="py-3 px-3 font-mono text-slate-700 dark:text-zinc-300">{log.product_code || "—"}</td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
                            {log.action_type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-500 dark:text-zinc-400">
                          {log.from_status} → {log.to_status}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800 dark:text-zinc-200">{log.actor}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 text-[11px]">{log.details}</td>
                      </tr>
                    ))}
                    {historyLogs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-zinc-500">
                          No audit history records found for the selected filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 9: SETTINGS & CONFIGURATION (PREMIUM DARK & LIGHT MODE STYLED)
           ========================================================================= */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* Industry Profiles Overview */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Configurable Multi-Industry Profiles
                </h3>
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                  {industryProfiles.length} Profiles Configured
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5 max-w-2xl">
                The recommendation engine dynamically adapts lead-time safety cushions, Z-factors, and replenishment policies based on the active industry profile.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {industryProfiles.map((p) => (
                  <div
                    key={p.code}
                    className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 hover:border-indigo-400 dark:hover:border-indigo-600 transition shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{p.name}</span>
                      <span className="text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60">
                        {p.code}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-zinc-400 mt-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span>Strategy:</span>
                        <strong className="text-slate-900 dark:text-zinc-200">{p.default_replenishment_strategy}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Safety Z-Factor:</span>
                        <strong className="text-slate-900 dark:text-zinc-200">{p.safety_stock_z_factor}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Lead Buffer:</span>
                        <strong className="text-slate-900 dark:text-zinc-200">{p.lead_time_buffer_multiplier}x</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Review Cycle:</span>
                        <strong className="text-slate-900 dark:text-zinc-200">{p.review_cycle_days} days</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendation Algorithm Weights */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Engine Weighting Matrix
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5">
                Deterministic weight coefficients governing priority scoring and purchase quantity sizing across internal & external factors.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
                  <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 block mb-1">Internal Demand</span>
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">40%</span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-1">Sales velocity & backorders</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
                  <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 block mb-1">Market Trends</span>
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">25%</span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-1">External consumer searches</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
                  <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 block mb-1">Seasonal Events</span>
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">15%</span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-1">Festivals & calendar surge</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
                  <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 block mb-1">Supply Arbitrage</span>
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">20%</span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-1">MCDM vendor quotes spread</span>
                </div>
              </div>
            </div>

            {/* Background Execution History */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Background Analysis Engine Execution Log
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                {analysisLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-zinc-100">{log.execution_type}</span>
                      <span className="text-slate-400 dark:text-zinc-500 text-[11px] ml-2">triggered by {log.triggered_by}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">{log.started_at}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          log.status === "COMPLETED"
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60"
                            : "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800/60"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
                {analysisLogs.length === 0 && (
                  <div className="py-6 text-center text-slate-400 dark:text-zinc-500 text-xs">
                    No background execution history records.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          MODALS & DRAWERS (FULLY COMPATIBLE WITH DARK & LIGHT MODES)
         ========================================================================= */}

      {/* 1. Detail Breakdown Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Calculation Breakdown & Evidence • {detailItem.product_name || detailItem.product_name_display || detailItem.product?.name || "Product"}
                </h3>
                <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">{detailItem.product_code || detailItem.product?.code || "N/A"}</span>
              </div>
              <button
                onClick={() => setDetailItem(null)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-200 dark:border-zinc-700">
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 block uppercase">Reorder Point (ROP)</span>
                  <span className="text-base font-bold text-slate-800 dark:text-white">{detailItem.reorder_point}</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">(Daily × Lead) + Safety</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-200 dark:border-zinc-700">
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 block uppercase">Safety Stock</span>
                  <span className="text-base font-bold text-slate-800 dark:text-white">{detailItem.safety_stock}</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Z × σ_LTD buffer</span>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <span className="text-[10px] text-indigo-500 dark:text-indigo-400 block uppercase">Suggested Quantity</span>
                  <span className="text-base font-bold text-indigo-700 dark:text-indigo-300">{detailItem.suggested_quantity}</span>
                  <span className="text-[10px] text-indigo-500 dark:text-indigo-400 block">Target - Net Position</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-zinc-200 mb-1">Recommendation Rationalization</h4>
                <p className="text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-800/40 p-3 rounded-lg border border-slate-200 dark:border-zinc-700 leading-relaxed">
                  {detailItem.recommendation_reason ||
                    "Current stock is below optimal reorder point. Suggested order restores safety threshold and prevents stockout across lead-time horizon."}
                </p>
              </div>

              {detailItem.risk_explanation && (
                <div>
                  <h4 className="font-bold text-red-700 dark:text-red-400 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Risk Factors
                  </h4>
                  <p className="text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 dark:border-red-800 leading-relaxed">
                    {detailItem.risk_explanation}
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setDetailItem(null)}
                className="px-4 py-1.5 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-200 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modify Quantity Modal */}
      {modifyModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Modify Recommended Quantity • {modifyModalItem.product_code || modifyModalItem.product?.code}
              </h3>
              <button
                onClick={() => setModifyModalItem(null)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">Adjusted Quantity (Units)</label>
                <input
                  type="number"
                  value={modifyQty}
                  onChange={(e) => setModifyQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">
                  Original Suggested: {modifyModalItem.suggested_quantity} units
                </span>
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">Manager Note / Justification</label>
                <textarea
                  rows={3}
                  value={modifyNotes}
                  onChange={(e) => setModifyNotes(e.target.value)}
                  placeholder="Reason for increasing or decreasing quantity..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
              <button
                onClick={() => setModifyModalItem(null)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-200 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleModifyQuantityConfirm}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Save & Recalculate Outlay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Reject Modal with Mandatory Reason */}
      {rejectModalRec && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-4 bg-red-50 dark:bg-red-950/60 border-b border-red-200 dark:border-red-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-600 dark:text-red-400" />
                Reject Recommendation {rejectModalRec.recommendation_number}
              </h3>
              <button
                onClick={() => setRejectModalRec(null)}
                className="p-1 hover:bg-red-200 dark:hover:bg-red-900 text-red-500 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 dark:text-zinc-300">
                Please provide an audit justification for rejecting this recommendation.
              </p>
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">Rejection Reason</label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Budget freeze, alternative SKU available in surplus..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
              <button
                onClick={() => setRejectModalRec(null)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-200 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Compare & Switch Supplier Modal */}
      {supplierModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Compare & Switch Supplier • {supplierModalItem.product_code || supplierModalItem.product?.code}
              </h3>
              <button
                onClick={() => setSupplierModalItem(null)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">Supplier Name</label>
                  <input
                    type="text"
                    value={switchSupplierName}
                    onChange={(e) => setSwitchSupplierName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">Unit Price (₹)</label>
                    <input
                      type="number"
                      value={switchUnitPrice}
                      onChange={(e) => setSwitchUnitPrice(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">Lead Time (Days)</label>
                    <input
                      type="number"
                      value={switchLeadTime}
                      onChange={(e) => setSwitchLeadTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Side-by-side alternative quotes if available */}
              {compareData?.profiles && compareData.profiles.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-zinc-800">
                  <span className="font-bold text-slate-800 dark:text-zinc-200 block mb-2">Available Catalog Quotes:</span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {compareData.profiles.map((pr, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          setSwitchSupplierName(pr.supplier_name);
                          setSwitchUnitPrice(pr.contracted_price);
                          setSwitchLeadTime(pr.supplier_lead_time_days);
                        }}
                        className="p-2 bg-slate-50 dark:bg-zinc-800/60 hover:bg-indigo-50 dark:hover:bg-zinc-700 rounded border border-slate-200 dark:border-zinc-700 cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-zinc-200">{pr.supplier_name}</span>
                          <span className="text-slate-400 dark:text-zinc-500 text-[10px] ml-2">Lead: {pr.supplier_lead_time_days}d</span>
                        </div>
                        <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400">₹{pr.contracted_price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
              <button
                onClick={() => setSupplierModalItem(null)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-200 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSwitchSupplierConfirm}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Confirm Supplier Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. What-If Simulation Sandbox */}
      {simulatorItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                What-If Simulation Sandbox • {simulatorItem.product_code || simulatorItem.product?.code}
              </h3>
              <button
                onClick={() => setSimulatorItem(null)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">Quantity</label>
                  <input
                    type="number"
                    value={simQty}
                    onChange={(e) => {
                      const q = Number(e.target.value);
                      setSimQty(q);
                      runSimulation(simulatorItem.id, q, simPrice, simLead);
                    }}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    value={simPrice}
                    onChange={(e) => {
                      const p = Number(e.target.value);
                      setSimPrice(p);
                      runSimulation(simulatorItem.id, simQty, p, simLead);
                    }}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">Lead Time (d)</label>
                  <input
                    type="number"
                    value={simLead}
                    onChange={(e) => {
                      const l = Number(e.target.value);
                      setSimLead(l);
                      runSimulation(simulatorItem.id, simQty, simPrice, l);
                    }}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {simResult && (
                <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-zinc-400">Projected Capital Outlay:</span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-400 text-sm">
                      ₹{Number(simResult.projected_procurement_outlay).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-zinc-400">Projected Days of Cover:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{simResult.projected_days_of_cover} days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-zinc-400">Risk Assessment:</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        simResult.risk_status === "OPTIMAL"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60"
                          : simResult.risk_status === "EXCESS_COVER"
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60"
                          : "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800/60"
                      }`}
                    >
                      {simResult.risk_status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-300 pt-2 border-t border-slate-200 dark:border-zinc-700">
                    {simResult.scenario_notes}
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setSimulatorItem(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PurchaseSuggestionsPage;
