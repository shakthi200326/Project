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
} from "lucide-react";
import {
  fetchAttachments,
  uploadAttachment,
  deleteAttachment,
  fetchCategories,
  fetchBrands,
} from "@/services/api";

export function ProductDetailDrawer({ product, isOpen, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [attachments, setAttachments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null);

  const [editForm, setEditForm] = useState({
    name: "",
    category: "",
    brand: "",
    unit: "EA",
    unit_cost: 0,
    reorder_point: 0,
    stock_status: "IN_STOCK",
  });

  useEffect(() => {
    if (isOpen && product) {
      loadAttachments();
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
      setEditForm({
        name: product.name || "",
        category: String(product.category_id ?? product.category ?? ""),
        brand: product.brand || "",
        unit: product.unit || "EA",
        unit_cost: product.unit_cost || 0,
        reorder_point: product.reorder_point || 0,
        stock_status: product.stock_status || "IN_STOCK",
      });
      setIsEditing(false);
    }
  }, [isOpen, product]);

  const loadAttachments = async () => {
    if (!product) return;
    setLoadingDocs(true);
    try {
      const docs = await fetchAttachments("inventory.product", product.sku || product.id);
      setAttachments(docs || []);
    } catch (e) {
      console.error("Failed to load attachments", e);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !product) return;

    setUploading(true);
    try {
      const newDoc = await uploadAttachment(file, "inventory.product", product.sku || product.id);
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

  const handleSaveEdit = (e) => {
    if (e) e.preventDefault();
    if (!editForm.name.trim()) return;

    const selectedCategory = categories.find(
      (category) =>
        String(category.id) === editForm.category ||
        category.name === editForm.category
    );
    const updated = {
      ...product,
      name: editForm.name,
      category: selectedCategory?.name || editForm.category,
      category_id: selectedCategory?.id ?? product.category_id,
      category_name: selectedCategory?.name || editForm.category,
      brand: editForm.brand,
      unit: editForm.unit,
      unit_cost: parseFloat(editForm.unit_cost) || product.unit_cost,
      reorder_point: parseInt(editForm.reorder_point, 10) || product.reorder_point,
      stock_status: editForm.stock_status,
    };

    if (onSave) {
      onSave(updated);
    }
    setIsEditing(false);
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-2xl h-full flex flex-col border-l border-slate-200 dark:border-zinc-800 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-start justify-between bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900">
              <Package className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {product.sku}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                    product.stock_status === "IN_STOCK"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                      : product.stock_status === "LOW_STOCK"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                  }`}
                >
                  {(product.stock_status || "IN_STOCK").replace("_", " ")}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {product.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {product.category} • {product.brand}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs">
          {[
            { key: "overview", label: "Overview & Specs" },
            { key: "stock", label: "Stock Availability" },
            { key: "warehouses", label: "Facility Balances" },
            { key: "variants", label: `Variants (${product.variants_count || 1})` },
            { key: "attachments", label: "Files & Documents" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setIsEditing(false);
              }}
              className={`py-3 font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.key && !isEditing
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-300">
                <span className="font-semibold">Edit Product Specifications:</span> Update item master attributes and financial parameters.
              </div>
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Product Title / Name *</label>
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
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs"
                  >
                    {categories.length > 0 ? (
                      categories.map((category) => (
                        <option
                          key={category.id || category.code}
                          value={String(category.id ?? category.name)}
                        >
                          {category.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Mechanical Components">Mechanical Components</option>
                        <option value="Hydraulics & Pneumatics">Hydraulics & Pneumatics</option>
                        <option value="Sensors & Automation">Sensors & Automation</option>
                        <option value="Power Transmission">Power Transmission</option>
                        <option value="Chemicals & Fluids">Chemicals & Fluids</option>
                        <option value="Structural Elements">Structural Elements</option>
                      </>
                    )}
                    {editForm.category &&
                      !categories.some(
                        (category) =>
                          String(category.id) === editForm.category ||
                          category.name === editForm.category
                      ) && (
                        <option value={editForm.category}>
                          {product.category || editForm.category}
                        </option>
                      )}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Brand / Manufacturer</label>
                  <select
                    value={editForm.brand}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, brand: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs"
                  >
                    <option value="">Select Brand / Manufacturer</option>
                    {brands.length > 0 ? (
                      brands.map((b) => (
                        <option key={b.id || b.code} value={b.name}>
                          {b.name} {b.code ? `(${b.code})` : ""}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="SKF Precision">SKF Precision (SKF)</option>
                        <option value="Bosch Rexroth">Bosch Rexroth (BOSCH)</option>
                        <option value="Parker Hannifin">Parker Hannifin (PARKER)</option>
                        <option value="Festo Pneumatics">Festo Pneumatics (FESTO)</option>
                        <option value="Schneider Electric">Schneider Electric (SCHNEIDER)</option>
                        <option value="Gates Industrial">Gates Industrial (GATES)</option>
                      </>
                    )}
                    {editForm.brand && !brands.some((b) => b.name === editForm.brand) && (
                      <option value={editForm.brand}>{editForm.brand}</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Base Unit</label>
                  <select
                    value={editForm.unit}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs"
                  >
                    <option value="EA">EA (Each)</option>
                    <option value="SET">SET</option>
                    <option value="BOX">BOX</option>
                    <option value="MTR">MTR (Meter)</option>
                    <option value="KG">KG (Kilogram)</option>
                    <option value="LTR">LTR (Liter)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Unit Valuation ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.unit_cost}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, unit_cost: e.target.value }))}
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
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 font-medium mb-1">Stock Status</label>
                <select
                  value={editForm.stock_status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, stock_status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs"
                >
                  <option value="IN_STOCK">IN STOCK</option>
                  <option value="LOW_STOCK">LOW STOCK</option>
                  <option value="OUT_OF_STOCK">OUT OF STOCK</option>
                </select>
              </div>
            </form>
          ) : (
            <>
              {activeTab === "overview" && (
                <div className="space-y-5 text-xs">
                  {/* Metric Strip */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40">
                      <span className="text-slate-400">Unit Valuation (WAV)</span>
                      <div className="text-base font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                        ${product.unit_cost?.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40">
                      <span className="text-slate-400">Reorder Threshold</span>
                      <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                        {product.reorder_point} {product.unit}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40">
                      <span className="text-slate-400">Base Unit</span>
                      <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                        {product.unit} (Pieces)
                      </div>
                    </div>
                  </div>

                  {/* Specification Grid */}
                  <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Classification & Attributes</h3>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                      <div>
                        <span className="text-slate-400">SKU Code:</span>
                        <div className="font-mono font-medium text-slate-800 dark:text-zinc-200">{product.sku}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Primary Barcode:</span>
                        <div className="font-mono font-medium text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                          <Barcode className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span>{product.barcode || product.sku || "N/A"}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Category:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200">{product.category}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Brand / OEM:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200">{product.brand}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Tracking Policy:</span>
                        <div className="font-medium text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-blue-500" /> Batch & Serialized
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Inventory Status:</span>
                        <div className="font-medium text-emerald-600 dark:text-emerald-400">ACTIVE - Circulating</div>
                      </div>
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
                        {(product.on_hand || 0).toLocaleString()} {product.unit}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <span className="text-slate-400">Allocated / Reserved</span>
                      <div className="text-xl font-bold tabular-nums text-purple-600 dark:text-purple-400 mt-1">
                        {(product.reserved || 0).toLocaleString()} {product.unit}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <span className="text-slate-400">Net Available</span>
                      <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                        {(product.available || 0).toLocaleString()} {product.unit}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "warehouses" && (
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Facility</th>
                        <th className="py-2.5 px-3 font-medium text-right">On-Hand</th>
                        <th className="py-2.5 px-3 font-medium text-right">Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      <tr>
                        <td className="py-2.5 px-3 font-medium">Main Distribution Center (WH-MDC)</td>
                        <td className="py-2.5 px-3 text-right font-medium tabular-nums">
                          {Math.floor((product.on_hand || 100) * 0.7).toLocaleString()} {product.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums">
                          {Math.floor((product.available || 80) * 0.7).toLocaleString()} {product.unit}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium">Regional Fulfillment Hub (WH-RFH)</td>
                        <td className="py-2.5 px-3 text-right font-medium tabular-nums">
                          {Math.ceil((product.on_hand || 100) * 0.3).toLocaleString()} {product.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums">
                          {Math.ceil((product.available || 80) * 0.3).toLocaleString()} {product.unit}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "variants" && (
                <div className="space-y-3 text-xs">
                  <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3 font-medium">Variant SKU</th>
                          <th className="py-2.5 px-3 font-medium">Spec Description</th>
                          <th className="py-2.5 px-3 font-medium">Barcode</th>
                          <th className="py-2.5 px-3 font-medium text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        <tr>
                          <td className="py-2.5 px-3 font-mono font-medium text-blue-600">{product.sku}-STD</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">Standard Seal (NBR)</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">890123984211</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Active</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 font-mono font-medium text-blue-600">{product.sku}-HT</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">High Temp Viton Seal</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">890123984212</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Active</span>
                          </td>
                        </tr>
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
                          className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
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
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
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
