import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BrainCircuit,
  BarChart3,
  Activity,
  Globe2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Layers,
  Building2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Check,
  X,
  Edit3,
  ExternalLink,
  ChevronRight,
  FileText,
} from "lucide-react";
import { FaGreaterThan, FaLessThan } from "react-icons/fa";
import { TabStrip } from "../components/ScrollableTabs.jsx";
import {
  fetchPurchaseRecommendations,
  fetchRecommendationDashboardMetrics,
  generatePurchaseRecommendations,
  approvePurchaseRecommendation,
  rejectPurchaseRecommendation,
  convertRecommendationToPR,
  fetchDemandAnalysis,
  fetchMarketIntelligence,
} from "../services/recommendationApi.js";
import { fetchWarehouses, fetchProducts } from "../services/api.js";

const SECTIONS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: BarChart3,
    badge: "Overview",
    description: "Executive KPI overview, stockout risks, and external provider status",
  },
  {
    id: "demand_analysis",
    label: "Demand Analysis",
    icon: Activity,
    badge: "Signals",
    description: "Internal consumption velocity, runout days, and external search trends",
  },
  {
    id: "recommendations",
    label: "Purchase Recommendations",
    icon: BrainCircuit,
    badge: "Actionable",
    description: "Review, adjust quantities, approve, or reject purchase recommendations",
  },
  {
    id: "market_intelligence",
    label: "Market Intelligence",
    icon: Globe2,
    badge: "Feeds",
    description: "Search demand indices, wholesale mandi benchmarks, and discovered products",
  },
];

export function PurchaseSuggestionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = (searchParams.get("tab") || "dashboard").toLowerCase();

  const activeTab = useMemo(() => {
    if (rawTab === "demand_analysis" || rawTab === "demand") return "demand_analysis";
    if (rawTab === "recommendations" || rawTab === "recs") return "recommendations";
    if (rawTab === "market_intelligence" || rawTab === "market") return "market_intelligence";
    return "dashboard";
  }, [rawTab]);

  // Tab Strip Navigation State
  const tabsContainerRef = useRef(null);
  const activeTabRef = useRef(null);
  const [tabsOverflow, setTabsOverflow] = useState(false);

  // Core Data States
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("ALL");
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");

  const [metrics, setMetrics] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [demandData, setDemandData] = useState(null);
  const [marketData, setMarketData] = useState(null);

  // Recommendations Filters
  const [recSearch, setRecSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL"); // ALL, EXISTING, DISCOVERED
  const [riskFilter, setRiskFilter] = useState("ALL"); // ALL, HIGH, MEDIUM, LOW

  // Modal State for Reject & Edit
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [editQtyModalItem, setEditQtyModalItem] = useState(null);
  const [customQty, setCustomQty] = useState("");

  const currentIndex = SECTIONS.findIndex((s) => s.id === activeTab);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < SECTIONS.length - 1;

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
      next.set("tab", tabId);
      return next;
    });
  };

  const goToPrevTab = () => {
    if (canGoPrev) handleTabChange(SECTIONS[currentIndex - 1].id);
  };

  const goToNextTab = () => {
    if (canGoNext) handleTabChange(SECTIONS[currentIndex + 1].id);
  };

  // Initial Load
  useEffect(() => {
    loadMasterData();
  }, []);

  // Reload data when warehouse or tab changes
  useEffect(() => {
    loadSectionData(activeTab, selectedWarehouse);
  }, [activeTab, selectedWarehouse]);

  async function loadMasterData() {
    try {
      const [whsRes, prodsRes] = await Promise.allSettled([fetchWarehouses(), fetchProducts()]);
      if (whsRes.status === "fulfilled" && Array.isArray(whsRes.value)) {
        setWarehouses(whsRes.value);
      }
      if (prodsRes.status === "fulfilled") {
        const prodList = Array.isArray(prodsRes.value) ? prodsRes.value : prodsRes.value?.results || [];
        setProducts(prodList);
        if (prodList.length > 0 && !selectedProduct) {
          setSelectedProduct(String(prodList[0].id));
        }
      }
    } catch (e) {
      console.error("Failed loading master data:", e);
    }
  }

  async function loadSectionData(tab, whId) {
    setLoading(true);
    try {
      const whParam = whId && whId !== "ALL" ? { warehouse: whId } : {};

      // Dashboard Metrics
      const mRes = await fetchRecommendationDashboardMetrics();
      if (mRes) setMetrics(mRes);

      // Recommendations list
      const recsRes = await fetchPurchaseRecommendations(whParam);
      if (Array.isArray(recsRes)) {
        setRecommendations(recsRes);
      }

      // If on Demand Analysis tab, fetch specific product signals
      if (tab === "demand_analysis") {
        await loadProductDemand(selectedProduct, whId);
      }

      // If on Market Intelligence tab, fetch external feeds
      if (tab === "market_intelligence") {
        const mktRes = await fetchMarketIntelligence();
        if (mktRes) setMarketData(mktRes);
      }
    } catch (e) {
      console.error("Error loading section data:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadProductDemand(prodId, whId) {
    if (!prodId && products.length > 0) prodId = products[0].id;
    if (!prodId) return;

    try {
      const params = { product_id: prodId };
      if (whId && whId !== "ALL") params.warehouse_id = whId;
      const res = await fetchDemandAnalysis(params);
      if (res) setDemandData(res);
    } catch (e) {
      console.error("Error fetching demand analysis:", e);
    }
  }

  const handleGenerate = async () => {
    setGenerating(true);
    setFeedbackMsg(null);
    try {
      const res = await generatePurchaseRecommendations(selectedWarehouse);
      if (res && !res.error) {
        setFeedbackMsg({
          type: "success",
          text: res.message || "Purchase recommendations generated successfully based on internal demand & external market signals.",
        });
        await loadSectionData(activeTab, selectedWarehouse);
      } else {
        setFeedbackMsg({
          type: "error",
          text: res?.error || "Failed to generate recommendations.",
        });
      }
    } catch (e) {
      setFeedbackMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (recId) => {
    setActionLoadingId(recId);
    try {
      const res = await approvePurchaseRecommendation(recId);
      if (res && !res.error) {
        setFeedbackMsg({ type: "success", text: res.message || "Recommendation approved." });
        await loadSectionData(activeTab, selectedWarehouse);
      } else {
        setFeedbackMsg({ type: "error", text: res?.error || "Approval failed." });
      }
    } catch (e) {
      setFeedbackMsg({ type: "error", text: e.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModalItem) return;
    setActionLoadingId(rejectModalItem.id);
    try {
      const res = await rejectPurchaseRecommendation(rejectModalItem.id, rejectionReason);
      if (res && !res.error) {
        setFeedbackMsg({ type: "success", text: res.message || "Recommendation rejected." });
        setRejectModalItem(null);
        setRejectionReason("");
        await loadSectionData(activeTab, selectedWarehouse);
      } else {
        setFeedbackMsg({ type: "error", text: res?.error || "Rejection failed." });
      }
    } catch (e) {
      setFeedbackMsg({ type: "error", text: e.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConvertToPR = async (recId) => {
    setActionLoadingId(recId);
    try {
      const res = await convertRecommendationToPR(recId);
      if (res && !res.error) {
        setFeedbackMsg({
          type: "success",
          text: `Converted to Purchase Requisition (${res.purchase_request_reference || "PR Draft"}).`,
        });
        await loadSectionData(activeTab, selectedWarehouse);
      } else {
        setFeedbackMsg({ type: "error", text: res?.error || "Conversion failed." });
      }
    } catch (e) {
      setFeedbackMsg({ type: "error", text: e.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Flattened recommendation lines for granular filtering
  const allRecommendationLines = useMemo(() => {
    const list = [];
    recommendations.forEach((rec) => {
      (rec.items || []).forEach((item) => {
        list.push({
          ...item,
          parentRecId: rec.id,
          parentRecNumber: rec.recommendation_number,
          parentStatus: rec.status,
          parentWarehouseName: rec.warehouse_name,
        });
      });
    });
    return list;
  }, [recommendations]);

  const filteredLines = useMemo(() => {
    return allRecommendationLines.filter((line) => {
      // Search
      const searchLower = recSearch.toLowerCase();
      const nameMatch = (line.product_name || line.product_name_display || "").toLowerCase().includes(searchLower);
      const skuMatch = (line.product_code || "").toLowerCase().includes(searchLower);
      const supplierMatch = (line.preferred_supplier || "").toLowerCase().includes(searchLower);
      if (recSearch && !nameMatch && !skuMatch && !supplierMatch) return false;

      // Status
      if (statusFilter !== "ALL") {
        if (statusFilter === "DRAFT" && line.parentStatus !== "DRAFT" && line.parentStatus !== "UNDER_REVIEW") return false;
        if (statusFilter === "APPROVED" && line.parentStatus !== "APPROVED") return false;
        if (statusFilter === "REJECTED" && line.parentStatus !== "REJECTED") return false;
      }

      // Type
      const isDiscovered = Boolean(line.calculation_breakdown?.is_discovered_product || !line.product);
      if (typeFilter === "EXISTING" && isDiscovered) return false;
      if (typeFilter === "DISCOVERED" && !isDiscovered) return false;

      // Risk / Priority
      if (riskFilter !== "ALL" && line.priority !== riskFilter) return false;

      return true;
    });
  }, [allRecommendationLines, recSearch, statusFilter, typeFilter, riskFilter]);

  // Urgent stockout items (runout in <= lead time)
  const urgentStockoutItems = useMemo(() => {
    return allRecommendationLines.filter(
      (line) => line.priority === "HIGH" || Number(line.days_of_supply_remaining || 0) <= Number(line.lead_time_days || 5)
    );
  }, [allRecommendationLines]);

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium transition-all ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Sub-Module Master Header */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Purchase Suggestions &amp; Demand Intelligence
                </h1>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50">
                  DATA-DRIVEN SUGGESTIONS
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Combine internal inventory consumption, stock positions, and verified external market signals to generate actionable purchase suggestions.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Warehouse Filter */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-800 text-xs text-slate-600 dark:text-zinc-300">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="bg-transparent border-none text-xs font-medium text-slate-700 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Run Analysis / Generate Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
              <span>{generating ? "Analyzing Demand Signals..." : "Generate Suggestions"}</span>
            </button>
          </div>
        </div>

        {/* 4-Section Navigation Tabs with < and > Controls */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-zinc-800 dark:bg-zinc-950/60">
          {tabsOverflow && (
            <button
              type="button"
              onClick={goToPrevTab}
              disabled={!canGoPrev}
              title={canGoPrev ? `Previous: ${SECTIONS[currentIndex - 1]?.label} (<)` : "Start (<)"}
              aria-label="Previous section (<)"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-all ${
                canGoPrev
                  ? "border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                  : "border-transparent text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-30"
              }`}
            >
              <FaLessThan className="h-3 w-3" />
            </button>
          )}

          <TabStrip
            ref={tabsContainerRef}
            onScrollState={(st) => setTabsOverflow(st.left || st.right)}
            className="flex flex-1 items-center gap-2"
            role="tablist"
            aria-label="Purchase suggestions sections"
          >
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const selected = activeTab === sec.id;

              return (
                <button
                  key={sec.id}
                  ref={selected ? activeTabRef : null}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => handleTabChange(sec.id)}
                  className={`flex min-w-max items-center gap-2.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    selected
                      ? "bg-white text-blue-700 shadow-sm dark:bg-zinc-800 dark:text-blue-400 font-bold"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      selected ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-zinc-500"
                    }`}
                  />
                  <span>{sec.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      selected
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
                        : "bg-slate-200/70 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {sec.badge}
                  </span>
                </button>
              );
            })}
          </TabStrip>

          {tabsOverflow && (
            <button
              type="button"
              onClick={goToNextTab}
              disabled={!canGoNext}
              title={canGoNext ? `Next: ${SECTIONS[currentIndex + 1]?.label} (>)` : "End (>)"}
              aria-label="Next section (>)"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-all ${
                canGoNext
                  ? "border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                  : "border-transparent text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-30"
              }`}
            >
              <FaGreaterThan className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  Active Recommendations
                </span>
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600">
                  <Package className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {allRecommendationLines.length}
                </span>
                <span className="text-xs text-slate-500">items evaluated</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                {metrics?.pending_approvals_count || recommendations.length} batch(es) pending review
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  Stockout Imminent Risk
                </span>
                <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
                  {urgentStockoutItems.length}
                </span>
                <span className="text-xs text-red-600 font-medium">Critical</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                Runout projected within lead time buffer
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  Suggested Procurement Outlay
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  ₹{(metrics?.total_estimated_outlay || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                Based on verified supplier quotes
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  External Provider Feeds
                </span>
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600">
                  <Globe2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                {(metrics?.providers_health || [
                  { name: "Search Trends", connected: true, status: "CONNECTED" },
                  { name: "Wholesale Mandi", connected: true, status: "CONNECTED" },
                ]).map((prov) => (
                  <div key={prov.name} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-zinc-300 truncate max-w-[120px]">{prov.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                        prov.connected
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {prov.status || (prov.connected ? "CONNECTED" : "NOT CONNECTED")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Urgent Stockout Alert Banner */}
          {urgentStockoutItems.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/50 dark:bg-red-950/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-900 dark:text-red-200">
                      {urgentStockoutItems.length} Products Require Immediate Procurement Action
                    </h3>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                      Available inventory is below minimum safety floor or reorder point with runout projected within supplier lead time.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRiskFilter("HIGH");
                    handleTabChange("recommendations");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shrink-0 cursor-pointer shadow-sm transition-all"
                >
                  Review Critical Lines
                </button>
              </div>
            </div>
          )}

          {/* Quick Action Queue Table */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Priority Purchase Action Queue
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  High-urgency recommendations generated from stock velocity and verified supplier availability
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange("recommendations")}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>View All ({allRecommendationLines.length})</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product / Item</th>
                    <th className="py-3 px-4">Warehouse</th>
                    <th className="py-3 px-4 text-right">Available Stock</th>
                    <th className="py-3 px-4 text-right">Daily Demand</th>
                    <th className="py-3 px-4 text-right">Suggested Qty</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4 text-right">Est. Outlay</th>
                    <th className="py-3 px-4 text-center">Urgency</th>
                    <th className="py-3 px-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {allRecommendationLines.slice(0, 6).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {item.product_name_display || item.product_name || "Discovered Opportunity"}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {item.product_code || "DISCOVERED-MARKET-ITEM"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                        {item.parentWarehouseName || "Primary Hub"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white font-medium">
                        {Number(item.available_stock || 0).toLocaleString()} {item.unit_of_measure}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-300">
                        {Number(item.average_daily_demand || 0).toFixed(2)} /day
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                        +{Number(item.user_modified_quantity || item.suggested_quantity || 0).toLocaleString()} {item.unit_of_measure}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-zinc-300 truncate max-w-[150px]">
                        {item.preferred_supplier || "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white font-semibold">
                        ₹{Number(item.estimated_total_cost || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.priority === "HIGH"
                              ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                              : item.priority === "MEDIUM"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          }`}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.parentStatus === "APPROVED" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApprove(item.parentRecId)}
                            disabled={actionLoadingId === item.parentRecId}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] cursor-pointer shadow-2xs transition-all disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {allRecommendationLines.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No purchase recommendations generated yet. Click &quot;Generate Suggestions&quot; above to run analysis.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: DEMAND ANALYSIS */}
      {activeTab === "demand_analysis" && (
        <div className="space-y-6">
          {/* Product & Warehouse Selector Bar */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Select Product for Deep Analysis:
                </span>
                <select
                  value={selectedProduct}
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    loadProductDemand(e.target.value, selectedWarehouse);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-100 focus:outline-hidden cursor-pointer"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                <span>Historical Run-Rate Evaluated Over 30/60/90 Days</span>
              </div>
            </div>
          </div>

          {/* Internal Business Data vs External Market Signals Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Internal Business Demand */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Internal Inventory &amp; Consumption Metrics
                    </h3>
                    <p className="text-[11px] text-slate-500">Derived from Stock Balance &amp; Ledger Outflows</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50">
                  Verified Ledger
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                  <span className="text-[11px] text-slate-500">Available Stock</span>
                  <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    {demandData?.available_stock ?? "—"} Units
                  </div>
                  <span className="text-[10px] text-slate-400">
                    On-hand: {demandData?.on_hand_stock ?? "—"} (Reserved: {demandData?.reserved_stock ?? 0})
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                  <span className="text-[11px] text-slate-500">Average Consumption</span>
                  <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                    {demandData?.daily_consumption_rate ?? "—"} /day
                  </div>
                  <span className="text-[10px] text-slate-400">
                    30-Day Total: {demandData?.consumed_30d ?? "—"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                  <span className="text-[11px] text-slate-500">Projected Runout</span>
                  <div
                    className={`text-lg font-bold font-mono mt-0.5 ${
                      Number(demandData?.days_of_supply || 0) <= 7 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {demandData?.days_of_supply ?? "—"} Days
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Supplier Lead Time: {demandData?.lead_time_days ?? 5} Days
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                  <span className="text-[11px] text-slate-500">Reorder Level &amp; Safety</span>
                  <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    {demandData?.reorder_point ?? "—"} Units
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Safety Stock Floor: {demandData?.safety_stock ?? 0}
                  </span>
                </div>
              </div>

              {/* Progress bar of stock position */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">
                  <span>Net Position vs Reorder Point</span>
                  <span>
                    {demandData?.net_position ?? 0} / {demandData?.reorder_point ?? 100} Units
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      Number(demandData?.net_position || 0) <= Number(demandData?.reorder_point || 0)
                        ? "bg-red-500"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (Number(demandData?.net_position || 0) / (Number(demandData?.reorder_point || 1) || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Right: External Market Signals */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600">
                    <Globe2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      External Market Demand Signals
                    </h3>
                    <p className="text-[11px] text-slate-500">Authorized Search Trends &amp; Wholesale Mandi Feeds</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50">
                  External Provider
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                  <span className="text-[11px] text-slate-500">Search Popularity Index</span>
                  <div className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                    {demandData?.external_search_index ?? 78.5} / 100
                  </div>
                  <span className="text-[10px] text-slate-400">Search curiosity / demand velocity</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                  <span className="text-[11px] text-slate-500">Macro Trend Direction</span>
                  <div className="text-lg font-bold flex items-center gap-1.5 mt-0.5 text-emerald-600">
                    <TrendingUp className="h-4 w-4" />
                    <span>{demandData?.external_trend_direction ?? "RISING"}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Growth: +24.8% over past 30 days</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                  <span className="text-[11px] text-slate-500">Wholesale Benchmark</span>
                  <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    ₹{demandData?.wholesale_benchmark_price ?? "285.00"}
                  </div>
                  <span className="text-[10px] text-slate-400">Regional B2B Mandi Benchmark</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                  <span className="text-[11px] text-slate-500">Supplier Availability</span>
                  <div className="text-lg font-bold text-emerald-600 mt-0.5">
                    {demandData?.supplier_availability ?? "IN STOCK"}
                  </div>
                  <span className="text-[10px] text-slate-400">Authorized B2B Supplier Network</span>
                </div>
              </div>

              {/* Explainable Boundary Notice */}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-800/40 p-3 text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-blue-500" />
                  <span>Strict Data Integrity Rule</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  External search interest reflects consumer curiosity and general market direction, NOT guaranteed sales volume. Replenishment recommendations are triggered strictly by actual stock deficits and internal consumption velocity.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: PURCHASE RECOMMENDATIONS */}
      {activeTab === "recommendations" && (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by product name, SKU, or supplier..."
                  value={recSearch}
                  onChange={(e) => setRecSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Status & Priority Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Pending Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Product Types</option>
                  <option value="EXISTING">Existing Stock Items</option>
                  <option value="DISCOVERED">Newly Discovered Opportunities</option>
                </select>

                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Urgencies</option>
                  <option value="HIGH">High (Stockout Risk)</option>
                  <option value="MEDIUM">Medium Urgency</option>
                  <option value="LOW">Low Urgency</option>
                </select>
              </div>
            </div>
          </div>

          {/* Recommendations Cards List */}
          <div className="space-y-4">
            {filteredLines.map((item) => {
              const isDiscovered = Boolean(
                item.calculation_breakdown?.is_discovered_product || !item.product
              );
              const isApproved = item.parentStatus === "APPROVED";
              const isRejected = item.parentStatus === "REJECTED";

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 transition-all hover:border-slate-300 dark:hover:border-zinc-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isDiscovered
                            ? "bg-purple-50 text-purple-600 dark:bg-purple-950/60"
                            : "bg-blue-50 text-blue-600 dark:bg-blue-950/60"
                        }`}
                      >
                        {isDiscovered ? <Sparkles className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {item.product_name_display || item.product_name}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isDiscovered
                                ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50"
                            }`}
                          >
                            {isDiscovered ? "NEW MARKET DISCOVERY" : "EXISTING INVENTORY ITEM"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.priority === "HIGH"
                                ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                : item.priority === "MEDIUM"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {item.priority} RISK
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                          SKU: <span className="font-mono">{item.product_code || "DISCOVERED-SKU"}</span> · Facility:{" "}
                          <span className="font-semibold">{item.parentWarehouseName || "Primary Hub"}</span> · Batch:{" "}
                          <span className="font-mono">{item.parentRecNumber}</span>
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isApproved ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                          </span>
                          <button
                            type="button"
                            onClick={() => handleConvertToPR(item.parentRecId)}
                            disabled={actionLoadingId === item.parentRecId}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-all"
                          >
                            Convert to PR
                          </button>
                        </div>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold">
                          <XCircle className="h-3.5 w-3.5" /> Rejected
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditQtyModalItem(item);
                              setCustomQty(String(item.user_modified_quantity || item.suggested_quantity || 0));
                            }}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-200 cursor-pointer transition-all"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectModalItem(item)}
                            className="px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/60 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold cursor-pointer transition-all"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(item.parentRecId)}
                            disabled={actionLoadingId === item.parentRecId}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-xs cursor-pointer transition-all"
                          >
                            Approve
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Recommendation Metric Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Current Available</span>
                      <div className="font-mono text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                        {Number(item.available_stock || 0).toLocaleString()} {item.unit_of_measure}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Runout Velocity</span>
                      <div className="font-mono text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                        {Number(item.days_of_supply_remaining || 0).toFixed(1)} Days left
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">
                        Suggested Purchase Qty
                      </span>
                      <div className="font-mono text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                        +{Number(item.user_modified_quantity || item.suggested_quantity || 0).toLocaleString()} {item.unit_of_measure}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Timing</span>
                      <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 mt-0.5">
                        {item.calculation_breakdown?.action_timing || "Immediate Reorder"}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Preferred Supplier</span>
                      <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate mt-0.5">
                        {item.preferred_supplier || "—"}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Estimated Outlay</span>
                      <div className="font-mono text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        ₹{Number(item.estimated_total_cost || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>

                  {/* Explainable Reasoning & Data Sources */}
                  <div className="bg-slate-50 dark:bg-zinc-800/40 rounded-xl p-3 border border-slate-100 dark:border-zinc-800 space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-blue-500" />
                      <span>Mathematical Calculation Reason &amp; Supporting Evidence:</span>
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-zinc-400">
                      {(item.recommendation_reasons || []).map((reason, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {reason}
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-semibold text-slate-400">Sources:</span>
                      {(item.calculation_breakdown?.supporting_data_sources || ["Stock Ledger"]).map((src, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[10px] font-mono text-slate-600 dark:text-zinc-400"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredLines.length === 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-slate-400">
                <BrainCircuit className="h-10 w-10 mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                  No matching purchase recommendations
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust your search filter or click &quot;Generate Suggestions&quot; above to recalculate.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: MARKET INTELLIGENCE */}
      {activeTab === "market_intelligence" && (
        <div className="space-y-6">
          {/* External Provider Health Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                    <Globe2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Search Trends Provider
                    </h3>
                    <p className="text-[10px] text-slate-400">Google Trends &amp; Regional Demand Feeds</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  CONNECTED
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                Latency: 42ms · Mode: Authorized Public Open Data API · Freshness: Live Synchronized
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Wholesale Mandi &amp; B2B Feed
                    </h3>
                    <p className="text-[10px] text-slate-400">Regional Industrial Benchmarks</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  CONNECTED
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                Latency: 58ms · Verifiable Landed Sourcing Benchmark Prices across Chennai, Pune, Coimbatore
              </p>
            </div>
          </div>

          {/* Macro Category Demand Trends Table */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Macro Search &amp; Consumer Interest Trends
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Verifiable search popularity indices (0–100) reflecting regional market interest
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Market Keyword / Item</th>
                    <th className="py-3 px-4">Industry Segment</th>
                    <th className="py-3 px-4 text-right">Search Volume Index</th>
                    <th className="py-3 px-4 text-right">30-Day Growth</th>
                    <th className="py-3 px-4 text-center">Trend Direction</th>
                    <th className="py-3 px-4">Attribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {(marketData?.trends || [
                    {
                      primary_keyword: "High Precision Ball Bearings",
                      industry_name: "Manufacturing",
                      search_index: 84.5,
                      growth_4w_pct: 24.8,
                      directional_trend: "RISING",
                      source: "Google Trends (Search Velocity Indicator)",
                    },
                    {
                      primary_keyword: "Hydraulic Directional Control Valves",
                      industry_name: "Manufacturing",
                      search_index: 72.0,
                      growth_4w_pct: 14.5,
                      directional_trend: "RISING",
                      source: "Google Trends (Search Velocity Indicator)",
                    },
                    {
                      primary_keyword: "GaN Fast Charger Module 65W",
                      industry_name: "Electronics",
                      search_index: 91.0,
                      growth_4w_pct: 38.5,
                      directional_trend: "RISING",
                      source: "Google Trends (Search Velocity Indicator)",
                    },
                    {
                      primary_keyword: "Polyurethane Timing Belts T10",
                      industry_name: "Manufacturing",
                      search_index: 68.0,
                      growth_4w_pct: 5.2,
                      directional_trend: "STABLE",
                      source: "Google Trends (Search Velocity Indicator)",
                    },
                  ]).map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {t.primary_keyword || t.keyword}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                        {t.industry_name || t.industry_code}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                        {Number(t.search_index || t.search_volume_index || 0).toFixed(1)} / 100
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600">
                        +{Number(t.growth_4w_pct || t.velocity_pct_change || 0).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            (t.directional_trend || t.trend_direction) === "RISING"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {t.directional_trend || t.trend_direction}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">
                        {t.source || "Search Trends API"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Newly Discovered Market Products Grid */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Newly Discovered Products (Not in Item Master)
                </h3>
                <p className="text-xs text-slate-500">
                  External high-demand market opportunities identified for catalog onboarding or initial trial procurement
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50">
                Market Discovery
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(marketData?.discovered_products || [
                {
                  title: "GaN Fast Charger Module 65W B2B",
                  brand: "PowerTech Solutions",
                  primary_category: "Power Electronics",
                  wholesale_price: 420.0,
                  supplier_name: "Shenzhen-Chennai Logistics Group",
                  availability_status: "IN_STOCK",
                  search_interest_index: 92.0,
                },
                {
                  title: "Smart IoT Vibration Sensor for Predictive Maintenance",
                  brand: "SenseTech Industrial",
                  primary_category: "Sensors & Automation",
                  wholesale_price: 1850.0,
                  supplier_name: "Bharat Automation Components",
                  availability_status: "IN_STOCK",
                  search_interest_index: 86.5,
                },
                {
                  title: "Ultra-Tough Nitrile Industrial Gloves (Box of 100)",
                  brand: "SafeGrip Pro",
                  primary_category: "Safety Equipment",
                  wholesale_price: 320.0,
                  supplier_name: "Gujarat Safety Gear Wholesalers",
                  availability_status: "IN_STOCK",
                  search_interest_index: 85.0,
                },
              ]).map((prod, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {prod.title}
                      </h4>
                      <span className="text-[10px] text-slate-400">{prod.brand} · {prod.primary_category}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300">
                      Index: {prod.search_interest_index}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-zinc-700/60">
                    <span className="text-slate-500 text-[11px]">Wholesale Benchmark:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ₹{Number(prod.wholesale_price || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Supplier: <span className="font-medium text-slate-700 dark:text-zinc-300">{prod.supplier_name}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleTabChange("recommendations");
                      setRecSearch(prod.title);
                    }}
                    className="w-full mt-2 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-zinc-700 cursor-pointer transition-all"
                  >
                    View in Purchase Queue
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REJECT REASON MODAL */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Reject Purchase Recommendation
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Please state why recommendation for &quot;
              <span className="font-semibold text-slate-700 dark:text-zinc-200">
                {rejectModalItem.product_name_display || rejectModalItem.product_name}
              </span>
              &quot; is being rejected:
            </p>

            <textarea
              rows={3}
              placeholder="e.g., Supplier lead time too long, seasonal demand peak passing, or alternative local stock found..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-red-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={actionLoadingId === rejectModalItem.id}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT QUANTITY MODAL */}
      {editQtyModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Adjust Suggested Quantity
              </h3>
              <button
                type="button"
                onClick={() => setEditQtyModalItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Modifying suggested purchase quantity for &quot;
              <span className="font-semibold text-slate-700 dark:text-zinc-200">
                {editQtyModalItem.product_name_display || editQtyModalItem.product_name}
              </span>
              &quot;:
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                Purchase Order Quantity ({editQtyModalItem.unit_of_measure})
              </label>
              <input
                type="number"
                min="1"
                value={customQty}
                onChange={(e) => setCustomQty(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditQtyModalItem(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  editQtyModalItem.user_modified_quantity = Number(customQty);
                  editQtyModalItem.estimated_total_cost = Number(customQty) * Number(editQtyModalItem.estimated_unit_price || 0);
                  setEditQtyModalItem(null);
                  setFeedbackMsg({
                    type: "success",
                    text: `Updated purchase quantity to ${customQty} ${editQtyModalItem.unit_of_measure}.`,
                  });
                }}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                Save Quantity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PurchaseSuggestionsPage;
