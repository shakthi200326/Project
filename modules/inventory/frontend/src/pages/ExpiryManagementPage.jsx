import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle,
  Search,
  Filter,
  Download,
  ShieldAlert,
  Hash,
  ArrowRight,
  RefreshCw,
  TrendingDown,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { fetchBatches, fetchWarehouses, fetchProducts } from "@/services/api";

export function ExpiryManagementPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [maxExpiryDate, setMaxExpiryDate] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchRes, prodRes, whRes] = await Promise.all([
        fetchBatches(),
        fetchProducts(),
        fetchWarehouses(),
      ]);
      const list = batchRes.results || batchRes || [];
      // Only batches that have an expiry_date (or all monitored batches)
      setBatches(list.filter((b) => Boolean(b.expiry_date)));
      setProducts(prodRes.results || prodRes || []);
      setWarehouses(whRes.results || whRes || []);
    } catch (err) {
      console.error("Failed to load expiry data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (b.batch_number && b.batch_number.toLowerCase().includes(q)) ||
        (b.product_name && b.product_name.toLowerCase().includes(q)) ||
        (b.sku && b.sku.toLowerCase().includes(q));

      const matchProduct = !productFilter || String(b.product) === String(productFilter) || b.product_name === productFilter;
      const matchWarehouse = !warehouseFilter || String(b.warehouse) === String(warehouseFilter) || b.warehouse_name === warehouseFilter;

      let matchStatus = true;
      if (statusFilter === "Expired") {
        matchStatus = b.expiry_status === "Expired" || (b.days_to_expiry !== null && b.days_to_expiry <= 0);
      } else if (statusFilter === "Expiring Soon") {
        matchStatus =
          b.expiry_status === "Expiring Soon" ||
          (b.days_to_expiry !== null && b.days_to_expiry > 0 && b.days_to_expiry <= 30);
      } else if (statusFilter === "Healthy") {
        matchStatus =
          b.expiry_status === "Healthy" ||
          (b.days_to_expiry !== null && b.days_to_expiry > 30);
      }

      const matchDate = !maxExpiryDate || (b.expiry_date && b.expiry_date <= maxExpiryDate);

      return matchSearch && matchProduct && matchWarehouse && matchStatus && matchDate;
    });
  }, [batches, searchTerm, productFilter, warehouseFilter, statusFilter, maxExpiryDate]);

  // KPIs
  const totalMonitored = batches.length;
  const expiredCount = batches.filter(
    (b) => b.expiry_status === "Expired" || (b.days_to_expiry !== null && b.days_to_expiry <= 0)
  ).length;
  const expiringSoonCount = batches.filter(
    (b) =>
      b.expiry_status === "Expiring Soon" ||
      (b.days_to_expiry !== null && b.days_to_expiry > 0 && b.days_to_expiry <= 30)
  ).length;
  const healthyCount = batches.filter(
    (b) =>
      b.expiry_status === "Healthy" ||
      (b.days_to_expiry !== null && b.days_to_expiry > 30)
  ).length;

  const exportCSV = () => {
    const headers = [
      "Batch Number",
      "Product",
      "SKU",
      "Warehouse",
      "Storage Location",
      "Expiry Date",
      "Remaining Quantity",
      "Days to Expiry",
      "Expiry Status",
    ];
    const rows = filteredBatches.map((b) => [
      b.batch_number || "",
      b.product_name || "",
      b.sku || "",
      b.warehouse_name || b.warehouse || "",
      b.location_name || b.location || "",
      b.expiry_date || "",
      b.remaining_quantity || b.initial_quantity || 0,
      b.days_to_expiry !== undefined ? b.days_to_expiry : "",
      b.expiry_status || "Healthy",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expiry_batches_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (expiryStatus, days) => {
    if (expiryStatus === "Expired" || (days !== null && days !== undefined && days <= 0)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <AlertTriangle className="h-3 w-3" /> Expired
        </span>
      );
    }
    if (expiryStatus === "Expiring Soon" || (days !== null && days !== undefined && days <= 30)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <Clock className="h-3 w-3" /> Expiring Soon
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle className="h-3 w-3" /> Healthy
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
              Expiry Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              FEFO & Lifecycle
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Monitor lot shelf life, prioritize First-Expired First-Out (FEFO), and isolate expired quantities.
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
            to="/inventory/tracking/batches"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <Hash className="h-3.5 w-3.5" />
            Batch Registry
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Monitored Batches</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{totalMonitored}</span>
            <span className="text-xs text-slate-400">With expiry dates</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Healthy Batches</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{healthyCount}</span>
            <span className="text-xs text-slate-400">&gt; 30 days safe</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Expiring Soon (≤30 Days)</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{expiringSoonCount}</span>
            <span className="text-xs text-slate-400">Prioritize picking</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Expired Batches</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{expiredCount}</span>
            <span className="text-xs text-slate-400">Action: Quarantine</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar: Product, Warehouse, Expiry Status, Expiry Date */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search batch # or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.name || w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Expiry Statuses</option>
              <option value="Expiring Soon">Expiring Soon (≤30 Days)</option>
              <option value="Expired">Expired</option>
              <option value="Healthy">Healthy (&gt;30 Days)</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              placeholder="Expiry Date Up To"
              value={maxExpiryDate}
              onChange={(e) => setMaxExpiryDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Exact 9 Fields Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4">Storage Location</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4 text-right">Remaining Quantity</th>
                <th className="py-3 px-4 text-center">Days to Expiry</th>
                <th className="py-3 px-4">Expiry Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading expiration schedules...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No batches found matching expiry criteria.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => {
                  const days = b.days_to_expiry !== undefined ? b.days_to_expiry : null;
                  const isExpired = b.expiry_status === "Expired" || (days !== null && days <= 0);
                  return (
                    <tr key={b.id || b.batch_number} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {b.batch_number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {b.product_name || "Product"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                        {b.sku || "SKU-000"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                        {b.warehouse_name || b.warehouse || "Warehouse"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                        {b.location_name || b.location || "Storage Location"}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-900 dark:text-white">
                        {b.expiry_date}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                        {Number(b.remaining_quantity || b.initial_quantity || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center tabular-nums">
                        {days !== null ? (
                          <span className={`font-semibold ${days <= 0 ? "text-rose-600 dark:text-rose-400 font-bold" : days <= 30 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {days <= 0 ? `${days}d (Past)` : `${days} days`}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(b.expiry_status, days)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isExpired && b.batch_status !== "Quarantined" ? (
                          <Link
                            to={`/inventory/tracking/batch-quarantine?batch=${encodeURIComponent(b.batch_number)}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
                          >
                            <ShieldAlert className="h-3 w-3" /> Quarantine
                          </Link>
                        ) : (
                          <Link
                            to={`/inventory/tracking/batch-movements?batch=${encodeURIComponent(b.batch_number)}`}
                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-block"
                            title="View Movements"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default ExpiryManagementPage;
