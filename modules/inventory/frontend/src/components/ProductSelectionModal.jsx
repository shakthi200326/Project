import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Package,
  Layers,
  Check,
  AlertCircle,
  X,
  Loader2,
  Boxes,
  Plus,
} from "lucide-react";
import { searchReceiptItems } from "../services/goodsReceiptApi.js";
import { fetchProductStock, searchTransferItems } from "../services/transferApi.js";

/**
 * Reusable Product Selection Modal adapted from the Goods Receipt Item Selection.
 * Supports:
 * - Product search by Item Name, SKU, Code, Barcode
 * - Product Variant selection
 * - Live Available Stock lookup at the specified Source Warehouse
 * - Quantity entry with instant validation against available stock
 * - Adding multiple products to the parent document
 */
export function ProductSelectionModal({
  isOpen,
  onClose,
  onAddItem,
  warehouseId,
  warehouseName,
  sourceCity,
  existingItemIds = [],
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState("1");
  const [stockLoading, setStockLoading] = useState(false);
  const [availableStock, setAvailableStock] = useState(null);
  const [onHandStock, setOnHandStock] = useState(null);
  const [qtyError, setQtyError] = useState("");

  const debounceTimer = useRef(null);

  // Debounced search using Goods Receipt lookup
  const performSearch = useCallback((term) => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        let items = [];
        try {
          items = await searchTransferItems(term);
        } catch (transferSearchError) {
          items = await searchReceiptItems(term);
        }
        setResults(Array.isArray(items) ? items : []);
      } catch (err) {
        setError(err.message || "Failed to search products");
      } finally {
        setLoading(false);
      }
    }, 200);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedProduct(null);
      setSelectedVariant(null);
      setQuantity("1");
      setAvailableStock(null);
      setQtyError("");
      performSearch("");
    } else {
      clearTimeout(debounceTimer.current);
      setLoading(false);
      setStockLoading(false);
    }
  }, [isOpen, performSearch]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    performSearch(val);
  };

  // Fetch real-time available stock when product or variant is selected
  useEffect(() => {
    if (!selectedProduct || !warehouseId) {
      setAvailableStock(null);
      setOnHandStock(null);
      return;
    }
    let active = true;
    setStockLoading(true);
    fetchProductStock(warehouseId, selectedProduct.id, selectedVariant?.id)
      .then((res) => {
        if (!active) return;
        setAvailableStock(res.available ?? 0);
        setOnHandStock(res.on_hand ?? 0);
      })
      .catch(() => {
        if (!active) return;
        setAvailableStock(null);
        setOnHandStock(null);
        // Stock lookup is advisory in the picker. Keep item selection usable and
        // let server-side stock validation run when the transfer is submitted.
        setError(null);
      })
      .finally(() => {
        if (active) setStockLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedProduct, selectedVariant, warehouseId]);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    if (product.variants && product.variants.length > 0) {
      setSelectedVariant(product.variants[0]);
    } else {
      setSelectedVariant(null);
    }
    setQuantity("1");
    setQtyError("");
  };

  const handleQuantityChange = (val) => {
    setQuantity(val);
    const num = Number(val);
    if (num <= 0) {
      setQtyError("Quantity must be greater than zero.");
    } else if (availableStock !== null && num > availableStock) {
      setQtyError(`Quantity cannot exceed available stock (${availableStock}).`);
    } else {
      setQtyError("");
    }
  };

  const handleAdd = () => {
    if (!selectedProduct) return;
    const num = Number(quantity);
    if (num <= 0) {
      setQtyError("Quantity must be greater than zero.");
      return;
    }
    if (availableStock !== null && num > availableStock) {
      setQtyError(`Quantity cannot exceed available stock (${availableStock}).`);
      return;
    }

    const added = onAddItem({
      item: selectedProduct.id,
      item_id: selectedProduct.id,
      item_name: selectedProduct.name,
      item_code: selectedProduct.code,
      sku: selectedVariant?.sku || selectedProduct.sku || selectedProduct.code,
      variant: selectedVariant?.id || null,
      variant_id: selectedVariant?.id || null,
      variant_name: selectedVariant?.name || "",
      uom: selectedProduct.base_uom || "Nos",
      transaction_uom: selectedProduct.base_uom || "Nos",
      unit_cost: selectedProduct.standard_cost || 0,
      description: selectedProduct.description || "",
      barcode: selectedProduct.barcode || "",
      category: selectedProduct.category || "",
      subcategory: selectedProduct.subcategory || "",
      brand: selectedProduct.brand || "",
      manufacturer: selectedProduct.manufacturer || "",
      model_number: selectedProduct.model_number || "",
      tracking: selectedProduct.tracking || "NONE",
      quantity: num,
      available_stock: availableStock,
      batch_number: "",
      serial_numbers: [],
    });

    if (added === false) return;

    // Reset selection for adding next item or close
    setSelectedProduct(null);
    setSelectedVariant(null);
    setQuantity("1");
    setAvailableStock(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Select Product / Item
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Goods Receipt &amp; Stock Transfer Reusable Product Catalog
                {warehouseName ? ` · Source: ${warehouseName} (${sourceCity || ""})` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search product by Item Name, SKU, Item Code or scan barcode…"
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 animate-spin" />
            )}
          </div>

          {/* Results List */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Eligible Catalog Items
            </span>
            <div className="mt-1.5 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              {results.length === 0 && !loading && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No active stock items match your search.
                </div>
              )}
              {results.map((product) => {
                const isSelected = selectedProduct?.id === product.id;
                const alreadyAdded = existingItemIds.includes(product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => handleProductSelect(product)}
                    className={`p-3 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-l-3 border-emerald-500"
                        : "hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {product.name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {product.code}
                        </span>
                        {alreadyAdded && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                            Already in transfer
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Base UOM: {product.base_uom || "Nos"}</span>
                        {product.category && <span>· Category: {product.category}</span>}
                        {product.brand && <span>· Brand: {product.brand}</span>}
                        {product.variants?.length > 0 && (
                          <span>· {product.variants.length} Variants</span>
                        )}
                        {product.standard_cost && (
                          <span>· Standard Cost: ${Number(product.standard_cost).toFixed(2)}</span>
                        )}
                      </div>
                      {(product.barcode || product.manufacturer || product.model_number || product.tracking) && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          {product.barcode && <span>Barcode: {product.barcode}</span>}
                          {product.manufacturer && <span>· Manufacturer: {product.manufacturer}</span>}
                          {product.model_number && <span>· Model: {product.model_number}</span>}
                          {product.tracking && product.tracking !== "NONE" && <span>· Tracking: {product.tracking}</span>}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-emerald-600 shrink-0 ml-2" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Item Configuration Details (when item is selected) */}
          {selectedProduct && (
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-white">
                  Configure Item Line
                </span>
                <span className="text-[11px] text-slate-500">
                  {selectedProduct.code} – {selectedProduct.name}
                </span>
              </div>

              {/* Variant Picker (if product has variants) */}
              {selectedProduct.variants?.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                    Select Product Variant
                  </label>
                  <select
                    value={selectedVariant?.id || ""}
                    onChange={(e) => {
                      const v = selectedProduct.variants.find(
                        (item) => String(item.id) === e.target.value
                      );
                      setSelectedVariant(v || null);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                  >
                    {selectedProduct.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.sku} – {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Live Available Stock Display */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs">
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-blue-500" />
                  <span className="text-slate-500 dark:text-zinc-400">
                    Source Warehouse Stock ({warehouseName || "Selected Warehouse"}):
                  </span>
                </div>
                <div>
                  {stockLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        Available: {availableStock ?? "—"} {selectedProduct.base_uom || "Nos"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        (On-Hand: {onHandStock ?? "—"})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                    Transfer Quantity ({selectedProduct.base_uom || "Nos"}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={availableStock !== null ? availableStock : undefined}
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                  {qtyError && (
                    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {qtyError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                    SKU &amp; UOM Reference
                  </label>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800/60 text-xs font-mono text-slate-700 dark:text-zinc-300">
                    {selectedVariant?.sku || selectedProduct.sku || selectedProduct.code} · {selectedProduct.base_uom || "Nos"}
                  </div>
                </div>
                {(selectedProduct.description || selectedProduct.category || selectedProduct.brand || selectedProduct.manufacturer || selectedProduct.model_number) && (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                    {[
                      ["Description", selectedProduct.description],
                      ["Category", selectedProduct.category || selectedProduct.subcategory],
                      ["Brand", selectedProduct.brand],
                      ["Manufacturer", selectedProduct.manufacturer],
                      ["Model", selectedProduct.model_number],
                      ["Tracking", selectedProduct.tracking || "NONE"],
                    ].filter(([, value]) => value).map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-white/70 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700 px-2.5 py-2">
                        <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
                        <div className="text-[11px] text-slate-700 dark:text-zinc-200 font-semibold mt-0.5 truncate">{value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedProduct || !!qtyError || Number(quantity) <= 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add to Transfer Document</span>
          </button>
        </div>
      </div>
    </div>
  );
}
