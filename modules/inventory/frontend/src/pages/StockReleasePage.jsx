import React, { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  BookmarkCheck,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Package,
  Layers,
  Calendar,
  AlertCircle,
  X,
  Unlock,
} from "lucide-react";
import {
  fetchReservations,
  releaseReservation,
  fetchWarehouses,
} from "../services/api";

export function StockReleasePage() {
  const [reservations, setReservations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [toastMessage, setToastMessage] = useState(null);

  // Modal State
  const [selectedRes, setSelectedRes] = useState(null);
  const [releaseQuantity, setReleaseQuantity] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [releaseRemarks, setReleaseRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [resData, whData] = await Promise.all([
        fetchReservations(),
        fetchWarehouses(),
      ]);
      const resList = resData.results || resData || [];
      setReservations(Array.isArray(resList) ? resList : []);
      const whList = whData.results || whData || [];
      setWarehouses(Array.isArray(whList) ? whList : []);
    } catch (e) {
      console.error("Failed to load reservations for release", e);
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

  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      const matchesSearch =
        !search ||
        (r.reservation_number && r.reservation_number.toLowerCase().includes(search.toLowerCase())) ||
        (r.reference_number && r.reference_number.toLowerCase().includes(search.toLowerCase())) ||
        (r.product_name && r.product_name.toLowerCase().includes(search.toLowerCase())) ||
        (r.sku && r.sku.toLowerCase().includes(search.toLowerCase())) ||
        (r.remarks && r.remarks.toLowerCase().includes(search.toLowerCase()));

      const matchesWh =
        warehouseFilter === "ALL" ||
        String(r.warehouse) === String(warehouseFilter) ||
        r.warehouse_code === warehouseFilter;

      let matchesStatus = true;
      if (statusFilter === "ACTIVE") {
        matchesStatus = r.status === "RESERVED" || r.status === "PARTIALLY_FULFILLED";
      } else if (statusFilter !== "ALL") {
        matchesStatus = r.status === statusFilter;
      }

      return matchesSearch && matchesWh && matchesStatus;
    });
  }, [reservations, search, warehouseFilter, statusFilter]);

  const summary = useMemo(() => {
    const activeList = reservations.filter((r) => r.status === "RESERVED" || r.status === "PARTIALLY_FULFILLED");
    const totalReservedUnits = activeList.reduce((acc, r) => {
      const original = Number(r.quantity || r.reservation_quantity || 0);
      const released = Number(r.released_quantity || 0);
      const rem = r.remaining_quantity !== undefined ? Number(r.remaining_quantity) : Math.max(0, original - released);
      return acc + rem;
    }, 0);
    const fullyReleasedCount = reservations.filter((r) => r.status === "RELEASED").length;
    return {
      activeCount: activeList.length,
      totalReservedUnits,
      fullyReleasedCount,
      totalCount: reservations.length,
    };
  }, [reservations]);

  const openReleaseModal = (res) => {
    setSelectedRes(res);
    const orig = Number(res.quantity || res.reservation_quantity || 0);
    const rel = Number(res.released_quantity || 0);
    const remaining = res.remaining_quantity !== undefined ? Number(res.remaining_quantity) : Math.max(0, orig - rel);
    setReleaseQuantity(String(remaining));
    setReleaseReason("Customer Cancellation");
    setReleaseRemarks("");
    setModalError("");
  };

  const handleExecuteRelease = async () => {
    setModalError("");
    const q = Number(releaseQuantity);
    if (!q || q <= 0) {
      setModalError("Release quantity must be strictly positive.");
      return;
    }
    const orig = Number(selectedRes.quantity || selectedRes.reservation_quantity || 0);
    const rel = Number(selectedRes.released_quantity || 0);
    const remaining = selectedRes.remaining_quantity !== undefined ? Number(selectedRes.remaining_quantity) : Math.max(0, orig - rel);

    if (q > remaining) {
      setModalError(`Cannot release ${q} units; remaining reserved stock is only ${remaining}.`);
      return;
    }

    setSubmitting(true);
    try {
      await releaseReservation(selectedRes.id, {
        release_quantity: q,
        reason: releaseReason,
        remarks: releaseRemarks,
      });
      showToast(`Successfully released ${q} units of reserved stock! Available balance updated.`);
      setSelectedRes(null);
      loadData();
    } catch (e) {
      setModalError(e.message || "Failed to release reservation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
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
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Unlock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Stock Release Management</h1>
              <p className="text-sm text-slate-400">
                Unlock active soft-reservations back into available stock on order cancellation, priority change or expiry.
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
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <BookmarkCheck className="h-4 w-4 text-amber-400" />
            Active Reservations
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{summary.activeCount}</div>
          <div className="text-xs text-slate-500">Awaiting dispatch or release</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Package className="h-4 w-4 text-purple-400" />
            Total Locked Units
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-400">{summary.totalReservedUnits.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Currently unavailable for general issue</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Completed Releases
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">{summary.fullyReleasedCount}</div>
          <div className="text-xs text-slate-500">Fully returned to available pool</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Layers className="h-4 w-4 text-blue-400" />
            Total Life Records
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-400">{summary.totalCount}</div>
          <div className="text-xs text-slate-500">Complete reservation history</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by reservation number, order reference, product or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
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
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ACTIVE">Active (Reserved / Partial)</option>
              <option value="ALL">All Statuses</option>
              <option value="RELEASED">Released</option>
              <option value="FULFILLED">Fulfilled (Issued)</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-800/60 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Reservation No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Warehouse & Loc</th>
                <th className="py-3 px-4 text-right">Original Qty</th>
                <th className="py-3 px-4 text-right">Released Qty</th>
                <th className="py-3 px-4 text-right">Remaining Locked</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    Loading reservation records...
                  </td>
                </tr>
              ) : filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No matching reservations found.
                  </td>
                </tr>
              ) : (
                filteredReservations.map((res) => {
                  const orig = Number(res.quantity || res.reservation_quantity || 0);
                  const rel = Number(res.released_quantity || 0);
                  const rem = res.remaining_quantity !== undefined ? Number(res.remaining_quantity) : Math.max(0, orig - rel);
                  const canRelease = (res.status === "RESERVED" || res.status === "PARTIALLY_FULFILLED") && rem > 0;

                  return (
                    <tr key={res.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-medium text-emerald-400">
                        {res.reservation_number || res.reference_doc}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">{res.reservation_date || res.created_at?.slice(0, 10)}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100">{res.product_name || res.item_name || "—"}</div>
                        <div className="text-xs font-mono text-slate-400">{res.sku || res.item_code || "—"}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-slate-200">{res.warehouse_name || res.warehouse_code || "—"}</div>
                        <div className="text-slate-500">{res.location_name || res.location || "Default Loc"}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">{orig.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">{rel.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-amber-400">{rem.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            res.status === "RESERVED"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : res.status === "PARTIALLY_FULFILLED"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : res.status === "RELEASED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {res.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {canRelease ? (
                          <button
                            onClick={() => openReleaseModal(res)}
                            className="inline-flex items-center gap-1 rounded bg-emerald-600/20 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-600 hover:text-white transition"
                          >
                            <Unlock className="h-3 w-3" />
                            Release
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
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

      {/* Release Modal */}
      {selectedRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Unlock className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Release Stock Reservation</h2>
              </div>
              <button
                onClick={() => setSelectedRes(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-950/80 border border-rose-800 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-slate-800/60 p-3 border border-slate-800 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block">Reservation Ref:</span>
                  <span className="text-emerald-400 font-mono font-medium">{selectedRes.reservation_number}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Item:</span>
                  <span className="text-slate-200">{selectedRes.product_name || selectedRes.item_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Warehouse:</span>
                  <span className="text-slate-200">{selectedRes.warehouse_code}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Remaining Locked:</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {selectedRes.remaining_quantity !== undefined ? selectedRes.remaining_quantity : selectedRes.quantity} EA
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Release Quantity *</label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={releaseQuantity}
                  onChange={(e) => setReleaseQuantity(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Enter partial or full quantity to release. Cannot exceed remaining locked quantity.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Release Reason *</label>
                <select
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Customer Cancellation">Customer Cancellation</option>
                  <option value="Order Modification">Order Modification (Reduced Qty)</option>
                  <option value="Reservation Expired">Reservation Expired</option>
                  <option value="Priority Reallocation">Priority Reallocation</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Remarks</label>
                <textarea
                  rows="2"
                  placeholder="Audit reason, sales ticket reference, or manager approval note..."
                  value={releaseRemarks}
                  onChange={(e) => setReleaseRemarks(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setSelectedRes(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleExecuteRelease}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition"
              >
                {submitting ? "Releasing..." : "Confirm Release"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockReleasePage;
