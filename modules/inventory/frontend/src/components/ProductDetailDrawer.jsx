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
} from "lucide-react";
import {
  fetchAttachments,
  uploadAttachment,
  deleteAttachment,
} from "@/services/api";

export function ProductDetailDrawer({ product, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [attachments, setAttachments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && product) {
      loadAttachments();
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
                  {product.stock_status.replace("_", " ")}
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
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
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 font-medium border-b-2 transition-colors ${
                activeTab === tab.key
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
                      <Barcode className="h-3.5 w-3.5 text-slate-400" /> 890123984210
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Category:</span>
                    <div className="font-medium text-slate-800 dark:text-zinc-200">{product.category}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Brand / Manufacturer:</span>
                    <div className="font-medium text-slate-800 dark:text-zinc-200">{product.brand}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Item Type:</span>
                    <div className="font-medium text-slate-800 dark:text-zinc-200">Stockable Product</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Tracking Method:</span>
                    <div className="font-medium text-slate-800 dark:text-zinc-200">Batch / Lot Tracked</div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 space-y-2">
                <h3 className="font-semibold text-slate-900 dark:text-white">Product Description</h3>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Heavy-duty industrial ball bearing designed for high radial loads and moderate thrust loads.
                  Equipped with dual rubber contact seals (2RS) for superior dust and fluid ingress protection.
                </p>
              </div>
            </div>
          )}

          {activeTab === "stock" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Stock Availability Formula
                </h3>
                <div className="p-2.5 rounded bg-white dark:bg-zinc-900 font-mono text-[11px] text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-zinc-800">
                  Available ({product.available}) = On-hand ({product.on_hand}) - Reserved ({product.reserved}) - Blocked (0)
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="p-2 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                    <span className="text-[10px] text-slate-400">Total Physical</span>
                    <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {product.on_hand} {product.unit}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                    <span className="text-[10px] text-slate-400">Committed/Reserved</span>
                    <div className="text-sm font-bold text-purple-600 dark:text-purple-400 tabular-nums mt-0.5">
                      {product.reserved} {product.unit}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                    <span className="text-[10px] text-slate-400">Net Free for Dispatch</span>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                      {product.available} {product.unit}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "warehouses" && (
            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Facility</th>
                      <th className="py-2.5 px-3 font-medium">Bin/Rack</th>
                      <th className="py-2.5 px-3 font-medium text-right">On-Hand</th>
                      <th className="py-2.5 px-3 font-medium text-right">Available</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">Main Central Fulfillment Hub</td>
                      <td className="py-2.5 px-3 text-slate-500">Aisle 3 - Rack B</td>
                      <td className="py-2.5 px-3 text-right font-medium tabular-nums">{product.on_hand - 50} EA</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums">{product.available - 50} EA</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">East Coast Logistics Terminal</td>
                      <td className="py-2.5 px-3 text-slate-500">Bay 1 - Bin 04</td>
                      <td className="py-2.5 px-3 text-right font-medium tabular-nums">50 EA</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums">50 EA</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "variants" && (
            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Variant SKU</th>
                      <th className="py-2.5 px-3 font-medium">Attributes</th>
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
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
          <span className="text-slate-400">ID: {product.id}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium"
            >
              Close
            </button>
            <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs">
              Edit Product
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
