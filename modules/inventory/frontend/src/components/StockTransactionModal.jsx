import React, { useState } from "react";
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  Save,
  AlertCircle,
  Building2,
  MapPin,
  Calendar,
  Hash,
  DollarSign,
  FileText,
} from "lucide-react";

export function StockTransactionModal({ isOpen, initialType = "RECEIPT", onClose, onPosted }) {
  const [txType, setTxType] = useState(initialType);
  const [formData, setFormData] = useState({
    warehouse: "Main Central Fulfillment Hub",
    destWarehouse: "East Coast Logistics Terminal",
    location: "Aisle 3 - Rack B",
    destLocation: "Bay 1 - Bin 04",
    itemSku: "BRG-6205-2RS",
    quantity: 10,
    unitCost: 14.85,
    batchNumber: "BATCH-2026-X1",
    expiryDate: "2027-10-31",
    reason: "Standard Supplier Goods Receipt",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.quantity || Number(formData.quantity) <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    setError("");
    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);
      const docNum = `DEMO-INV-${Math.floor(1000 + Math.random() * 9000)}`;
      if (onPosted) {
        onPosted({
          id: `tx-${Date.now()}`,
          document_number: docNum,
          type: txType,
          item: formData.itemSku,
          warehouse: formData.warehouse,
          location: formData.location,
          quantity: txType === "ISSUE" ? -Number(formData.quantity) : Number(formData.quantity),
          unit: "EA",
          unit_cost: Number(formData.unitCost) || 14.85,
          status: "POSTED",
          created_at: new Date().toISOString(),
        });
      }
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold shadow-xs ${
                txType === "RECEIPT"
                  ? "bg-emerald-600"
                  : txType === "ISSUE"
                  ? "bg-rose-600"
                  : txType === "TRANSFER"
                  ? "bg-blue-600"
                  : "bg-amber-600"
              }`}
            >
              {txType === "RECEIPT" && <ArrowDownLeft className="h-5 w-5" />}
              {txType === "ISSUE" && <ArrowUpRight className="h-5 w-5" />}
              {txType === "TRANSFER" && <ArrowLeftRight className="h-5 w-5" />}
              {txType === "ADJUSTMENT" && <SlidersHorizontal className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                New Stock Transaction
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Atomic ledger posting with real-time balance validation & WAV recalculation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Transaction Type Selector */}
        <div className="grid grid-cols-4 p-2 gap-1 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 text-xs">
          {[
            { key: "RECEIPT", label: "Goods Receipt", icon: ArrowDownLeft },
            { key: "ISSUE", label: "Stock Issue", icon: ArrowUpRight },
            { key: "TRANSFER", label: "Transfer", icon: ArrowLeftRight },
            { key: "ADJUSTMENT", label: "Adjustment", icon: SlidersHorizontal },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTxType(t.key)}
                className={`py-2 px-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  txType === t.key
                    ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="m-5 mb-0 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 text-xs">
            {/* Item & Quantity Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Product Item <span className="text-rose-500">*</span>
                </label>
                <select
                  name="itemSku"
                  value={formData.itemSku}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="BRG-6205-2RS">BRG-6205-2RS (Ball Bearing)</option>
                  <option value="HYD-SV-24V">HYD-SV-24V (Solenoid Valve)</option>
                  <option value="BELT-T10-1200">BELT-T10-1200 (Timing Belt)</option>
                  <option value="LUB-SYN-VG46">LUB-SYN-VG46 (Synthetic Oil)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Quantity ({txType === "ISSUE" ? "Issue Units" : "Units"}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-mono focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Warehouse & Location */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  {txType === "TRANSFER" ? "Source Warehouse" : "Target Warehouse"}
                </label>
                <select
                  name="warehouse"
                  value={formData.warehouse}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Main Central Fulfillment Hub">Main Central Fulfillment Hub</option>
                  <option value="East Coast Logistics Terminal">East Coast Logistics Terminal</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Storage Bin / Rack
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Transfer destination if Transfer */}
            {txType === "TRANSFER" && (
              <div className="grid grid-cols-2 gap-4 p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
                <div>
                  <label className="block font-medium text-blue-900 dark:text-blue-200 mb-1">
                    Destination Facility
                  </label>
                  <select
                    name="destWarehouse"
                    value={formData.destWarehouse}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                  >
                    <option value="East Coast Logistics Terminal">East Coast Logistics Terminal</option>
                    <option value="Cold Storage Facility">Cold Storage Facility</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-blue-900 dark:text-blue-200 mb-1">
                    Destination Bin
                  </label>
                  <input
                    type="text"
                    name="destLocation"
                    value={formData.destLocation}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>
            )}

            {/* Receipt Details: Cost & Batch */}
            {txType === "RECEIPT" && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Unit Purchase Cost ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="unitCost"
                    value={formData.unitCost}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Batch / Lot Number
                  </label>
                  <input
                    type="text"
                    name="batchNumber"
                    value={formData.batchNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Reason code */}
            <div>
              <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Mandatory Audit Reason / Reference
              </label>
              <input
                type="text"
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                placeholder="e.g. PO-8921 Receipt or Cycle Count Discrepancy"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 px-6 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{submitting ? "Posting to Ledger..." : "Post Transaction"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
