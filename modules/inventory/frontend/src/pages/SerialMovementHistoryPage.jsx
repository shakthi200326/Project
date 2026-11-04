import React, { useState, useEffect, useMemo } from "react";
import {
  Activity,
  Search,
  Filter,
  Download,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  RotateCcw,
  RefreshCw,
  Cpu,
  Barcode,
} from "lucide-react";
import { useSearchParams, Link } from "react-router-dom";
import { fetchSerialMovements, fetchProducts } from "@/services/api";

export function SerialMovementHistoryPage() {
  const [searchParams] = useSearchParams();
  const initialSerial = searchParams.get("serial") || "";

  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [serialFilter, setSerialFilter] = useState(initialSerial);
  const [productFilter, setProductFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [movRes, prodRes] = await Promise.all([
        fetchSerialMovements({ serial: serialFilter }),
        fetchProducts(),
      ]);
      setMovements(movRes.results || movRes || []);
      setProducts(prodRes.results || prodRes || []);
    } catch (err) {
      console.error("Failed to load serial movement history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [serialFilter]);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const sFilter = serialFilter.toLowerCase().trim();
      const matchSerial =
        !sFilter ||
        (m.serial_number && m.serial_number.toLowerCase().includes(sFilter)) ||
        (m.document_number && m.document_number.toLowerCase().includes(sFilter));

      const matchProduct =
        !productFilter ||
        String(m.product) === String(productFilter) ||
        (m.product_name && m.product_name === productFilter) ||
        (m.item_name && m.item_name === productFilter);

      const mType = String(m.transaction_type || m.type || "").toUpperCase();
      const matchType = !typeFilter || mType === typeFilter.toUpperCase();

      const txDate = m.transaction_date || (m.created_at ? m.created_at.split("T")[0] : "");
      const matchStart = !startDate || (txDate && txDate >= startDate);
      const matchEnd = !endDate || (txDate && txDate <= endDate);

      return matchSerial && matchProduct && matchType && matchStart && matchEnd;
    });
  }, [movements, serialFilter, productFilter, typeFilter, startDate, endDate]);

  // KPIs
  const totalCount = filteredMovements.length;
  const receiptsCount = filteredMovements.filter((m) => {
    const t = String(m.transaction_type || m.type || "").toUpperCase();
    return t.includes("RECEIPT");
  }).length;
  const issuesCount = filteredMovements.filter((m) => {
    const t = String(m.transaction_type || m.type || "").toUpperCase();
    return t.includes("ISSUE");
  }).length;
  const transfersCount = filteredMovements.filter((m) => {
    const t = String(m.transaction_type || m.type || "").toUpperCase();
    return t.includes("TRANSFER");
  }).length;

  const exportCSV = () => {
    const headers = [
      "Serial Number",
      "Product",
      "Transaction Number",
      "Transaction Type",
      "From Warehouse",
      "To Warehouse",
      "Transaction Date",
      "Serial Status",
    ];
    const rows = filteredMovements.map((m) => [
      m.serial_number || "",
      m.product_name || m.item_name || m.product || "",
      m.transaction_number || m.document_number || "",
      m.transaction_type || m.type || "RECEIPT",
      m.from_warehouse || m.warehouse_name || m.warehouse || "",
      m.to_warehouse || m.destination_warehouse_name || m.destination_warehouse || "—",
      m.transaction_date || (m.created_at ? m.created_at.split("T")[0] : ""),
      m.serial_status || m.status || "Available",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `serial_movements_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeBadge = (type) => {
    const t = String(type || "RECEIPT").toUpperCase();
    if (t.includes("RECEIPT")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <ArrowDownLeft className="h-3 w-3" /> Receipt
        </span>
      );
    }
    if (t.includes("ISSUE")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <ArrowUpRight className="h-3 w-3" /> Issue
        </span>
      );
    }
    if (t.includes("TRANSFER")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          <ArrowLeftRight className="h-3 w-3" /> Transfer
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
        <RotateCcw className="h-3 w-3" /> Return
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Serial Movement History
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Unit Audit Trail
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Track the complete movement history of individual serialized units from the immutable Stock Ledger.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <Link
            to="/inventory/tracking/serials"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <Cpu className="h-3.5 w-3.5" />
            Serial Registry
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Unit Movements</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{totalCount}</span>
            <span className="text-xs text-slate-400">Events</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Receipt Movements</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{receiptsCount}</span>
            <span className="text-xs text-slate-400">Registered</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Issues & Dispatches</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{issuesCount}</span>
            <span className="text-xs text-slate-400">Outbound</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Transfers</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <ArrowLeftRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{transfersCount}</span>
            <span className="text-xs text-slate-400">Internal shifts</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by Serial # or Doc #..."
              value={serialFilter}
              onChange={(e) => setSerialFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.name || p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Movement Types</option>
              <option value="RECEIPT">Receipt</option>
              <option value="ISSUE">Issue</option>
              <option value="TRANSFER">Transfer</option>
              <option value="RETURN">Return</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              placeholder="From Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <input
              type="date"
              placeholder="To Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Movements Table - Exactly the 8 Phase 5 fields */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 dark:border-zinc-800 whitespace-nowrap">
              <tr>
                <th className="py-3 px-4">Serial Number</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Transaction Number</th>
                <th className="py-3 px-4">Transaction Type</th>
                <th className="py-3 px-4">From Warehouse</th>
                <th className="py-3 px-4">To Warehouse</th>
                <th className="py-3 px-4">Transaction Date</th>
                <th className="py-3 px-4">Serial Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading unit movements from Stock Ledger...
                  </td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No serialized movements recorded on the Stock Ledger matching criteria.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m, idx) => (
                  <tr key={m.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <Barcode className="h-3.5 w-3.5 text-slate-400" />
                        {m.serial_number || "—"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {m.product_name || m.item_name || m.product || "Product Unit"}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                        SKU: {m.sku || m.item_code || "SKU-000"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-800 dark:text-zinc-200">
                      {m.transaction_number || m.document_number || "DOC-000"}
                    </td>
                    <td className="py-3.5 px-4">
                      {getTypeBadge(m.transaction_type || m.type)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                      {m.from_warehouse || m.warehouse_name || m.warehouse || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                      {m.to_warehouse || m.destination_warehouse_name || m.destination_warehouse || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400">
                      {m.transaction_date || (m.created_at ? m.created_at.split("T")[0] : "—")}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                        {m.serial_status || m.status || "Available"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default SerialMovementHistoryPage;

