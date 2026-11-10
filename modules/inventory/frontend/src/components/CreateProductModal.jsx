import React, { useState, useEffect } from "react";
import {
  X,
  Package,
  Layers,
  Tag,
  Ruler,
  Barcode,
  Shield,
  Save,
  AlertCircle,
  Sparkles,
  DollarSign,
  Scale,
  Sliders,
  ChevronRight,
  ChevronLeft,
  Image,
} from "lucide-react";
import {
  createProduct,
  fetchCategories,
  fetchBrands,
  fetchUnits,
  generateEan13,
  uploadAttachment,
} from "../services/api";
import { ScrollableTabs } from "./ScrollableTabs.jsx";

// Blank form; also used to reset after a product is saved.
const EMPTY_PRODUCT_FORM = {
  code: "",
  name: "",
  display_name: "",
  short_description: "",
  description: "",
  category: "",
  category_id: null,
  subcategory: null,
  brand: "",
  brand_id: null,
  item_type: "STOCK",
  status: "DRAFT",
  manufacturer: "",
  model_number: "",
  country_of_origin: "",
  base_unit: "",
  base_uom: null,
  purchase_uom: null,
  sales_uom: null,
  track_inventory: true,
  is_stockable: true,
  is_purchasable: true,
  is_salable: true,
  allow_negative_stock: false,
  tracking: "NONE",
  batch_tracking_required: false,
  serial_tracking_required: false,
  expiry_tracking_required: false,
  has_variants: false,
  standard_cost: 0.0,
  list_price: 0.0,
  reorder_point: 50,
  reorder_quantity: 100,
  min_order_qty: 1,
  lead_time_days: 3,
  purchase_tax_code: "",
  sales_tax_code: "",
  net_weight: "",
  gross_weight: "",
  length: "",
  width: "",
  height: "",
  barcode: "",
};

export function CreateProductModal({ isOpen, onClose, onCreated }) {
  const [tab, setTab] = useState("basic");
  const steps = [
    { key: "basic", label: "1. Basic & Classification" },
    { key: "tracking", label: "2. Policy & UOM" },
    { key: "costing", label: "3. Costing & Reorder" },
    { key: "specs", label: "4. Physical Specs & Barcode" },
    { key: "media", label: "5. Product Media" },
  ];
  const currentStepIndex = steps.findIndex((step) => step.key === tab);

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [units, setUnits] = useState([]);

  const [formData, setFormData] = useState(EMPTY_PRODUCT_FORM);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [createdItem, setCreatedItem] = useState(null);
  const [uploadedMediaCount, setUploadedMediaCount] = useState(0);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab("basic");
      setError("");
      setFormData(EMPTY_PRODUCT_FORM);
      setMediaFiles([]);
      setCreatedItem(null);
      setUploadedMediaCount(0);
      Promise.allSettled([fetchCategories(), fetchBrands(), fetchUnits()]).then((results) => {
        const [categoryResult, brandResult, unitResult] = results;
        if (categoryResult.status === "fulfilled") {
          setCategories(categoryResult.value.results || categoryResult.value || []);
        } else {
          setCategories([]);
        }
        if (brandResult.status === "fulfilled") {
          setBrands(brandResult.value.results || brandResult.value || []);
        } else {
          setBrands([]);
        }
        if (unitResult.status === "fulfilled") {
          setUnits(unitResult.value.results || unitResult.value || []);
        } else {
          setUnits([]);
        }
        const failures = results.filter((result) => result.status === "rejected");
        if (failures.length) {
          setError("Some dropdown data could not be loaded. Check the connection and refresh before saving.");
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    const cat = categories.find((c) => String(c.id) === String(catId));
    setFormData((prev) => ({
      ...prev,
      category_id: cat ? cat.id : null,
      category: cat ? cat.name : "",
      subcategory: null,
    }));
  };

  const handleBaseUomChange = (e) => {
    const unit = units.find((u) => String(u.id) === e.target.value);
    setFormData((prev) => ({
      ...prev,
      base_uom: unit ? unit.code : null,
      base_unit: unit ? unit.code : "",
    }));
  };

  const handleItemTypeChange = (e) => {
    const itemType = e.target.value;
    setFormData((prev) => itemType === "SERVICE" ? ({
      ...prev,
      item_type: itemType,
      is_stockable: false,
      track_inventory: false,
      tracking: "NONE",
      batch_tracking_required: false,
      serial_tracking_required: false,
      expiry_tracking_required: false,
      has_variants: false,
    }) : ({ ...prev, item_type: itemType }));
  };

  const handleBrandChange = (e) => {
    const brandId = e.target.value;
    const b = brands.find((brand) => String(brand.id) === String(brandId));
    setFormData((prev) => ({
      ...prev,
      brand_id: b ? b.id : null,
      brand: b ? b.name : "",
    }));
  };

  const handleTrackingChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({
      ...prev,
      tracking: val,
      batch_tracking_required: val === "BATCH",
      serial_tracking_required: val === "SERIAL",
      expiry_tracking_required: val === "BATCH" ? prev.expiry_tracking_required : false,
    }));
  };

  const handleNext = () => {
    if (tab === "basic") {
      if (!formData.code.trim() || !formData.name.trim() || !formData.category_id) {
        setError("Item Code, Item Name, and Category are required.");
        return;
      }
      setError("");
      setTab("tracking");
    } else if (tab === "tracking") {
      setError("");
      setTab("costing");
    } else if (tab === "costing") {
      setError("");
      setTab("specs");
    } else if (tab === "specs") {
      setError("");
      setTab("media");
    }
  };

  const handleBack = () => {
    setError("");
    if (tab === "media") setTab("specs");
    else if (tab === "specs") setTab("costing");
    else if (tab === "costing") setTab("tracking");
    else if (tab === "tracking") setTab("basic");
  };

  const finishCreate = () => {
    setFormData(EMPTY_PRODUCT_FORM);
    setMediaFiles([]);
    setCreatedItem(null);
    setUploadedMediaCount(0);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim() || !formData.category_id) {
      setError("Item Code, Item Name, and Category are required.");
      setTab("basic");
      return;
    }
    if (formData.track_inventory && formData.is_stockable && !formData.base_uom) {
      setError("Select a registered Base UOM for a stock-tracked item.");
      setTab("tracking");
      return;
    }

    setError("");
    setSubmitting(true);
    let item = createdItem;

    try {
      if (!item) {
        const selectedCategory = categories.find(
          (category) => String(category.id) === String(formData.category_id)
        );
        if (!selectedCategory) {
          throw new Error("The selected category is unavailable. Refresh the form and try again.");
        }
        const payload = {
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          display_name: formData.display_name.trim() || formData.name.trim(),
          short_description: formData.short_description.trim(),
          description: formData.description.trim(),
          item_type: formData.item_type,
          status: formData.status,
          category: selectedCategory.id,
          category_id: selectedCategory.id,
          category_name: selectedCategory.name,
          subcategory: formData.subcategory || null,
          brand: formData.brand,
          brand_ref: formData.brand_id || null,
          manufacturer: formData.manufacturer.trim(),
          model_number: formData.model_number.trim(),
          country_of_origin: formData.country_of_origin.trim().toUpperCase(),
          base_unit: formData.base_unit,
          base_uom: formData.base_uom || null,
          purchase_uom: formData.is_purchasable ? formData.purchase_uom : null,
          sales_uom: formData.is_salable ? formData.sales_uom : null,
          track_inventory: formData.track_inventory,
          is_stockable: formData.is_stockable,
          is_purchasable: formData.is_purchasable,
          is_salable: formData.is_salable,
          allow_negative_stock: formData.allow_negative_stock,
          tracking: formData.tracking,
          batch_tracking_required: formData.batch_tracking_required,
          serial_tracking_required: formData.serial_tracking_required,
          expiry_tracking_required: formData.expiry_tracking_required,
          has_variants: formData.has_variants,
          standard_cost: Number(formData.standard_cost) || 0,
          list_price: Number(formData.list_price) || 0,
          reorder_point: Number(formData.reorder_point) || 0,
          reorder_quantity: Number(formData.reorder_quantity) || 0,
          min_order_qty: Number(formData.min_order_qty) || 1,
          lead_time_days: Number(formData.lead_time_days) || 0,
          purchase_tax_code: formData.purchase_tax_code.trim(),
          sales_tax_code: formData.sales_tax_code.trim(),
          net_weight: formData.net_weight ? Number(formData.net_weight) : null,
          gross_weight: formData.gross_weight ? Number(formData.gross_weight) : null,
          length: formData.length ? Number(formData.length) : null,
          width: formData.width ? Number(formData.width) : null,
          height: formData.height ? Number(formData.height) : null,
          barcode: formData.barcode?.trim() || generateEan13(),
        };
        item = await createProduct(payload);
        setCreatedItem(item);
        if (onCreated) onCreated(item);
      }

      for (let index = uploadedMediaCount; index < mediaFiles.length; index += 1) {
        await uploadAttachment(
          mediaFiles[index],
          "apps.products.models.InventoryItem",
          item.id
        );
        setUploadedMediaCount(index + 1);
      }
      finishCreate();
    } catch (err) {
      setError(item
        ? `Item was saved, but media upload failed: ${err.message}. Submit again to retry the remaining files.`
        : err.message || "Failed to register item. Please check the fields and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-zinc-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/20">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Create Master Item
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                  <Sparkles className="h-2.5 w-2.5" />
                  Enterprise ERP Master
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Define master identity, multi-UOM conversions, tracking policies, and commercial specifications.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="shrink-0 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <ScrollableTabs stripClassName="flex items-center gap-2 px-6 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs" role="group">
          {steps.map((t, index) => (
            <button
              key={t.key}
              onClick={() => {
                setError("");
                setTab(t.key);
              }}
              type="button"
              disabled={submitting || Boolean(createdItem)}
              className={`py-3 font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                tab === t.key
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </ScrollableTabs>

        {/* Error alert */}
        {error && (
          <div className="m-5 mb-0 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 text-xs max-h-[62vh] overflow-y-auto">
            {/* TAB 1: BASIC & IDENTITY */}
            {tab === "basic" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Item Code / SKU <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="e.g. BRG-6205-2RS"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono uppercase font-semibold text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Item Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. Industrial Ball Bearing 6205-2RS"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Display Name (Catalog / POS)
                    </label>
                    <input
                      type="text"
                      name="display_name"
                      value={formData.display_name}
                      onChange={handleChange}
                      placeholder="Commercial display label"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Item Type
                    </label>
                    <select
                      name="item_type"
                      value={formData.item_type}
                      onChange={handleItemTypeChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                    >
                      <option value="STOCK">Stockable Product</option>
                      <option value="RAW_MATERIAL">Raw Material</option>
                      <option value="WIP">Work In Progress</option>
                      <option value="FINISHED_GOOD">Finished Good</option>
                      <option value="CONSUMABLE">Consumable / Supplies</option>
                      <option value="NON_STOCK">Non-Stock Item</option>
                      <option value="SERVICE">Service / Labor</option>
                      <option value="ASSET">Capital Asset</option>
                      <option value="MERCHANDISE">Retail Merchandise</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.category_id || ""}
                      onChange={handleCategoryChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                      required
                    >
                      <option value="">-- Select Category --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} – {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Subcategory
                    </label>
                    <select
                      value={formData.subcategory || ""}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        subcategory: e.target.value ? Number(e.target.value) : null,
                      }))}
                      disabled={!formData.category_id}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer disabled:opacity-50"
                    >
                      <option value="">No subcategory</option>
                      {categories
                        .filter((category) => String(category.parent || "") === String(formData.category_id || ""))
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.code} – {category.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Brand / OEM Manufacturer
                    </label>
                    <select
                      value={formData.brand_id || ""}
                      onChange={handleBrandChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                    >
                      <option value="">-- Select Brand --</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Manufacturer
                    </label>
                    <input
                      type="text"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleChange}
                      placeholder="e.g. SKF Group"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Model Number
                    </label>
                    <input
                      type="text"
                      name="model_number"
                      value={formData.model_number}
                      onChange={handleChange}
                      placeholder="e.g. 6205-2RSH"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Country of Origin
                    </label>
                    <input
                      type="text"
                      name="country_of_origin"
                      value={formData.country_of_origin}
                      onChange={handleChange}
                      placeholder="e.g. USA, DEU, SWE"
                      maxLength={3}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs uppercase font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Product details and specifications"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Short Description (Invoices & PO lines)
                  </label>
                  <input
                    type="text"
                    name="short_description"
                    value={formData.short_description}
                    onChange={handleChange}
                    placeholder="Brief 1-sentence product summary"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 2: POLICY & UOM */}
            {tab === "tracking" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Base Stock UOM <span className="text-rose-500">*</span>
                    </label>
                    <select
                      name="base_unit"
                      value={units.find((unit) => unit.code === formData.base_unit)?.id || ""}
                      onChange={handleBaseUomChange}
                      required={formData.track_inventory && formData.is_stockable}
                      disabled={units.length === 0 || !formData.track_inventory || !formData.is_stockable}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                    >
                      <option value="">Select registered Base UOM</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code} – {u.name} ({u.dimension})
                        </option>
                      ))}
                    </select>
                    {units.length === 0 && (
                      <p className="mt-1 text-[10px] text-amber-600">Register a UOM before creating a stock-tracked item.</p>
                    )}
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Default Purchase UOM
                    </label>
                    <select
                      name="purchase_uom"
                      value={formData.purchase_uom || ""}
                      onChange={(e) => setFormData({ ...formData, purchase_uom: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                    >
                      <option value="">Same as Base UOM</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code} – {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Default Sales UOM
                    </label>
                    <select
                      name="sales_uom"
                      value={formData.sales_uom || ""}
                      onChange={(e) => setFormData({ ...formData, sales_uom: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                    >
                      <option value="">Same as Base UOM</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code} – {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 space-y-3">
                  <div className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    Traceability & Inventory Governance
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-zinc-400 mb-1">
                        Tracking Policy
                      </label>
                      <select
                        value={formData.tracking}
                        onChange={handleTrackingChange}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden cursor-pointer"
                      >
                        <option value="NONE">No Individual Tracking</option>
                        <option value="BATCH">Batch / Lot Tracking</option>
                        <option value="SERIAL">Serial Number Tracking</option>
                      </select>
                    </div>
                    {formData.tracking === "BATCH" && (
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          id="expiry_req"
                          name="expiry_tracking_required"
                          checked={formData.expiry_tracking_required}
                          onChange={handleChange}
                          className="rounded text-blue-600 h-4 w-4"
                        />
                        <label htmlFor="expiry_req" className="font-medium text-slate-700 dark:text-zinc-300">
                          Mandate Expiration Date Tracking
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="track_inventory"
                        checked={formData.track_inventory}
                        onChange={handleChange}
                        className="rounded text-blue-600 h-4 w-4"
                      />
                      <span className="text-slate-700 dark:text-zinc-300">Track Warehouse Stock</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="allow_negative_stock"
                        checked={formData.allow_negative_stock}
                        onChange={handleChange}
                        className="rounded text-blue-600 h-4 w-4"
                      />
                      <span className="text-slate-700 dark:text-zinc-300">Allow Negative Stock</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="is_purchasable"
                        checked={formData.is_purchasable}
                        onChange={handleChange}
                        className="rounded text-blue-600 h-4 w-4"
                      />
                      <span className="text-slate-700 dark:text-zinc-300">Allow on Purchase Orders</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="is_salable"
                        checked={formData.is_salable}
                        onChange={handleChange}
                        className="rounded text-blue-600 h-4 w-4"
                      />
                      <span className="text-slate-700 dark:text-zinc-300">Allow on Sales Orders</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Has Product Variants</div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">Enable if product has sizes, colors, or technical variations. Configure combinations in Product Variants after saving.</div>
                  </div>
                  <input
                    type="checkbox"
                    name="has_variants"
                    checked={formData.has_variants}
                    onChange={handleChange}
                    className="rounded text-blue-600 h-5 w-5 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* TAB 3: COSTING & REORDER */}
            {tab === "costing" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Standard Cost ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="standard_cost"
                      value={formData.standard_cost}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      List Price / MSRP ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="list_price"
                      value={formData.list_price}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Reorder Threshold Point (Units)
                    </label>
                    <input
                      type="number"
                      name="reorder_point"
                      value={formData.reorder_point}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Target Reorder Quantity (Units)
                    </label>
                    <input
                      type="number"
                      name="reorder_quantity"
                      value={formData.reorder_quantity}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Minimum Order Quantity (MOQ)
                    </label>
                    <input
                      type="number"
                      name="min_order_qty"
                      value={formData.min_order_qty}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Supplier Lead Time (Days)
                    </label>
                    <input
                      type="number"
                      name="lead_time_days"
                      value={formData.lead_time_days}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Purchase Tax Code
                    </label>
                    <input
                      type="text"
                      name="purchase_tax_code"
                      value={formData.purchase_tax_code}
                      onChange={handleChange}
                      placeholder="e.g. TAX-PUR-STD-19"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Sales Tax Code
                    </label>
                    <input
                      type="text"
                      name="sales_tax_code"
                      value={formData.sales_tax_code}
                      onChange={handleChange}
                      placeholder="e.g. TAX-SLS-STD-19"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PHYSICAL SPECS & BARCODE */}
            {tab === "specs" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Net Weight (KG)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      name="net_weight"
                      value={formData.net_weight}
                      onChange={handleChange}
                      placeholder="0.000"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Gross Weight (Packaging + Item KG)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      name="gross_weight"
                      value={formData.gross_weight}
                      onChange={handleChange}
                      placeholder="0.000"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Length (CM)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="length"
                      value={formData.length}
                      onChange={handleChange}
                      placeholder="0.0"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Width (CM)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="width"
                      value={formData.width}
                      onChange={handleChange}
                      placeholder="0.0"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Height (CM)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="height"
                      value={formData.height}
                      onChange={handleChange}
                      placeholder="0.0"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Primary Barcode / EAN-13 / UPC
                  </label>
                  <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleChange}
                    placeholder="Leave empty to auto-generate valid 13-digit EAN"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                    Additional packaging, case carton (ITF-14), and vendor barcodes can be registered in the Barcodes tab.
                  </p>
                </div>
              </div>
            )}

            {tab === "media" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 p-4">
                  <Image className="h-5 w-5 shrink-0 text-blue-600" />
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-zinc-200">Product media and attachments</div>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                      Files are attached to the saved item through shared file storage. You can also add them later from Product Media.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Choose product images or documents
                  </label>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.docx,.txt"
                    disabled={Boolean(createdItem)}
                    onChange={(e) => setMediaFiles(Array.from(e.target.files || []))}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950 dark:file:text-blue-300 disabled:opacity-50"
                  />
                  {mediaFiles.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-zinc-400">
                      {mediaFiles.map((file) => (
                        <li key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</li>
                      ))}
                    </ul>
                  )}
                  {createdItem && (
                    <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400">
                      Item saved. Submit again to retry any media files that did not upload.
                    </p>
                  )}
                </div>
                {formData.has_variants && (
                  <div className="rounded-lg border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 text-[11px] text-indigo-800 dark:text-indigo-300">
                    This item is marked as variant-enabled. Configure variant combinations in the Product Variants module after saving.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="p-4 px-6 bg-slate-50/60 dark:bg-zinc-900/60 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={tab === "basic" || submitting || Boolean(createdItem)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {tab !== "media" ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={submitting || Boolean(createdItem)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  Next Step
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                createdItem ? (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {submitting ? "Uploading..." : uploadedMediaCount < mediaFiles.length ? "Retry Media Upload" : "Finish"}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {submitting ? "Saving..." : formData.status === "DRAFT" ? "Save Draft" : formData.status === "INACTIVE" ? "Save Inactive Item" : "Activate Item"}
                  </button>
                )
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
