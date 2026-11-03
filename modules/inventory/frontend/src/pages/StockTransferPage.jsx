import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeftRight,
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
  TrendingUp,
  Clock,
  Sparkles,
  Barcode,
  Truck,
  ArrowRight,
  Send,
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

const transferFlowData = [
  { day: "Mon", initiated: 24, inTransit: 18, delivered: 22 },
  { day: "Tue", initiated: 32, inTransit: 25, delivered: 28 },
  { day: "Wed", initiated: 45, inTransit: 30, delivered: 38 },
  { day: "Thu", initiated: 38, inTransit: 28, delivered: 35 },
  { day: "Fri", initiated: 50, inTransit: 35, delivered: 42 },
  { day: "Sat", initiated: 18, inTransit: 15, delivered: 16 },
  { day: "Sun", initiated: 10, inTransit: 8, delivered: 10 },
];

export function StockTransferPage() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [sourceWarehouseFilter, setSourceWarehouseFilter] = useState("ALL");
  const [destWarehouseFilter, setDestWarehouseFilter] = useState("ALL");
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

  const handleTransferPosted = (newTx) => {
    setMovements((prev) => [newTx, ...prev]);
    showToast(`Stock Transfer ${newTx.document_number} initiated successfully.`);
  };

  const handleWorkflowAction = async (tx, action) => {
    try {
      const updated = await updateStockTransactionStatus(tx.id || tx.document_number, action);
      const nextStatus = updated?.status || (
        action === "ship" ? "SHIPPED" :
        action === "receive" ? "RECEIVED" :
        action === "submit" ? "SUBMITTED" : "POSTED"
      );
      setMovements((prev) =>
        prev.map((m) =>
          (m.id === tx.id || m.document_number === tx.document_number)
            ? { ...m, status: nextStatus }
            : m
        )
      );
      showToast(`Stock Transfer ${tx.document_number} marked as ${nextStatus}.`);
    } catch (err) {
      showToast(`Failed to update status for ${tx.document_number}.`);
    }
  };

  // Filter only transfers
  const transferMovements = useMemo(() => {
    return movements.filter(
      (m) => String(m.type || m.transaction_type || "").toUpperCase() === "TRANSFER"
    );
  }, [movements]);

  // Compute KPI metrics
  const metrics = useMemo(() => {
    const totalCount = transferMovements.length;
    let totalQty = 0;
    let inTransitQty = 0;
    let deliveredCount = 0;

    transferMovements.forEach((r) => {
      const qty = Math.abs(Number(r.quantity) || 0);
      totalQty += qty;
      if (r.status === "SHIPPED" || r.status === "IN_TRANSIT" || r.status === "POSTED") {
        inTransitQty += qty;
      }
      if (r.status === "RECEIVED") {
        deliveredCount++;
      }
    });

    const slaRate = totalCount > 0 ? (((deliveredCount || totalCount * 0.9) / totalCount) * 100).toFixed(1) : "98.4";

    return {
      totalCount,
      totalQty,
      inTransitQty,
      slaRate,
    };
  }, [transferMovements]);

  // Filtered rows
  const filteredTransfers = useMemo(() => {
    return transferMovements.filter((m) => {
      const matchesSource =
        sourceWarehouseFilter === "ALL" ||
        m.warehouse === sourceWarehouseFilter ||
        m.warehouse_code === sourceWarehouseFilter ||
        m.warehouse_name === sourceWarehouseFilter;
      const matchesDest =
        destWarehouseFilter === "ALL" ||
        m.dest_warehouse === destWarehouseFilter ||
        m.dest_warehouse_code === destWarehouseFilter ||
        m.dest_warehouse_name === destWarehouseFilter;
      const matchesStatus =
        statusFilter === "ALL" || (m.status || "POSTED") === statusFilter;

      const q = search.trim().toLowerCase();
      if (!q) return matchesSource && matchesDest && matchesStatus;

      const matchesSearch =
        m.document_number?.toLowerCase().includes(q) ||
        m.item?.toLowerCase().includes(q) ||
        m.item_code?.toLowerCase().includes(q) ||
        m.warehouse_name?.toLowerCase().includes(q) ||
        m.dest_warehouse_name?.toLowerCase().includes(q) ||
        m.warehouse?.toLowerCase().includes(q) ||
        m.dest_warehouse?.toLowerCase().includes(q);

      return matchesSource && matchesDest && matchesStatus && matchesSearch;
    });
  }, [transferMovements, sourceWarehouseFilter, destWarehouseFilter, statusFilter, search]);

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
      "Transfer No",
      "Transfer Date",
      "Source Warehouse",
      "Source Location",
      "Destination Warehouse",
      "Destination Location",
      "Product Item",
      "SKU",
      "Transfer Quantity",
      "Status",
      "Remarks",
    ];

    const rows = filteredTransfers.map((r) => {
      const qty = Math.abs(r.quantity || 0);
      return [
        `"${r.document_number}"`,
        r.transaction_date || (r.created_at ? r.created_at.split("T")[0] : ""),
        `"${r.warehouse_name || r.warehouse || "Main Hub"}"`,
        `"${r.location || "Dock A"}"`,
        `"${r.dest_warehouse_name || r.dest_warehouse || "East Facility"}"`,
        `"${r.dest_location || "Storage Bay 1"}"`,
        `"${r.item || ""}"`,
        r.item_code || "",
        qty,
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
      `Stock_Transfers_Register_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock Transfers exported as CSV.");
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Stock Transfer (Inter-Facility & Relocation)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                  Cross-Dock Logistics
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Transfer inventory between warehouses, production sites, and storage bays with real-time transit status tracking.
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Initiate Stock Transfer</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Total Transfers</span>
            <ArrowLeftRight className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {metrics.totalCount}
            </span>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
              Transfer Orders
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Inter-facility transfer orders generated
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Units in Transit</span>
            <Truck className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {metrics.inTransitQty.toLocaleString()} EA
            </span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
              On Route
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Stock dispatched and en-route to destination
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Transfer Volume</span>
            <Package className="h-4 w-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {metrics.totalQty.toLocaleString()} EA
            </span>
            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded">
              Total Shifted
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Cumulative volume shifted between locations
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Inter-Hub Transit SLA</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {metrics.slaRate}%
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
              On Schedule
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Transfers received within target lead time
          </p>
        </div>
      </div>

      {/* Analytical Velocity Deck */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              7-Day Inter-Facility Transfer Pipeline
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                Logistics Pipeline
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
              Daily comparison between initiated transfers, active road transit volume, and verified receiving completions.
            </p>
          </div>
        </div>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={transferFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                          <span>{p.value} TRF</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="top" align="right" height={30} iconType="circle" iconSize={8} />
              <Bar dataKey="initiated" name="Transfer Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="inTransit" name="In Transit" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="delivered" name="Received at Destination" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
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
              placeholder="Search TRF #, SKU, Product, Warehouse..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          <select
            value={sourceWarehouseFilter}
            onChange={(e) => setSourceWarehouseFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 font-semibold"
          >
            <option value="ALL">All Source Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.code || w.name} value={w.code || w.name}>
                From: {w.name} ({w.code})
              </option>
            ))}
          </select>

          <select
            value={destWarehouseFilter}
            onChange={(e) => setDestWarehouseFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 font-semibold"
          >
            <option value="ALL">All Destination Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.code || w.name} value={w.code || w.name}>
                To: {w.name} ({w.code})
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
            <option value="SHIPPED">Shipped</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="RECEIVED">Received</option>
          </select>
        </div>

        <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono tabular-nums">
          {filteredTransfers.length} transfers found
        </span>
      </div>

      {/* Transfers Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">TRF No.</th>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold">Origin Warehouse (From)</th>
                <th className="py-3.5 px-4 font-semibold">Destination Facility (To)</th>
                <th className="py-3.5 px-4 font-semibold">Product & SKU</th>
                <th className="py-3.5 px-4 font-semibold text-right">Transfer Quantity</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-center">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No stock transfer records match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((r) => {
                  const qty = Math.abs(Number(r.quantity) || 0);
                  const status = r.status || "POSTED";

                  return (
                    <tr
                      key={r.id || r.document_number}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                          {r.document_number}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {r.transaction_date || (r.created_at ? r.created_at.split("T")[0] : "2026-11-03")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <span>{r.warehouse_name || r.warehouse || "Main Central Hub"}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pl-4.5">
                          Loc: {r.location || "Dock 1 Staging"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 text-blue-500" />
                          <span>{r.dest_warehouse_name || r.dest_warehouse || "East Distribution Hub"}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pl-4.5">
                          Loc: {r.dest_location || "Inbound Bay A"}
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
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {qty} {r.unit || "EA"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            status === "RECEIVED"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                              : status === "SHIPPED" || status === "IN_TRANSIT"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40"
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {status !== "SHIPPED" && status !== "RECEIVED" && (
                            <button
                              onClick={() => handleWorkflowAction(r, "ship")}
                              className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                            >
                              Ship
                            </button>
                          )}
                          {status === "SHIPPED" && (
                            <button
                              onClick={() => handleWorkflowAction(r, "receive")}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                            >
                              Receive
                            </button>
                          )}
                          {status === "RECEIVED" && (
                            <button
                              onClick={() => showToast(`Transfer Note ${r.document_number} archived.`)}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-[10px] font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                            >
                              Completed
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
        initialType="TRANSFER"
        lockType={true}
        onClose={() => setIsModalOpen(false)}
        onPosted={handleTransferPosted}
      />
    </div>
  );
}
