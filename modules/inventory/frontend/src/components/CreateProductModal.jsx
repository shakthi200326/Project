import React, { useState } from "react";
import { X, Package, Layers, Tag, Ruler, Barcode, Shield, Save, AlertCircle } from "lucide-react";

export function CreateProductModal({ isOpen, onClose, onCreated }) {
  const [tab, setTab] = useState("basic");
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "Mechanical Components",
    brand: "",
    base_unit: "EA",
    item_type: "STOCK",
    tracking: "NONE",
    barcode: "",
    reorder_point: 50,
    reorder_quantity: 100,
    initial_cost: 0.0,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      setError("Item code and product name are required.");
      return;
    }
    setError("");
    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);
      if (onCreated) {
        onCreated({
          id: `prod-${Date.now()}`,
          sku: formData.code,
          name: formData.name,
          category: formData.category,
          brand: formData.brand || "Generic",
          unit: formData.base_unit,
          variants_count: 1,
          status: "ACTIVE",
          stock_status: "IN_STOCK",
          on_hand: 0,
          reserved: 0,
          available: 0,
          reorder_point: Number(formData.reorder_point),
          unit_cost: Number(formData.initial_cost) || 10.0,
          currency: "USD",
        });
      }
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-xs">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Create New Catalog Product
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Define item identity, tracking parameters, UOM & reorder policies.
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

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 px-5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs">
          {[
            { key: "basic", label: "1. Basic Details" },
            { key: "tracking", label: "2. Unit & Tracking" },
            { key: "reorder", label: "3. Reorder Parameters" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              type="button"
              className={`py-3 font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="m-5 mb-0 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 text-xs">
            {tab === "basic" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Product SKU / Item Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="e.g. BRG-6205-2RS"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Barcode (EAN/UPC)
                    </label>
                    <input
                      type="text"
                      name="barcode"
                      value={formData.barcode}
                      onChange={handleChange}
                      placeholder="e.g. 890123984210"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Product Title / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Industrial Deep Groove Ball Bearing"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Category
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Mechanical Components">Mechanical Components</option>
                      <option value="Hydraulics & Pneumatics">Hydraulics & Pneumatics</option>
                      <option value="Power Transmission">Power Transmission</option>
                      <option value="Sensors & Automation">Sensors & Automation</option>
                      <option value="Chemicals & Fluids">Chemicals & Fluids</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Brand / Manufacturer
                    </label>
                    <input
                      type="text"
                      name="brand"
                      value={formData.brand}
                      onChange={handleChange}
                      placeholder="e.g. SKF Precision"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Operational Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Enter engineering notes, storage conditions or product specifications..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {tab === "tracking" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Item Type
                    </label>
                    <select
                      name="item_type"
                      value={formData.item_type}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="STOCK">Stockable Product</option>
                      <option value="RAW_MATERIAL">Raw Material</option>
                      <option value="FINISHED_GOOD">Finished Good</option>
                      <option value="CONSUMABLE">Consumable Supply</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Base Unit of Measure (UOM)
                    </label>
                    <select
                      name="base_unit"
                      value={formData.base_unit}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500 font-mono"
                    >
                      <option value="EA">EA - Each / Piece</option>
                      <option value="LTR">LTR - Liters</option>
                      <option value="KG">KG - Kilograms</option>
                      <option value="MTR">MTR - Meters</option>
                      <option value="BOX">BOX - Standard Box</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <label className="block font-medium text-slate-700 dark:text-zinc-300">
                    Inventory Tracking Control
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: "NONE", label: "Standard (No Batch)", desc: "Quantities tracked in aggregate" },
                      { key: "BATCH", label: "Batch / Lot Tracked", desc: "Track manufacturing & expiry dates" },
                      { key: "SERIAL", label: "Serial Numbered", desc: "Track unique individual units" },
                    ].map((opt) => (
                      <div
                        key={opt.key}
                        onClick={() => setFormData((p) => ({ ...p, tracking: opt.key }))}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          formData.tracking === opt.key
                            ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200"
                            : "border-slate-200 dark:border-zinc-800 hover:border-slate-300"
                        }`}
                      >
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">{opt.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "reorder" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Reorder Threshold (Min)
                    </label>
                    <input
                      type="number"
                      name="reorder_point"
                      value={formData.reorder_point}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-400">Triggers low stock alert</span>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Suggested Reorder Qty
                    </label>
                    <input
                      type="number"
                      name="reorder_quantity"
                      value={formData.reorder_quantity}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-400">Default order batch size</span>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Initial Unit Cost ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="initial_cost"
                      value={formData.initial_cost}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-400">Baseline WAV valuation</span>
                  </div>
                </div>
              </div>
            )}
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
              <span>{submitting ? "Saving Product..." : "Save & Register Item"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
