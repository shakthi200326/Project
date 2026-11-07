import React, { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  Search,
  Plus,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  Warehouse as WarehouseIcon,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Boxes,
  ShieldAlert,
  TrendingDown,
  Layers,
  X,
} from "lucide-react";
import {
  fetchReorderMonitoring,
  fetchWarehouses,
  createReplenishmentPlan,
} from "../services/api";

export function ReorderLevelsPage() {
  const [data, setData] = useState({
    results: [],
    count: 0,
    critical_count: 0,
    reorder_needed_count: 0,
    healthy_count: 0,
  });
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [toastMsg, setToastMsg] = useState("");

  // Replenishment Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [orderQty, setOrderQty] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, whList] = await Promise.all([
        fetchReorderMonitoring(),
        fetchWarehouses(),
      ]);
      setData(res || { results: [], count: 0, critical_count: 0, reorder_needed_count: 0, healthy_count: 0 });
      setWarehouses(whList.results || whList || []);
    } catch (err) {
      console.error("Failed to load reorder data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    const list = data.results || [];
    return list.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesWh =
        warehouseFilter === "ALL" ||
        String(item.warehouse_id) === String(warehouseFilter) ||
        item.warehouse_code === warehouseFilter ||
        item.warehouse_name === warehouseFilter;

      const matchesStatus =
        statusFilter === "ALL" || item.replenishment_status === statusFilter;

      return matchesSearch && matchesWh && matchesStatus;
    });
  }, [data.results, searchTerm, warehouseFilter, statusFilter]);

  const handleOpenPlanModal = (item) => {
    setSelectedItem(item);
    setOrderQty(item.suggested_reorder_qty > 0 ? item.suggested_reorder_qty : (item.reorder_level || 50));
    setShowModal(true);
  };

  const handleConfirmPlan = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      await createReplenishmentPlan({
        product: selectedItem.product_id,
        sku: selectedItem.sku,
        warehouse: selectedItem.warehouse_id,
        current_stock: selectedItem.current_stock,
        reserved_stock: selectedItem.reserved_stock,
        available_stock: selectedItem.available_stock,
        minimum_stock: selectedItem.minimum_stock,
        required_quantity: Number(orderQty),
        status: "Pending",
      });
      showToast(`Replenishment order for ${selectedItem.sku} (${orderQty} ${selectedItem.uom}) initiated.`);
      setShowModal(false);
      loadData();
    } catch (err) {
      showToast("Error initiating replenishment: " + (err.message || "Failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "SKU",
      "Product Name",
      "Warehouse",
      "Current Stock",
      "Available Stock",
      "Safety Stock",
      "Minimum Stock",
      "Reorder Level",
      "Maximum Stock",
      "Lead Time (Days)",
      "Suggested Order Qty",
      "UOM",
      "Status",
    ];
    const rows = filteredItems.map((r) => [
      `"${r.sku}"`,
      `"${r.product_name}"`,
      `"${r.warehouse_name}"`,
      r.current_stock,
      r.available_stock,
      r.safety_stock,
      r.minimum_stock,
      r.reorder_level,
      r.maximum_stock,
      r.lead_time,
      r.suggested_reorder_qty,
      `"${r.uom}"`,
      `"${r.replenishment_status}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reorder_monitoring_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="p-6 space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-xl flex items-center space-x-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Reorder Level & Replenishment
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Stock Control
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time buffer evaluation, safety threshold monitoring, and automated replenishment triggers.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
              Critical Shortage
            </span>
            <ShieldAlert className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-700 dark:text-red-300 mt-2">
            {data.critical_count ?? 0}
          </div>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
            Available stock ≤ configured safety stock
          </p>
        </div>

        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Reorder Needed
            </span>
            <TrendingDown className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-2">
            {data.reorder_needed_count ?? 0}
          </div>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
            Available stock ≤ reorder trigger point
          </p>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Adequate & Healthy
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-2">
            {data.healthy_count ?? 0}
          </div>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
            Sufficient buffer above reorder threshold
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monitored Combinations
            </span>
            <Boxes className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-2">
            {data.count ?? 0}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Active product & warehouse locations
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-1 min-w-[260px] max-w-md items-center relative">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by SKU, product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name || wh.code}
              </option>
            ))}
          </select>

          <div className="flex items-center space-x-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1 bg-slate-50 dark:bg-slate-800">
            {["ALL", "CRITICAL", "REORDER_NEEDED", "HEALTHY"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  statusFilter === st
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                {st === "ALL" ? "All" : st.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reorder Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              <tr>
                <th className="px-4 py-3">Product / SKU</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3 text-right">Current Stock</th>
                <th className="px-4 py-3 text-right">Available Stock</th>
                <th className="px-4 py-3 text-right">Safety Buffer</th>
                <th className="px-4 py-3 text-right">Reorder Level</th>
                <th className="px-4 py-3 text-right">Suggested Order</th>
                <th className="px-4 py-3 text-center">Lead Time</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Calculating replenishment levels from PostgreSQL database...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    No items match the selected reorder filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.product_name}
                      </div>
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {item.sku}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <WarehouseIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.warehouse_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {item.current_stock.toLocaleString()} <span className="text-xs text-slate-400">{item.uom}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span
                        className={
                          item.available_stock <= 0
                            ? "text-red-600 dark:text-red-400 font-bold"
                            : item.available_stock <= item.safety_stock
                            ? "text-red-500"
                            : item.available_stock <= item.reorder_level
                            ? "text-amber-500"
                            : "text-emerald-600 dark:text-emerald-400"
                        }
                      >
                        {item.available_stock.toLocaleString()} {item.uom}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {item.safety_stock} {item.uom}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                      {item.reorder_level} {item.uom}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.suggested_reorder_qty > 0 ? (
                        <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                          +{item.suggested_reorder_qty} {item.uom}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-500">
                      {item.lead_time > 0 ? `${item.lead_time} days` : "Standard"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.replenishment_status === "CRITICAL" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                          Critical
                        </span>
                      ) : item.replenishment_status === "REORDER_NEEDED" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Reorder
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Adequate
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.replenishment_status !== "HEALTHY" ? (
                        <button
                          onClick={() => handleOpenPlanModal(item)}
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center space-x-1 ml-auto"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Initiate Order</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Stock OK</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Replenishment Order Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2 text-emerald-600 mb-2">
              <Sparkles className="w-5 h-5" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Initiate Replenishment Order
              </h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Creating a validated replenishment request for warehouse procurement.
            </p>

            <form onSubmit={handleConfirmPlan} className="space-y-4 text-sm">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedItem.product_name}
                </div>
                <div className="text-xs text-slate-500">
                  SKU: <span className="font-mono text-emerald-600">{selectedItem.sku}</span> | Warehouse: {selectedItem.warehouse_name}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                  <div>Available: <span className="font-semibold">{selectedItem.available_stock}</span></div>
                  <div>Reorder Pt: <span className="font-semibold">{selectedItem.reorder_level}</span></div>
                  <div>Safety Floor: <span className="font-semibold">{selectedItem.safety_stock}</span></div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Required Order Quantity ({selectedItem.uom})
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center space-x-1.5"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Create Replenishment Plan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default ReorderLevelsPage;

