import React, { useState, useEffect, useMemo } from "react";
import {
  ClipboardCheck,
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
  FileSpreadsheet,
  Send,
  Eye,
  SlidersHorizontal,
  Scale,
} from "lucide-react";
import {
  fetchStockCounts,
  createStockCount,
  submitStockCount,
  fetchProducts,
  fetchWarehouses,
  fetchStorageLocations,
  fetchStockBalances,
} from "@/services/api";

export function PhysicalStockCountPage() {
  const [counts, setCounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Create Stock Count Form - Necessary Fields Only
  const [formData, setFormData] = useState({
    count_number: `CNT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    count_date: new Date().toISOString().split("T")[0],
    warehouse: "",
    storage_location: "",
    product: "",
    sku: "",
    system_quantity: 0,
    physical_quantity: 0,
    difference_quantity: 0,
    remarks: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [cntRes, prodRes, whRes, locRes, balRes] = await Promise.all([
        fetchStockCounts(),
        fetchProducts(),
        fetchWarehouses(),
        fetchStorageLocations(),
        fetchStockBalances(),
      ]);
      setCounts(cntRes.results || cntRes || []);
      setProducts(prodRes.results || prodRes || []);
      setWarehouses(whRes.results || whRes || []);
      setLocations(locRes.results || locRes || []);
      setBalances(balRes.results || balRes || []);
    } catch (err) {
      console.error("Failed to load physical stock counts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormData({
      count_number: `CNT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      count_date: new Date().toISOString().split("T")[0],
      warehouse: warehouses.length > 0 ? String(warehouses[0].id) : "",
      storage_location: "",
      product: "",
      sku: "",
      system_quantity: 0,
      physical_quantity: 0,
      difference_quantity: 0,
      remarks: "",
    });
    setErrorMsg("");
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Auto-fill SKU and snapshot System Quantity when product / warehouse changes
  const handleProductChange = (productId) => {
    const prod = products.find((p) => String(p.id) === String(productId));
    const sku = prod ? prod.code || prod.sku : "";

    let sysQty = 0;
    if (productId && formData.warehouse) {
      const bal = balances.find(
        (b) =>
          (String(b.item) === String(productId) || String(b.product) === String(productId)) &&
          String(b.warehouse) === String(formData.warehouse)
      );
      if (bal) {
        sysQty = Number(bal.on_hand_qty || bal.total_stock || 0);
      }
    }

    const physQty = Number(formData.physical_quantity || 0);
    setFormData((prev) => ({
      ...prev,
      product: productId,
      sku: sku,
      system_quantity: sysQty,
      difference_quantity: physQty - sysQty,
    }));
  };

  const handleWarehouseChange = (warehouseId) => {
    let sysQty = 0;
    if (formData.product && warehouseId) {
      const bal = balances.find(
        (b) =>
          (String(b.item) === String(formData.product) || String(b.product) === String(formData.product)) &&
          String(b.warehouse) === String(warehouseId)
      );
      if (bal) {
        sysQty = Number(bal.on_hand_qty || bal.total_stock || 0);
      }
    }

    const physQty = Number(formData.physical_quantity || 0);
    setFormData((prev) => ({
      ...prev,
      warehouse: warehouseId,
      storage_location: "",
      system_quantity: sysQty,
      difference_quantity: physQty - sysQty,
    }));
  };

  const handlePhysicalQuantityChange = (val) => {
    const num = Number(val);
    const sys = Number(formData.system_quantity || 0);
    setFormData((prev) => ({
      ...prev,
      physical_quantity: num,
      difference_quantity: num - sys,
    }));
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    if (!formData.warehouse) {
      setErrorMsg("Warehouse is required.");
      return;
    }
    if (!formData.product) {
      setErrorMsg("Product is required.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const payload = {
        count_number: formData.count_number,
        count_date: formData.count_date,
        warehouse: formData.warehouse,
        storage_location: formData.storage_location || null,
        product: formData.product,
        system_quantity: formData.system_quantity,
        physical_quantity: formData.physical_quantity,
        difference_quantity: formData.difference_quantity,
        remarks: formData.remarks,
        status: "DRAFT",
      };

      await createStockCount(payload);
      setSuccessMsg("Stock count saved as draft successfully.");
      setShowModal(false);
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setErrorMsg(err.message || "Failed to save stock count draft.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitCount = async (e) => {
    e.preventDefault();
    if (!formData.warehouse) {
      setErrorMsg("Warehouse is required.");
      return;
    }
    if (!formData.product) {
      setErrorMsg("Product is required.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const payload = {
        count_number: formData.count_number,
        count_date: formData.count_date,
        warehouse: formData.warehouse,
        storage_location: formData.storage_location || null,
        product: formData.product,
        system_quantity: formData.system_quantity,
        physical_quantity: formData.physical_quantity,
        difference_quantity: formData.difference_quantity,
        remarks: formData.remarks,
        status: "SUBMITTED",
      };

      const res = await createStockCount(payload);
      if (res && res.id) {
        await submitStockCount(res.id);
      }
      setSuccessMsg("Stock count submitted for variance review.");
      setShowModal(false);
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setErrorMsg(err.message || "Failed to submit stock count.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInlineSubmit = async (countId) => {
    try {
      await submitStockCount(countId);
      setSuccessMsg("Count entry submitted successfully.");
      await loadData();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      alert("Error submitting count: " + err.message);
    }
  };

  // Filtered list
  const filteredCounts = useMemo(() => {
    return counts.filter((c) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !q ||
        (c.count_number && c.count_number.toLowerCase().includes(q)) ||
        (c.product_name && c.product_name.toLowerCase().includes(q)) ||
        (c.sku && c.sku.toLowerCase().includes(q)) ||
        (c.warehouse_name && c.warehouse_name.toLowerCase().includes(q));

      const matchWh =
        warehouseFilter === "ALL" ||
        String(c.warehouse) === String(warehouseFilter) ||
        (c.warehouse_name && c.warehouse_name.toLowerCase() === warehouseFilter.toLowerCase());

      const matchStatus =
        statusFilter === "ALL" ||
        String(c.status).toUpperCase() === statusFilter.toUpperCase();

      return matchSearch && matchWh && matchStatus;
    });
  }, [counts, searchTerm, warehouseFilter, statusFilter]);

  // KPI Calculations
  const totalCounted = counts.length;
  const draftCounts = counts.filter((c) => String(c.status).toUpperCase() === "DRAFT").length;
  const submittedCounts = counts.filter((c) => String(c.status).toUpperCase() === "SUBMITTED").length;
  const varianceCount = counts.filter((c) => Number(c.difference_quantity || 0) !== 0).length;

  const exportCSV = () => {
    const headers = [
      "Count Number",
      "Count Date",
      "Warehouse",
      "Storage Location",
      "Product",
      "SKU",
      "System Qty",
      "Physical Qty",
      "Difference Qty",
      "Variance Reason",
      "Status",
    ];
    const rows = filteredCounts.map((c) => [
      c.count_number,
      c.count_date || c.reconciliation_date,
      c.warehouse_name,
      c.location_name || "All Locations",
      c.product_name,
      c.sku,
      c.system_quantity,
      c.physical_quantity,
      c.difference_quantity,
      c.variance_reason || c.reason || "",
      c.status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((f) => `"${f || ""}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Physical_Stock_Counts_${new Date().toISOString().split("T")[0]}.csv`);
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
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Physical Stock Count
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Record actual physical quantities and capture system stock snapshots for discrepancy validation.
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
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Stock Count
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
            <span className="text-xs font-medium">Total Count Records</span>
            <ClipboardCheck className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-slate-900 dark:text-white">
            {totalCounted}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Logged counting sessions</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">In Draft</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-amber-600 dark:text-amber-400">
            {draftCounts}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Awaiting counter submission</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Submitted for Review</span>
            <Send className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-purple-600 dark:text-purple-400">
            {submittedCounts}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Ready for auditor verification</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Discrepancy Variances</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-rose-600 dark:text-rose-400">
            {varianceCount}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Physical vs snapshot variances</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search by count number, SKU, product, warehouse..."
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
                {wh.name} ({wh.code})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border-none text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="ADJUSTED">Adjusted</option>
            <option value="REJECTED">Rejected</option>
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

      {/* Counts Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-400">
            <thead className="bg-slate-50/80 dark:bg-zinc-800/50 uppercase tracking-wider text-[11px] font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-3.5 px-4">Count Number</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Warehouse & Location</th>
                <th className="py-3.5 px-4">Product & SKU</th>
                <th className="py-3.5 px-4 text-right">System Qty</th>
                <th className="py-3.5 px-4 text-right">Physical Qty</th>
                <th className="py-3.5 px-4 text-right">Difference</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading physical stock count records...
                  </td>
                </tr>
              ) : filteredCounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No physical stock counts match the active criteria.
                  </td>
                </tr>
              ) : (
                filteredCounts.map((c) => {
                  const diff = Number(c.difference_quantity || 0);
                  const st = String(c.status).toUpperCase();
                  return (
                    <tr
                      key={c.id || c.count_number}
                      className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {c.count_number}
                      </td>
                      <td className="py-3.5 px-4">
                        {c.count_date || c.reconciliation_date || "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-zinc-200">
                          {c.warehouse_name || "Warehouse"}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                          {c.location_name || "All Locations / Main Area"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-zinc-200">
                          {c.product_name || "Product"}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                          SKU: {c.sku || "—"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-600 dark:text-zinc-400">
                        {Number(c.system_quantity || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {Number(c.physical_quantity || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <span
                          className={`inline-block px-2 py-0.5 rounded ${
                            diff === 0
                              ? "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                              : diff > 0
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          }`}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            st === "DRAFT"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                              : st === "SUBMITTED"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50"
                              : st === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                              : st === "ADJUSTED"
                              ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                          }`}
                        >
                          {st === "DRAFT" && <Clock className="h-3 w-3" />}
                          {st === "SUBMITTED" && <Send className="h-3 w-3" />}
                          {st === "APPROVED" && <CheckCircle className="h-3 w-3" />}
                          {st === "ADJUSTED" && <Scale className="h-3 w-3" />}
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {st === "DRAFT" && (
                          <button
                            onClick={() => handleInlineSubmit(c.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-400 transition-colors cursor-pointer"
                          >
                            <Send className="h-3 w-3" />
                            Submit
                          </button>
                        )}
                        {st !== "DRAFT" && (
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                            {c.adjustment_document_number || "Audited"}
                          </span>
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

      {/* Create Stock Count Modal - Exactly the specified 10 fields */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Create Stock Count Form
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

            <form className="p-5 space-y-4">
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
                    onChange={(e) => handleWarehouseChange(e.target.value)}
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
                    <option value="">All Locations / Main Area</option>
                    {availableLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 5. Product (Dropdown, Required) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Product <span className="text-blue-500">*</span>
                  </label>
                  <select
                    value={formData.product}
                    onChange={(e) => handleProductChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code || p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. SKU (Auto-filled, Required) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    SKU <span className="text-blue-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    readOnly
                    placeholder="Auto-filled on product selection"
                    className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-xl bg-slate-100 dark:bg-zinc-800 border-none text-slate-700 dark:text-zinc-300 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">Auto-filled</span>
                </div>
              </div>

              {/* Quantities Section */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {/* 7. System Quantity (Auto-filled snapshot, Required) */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 mb-1">
                      System Quantity
                    </label>
                    <input
                      type="number"
                      value={formData.system_quantity}
                      readOnly
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 cursor-not-allowed text-right"
                    />
                    <span className="text-[9px] text-slate-400 dark:text-zinc-500 block mt-0.5">Snapshot balance</span>
                  </div>

                  {/* 8. Physical Quantity (Number, Required) */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-1">
                      Physical Quantity *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.physical_quantity}
                      onChange={(e) => handlePhysicalQuantityChange(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-white dark:bg-zinc-900 border-2 border-blue-500 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                    />
                    <span className="text-[9px] text-slate-400 dark:text-zinc-500 block mt-0.5">Physical count</span>
                  </div>

                  {/* 9. Difference Quantity (Auto-calculated, Required) */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 mb-1">
                      Difference
                    </label>
                    <input
                      type="number"
                      value={formData.difference_quantity}
                      readOnly
                      className={`w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-right cursor-not-allowed ${
                        formData.difference_quantity > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : formData.difference_quantity < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-600 dark:text-zinc-400"
                      }`}
                    />
                    <span className="text-[9px] text-slate-400 dark:text-zinc-500 block mt-0.5">
                      Physical − System
                    </span>
                  </div>
                </div>
              </div>

              {/* 10. Remarks (Textarea, Optional) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Record any physical counting notes, package conditions or shelf observations..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Actions: Save Draft, Submit Count */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveDraft}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-xs"
                >
                  {submitting ? "Saving..." : "Save Draft"}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitCount}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs"
                >
                  {submitting ? "Submitting..." : "Submit Count"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PhysicalStockCountPage;
