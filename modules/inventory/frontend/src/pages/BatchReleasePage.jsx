import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  Warehouse as WarehouseIcon,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  FileCheck2,
  Lock,
  Unlock,
} from "lucide-react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  fetchBatches,
  fetchBatchQuarantines,
  releaseBatch,
} from "@/services/api";

export function BatchReleasePage() {
  const [searchParams] = useSearchParams();
  const preselectedBatch = searchParams.get("batch") || "";
  const navigate = useNavigate();

  const [batches, setBatches] = useState([]);
  const [quarantineRecords, setQuarantineRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(Boolean(preselectedBatch));
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [resultFilter, setResultFilter] = useState("");

  // Exact 8 Release Form fields
  const [formData, setFormData] = useState({
    batch_number: preselectedBatch,
    batch_id: "",
    product: "",
    quarantined_quantity: 0,
    release_quantity: "",
    inspection_result: "Passed",
    release_reason: "",
    released_by: "Operations Admin",
    release_date: new Date().toISOString().split("T")[0],
    is_expired: false,
    days_to_expiry: null,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchesRes, qRes] = await Promise.all([
        fetchBatches(),
        fetchBatchQuarantines(),
      ]);
      const bList = batchesRes.results || batchesRes || [];
      setBatches(bList);
      setQuarantineRecords(qRes.results || qRes || []);

      if (preselectedBatch) {
        const found = bList.find((b) => b.batch_number === preselectedBatch);
        if (found) {
          const isExpired =
            found.expiry_status === "Expired" ||
            (found.days_to_expiry !== null && found.days_to_expiry !== undefined && found.days_to_expiry <= 0);
          setFormData((prev) => ({
            ...prev,
            batch_id: found.id,
            batch_number: found.batch_number,
            product: found.product_name || (found.product && found.product.name) || "Product",
            quarantined_quantity: Number(found.quarantined_quantity || 0),
            release_quantity: Number(found.quarantined_quantity || 0),
            is_expired: isExpired,
            days_to_expiry: found.days_to_expiry,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load release data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Only quarantined batches can be released
  const eligibleQuarantinedBatches = useMemo(() => {
    return batches.filter(
      (b) =>
        b.batch_status === "Quarantined" ||
        b.status === "QUARANTINED" ||
        b.status === "Quarantined" ||
        Number(b.quarantined_quantity || 0) > 0
    );
  }, [batches]);

  const handleBatchSelect = (e) => {
    const bNum = e.target.value;
    const found = batches.find((b) => b.batch_number === bNum);
    if (found) {
      const isExpired =
        found.expiry_status === "Expired" ||
        (found.days_to_expiry !== null && found.days_to_expiry !== undefined && found.days_to_expiry <= 0);
      setFormData((prev) => ({
        ...prev,
        batch_id: found.id,
        batch_number: found.batch_number,
        product: found.product_name || (found.product && found.product.name) || "Product",
        quarantined_quantity: Number(found.quarantined_quantity || 0),
        release_quantity: Number(found.quarantined_quantity || 0),
        is_expired: isExpired,
        days_to_expiry: found.days_to_expiry,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        batch_id: "",
        batch_number: "",
        product: "",
        quarantined_quantity: 0,
        release_quantity: "",
        is_expired: false,
        days_to_expiry: null,
      }));
    }
  };

  const handleReleaseSubmit = async (e) => {
    e.preventDefault();
    if (!formData.batch_number) {
      setErrorMsg("Please select a quarantined batch.");
      return;
    }
    if (!formData.release_quantity || Number(formData.release_quantity) <= 0) {
      setErrorMsg("Release quantity must be greater than 0.");
      return;
    }
    if (Number(formData.release_quantity) > Number(formData.quarantined_quantity)) {
      setErrorMsg(`Release quantity cannot exceed quarantined quantity (${formData.quarantined_quantity}).`);
      return;
    }
    // IMPORTANT RULE: Expired batches must not become usable merely because quarantine is released
    if (formData.is_expired) {
      setErrorMsg("Safety Block: Expired batches must not be released into usable stock.");
      return;
    }
    if (!formData.release_reason.trim()) {
      setErrorMsg("Release reason is required.");
      return;
    }
    if (!formData.released_by.trim()) {
      setErrorMsg("Released By is required.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      await releaseBatch(formData.batch_id || formData.batch_number, {
        batch_number: formData.batch_number,
        release_quantity: Number(formData.release_quantity),
        inspection_result: formData.inspection_result,
        release_reason: formData.release_reason,
        released_by: formData.released_by,
        release_date: formData.release_date,
      });

      setShowModal(false);
      setFormData({
        batch_number: "",
        batch_id: "",
        product: "",
        quarantined_quantity: 0,
        release_quantity: "",
        inspection_result: "Passed",
        release_reason: "",
        released_by: "Operations Admin",
        release_date: new Date().toISOString().split("T")[0],
        is_expired: false,
        days_to_expiry: null,
      });
      loadData();
    } catch (err) {
      setErrorMsg(err.message || "Failed to release batch.");
    } finally {
      setSubmitting(false);
    }
  };

  // Released records log
  const releasedLogs = useMemo(() => {
    return quarantineRecords.filter((r) => r.is_released || r.released_quantity > 0);
  }, [quarantineRecords]);

  const filteredLogs = useMemo(() => {
    return releasedLogs.filter((rec) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (rec.batch_number && rec.batch_number.toLowerCase().includes(q)) ||
        (rec.product_name && rec.product_name.toLowerCase().includes(q)) ||
        (rec.released_by && rec.released_by.toLowerCase().includes(q));

      const matchResult = !resultFilter || rec.inspection_result === resultFilter;

      return matchSearch && matchResult;
    });
  }, [releasedLogs, searchTerm, resultFilter]);

  // KPIs
  const totalReleases = releasedLogs.length;
  const passedReleases = releasedLogs.filter((r) => r.inspection_result === "Passed").length;
  const partialOrFailed = releasedLogs.filter(
    (r) => r.inspection_result === "Failed" || r.inspection_result === "Partially Passed"
  ).length;
  const pendingQuarantine = eligibleQuarantinedBatches.length;

  const exportCSV = () => {
    const headers = [
      "Release Date",
      "Batch Number",
      "Product",
      "Released Quantity",
      "Inspection Result",
      "Released By",
      "Release Reason",
    ];
    const rows = filteredLogs.map((r) => [
      r.release_date || r.quarantine_date || "",
      r.batch_number || "",
      r.product_name || "",
      r.released_quantity || r.quarantine_quantity || 0,
      r.inspection_result || "Passed",
      r.released_by || "Admin",
      r.release_reason || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `batch_releases_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getResultBadge = (result) => {
    const res = String(result || "Passed").toUpperCase();
    if (res === "PASSED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="h-3 w-3" /> Passed
        </span>
      );
    }
    if (res.includes("PARTIAL")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <Clock className="h-3 w-3" /> Partially Passed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
        <AlertTriangle className="h-3 w-3" /> Failed
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
              Batch Release
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              QC Approval
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Authorize and release inspected stock batches back into usable inventory under quality safety rules.
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
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <ShieldCheck className="h-4 w-4" />
            Release Batch
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Releases</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{totalReleases}</span>
            <span className="text-xs text-slate-400">Batches passed</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Passed Inspection</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{passedReleases}</span>
            <span className="text-xs text-slate-400">Full clearance</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Partial / Failed</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{partialOrFailed}</span>
            <span className="text-xs text-slate-400">Conditional / Rejected</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Awaiting Release</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{pendingQuarantine}</span>
            <span className="text-xs text-slate-400">In quarantine</span>
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
              placeholder="Search by Batch #, Product, or Inspector..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Inspection Results</option>
              <option value="Passed">Passed</option>
              <option value="Partially Passed">Partially Passed</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          <div className="flex items-center justify-end">
            <Link
              to="/inventory/tracking/batch-quarantine"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              <ShieldAlert className="h-4 w-4" />
              View Quarantined Stock
            </Link>
          </div>
        </div>
      </div>

      {/* Release Records Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Release Date</th>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4 text-right">Released Qty</th>
                <th className="py-3 px-4">Inspection Result</th>
                <th className="py-3 px-4">Released By</th>
                <th className="py-3 px-4">Release Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Loading release records...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No release records logged yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400">
                      {r.release_date || r.quarantine_date}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {r.batch_number}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {r.product_name || "Product"}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                      +{Number(r.released_quantity || r.quarantine_quantity || 0)}
                    </td>
                    <td className="py-3.5 px-4">
                      {getResultBadge(r.inspection_result)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-zinc-300">
                      {r.released_by || "QC Inspector"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 max-w-sm truncate">
                      {r.release_reason || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Release Form (Exact 8 Phase 5 fields & Strict Expiry Safety Rule) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Release Form
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Authorize release of quarantined stock into usable inventory.
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

            <form onSubmit={handleReleaseSubmit} className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Strict Expiry Rule Alert */}
              {formData.is_expired && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-900 dark:text-rose-100">
                      Safety Protocol Enforcement: Expired Batch
                    </div>
                    <div className="text-[11px] mt-0.5 text-rose-700 dark:text-rose-300">
                      This batch has reached or passed its expiration date. Under regulatory rules, expired batches
                      must not become usable merely because quarantine is released. Release to active stock is blocked.
                    </div>
                  </div>
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select quarantined batch...</option>
                    {eligibleQuarantinedBatches.map((b) => (
                      <option key={b.id || b.batch_number} value={b.batch_number}>
                        {b.batch_number} — {b.product_name} (Quarantined: {b.quarantined_quantity || 0})
                        {b.expiry_status === "Expired" ? " [EXPIRED]" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  {/* 3. Quarantined Quantity (Auto-filled, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Quarantined Quantity (Auto-filled)
                    </label>
                    <input
                      type="number"
                      value={formData.quarantined_quantity}
                      readOnly
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-800/30 text-slate-600 dark:text-zinc-400 font-bold tabular-nums cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 4. Release Quantity (Number, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Release Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={formData.quarantined_quantity || 999999}
                      value={formData.release_quantity}
                      onChange={(e) => setFormData({ ...formData, release_quantity: e.target.value })}
                      required
                      disabled={formData.is_expired}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    />
                  </div>

                  {/* 5. Inspection Result (Dropdown, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Inspection Result <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.inspection_result}
                      onChange={(e) => setFormData({ ...formData, inspection_result: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Passed">Passed</option>
                      <option value="Partially Passed">Partially Passed</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 7. Released By (User, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Released By <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.released_by}
                      onChange={(e) => setFormData({ ...formData, released_by: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 8. Release Date (Date, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Release Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.release_date}
                      onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* 6. Release Reason (Textarea, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Release Reason & Inspection Notes <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Document quality verification test details and authorized sign-off justification..."
                    value={formData.release_reason}
                    onChange={(e) => setFormData({ ...formData, release_reason: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  disabled={submitting || formData.is_expired}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? "Releasing..." : "Authorize Release"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default BatchReleasePage;

