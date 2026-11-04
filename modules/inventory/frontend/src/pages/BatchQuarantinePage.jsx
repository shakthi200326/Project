import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Plus,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  Warehouse as WarehouseIcon,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  fetchBatches,
  fetchBatchQuarantines,
  quarantineBatch,
  fetchWarehouses,
  fetchLocations,
} from "@/services/api";

export function BatchQuarantinePage() {
  const [searchParams] = useSearchParams();
  const preselectedBatch = searchParams.get("batch") || "";
  const navigate = useNavigate();

  const [batches, setBatches] = useState([]);
  const [quarantineRecords, setQuarantineRecords] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(Boolean(preselectedBatch));
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");

  // Exact 8 Quarantine Form fields
  const [formData, setFormData] = useState({
    batch_number: preselectedBatch,
    batch_id: "",
    product: "",
    warehouse: "",
    storage_location: "",
    quarantine_quantity: "",
    quarantine_reason: "Quality Issue",
    remarks: "",
    quarantine_date: new Date().toISOString().split("T")[0],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchesRes, qRes, whRes, locRes] = await Promise.all([
        fetchBatches(),
        fetchBatchQuarantines(),
        fetchWarehouses(),
        fetchLocations(),
      ]);
      const bList = batchesRes.results || batchesRes || [];
      setBatches(bList);
      setQuarantineRecords(qRes.results || qRes || []);
      setWarehouses(whRes.results || whRes || []);
      setLocations(locRes.results || locRes || []);

      // If preselectedBatch was provided, prefill formData
      if (preselectedBatch) {
        const found = bList.find((b) => b.batch_number === preselectedBatch);
        if (found) {
          setFormData((prev) => ({
            ...prev,
            batch_id: found.id,
            batch_number: found.batch_number,
            product: found.product_name || (found.product && found.product.name) || "Product",
            warehouse: found.warehouse_name || found.warehouse || "Warehouse",
            storage_location: found.location_name || found.location || "Storage Location",
            quarantine_quantity: found.remaining_quantity || found.initial_quantity || 10,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load quarantine data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBatchSelect = (e) => {
    const bNum = e.target.value;
    const found = batches.find((b) => b.batch_number === bNum);
    if (found) {
      setFormData((prev) => ({
        ...prev,
        batch_id: found.id,
        batch_number: found.batch_number,
        product: found.product_name || (found.product && found.product.name) || "Product",
        warehouse: found.warehouse_name || found.warehouse || "Warehouse",
        storage_location: found.location_name || found.location || "Storage Location",
        quarantine_quantity: found.remaining_quantity || found.initial_quantity || 10,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        batch_id: "",
        batch_number: "",
        product: "",
        warehouse: "",
        storage_location: "",
        quarantine_quantity: "",
      }));
    }
  };

  const handleQuarantineSubmit = async (e) => {
    e.preventDefault();
    if (!formData.batch_number) {
      setErrorMsg("Please select a batch.");
      return;
    }
    if (!formData.quarantine_quantity || Number(formData.quarantine_quantity) <= 0) {
      setErrorMsg("Quarantine quantity must be greater than 0.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      await quarantineBatch(formData.batch_id || formData.batch_number, {
        batch_number: formData.batch_number,
        quarantine_quantity: Number(formData.quarantine_quantity),
        quarantine_reason: formData.quarantine_reason,
        remarks: formData.remarks,
        quarantine_date: formData.quarantine_date,
      });

      setShowModal(false);
      setFormData({
        batch_number: "",
        batch_id: "",
        product: "",
        warehouse: "",
        storage_location: "",
        quarantine_quantity: "",
        quarantine_reason: "Quality Issue",
        remarks: "",
        quarantine_date: new Date().toISOString().split("T")[0],
      });
      loadData();
    } catch (err) {
      setErrorMsg(err.message || "Failed to quarantine batch.");
    } finally {
      setSubmitting(false);
    }
  };

  // Quarantined batches list
  const quarantinedBatches = useMemo(() => {
    return batches.filter(
      (b) =>
        b.batch_status === "Quarantined" ||
        b.status === "QUARANTINED" ||
        b.status === "Quarantined" ||
        Number(b.quarantined_quantity || 0) > 0
    );
  }, [batches]);

  const filteredRecords = useMemo(() => {
    return quarantineRecords.filter((rec) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (rec.batch_number && rec.batch_number.toLowerCase().includes(q)) ||
        (rec.product_name && rec.product_name.toLowerCase().includes(q)) ||
        (rec.quarantine_number && rec.quarantine_number.toLowerCase().includes(q));

      const matchReason = !reasonFilter || rec.quarantine_reason === reasonFilter;

      return matchSearch && matchReason;
    });
  }, [quarantineRecords, searchTerm, reasonFilter]);

  // KPIs
  const totalQuarantinedLots = quarantinedBatches.length;
  const totalQuarantinedUnits = quarantinedBatches.reduce(
    (sum, b) => sum + Number(b.quarantined_quantity || 0),
    0
  );
  const qualityIssuesCount = quarantineRecords.filter(
    (r) => r.quarantine_reason === "Quality Issue" || r.quarantine_reason === "Inspection Failure"
  ).length;
  const recallsCount = quarantineRecords.filter(
    (r) => r.quarantine_reason === "Recall" || r.quarantine_reason === "Damage"
  ).length;

  const exportCSV = () => {
    const headers = [
      "Quarantine #",
      "Batch Number",
      "Product",
      "Warehouse",
      "Storage Location",
      "Quarantine Quantity",
      "Reason",
      "Date",
      "Status",
    ];
    const rows = filteredRecords.map((r) => [
      r.quarantine_number || "—",
      r.batch_number || "",
      r.product_name || "",
      r.warehouse_name || "",
      r.location_name || "",
      r.quarantine_quantity || 0,
      r.quarantine_reason || "",
      r.quarantine_date || "",
      r.is_released ? "Released" : "Under Quarantine",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `quarantine_records_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Batch Quarantine
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Isolation Control
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Block batches from normal stock usage and picking due to quality, damage, or safety concerns.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export Log
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors"
          >
            <ShieldAlert className="h-4 w-4" />
            Quarantine Batch
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Quarantined Batches</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{totalQuarantinedLots}</span>
            <span className="text-xs text-slate-400">Active holds</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Quarantined Quantity</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{totalQuarantinedUnits}</span>
            <span className="text-xs text-slate-400">Units isolated</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Quality & Inspection</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{qualityIssuesCount}</span>
            <span className="text-xs text-slate-400">Under investigation</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Recalls & Damage</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">{recallsCount}</span>
            <span className="text-xs text-slate-400">Safety alerts</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Batch #, Product, or Quarantine #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">All Quarantine Reasons</option>
              <option value="Quality Issue">Quality Issue</option>
              <option value="Damage">Damage</option>
              <option value="Expiry Concern">Expiry Concern</option>
              <option value="Inspection Failure">Inspection Failure</option>
              <option value="Recall">Recall</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex items-center justify-end">
            <Link
              to="/inventory/tracking/batch-release"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              Go to Batch Release
            </Link>
          </div>
        </div>
      </div>

      {/* Quarantined Records Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 dark:border-zinc-800 whitespace-nowrap">
              <tr>
                <th className="py-3 px-4">Quarantine #</th>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Warehouse & Location</th>
                <th className="py-3 px-4 text-right">Quarantined Qty</th>
                <th className="py-3 px-4">Quarantine Reason</th>
                <th className="py-3 px-4">Quarantine Date</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading quarantine records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No active quarantine records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 dark:text-zinc-300">
                      {r.quarantine_number || `QR-${1000 + idx}`}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                      {r.batch_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {r.product_name || "Product"}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                        SKU: {r.sku || "N/A"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 dark:text-zinc-200">
                        {r.warehouse_name || "Warehouse"}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {r.location_name || "Storage Location"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums whitespace-nowrap font-bold text-rose-600 dark:text-rose-400">
                      {Number(r.quarantine_quantity || 0)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        {r.quarantine_reason}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400">
                      {r.quarantine_date}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400">
                      <span className="block max-w-xs truncate">{r.remarks || "—"}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {!r.is_released ? (
                        <Link
                          to={`/inventory/tracking/batch-release?batch=${encodeURIComponent(r.batch_number)}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                        >
                          <ShieldCheck className="h-3 w-3" /> Release
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="h-3 w-3" /> Released
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Quarantine Form (Exact 8 Phase 5 fields) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Quarantine Form
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Isolate stock from normal issues and physical dispatch.
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

            <form onSubmit={handleQuarantineSubmit} className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                {/* 1. Batch Number (Dropdown, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Batch Number <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.batch_number}
                    onChange={handleBatchSelect}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select batch to quarantine...</option>
                    {batches.map((b) => (
                      <option key={b.id || b.batch_number} value={b.batch_number}>
                        {b.batch_number} — {b.product_name} (Avail: {b.remaining_quantity || b.initial_quantity || 0})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 2. Product (Auto-filled, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Product (Auto-filled)
                    </label>
                    <input
                      type="text"
                      value={formData.product}
                      readOnly
                      placeholder="Product Name"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-800/30 text-slate-600 dark:text-zinc-400 cursor-not-allowed"
                    />
                  </div>

                  {/* 3. Warehouse (Auto-filled, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Warehouse (Auto-filled)
                    </label>
                    <input
                      type="text"
                      value={formData.warehouse}
                      readOnly
                      placeholder="Warehouse"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-800/30 text-slate-600 dark:text-zinc-400 cursor-not-allowed"
                    />
                  </div>

                  {/* 4. Storage Location (Auto-filled, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Location (Auto-filled)
                    </label>
                    <input
                      type="text"
                      value={formData.storage_location}
                      readOnly
                      placeholder="Storage Location"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-800/30 text-slate-600 dark:text-zinc-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 5. Quarantine Quantity (Number, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Quarantine Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.quarantine_quantity}
                      onChange={(e) => setFormData({ ...formData, quarantine_quantity: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* 6. Quarantine Reason (Dropdown, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Quarantine Reason <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.quarantine_reason}
                      onChange={(e) => setFormData({ ...formData, quarantine_reason: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Quality Issue">Quality Issue</option>
                      <option value="Damage">Damage</option>
                      <option value="Expiry Concern">Expiry Concern</option>
                      <option value="Inspection Failure">Inspection Failure</option>
                      <option value="Recall">Recall</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* 7. Quarantine Date (Date, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Quarantine Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.quarantine_date}
                    onChange={(e) => setFormData({ ...formData, quarantine_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* 8. Remarks (Textarea, Optional) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Remarks
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide additional details regarding the quality issue or isolation justification..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
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
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Block & Quarantine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default BatchQuarantinePage;

