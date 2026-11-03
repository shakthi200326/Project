import React, { useState, useEffect, useMemo } from "react";
import {
  RefreshCw,
  Search,
  Plus,
  Filter,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Warehouse as WarehouseIcon,
  Calendar,
  User,
  Layers,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import {
  fetchCycleCounts,
  createCycleCount,
  generateCycleCountEntries,
  completeCycleCount,
  fetchWarehouses,
  fetchStorageLocations,
  fetchProducts,
} from "@/services/api";

const AUDITOR_USERS = [
  "Sarah Jenkins (Senior Auditor)",
  "Marcus Vance (Inventory Specialist)",
  "Elena Rostova (Warehouse Controller)",
  "David Chen (Lead Auditor)",
  "Operations Admin",
];

export function CycleCountPage() {
  const [cycleCounts, setCycleCounts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [frequencyFilter, setFrequencyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Create Cycle Count Form - Necessary Fields Only
  const [formData, setFormData] = useState({
    count_number: `CYC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    count_date: new Date().toISOString().split("T")[0],
    warehouse: "",
    storage_location: "",
    product: "",
    count_frequency: "Monthly",
    assigned_to: AUDITOR_USERS[0],
    status: "Scheduled",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [cycRes, whRes, locRes, prodRes] = await Promise.all([
        fetchCycleCounts(),
        fetchWarehouses(),
        fetchStorageLocations(),
        fetchProducts(),
      ]);
      setCycleCounts(cycRes.results || cycRes || []);
      setWarehouses(whRes.results || whRes || []);
      setLocations(locRes.results || locRes || []);
      setProducts(prodRes.results || prodRes || []);
    } catch (err) {
      console.error("Failed to load cycle counts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormData({
      count_number: `CYC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      count_date: new Date().toISOString().split("T")[0],
      warehouse: warehouses.length > 0 ? String(warehouses[0].id) : "",
      storage_location: "",
      product: "",
      count_frequency: "Monthly",
      assigned_to: AUDITOR_USERS[0],
      status: "Scheduled",
    });
    setErrorMsg("");
  };

  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.warehouse) {
      setErrorMsg("Warehouse is required.");
      return;
    }
    if (!formData.count_frequency) {
      setErrorMsg("Count Frequency is required.");
      return;
    }
    if (!formData.assigned_to) {
      setErrorMsg("Assigned To is required.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const selWh = warehouses.find((w) => String(w.id) === String(formData.warehouse));
      const selLoc = locations.find((l) => String(l.id) === String(formData.storage_location));
      const selProd = products.find((p) => String(p.id) === String(formData.product));

      const payload = {
        count_number: formData.count_number,
        count_date: formData.count_date,
        warehouse: formData.warehouse,
        warehouse_name: selWh ? selWh.name : "Warehouse",
        storage_location: formData.storage_location || null,
        location_name: selLoc ? selLoc.name : "All Locations",
        product: formData.product || null,
        product_name: selProd ? selProd.name : "All Products",
        sku: selProd ? selProd.code || selProd.sku : "",
        count_frequency: formData.count_frequency,
        assigned_to: formData.assigned_to,
        status: formData.status,
      };

      await createCycleCount(payload);
      setSuccessMsg("Cycle count schedule created successfully.");
      setShowModal(false);
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setErrorMsg(err.message || "Failed to create cycle count.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateEntries = async (cycleId) => {
    setActionLoadingId(cycleId);
    try {
      const res = await generateCycleCountEntries(cycleId);
      setSuccessMsg(res.message || "Count entries generated for this cycle count.");
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      alert("Error generating entries: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCompleteCycle = async (cycleId) => {
    setActionLoadingId(cycleId);
    try {
      await completeCycleCount(cycleId);
      setSuccessMsg("Cycle count marked as Completed.");
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      alert("Error completing cycle count: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered List
  const filteredCounts = useMemo(() => {
    return cycleCounts.filter((c) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !q ||
        (c.count_number && c.count_number.toLowerCase().includes(q)) ||
        (c.warehouse_name && c.warehouse_name.toLowerCase().includes(q)) ||
        (c.product_name && c.product_name.toLowerCase().includes(q)) ||
        (c.assigned_to && c.assigned_to.toLowerCase().includes(q));

      const matchWh =
        warehouseFilter === "ALL" ||
        String(c.warehouse) === String(warehouseFilter) ||
        (c.warehouse_name && c.warehouse_name.toLowerCase() === warehouseFilter.toLowerCase());

      const matchFreq =
        frequencyFilter === "ALL" ||
        String(c.count_frequency).toLowerCase() === frequencyFilter.toLowerCase();

      const matchStatus =
        statusFilter === "ALL" ||
        String(c.status).toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchWh && matchFreq && matchStatus;
    });
  }, [cycleCounts, searchTerm, warehouseFilter, frequencyFilter, statusFilter]);

  // KPIs
  const totalSchedules = cycleCounts.length;
  const inProgress = cycleCounts.filter((c) => c.status === "In Progress").length;
  const scheduled = cycleCounts.filter((c) => c.status === "Scheduled").length;
  const completed = cycleCounts.filter((c) => c.status === "Completed").length;

  const exportCSV = () => {
    const headers = [
      "Count Number",
      "Count Date",
      "Warehouse",
      "Storage Location",
      "Product Scope",
      "Frequency",
      "Assigned To",
      "Status",
    ];
    const rows = filteredCounts.map((c) => [
      c.count_number,
      c.count_date,
      c.warehouse_name,
      c.location_name || "All Locations",
      c.product_name || "All Products",
      c.count_frequency,
      c.assigned_to,
      c.status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((f) => `"${f || ""}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Cycle_Counts_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const availableLocations = useMemo(() => {
    if (!formData.warehouse) return [];
    return locations.filter((l) => String(l.warehouse) === String(formData.warehouse));
  }, [locations, formData.warehouse]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
              <RefreshCw className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Cycle Count
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Count selected products or storage locations regularly on an automated recurring frequency.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Cycle Count
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Total Cycle Counts</span>
            <RefreshCw className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-slate-900 dark:text-white">
            {totalSchedules}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Configured recurring schedules</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">In Progress</span>
            <Clock className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-purple-600 dark:text-purple-400">
            {inProgress}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Active counting batches</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Scheduled</span>
            <Calendar className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-amber-600 dark:text-amber-400">
            {scheduled}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Upcoming counting dates</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Completed Cycles</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-emerald-600 dark:text-emerald-400">
            {completed}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Finalized & archived</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search by count number, warehouse, product, assigned user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border-none text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>

          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border-none text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Frequencies</option>
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border-none text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <button
            onClick={loadData}
            title="Refresh Table"
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Cycle Counts Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-400">
            <thead className="bg-slate-50/80 dark:bg-zinc-800/50 uppercase tracking-wider text-[11px] font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-3.5 px-4">Count Number</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Warehouse</th>
                <th className="py-3.5 px-4">Location Scope</th>
                <th className="py-3.5 px-4">Product Scope</th>
                <th className="py-3.5 px-4">Frequency</th>
                <th className="py-3.5 px-4">Assigned To</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading cycle count schedules...
                  </td>
                </tr>
              ) : filteredCounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No cycle counts match the active criteria.
                  </td>
                </tr>
              ) : (
                filteredCounts.map((c) => (
                  <tr
                    key={c.id || c.count_number}
                    className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {c.count_number}
                    </td>
                    <td className="py-3.5 px-4">{c.count_date}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-zinc-200">
                      {c.warehouse_name}
                    </td>
                    <td className="py-3.5 px-4">
                      {c.location_name || "All Locations"}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 dark:text-zinc-200">
                        {c.product_name || "All Products"}
                      </div>
                      {c.sku && (
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                          {c.sku}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {c.count_frequency}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300 font-medium">
                      {c.assigned_to}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === "Scheduled"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                            : c.status === "In Progress"
                            ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50"
                            : c.status === "Completed"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                            : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.status !== "Completed" && (
                          <button
                            onClick={() => handleGenerateEntries(c.id)}
                            disabled={actionLoadingId === c.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-400 transition-colors"
                          >
                            <ClipboardList className="h-3 w-3" />
                            {actionLoadingId === c.id ? "Generating..." : "Generate Entries"}
                          </button>
                        )}
                        {c.status === "In Progress" && (
                          <button
                            onClick={() => handleCompleteCycle(c.id)}
                            disabled={actionLoadingId === c.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 transition-colors"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Cycle Count Modal - Exactly the 8 Phase 7 fields */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Create Cycle Count Form
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 mx-5 mt-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Count Number (Auto-generated, Required) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Count Number <span className="text-blue-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.count_number}
                    readOnly
                    className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-xl bg-slate-100 dark:bg-zinc-800 border-none text-slate-600 dark:text-zinc-400 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">Auto-generated</span>
                </div>

                {/* 2. Count Date (Date, Required) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Count Date <span className="text-blue-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.count_date}
                    onChange={(e) => setFormData({ ...formData, count_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 3. Warehouse (Dropdown, Required) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse <span className="text-blue-500">*</span>
                  </label>
                  <select
                    value={formData.warehouse}
                    onChange={(e) => setFormData({ ...formData, warehouse: e.target.value, storage_location: "" })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Warehouse...</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Storage Location (Dropdown, Optional) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Storage Location <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={formData.storage_location}
                    onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Locations / Entire Warehouse</option>
                    {availableLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 5. Product (Dropdown, Optional) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Product <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={formData.product}
                    onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Products in Scope</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code || p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. Count Frequency (Dropdown, Required) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Count Frequency <span className="text-blue-500">*</span>
                  </label>
                  <select
                    value={formData.count_frequency}
                    onChange={(e) => setFormData({ ...formData, count_frequency: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 7. Assigned To (User Dropdown, Required) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Assigned To <span className="text-blue-500">*</span>
                  </label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {AUDITOR_USERS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 8. Status (Dropdown, Required) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Status <span className="text-blue-500">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs"
                >
                  {submitting ? "Saving..." : "Save Cycle Count"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CycleCountPage;
