import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Package,
  Layers,
  Boxes,
  MapPin,
  Clock,
  ShieldCheck,
  FileText,
  Paperclip,
  CheckCircle,
  AlertTriangle,
  Upload,
  Download,
  Calendar,
  DollarSign,
  Barcode,
  ExternalLink,
  Trash2,
  Loader2,
  Edit2,
  Save,
  Plus,
  Tag,
  Check,
  ArrowRight,
  Sparkles,
  Scale,
  Ruler,
  Truck,
  Building,
} from "lucide-react";
import {
  fetchAttachments,
  uploadAttachment,
  deleteAttachment,
  fetchCategories,
  fetchBrands,
  fetchUnits,
  fetchAttributes,
  fetchProductBarcodes,
  createProductBarcode,
  deleteProductBarcode,
  fetchUOMConversions,
  createUOMConversion,
  deleteUOMConversion,
  generateProductVariants,
  updateProduct,
} from "@/services/api";
import { ScrollableTabs } from "./ScrollableTabs.jsx";

// Parse a numeric form field, keeping 0 as a real value; blank or invalid falls back.
const numberOr = (value, fallback) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getUnitCode = (value, units) => {
  if (typeof value === "string" && !/^\d+$/.test(value)) return value;
  return units.find((unit) => String(unit.id) === String(value))?.code || units[0]?.code || "";
};

export function ProductDetailDrawer({ product, isOpen, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [attachments, setAttachments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [units, setUnits] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [barcodes, setBarcodes] = useState([]);
  const [uomConversions, setUomConversions] = useState([]);
  const [variantsList, setVariantsList] = useState([]);

  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSaveError, setEditSaveError] = useState("");
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [selectedAttrOptions, setSelectedAttrOptions] = useState({});
  const [variantAttributeIds, setVariantAttributeIds] = useState([]);
  const [variantAttributesChanged, setVariantAttributesChanged] = useState(false);
  const [variantSkuPrefix, setVariantSkuPrefix] = useState("");

  // New Barcode Form
  const [newBarcode, setNewBarcode] = useState({
    barcode_value: "",
    symbology: "CODE128",
    barcode_type: "PACKAGING",
    is_primary: false,
  });
  const [savingBarcode, setSavingBarcode] = useState(false);

  // New UOM Conversion Form
  const [newConversion, setNewConversion] = useState({
    from_uom: "",
    to_uom: "",
    conversion_factor: "1.0",
  });
  const [savingConversion, setSavingConversion] = useState(false);

  const fileInputRef = useRef(null);

  const [editForm, setEditForm] = useState({
    name: "",
    display_name: "",
    short_description: "",
    long_description: "",
    item_type: "RAW_MATERIAL",
    classification: "STANDARD",
    category: "",
    brand: "",
    manufacturer: "",
    model_number: "",
    country_of_origin: "",
    base_uom: "EA",
    purchase_uom: "EA",
    sales_uom: "EA",
    standard_cost: 0,
    list_price: 0,
    unit_cost: 0,
    reorder_point: 0,
    stock_status: "IN_STOCK",
    status: "ACTIVE",
    track_inventory: true,
    is_stockable: true,
    is_purchasable: true,
    is_salable: true,
    allow_negative_stock: false,
    batch_tracking_required: false,
    serial_tracking_required: false,
    expiry_tracking_required: false,
    has_variants: false,
    net_weight: 0,
    gross_weight: 0,
    weight_uom: "KG",
    length: 0,
    width: 0,
    height: 0,
    dimension_uom: "CM",
  });

  useEffect(() => {
    if (isOpen && product) {
      loadAttachments();
      loadProductExtras();

      fetchCategories().then((list) => {
        setCategories(list);
        const selectedCategory = list.find(
          (category) =>
            String(category.id) === String(product.category_id) ||
            category.name === product.category
        );
        if (selectedCategory) {
          setEditForm((prev) => ({
            ...prev,
            category: String(selectedCategory.id ?? selectedCategory.name),
          }));
        }
      });

      fetchBrands().then((list) => {
        setBrands(list.results || list || []);
      });

      fetchUnits().then((list) => {
        const unitList = list.results || list || [];
        setUnits(unitList);
      });

      fetchAttributes().then((list) => {
        setAttributes(list);
      });
      setVariantAttributeIds(
        (product.attribute_assignments || [])
          .filter((assignment) => assignment.variant == null)
          .map((assignment) => String(assignment.attribute))
      );
      setVariantAttributesChanged(false);

      setVariantsList(product.variants || []);
      setVariantSkuPrefix(product.sku || "");

      setEditForm({
        name: product.name || "",
        display_name: product.display_name || product.name || "",
        short_description: product.short_description || "",
        long_description: product.long_description || "",
        item_type: product.item_type || "RAW_MATERIAL",
        classification: product.classification || "STANDARD",
        category: String(product.category_id ?? product.category ?? ""),
        brand: product.brand || "",
        manufacturer: product.manufacturer || "",
        model_number: product.model_number || "",
        country_of_origin: product.country_of_origin || "",
        base_uom: product.base_uom_code || product.base_unit || product.unit || getUnitCode(product.base_uom, units),
        purchase_uom: product.purchase_uom_code || getUnitCode(product.purchase_uom, units) || product.unit || "EA",
        sales_uom: product.sales_uom_code || getUnitCode(product.sales_uom, units) || product.unit || "EA",
        standard_cost: product.standard_cost ?? product.unit_cost ?? 0,
        list_price: product.list_price ?? 0,
        unit_cost: product.unit_cost || product.standard_cost || 0,
        reorder_point: product.reorder_point || 0,
        stock_status: product.stock_status || "IN_STOCK",
        status: product.status || (product.is_active ? "ACTIVE" : "INACTIVE"),
        track_inventory: product.track_inventory ?? true,
        is_stockable: product.is_stockable ?? true,
        is_purchasable: product.is_purchasable ?? true,
        is_salable: product.is_salable ?? true,
        allow_negative_stock: product.allow_negative_stock ?? false,
        batch_tracking_required: product.batch_tracking_required ?? false,
        serial_tracking_required: product.serial_tracking_required ?? false,
        expiry_tracking_required: product.expiry_tracking_required ?? false,
        has_variants: product.has_variants ?? false,
        net_weight: product.net_weight ?? 0,
        gross_weight: product.gross_weight ?? 0,
        weight_uom: product.weight_uom_code || getUnitCode(product.weight_uom, units),
        length: product.length ?? 0,
        width: product.width ?? 0,
        height: product.height ?? 0,
        dimension_uom: product.dimension_uom_code || getUnitCode(product.dimension_uom, units),
      });

      setNewConversion({
        from_uom: product.base_uom_code || product.base_unit || product.unit || getUnitCode(product.base_uom, units),
        to_uom: product.base_uom_code || product.base_unit || product.unit || getUnitCode(product.base_uom, units),
        conversion_factor: "1.0",
      });

      setIsEditing(false);
      setEditSaveError("");
    }
  }, [isOpen, product]);

  const loadProductExtras = async () => {
    if (!product || !product.id) return;
    try {
      const [barcodesData, conversionsData] = await Promise.all([
        fetchProductBarcodes(product.id),
        fetchUOMConversions(product.id),
      ]);
      setBarcodes(barcodesData);
      setUomConversions(conversionsData);
    } catch (e) {
      console.warn("Failed to load extra product associations", e);
    }
  };

  const loadAttachments = async () => {
    if (!product) return;
    setLoadingDocs(true);
    try {
      const docs = await fetchAttachments("apps.products.models.InventoryItem", product.id);
      setAttachments(docs || []);
    } catch (e) {
      console.error("Failed to load attachments", e);
      setAttachments([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !product) return;

    setUploading(true);
    try {
      const newDoc = await uploadAttachment(file, "apps.products.models.InventoryItem", product.id);
      if (newDoc) {
        setAttachments((prev) => [newDoc, ...prev]);
      }
    } catch (err) {
      console.error("Failed to upload file", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await deleteAttachment(fileId);
      setAttachments((prev) => prev.filter((item) => item.id !== fileId));
    } catch (err) {
      console.error("Failed to delete file", err);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault();
    if (!editForm.name.trim()) return;
    setEditSaveError("");

    const selectedCategory = categories.find(
      (category) =>
        String(category.id) === editForm.category ||
        category.name === editForm.category
    );

    const updated = {
      ...product,
      name: editForm.name,
      display_name: editForm.display_name,
      short_description: editForm.short_description,
      long_description: editForm.long_description,
      item_type: editForm.item_type,
      classification: editForm.classification,
      category: selectedCategory?.name || editForm.category,
      category_id: selectedCategory?.id ?? product.category_id,
      category_name: selectedCategory?.name || editForm.category,
      brand: editForm.brand,
      manufacturer: editForm.manufacturer,
      model_number: editForm.model_number,
      country_of_origin: editForm.country_of_origin,
      unit: editForm.base_uom,
      base_uom: editForm.base_uom,
      purchase_uom: editForm.purchase_uom,
      sales_uom: editForm.sales_uom,
      unit_cost: numberOr(editForm.standard_cost, product.unit_cost),
      standard_cost: numberOr(editForm.standard_cost, product.standard_cost),
      list_price: numberOr(editForm.list_price, product.list_price),
      reorder_point: numberOr(editForm.reorder_point, product.reorder_point),
      stock_status: editForm.stock_status,
      status: editForm.status,
      track_inventory: editForm.track_inventory,
      is_stockable: editForm.is_stockable,
      is_purchasable: editForm.is_purchasable,
      is_salable: editForm.is_salable,
      allow_negative_stock: editForm.allow_negative_stock,
      batch_tracking_required: editForm.batch_tracking_required,
      serial_tracking_required: editForm.serial_tracking_required,
      expiry_tracking_required: editForm.expiry_tracking_required,
      has_variants: editForm.has_variants,
      net_weight: parseFloat(editForm.net_weight) || 0,
      gross_weight: parseFloat(editForm.gross_weight) || 0,
      weight_uom: editForm.weight_uom,
      length: parseFloat(editForm.length) || 0,
      width: parseFloat(editForm.width) || 0,
      height: parseFloat(editForm.height) || 0,
      dimension_uom: editForm.dimension_uom,
      ...(variantAttributesChanged
        ? { variant_attribute_ids: variantAttributeIds.map(Number) }
        : {}),
    };

    setSavingEdit(true);
    try {
      await updateProduct(product.id, updated);
      if (onSave) await onSave(updated);
      setIsEditing(false);
    } catch (saveError) {
      setEditSaveError(saveError.message || "Failed to save product changes.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Add Barcode Handler
  const handleAddBarcode = async (e) => {
    e.preventDefault();
    if (!newBarcode.barcode_value.trim()) return;
    setSavingBarcode(true);
    try {
      const created = await createProductBarcode({
        item: product.id,
        barcode_value: newBarcode.barcode_value.trim(),
        symbology: newBarcode.symbology,
        barcode_type: newBarcode.barcode_type,
        is_primary: newBarcode.is_primary,
      });
      setBarcodes((prev) => [created, ...prev]);
      setNewBarcode({
        barcode_value: "",
        symbology: "CODE128",
        barcode_type: "PACKAGING",
        is_primary: false,
      });
    } catch (err) {
      alert(`Failed to add barcode: ${err.message}`);
    } finally {
      setSavingBarcode(false);
    }
  };

  const handleDeleteBarcode = async (id) => {
    try {
      await deleteProductBarcode(id);
      setBarcodes((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      alert(`Failed to delete barcode: ${err.message}`);
    }
  };

  // Add UOM Conversion Handler
  const handleAddConversion = async (e) => {
    e.preventDefault();
    if (!newConversion.from_uom || !newConversion.to_uom || !newConversion.conversion_factor) return;
    setSavingConversion(true);
    try {
      const created = await createUOMConversion({
        item: product.id,
        from_uom: newConversion.from_uom,
        to_uom: newConversion.to_uom,
        conversion_factor: parseFloat(newConversion.conversion_factor),
      });
      setUomConversions((prev) => [created, ...prev]);
      setNewConversion({
        from_uom: product.base_uom || product.unit || "EA",
        to_uom: product.base_uom || product.unit || "EA",
        conversion_factor: "1.0",
      });
    } catch (err) {
      alert(`Failed to add UOM conversion: ${err.message}`);
    } finally {
      setSavingConversion(false);
    }
  };

  const handleDeleteConversion = async (id) => {
    try {
      await deleteUOMConversion(id);
      setUomConversions((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(`Failed to delete conversion: ${err.message}`);
    }
  };

  // Variant Matrix Generation
  const handleToggleAttrVal = (attrCode, val) => {
    setSelectedAttrOptions((prev) => {
      const cur = prev[attrCode] || [];
      const updated = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
      return { ...prev, [attrCode]: updated };
    });
  };

  const handleGenerateMatrix = async () => {
    const formattedAttrs = Object.fromEntries(
    Object.entries(selectedAttrOptions).filter(([, values]) => values.length > 0)
    );

    if (formattedAttrs.length === 0) {
      alert("Please select at least one attribute with values to generate variants.");
      return;
    }

    setIsGeneratingVariants(true);
    try {
      const res = await generateProductVariants(product.id, {
        sku_prefix: variantSkuPrefix || product.sku,
        attribute_selection: formattedAttrs,
        sku_prefix: variantSkuPrefix || product.sku,
      });
      if (res && res.variants) {
        setVariantsList(res.variants);
        setVariantModalOpen(false);
        if (onSave) {
          onSave({ ...product, variants: res.variants, variants_count: res.variants.length });
        }
      }
    } catch (err) {
      alert(`Failed to generate variant matrix: ${err.message}`);
    } finally {
      setIsGeneratingVariants(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-2xl h-full flex flex-col border-l border-slate-200 dark:border-zinc-800 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
              <Package className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {product.sku}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                  {(product.item_type || "RAW_MATERIAL").replace(/_/g, " ")}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                    (product.status || (product.is_active ? "ACTIVE" : "INACTIVE")) === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {product.status || (product.is_active ? "ACTIVE" : "INACTIVE")}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {product.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {product.category || product.category_name} • {product.brand || "OEM Standard"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <ScrollableTabs stripClassName="flex items-center gap-1 px-5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs" role="group">
          {[
            { key: "overview", label: "Overview & Specs" },
            { key: "stock", label: "Stock Availability" },
            { key: "warehouses", label: "Facility Balances" },
            { key: "variants", label: `Variants (${variantsList.length || product.variants_count || 1})` },
            { key: "barcodes", label: `Barcodes (${barcodes.length || (product.barcode ? 1 : 0)})` },
            { key: "uom_conversions", label: `UOM Rules (${uomConversions.length})` },
            { key: "attachments", label: `Files (${attachments.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setIsEditing(false);
              }}
              className={`py-3 font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer px-2 ${
                activeTab === tab.key && !isEditing
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </ScrollableTabs>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {editSaveError && (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                  {editSaveError}
                </div>
              )}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-300">
                <span className="font-semibold">Edit Product Master:</span> Update core classification, policy switches, and financial parameters.
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                <input
                  type="checkbox"
                  checked={Boolean(editForm.has_variants)}
                  disabled={Boolean(editForm.has_variants && (product.variants_count || variantsList.length))}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      has_variants: event.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  <span className="block font-semibold text-slate-800 dark:text-zinc-200">
                    Has Product Variants
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-zinc-400">
                    Enable this item to make it available in the Product Variants parent-item dropdown.
                    {editForm.has_variants && (product.variants_count || variantsList.length)
                      ? " This cannot be turned off while variants exist."
                      : ""}
                  </span>
                </span>
              </label>

              {editForm.has_variants && (
                <fieldset className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                  <legend className="px-1 font-semibold text-slate-800 dark:text-zinc-200">
                    Variant Attributes
                  </legend>
                  <p className="mb-2 text-[11px] text-slate-500 dark:text-zinc-400">
                    Choose the attributes available when creating variants for this item.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {attributes
                      .filter(
                        (attribute) =>
                          attribute.is_active &&
                          attribute.is_variant_generator &&
                          (attribute.values || []).some((value) => value.is_active)
                      )
                      .map((attribute) => (
                        <label
                          key={attribute.id}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <input
                            type="checkbox"
                            checked={variantAttributeIds.includes(String(attribute.id))}
                            onChange={(event) => {
                              setVariantAttributesChanged(true);
                              setVariantAttributeIds((current) => {
                                const validIds = new Set(
                                  attributes
                                    .filter(
                                      (entry) =>
                                        entry.is_active &&
                                        entry.is_variant_generator
                                    )
                                    .map((entry) => String(entry.id))
                                );
                                const selected = current.filter((id) => validIds.has(id));
                                return event.target.checked
                                  ? [...selected, String(attribute.id)]
                                  : selected.filter((id) => id !== String(attribute.id));
                              });
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="font-medium text-slate-700 dark:text-zinc-200">
                            {attribute.name}
                          </span>
                        </label>
                      ))}
                  </div>
                  {variantAttributeIds.length === 0 && (
                    <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                      Assign at least one attribute before adding product variants.
                    </p>
                  )}
                </fieldset>
              )}

              <div>
                <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Display Name</label>
                  <input
                    type="text"
                    value={editForm.display_name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, display_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Item Type</label>
                  <select
                    value={editForm.item_type}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, item_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs"
                  >
                    <option value="STOCK">Stockable Product</option>
                    <option value="RAW_MATERIAL">Raw Material</option>
                    <option value="WIP">Work In Progress</option>
                    <option value="FINISHED_GOOD">Finished Good</option>
                    <option value="CONSUMABLE">Consumable / Supplies</option>
                    <option value="NON_STOCK">Non-Stock Item</option>
                    <option value="MERCHANDISE">Merchandise</option>
                    <option value="ASSET">Fixed Asset</option>
                    <option value="SERVICE">Service (Non-stockable)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id || c.code} value={String(c.id ?? c.name)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Brand</label>
                  <select
                    value={editForm.brand}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, brand: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs"
                  >
                    <option value="">Select Brand</option>
                    {brands.map((b) => (
                      <option key={b.id || b.code} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Base UOM</label>
                  <select
                    value={editForm.base_uom}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, base_uom: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs"
                  >
                    {units.map((u) => (
                      <option key={u.code || u.id} value={u.code}>
                        {u.code} - {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Purchase UOM</label>
                  <select
                    value={editForm.purchase_uom}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, purchase_uom: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs"
                  >
                    {units.map((u) => (
                      <option key={u.code || u.id} value={u.code}>
                        {u.code} - {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Sales UOM</label>
                  <select
                    value={editForm.sales_uom}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, sales_uom: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs"
                  >
                    {units.map((u) => (
                      <option key={u.code || u.id} value={u.code}>
                        {u.code} - {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Standard Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.standard_cost}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, standard_cost: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">List Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.list_price}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, list_price: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Reorder Point</label>
                  <input
                    type="number"
                    value={editForm.reorder_point}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, reorder_point: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs tabular-nums"
                  />
                </div>
              </div>

              {/* Policy Toggles */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 space-y-2">
                <span className="font-semibold text-slate-800 dark:text-zinc-200 text-[11px] uppercase tracking-wider block">
                  Inventory & Traceability Policies
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.track_inventory}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, track_inventory: e.target.checked }))}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Track Physical Inventory</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.is_stockable}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, is_stockable: e.target.checked }))}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Stockable Item</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.batch_tracking_required}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, batch_tracking_required: e.target.checked }))}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Batch / Lot Tracking</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.serial_tracking_required}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, serial_tracking_required: e.target.checked }))}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Serial Number Tracking</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.expiry_tracking_required}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, expiry_tracking_required: e.target.checked }))}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Expiry Date Tracking</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.allow_negative_stock}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, allow_negative_stock: e.target.checked }))}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Allow Negative Stock</span>
                  </label>
                </div>
              </div>
            </form>
          ) : (
            <>
              {activeTab === "overview" && (
                <div className="space-y-5 text-xs">
                  {/* Metric Strip */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40">
                      <span className="text-slate-400">Standard Cost</span>
                      <div className="text-base font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                        ${numberOr(product.standard_cost ?? product.unit_cost, 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40">
                      <span className="text-slate-400">List Price</span>
                      <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                        ${numberOr(product.list_price, 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40">
                      <span className="text-slate-400">Base Unit</span>
                      <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                        {product.base_uom || product.unit || "EA"}
                      </div>
                    </div>
                  </div>

                  {/* Specification Grid */}
                  <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-blue-500" />
                      Classification & Commercial Parameters
                    </h3>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                      <div>
                        <span className="text-slate-400">SKU Code:</span>
                        <div className="font-mono font-medium text-slate-800 dark:text-zinc-200">{product.sku}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Primary Barcode:</span>
                        <div className="font-mono font-medium text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                          <Barcode className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span>{product.barcode || product.primary_barcode_value || product.sku}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Classification:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200">{product.classification || "STANDARD"}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Subcategory:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200">{product.subcategory || "N/A"}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Manufacturer:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200">{product.manufacturer || product.brand || "N/A"}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Country of Origin:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200">{product.country_of_origin || "N/A"}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Purchase UOM:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200">{product.purchase_uom || product.base_uom || "EA"}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Sales UOM:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200">{product.sales_uom || product.base_uom || "EA"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Physical Dimensions */}
                  <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-emerald-500" />
                      Physical Dimensions & Weight
                    </h3>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                      <div>
                        <span className="text-slate-400">Net Weight:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200">
                          {product.net_weight || 0} {product.weight_uom || "KG"}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Gross Weight:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200">
                          {product.gross_weight || 0} {product.weight_uom || "KG"}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Dimensions (L × W × H):</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200">
                          {product.length || 0} × {product.width || 0} × {product.height || 0} {product.dimension_uom || "CM"}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Calculated Volume:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200">
                          {((product.length || 0) * (product.width || 0) * (product.height || 0) / 1000).toFixed(2)} L
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audit Stamps */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <div>
                      <span>Created: {product.created_at ? new Date(product.created_at).toLocaleDateString() : "System"}</span>
                      {product.created_by && <span className="ml-1">by {product.created_by}</span>}
                    </div>
                    <div>
                      <span>Updated: {product.updated_at ? new Date(product.updated_at).toLocaleDateString() : "Just now"}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "stock" && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <span className="text-slate-400">Physical On-Hand</span>
                      <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
                        {(product.on_hand || 0).toLocaleString()} {product.base_uom || product.unit || "EA"}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <span className="text-slate-400">Allocated / Reserved</span>
                      <div className="text-xl font-bold tabular-nums text-purple-600 dark:text-purple-400 mt-1">
                        {(product.reserved || 0).toLocaleString()} {product.base_uom || product.unit || "EA"}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <span className="text-slate-400">Net Available</span>
                      <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                        {(product.available || 0).toLocaleString()} {product.base_uom || product.unit || "EA"}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 space-y-2">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">Reorder & Replenishment Rules</span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400">Reorder Threshold:</span>
                        <div className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                          {product.reorder_point || 0} {product.base_uom || product.unit || "EA"}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Lead Time:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200 mt-0.5">
                          {product.lead_time_days || 7} days
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "warehouses" && (
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                      <tr>
                        <th className="py-2.5 px-3 font-medium whitespace-nowrap">Facility</th>
                        <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">On-Hand</th>
                        <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200">Main Distribution Center (WH-MDC)</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-zinc-200">
                          {Math.floor((product.on_hand || 100) * 0.7).toLocaleString()} {product.base_uom || product.unit || "EA"}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {Math.floor((product.available || 80) * 0.7).toLocaleString()} {product.base_uom || product.unit || "EA"}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200">Regional Fulfillment Hub (WH-RFH)</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-zinc-200">
                          {Math.ceil((product.on_hand || 100) * 0.3).toLocaleString()} {product.base_uom || product.unit || "EA"}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {Math.ceil((product.available || 80) * 0.3).toLocaleString()} {product.base_uom || product.unit || "EA"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "variants" && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">Active Product Variants</span>
                      <p className="text-[11px] text-slate-400">Cartesian SKU matrix combinations with individual barcodes</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVariantModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Generate Matrix</span>
                    </button>
                  </div>

                  {variantsList.length === 0 ? (
                    <div className="p-8 text-center rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-400">
                      <Boxes className="h-8 w-8 mx-auto mb-2 opacity-40 text-slate-400" />
                      <p className="font-semibold">No variant combinations generated yet.</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Click "Generate Matrix" to build variants by selecting attributes like Size, Color, or Material.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                          <tr>
                            <th className="py-2.5 px-3 whitespace-nowrap font-medium">Variant SKU</th>
                            <th className="py-2.5 px-3 whitespace-nowrap font-medium">Variant Name / Spec</th>
                            <th className="py-2.5 px-3 whitespace-nowrap font-medium">Barcode</th>
                            <th className="py-2.5 px-3 whitespace-nowrap font-medium text-right">Add'l Cost</th>
                            <th className="py-2.5 px-3 whitespace-nowrap font-medium text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                          {variantsList.map((v) => (
                            <tr key={v.id || v.sku}>
                              <td className="py-2.5 px-3 font-mono font-medium text-blue-600 dark:text-blue-400">
                                {v.sku}
                              </td>
                              <td className="py-2.5 px-3 text-slate-800 dark:text-zinc-200">
                                {v.variant_name || v.name || v.variant_code || "Default Spec"}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                                {v.barcode || "N/A"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                                +${numberOr(v.additional_cost, 0).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                  {v.status || "ACTIVE"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Generate Variant Matrix Modal */}
                  {variantModalOpen && (
                    <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-blue-500" />
                            Generate Variant Matrix
                          </h3>
                          <button
                            onClick={() => setVariantModalOpen(false)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div>
                          <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">SKU Prefix</label>
                          <input
                            type="text"
                            value={variantSkuPrefix}
                            onChange={(e) => setVariantSkuPrefix(e.target.value)}
                            placeholder={product.sku}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs font-mono font-bold"
                          />
                        </div>

                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          <label className="block text-slate-500 dark:text-zinc-400 font-medium">
                            Select Attributes & Values:
                          </label>
                          {attributes.length > 0 ? (
                            attributes.map((attr) => (
                              <div key={attr.id || attr.code} className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-1.5">
                                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                                  {attr.name} ({attr.code})
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {(attr.predefined_values || ["Default"]).map((val) => {
                                    const isSel = (selectedAttrOptions[attr.code] || []).includes(val);
                                    return (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => handleToggleAttrVal(attr.code, val)}
                                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                                          isSel
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-blue-400"
                                        }`}
                                      >
                                        {val}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-slate-400 text-center py-4">
                              Loading enterprise attributes...
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                          <button
                            type="button"
                            onClick={() => setVariantModalOpen(false)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isGeneratingVariants}
                            onClick={handleGenerateMatrix}
                            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {isGeneratingVariants ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            <span>Generate Combinations</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "barcodes" && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">Multi-Barcode Aliases</span>
                      <p className="text-[11px] text-slate-400">Primary, Packaging (ITF-14), Supplier & Internal Barcodes</p>
                    </div>
                  </div>

                  {/* Add Barcode Form */}
                  <form onSubmit={handleAddBarcode} className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 space-y-3">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 block text-[11px] uppercase tracking-wider">
                      Register New Barcode Alias
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-slate-400 text-[10px] mb-0.5">Barcode String *</label>
                        <input
                          type="text"
                          required
                          value={newBarcode.barcode_value}
                          onChange={(e) => setNewBarcode((prev) => ({ ...prev, barcode_value: e.target.value }))}
                          placeholder="e.g. 10890123620508"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[10px] mb-0.5">Symbology</label>
                        <select
                          value={newBarcode.symbology}
                          onChange={(e) => setNewBarcode((prev) => ({ ...prev, symbology: e.target.value }))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                        >
                          <option value="CODE128">Code 128</option>
                          <option value="EAN13">EAN-13</option>
                          <option value="ITF14">ITF-14 (Outer Case)</option>
                          <option value="QR_CODE">QR Code 2D</option>
                          <option value="DATA_MATRIX">DataMatrix</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[10px] mb-0.5">Packaging Type</label>
                        <select
                          value={newBarcode.barcode_type}
                          onChange={(e) => setNewBarcode((prev) => ({ ...prev, barcode_type: e.target.value }))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                        >
                          <option value="PACKAGING">Packaging / Case</option>
                          <option value="SUPPLIER">Supplier Barcode</option>
                          <option value="PACKAGING_INNER">Inner Packaging</option>
                          <option value="PACKAGING_CASE">Case / Carton (ITF-14)</option>
                          <option value="CUSTOMER">Customer Specific</option>
                          <option value="PRIMARY">Primary Item</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={newBarcode.is_primary}
                          onChange={(e) => setNewBarcode((prev) => ({ ...prev, is_primary: e.target.checked }))}
                          className="rounded text-blue-600"
                        />
                        <span>Set as Primary Barcode</span>
                      </label>
                      <button
                        type="submit"
                        disabled={savingBarcode}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {savingBarcode ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        <span>Add Barcode</span>
                      </button>
                    </div>
                  </form>

                  {/* Barcodes Table */}
                  <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                        <tr>
                          <th className="py-2.5 px-3 font-medium">Barcode Value</th>
                          <th className="py-2.5 px-3 font-medium">Symbology</th>
                          <th className="py-2.5 px-3 font-medium">Type</th>
                          <th className="py-2.5 px-3 font-medium text-center">Primary</th>
                          <th className="py-2.5 px-3 font-medium text-center w-12">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {barcodes.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400">
                              No additional barcode aliases registered yet.
                            </td>
                          </tr>
                        ) : (
                          barcodes.map((b) => (
                            <tr key={b.id}>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-zinc-200">
                                {b.barcode_value}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                                {b.symbology}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                                {b.barcode_type}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {b.is_primary ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                    Primary
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBarcode(b.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "uom_conversions" && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">Product-Specific UOM Conversions</span>
                      <p className="text-[11px] text-slate-400">Packaging conversions (e.g. 1 BOX = 12 PCS, 1 CTN = 10 BOX)</p>
                    </div>
                  </div>

                  {/* Add Conversion Form */}
                  <form onSubmit={handleAddConversion} className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 space-y-3">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 block text-[11px] uppercase tracking-wider">
                      Add Product Packaging Conversion Rule
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-slate-400 text-[10px] mb-0.5">From Pack UOM *</label>
                        <select
                          value={newConversion.from_uom}
                          onChange={(e) => setNewConversion((prev) => ({ ...prev, from_uom: e.target.value }))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                        >
                          {units.map((u) => (
                            <option key={u.code || u.id} value={u.code}>
                              {u.code} ({u.name})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[10px] mb-0.5">Factor (= Multiple of To UOM) *</label>
                        <input
                          type="number"
                          step="0.0001"
                          required
                          value={newConversion.conversion_factor}
                          onChange={(e) => setNewConversion((prev) => ({ ...prev, conversion_factor: e.target.value }))}
                          placeholder="e.g. 12"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[10px] mb-0.5">To Base / Inner UOM *</label>
                        <select
                          value={newConversion.to_uom}
                          onChange={(e) => setNewConversion((prev) => ({ ...prev, to_uom: e.target.value }))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                        >
                          {units.map((u) => (
                            <option key={u.code || u.id} value={u.code}>
                              {u.code} ({u.name})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="submit"
                        disabled={savingConversion}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {savingConversion ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        <span>Save Conversion Rule</span>
                      </button>
                    </div>
                  </form>

                  {/* Conversions Table */}
                  <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                        <tr>
                          <th className="py-2.5 px-3 font-medium">Conversion Rule</th>
                          <th className="py-2.5 px-3 font-medium text-right">Factor</th>
                          <th className="py-2.5 px-3 font-medium text-center w-12">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {uomConversions.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-4 text-center text-slate-400">
                              No product-specific UOM conversions configured. Transactions use base UOM.
                            </td>
                          </tr>
                        ) : (
                          uomConversions.map((c) => (
                            <tr key={c.id}>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200">
                                1 {c.from_uom_name || c.from_uom} = {parseFloat(c.conversion_factor)} {c.to_uom_name || c.to_uom}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300 font-bold">
                                {parseFloat(c.conversion_factor)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteConversion(c.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "attachments" && (
                <div className="space-y-4 text-xs">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.svg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  />

                  <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                      uploading
                        ? "border-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                        : "border-slate-200 dark:border-zinc-800 hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-zinc-800/40 bg-slate-50/50 dark:bg-zinc-900/50"
                    }`}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-2" />
                        <span className="font-medium text-slate-900 dark:text-white">Validating & Uploading File...</span>
                        <span className="text-[11px] text-slate-400 mt-1">Verifying magic bytes and security signatures</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" />
                        <span className="font-medium text-slate-900 dark:text-white">Click or Drag & Drop to Upload</span>
                        <span className="text-[11px] text-slate-400 mt-1">PDF, CAD drawings, image specs up to 25MB</span>
                      </>
                    )}
                  </div>

                  {loadingDocs ? (
                    <div className="p-4 text-center text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Loading linked files...</span>
                    </div>
                  ) : attachments.length === 0 ? (
                    <div className="p-4 text-center rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-400">
                      No files or documents attached to this product yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 shrink-0">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 dark:text-white truncate">
                                {doc.file_name}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                <span>{formatFileSize(doc.file_size)}</span>
                                <span>•</span>
                                <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={doc.download_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                              title="Download / View"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                            <button
                              onClick={() => handleDeleteFile(doc.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                              title="Delete file"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
          <span className="text-slate-400">ID: {product.id}</span>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => {
                    setEditSaveError("");
                    setIsEditing(false);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs cursor-pointer flex items-center gap-1.5 disabled:cursor-wait disabled:opacity-60"
                >
                  {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{savingEdit ? "Saving..." : "Save Changes"}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit Product</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
