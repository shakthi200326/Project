import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeftRight,
  Building2,
  MapPin,
  Calendar,
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Boxes,
  Send,
  Save,
  Tag,
} from "lucide-react";
import { fetchActiveWarehouses } from "../services/goodsReceiptApi.js";
import { createTransfer, updateTransfer } from "../services/transferApi.js";
import { ProductSelectionModal } from "./ProductSelectionModal.jsx";

const today = () => new Date().toISOString().split("T")[0];

export function StockTransferCreateModal({
  isOpen,
  onClose,
  onSaved,
  editTransfer = null,
}) {
  const [warehouses, setWarehouses] = useState([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Header State
  const [transferDate, setTransferDate] = useState(today());
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destWarehouseId, setDestWarehouseId] = useState("");
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");

  // Items Lines State
  const [lines, setLines] = useState([]);

  // Product Picker Modal
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [lineErrors, setLineErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setLoadingWarehouses(true);
      fetchActiveWarehouses()
        .then((whs) => {
          setWarehouses(Array.isArray(whs) ? whs : []);
        })
        .catch((e) => setServerError(e.message))
        .finally(() => setLoadingWarehouses(false));

      if (editTransfer) {
        setTransferDate(editTransfer.transaction_date || today());
        setSourceWarehouseId(String(editTransfer.warehouse_id || editTransfer.warehouse || ""));
        setDestWarehouseId(String(editTransfer.destination_warehouse_id || editTransfer.destination_warehouse || ""));
        setExpectedArrivalDate(editTransfer.expected_arrival_date || "");
        setReason(editTransfer.reason || "");
        setRemarks(editTransfer.notes || "");
        setLines(
          (editTransfer.lines || []).map((l) => ({
            id: l.id,
            item: l.item_id || l.item,
            item_id: l.item_id || l.item,
            item_name: l.item_name || l.item?.name,
            item_code: l.item_code || l.item?.code,
            sku: l.sku || l.variant?.sku || l.item_code,
            description: l.description || l.item?.description || "",
            barcode: l.barcode || l.item?.barcode || "",
            category: l.category || l.item?.category_name || "",
            brand: l.brand || l.item?.brand || "",
            manufacturer: l.manufacturer || l.item?.manufacturer || "",
            model_number: l.model_number || l.item?.model_number || "",
            tracking: l.tracking || l.item?.tracking || "NONE",
            variant: l.variant_id || l.variant,
            variant_id: l.variant_id || l.variant,
            variant_name: l.variant_name || l.variant?.name || "",
            quantity: Number(l.quantity) || 1,
            unit_cost: l.unit_cost || 0,
            uom: l.uom || l.transaction_uom || "Nos",
            available_stock: l.available_stock ?? 100,
            batch_number: l.batch_number || "",
            serial_numbers: l.serial_numbers || [],
          }))
        );
      } else {
        setTransferDate(today());
        setSourceWarehouseId("");
        setDestWarehouseId("");
        setExpectedArrivalDate("");
        setReason("");
        setRemarks("");
        setLines([]);
      }
      setServerError(null);
      setLineErrors({});
    }
  }, [isOpen, editTransfer]);

  // Selected Warehouses objects
  const sourceWh = useMemo(() => {
    return warehouses.find((w) => String(w.id) === String(sourceWarehouseId)) || null;
  }, [warehouses, sourceWarehouseId]);

  const destWh = useMemo(() => {
    return warehouses.find((w) => String(w.id) === String(destWarehouseId)) || null;
  }, [warehouses, destWarehouseId]);

  // Auto-derived Transfer Scope based on City comparison
  const transferScope = useMemo(() => {
    if (!sourceWh || !destWh) return null;
    const srcCity = (sourceWh.city || "").trim().toLowerCase();
    const dstCity = (destWh.city || "").trim().toLowerCase();
    if (!srcCity || !dstCity) return "UNKNOWN";
    return srcCity === dstCity ? "SAME_CITY" : "INTER_CITY";
  }, [sourceWh, destWh]);

  // Handle warehouse changes with product eligibility revalidation
  const handleSourceWarehouseChange = (newWhId) => {
    setSourceWarehouseId(newWhId);
    if (lines.length > 0) {
      // Notify user that products are being kept but need revalidation
      setServerError("Source warehouse changed. Verify available stock for selected items.");
    }
  };

  // Add Item callback from ProductSelectionModal
  const handleAddItem = (newItem) => {
    // Prevent duplicate product/variant rows
    const exists = lines.some(
      (l) => l.item_id === newItem.item_id && l.variant_id === newItem.variant_id
    );
    if (exists) {
      setServerError("This product / variant has already been added to the transfer.");
      return false;
    }
    setLines((prev) => [...prev, newItem]);
    setIsPickerOpen(false);
    setServerError(null);
    return true;
  };

  const handleRemoveLine = (idx) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQuantityEdit = (idx, newQty) => {
    const num = Number(newQty);
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, quantity: num } : l))
    );
    if (num <= 0) {
      setLineErrors((prev) => ({ ...prev, [idx]: "Quantity must be > 0" }));
    } else if (lines[idx].available_stock != null && num > lines[idx].available_stock) {
      setLineErrors((prev) => ({
        ...prev,
        [idx]: `Exceeds available stock (${lines[idx].available_stock})`,
      }));
    } else {
      setLineErrors((prev) => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });
    }
  };

  // Total summary calculation
  const totalItemsCount = lines.length;
  const totalTransferQty = useMemo(() => {
    return lines.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0);
  }, [lines]);

  // Form Validation
  const validateForm = () => {
    if (!sourceWarehouseId) {
      setServerError("Please select a valid Source Warehouse.");
      return false;
    }
    if (!destWarehouseId) {
      setServerError("Please select a valid Destination Warehouse.");
      return false;
    }
    if (sourceWarehouseId === destWarehouseId) {
      setServerError("Source and Destination Warehouses cannot be the same.");
      return false;
    }
    if (!sourceWh?.city?.trim()) {
      setServerError(`Source Warehouse '${sourceWh?.name}' does not have a city configured.`);
      return false;
    }
    if (!destWh?.city?.trim()) {
      setServerError(`Destination Warehouse '${destWh?.name}' does not have a city configured.`);
      return false;
    }
    if (lines.length === 0) {
      setServerError("Please add at least one product item to the transfer.");
      return false;
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.quantity || l.quantity <= 0) {
        setServerError(`Line ${i + 1} (${l.item_name}): Transfer quantity must be greater than zero.`);
        return false;
      }
      if (l.available_stock != null && l.quantity > l.available_stock) {
        setServerError(
          `Line ${i + 1} (${l.item_name}): Transfer quantity (${l.quantity}) exceeds available stock (${l.available_stock}).`
        );
        return false;
      }
    }
    return true;
  };

  const handleSave = async (submitNow = false) => {
    if (!validateForm()) return;
    setBusy(true);
    setServerError(null);

    const payload = {
      source_warehouse: sourceWarehouseId,
      warehouse: sourceWarehouseId,
      destination_warehouse: destWarehouseId,
      transaction_date: transferDate,
      expected_arrival_date: expectedArrivalDate || null,
      reason,
      notes: remarks,
      submit: submitNow,
      lines: lines.map((l) => ({
        item: l.item_id,
        variant: l.variant_id || null,
        quantity: l.quantity,
        unit_cost: l.unit_cost || 0,
        transaction_uom: l.uom || "Nos",
        batch_number: l.batch_number || "",
        serial_numbers: l.serial_numbers || [],
      })),
    };

    try {
      let result;
      if (editTransfer?.id) {
        result = await updateTransfer(editTransfer.id, payload);
      } else {
        result = await createTransfer(payload);
      }
      onSaved(result, submitNow);
      onClose();
    } catch (err) {
      setServerError(err.message || "Failed to save stock transfer order");
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
        <div className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-800/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <ArrowLeftRight className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {editTransfer ? "Edit Stock Transfer" : "Initiate Stock Transfer"}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                    Inter-Warehouse
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Universal warehouse-to-warehouse stock movement with multi-item addition
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form Content */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {serverError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Section 1: Transfer Document Information */}
            <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 p-4 bg-slate-50/40 dark:bg-zinc-800/20 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  1. Transfer Document Details
                </span>
                {transferScope && (
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      transferScope === "SAME_CITY"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                        : transferScope === "INTER_CITY"
                        ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-900/40"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {transferScope === "SAME_CITY"
                      ? "📍 Same-City Transfer"
                      : transferScope === "INTER_CITY"
                      ? "🚚 Inter-City Transfer"
                      : "⚠️ City Info Required"}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Transfer Number */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    Transfer Number
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editTransfer?.document_number || "Auto-generated (TRF-...)"}
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 cursor-not-allowed"
                  />
                </div>

                {/* Transfer Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    Transfer Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Transfer Type */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    Transfer Type
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Inter-Warehouse"
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 cursor-not-allowed font-medium"
                  />
                </div>

                {/* Transfer Scope (Derived) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    Transfer Scope
                  </label>
                  <input
                    type="text"
                    disabled
                    value={
                      transferScope === "SAME_CITY"
                        ? "Same-City"
                        : transferScope === "INTER_CITY"
                        ? "Inter-City"
                        : "Auto-derived"
                    }
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Warehouses & Cities */}
            <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 p-4 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                2. Origin &amp; Destination Facilities
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Source Warehouse Card */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700/60 bg-slate-50/50 dark:bg-zinc-800/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-blue-500" />
                      Source Warehouse (Origin)
                    </span>
                    {sourceWh?.city && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {sourceWh.city}
                      </span>
                    )}
                  </div>
                  <select
                    value={sourceWarehouseId}
                    onChange={(e) => handleSourceWarehouseChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">Select Source Warehouse…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code}) · {w.city || "No City"}
                      </option>
                    ))}
                  </select>
                  {sourceWh && !sourceWh.city && (
                    <p className="text-[11px] text-amber-500">
                      ⚠️ Warehouse has no city configured. City is required for transfer classification.
                    </p>
                  )}
                </div>

                {/* Destination Warehouse Card */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700/60 bg-slate-50/50 dark:bg-zinc-800/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-emerald-500" />
                      Destination Warehouse
                    </span>
                    {destWh?.city && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {destWh.city}
                      </span>
                    )}
                  </div>
                  <select
                    value={destWarehouseId}
                    onChange={(e) => setDestWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">Select Destination Warehouse…</option>
                    {warehouses
                      .filter((w) => String(w.id) !== String(sourceWarehouseId))
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code}) · {w.city || "No City"}
                        </option>
                      ))}
                  </select>
                  {destWh && !destWh.city && (
                    <p className="text-[11px] text-amber-500">
                      ⚠️ Destination warehouse has no city configured.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Multiple Products / Items Table */}
            <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      3. Transfer Products &amp; Quantities
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                      {totalItemsCount} Products · {totalTransferQty} Total Units
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Add multiple items to this transfer order using the Goods Receipt product selector
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!sourceWarehouseId) {
                      setServerError("Please select a Source Warehouse first before adding items.");
                      return;
                    }
                    setIsPickerOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Item</span>
                </button>
              </div>

              {/* Items Table */}
              {lines.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/20">
                  <Package className="h-8 w-8 mx-auto text-slate-400 opacity-60 mb-2" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    No products added yet.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click <span className="font-bold text-emerald-600">+ Add Item</span> to select items and variants from the catalog.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 font-semibold border-b border-slate-200 dark:border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3">S.No</th>
                        <th className="py-2.5 px-3">Product / Item</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Variant</th>
                        <th className="py-2.5 px-3 text-right">Available Stock</th>
                        <th className="py-2.5 px-3 text-right w-32">Transfer Qty</th>
                        <th className="py-2.5 px-3">UOM</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {lines.map((l, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {l.item_name}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              {l.item_code}
                            </div>
                            {(l.category || l.brand || l.barcode || l.tracking !== "NONE") && (
                              <div className="text-[9px] text-slate-400 mt-0.5 max-w-[220px] truncate">
                                {[l.category && `Category: ${l.category}`, l.brand && `Brand: ${l.brand}`, l.barcode && `Barcode: ${l.barcode}`, l.tracking !== "NONE" && `Tracking: ${l.tracking}`].filter(Boolean).join(" · ")}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-zinc-300">
                            {l.sku}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-400">
                            {l.variant_name || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-zinc-300">
                            {l.available_stock != null ? l.available_stock : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min="1"
                              max={l.available_stock !== undefined ? l.available_stock : undefined}
                              value={l.quantity}
                              onChange={(e) => handleQuantityEdit(idx, e.target.value)}
                              className={`w-24 px-2.5 py-1 text-right rounded-lg text-xs font-bold bg-white dark:bg-zinc-800 border ${
                                lineErrors[idx]
                                  ? "border-red-500 text-red-600"
                                  : "border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                              }`}
                            />
                            {lineErrors[idx] && (
                              <div className="text-[10px] text-red-500 mt-0.5">
                                {lineErrors[idx]}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-500 text-[11px]">
                            {l.uom || "Nos"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 4: Expected Arrival, Reason & Remarks */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Expected Arrival Date
                </label>
                <input
                  type="date"
                  value={expectedArrivalDate}
                  onChange={(e) => setExpectedArrivalDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Transfer Reason
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Replenishment, Stock Rebalance"
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional delivery or dispatch instructions"
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={busy}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>Save &amp; Submit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reusable Product Selection Modal */}
      <ProductSelectionModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onAddItem={handleAddItem}
        warehouseId={sourceWarehouseId}
        warehouseName={sourceWh?.name}
        sourceCity={sourceWh?.city}
        existingItemIds={lines.map((l) => l.item_id)}
      />
    </>
  );
}
