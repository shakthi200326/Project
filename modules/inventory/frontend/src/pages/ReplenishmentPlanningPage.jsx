import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  Search,
  Plus,
  Filter,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Warehouse as WarehouseIcon,
  RefreshCw,
  Edit2,
  Check,
  Sparkles,
  ArrowRight,
  Boxes,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  fetchReplenishmentPlans,
  createReplenishmentPlan,
  updateReplenishmentPlan,
  approveReplenishmentPlan,
  generateReplenishmentPlans,
  fetchProducts,
  fetchWarehouses,
  fetchStockLevels,
} from "@/services/api";

export function ReplenishmentPlanningPage() {
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [stockLevels, setStockLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal State (Create / Update Plan)
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form State - Exact Phase 6 fields
  const [formData, setFormData] = useState({
    product: "",
    sku: "",
    warehouse: "",
    current_stock: 0,
    reserved_stock: 0,
    available_stock: 0,
    minimum_stock: 20,
    required_quantity: 50,
    status: "Pending",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [plRes, prRes, whRes, slRes] = await Promise.all([
        fetchReplenishmentPlans(),
        fetchProducts(),
        fetchWarehouses(),
        fetchStockLevels(),
      ]);
      setPlans(plRes.results || plRes || []);
      setProducts(prRes.results || prRes || []);
      setWarehouses(whRes.results || whRes || []);
      setStockLevels(slRes.results || slRes || []);
    } catch (err) {
      console.error("Failed to load replenishment plans", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    const prod = products.find((p) => String(p.id) === String(prodId));
    const sku = prod ? prod.sku || prod.code || "" : "";
    const minStock = prod ? Number(prod.reorder_point || 20) : 20;
    const reorderQty = prod ? Number(prod.reorder_quantity || 50) : 50;

    setFormData((prev) => ({
      ...prev,
      product: prodId,
      sku,
      minimum_stock: minStock,
      required_quantity: reorderQty,
    }));
  };

  const handleRecalculateAvail = (curr, res) => {
    const c = Number(curr || 0);
    const r = Number(res || 0);
    const avail = Math.max(0, c - r);
    setFormData((prev) => ({
      ...prev,
      current_stock: c,
      reserved_stock: r,
      available_stock: avail,
      required_quantity: Math.max(1, (Number(prev.minimum_stock) * 2) - avail),
    }));
  };

  const openCreateModal = () => {
    setEditingId(null);
    const firstP = products[0];
    setFormData({
      product: firstP?.id || "",
      sku: firstP?.sku || firstP?.code || "",
      warehouse: warehouses[0]?.id || "",
      current_stock: 10,
      reserved_stock: 2,
      available_stock: 8,
      minimum_stock: 15,
      required_quantity: 80,
      status: "Pending",
    });
    setErrorMsg("");
    setShowModal(true);
  };

  const openEditModal = (plan) => {
    setEditingId(plan.id);
    setFormData({
      product: plan.product,
      sku: plan.sku || "",
      warehouse: plan.warehouse,
      current_stock: plan.current_stock || 0,
      reserved_stock: plan.reserved_stock || 0,
      available_stock: plan.available_stock || 0,
      minimum_stock: plan.minimum_stock || 0,
      required_quantity: plan.required_quantity || 0,
      status: plan.status || "Pending",
    });
    setErrorMsg("");
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product) {
      setErrorMsg("Product is required.");
      return;
    }
    if (!formData.warehouse) {
      setErrorMsg("Warehouse is required.");
      return;
    }
    if (Number(formData.required_quantity) <= 0) {
      setErrorMsg("Required quantity must be greater than 0.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const payload = {
        product: formData.product,
        sku: formData.sku,
        warehouse: formData.warehouse,
        current_stock: Number(formData.current_stock),
        reserved_stock: Number(formData.reserved_stock),
        available_stock: Number(formData.available_stock),
        minimum_stock: Number(formData.minimum_stock),
        required_quantity: Number(formData.required_quantity),
        status: formData.status,
      };

      if (editingId) {
        await updateReplenishmentPlan(editingId, payload);
      } else {
        await createReplenishmentPlan(payload);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      setErrorMsg(err.message || "Failed to save replenishment plan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (plan) => {
    try {
      await approveReplenishmentPlan(plan.id);
      setToastMsg(`Plan ${plan.plan_number || "item"} approved and converted to Planned status!`);
      setTimeout(() => setToastMsg(""), 4000);
      loadData();
    } catch (err) {
      console.error("Failed to approve plan", err);
    }
  };

  const handleAutoGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generateReplenishmentPlans();
      setToastMsg(res.message || "Calculated stock requirements against minimum thresholds.");
      setTimeout(() => setToastMsg(""), 4500);
      loadData();
    } catch (err) {
      console.error("Auto generate failed", err);
    } finally {
      setGenerating(false);
    }
  };

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (p.product_name && p.product_name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.plan_number && p.plan_number.toLowerCase().includes(q));

      const matchProduct = !productFilter || String(p.product) === String(productFilter) || p.product_name === productFilter;
      const matchWarehouse = !warehouseFilter || String(p.warehouse) === String(warehouseFilter) || p.warehouse_name === warehouseFilter;
      const matchStatus = !statusFilter || p.status === statusFilter;

      return matchSearch && matchProduct && matchWarehouse && matchStatus;
    });
  }, [plans, searchTerm, productFilter, warehouseFilter, statusFilter]);

  // KPIs
  const totalRequiredUnits = filteredPlans.reduce((sum, p) => sum + Number(p.required_quantity || 0), 0);
  const pendingCount = filteredPlans.filter((p) => p.status === "Pending" || p.status === "PENDING").length;
  const plannedCount = filteredPlans.filter((p) => p.status === "Planned" || p.status === "PLANNED").length;
  const completedCount = filteredPlans.filter((p) => p.status === "Completed" || p.status === "COMPLETED").length;

  const exportCSV = () => {
    const headers = [
      "Plan Number",
      "Product Name",
      "SKU",
      "Warehouse",
      "Current Stock",
      "Reserved Stock",
      "Available Stock",
      "Minimum Stock",
      "Required Quantity",
      "Status",
    ];
    const rows = filteredPlans.map((p) => [
      p.plan_number || "",
      p.product_name || "",
      p.sku || "",
      p.warehouse_name || p.warehouse || "",
      p.current_stock || 0,
      p.reserved_stock || 0,
      p.available_stock || 0,
      p.minimum_stock || 0,
      p.required_quantity || 0,
      p.status || "Pending",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `replenishment_plans_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    const s = String(status || "Pending").toUpperCase();
    if (s === "COMPLETED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="h-3 w-3" /> Completed
        </span>
      );
    }
    if (s === "PLANNED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          <Clock className="h-3 w-3" /> Planned
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-3 w-3" /> Pending
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg("")} className="text-emerald-600 dark:text-emerald-400 hover:opacity-80">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Replenishment Planning
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Demand Sizing
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Identify products that need replenishment and calculate required order quantity based on available stock.
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
          <button
            onClick={handleAutoGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors shadow-xs disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {generating ? "Scanning Stock..." : "Auto-Generate Plans"}
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Plan
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Required Units</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{totalRequiredUnits}</span>
            <span className="text-xs text-slate-400">Units deficit</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Pending Review</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{pendingCount}</span>
            <span className="text-xs text-slate-400">Action: Approve</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Planned (Approved)</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{plannedCount}</span>
            <span className="text-xs text-slate-400">Purchase queued</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Completed Plans</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{completedCount}</span>
            <span className="text-xs text-slate-400">Stock fulfilled</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Product, SKU, or Plan #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Planned">Planned</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Replenishment Details Table - Exactly the 9 Phase 6 fields */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4 text-right">Current Stock</th>
                <th className="py-3 px-4 text-right">Reserved Stock</th>
                <th className="py-3 px-4 text-right">Available Stock</th>
                <th className="py-3 px-4 text-right">Minimum Stock</th>
                <th className="py-3 px-4 text-right">Required Quantity</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Calculating replenishment details...
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No replenishment plans recorded. Click "Auto-Generate Plans" or "Create Plan".
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => {
                  const avail = Number(plan.available_stock || 0);
                  const min = Number(plan.minimum_stock || 0);
                  const isUnderMin = avail <= min;
                  return (
                    <tr key={plan.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {plan.product_name || "Product"}
                        {plan.plan_number && (
                          <span className="block text-[10px] font-mono text-slate-400">{plan.plan_number}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                        {plan.sku || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                        {plan.warehouse_name || plan.warehouse || "Warehouse"}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-slate-900 dark:text-white font-medium">
                        {Number(plan.current_stock || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-amber-600 dark:text-amber-400 font-medium">
                        {Number(plan.reserved_stock || 0)}
                      </td>
                      <td className={`py-3.5 px-4 text-right tabular-nums font-bold ${isUnderMin ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {avail}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-slate-700 dark:text-zinc-300">
                        {min}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-blue-600 dark:text-blue-400">
                        +{Number(plan.required_quantity || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(plan.status)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {plan.status === "Pending" && (
                            <button
                              onClick={() => handleApprove(plan)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                              title="Approve Plan"
                            >
                              <Check className="h-3 w-3" /> Approve
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(plan)}
                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Update Plan"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
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

      {/* Modal: Create / Update Plan Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingId ? "Update Replenishment Plan" : "Create Replenishment Plan"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Calculate deficit using available stock ($Current - Reserved$).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                {/* 1. Product & SKU */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Product <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.product}
                      onChange={handleProductChange}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      SKU (Auto-filled)
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      readOnly
                      placeholder="SKU"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-800/30 text-slate-600 dark:text-zinc-400 font-mono cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* 2. Warehouse */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.warehouse}
                    onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select warehouse...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Current, Reserved, Available Stock */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Current Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.current_stock}
                      onChange={(e) => handleRecalculateAvail(e.target.value, formData.reserved_stock)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Reserved Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reserved_stock}
                      onChange={(e) => handleRecalculateAvail(formData.current_stock, e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Available Stock
                    </label>
                    <input
                      type="number"
                      value={formData.available_stock}
                      readOnly
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-800/30 text-emerald-600 dark:text-emerald-400 font-bold tabular-nums cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* 4. Minimum Stock & Required Quantity */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Minimum Stock <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.minimum_stock}
                      onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Required Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.required_quantity}
                      onChange={(e) => setFormData({ ...formData, required_quantity: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-bold text-blue-600 dark:text-blue-400"
                    />
                  </div>
                </div>

                {/* 5. Status */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Planned">Planned</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingId ? "Update Plan" : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default ReplenishmentPlanningPage;
