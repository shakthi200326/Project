import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowUpRight,
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
  Clock,
  Sparkles,
  Truck,
  Send,
  User,
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

const outboundVelocityData = [
  { day: "Mon", sales: 110, production: 65, internal: 25 },
  { day: "Tue", sales: 140, production: 80, internal: 30 },
  { day: "Wed", sales: 160, production: 95, internal: 35 },
  { day: "Thu", sales: 190, production: 110, internal: 40 },
  { day: "Fri", sales: 210, production: 120, internal: 45 },
  { day: "Sat", sales: 90, production: 40, internal: 15 },
  { day: "Sun", sales: 60, production: 25, internal: 10 },
];

export function StockIssuePage() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [issueTypeFilter, setIssueTypeFilter] = useState("ALL");
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

  const handleIssuePosted = (newTx) => {
    setMovements((prev) => [newTx, ...prev]);
    showToast(`Stock Issue ${newTx.document_number} dispatched successfully.`);
  };

  const handleWorkflowAction = async (tx, action) => {
    try {
      const updated = await updateStockTransactionStatus(tx.id || tx.document_number, action);
      const nextStatus = updated?.status || (
        action === "dispatch" ? "DISPATCHED" :
        action === "submit" ? "SUBMITTED" :
        action === "approve" ? "APPROVED" : "POSTED"
      );
      setMovements((prev) =>
        prev.map((m) =>
          (m.id === tx.id || m.document_number === tx.document_number)
            ? { ...m, status: nextStatus }
            : m
        )
      );
      showToast(`Stock Issue ${tx.document_number} updated to ${nextStatus}.`);
    } catch (err) {
      showToast(`Failed to update status for ${tx.document_number}.`);
    }
  };

  // Filter only issues
  const issueMovements = useMemo(() => {
    return movements.filter(
      (m) => String(m.type || m.transaction_type || "").toUpperCase() === "ISSUE"
    );
  }, [movements]);

  // Compute KPI metrics
  const metrics = useMemo(() => {
    const totalCount = issueMovements.length;
    let totalQty = 0;
    let totalValue = 0;
    let dispatchedCount = 0;

    issueMovements.forEach((r) => {
      const qty = Math.abs(Number(r.quantity) || 0);
      const cost = Number(r.unit_cost) || 0;
      totalQty += qty;
      totalValue += qty * cost;
      if (r.status === "DISPATCHED" || r.status === "APPROVED" || r.status === "POSTED") {
        dispatchedCount++;
      }
    });

    const slaRate = totalCount > 0 ? ((dispatchedCount / totalCount) * 100).toFixed(1) : "99.2";

    return {
      totalCount,
      totalQty,
      totalValue,
      slaRate,
    };
  }, [issueMovements]);

  // Extract issue types
  const uniqueIssueTypes = useMemo(() => {
    const s = new Set();
    issueMovements.forEach((r) => {
      if (r.issue_type) s.add(r.issue_type);
    });
    return Array.from(s);
  }, [issueMovements]);

  // Filtered rows
  const filteredIssues = useMemo(() => {
    return issueMovements.filter((m) => {
      const matchesType =
        issueTypeFilter === "ALL" || m.issue_type === issueTypeFilter;
      const matchesWarehouse =
        warehouseFilter === "ALL" ||
        m.warehouse === warehouseFilter ||
        m.warehouse_code === warehouseFilter ||
        m.warehouse_name === warehouseFilter;
      const matchesStatus =
        statusFilter === "ALL" || (m.status || "POSTED") === statusFilter;

      const q = search.trim().toLowerCase();
      if (!q) return matchesType && matchesWarehouse && matchesStatus;

      const matchesSearch =
        m.document_number?.toLowerCase().includes(q) ||
        m.item?.toLowerCase().includes(q) ||
        m.item_code?.toLowerCase().includes(q) ||
        m.issued_to?.toLowerCase().includes(q) ||
        m.issue_type?.toLowerCase().includes(q) ||
        m.reference_number?.toLowerCase().includes(q) ||
        m.warehouse_name?.toLowerCase().includes(q) ||
        m.warehouse?.toLowerCase().includes(q);

      return matchesType && matchesWarehouse && matchesStatus && matchesSearch;
    });
  }, [issueMovements, issueTypeFilter, warehouseFilter, statusFilter, search]);

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
      "Issue No",
      "Issue Date",
      "Issue Type",
      "Issued To",
      "Reference No",
      "Product Item",
      "SKU",
      "Source Warehouse",
      "Storage Location",
      "Issued Quantity",
      "Unit Cost",
      "Total Value",
      "Status",
      "Remarks",
    ];

    const rows = filteredIssues.map((r) => {
      const qty = Math.abs(r.quantity || 0);
      const cost = Number(r.unit_cost || 0);
      return [
        `"${r.document_number}"`,
        r.transaction_date || (r.created_at ? r.created_at.split("T")[0] : ""),
        `"${r.issue_type || "Production"}"`,
        `"${r.issued_to || "Assembly Line 1"}"`,
        `"${r.reference_number || "WO-2026-102"}"`,
        `"${r.item || ""}"`,
        r.item_code || "",
        `"${r.warehouse_name || r.warehouse || "Main Warehouse"}"`,
        `"${r.location || "Aisle 2 - Shelf 4"}"`,
        qty,
        cost.toFixed(2),
        (qty * cost).toFixed(2),
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
      `Stock_Issues_Register_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock Issues exported as CSV.");
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md shadow-rose-500/20">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Stock Issue (Stock Out / GIN)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                  Outbound Fulfillment
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Issue and dispatch materials for customer orders, production work orders, departmental consumption, and scrap.
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs shadow-rose-500/25 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Stock Issue</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Total Stock Issues</span>
            <ArrowUpRight className="h-4 w-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {metrics.totalCount}
            </span>
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
              Active GINs
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Dispatched issues registered in ledger
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Total Units Issued</span>
            <Package className="h-4 w-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {metrics.totalQty.toLocaleString()} EA
            </span>
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
              Dispatched
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Physical items deducted from stock
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Issued Valuation</span>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              ${metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
              Cost of Issues
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            COGS / consumption value issued
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Fulfillment On-Time SLA</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {metrics.slaRate}%
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
              Compliant
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Dispatches fulfilled within pick window
          </p>
        </div>
      </div>

      {/* Analytical Velocity Deck */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              7-Day Outbound Issue Velocity by Channel
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
                Outflow Trends
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
              Daily breakdown of inventory issued to customer sales orders, factory production lines, and departmental use.
            </p>
          </div>
        </div>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={outboundVelocityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis width="auto" tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/95 text-white shadow-xl text-xs space-y-1">
                      <span className="font-bold text-slate-300">{label}</span>
                      {payload.map((p) => (
                        <div key={p.name} className="flex justify-between gap-4 font-mono text-[11px]">
                          <span style={{ color: p.color }}>{p.name}:</span>
                          <span>{p.value} EA</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="top" align="right" height={30} iconType="circle" iconSize={8} />
              <Bar dataKey="sales" name="Sales Dispatch" fill="#f43f5e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="production" name="Production Staging" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Line type="monotone" dataKey="internal" name="Internal Consumption" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
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
              placeholder="Search GIN #, SKU, Product, Recipient, Order #..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-rose-500 font-medium"
            />
          </div>

          <select
            value={issueTypeFilter}
            onChange={(e) => setIssueTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 font-semibold"
          >
            <option value="ALL">All Issue Types</option>
            <option value="Sales">Sales Order</option>
            <option value="Production">Production Line</option>
            <option value="Internal Consumption">Internal Use</option>
            <option value="Scrap">Scrap / Dispose</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 font-semibold"
          >
            <option value="ALL">All Source Warehouses</option>
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
            <option value="DISPATCHED">Dispatched</option>
            <option value="SUBMITTED">Submitted</option>
          </select>
        </div>

        <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono tabular-nums">
          {filteredIssues.length} issues found
        </span>
      </div>

      {/* Issues Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="whitespace-nowrap border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">GIN No.</th>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold">Purpose & Type</th>
                <th className="py-3.5 px-4 font-semibold">Issued To / Recipient</th>
                <th className="py-3.5 px-4 font-semibold">Product & SKU</th>
                <th className="py-3.5 px-4 font-semibold">Source Location</th>
                <th className="py-3.5 px-4 font-semibold text-right">Issued Quantity</th>
                <th className="py-3.5 px-4 font-semibold text-right">Unit Cost</th>
                <th className="py-3.5 px-4 font-semibold text-right">Total Value</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-center">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No stock issue records match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((r) => {
                  const qty = Math.abs(Number(r.quantity) || 0);
                  const cost = Number(r.unit_cost) || 0;
                  const total = qty * cost;
                  const status = r.status || "POSTED";

                  return (
                    <tr
                      key={r.id || r.document_number}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-900/40">
                          {r.document_number}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {r.transaction_date || (r.created_at ? r.created_at.split("T")[0] : "2026-11-03")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {r.issue_type || "Production"}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Ref: {r.reference_number || "WO-2026-501"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{r.issued_to || "Assembly Line 1"}</span>
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
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-700 dark:text-zinc-300">
                          {r.warehouse_name || r.warehouse || "Main Warehouse"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {r.location || "Aisle 2 - Shelf 4"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          -{qty} {r.unit || "EA"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-slate-600 dark:text-zinc-400">
                        ${cost.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white">
                        ${total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            status === "DISPATCHED"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40"
                              : status === "SUBMITTED"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {status !== "DISPATCHED" && (
                            <button
                              onClick={() => handleWorkflowAction(r, "dispatch")}
                              className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                            >
                              Dispatch
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
        initialType="ISSUE"
        onClose={() => setIsModalOpen(false)}
        onPosted={handleIssuePosted}
      />
    </div>
  );
}
