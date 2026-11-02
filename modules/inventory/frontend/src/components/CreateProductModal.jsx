import React, { useState, useEffect } from "react";
import { X, Package, Layers, Tag, Ruler, Barcode, Shield, Save, AlertCircle, Sparkles } from "lucide-react";
import { createProduct, fetchCategories } from "../services/api";

export function CreateProductModal({ isOpen, onClose, onCreated }) {
  const [tab, setTab] = useState("basic");
  const steps = [
    { key: "basic", label: "1. Basic Details" },
    { key: "tracking", label: "2. Unit & Tracking" },
    { key: "reorder", label: "3. Reorder Parameters" },
  ];
  const currentStepIndex = steps.findIndex((step) => step.key === tab);
  const [categories, setCategories] = useState([]);
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

  useEffect(() => {
    if (isOpen) {
      setTab("basic");
      setError("");
      fetchCategories().then((res) => {
        const list = res.results || res || [];
        if (list.length > 0) {
          setCategories(list);
          setFormData((prev) => {
            const selectedCategory = list.find(
              (category) =>
                String(category.id) === prev.category ||
                category.name === prev.category
            );
            return {
              ...prev,
              category: String(
                selectedCategory?.id ?? list[0].id ?? list[0].name
              ),
            };
          });
        } else {
          setFormData((prev) => ({
            ...prev,
            category: prev.category || "Mechanical Components",
          }));
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (tab === "basic") {
      if (!formData.code.trim() || !formData.name.trim()) {
        setError("Item code and product name are required.");
        return;
      }
      setError("");
      setTab("tracking");
      return;
    }

    if (tab === "tracking") {
      setError("");
      setTab("reorder");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const selectedCategory = categories.find(
        (category) =>
          String(category.id) === formData.category ||
          category.name === formData.category
      );
      const created = await createProduct({
        ...formData,
        category_id: selectedCategory?.id,
        category_name: selectedCategory?.name || formData.category,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        reorder_point: Number(formData.reorder_point) || 0,
        reorder_quantity: Number(formData.reorder_quantity) || 0,
        initial_cost: Number(formData.initial_cost) || 0,
      });

      if (onCreated) {
        onCreated(created);
      }
      onClose();
    } catch (err) {
      setError("Failed to register item. Please check network and field validity.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/20">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Create Catalog Product
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                  <Sparkles className="h-2.5 w-2.5" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Define item identity, tracking policies, UOM conversions & reorder boundaries.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 px-6 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs">
          {steps.map((t, index) => (
            <button
              key={t.key}
              onClick={() => {
                if (index <= currentStepIndex) {
                  setError("");
                  setTab(t.key);
                }
              }}
              disabled={index > currentStepIndex}
              type="button"
              className={`py-3 font-semibold border-b-2 transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : index < currentStepIndex
                  ? "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
                  : "border-transparent text-slate-400 cursor-not-allowed"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="m-6 mb-0 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 text-xs">
            {tab === "basic" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      Product SKU / Item Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="e.g. BRG-6205-2RS"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      Barcode (EAN/UPC)
                    </label>
                    <input
                      type="text"
                      name="barcode"
                      value={formData.barcode}
                      onChange={handleChange}
                      placeholder="e.g. 890123984210"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Product Title / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Industrial Deep Groove Ball Bearing"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      Category
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    >
                      {categories.length > 0 ? (
                        categories.map((c) => (
                          <option key={c.id || c.code} value={String(c.id ?? c.name)}>
                            {c.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Mechanical Components">Mechanical Components</option>
                          <option value="Hydraulics & Pneumatics">Hydraulics & Pneumatics</option>
                          <option value="Power Transmission">Power Transmission</option>
                          <option value="Sensors & Automation">Sensors & Automation</option>
                          <option value="Chemicals & Fluids">Chemicals & Fluids</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      Brand / Manufacturer
                    </label>
                    <input
                      type="text"
                      name="brand"
                      value={formData.brand}
                      onChange={handleChange}
                      placeholder="e.g. SKF Precision"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Operational Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Enter engineering notes, storage conditions or product specifications..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  />
                </div>
              </div>
            )}

            {tab === "tracking" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      Item Type
                    </label>
                    <select
                      name="item_type"
                      value={formData.item_type}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    >
                      <option value="STOCK">Stockable Product</option>
                      <option value="RAW_MATERIAL">Raw Material</option>
                      <option value="FINISHED_GOOD">Finished Good</option>
                      <option value="CONSUMABLE">Consumable Supply</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      Base Unit of Measure (UOM)
                    </label>
                    <select
                      name="base_unit"
                      value={formData.base_unit}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono transition-all font-medium"
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
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300">
                    Inventory Tracking Control
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: "NONE", label: "Standard (Aggregate)", desc: "Quantities tracked without lot separation" },
                      { key: "BATCH", label: "Batch / Lot Tracked", desc: "Track manufacturing date, expiry & FEFO" },
                      { key: "SERIAL", label: "Serial Numbered", desc: "Track unique individual units & warranty" },
                    ].map((opt) => (
                      <div
                        key={opt.key}
                        onClick={() => setFormData((p) => ({ ...p, tracking: opt.key }))}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          formData.tracking === opt.key
                            ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-xs"
                            : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        <div className="font-semibold text-xs">{opt.label}</div>
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
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      Reorder Threshold (Min)
                    </label>
                    <input
                      type="number"
                      name="reorder_point"
                      value={formData.reorder_point}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono transition-all"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Triggers low stock alert</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      Suggested Reorder Qty
                    </label>
                    <input
                      type="number"
                      name="reorder_quantity"
                      value={formData.reorder_quantity}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono transition-all"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Default order batch size</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                      Initial Unit Cost ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="initial_cost"
                      value={formData.initial_cost}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono transition-all"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Baseline WAV valuation</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 px-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                if (currentStepIndex === 0) {
                  onClose();
                } else {
                  setError("");
                  setTab(steps[currentStepIndex - 1].key);
                }
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold transition-colors cursor-pointer"
            >
              {currentStepIndex === 0 ? "Cancel" : "Back"}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold shadow-xs hover:shadow-blue-500/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              {currentStepIndex === steps.length - 1 ? (
                <>
                  <Save className="h-4 w-4" />
                  <span>{submitting ? "Saving & Syncing..." : "Save & Register Item"}</span>
                </>
              ) : (
                <span>Continue</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
