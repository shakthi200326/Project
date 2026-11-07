import React, { useState, useEffect, useMemo } from "react";
import {
  Scale,
  CheckCircle2,
  Plus,
  Download,
  AlertTriangle,
  ShieldCheck,
  Check,
  Search,
  SlidersHorizontal,
  FileSpreadsheet,
  X,
  Layers,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
  fetchReconciliations,
  createReconciliation,
  submitReconciliation,
  approveReconciliation,
  generateReconciliationAdjustment,
  fetchWarehouses,
  fetchLocations,
  fetchProducts,
  fetchStockBalances,
} from "../services/api";

export function ReconciliationPage() {
  const [reconciliations, setReconciliations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const generateReconNumber = () =>
    `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Form State
  const [formData, setFormData] = useState({
    reconciliation_number: generateReconNumber(),
    reconciliation_date: new Date().toISOString().split("T")[0],
    warehouse: "",
    warehouse_id: null,
    location: "",
    location_id: null,
    product_sku: "",
    product_id: null,
    product_name: "",
    system_quantity: 0,
    physical_quantity: 0,
    difference_quantity: 0,
    reason: "Physical Count Difference",
    remarks: "",
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [reconData, whData, locData, prodData, balData] = await Promise.all([
        fetchReconciliations(),
        fetchWarehouses(),
        fetchLocations(),
        fetchProducts(),
        fetchStockBalances(),
      ]);
      setReconciliations(reconData.results || (Array.isArray(reconData) ? reconData : []));
      setWarehouses(whData || []);
      setLocations(locData || []);
      setProducts(prodData.results || (Array.isArray(prodData) ? prodData : []));
      setBalances(balData.results || (Array.isArray(balData) ? balData : []));
    } catch (e) {
      console.error("Failed to load reconciliation data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Recalculate system quantity when product or warehouse changes
  useEffect(() => {
    if (!formData.product_sku && !formData.product_id) return;

    const bal = balances.find((b) => {
      const matchesSku =
        (b.sku && b.sku === formData.product_sku) ||
        (b.item_code && b.item_code === formData.product_sku) ||
        (formData.product_id && (b.item === formData.product_id || b.item_id === formData.product_id));

      const matchesWh =
        (formData.warehouse_id && (b.warehouse === formData.warehouse_id || b.warehouse_id === formData.warehouse_id)) ||
        (b.warehouse_name && b.warehouse_name === formData.warehouse) ||
        (b.warehouse_code && b.warehouse_code === formData.warehouse);

      return matchesSku && matchesWh;
    });

    const sys = bal ? Number(bal.total_stock !== undefined ? bal.total_stock : (bal.current_stock !== undefined ? bal.current_stock : (bal.on_hand_qty || 0))) : 0;
    const diff = Number(formData.physical_quantity) - sys;

    setFormData((prev) => ({
      ...prev,
      system_quantity: sys,
      difference_quantity: diff,
    }));
  }, [formData.product_sku, formData.product_id, formData.warehouse, formData.warehouse_id, balances]);

  const handlePhysicalQtyChange = (val) => {
    const physical = val === "" ? 0 : Number(val);
    const diff = physical - Number(formData.system_quantity);
    setFormData((prev) => ({
      ...prev,
      physical_quantity: val,
      difference_quantity: diff,
    }));
  };

  const handleOpenModal = () => {
    const initialWh = warehouses[0] || {};
    const initialProd = products[0] || {};

    const bal = balances.find((b) => {
      const matchesSku =
        (b.sku && b.sku === initialProd.sku) ||
        (b.item_code && b.item_code === initialProd.code) ||
        (initialProd.id && (b.item === initialProd.id || b.item_id === initialProd.id));

      const matchesWh =
        (initialWh.id && (b.warehouse === initialWh.id || b.warehouse_id === initialWh.id)) ||
        (b.warehouse_name && b.warehouse_name === initialWh.name);

      return matchesSku && matchesWh;
    });

    const sys = bal ? Number(bal.total_stock !== undefined ? bal.total_stock : (bal.current_stock !== undefined ? bal.current_stock : (bal.on_hand_qty || 0))) : 0;

    setFormData({
      reconciliation_number: generateReconNumber(),
      reconciliation_date: new Date().toISOString().split("T")[0],
      warehouse: initialWh.name || "",
      warehouse_id: initialWh.id || null,
      location: "",
      location_id: null,
      product_sku: initialProd.sku || initialProd.code || "",
      product_id: initialProd.id || null,
      product_name: initialProd.name || "",
      system_quantity: sys,
      physical_quantity: sys,
      difference_quantity: 0,
      reason: "Physical Count Difference",
      remarks: "",
    });
    setShowModal(true);
  };

  const handleSave = async (targetStatus = "DRAFT") => {
    try {
      const selectedProd =
        products.find(
          (p) =>
            p.id === formData.product_id ||
            p.sku === formData.product_sku ||
            p.code === formData.product_sku
        ) || {};

      const selectedWh =
        warehouses.find(
          (w) =>
            w.id === formData.warehouse_id ||
            w.name === formData.warehouse ||
            w.code === formData.warehouse
        ) || {};

      const selectedLoc =
        locations.find(
          (l) =>
            l.id === formData.location_id ||
            l.name === formData.location ||
            l.code === formData.location
        ) || null;

      const payload = {
        reconciliation_number: formData.reconciliation_number,
        reconciliation_date: formData.reconciliation_date,
        warehouse: selectedWh.id || 1,
        warehouse_id: selectedWh.id || 1,
        warehouse_name: selectedWh.name || formData.warehouse,
        location: selectedLoc ? selectedLoc.id : null,
        location_id: selectedLoc ? selectedLoc.id : null,
        location_name: selectedLoc ? selectedLoc.name : formData.location,
        product: selectedProd.id || 1,
        item: selectedProd.id || 1,
        item_id: selectedProd.id || 1,
        product_name: selectedProd.name || formData.product_name,
        item_name: selectedProd.name || formData.product_name,
        sku: selectedProd.sku || selectedProd.code || formData.product_sku,
        system_quantity: Number(formData.system_quantity),
        physical_quantity: Number(formData.physical_quantity),
        difference_quantity: Number(formData.difference_quantity),
        reason: formData.reason,
        remarks: formData.remarks,
        status: targetStatus,
      };

      const created = await createReconciliation(payload);
      setShowModal(false);
      showToast(`Reconciliation ${formData.reconciliation_number} saved as ${targetStatus}.`);
      loadData();
    } catch (err) {
      showToast("Error saving reconciliation: " + err.message);
    }
  };

  const handleSubmit = async (id) => {
    try {
      await submitReconciliation(id);
      setReconciliations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "SUBMITTED" } : r))
      );
      showToast("Reconciliation submitted for supervisory approval.");
    } catch (err) {
      showToast("Failed to submit reconciliation: " + err.message);
    }
  };

  const handleApprove = async (id) => {
    try {
      await approveReconciliation(id);
      setReconciliations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "APPROVED" } : r))
      );
      showToast("Reconciliation approved. Ready to generate stock adjustment.");
    } catch (err) {
      showToast("Failed to approve reconciliation: " + err.message);
    }
  };

  const handleGenerateAdjustment = async (id) => {
    try {
      const res = await generateReconciliationAdjustment(id);
      showToast(`Stock Adjustment generated (${res.adjustment_document_number || "ADJ"}). Inventory updated.`);
      loadData();
    } catch (err) {
      showToast("Failed to generate adjustment: " + err.message);
    }
  };

  const filtered = useMemo(() => {
    return reconciliations.filter((r) => {
      const q = searchTerm.toLowerCase();
      const num = String(r.reconciliation_number || r.count_number || "").toLowerCase();
      const prod = String(r.product_name || r.item_name || "").toLowerCase();
      const sku = String(r.sku || r.item_code || "").toLowerCase();
      const wh = String(r.warehouse_name || r.warehouse || "").toLowerCase();

      const matchesSearch =
        num.includes(q) || prod.includes(q) || sku.includes(q) || wh.includes(q);

      const matchesStatus =
        statusFilter === "ALL" ||
        String(r.status || "").toUpperCase() === statusFilter.toUpperCase();

      return matchesSearch && matchesStatus;
    });
  }, [reconciliations, searchTerm, statusFilter]);

  const kpis = useMemo(() => {
    let pendingCount = 0;
    let netVariance = 0;
    let adjustedCount = 0;
    reconciliations.forEach((r) => {
      if (r.status === "DRAFT" || r.status === "SUBMITTED" || r.status === "APPROVED") {
        pendingCount++;
      }
      if (r.status === "ADJUSTED") {
        adjustedCount++;
      }
      netVariance += Number(r.difference_quantity || 0);
    });
    return {
      total: reconciliations.length,
      pending: pendingCount,
      adjusted: adjustedCount,
      netVariance,
    };
  }, [reconciliations]);

  const handleExportCSV = () => {
    const headers = [
      "Reconciliation Number",
      "Date",
      "Warehouse",
      "Location",
      "Product Name",
      "SKU",
      "System Qty",
      "Physical Qty",
      "Variance Qty",
      "Reason",
      "Status",
      "Adjustment Doc",
    ];

    const rows = filtered.map((r) => [
      `"${r.reconciliation_number || r.count_number || ""}"`,
      `"${r.reconciliation_date || r.count_date || ""}"`,
      `"${r.warehouse_name || r.warehouse || ""}"`,
      `"${r.location_name || r.location || ""}"`,
      `"${(r.product_name || r.item_name || "").replace(/"/g, '""')}"`,
      `"${r.sku || r.item_code || ""}"`,
      Number(r.system_quantity || 0),
      Number(r.physical_quantity || 0),
      Number(r.difference_quantity || 0),
      `"${r.reason || ""}"`,
      `"${r.status || ""}"`,
      `"${r.adjustment_document_number || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_reconciliations_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Reconciliation records exported to CSV successfully.");
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Stock Reconciliation
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50">
              <Scale className="h-3.5 w-3.5" />
              Physical Audit & Variance Adjustment
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Authoritative 4-stage audit workflow (Draft → Submitted → Approved → Adjusted) ensuring complete stock alignment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Refresh Reconciliations"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Reconciliation</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Total Reconciliations
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            {kpis.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">All count audit entries</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Pending Action
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {kpis.pending}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Awaiting submit, review or adjustment</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Adjusted & Posted
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {kpis.adjusted}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Physical balances posted to ledger</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Net Audit Variance
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            {kpis.netVariance >= 0 ? `+${kpis.netVariance}` : kpis.netVariance} <span className="text-xs font-normal text-slate-400">EA</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Physical vs system disparity</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reconciliation #, product, SKU, warehouse..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="ADJUSTED">Adjusted</option>
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Showing <span className="font-semibold text-slate-700 dark:text-zinc-200">{filtered.length}</span> records
        </div>
      </div>

      {/* Reconciliations Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                <th className="py-3.5 px-4 font-semibold">Reconciliation Number</th>
                <th className="py-3.5 px-3 font-semibold">Count Date</th>
                <th className="py-3.5 px-3 font-semibold">Warehouse / Location</th>
                <th className="py-3.5 px-3 font-semibold">Product Name & SKU</th>
                <th className="py-3.5 px-3 font-semibold text-right">System Qty</th>
                <th className="py-3.5 px-3 font-semibold text-right">Physical Qty</th>
                <th className="py-3.5 px-3 font-semibold text-right font-bold">Variance</th>
                <th className="py-3.5 px-3 font-semibold">Discrepancy Reason</th>
                <th className="py-3.5 px-3 font-semibold text-center">Audit Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Action / Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <Scale className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold">No stock reconciliation records found</p>
                    <p className="text-[11px] mt-0.5">Click "New Reconciliation" to create a physical count variance check.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const num = r.reconciliation_number || r.count_number;
                  const diff = Number(r.difference_quantity || 0);
                  const isPositive = diff > 0;
                  const isZero = diff === 0;

                  return (
                    <tr key={r.id || num} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {num}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                        {r.reconciliation_date || r.count_date || "—"}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {r.warehouse_name || r.warehouse}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {r.location_name || r.location || "General Storage"}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white max-w-[180px] truncate" title={r.product_name || r.item_name}>
                          {r.product_name || r.item_name}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {r.sku || r.item_code}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                        {Number(r.system_quantity || 0)} EA
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                        {Number(r.physical_quantity || 0)} EA
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums font-bold">
                        <span
                          className={
                            isZero
                              ? "text-slate-400"
                              : isPositive
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }
                        >
                          {isPositive ? `+${diff}` : diff} EA
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-zinc-300">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800">
                          {r.reason || "Physical Count Difference"}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            r.status === "DRAFT"
                              ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                              : r.status === "SUBMITTED"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/50"
                              : r.status === "APPROVED"
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/50"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/50"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {r.status === "DRAFT" && (
                          <button
                            type="button"
                            onClick={() => handleSubmit(r.id)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold shadow-xs transition-colors cursor-pointer"
                          >
                            Submit
                          </button>
                        )}
                        {r.status === "SUBMITTED" && (
                          <button
                            type="button"
                            onClick={() => handleApprove(r.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold shadow-xs transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                        )}
                        {r.status === "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => handleGenerateAdjustment(r.id)}
                            className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold shadow-xs transition-colors cursor-pointer"
                            title="Generate a Stock Adjustment transaction to correct inventory balance"
                          >
                            Generate Adjustment
                          </button>
                        )}
                        {r.status === "ADJUSTED" && (
                          <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            {r.adjustment_document_number || "ADJUSTED"}
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

      {/* Create Reconciliation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Record Stock Reconciliation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave("DRAFT");
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Reconciliation Number */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Reconciliation # *
                  </label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={formData.reconciliation_number}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 font-mono text-slate-900 dark:text-white cursor-not-allowed"
                  />
                </div>

                {/* 2. Reconciliation Date */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Count Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.reconciliation_date}
                    onChange={(e) => setFormData({ ...formData, reconciliation_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 3. Warehouse */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse *
                  </label>
                  <select
                    required
                    value={formData.warehouse_id || ""}
                    onChange={(e) => {
                      const whId = Number(e.target.value);
                      const wh = warehouses.find((w) => w.id === whId);
                      setFormData({
                        ...formData,
                        warehouse_id: whId,
                        warehouse: wh ? wh.name : "",
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Storage Location (Optional) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Storage Location (Optional)
                  </label>
                  <select
                    value={formData.location_id || ""}
                    onChange={(e) => {
                      const locId = e.target.value ? Number(e.target.value) : null;
                      const loc = locations.find((l) => l.id === locId);
                      setFormData({
                        ...formData,
                        location_id: locId,
                        location: loc ? loc.name : "",
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">All Locations / Entire Facility</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} - {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 5. Product */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Product *
                </label>
                <select
                  required
                  value={formData.product_id || ""}
                  onChange={(e) => {
                    const prodId = Number(e.target.value);
                    const prod = products.find((p) => p.id === prodId);
                    setFormData({
                      ...formData,
                      product_id: prodId,
                      product_sku: prod ? (prod.sku || prod.code) : "",
                      product_name: prod ? prod.name : "",
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku || p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantities Calculation: Difference = Physical - System */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800/80">
                {/* System Quantity */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    System Qty
                  </label>
                  <input
                    type="number"
                    readOnly
                    value={formData.system_quantity}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 font-mono font-bold text-slate-900 dark:text-white cursor-not-allowed"
                  />
                </div>

                {/* Physical Quantity */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-200 mb-1">
                    Physical Qty *
                  </label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={formData.physical_quantity}
                    onChange={(e) => handlePhysicalQtyChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Variance Quantity */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Variance
                  </label>
                  <input
                    type="number"
                    readOnly
                    value={formData.difference_quantity}
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-mono font-bold cursor-not-allowed ${
                      Number(formData.difference_quantity) === 0
                        ? "border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-500"
                        : Number(formData.difference_quantity) > 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                    }`}
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Discrepancy Reason *
                </label>
                <select
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Physical Count Difference">Physical Count Difference</option>
                  <option value="Damaged Goods Discarded">Damaged Goods Discarded</option>
                  <option value="Found Unrecorded Stock">Found Unrecorded Stock</option>
                  <option value="Shrinkage or Loss">Shrinkage or Loss</option>
                  <option value="UOM Conversion Rounding">UOM Conversion Rounding</option>
                </select>
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Auditor Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Additional notes for supervisor review..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSave("SUBMITTED")}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Save & Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default ReconciliationPage;
