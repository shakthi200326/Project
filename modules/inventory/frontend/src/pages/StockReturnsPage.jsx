import React, { useState, useEffect, useMemo } from "react";
import {
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Building2,
  MapPin,
  Tag,
  ShieldCheck,
  CheckCheck,
  Package,
  Layers,
  ArrowRight,
  TrendingDown,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  fetchStockMovements,
  fetchProducts,
  lookupProductByBarcode,
  playScanBeep,
  updateStockTransactionStatus,
} from "../services/api";
import { StockTransactionModal } from "../components/StockTransactionModal.jsx";

const returnAnalyticsData = [
  { day: "Mon", restock: 18, quarantine: 4, scrap: 2, rtv: 6 },
  { day: "Tue", restock: 22, quarantine: 6, scrap: 1, rtv: 5 },
  { day: "Wed", restock: 30, quarantine: 8, scrap: 3, rtv: 9 },
  { day: "Thu", restock: 25, quarantine: 5, scrap: 2, rtv: 7 },
  { day: "Fri", restock: 28, quarantine: 9, scrap: 4, rtv: 11 },
  { day: "Sat", restock: 14, quarantine: 2, scrap: 1, rtv: 3 },
  { day: "Sun", restock: 10, quarantine: 1, scrap: 0, rtv: 2 },
];

export function StockReturnsPage() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [returnTypeFilter, setReturnTypeFilter] = useState("ALL");
  const [conditionFilter, setConditionFilter] = useState("ALL");
  const [dispositionFilter, setDispositionFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [movRes, prodRes] = await Promise.all([
        fetchStockMovements(),
        fetchProducts(),
      ]);
      setMovements(movRes.results || movRes || []);
      setProducts(prodRes.results || prodRes || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReturnPosted = (newTx) => {
    setMovements((prev) => [newTx, ...prev]);
    showToast(`Stock return ${newTx.document_number} recorded successfully.`);
  };

  const handleWorkflowAction = async (tx, action) => {
    try {
      const updated = await updateStockTransactionStatus(tx.id || tx.document_number, action);
      const nextStatus = updated?.status || (
        action === "inspect" ? "INSPECTED" :
        action === "submit" ? "SUBMITTED" : "POSTED"
      );
      setMovements((prev) =>
        prev.map((m) =>
          (m.id === tx.id || m.document_number === tx.document_number)
            ? { ...m, status: nextStatus }
            : m
        )
      );
      showToast(`Stock return ${tx.document_number} transitioned to ${nextStatus}.`);
    } catch (err) {
      showToast(`Failed to update status for ${tx.document_number}.`);
    }
  };

  // Filter only returns
  const returnMovements = useMemo(() => {
    return movements.filter(
      (m) =>
        String(m.type || m.transaction_type || "").toUpperCase() === "RETURN"
    );
  }, [movements]);

  // Compute KPI metrics
  const metrics = useMemo(() => {
    const total = returnMovements.length;
    let customerReturns = 0;
    let supplierReturns = 0;
    let restockedQty = 0;
    let quarantinedQty = 0;
    let totalValue = 0;

    returnMovements.forEach((r) => {
      const isCust = r.return_type !== "Supplier Return";
      if (isCust) customerReturns++;
      else supplierReturns++;

      const qty = Math.abs(Number(r.quantity) || 0);
      const cost = Number(r.unit_cost) || 0;
      totalValue += qty * cost;

      if (r.return_disposition === "Restock") restockedQty += qty;
      else if (r.return_disposition === "Quarantine") quarantinedQty += qty;
    });

    return {
      total,
      customerReturns,
      supplierReturns,
      restockedQty,
      quarantinedQty,
      totalValue,
    };
  }, [returnMovements]);

  // Filter returns based on search and dropdown filters
  const filteredReturns = useMemo(() => {
    return returnMovements.filter((m) => {
      const matchesType =
        returnTypeFilter === "ALL" || m.return_type === returnTypeFilter;
      const matchesCond =
        conditionFilter === "ALL" || m.product_condition === conditionFilter;
      const matchesDisp =
        dispositionFilter === "ALL" || m.return_disposition === dispositionFilter;
      const matchesStat =
        statusFilter === "ALL" || m.status === statusFilter;

      const q = search.trim().toLowerCase();
      if (!q) return matchesType && matchesCond && matchesDisp && matchesStat;

      const matchesSearch =
        m.document_number?.toLowerCase().includes(q) ||
        m.item?.toLowerCase().includes(q) ||
        m.item_code?.toLowerCase().includes(q) ||
        m.party_name?.toLowerCase().includes(q) ||
        m.reference_number?.toLowerCase().includes(q) ||
        m.warehouse_name?.toLowerCase().includes(q);

      return matchesType && matchesCond && matchesDisp && matchesStat && matchesSearch;
    });
  }, [returnMovements, returnTypeFilter, conditionFilter, dispositionFilter, statusFilter, search]);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && search.trim()) {
      const matched = lookupProductByBarcode(search, products);
      if (matched) {
        playScanBeep();
        showToast(`Scanned product: ${matched.name} (${matched.sku})`);
      }
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Return No",
      "Return Date",
      "Return Type",
      "Reference No",
      "Party Name",
      "Product Item",
      "SKU",
      "Warehouse",
      "Storage Location",
      "Return Quantity",
      "UoM",
      "Unit Cost",
      "Condition",
      "Disposition",
      "Status",
      "Remarks",
    ];

    const rows = filteredReturns.map((r) => [
      `"${r.document_number}"`,
      r.transaction_date || (r.created_at ? r.created_at.split("T")[0] : ""),
      r.return_type || "Customer Return",
      `"${r.reference_number || ""}"`,
      `"${r.party_name || ""}"`,
      `"${r.item || ""}"`,
      r.item_code || "",
      `"${r.warehouse_name || r.warehouse || ""}"`,
      `"${r.location || ""}"`,
      Math.abs(r.quantity),
      r.unit || "EA",
      (r.unit_cost || 0).toFixed(2),
      r.product_condition || "Good",
      r.return_disposition || "Restock",
      r.status || "POSTED",
      `"${r.remarks || r.notes || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Stock_Returns_Register_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock Returns exported as CSV.");
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-medium shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600 text-white font-bold shadow-md shadow-purple-500/20">
              <RotateCcw className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Stock Returns & RMA Disposition
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
              Phase 3 Return Movement
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
              Live Audited Ledger
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Record, validate, and process customer and supplier stock returns with product condition auditing and inventory disposition.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs shadow-purple-500/25 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Stock Return</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Total Returns Processed
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {metrics.total}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Valued at <strong className="text-slate-800 dark:text-zinc-200">${metrics.totalValue.toFixed(2)}</strong>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <RotateCcw className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Customer Returns (Restocked)
            </span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {metrics.restockedQty} <span className="text-sm font-normal text-slate-500 dark:text-zinc-400">units</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Restocked into active storage
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Quarantined / Defective
            </span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
              {metrics.quarantinedQty} <span className="text-sm font-normal text-slate-500 dark:text-zinc-400">units</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Held in QA quarantine bay
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Supplier Returns (RTV)
            </span>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
              {metrics.supplierReturns} <span className="text-sm font-normal text-slate-500 dark:text-zinc-400">dispatches</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Returned to vendor authorization
            </div>
          </div>
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <ArrowRight className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Analytics Deck: Return Velocity & Disposition Distribution */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Weekly Return Disposition Flux & Condition Breakdown
              </h3>
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Audited RMA Flux
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
              Daily trend of restocked items, quarantined units, scrap disposals, and return to supplier shipments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs font-mono font-bold text-slate-600 dark:text-zinc-300">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Restock
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ml-2"></span> Quarantine
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500 ml-2"></span> RTV
          </div>
        </div>

        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={returnAnalyticsData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="#64748b" opacity={0.3} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="#64748b" opacity={0.3} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1">
                      <div className="font-semibold text-slate-200">{d.day} Disposition Breakdown</div>
                      <div className="flex justify-between gap-4 text-emerald-400"><span>Restocked:</span><span className="tabular-nums">{d.restock} units</span></div>
                      <div className="flex justify-between gap-4 text-amber-400"><span>Quarantined:</span><span className="tabular-nums">{d.quarantine} units</span></div>
                      <div className="flex justify-between gap-4 text-indigo-400"><span>Return to Supplier:</span><span className="tabular-nums">{d.rtv} units</span></div>
                      <div className="flex justify-between gap-4 text-rose-400"><span>Scrap / Defective:</span><span className="tabular-nums">{d.scrap} units</span></div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="restock" fill="#10b981" radius={[4, 4, 0, 0]} name="Restocked" isAnimationActive={false} />
              <Bar dataKey="quarantine" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Quarantined" isAnimationActive={false} />
              <Bar dataKey="rtv" fill="#6366f1" radius={[4, 4, 0, 0]} name="RTV" isAnimationActive={false} />
              <Line type="monotone" dataKey="restock" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search return #, party name, product SKU, barcode..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-purple-500 font-medium"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Return Type */}
          <select
            value={returnTypeFilter}
            onChange={(e) => setReturnTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
          >
            <option value="ALL">All Return Types</option>
            <option value="Customer Return">Customer Return</option>
            <option value="Supplier Return">Supplier Return</option>
          </select>

          {/* Condition */}
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
          >
            <option value="ALL">All Conditions</option>
            <option value="Good">Good</option>
            <option value="Damaged">Damaged</option>
            <option value="Defective">Defective</option>
          </select>

          {/* Disposition */}
          <select
            value={dispositionFilter}
            onChange={(e) => setDispositionFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
          >
            <option value="ALL">All Dispositions</option>
            <option value="Restock">Restock</option>
            <option value="Quarantine">Quarantine</option>
            <option value="Repair">Repair</option>
            <option value="Scrap">Scrap</option>
            <option value="Return to Supplier">Return to Supplier</option>
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="INSPECTED">Inspected</option>
            <option value="POSTED">Posted</option>
          </select>
        </div>
      </div>

      {/* Returns Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="whitespace-nowrap border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">Return No.</th>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold">Return Type</th>
                <th className="py-3.5 px-4 font-semibold">Party Name & Ref</th>
                <th className="py-3.5 px-4 font-semibold">Product Item & SKU</th>
                <th className="py-3.5 px-4 font-semibold">Warehouse / Location</th>
                <th className="py-3.5 px-4 font-semibold text-right">Return Qty</th>
                <th className="py-3.5 px-4 font-semibold text-center">Condition</th>
                <th className="py-3.5 px-4 font-semibold text-center">Disposition</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No return movements match current filters.
                  </td>
                </tr>
              ) : (
                filteredReturns.map((r) => {
                  const returnQty = Math.abs(Number(r.quantity) || 1);
                  const condition = r.product_condition || "Good";
                  const disposition = r.return_disposition || "Restock";
                  const status = r.status || "POSTED";

                  return (
                    <tr
                      key={r.id || r.document_number}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                          {r.document_number}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-300 whitespace-nowrap">
                        {r.transaction_date || (r.created_at ? r.created_at.split("T")[0] : "")}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            r.return_type === "Supplier Return"
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50"
                              : "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400 border-purple-200 dark:border-purple-900/50"
                          }`}
                        >
                          <RotateCcw className="h-2.5 w-2.5" />
                          {r.return_type || "Customer Return"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {r.party_name || "Midwest Machinery Works"}
                        </div>
                        {r.reference_number && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Ref: {r.reference_number}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {r.item || "Industrial Ball Bearing"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {r.item_code && <span>SKU: {r.item_code} • </span>}
                          {r.batch_number && <span>Batch: {r.batch_number} • </span>}
                          {r.serial_number && <span>SN: {r.serial_number}</span>}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                        <div className="font-medium">
                          {r.warehouse_name || r.warehouse || "Main Central Hub"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {r.location || "Storage Bay"}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                        {returnQty} {r.unit || "EA"}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            condition === "Good"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                              : condition === "Damaged"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900/40"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900/40"
                          }`}
                        >
                          {condition}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            disposition === "Restock"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-900/40"
                              : disposition === "Quarantine"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900/40"
                              : disposition === "Return to Supplier"
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900/40"
                          }`}
                        >
                          {disposition}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            status === "POSTED"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : status === "INSPECTED"
                              ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                              : status === "SUBMITTED"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                              : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {status === "DRAFT" && (
                            <button
                              onClick={() => handleWorkflowAction(r, "submit")}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Submit
                            </button>
                          )}
                          {status === "SUBMITTED" && (
                            <button
                              onClick={() => handleWorkflowAction(r, "inspect")}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Inspect
                            </button>
                          )}
                          {status === "INSPECTED" && (
                            <button
                              onClick={() => handleWorkflowAction(r, "post")}
                              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Post Return
                            </button>
                          )}
                          {status === "POSTED" && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Audited</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phase 3 Stock Return Modal */}
      <StockTransactionModal
        isOpen={isModalOpen}
        initialType="RETURN"
        onClose={() => setIsModalOpen(false)}
        onPosted={handleReturnPosted}
      />
    </div>
  );
}

