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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const generateReconNumber = () =>
    `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Form State according to Phase 4
  const [formData, setFormData] = useState({
    reconciliation_number: generateReconNumber(),
    reconciliation_date: new Date().toISOString().split("T")[0],
    warehouse: "Main Central Hub",
    location: "",
    product_sku: "BRG-6205-2RS",
    system_quantity: 450,
    physical_quantity: 450,
    difference_quantity: 0,
    reason: "Physical Count Difference",
    remarks: "",
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    try {
      const [reconData, whData, locData, prodData, balData] = await Promise.all([
        fetchReconciliations(),
        fetchWarehouses(),
        fetchLocations(),
        fetchProducts(),
        fetchStockBalances(),
      ]);
      setReconciliations(reconData.results || reconData || []);
      setWarehouses(whData || []);
      setLocations(locData || []);
      setProducts(prodData.results || prodData || []);
      setBalances(balData.results || balData || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-fill system quantity from balances when product or warehouse changes
  useEffect(() => {
    const bal = balances.find(
      (b) =>
        (b.sku === formData.product_sku || b.item_code === formData.product_sku) &&
        (b.warehouse_name === formData.warehouse || b.warehouse === formData.warehouse)
    );
    const sys = bal ? Number(bal.total_stock !== undefined ? bal.total_stock : (bal.on_hand_qty || 0)) : 100;
    const diff = Number(formData.physical_quantity) - sys;
    setFormData((prev) => ({
      ...prev,
      system_quantity: sys,
      difference_quantity: diff,
    }));
  }, [formData.product_sku, formData.warehouse, balances]);

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
    const initialSku = products[0]?.sku || "BRG-6205-2RS";
    const initialWh = warehouses[0]?.name || "Main Central Hub";
    const bal = balances.find(
      (b) =>
        (b.sku === initialSku || b.item_code === initialSku) &&
        (b.warehouse_name === initialWh || b.warehouse === initialWh)
    );
    const sys = bal ? Number(bal.total_stock !== undefined ? bal.total_stock : (bal.on_hand_qty || 0)) : 450;

    setFormData({
      reconciliation_number: generateReconNumber(),
      reconciliation_date: new Date().toISOString().split("T")[0],
      warehouse: initialWh,
      location: "",
      product_sku: initialSku,
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
      const selectedProd = products.find((p) => p.sku === formData.product_sku) || {};
      const payload = {
        reconciliation_number: formData.reconciliation_number,
        reconciliation_date: formData.reconciliation_date,
        warehouse: formData.warehouse,
        warehouse_name: formData.warehouse,
        location: formData.location,
        location_name: formData.location,
        product_name: selectedProd.name || "Industrial Component",
        item_name: selectedProd.name || "Industrial Component",
        sku: formData.product_sku,
        item_id: selectedProd.id,
        system_quantity: Number(formData.system_quantity),
        physical_quantity: Number(formData.physical_quantity),
        difference_quantity: Number(formData.difference_quantity),
        reason: formData.reason,
        remarks: formData.remarks,
        status: targetStatus,
      };

      const created = await createReconciliation(payload);
      setReconciliations((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setShowModal(false);
      showToast(`Reconciliation ${formData.reconciliation_number} saved as ${targetStatus}.`);
      loadData();
    } catch (err) {
      showToast("Error saving reconciliation: " + err.message);
    }
  };

  const handleSubmit = async (id) => {
    await submitReconciliation(id);
    setReconciliations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "SUBMITTED" } : r))
    );
    showToast("Reconciliation submitted for supervisory approval.");
  };

  const handleApprove = async (id) => {
    await approveReconciliation(id);
    setReconciliations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "APPROVED" } : r))
    );
    showToast("Reconciliation approved. Ready to generate stock adjustment.");
  };

  const handleGenerateAdjustment = async (id) => {
    const res = await generateReconciliationAdjustment(id);
    setReconciliations((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "ADJUSTED",
              adjustment_document_number: res.adjustment_document_number,
            }
          : r
      )
    );
    showToast(`Stock Adjustment generated (${res.adjustment_document_number || "ADJ"}). Balance updated.`);
    loadData();
  };

  const filtered = useMemo(() => {
    return reconciliations.filter((r) => {
      const q = searchTerm.trim().toLowerCase();
      const num = r.reconciliation_number || r.count_number || "";
      const prod = r.product_name || r.item_name || "";
      const sku = r.sku || r.item_code || "";
      const matchesSearch =
        !q ||
        num.toLowerCase().includes(q) ||
        prod.toLowerCase().includes(q) ||
        sku.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [reconciliations, searchTerm, statusFilter]);

  const handleExportCSV = () => {
    const headers = [
      "Reconciliation Number",
      "Reconciliation Date",
      "Warehouse",
      "Storage Location",
      "Product Name",
      "SKU",
      "System Quantity",
      "Physical Quantity",
      "Difference Quantity",
      "Reason",
      "Status",
      "Adjustment Document",
      "Remarks",
    ];
    const rows = filtered.map((r) => [
      `"${r.reconciliation_number || r.count_number}"`,
      `"${r.reconciliation_date || ""}"`,
      `"${r.warehouse_name || r.warehouse}"`,
      `"${r.location_name || r.location || ""}"`,
      `"${r.product_name || r.item_name || ""}"`,
      `"${r.sku || r.item_code || ""}"`,
      r.system_quantity,
      r.physical_quantity,
      r.difference_quantity,
      `"${r.reason || ""}"`,
      `"${r.status}"`,
      `"${r.adjustment_document_number || ""}"`,
      `"${r.remarks || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_reconciliation_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Reconciliation records exported as CSV.");
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900/95 dark:bg-white/95 text-white dark:text-zinc-900 shadow-2xl backdrop-blur-md border border-slate-700/50 dark:border-zinc-200/50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Stock Reconciliation
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
              <Scale className="h-3 w-3 text-blue-500" /> Physical vs System Audit
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Compare system stock with physically counted stock. Approved differences generate a Stock Adjustment transaction.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xs cursor-pointer transition-all"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>New Reconciliation</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Reconciliations
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            {reconciliations.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Physical audit logs</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Pending Approval
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {reconciliations.filter((r) => r.status === "SUBMITTED").length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Awaiting manager review</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Approved (Ready)
          </div>
          <div className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {reconciliations.filter((r) => r.status === "APPROVED").length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Generate adjustment ready</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Adjusted & Settled
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {reconciliations.filter((r) => r.status === "ADJUSTED").length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Adjustment transaction posted</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Reconciliation #, SKU, Product..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="ADJUSTED">Adjusted</option>
          </select>
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="whitespace-nowrap border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">Reconciliation #</th>
                <th className="py-3.5 px-3 font-semibold">Date</th>
                <th className="py-3.5 px-3 font-semibold">Warehouse / Location</th>
                <th className="py-3.5 px-3 font-semibold">Product & SKU</th>
                <th className="py-3.5 px-3 font-semibold text-right">System Qty</th>
                <th className="py-3.5 px-3 font-semibold text-right">Physical Qty</th>
                <th className="py-3.5 px-3 font-semibold text-right">Difference</th>
                <th className="py-3.5 px-3 font-semibold">Reason</th>
                <th className="py-3.5 px-3 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No reconciliation counts found. Click "New Reconciliation" to record a physical count.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const num = r.reconciliation_number || r.count_number;
                  const diff = Number(r.difference_quantity);
                  const isPositive = diff > 0;
                  const isZero = diff === 0;

                  return (
                    <tr key={r.id || num} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {num}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                        {r.reconciliation_date || "2026-10-25"}
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
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {r.product_name || r.item_name || "Industrial Component"}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {r.sku || r.item_code || "SKU-001"}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                        {r.system_quantity} EA
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                        {r.physical_quantity} EA
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
                          <span className="font-mono text-[11px] font-bold text-purple-600 dark:text-purple-400">
                            {r.adjustment_document_number || "ADJ-POSTED"}
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

      {/* Create Reconciliation Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Scale className="h-4 w-4 text-blue-600" />
                  Create Reconciliation Form
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Record physical stock count difference. Approved differences generate a Stock Adjustment.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Reconciliation Number */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Reconciliation Number *
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formData.reconciliation_number}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800/80 text-slate-900 dark:text-white font-mono cursor-not-allowed"
                  />
                </div>

                {/* 2. Reconciliation Date */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Reconciliation Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.reconciliation_date}
                    onChange={(e) => setFormData({ ...formData, reconciliation_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    value={formData.warehouse}
                    onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {warehouses.length > 0 ? (
                      warehouses.map((w) => (
                        <option key={w.id || w.name} value={w.name}>
                          {w.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Main Central Hub">Main Central Hub</option>
                        <option value="East Coast Logistics Terminal">East Coast Logistics Terminal</option>
                      </>
                    )}
                  </select>
                </div>

                {/* 4. Storage Location (Optional) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Storage Location (Optional)
                  </label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">All Locations / Entire Hub</option>
                    {locations.map((l) => (
                      <option key={l.id || l.name} value={l.name || l.code}>
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
                  value={formData.product_sku}
                  onChange={(e) => setFormData({ ...formData, product_sku: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {products.map((p) => (
                    <option key={p.id || p.sku} value={p.sku || p.code}>
                      {p.sku || p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantities Calculation: Difference = Physical - System */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800/80">
                {/* 6. System Quantity (Auto-filled) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    System Quantity *
                  </label>
                  <input
                    type="number"
                    readOnly
                    value={formData.system_quantity}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 font-mono font-bold text-slate-900 dark:text-white cursor-not-allowed"
                  />
                </div>

                {/* 7. Physical Quantity */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-200 mb-1">
                    Physical Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.physical_quantity}
                    onChange={(e) => handlePhysicalQtyChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* 8. Difference Quantity (Auto-calculated) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Difference Quantity *
                  </label>
                  <input
                    type="number"
                    readOnly
                    value={formData.difference_quantity}
                    className={`w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 font-mono font-bold cursor-not-allowed ${
                      Number(formData.difference_quantity) > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : Number(formData.difference_quantity) < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-600 dark:text-zinc-300"
                    }`}
                  />
                </div>
              </div>

              {/* 9. Reason */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Reason *
                </label>
                <select
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Physical Count Difference">Physical Count Difference</option>
                  <option value="Damage">Damage</option>
                  <option value="Loss">Loss</option>
                  <option value="Found Stock">Found Stock</option>
                  <option value="Data Correction">Data Correction</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* 10. Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Audit details, shelf location, or operator notes..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Action Buttons: Save Draft, Submit */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSave("DRAFT")}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave("SUBMITTED")}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Submit for Approval
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReconciliationPage;
