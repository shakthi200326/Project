import React, { useState, useEffect } from "react";
import {
  Camera,
  Upload,
  FileText,
  Download,
  Trash2,
  Search,
  ShieldCheck,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { API_BASE, fetchProducts } from "../services/api.js";

export function ProductMediaPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await fetchProducts();
      const list = data?.results || (Array.isArray(data) ? data : []);
      setProducts(list);
      if (list.length > 0 && !selectedProduct) {
        setSelectedProduct(list[0]);
        loadAttachments(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load products for media gallery:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async (itemId) => {
    if (!itemId) return;
    setLoadingAttachments(true);
    try {
      const res = await fetch(`${API_BASE}/storage/files/?owner_type=apps.products.models.InventoryItem&owner_id=${itemId}`);
      if (!res.ok) throw new Error("Failed to load product attachments.");
      const data = await res.json();
      setAttachments(data?.results || (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error("Failed to load attachments:", err);
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleSelectProduct = (prod) => {
    setSelectedProduct(prod);
    loadAttachments(prod.id);
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!fileToUpload || !selectedProduct) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", fileToUpload);
    formData.append("owner_type", "apps.products.models.InventoryItem");
    formData.append("owner_id", String(selectedProduct.id));
    formData.append("display_name", displayName.trim() || fileToUpload.name);
    formData.append("is_public", "false");

    try {
      const res = await fetch(`${API_BASE}/storage/files/`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "File upload failed.");
      }
      setFileToUpload(null);
      setDisplayName("");
      loadAttachments(selectedProduct.id);
    } catch (err) {
      alert("Security rejection or upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (fileId) => {
    if (!confirm("Are you sure you want to remove this attachment?")) return;
    try {
      const res = await fetch(`${API_BASE}/storage/files/${fileId}/`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== fileId));
      } else {
        alert(`Failed to delete attachment (HTTP ${res.status}).`);
      }
    } catch (err) {
      alert("Failed to delete attachment: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Camera className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Product Media & Document Attachments
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Secure polymorphic file storage for high-res images, spec sheets, compliance certificates, and manuals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Antivirus & Extension Validated
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product Selector */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Select Product Master
          </h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-8 text-center text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                Loading catalog...
              </div>
            ) : products.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No products available.</p>
            ) : (
              products.map((p) => {
                const isSelected = selectedProduct?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-200 font-semibold"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                      <span>{p.code}</span>
                      <span className="capitalize">{p.item_type?.toLowerCase()}</span>
                    </div>
                    <div className="text-sm font-bold truncate mt-0.5">{p.name}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Upload Form & Attached Media */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Form */}
          {selectedProduct && (
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Upload Asset for {selectedProduct.name} ({selectedProduct.code})
              </h3>
              <form onSubmit={handleFileUpload} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Display Title
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Technical Datasheet PDF, Front View"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Choose File (PDF, PNG, JPG, WEBP)
                    </label>
                    <input
                      type="file"
                      required
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.docx,.txt"
                      onChange={(e) => setFileToUpload(e.target.files[0])}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950 dark:file:text-indigo-300"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-400 italic">
                    Maximum 25 MB. Disallowed file formats (.exe, .sh, .dll) are automatically blocked.
                  </p>
                  <button
                    type="submit"
                    disabled={uploading || !fileToUpload}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm"
                  >
                    {uploading ? "Uploading & Validating..." : "Upload File"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Attached Files List */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <span>Attached Documents & Media ({attachments.length})</span>
              {selectedProduct && (
                <button
                  onClick={() => loadAttachments(selectedProduct.id)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reload
                </button>
              )}
            </h3>

            {loadingAttachments ? (
              <div className="py-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                Loading attachments...
              </div>
            ) : attachments.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No documents or images attached for this product yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {attachments.map((file) => {
                  const isImage = file.mime_type?.startsWith("image/");
                  return (
                    <div
                      key={file.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                          {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                            {file.display_name || file.file_name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {(file.file_size / 1024).toFixed(1)} KB &bull; {file.mime_type}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`${API_BASE}/storage/files/${file.id}/download/`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                          title="Download File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleDeleteAttachment(file.id)}
                          className="p-1.5 rounded-lg border border-red-200 text-red-600 dark:border-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                          title="Remove Attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default ProductMediaPage;
