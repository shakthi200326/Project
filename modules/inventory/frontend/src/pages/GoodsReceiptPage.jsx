import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowDownLeft,
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
  DollarSign,
  TrendingUp,
  Clock,
  Sparkles,
  Barcode,
  Eye,
  Truck,
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

const inboundVelocityData = [
  { day: "Mon", received: 180, inspected: 175, putaway: 165 },
  { day: "Tue", received: 240, inspected: 230, putaway: 220 },
  { day: "Wed", received: 310, inspected: 295, putaway: 290 },
  { day: "Thu", received: 280, inspected: 275, putaway: 270 },
  { day: "Fri", received: 350, inspected: 340, putaway: 330 },
  { day: "Sat", received: 140, inspected: 135, putaway: 130 },
  { day: "Sun", received: 90, inspected: 90, putaway: 85 },
];

export function GoodsReceiptPage() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
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

  const handleReceiptPosted = (newTx) => {
    setMovements((prev) => [newTx, ...prev]);
    showToast(`Goods Receipt ${newTx.document_number} recorded successfully.`);
  };

  const handleWorkflowAction = async (tx, action) => {
    try {
      const updated = await updateStockTransactionStatus(tx.id || tx.document_number, action);
      const nextStatus = updated?.status || (
        action === "inspect" ? "INSPECTED" :
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
      showToast(`Goods Receipt ${tx.document_number} transitioned to ${nextStatus}.`);
    } catch (err) {
      showToast(`Failed to update status for ${tx.document_number}.`);
    }
  };

  // Filter only receipts
  const receiptMovements = useMemo(() => {
    return movements.filter(
      (m) => String(m.type || m.transaction_type || "").toUpperCase() === "RECEIPT"
    );
  }, [movements]);

  // Compute KPI metrics
  const metrics = useMemo(() => {
    const totalCount = receiptMovements.length;
    let totalQty = 0;
    let totalValue = 0;
    let inspectedCount = 0;

    receiptMovements.forEach((r) => {
      const qty = Math.abs(Number(r.quantity) || 0);
      const cost = Number(r.unit_cost) || 0;
      totalQty += qty;
      totalValue += qty * cost;
      if (r.status === "INSPECTED" || r.status === "APPROVED" || r.status === "POSTED") {
        inspectedCount++;
      }
    });

    const passRate = totalCount > 0 ? ((inspectedCount / totalCount) * 100).toFixed(1) : "98.5";

    return {
      totalCount,
      totalQty,
      totalValue,
      passRate,
    };
  }, [receiptMovements]);

  // Extract suppliers for dropdown
  const uniqueSuppliers = useMemo(() => {
    const s = new Set();
    receiptMovements.forEach((r) => {
      if (r.supplier) s.add(r.supplier);
    });
    return Array.from(s);
  }, [receiptMovements]);

  // Filtered rows
  const filteredReceipts = useMemo(() => {
    return receiptMovements.filter((m) => {
      const matchesSupplier =
        supplierFilter === "ALL" || m.supplier === supplierFilter;
      const matchesWarehouse =
        warehouseFilter === "ALL" ||
        m.warehouse === warehouseFilter ||
        m.warehouse_code === warehouseFilter ||
        m.warehouse_name === warehouseFilter;
      const matchesStatus =
        statusFilter === "ALL" || (m.status || "POSTED") === statusFilter;

      const q = search.trim().toLowerCase();
      if (!q) return matchesSupplier && matchesWarehouse && matchesStatus;

      const matchesSearch =
        m.document_number?.toLowerCase().includes(q) ||
        m.item?.toLowerCase().includes(q) ||
        m.item_code?.toLowerCase().includes(q) ||
        m.supplier?.toLowerCase().includes(q) ||
        m.reference_number?.toLowerCase().includes(q) ||
        m.warehouse_name?.toLowerCase().includes(q) ||
        m.warehouse?.toLowerCase().includes(q);

      return matchesSupplier && matchesWarehouse && matchesStatus && matchesSearch;
    });
  }, [receiptMovements, supplierFilter, warehouseFilter, statusFilter, search]);

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
      "Receipt No",
      "Receipt Date",
      "Supplier",
      "PO / Reference",
      "Product Item",
      "SKU",
      "Warehouse",
      "Storage Location",
      "Received Quantity",
      "Unit Cost",
      "Total Cost",
      "Status",
      "Remarks",
    ];

    const rows = filteredReceipts.map((r) => {
      const qty = Math.abs(r.quantity || 0);
      const cost = Number(r.unit_cost || 0);
      return [
        `"${r.document_number}"`,
        r.transaction_date || (r.created_at ? r.created_at.split("T")[0] : ""),
        `"${r.supplier || "Acme Industrial Supplies"}"`,
        `"${r.reference_number || "PO-2026-001"}"`,
        `"${r.item || ""}"`,
        r.item_code || "",
        `"${r.warehouse_name || r.warehouse || "Main Warehouse"}"`,
        `"${r.location || "Aisle 1 - Bay 2"}"`,
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
      `Goods_Receipts_Register_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Goods Receipts exported as CSV.");
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Goods Receipt (Stock In / GRN)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                  Inbound Logistics
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Record, inspect, and put away incoming stock from purchase orders and vendor deliveries.
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-500/25 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Goods Receipt</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Total Goods Receipts</span>
            <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {metrics.totalCount}
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
              Active GRNs
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Inbound consignments logged in system
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Total Units Received</span>
            <Package className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {metrics.totalQty.toLocaleString()} EA
            </span>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
              In Stock
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Physical units received & booked to inventory
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Received Valuation</span>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              ${metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
              Book Value
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Cumulative financial valuation of receipts
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">QA Pass & Putaway Rate</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {metrics.passRate}%
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
              Verified
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Inbound lots meeting quality compliance
          </p>
        </div>
      </div>

      {/* Analytical Velocity Deck */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              7-Day Inbound Receipts & Inspection Throughput
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                Dock Velocity
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
              Daily comparison between items received at the receiving dock, inspected by QA, and put away into high-bay bins.
            </p>
          </div>
        </div>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={inboundVelocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                          <span>{p.value} EA</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="top" align="right" height={30} iconType="circle" iconSize={8} />
              <Bar dataKey="received" name="Dock Receipts" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="inspected" name="QA Inspected" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="putaway" name="Bin Putaway" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
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
              placeholder="Search GRN #, SKU, Product, Supplier, PO..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium"
            />
          </div>

          {uniqueSuppliers.length > 0 && (
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 font-semibold"
            >
              <option value="ALL">All Suppliers</option>
              {uniqueSuppliers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 font-semibold"
          >
            <option value="ALL">All Destination Warehouses</option>
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
            <option value="INSPECTED">Inspected</option>
            <option value="APPROVED">Approved</option>
            <option value="SUBMITTED">Submitted</option>
          </select>
        </div>

        <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono tabular-nums">
          {filteredReceipts.length} receipts found
        </span>
      </div>

      {/* Receipts Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">GRN No.</th>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold">Supplier / Source</th>
                <th className="py-3.5 px-4 font-semibold">Product & SKU</th>
                <th className="py-3.5 px-4 font-semibold">Destination Storage</th>
                <th className="py-3.5 px-4 font-semibold text-right">Received Qty</th>
                <th className="py-3.5 px-4 font-semibold text-right">Unit Cost</th>
                <th className="py-3.5 px-4 font-semibold text-right">Total Value</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-center">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No goods receipt records match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r) => {
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
                        <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-900/40">
                          {r.document_number}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {r.transaction_date || (r.created_at ? r.created_at.split("T")[0] : "2026-11-03")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {r.supplier || "Acme Industrial Supplies"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Ref: {r.reference_number || "PO-2026-904"}
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
                          {r.location || "Aisle 3 - Rack B"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{qty} {r.unit || "EA"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-zinc-400">
                        ${cost.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ${total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            status === "INSPECTED"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40"
                              : status === "APPROVED" || status === "POSTED"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                              : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {status !== "INSPECTED" && (
                            <button
                              onClick={() => handleWorkflowAction(r, "inspect")}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[10px] font-bold text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                            >
                              Inspect
                            </button>
                          )}
                          {status !== "APPROVED" && (
                            <button
                              onClick={() => handleWorkflowAction(r, "approve")}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                            >
                              Putaway
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
        initialType="RECEIPT"
        lockType={true}
        onClose={() => setIsModalOpen(false)}
        onPosted={handleReceiptPosted}
      />
    </div>
  );
}
