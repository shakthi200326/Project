import React, { useState, useEffect } from "react";
import { BookmarkCheck, Clock, CheckCircle2, XCircle, AlertCircle, Download, Plus, ArrowRight, X } from "lucide-react";
import { fetchReservations } from "../services/api";

export function StockReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRes, setNewRes] = useState({ reference_doc: "", item_sku: "BRG-6205-2RS", quantity: 10, warehouse: "Main Central Hub", expires_days: 7 });

  useEffect(() => {
    fetchReservations().then((res) => {
      const items = (res.results || []).map((r) => ({
        id: r.id,
        reference_doc: r.reference_doc,
        item_sku: r.item_code || r.item_sku || "SKU-ITEM",
        item_name: r.item || r.item_name || "Stock Item",
        warehouse: r.warehouse || "Main Central Hub",
        quantity: r.quantity,
        unit: "EA",
        status: r.status,
        expires_at: r.expires_at || "2026-11-10T12:00:00Z",
      }));
      setReservations(items);
    });
  }, []);

  const handleRelease = (id) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "RELEASED" } : r))
    );
  };

  const handleFulfill = (id) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "FULFILLED" } : r))
    );
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newRes.reference_doc) return;
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + Number(newRes.expires_days));
    
    const created = {
      id: `res-${Date.now()}`,
      reference_doc: newRes.reference_doc,
      item_sku: newRes.item_sku,
      item_name: newRes.item_sku === "BRG-6205-2RS" ? "Industrial Ball Bearing 6205-2RS" : "Hydraulic Valve",
      warehouse: newRes.warehouse,
      quantity: Number(newRes.quantity),
      unit: "EA",
      status: "PENDING",
      expires_at: expDate.toISOString(),
    };
    setReservations((prev) => [created, ...prev]);
    setIsModalOpen(false);
    setNewRes({ reference_doc: "", item_sku: "BRG-6205-2RS", quantity: 10, warehouse: "Main Central Hub", expires_days: 7 });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Stock Reservations & Order Holds
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Soft and hard inventory allocations, sales order commitments, and expiration schedules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert("Exporting reservation register to CSV...")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Reservation Hold</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-zinc-400">Active Pending Holds</span>
          <div className="text-2xl font-bold tabular-nums text-purple-600 dark:text-purple-400 mt-1">
            {reservations.filter((r) => r.status === "PENDING").length} orders
          </div>
          <span className="text-[11px] text-slate-400">Locked against dispatch</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-zinc-400">Total Units Reserved</span>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            {reservations
              .filter((r) => r.status === "PENDING")
              .reduce((acc, r) => acc + r.quantity, 0)}{" "}
            EA
          </div>
          <span className="text-[11px] text-slate-400">Deducted from available balance</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-zinc-400">Fulfilled Rate</span>
          <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            96.8%
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">On-time fulfillment</span>
        </div>
      </div>

      {/* Reservations Table */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/40 text-slate-500 dark:text-zinc-400">
                <th className="py-3 px-4 font-semibold">Reference Document</th>
                <th className="py-3 px-4 font-semibold">Product Item</th>
                <th className="py-3 px-4 font-semibold">Warehouse</th>
                <th className="py-3 px-4 font-semibold text-right">Reserved Qty</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Hold Expiration</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {reservations.map((res) => (
                <tr key={res.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                    {res.reference_doc}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900 dark:text-zinc-100">{res.item_name}</div>
                    <div className="font-mono text-[10px] text-slate-400">{res.item_sku}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                    {res.warehouse}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-purple-600 dark:text-purple-400">
                    {res.quantity} {res.unit}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        res.status === "PENDING"
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400"
                          : res.status === "FULFILLED"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {res.status === "PENDING" && <Clock className="h-3 w-3" />}
                      {res.status === "FULFILLED" && <CheckCircle2 className="h-3 w-3" />}
                      {res.status === "RELEASED" && <XCircle className="h-3 w-3" />}
                      {res.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                    {new Date(res.expires_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {res.status === "PENDING" && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRelease(res.id)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-zinc-800 text-rose-600 hover:bg-rose-50 text-[11px] font-medium"
                        >
                          Release Hold
                        </button>
                        <button
                          onClick={() => handleFulfill(res.id)}
                          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium"
                        >
                          Fulfill & Dispatch
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookmarkCheck className="h-4 w-4 text-purple-600" />
                Create Stock Reservation Hold
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Sales / Work Order Reference *
                </label>
                <input
                  type="text"
                  required
                  value={newRes.reference_doc}
                  onChange={(e) => setNewRes({ ...newRes, reference_doc: e.target.value })}
                  placeholder="e.g. SO-2026-8910"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  SKU to Allocate *
                </label>
                <select
                  value={newRes.item_sku}
                  onChange={(e) => setNewRes({ ...newRes, item_sku: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                >
                  <option value="BRG-6205-2RS">BRG-6205-2RS - Industrial Ball Bearing (Avail: 405)</option>
                  <option value="HYD-SV-24V">HYD-SV-24V - Hydraulic Solenoid Valve (Avail: 12)</option>
                  <option value="BELT-T10-1200">BELT-T10-1200 - Timing Belt (Avail: 260)</option>
                  <option value="LUB-SYN-VG46">LUB-SYN-VG46 - Synthetic Lubricant (Avail: 1,150)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Hold Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newRes.quantity}
                    onChange={(e) => setNewRes({ ...newRes, quantity: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Expires In (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={newRes.expires_days}
                    onChange={(e) => setNewRes({ ...newRes, expires_days: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600"
                >
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">
                  Lock Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
