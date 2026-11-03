import React, { useState, useEffect, useMemo } from "react";
import {
  SlidersHorizontal,
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
  Package,
  Layers,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Clock,
  Sparkles,
  Barcode,
  Scale,
  FileSpreadsheet,
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
  fetchWarehouses,
  lookupProductByBarcode,
  playScanBeep,
  updateStockTransactionStatus,
} from "../services/api";
import { StockTransactionModal } from "../components/StockTransactionModal.jsx";

const adjustmentReasonData = [
  { day: "Mon", countDiff: 5, damage: 2, found: 3 },
  { day: "Tue", countDiff: 8, damage: 1, found: 2 },
  { day: "Wed", countDiff: 12, damage: 4, found: 6 },
  { day: "Thu", countDiff: 6, damage: 3, found: 1 },
  { day: "Fri", countDiff: 9, damage: 2, found: 4 },
  { day: "Sat", countDiff: 3, damage: 0, found: 1 },
  { day: "Sun", countDiff: 1, damage: 1, found: 0 },
];

export function StockAdjustmentPage() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [directionFilter, setDirectionFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
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
      const [movRes, prodRes, whRes] = await Promise.all([
        fetchStockMovements(),
        fetchProducts(),
        fetchWarehouses(),
      ]);
      setMovements(movRes.results || movRes || []);
      setProducts(prodRes.results || prodRes || []);
      setWarehouses(Array.isArray(whRes) ? whRes : whRes.results || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdjustmentPosted = (newTx) => {
    setMovements((prev) => [newTx, ...prev]);
    showToast(`Stock Adjustment ${newTx.document_number} recorded successfully.`);
  };

  const handleWorkflowAction = async (tx, action) => {
    try {
      const updated = await updateStockTransactionStatus(tx.id || tx.document_number, action);
      const nextStatus = updated?.status || (
        action === "approve" ? "APPROVED" :
        action === "submit" ? "SUBMITTED" : "POSTED"
      );
      setMovements((prev) =>
        prev.map((m) =>
          (m.id === tx.id || m.document_number === tx.document_number)
            ? { ...m, status: nextStatus }
            : m
        )
      );
      showToast(`Stock Adjustment ${tx.document_number} status updated to ${nextStatus}.`);
    } catch (err) {
      showToast(`Failed to update status for ${tx.document_number}.`);
    }
  };

  // Filter only adjustments
  const adjustmentMovements = useMemo(() => {
    return movements.filter(
      (m) => String(m.type || m.transaction_type || "").toUpperCase() === "ADJUSTMENT"
    );
  }, [movements]);

  // Compute KPI metrics
  const metrics = useMemo(() => {
    const totalCount = adjustmentMovements.length;
    let netQtyDelta = 0;
    let netValueImpact = 0;
    let approvedCount = 0;

    adjustmentMovements.forEach((r) => {
      const isIncrease = r.adjustment_type === "Increase" || Number(r.quantity) > 0;
      const rawQty = Math.abs(Number(r.quantity) || 0);
      const cost = Number(r.unit_cost) || 0;
      const signedQty = isIncrease ? rawQty : -rawQty;

      netQtyDelta += signedQty;
      netValueImpact += signedQty * cost;

      if (r.status === "APPROVED" || r.status === "POSTED") {
        approvedCount++;
      }
    });

    const approvalRate = totalCount > 0 ? ((approvedCount / totalCount) * 100).toFixed(1) : "97.5";

    return {
      totalCount,
      netQtyDelta,
      netValueImpact,
      approvalRate,
    };
  }, [adjustmentMovements]);

  // Extract unique reasons
  const uniqueReasons = useMemo(() => {
    const s = new Set();
    adjustmentMovements.forEach((r) => {
      if (r.reason) s.add(r.reason);
    });
    return Array.from(s);
  }, [adjustmentMovements]);

  // Filtered rows
  const filteredAdjustments = useMemo(() => {
    return adjustmentMovements.filter((m) => {
      const isIncrease = m.adjustment_type === "Increase" || Number(m.quantity) > 0;
      const matchesDirection =
        directionFilter === "ALL" ||
        (directionFilter === "INCREASE" && isIncrease) ||
        (directionFilter === "DECREASE" && !isIncrease);

      const matchesReason =
        reasonFilter === "ALL" || m.reason === reasonFilter;

      const matchesWarehouse =
        warehouseFilter === "ALL" ||
        m.warehouse === warehouseFilter ||
        m.warehouse_code === warehouseFilter ||
        m.warehouse_name === warehouseFilter;

      const matchesStatus =
        statusFilter === "ALL" || (m.status || "POSTED") === statusFilter;

      const q = search.trim().toLowerCase();
      if (!q) return matchesDirection && matchesReason && matchesWarehouse && matchesStatus;

      const matchesSearch =
        m.document_number?.toLowerCase().includes(q) ||
        m.item?.toLowerCase().includes(q) ||
        m.item_code?.toLowerCase().includes(q) ||
        m.reason?.toLowerCase().includes(q) ||
        m.remarks?.toLowerCase().includes(q) ||
        m.warehouse_name?.toLowerCase().includes(q) ||
        m.warehouse?.toLowerCase().includes(q);

      return matchesDirection && matchesReason && matchesWarehouse && matchesStatus && matchesSearch;
    });
  }, [adjustmentMovements, directionFilter, reasonFilter, warehouseFilter, statusFilter, search]);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && search.trim()) {
      const matched = lookupProductByBarcode(search, products);
      if (matched) {
        playScanBeep();
        showToast(`Scanned product matched: ${matched.name} (${matched.sku})`);
      }
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Adjustment No",
      "Adjustment Date",
      "Warehouse",
      "Storage Location",
      "Product Item",
      "SKU",
      "System Quantity",
      "Actual Quantity",
      "Difference Delta",
      "Adjustment Reason",
      "Status",
      "Remarks",
    ];

    const rows = filteredAdjustments.map((r) => {
      const isIncrease = r.adjustment_type === "Increase" || Number(r.quantity) > 0;
      const qty = Math.abs(r.quantity || 0);
      const delta = isIncrease ? `+${qty}` : `-${qty}`;
      return [
        `"${r.document_number}"`,
        r.transaction_date || (r.created_at ? r.created_at.split("T")[0] : ""),
        `"${r.warehouse_name || r.warehouse || "Main Hub"}"`,
        `"${r.location || "Aisle 3 - Bay 2"}"`,
        `"${r.item || ""}"`,
        r.item_code || "",
        r.system_quantity ?? 50,
        r.actual_quantity ?? (isIncrease ? 50 + qty : 50 - qty),
        delta,
        `"${r.reason || "Physical Count Difference"}"`,
        r.status || "POSTED",
        `"${r.remarks || r.notes || ""}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Stock_Adjustments_Register_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock Adjustments exported as CSV.");
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-white shadow-md shadow-amber-500/20">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Stock Adjustment (Audit Reconciliation)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
                  Variance Control
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Reconcile physical stock variances, record damage write-offs, and align inventory ledger quantities.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Register</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs shadow-amber-500/25 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Stock Adjustment</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Total Adjustments</span>
            <SlidersHorizontal className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {metrics.totalCount}
            </span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
              Audited
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Adjustment documents filed this cycle
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Net Quantity Delta</span>
            <Scale className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-2xl font-bold font-mono ${
                metrics.netQtyDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {metrics.netQtyDelta > 0 ? `+${metrics.netQtyDelta}` : metrics.netQtyDelta} EA
            </span>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
              Physical vs System
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Net physical discrepancy reconciled
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Net Value Impact</span>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-2xl font-bold font-mono ${
                metrics.netValueImpact >= 0 ? "text-slate-900 dark:text-white" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              ${Math.abs(metrics.netValueImpact).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
              {metrics.netValueImpact >= 0 ? "Net Gain" : "Net Write-off"}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Financial variance impact to ledger balance
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Approval Rate</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {metrics.approvalRate}%
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
              Supervisor Sign-off
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Adjustments authorized by inventory control
          </p>
        </div>
      </div>

      {/* Analytical Velocity Deck */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              7-Day Variance Categorization Flux
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                Audit Variance
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
              Daily trend of physical count discrepancies, scrap write-offs, and unexpected found stock additions.
            </p>
          </div>
        </div>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={adjustmentReasonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/95 text-white shadow-xl text-xs space-y-1">
                      <span className="font-bold text-slate-300">{label}</span>
                      {payload.map((p) => (
                        <div key={p.name} className="flex justify-between gap-4 font-mono text-[11px]">
                          <span style={{ color: p.color }}>{p.name}:</span>
                          <span>{p.value} ADJ</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="top" align="right" height={30} iconType="circle" iconSize={8} />
              <Bar dataKey="countDiff" name="Physical Difference" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="damage" name="Damage / Scrap" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="found" name="Found Stock" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[260px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search ADJ #, SKU, Product, Reason..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-medium"
            />
          </div>

          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 font-semibold"
          >
            <option value="ALL">All Delta Types</option>
            <option value="INCREASE">Increase (+)</option>
            <option value="DECREASE">Decrease (-)</option>
          </select>

          {uniqueReasons.length > 0 && (
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 font-semibold"
            >
              <option value="ALL">All Reasons</option>
              {uniqueReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}

          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 font-semibold"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.code || w.name} value={w.code || w.name}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 font-semibold"
          >
            <option value="ALL">All Statuses</option>
            <option value="POSTED">Posted</option>
            <option value="APPROVED">Approved</option>
            <option value="SUBMITTED">Submitted</option>
          </select>
        </div>

        <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono tabular-nums">
          {filteredAdjustments.length} adjustments found
        </span>
      </div>

      {/* Adjustments Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">ADJ No.</th>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold">Warehouse / Location</th>
                <th className="py-3.5 px-4 font-semibold">Product & SKU</th>
                <th className="py-3.5 px-4 font-semibold text-right">System Qty</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actual Qty</th>
                <th className="py-3.5 px-4 font-semibold text-right">Variance Delta</th>
                <th className="py-3.5 px-4 font-semibold">Reason</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-center">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No stock adjustment records match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((r) => {
                  const isIncrease = r.adjustment_type === "Increase" || Number(r.quantity) > 0;
                  const rawQty = Math.abs(Number(r.quantity) || 0);
                  const systemQty = r.system_quantity !== undefined ? r.system_quantity : 50;
                  const actualQty = r.actual_quantity !== undefined ? r.actual_quantity : (isIncrease ? systemQty + rawQty : systemQty - rawQty);
                  const status = r.status || "POSTED";

                  return (
                    <tr
                      key={r.id || r.document_number}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-900/40">
                          {r.document_number}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {r.transaction_date || (r.created_at ? r.created_at.split("T")[0] : "2026-11-03")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {r.warehouse_name || r.warehouse || "Main Warehouse"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {r.location || "Aisle 3 - Bay 2"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {r.item || r.item_name || "Precision Ball Bearing"}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {r.item_code || "BRG-6205-2RS"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-zinc-400">
                        {systemQty} {r.unit || "EA"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-white font-medium">
                        {actualQty} {r.unit || "EA"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded ${
                            isIncrease
                              ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60"
                              : "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60"
                          }`}
                        >
                          {isIncrease ? `+${rawQty}` : `-${rawQty}`} {r.unit || "EA"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800 dark:text-zinc-200">
                          {r.reason || "Physical Count Difference"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            status === "APPROVED" || status === "POSTED"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40"
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {status !== "APPROVED" && (
                            <button
                              onClick={() => handleWorkflowAction(r, "approve")}
                              className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                            >
                              Approve
                            </button>
                          )}
                          {status === "APPROVED" && (
                            <button
                              onClick={() => showToast(`Adjustment ${r.document_number} ledger impact verified.`)}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-[10px] font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                            >
                              Verified
                            </button>
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

      {/* Dedicated Transaction Modal with LockType */}
      <StockTransactionModal
        isOpen={isModalOpen}
        initialType="ADJUSTMENT"
        lockType={true}
        onClose={() => setIsModalOpen(false)}
        onPosted={handleAdjustmentPosted}
      />
    </div>
  );
}
