import React, { useState, useEffect } from "react";
import {
  X,
  Building2,
  Calendar,
  Clock,
  Truck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  Send,
  Check,
  Package,
  Layers,
  MapPin,
  AlertTriangle,
  History,
  Info,
} from "lucide-react";
import {
  fetchTransfer,
  submitTransfer,
  approveTransfer,
  rejectTransfer,
  dispatchTransfer,
  receiveTransfer,
  completeTransfer,
  cancelTransfer,
  fetchTransferHistory,
} from "../services/transferApi";

const STATUS_CONFIG = {
  DRAFT: { label: "Draft", bg: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  SUBMITTED: { label: "Submitted", bg: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  APPROVED: { label: "Approved", bg: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  DISPATCHED: { label: "Dispatched", bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  IN_TRANSIT: { label: "In-Transit", bg: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  RECEIVED: { label: "Received", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  COMPLETED: { label: "Completed", bg: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  REJECTED: { label: "Rejected", bg: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  CANCELLED: { label: "Cancelled", bg: "bg-slate-700/30 text-slate-500 border-slate-700" },
};

const WORKFLOW_STEPS = ["DRAFT", "SUBMITTED", "APPROVED", "DISPATCHED", "IN_TRANSIT", "RECEIVED", "COMPLETED"];

export function TransferDetailsModal({ transferId, isOpen, onClose, onRefresh }) {
  const [transfer, setTransfer] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("items"); // 'items' | 'history' | 'receive'
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Receiving state
  const [receiptLines, setReceiptLines] = useState([]);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showCancelInput, setShowCancelInput] = useState(false);

  useEffect(() => {
    if (isOpen && transferId) {
      loadTransferData();
    } else {
      setTransfer(null);
      setHistory([]);
      setError(null);
      setSuccessMsg(null);
      setShowRejectInput(false);
      setShowCancelInput(false);
    }
  }, [isOpen, transferId]);

  const loadTransferData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTransfer(transferId);
      setTransfer(data);

      // Pre-fill receipt lines with remaining/dispatched quantities
      if (data.lines) {
        setReceiptLines(
          data.lines.map((l) => {
            const requested = Number(l.quantity || 0);
            return {
              line_id: l.id,
              product_name: l.product_name,
              sku: l.sku,
              requested_qty: requested,
              received_quantity: Number(l.received_quantity || requested),
              shortage_quantity: Number(l.shortage_quantity || 0),
              damaged_quantity: Number(l.damaged_quantity || 0),
              notes: "",
            };
          })
        );
      }

      try {
        const histData = await fetchTransferHistory(transferId);
        setHistory(Array.isArray(histData) ? histData : histData.history || []);
      } catch (e) {
        console.warn("Could not load transfer history", e);
      }
    } catch (err) {
      setError(err.message || "Failed to load transfer details");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionFn, ...args) => {
    try {
      setActionLoading(true);
      setError(null);
      await actionFn(transferId, ...args);
      setSuccessMsg("Transfer workflow updated successfully");
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadTransferData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceiveSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError(null);
      const payload = receiptLines.map((l) => ({
        line_id: l.line_id,
        received_quantity: Number(l.received_quantity) || 0,
        shortage_quantity: Number(l.shortage_quantity) || 0,
        damaged_quantity: Number(l.damaged_quantity) || 0,
        notes: l.notes || "",
      }));
      await receiveTransfer(transferId, payload);
      setSuccessMsg("Goods successfully received and discrepancies logged.");
      setActiveTab("items");
      await loadTransferData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Failed to process receipt");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentStepIdx = WORKFLOW_STEPS.indexOf(transfer?.status);
  const isInterWarehouse = transfer?.source_warehouse !== transfer?.destination_warehouse;
  const isSameCity = transfer?.transfer_scope === "SAME_CITY";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {transfer?.document_number || "Stock Transfer Details"}
                </h2>
                {transfer && (
                  <span
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                      STATUS_CONFIG[transfer.status]?.bg || "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {transfer.status}
                  </span>
                )}
                {transfer?.transfer_scope && (
                  <span
                    className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                      isSameCity
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    }`}
                  >
                    {isSameCity ? "Same-City" : "Inter-City"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Reference: {transfer?.source_document_number || "Direct"} • Created{" "}
                {transfer?.transaction_date || transfer?.created_at?.slice(0, 10)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Loading transfer data...</p>
            </div>
          ) : transfer ? (
            <>
              {/* Stepper Progress */}
              {transfer.status !== "REJECTED" && transfer.status !== "CANCELLED" && (
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between relative">
                    <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 h-0.5 bg-slate-800 -z-0" />
                    {WORKFLOW_STEPS.map((step, idx) => {
                      const isCompleted = currentStepIdx > idx;
                      const isCurrent = currentStepIdx === idx;
                      return (
                        <div key={step} className="flex flex-col items-center z-10 bg-slate-900 px-2">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                              isCompleted
                                ? "bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/20"
                                : isCurrent
                                ? "bg-blue-600 text-white border-blue-400 ring-4 ring-blue-500/20"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                          </div>
                          <span
                            className={`text-[10px] mt-1.5 font-medium tracking-tight whitespace-nowrap ${
                              isCurrent ? "text-blue-400 font-bold" : isCompleted ? "text-slate-300" : "text-slate-500"
                            }`}
                          >
                            {step.replace("_", " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Warehouse Route Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    Source (Origin) Warehouse
                  </span>
                  <div className="text-base font-bold text-white">
                    {transfer.source_warehouse_name || `Warehouse #${transfer.source_warehouse}`}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-800/60 font-mono">
                      {transfer.source_warehouse_code || "WH-SRC"}
                    </span>
                    <span>City: <strong className="text-slate-200">{transfer.source_city || "Chennai"}</strong></span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    Destination Warehouse
                  </span>
                  <div className="text-base font-bold text-white">
                    {transfer.destination_warehouse_name || `Warehouse #${transfer.destination_warehouse}`}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-800/60 font-mono">
                      {transfer.destination_warehouse_code || "WH-DST"}
                    </span>
                    <span>City: <strong className="text-slate-200">{transfer.destination_city || "Coimbatore"}</strong></span>
                  </div>
                </div>
              </div>

              {/* Summary Metric Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950/30 border border-slate-800 rounded-lg text-center">
                  <div className="text-xs text-slate-400">Total Items</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {transfer.lines?.length || 0}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/30 border border-slate-800 rounded-lg text-center">
                  <div className="text-xs text-slate-400">Total Quantity</div>
                  <div className="text-lg font-bold text-blue-400 mt-0.5">
                    {transfer.lines?.reduce((sum, l) => sum + Number(l.quantity || 0), 0) || 0}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/30 border border-slate-800 rounded-lg text-center">
                  <div className="text-xs text-slate-400">Scope</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">
                    {transfer.transfer_scope === "SAME_CITY" ? "Same-City" : "Inter-City"}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/30 border border-slate-800 rounded-lg text-center">
                  <div className="text-xs text-slate-400">Transit Status</div>
                  <div className="text-sm font-bold text-purple-400 mt-1">
                    {transfer.in_transit_status || (transfer.status === "IN_TRANSIT" ? "ON_ROAD" : "N/A")}
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-800">
                <button
                  onClick={() => setActiveTab("items")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                    activeTab === "items"
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Transfer Items ({transfer.lines?.length || 0})
                </button>
                {transfer.status === "IN_TRANSIT" && (
                  <button
                    onClick={() => setActiveTab("receive")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-1.5 ${
                      activeTab === "receive"
                        ? "border-emerald-500 text-emerald-400"
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Package className="w-4 h-4 text-emerald-400" />
                    Receive Shipment
                  </button>
                )}
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                    activeTab === "history"
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Audit History
                </button>
              </div>

              {/* TAB 1: Transfer Items Table */}
              {activeTab === "items" && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/30">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-slate-900/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Product / SKU</th>
                          <th className="px-4 py-3 text-right">Transfer Qty</th>
                          <th className="px-4 py-3 text-right">Received</th>
                          <th className="px-4 py-3 text-right">Shortage</th>
                          <th className="px-4 py-3 text-right">Damaged</th>
                          <th className="px-4 py-3 text-center">UOM</th>
                          <th className="px-4 py-3">Batch / Serial</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {transfer.lines?.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                              No items added to this transfer yet.
                            </td>
                          </tr>
                        ) : (
                          transfer.lines?.map((line, idx) => (
                            <tr key={line.id || idx} className="hover:bg-slate-900/40">
                              <td className="px-4 py-3 font-mono text-xs text-slate-500">{idx + 1}</td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-white">{line.product_name}</div>
                                <div className="text-xs text-slate-400 font-mono">
                                  SKU: {line.sku || "N/A"}
                                  {line.variant_name && ` • Variant: ${line.variant_name}`}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-white">
                                {line.quantity}
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-400">
                                {line.received_quantity ?? line.accepted_quantity ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-right text-amber-400">
                                {Number(line.shortage_quantity) > 0 ? line.shortage_quantity : "—"}
                              </td>
                              <td className="px-4 py-3 text-right text-rose-400">
                                {Number(line.damaged_quantity) > 0 ? line.damaged_quantity : "—"}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-300">
                                  {line.uom || "Nos"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                                {line.batch_number ? `Batch: ${line.batch_number}` : line.serial_number || "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: Receive Shipment Form */}
              {activeTab === "receive" && (
                <form onSubmit={handleReceiveSubmit} className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs">
                    Confirm received quantities for destination warehouse. Any shortage or damage will automatically update ledger discrepancy and quarantine damaged stock.
                  </div>

                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900 text-xs text-slate-400 uppercase tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="px-3 py-3">Product</th>
                            <th className="px-3 py-3 text-right">Requested</th>
                            <th className="px-3 py-3 text-right">Received Qty</th>
                            <th className="px-3 py-3 text-right">Shortage</th>
                            <th className="px-3 py-3 text-right">Damaged</th>
                            <th className="px-3 py-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {receiptLines.map((line, idx) => (
                            <tr key={line.line_id || idx}>
                              <td className="px-3 py-3">
                                <div className="font-medium text-white">{line.product_name}</div>
                                <div className="text-xs text-slate-400 font-mono">SKU: {line.sku}</div>
                              </td>
                              <td className="px-3 py-3 text-right font-semibold text-slate-300">
                                {line.requested_qty}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  max={line.requested_qty}
                                  value={line.received_quantity}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setReceiptLines((prev) =>
                                      prev.map((r, i) =>
                                        i === idx
                                          ? {
                                              ...r,
                                              received_quantity: val,
                                              shortage_quantity: Math.max(0, r.requested_qty - val),
                                            }
                                          : r
                                      )
                                    );
                                  }}
                                  className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-right text-white focus:outline-none focus:border-emerald-500 font-semibold"
                                  required
                                />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={line.shortage_quantity}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setReceiptLines((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, shortage_quantity: val } : r))
                                    );
                                  }}
                                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-right text-amber-400 focus:outline-none focus:border-amber-500"
                                />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={line.damaged_quantity}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setReceiptLines((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, damaged_quantity: val } : r))
                                    );
                                  }}
                                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-right text-rose-400 focus:outline-none focus:border-rose-500"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <input
                                  type="text"
                                  placeholder="Optional note"
                                  value={line.notes}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setReceiptLines((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, notes: val } : r))
                                    );
                                  }}
                                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("items")}
                      className="px-4 py-2 text-sm bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                    >
                      {actionLoading ? "Confirming Receipt..." : "Confirm Receipt & Post Stock"}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: History */}
              {activeTab === "history" && (
                <div className="space-y-3">
                  {history.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 border border-slate-800 rounded-xl">
                      No status transitions recorded for this transfer yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((h, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-sm"
                        >
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">
                                {h.from_status ? `${h.from_status} → ${h.to_status}` : h.to_status || "Event"}
                              </span>
                              <span className="text-xs text-slate-500">{h.created_at || "Recent"}</span>
                            </div>
                            {h.notes && <p className="text-xs text-slate-400 mt-1">{h.notes}</p>}
                            <div className="text-[11px] text-slate-500 mt-0.5">By: {h.user || "System"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer / Workflow Action Buttons */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Rejection / Cancel Inputs */}
            {showRejectInput && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-rose-500/50 rounded-lg text-xs text-white focus:outline-none"
                />
                <button
                  onClick={() => {
                    handleAction(rejectTransfer, rejectReason);
                    setShowRejectInput(false);
                  }}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-500 disabled:opacity-50"
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => setShowRejectInput(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}

            {showCancelInput && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Reason for cancellation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                />
                <button
                  onClick={() => {
                    handleAction(cancelTransfer, cancelReason);
                    setShowCancelInput(false);
                  }}
                  disabled={actionLoading || !cancelReason.trim()}
                  className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-600 disabled:opacity-50"
                >
                  Confirm Cancel
                </button>
                <button
                  onClick={() => setShowCancelInput(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition"
            >
              Close
            </button>

            {/* Workflow Action Triggers */}
            {transfer?.status === "DRAFT" && (
              <>
                <button
                  onClick={() => setShowCancelInput(true)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 text-sm bg-slate-800 text-rose-400 border border-rose-500/20 rounded-xl hover:bg-rose-500/10 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction(submitTransfer)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-500 shadow-md shadow-blue-600/20 transition flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  Submit Transfer
                </button>
              </>
            )}

            {transfer?.status === "SUBMITTED" && (
              <>
                <button
                  onClick={() => setShowRejectInput(true)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 text-sm bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 transition"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction(approveTransfer)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-500 shadow-md shadow-blue-600/20 transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve Transfer
                </button>
              </>
            )}

            {transfer?.status === "APPROVED" && (
              <button
                onClick={() => handleAction(dispatchTransfer)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5"
              >
                <Truck className="w-4 h-4" />
                Dispatch Shipment
              </button>
            )}

            {transfer?.status === "IN_TRANSIT" && (
              <button
                onClick={() => setActiveTab("receive")}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
              >
                <Package className="w-4 h-4" />
                Receive Goods
              </button>
            )}

            {transfer?.status === "RECEIVED" && (
              <button
                onClick={() => handleAction(completeTransfer)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-500 shadow-md shadow-teal-600/20 transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark Completed
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

