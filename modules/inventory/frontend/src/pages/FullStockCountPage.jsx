import React, { useState, useEffect, useMemo } from "react";
import {
  Boxes,
  Search,
  Plus,
  Filter,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Warehouse as WarehouseIcon,
  ToggleLeft,
  ToggleRight,
  User,
  ClipboardList,
  RefreshCw,
  Layers,
} from "lucide-react";
import {
  fetchFullStockCounts,
  createFullStockCount,
  generateFullStockCountEntries,
  completeFullStockCount,
  fetchWarehouses,
  fetchStorageLocations,
} from "@/services/api";

const LEAD_AUDITORS = [
  "David Chen (Lead Auditor)",
  "Sarah Jenkins (Senior Auditor)",
  "Marcus Vance (Inventory Specialist)",
  "Elena Rostova (Warehouse Controller)",
  "Operations Admin",
];

export function FullStockCountPage() {
  const [fullCounts, setFullCounts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Create Full Count Form - Necessary Fields Only
  const [formData, setFormData] = useState({
    count_number: `FSC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    count_date: new Date().toISOString().split("T")[0],
    warehouse: "",
    include_all_locations: true,
    storage_locations: [],
    assigned_to: LEAD_AUDITORS[0],
    status: "Initiated",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [fRes, whRes, locRes] = await Promise.all([
        fetchFullStockCounts(),
        fetchWarehouses(),
        fetchStorageLocations(),
      ]);
      setFullCounts(fRes.results || fRes || []);
      setWarehouses(whRes.results || whRes || []);
      setLocations(locRes.results || locRes || []);
    } catch (err) {
      console.error("Failed to load full stock counts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormData({
      count_number: `FSC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      count_date: new Date().toISOString().split("T")[0],
      warehouse: warehouses.length > 0 ? String(warehouses[0].id) : "",
      include_all_locations: true,
      storage_locations: [],
      assigned_to: LEAD_AUDITORS[0],
      status: "Initiated",
      notes: "",
    });
    setErrorMsg("");
  };

  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleLocationToggle = (locationId) => {
    setFormData((prev) => {
      const current = [...prev.storage_locations];
      const index = current.indexOf(locationId);
      if (index > -1) {
        current.splice(index, 1);
      } else {
        current.push(locationId);
      }
      return { ...prev, storage_locations: current };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.warehouse) {
      setErrorMsg("Warehouse is required.");
      return;
    }
    if (!formData.include_all_locations && formData.storage_locations.length === 0) {
      setErrorMsg("Please select at least one Storage Location when 'Include All Locations' is turned off.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const selWh = warehouses.find((w) => String(w.id) === String(formData.warehouse));
      const payload = {
        count_number: formData.count_number,
        count_date: formData.count_date,
        warehouse: formData.warehouse,
        warehouse_name: selWh ? selWh.name : "Warehouse",
        include_all_locations: formData.include_all_locations,
        storage_locations: formData.storage_locations,
        assigned_to: formData.assigned_to,
        status: "Initiated",
        notes: formData.notes,
      };

      const res = await createFullStockCount(payload);
      setSuccessMsg("Full stock count initiated. You can now generate count entries.");
      setShowModal(false);
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setErrorMsg(err.message || "Failed to create full stock count.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateEntries = async (fullId) => {
    setActionLoadingId(fullId);
    try {
      const res = await generateFullStockCountEntries(fullId);
      setSuccessMsg(res.message || "Count entries generated across warehouse inventory.");
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      alert("Error generating count entries: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleComplete = async (fullId) => {
    setActionLoadingId(fullId);
    try {
      await completeFullStockCount(fullId);
      setSuccessMsg("Full stock count marked as Completed.");
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      alert("Error completing full stock count: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const availableLocations = useMemo(() => {
    if (!formData.warehouse) return [];
    return locations.filter((l) => String(l.warehouse) === String(formData.warehouse));
  }, [locations, formData.warehouse]);

  // Filtered List
  const filteredCounts = useMemo(() => {
    return fullCounts.filter((c) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !q ||
        (c.count_number && c.count_number.toLowerCase().includes(q)) ||
        (c.warehouse_name && c.warehouse_name.toLowerCase().includes(q)) ||
        (c.assigned_to && c.assigned_to.toLowerCase().includes(q));

      const matchWh =
        warehouseFilter === "ALL" ||
        String(c.warehouse) === String(warehouseFilter) ||
        (c.warehouse_name && c.warehouse_name.toLowerCase() === warehouseFilter.toLowerCase());

      const matchStatus =
        statusFilter === "ALL" ||
        String(c.status).toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchWh && matchStatus;
    });
  }, [fullCounts, searchTerm, warehouseFilter, statusFilter]);

  // KPIs
  const totalAudits = fullCounts.length;
  const activeCounting = fullCounts.filter((c) => c.status === "Counting").length;
  const initiated = fullCounts.filter((c) => c.status === "Initiated").length;
  const completed = fullCounts.filter((c) => c.status === "Completed").length;

  const exportCSV = () => {
    const headers = [
      "Count Number",
      "Count Date",
      "Warehouse",
      "Location Scope",
      "Assigned To",
      "Status",
    ];
    const rows = filteredCounts.map((c) => [
      c.count_number,
      c.count_date,
      c.warehouse_name,
      c.include_all_locations ? "All Storage Locations" : "Selected Locations",
      c.assigned_to,
      c.status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((f) => `"${f || ""}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Full_Stock_Counts_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Full Stock Count
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Perform a complete physical count of all selected inventory across entire warehouse facilities.
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
            Initiate Full Count
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
            <span className="text-xs font-medium">Total Full Audits</span>
            <Boxes className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-slate-900 dark:text-white">
            {totalAudits}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Warehouse-wide audits</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Counting in Progress</span>
            <Clock className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-purple-600 dark:text-purple-400">
            {activeCounting}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Active warehouse teams</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Initiated Audits</span>
            <ClipboardList className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-amber-600 dark:text-amber-400">
            {initiated}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Pending count generation</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Completed & Reconciled</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-emerald-600 dark:text-emerald-400">
            {completed}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Archived to audit history</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search by count number, warehouse, lead auditor..."
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border-none text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Initiated">Initiated</option>
            <option value="Counting">Counting</option>
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

      {/* Full Counts Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-400">
            <thead className="bg-slate-50/80 dark:bg-zinc-800/50 uppercase tracking-wider text-[11px] font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-3.5 px-4">Count Number</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Warehouse</th>
                <th className="py-3.5 px-4">Location Scope</th>
                <th className="py-3.5 px-4">Assigned To</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading full stock count audits...
                  </td>
                </tr>
              ) : filteredCounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No full stock counts match the active criteria.
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
                      {c.include_all_locations ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                          <CheckCircle className="h-3 w-3" /> All Storage Locations
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                          Selected Zones ({c.storage_locations ? c.storage_locations.length : 0})
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300 font-medium">
                      {c.assigned_to}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === "Initiated"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                            : c.status === "Counting"
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
                        {c.status === "Counting" && (
                          <button
                            onClick={() => handleComplete(c.id)}
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

      {/* Create Full Count Modal - Exactly the 7 Phase 7 fields */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Create Full Count Form
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

              {/* 3. Warehouse (Dropdown, Required) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Warehouse <span className="text-blue-500">*</span>
                </label>
                <select
                  value={formData.warehouse}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouse: e.target.value, storage_locations: [] })
                  }
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

              {/* 4. Include All Locations (Toggle, Required) */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block">
                    Include All Locations
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
                    Count across all storage zones, racks, and bins in the selected warehouse
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      include_all_locations: !prev.include_all_locations,
                    }))
                  }
                  className="cursor-pointer text-blue-600 dark:text-blue-400"
                >
                  {formData.include_all_locations ? (
                    <ToggleRight className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-slate-400" />
                  )}
                </button>
              </div>

              {/* 5. Storage Location (Multi-select, Conditional) */}
              {!formData.include_all_locations && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                    Storage Locations <span className="text-blue-500">*</span>
                  </label>
                  <div className="max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 space-y-1">
                    {availableLocations.length === 0 ? (
                      <div className="text-xs text-slate-400 py-2 text-center">
                        No storage locations found for this warehouse.
                      </div>
                    ) : (
                      availableLocations.map((loc) => {
                        const isChecked = formData.storage_locations.includes(loc.id);
                        return (
                          <label
                            key={loc.id}
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-700/50 cursor-pointer text-xs text-slate-700 dark:text-zinc-300"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleLocationToggle(loc.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>
                              {loc.name} ({loc.code})
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* 6. Assigned To (User Dropdown, Required) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Assigned To (Lead Auditor) <span className="text-blue-500">*</span>
                </label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {LEAD_AUDITORS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* 7. Status (Auto-managed, Required) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Status <span className="text-slate-400 font-normal">(Auto-managed)</span>
                </label>
                <input
                  type="text"
                  value={formData.status}
                  readOnly
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-zinc-800 border-none text-slate-600 dark:text-zinc-400 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                  Transitions to Counting once count entries are generated
                </span>
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
                  {submitting ? "Initiating..." : "Initiate Full Count"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FullStockCountPage;
