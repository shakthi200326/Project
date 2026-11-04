import React, { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  Download,
  Building2,
  Package,
  Layers,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  RefreshCw,
  X,
  Check,
} from "lucide-react";
import {
  fetchStockMovements,
  postStockTransaction,
  fetchProducts,
  fetchWarehouses,
  fetchLocations,
  updateStockTransactionStatus,
} from "../services/api";

export function OpeningStockPage() {
  const [openingRecords, setOpeningRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    item_id: "",
    warehouse_id: "",
    location_id: "",
    quantity: "",
    unit_cost: "",
    batch_number: "",
    expiry_date: "",
    serial_numbers: "",
    remarks: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [movementsRes, prodRes, whRes, locRes] = await Promise.all([
        fetchStockMovements({ type: "OPENING" }),
        fetchProducts(),
        fetchWarehouses(),
        fetchLocations(),
      ]);
      const moves = movementsRes.results || movementsRes || [];
      const openings = moves.filter((m) => m.transaction_type === "OPENING" || m.type === "OPENING");
      setOpeningRecords(openings);

      setProducts(prodRes.results || prodRes || []);
      setWarehouses(whRes.results || whRes || []);
      setLocations(locRes.results || locRes || []);
    } catch (e) {
      console.error("Failed to load opening stock data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg, isError = false) => {
    setToastMessage({ text: msg, isError });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredRecords = useMemo(() => {
    return openingRecords.filter((rec) => {
      const matchesSearch =
        !search ||
        (rec.document_number && rec.document_number.toLowerCase().includes(search.toLowerCase())) ||
        (rec.item && rec.item.toLowerCase().includes(search.toLowerCase())) ||
        (rec.item_code && rec.item_code.toLowerCase().includes(search.toLowerCase())) ||
        (rec.batch_number && rec.batch_number.toLowerCase().includes(search.toLowerCase()));

      const matchesWh =
        warehouseFilter === "ALL" ||
        String(rec.warehouse) === String(warehouseFilter) ||
        rec.warehouse_code === warehouseFilter;

      const matchesStatus = statusFilter === "ALL" || rec.status === statusFilter;

      return matchesSearch && matchesWh && matchesStatus;
    });
  }, [openingRecords, search, warehouseFilter, statusFilter]);

  const summary = useMemo(() => {
    const totalQty = filteredRecords.reduce((acc, r) => acc + Math.abs(Number(r.quantity || 0)), 0);
    const totalVal = filteredRecords.reduce((acc, r) => {
      const q = Math.abs(Number(r.quantity || 0));
      const c = Number(r.unit_cost || 0);
      return acc + q * c;
    }, 0);
    const postedCount = filteredRecords.filter((r) => r.status === "POSTED").length;
    return { count: filteredRecords.length, totalQty, totalVal, postedCount };
  }, [filteredRecords]);

  const handlePost = async (txId) => {
    try {
      await updateStockTransactionStatus(txId, "post");
      showToast("Opening stock successfully posted to immutable ledger!");
      loadData();
    } catch (e) {
      showToast(e.message || "Failed to post opening stock", true);
    }
  };

  const handleApprove = async (txId) => {
    try {
      await updateStockTransactionStatus(txId, "approve");
      showToast("Opening stock approved!");
      loadData();
    } catch (e) {
      showToast(e.message || "Failed to approve opening stock", true);
    }
  };

  const handleCreateSubmit = async (actionType = "post") => {
    setFormError("");
    if (!formData.item_id) {
      setFormError("Please select an item.");
      return;
    }
    if (!formData.warehouse_id) {
      setFormError("Please select a warehouse.");
      return;
    }
    const q = Number(formData.quantity);
    if (!q || q <= 0) {
      setFormError("Opening quantity must be strictly positive.");
      return;
    }

    setSubmitting(true);
    try {
      const serialList = formData.serial_numbers
        ? formData.serial_numbers.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const payload = {
        transaction_type: "OPENING",
        warehouse: Number(formData.warehouse_id),
        transaction_date: new Date().toISOString().slice(0, 10),
        reason: formData.remarks || "Fiscal Year Initial Balance",
        lines: [
          {
            item: Number(formData.item_id),
            location: formData.location_id ? Number(formData.location_id) : null,
            quantity: q,
            unit_cost: Number(formData.unit_cost || 0),
            batch_number: formData.batch_number || "",
            expiry_date: formData.expiry_date || null,
            serial_numbers: serialList,
          },
        ],
      };

      await postStockTransaction(payload, actionType);
      showToast(`Opening Stock successfully ${actionType === "post" ? "posted" : "drafted"}!`);
      setShowCreateModal(false);
      setFormData({
        item_id: "",
        warehouse_id: "",
        location_id: "",
        quantity: "",
        unit_cost: "",
        batch_number: "",
        expiry_date: "",
        serial_numbers: "",
        remarks: "",
      });
      loadData();
    } catch (e) {
      setFormError(e.message || "Failed to submit opening stock");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-xl border ${
            toastMessage.isError
              ? "bg-rose-950 text-rose-200 border-rose-800"
              : "bg-emerald-950 text-emerald-200 border-emerald-800"
          }`}
        >
          {toastMessage.isError ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          {toastMessage.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Opening Stock</h1>
              <p className="text-sm text-slate-400">
                Initialize inventory baseline balances with central double-entry ledger posting and valuation setup.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition"
          >
            <Plus className="h-4 w-4" />
            New Opening Stock
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Package className="h-4 w-4 text-purple-400" />
            Total Initialized Units
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{summary.totalQty.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Across {summary.count} entries</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            Opening Valuation
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">${summary.totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-xs text-slate-500">Total initial asset cost</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <CheckCircle2 className="h-4 w-4 text-blue-400" />
            Posted Entries
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-400">{summary.postedCount}</div>
          <div className="text-xs text-slate-500">Committed to stock ledger</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Building2 className="h-4 w-4 text-cyan-400" />
            Active Facilities
          </div>
          <div className="mt-2 text-2xl font-bold text-cyan-400">{warehouses.length}</div>
          <div className="text-xs text-slate-500">Configured warehouses</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by opening reference, item name, code, or batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} - {wh.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="POSTED">Posted</option>
            </select>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-800/60 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Document No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Warehouse & Loc</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Unit Cost</th>
                <th className="py-3 px-4 text-right">Total Cost</th>
                <th className="py-3 px-4">Batch / Serials</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400">
                    Loading opening stock balances...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400">
                    No opening stock records found. Click "+ New Opening Stock" to initialize baseline items.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const qty = Math.abs(Number(rec.quantity || 0));
                  const cost = Number(rec.unit_cost || 0);
                  const total = qty * cost;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-medium text-purple-400">{rec.document_number}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">{rec.transaction_date || rec.created_at?.slice(0, 10)}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100">{rec.item || "—"}</div>
                        <div className="text-xs font-mono text-slate-400">{rec.item_code || "—"}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-slate-200">{rec.warehouse_name || rec.warehouse_code || "—"}</div>
                        <div className="text-slate-500">{rec.location || "Default Loc"}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                        {qty.toLocaleString()} {rec.unit || "EA"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">${cost.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-100">${total.toFixed(2)}</td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-400">
                        {rec.batch_number ? <span className="text-amber-400">B: {rec.batch_number}</span> : null}
                        {rec.serial_number ? <span className="text-cyan-400 ml-1">S: {rec.serial_number}</span> : null}
                        {!rec.batch_number && !rec.serial_number ? "—" : null}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            rec.status === "POSTED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : rec.status === "APPROVED"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : rec.status === "SUBMITTED"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {rec.status === "DRAFT" || rec.status === "SUBMITTED" ? (
                          <button
                            onClick={() => handleApprove(rec.id)}
                            className="mr-2 text-xs font-medium text-blue-400 hover:text-blue-300 underline"
                          >
                            Approve
                          </button>
                        ) : null}
                        {rec.status === "APPROVED" ? (
                          <button
                            onClick={() => handlePost(rec.id)}
                            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 underline"
                          >
                            Post to Stock
                          </button>
                        ) : null}
                        {rec.status === "POSTED" ? (
                          <span className="text-xs text-slate-500">Immutable</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-purple-400" />
                <h2 className="text-lg font-bold text-white">Create Opening Stock Entry</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-950/80 border border-rose-800 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Select Item *</label>
                <select
                  value={formData.item_id}
                  onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
                >
                  <option value="">-- Choose Item --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Warehouse *</label>
                <select
                  value={formData.warehouse_id}
                  onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
                >
                  <option value="">-- Choose Warehouse --</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Storage Location</label>
                <select
                  value={formData.location_id}
                  onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
                >
                  <option value="">-- Default Location --</option>
                  {locations
                    .filter((l) => !formData.warehouse_id || String(l.warehouse) === String(formData.warehouse_id))
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.code} - {loc.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Opening Quantity *</label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  placeholder="e.g. 100"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Unit Cost ($)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 25.50"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Batch Number (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. BATCH-2026-INIT"
                  value={formData.batch_number}
                  onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Serial Numbers (comma-separated, optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SN-1001, SN-1002, SN-1003"
                  value={formData.serial_numbers}
                  onChange={(e) => setFormData({ ...formData, serial_numbers: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Remarks / Fiscal Ref</label>
                <textarea
                  rows="2"
                  placeholder="Initial balance reason, source audit sheet, or migration note..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleCreateSubmit("save_draft")}
                className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 transition"
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleCreateSubmit("post")}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition"
              >
                {submitting ? "Posting..." : "Post to Stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OpeningStockPage;

