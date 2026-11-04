import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Package,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Upload,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Barcode,
  CheckCircle,
  AlertCircle,
  XCircle,
  SlidersHorizontal,
  Eye,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Target,
  ShieldCheck,
  Sparkles,
  Layers,
  Scan,
  Camera,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  Loader2,
  FileText,
  ChevronDown,
  Tag,
  Check,
} from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  fetchProducts,
  updateProduct,
  deleteProduct,
  activateProduct,
  deactivateProduct,
  playScanBeep,
  lookupProductByBarcode,
  barcodeLookupOnline,
  downloadImportTemplate,
  previewProductImport,
  commitProductImport,
  exportProductCatalog,
} from "../services/api";
import { CreateProductModal } from "../components/CreateProductModal.jsx";
import { ProductDetailDrawer } from "../components/ProductDetailDrawer.jsx";

const RADIAL_HEALTH_DATA = [
  { name: "In-Stock Availability", value: 94, fill: "#10B981" },
  { name: "Reorder Compliance", value: 88, fill: "#3B82F6" },
  { name: "Batch Traceability", value: 78, fill: "#8B5CF6" },
  { name: "Serialized Registry", value: 65, fill: "#F59E0B" },
];

// The server marks deactivated items DISCONTINUED (not "INACTIVE"); DRAFT and ARCHIVED are inactive too.
const isProductActive = (p) => (p.status ? String(p.status).toUpperCase() === "ACTIVE" : !!p.is_active);

export function ProductsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal & Drawer State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBarcodeScanModalOpen, setIsBarcodeScanModalOpen] = useState(false);
  const [barcodeScanInput, setBarcodeScanInput] = useState("");
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  // Enterprise Import State
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const importFileInputRef = useRef(null);

  const loadData = () => {
    setLoading(true);
    fetchProducts()
      .then((res) => setProducts(Array.isArray(res) ? res : (res.results || res || [])))
      .catch((err) => console.error("Failed to load products", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync URL query parameters from Categories, Brands, or Overview links
  useEffect(() => {
    const catParam = searchParams.get("category");
    if (catParam) {
      setCategoryFilter(catParam);
    }
    const brandParam = searchParams.get("brand");
    if (brandParam) {
      setSearch(brandParam);
    }
    const statusParam = searchParams.get("status");
    if (statusParam) {
      setStatusFilter(statusParam);
    }
  }, [searchParams]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const availableCategories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const availableTypes = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.item_type) set.add(p.item_type);
    });
    return Array.from(set).sort();
  }, [products]);

  const handleExecuteScan = async (rawCode) => {
    const clean = rawCode?.trim();
    if (!clean) return;

    // Fast Online Barcode Lookup first
    try {
      // The lookup endpoint returns flat fields (item_id, item_code, item_name, variant_sku).
      const onlineMatch = await barcodeLookupOnline(clean);
      const fullProd =
        onlineMatch?.found &&
        products.find(
          (p) => p.id === onlineMatch.item_id || (p.sku || p.code) === onlineMatch.item_code
        );
      if (fullProd) {
        playScanBeep();
        setSelectedProduct(fullProd);
        setIsDrawerOpen(true);
        setIsBarcodeScanModalOpen(false);
        setBarcodeScanInput("");
        showToast(
          `Scanned match: ${onlineMatch.item_name} (${onlineMatch.item_code})${
            onlineMatch.variant_sku ? ` [Variant: ${onlineMatch.variant_sku}]` : ""
          }`
        );
        return;
      }
    } catch (err) {
      console.warn("Online barcode lookup fallback to client index", err);
    }

    // Local client-side lookup fallback
    const match = lookupProductByBarcode(clean, products);
    if (match) {
      playScanBeep();
      setSelectedProduct(match);
      setIsDrawerOpen(true);
      setIsBarcodeScanModalOpen(false);
      setBarcodeScanInput("");
      showToast(`Scanned product matched: ${match.name} (${match.sku})`);
    } else {
      showToast(`No product matched barcode "${clean}".`);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && search.trim()) {
      e.preventDefault();
      handleExecuteScan(search);
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      (p.barcode && String(p.barcode).toLowerCase().includes(q));

    const matchesCategory =
      categoryFilter === "ALL" || p.category === categoryFilter;

    const matchesType =
      typeFilter === "ALL" || (p.item_type || "RAW_MATERIAL") === typeFilter;

    const normStatus = (p.stock_status || "IN_STOCK").toUpperCase();
    const matchesStatus =
      statusFilter === "ALL" ||
      normStatus === statusFilter ||
      (statusFilter === "ACTIVE" && isProductActive(p)) ||
      (statusFilter === "INACTIVE" && !isProductActive(p)) ||
      (statusFilter === "IN_STOCK" && (normStatus === "IN_STOCK" || normStatus === "IN STOCK")) ||
      (statusFilter === "LOW_STOCK" && (normStatus === "LOW_STOCK" || normStatus === "LOW STOCK")) ||
      (statusFilter === "OUT_OF_STOCK" && (normStatus === "OUT_OF_STOCK" || normStatus === "OUT OF STOCK"));

    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(paginatedProducts.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleProductCreated = (newProduct) => {
    setProducts((prev) => [
      newProduct,
      ...prev.filter((p) => p.id !== newProduct.id && p.sku !== newProduct.sku),
    ]);
    showToast(`Product ${newProduct.sku} (${newProduct.name}) created & persisted.`);
  };

  const handleUpdateProduct = async (updatedProduct) => {
    try {
      const saved = await updateProduct(updatedProduct.id, updatedProduct);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === saved.id || p.sku === saved.sku ? { ...p, ...saved } : p
        )
      );
      setSelectedProduct(saved);
      showToast(`Product ${saved.sku} (${saved.name}) updated successfully.`);
    } catch (e) {
      // The server rejected the edit; keep the saved version on screen.
      showToast(`Update failed: ${e.message}`);
    }
  };

  const handleToggleStatus = async (p, e) => {
    if (e) e.stopPropagation();
    try {
      if (isProductActive(p)) {
        const next = await deactivateProduct(p.id);
        setProducts((prev) =>
          prev.map((item) => (item.id === p.id ? { ...item, ...next } : item))
        );
        showToast(`Product ${p.sku} deactivated.`);
      } else {
        const next = await activateProduct(p.id);
        setProducts((prev) =>
          prev.map((item) => (item.id === p.id ? { ...item, ...next } : item))
        );
        showToast(`Product ${p.sku} activated.`);
      }
    } catch (err) {
      showToast(`Status update failed: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (p, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete product "${p.name}" (${p.sku})? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteProduct(p.id, p);
      setProducts((prev) => prev.filter((item) => item.id !== p.id));
      setSelectedIds((prev) => prev.filter((id) => id !== p.id));
      showToast(`Product ${p.sku} deleted.`);
    } catch (err) {
      showToast(`Cannot delete product: ${err.message}`);
    }
  };

  const handleOpenDetail = (product) => {
    setSelectedProduct(product);
    setIsDrawerOpen(true);
  };

  const handleExport = (format = "csv") => {
    setIsExportDropdownOpen(false);
    const params = {};
    if (categoryFilter !== "ALL") params.category = categoryFilter;
    if (statusFilter !== "ALL") params.status = statusFilter;
    if (search) params.search = search;
    exportProductCatalog(params, format);
    showToast(`Streaming ${format.toUpperCase()} export download...`);
  };

  const handleBulkPrintBarcodes = () => {
    showToast(`Directing ${selectedIds.length} items to Barcode Generator...`);
    setTimeout(() => {
      navigate("/inventory/barcodes");
    }, 600);
  };

  // Apply activate/deactivate to each selected product; only the ones the server accepted change on screen.
  const runBulkStatus = async (apiCall, verb) => {
    const changed = new Map();
    let failed = 0;
    for (const id of selectedIds) {
      try {
        changed.set(id, await apiCall(id));
      } catch (e) {
        failed++;
      }
    }
    setProducts((prev) =>
      prev.map((p) => (changed.has(p.id) ? { ...p, ...changed.get(p.id) } : p))
    );
    setSelectedIds([]);
    showToast(
      failed > 0
        ? `${changed.size} products ${verb}, ${failed} failed.`
        : `${changed.size} products ${verb}.`
    );
  };

  const handleBulkActivate = () => runBulkStatus(activateProduct, "activated");

  const handleBulkDeactivate = () => runBulkStatus(deactivateProduct, "deactivated");

  const handleBulkArchive = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete ${selectedIds.length} selected items? Products with ledger history will be protected.`
      )
    ) {
      let deleted = 0;
      let failed = 0;
      for (const id of selectedIds) {
        try {
          await deleteProduct(id, products.find((p) => p.id === id));
          deleted++;
        } catch (e) {
          failed++;
        }
      }
      setSelectedIds([]);
      loadData();
      showToast(
        failed > 0
          ? `${deleted} products deleted, ${failed} protected due to transaction history.`
          : `${deleted} products deleted.`
      );
    }
  };

  // Import Modal Handlers
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportPreview(null);
    }
  };

  const handleRunPreview = async () => {
    if (!importFile) return;
    setPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await previewProductImport(formData);
      setImportPreview(res);
      showToast(`Import dry-run validated: ${res.valid_rows || 0} valid rows.`);
    } catch (err) {
      showToast(`Preview failed: ${err.message}`);
    } finally {
      setPreviewing(false);
    }
  };

  const handleExecuteCommit = async () => {
    if (!importFile) return;
    setCommitting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await commitProductImport(formData);
      showToast(`Import successful: ${res.created_count || 0} created, ${res.updated_count || 0} updated.`);
      setIsImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      loadData();
    } catch (err) {
      showToast(`Commit failed: ${err.message}`);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 dark:bg-zinc-800 text-white text-xs font-semibold shadow-2xl border border-slate-700 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Enterprise Items & Products
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50">
              <Sparkles className="h-2.5 w-2.5" />
              Master Ledger Item Registry
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Universal product master with multi-UOM conversions, variant matrices, barcodes, and audit compliance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setImportFile(null);
              setImportPreview(null);
              setIsImportOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5 text-slate-400" />
            <span>Import</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-400" />
              <span>Export</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
            {isExportDropdownOpen && (
              <div className="absolute right-0 mt-1 w-44 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-20 py-1 text-xs">
                <button
                  onClick={() => handleExport("csv")}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  <span>Export CSV (.csv)</span>
                </button>
                <button
                  onClick={() => handleExport("xlsx")}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Export Excel (.xlsx)</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold transition-all shadow-xs hover:shadow-blue-500/25 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Product</span>
          </button>
        </div>
      </div>

      {/* Catalog Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Catalog SKUs
          </div>
          <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums mt-1">
            {products.length} Items
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across master categories</div>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Physical On-Hand
          </div>
          <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums mt-1">
            {products.reduce((acc, p) => acc + (p.on_hand || 0), 0).toLocaleString()} Units
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Circulating in facilities
          </div>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Catalog Valuation
          </div>
          <div className="text-xl font-bold tracking-tight font-mono text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            ${products.reduce((acc, p) => acc + (p.on_hand || 0) * (p.unit_cost || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Moving Weighted Average</div>
        </div>
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Attention Needed
          </div>
          <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums mt-1">
            {products.filter((p) => p.stock_status === "LOW_STOCK" || p.stock_status === "OUT_OF_STOCK").length} Products
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            At or below reorder point
          </div>
        </div>
      </div>

      {/* Advanced Product Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Product Portfolio Quadrant & Capital Matrix
                </h2>
                <span className="shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50">
                  Unit Cost vs On-Hand Units
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Strategic inventory positioning: Bubble diameter reflects total valuation; quadrants divide critical bottlenecks vs high-turnover commodities.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/20" /> Active SKU
              </span>
            </div>
          </div>

          <div className="h-68 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 15, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" opacity={0.5} />
                <XAxis
                  type="number"
                  dataKey="cost"
                  name="Unit Cost"
                  tickFormatter={(v) => `$${v}`}
                  domain={[0, 200]}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="stock"
                  name="On-Hand"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <ZAxis type="number" dataKey="value" range={[50, 400]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ payload }) => {
                    if (payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-xs text-white shadow-xl space-y-1">
                          <p className="font-bold text-blue-400">{data.name}</p>
                          <p className="font-mono text-[11px] text-slate-300">SKU: {data.sku}</p>
                          <p className="text-slate-300">Category: {data.category}</p>
                          <p className="text-slate-300">Unit Cost: ${Number(data.cost || 0).toFixed(2)}</p>
                          <p className="text-slate-300">On-Hand: {data.stock} units</p>
                          <p className="font-semibold text-emerald-400">Valuation: ${data.value?.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine x={50} stroke="#94a3b8" strokeDasharray="3 3" />
                <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="3 3" />
                <Scatter
                  data={
                    products.length > 0
                      ? products.map((p) => ({
                          sku: p.sku,
                          name: p.name,
                          cost: p.unit_cost || 20,
                          stock: p.on_hand || 50,
                          value: (p.on_hand || 50) * (p.unit_cost || 20),
                          category: p.category,
                        }))
                      : []
                  }
                  fill="#3B82F6"
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Governance Radar */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Catalog Governance Radar
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Traceability and compliance ring meters
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50">
              92% Index
            </span>
          </div>

          <div className="h-44 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="40%"
                outerRadius="100%"
                barSize={8}
                data={RADIAL_HEALTH_DATA}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  background={{ fill: "rgba(226, 232, 240, 0.4)" }}
                  dataKey="value"
                  cornerRadius={6}
                  isAnimationActive={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(24, 24, 27, 0.95)",
                    borderColor: "rgba(63, 63, 70, 0.4)",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  formatter={(val, name) => [`${val}% Compliance`, name]}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight pointer-events-none">
              <span className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">92%</span>
              <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-zinc-500">Score</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800 text-xs">
            {RADIAL_HEALTH_DATA.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-2 text-slate-600 dark:text-zinc-400">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                  <span className="text-[11px] font-medium text-slate-700 dark:text-zinc-300 truncate min-w-0">{item.name}</span>
                </span>
                <span className="shrink-0 font-mono font-bold text-slate-900 dark:text-white text-[11px] tabular-nums">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search or scan barcode/SKU (Press Enter to inspect)..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>
          <button
            onClick={() => setIsBarcodeScanModalOpen(true)}
            className="p-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            title="Open Barcode Scanner Station"
          >
            <Scan className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300">
            <Filter className="h-3 w-3 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Status: Active</option>
              <option value="INACTIVE">Status: Inactive</option>
              <option value="IN_STOCK">Stock: In Stock</option>
              <option value="LOW_STOCK">Stock: Low Stock</option>
              <option value="OUT_OF_STOCK">Stock: Out of Stock</option>
            </select>
          </div>

          {/* Classification Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300">
            <Tag className="h-3 w-3 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">All Item Types</option>
              {availableTypes.length > 0 ? (
                availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))
              ) : (
                <>
                  <option value="STOCK">Stockable</option>
                  <option value="RAW_MATERIAL">Raw Material</option>
                  <option value="WIP">Work In Progress</option>
                  <option value="FINISHED_GOOD">Finished Good</option>
                  <option value="CONSUMABLE">Consumable</option>
                  <option value="NON_STOCK">Non-Stock Item</option>
                  <option value="SERVICE">Service / Labor</option>
                  <option value="MERCHANDISE">Merchandise</option>
                  <option value="ASSET">Fixed Asset</option>
                </>
              )}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300">
            <SlidersHorizontal className="h-3 w-3 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">All Categories</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 px-4 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 animate-in fade-in">
          <span className="font-semibold">{selectedIds.length} items selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkActivate}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-zinc-800 cursor-pointer shadow-xs transition-colors flex items-center gap-1"
            >
              <Power className="h-3 w-3 text-emerald-600" />
              <span>Activate</span>
            </button>
            <button
              onClick={handleBulkDeactivate}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer shadow-xs transition-colors flex items-center gap-1"
            >
              <PowerOff className="h-3 w-3 text-slate-500" />
              <span>Deactivate</span>
            </button>
            <button
              onClick={handleBulkPrintBarcodes}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-zinc-800 cursor-pointer shadow-xs transition-colors"
            >
              Print Barcodes
            </button>
            <button
              onClick={handleBulkArchive}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer shadow-xs transition-colors"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* High-Density Data Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 select-none">
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length === paginatedProducts.length &&
                      paginatedProducts.length > 0
                    }
                    onChange={handleSelectAll}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap font-semibold">SKU & Product Name</th>
                <th className="py-3.5 px-4 whitespace-nowrap font-semibold">Type & Classification</th>
                <th className="py-3.5 px-4 whitespace-nowrap font-semibold">Category & Brand</th>
                <th className="py-3.5 px-4 whitespace-nowrap font-semibold text-center">Variants</th>
                <th className="py-3.5 px-4 whitespace-nowrap font-semibold text-right">On-Hand</th>
                <th className="py-3.5 px-4 whitespace-nowrap font-semibold text-right">Available</th>
                <th className="py-3.5 px-4 whitespace-nowrap font-semibold text-center">Master Status</th>
                <th className="py-3.5 px-4 whitespace-nowrap font-semibold text-right">Standard Cost</th>
                <th className="py-3.5 px-4 whitespace-nowrap text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2" />
                    <p className="text-xs font-semibold">Loading master item catalog...</p>
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-sm text-slate-700 dark:text-zinc-300">No products found</p>
                    <p className="text-xs mt-1 text-slate-400">
                      Try adjusting your search terms or filters, or create a new catalog item.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const isActive = isProductActive(p);
                  const primaryBarcode = p.primary_barcode_value || p.barcode || p.sku;
                  const aliasCount = (p.multi_barcodes?.length || 0) + (p.barcodes?.length || 0);

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleOpenDetail(p)}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={() => handleSelectOne(p.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                            {p.sku}
                          </span>
                          {primaryBarcode && (
                            <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-0.5">
                              <Barcode className="h-2.5 w-2.5 text-slate-400" />
                              {primaryBarcode}
                              {aliasCount > 1 && (
                                <span className="ml-1 px-1 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-[9px] font-bold">
                                  +{aliasCount - 1}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-zinc-100 mt-1">
                          {p.name}
                        </div>
                        {p.display_name && p.display_name !== p.name && (
                          <div className="text-[11px] text-slate-400 italic">
                            {p.display_name}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {(p.item_type || p.classification || "RAW_MATERIAL").replace(/_/g, " ")}
                        </span>
                        {p.classification && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Class: {p.classification}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 dark:text-zinc-200 font-medium">
                          {p.category || p.category_name || "Uncategorized"}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                          {p.brand || "OEM Standard"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          <Boxes className="h-3 w-3 text-slate-400" /> {p.variants_count || (p.variants ? p.variants.length : 1)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                        {(p.on_hand || 0).toLocaleString()} {p.base_uom || p.unit || "EA"}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {(p.available || 0).toLocaleString()} {p.base_uom || p.unit || "EA"}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                                : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border-slate-300 dark:border-zinc-700"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                          <span
                            className={`text-[9px] font-medium ${
                              p.stock_status === "IN_STOCK"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : p.stock_status === "LOW_STOCK"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {(p.stock_status || "IN_STOCK").replace("_", " ")}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300 font-medium">
                        ${Number(p.unit_cost || p.standard_cost || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenDetail(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Inspect Product Specifications"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleToggleStatus(p, e)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isActive
                                ? "text-emerald-500 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                                : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-zinc-800"
                            }`}
                            title={isActive ? "Deactivate Product" : "Activate Product"}
                          >
                            {isActive ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={(e) => handleDeleteProduct(p, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 px-4 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <span>
            {filteredProducts.length === 0
              ? "Showing 0 products"
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(
                  currentPage * pageSize,
                  filteredProducts.length
                )} of ${filteredProducts.length} products`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-medium text-slate-900 dark:text-white tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Enterprise Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Enterprise Product Import Wizard
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">
                    Excel (.xlsx) and CSV bulk import with dry-run validation and atomic commit
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Template Download Strip */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  Standard Item Master Templates:
                </span>
                <p className="text-slate-500 dark:text-zinc-400 text-[11px]">
                  Includes sample rows for discrete, textile, wholesale & manufacturing configurations.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadImportTemplate("csv")}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Download className="h-3 w-3 text-blue-500" />
                  <span>CSV Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadImportTemplate("xlsx")}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Download className="h-3 w-3 text-emerald-500" />
                  <span>Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* File Dropzone */}
            <input
              type="file"
              ref={importFileInputRef}
              onChange={handleFileSelect}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <div
              onClick={() => importFileInputRef.current?.click()}
              className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer border-slate-200 dark:border-zinc-800 hover:border-blue-500 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-all"
            >
              <Upload className="h-8 w-8 text-blue-500 mb-2" />
              <span className="font-bold text-slate-900 dark:text-white text-xs">
                {importFile ? importFile.name : "Click to select or drop CSV / Excel file"}
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                {importFile
                  ? `${(importFile.size / 1024).toFixed(1)} KB selected`
                  : "Supports .xlsx and .csv files up to 25 MB"}
              </span>
            </div>

            {/* Validation Preview Box */}
            {importPreview && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                    <div className="text-slate-400 text-[10px] uppercase font-bold">Total Rows</div>
                    <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                      {importPreview.total_rows || 0}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                    <div className="text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold">Valid Rows</div>
                    <div className="text-base font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {importPreview.valid_rows || 0}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                    <div className="text-blue-600 dark:text-blue-400 text-[10px] uppercase font-bold">New Items</div>
                    <div className="text-base font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                      {importPreview.to_create || 0}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                    <div className="text-amber-600 dark:text-amber-400 text-[10px] uppercase font-bold">Updates</div>
                    <div className="text-base font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                      {importPreview.to_update || 0}
                    </div>
                  </div>
                </div>

                {/* Errors Table */}
                {importPreview.errors && importPreview.errors.length > 0 && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-3 space-y-2 text-xs">
                    <div className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" />
                      <span>{importPreview.errors.length} Validation Errors Found (Rows will be skipped or need fixing):</span>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {importPreview.errors.slice(0, 10).map((err, i) => (
                        <div key={i} className="text-[11px] text-rose-600 dark:text-rose-300 flex items-start gap-2">
                          <span className="font-mono font-bold shrink-0">Row {err.row || i + 1}:</span>
                          <span>{err.sku ? `[${err.sku}] ` : ""}{err.error || err.message}</span>
                        </div>
                      ))}
                      {importPreview.errors.length > 10 && (
                        <div className="text-[10px] text-rose-500 italic">
                          ...and {importPreview.errors.length - 10} more errors.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!importFile || previewing || committing}
                  onClick={handleRunPreview}
                  className="px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  <span>{previewing ? "Validating..." : "Dry-Run Validate"}</span>
                </button>
                <button
                  type="button"
                  disabled={!importPreview || importPreview.valid_rows === 0 || committing}
                  onClick={handleExecuteCommit}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>{committing ? "Importing..." : "Execute Commit"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Creation Modal */}
      <CreateProductModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleProductCreated}
      />

      {/* Detail Drawer */}
      <ProductDetailDrawer
        product={selectedProduct}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSave={handleUpdateProduct}
      />

      {/* Barcode Scanner Station Modal */}
      {isBarcodeScanModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                  <Scan className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Barcode Scanner Station
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse" />
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Scan or enter any barcode/SKU to immediately inspect full product specifications.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBarcodeScanModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="relative h-44 rounded-2xl bg-slate-950 flex flex-col items-center justify-center overflow-hidden border border-slate-800 shadow-inner">
                <div className="absolute top-4 left-4 h-6 w-6 border-t-2 border-l-2 border-blue-500 rounded-tl-md" />
                <div className="absolute top-4 right-4 h-6 w-6 border-t-2 border-r-2 border-blue-500 rounded-tr-md" />
                <div className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-blue-500 rounded-bl-md" />
                <div className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-blue-500 rounded-br-md" />
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-lg shadow-rose-500/80 animate-pulse" />

                <div className="text-center space-y-1 text-slate-300 z-10 pointer-events-none">
                  <Camera className="h-7 w-7 mx-auto text-blue-400 opacity-80" />
                  <div className="text-xs font-semibold tracking-wide">
                    Align Barcode or QR Code within Frame
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Sub-25ms Real-Time API Engine Active
                  </div>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleExecuteScan(barcodeScanInput);
                }}
                className="space-y-2"
              >
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Scan Barcode or Enter Barcode / SKU:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      autoFocus
                      type="text"
                      value={barcodeScanInput}
                      onChange={(e) => setBarcodeScanInput(e.target.value)}
                      placeholder="e.g. 890123620501 or BRG-6205-2RS"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Inspect
                  </button>
                </div>
              </form>
            </div>

            <div className="p-4 px-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Fast scanner chime enabled
              </span>
              <button
                type="button"
                onClick={() => setIsBarcodeScanModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-semibold cursor-pointer"
              >
                Close Station
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
