import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  playScanBeep,
  lookupProductByBarcode,
} from "../services/api";
import { CreateProductModal } from "../components/CreateProductModal.jsx";
import { ProductDetailDrawer } from "../components/ProductDetailDrawer.jsx";

const RADIAL_HEALTH_DATA = [
  { name: "In-Stock Availability", value: 94, fill: "#10B981" },
  { name: "Reorder Compliance", value: 88, fill: "#3B82F6" },
  { name: "Batch Traceability", value: 78, fill: "#8B5CF6" },
  { name: "Serialized Registry", value: 65, fill: "#F59E0B" },
];

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
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
  const [importText, setImportText] = useState("");
  const [isBarcodeScanModalOpen, setIsBarcodeScanModalOpen] = useState(false);
  const [barcodeScanInput, setBarcodeScanInput] = useState("");

  useEffect(() => {
    fetchProducts().then((res) => setProducts(res.results || []));
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExecuteScan = (rawCode) => {
    const clean = rawCode?.trim();
    if (!clean) return;
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
      (p.barcode && String(p.barcode).toLowerCase().includes(q));
    const matchesCategory =
      categoryFilter === "ALL" || p.category === categoryFilter;
    const matchesStatus =
      statusFilter === "ALL" || p.stock_status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
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
      setProducts((prev) =>
        prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
      );
      setSelectedProduct(updatedProduct);
      showToast(`Product ${updatedProduct.sku} (${updatedProduct.name}) updated.`);
    }
  };

  const handleOpenDetail = (product) => {
    setSelectedProduct(product);
    setIsDrawerOpen(true);
  };

  const handleExportCSV = () => {
    const headers = [
      "SKU",
      "Product Name",
      "Category",
      "Brand",
      "Base Unit",
      "On Hand",
      "Reserved",
      "Available",
      "Stock Status",
      "Unit Cost ($)",
    ];
    const rows = filteredProducts.map((p) => [
      `"${p.sku}"`,
      `"${p.name}"`,
      `"${p.category || ""}"`,
      `"${p.brand || ""}"`,
      p.unit || "EA",
      p.on_hand ?? 0,
      p.reserved ?? 0,
      p.available ?? 0,
      p.stock_status || "IN_STOCK",
      (p.unit_cost || 0).toFixed(2),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Products_Catalog_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Product catalog exported as CSV.");
  };

  const handleBulkPrintBarcodes = () => {
    showToast(`Directing ${selectedIds.length} items to Barcode Generator...`);
    setTimeout(() => {
      navigate("/inventory/barcodes");
    }, 600);
  };

  const handleBulkUpdateReorder = () => {
    showToast(`Directing ${selectedIds.length} items to Replenishment Matrix...`);
    setTimeout(() => {
      navigate("/inventory/planning/replenishment");
    }, 600);
  };

  const handleBulkArchive = () => {
    if (
      window.confirm(
        `Are you sure you want to archive ${selectedIds.length} selected items?`
      )
    ) {
      setProducts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      setSelectedIds([]);
      showToast(`${selectedIds.length} products archived.`);
    }
  };

  const handleImportSubmit = (e) => {
    e.preventDefault();
    if (!importText.trim()) return;

    const lines = importText.split("\n").filter((l) => l.trim().length > 0);
    const imported = lines.map((line, idx) => {
      const parts = line.split(",").map((s) => s.trim());
      return {
        id: `prod-imp-${Date.now()}-${idx}`,
        sku: parts[0] || `SKU-IMP-${idx}`,
        name: parts[1] || `Imported Item ${idx + 1}`,
        category: parts[2] || "Mechanical Components",
        brand: parts[3] || "OEM Standard",
        unit: parts[4] || "EA",
        variants_count: 1,
        on_hand: parseInt(parts[5] || "100", 10),
        reserved: 0,
        available: parseInt(parts[5] || "100", 10),
        stock_status: "IN_STOCK",
        unit_cost: parseFloat(parts[6] || "25.00"),
      };
    });

    setProducts((prev) => [...imported, ...prev]);
    setIsImportOpen(false);
    setImportText("");
    showToast(`${imported.length} products imported into catalog.`);
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
              Products & Catalog
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60">
              <Sparkles className="h-2.5 w-2.5" />
              Master Ledger Item Registry
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Manage stock items, variant matrices, barcodes, UOM conversions & reorder parameters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5 text-slate-400" />
            <span>Import</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
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

      {/* High-Configuration Advanced Product Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: Product Portfolio Matrix (ScatterChart with Quadrant Reference Lines & Bubble Sizing) */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Product Portfolio Quadrant & Capital Matrix
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60">
                  Unit Cost vs On-Hand Units
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Strategic inventory positioning: Bubble diameter reflects total valuation; quadrants divide critical bottlenecks vs high-turnover commodities.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/20" /> Active SKU
              </span>
              <span className="text-slate-400 text-[11px]">
                Median: $50 / 100 Units
              </span>
            </div>
          </div>

          <div className="h-68 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 15, right: 20, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" opacity={0.5} />
                <XAxis
                  type="number"
                  dataKey="cost"
                  name="Unit Cost"
                  unit="$"
                  domain={[0, 200]}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="stock"
                  name="On-Hand"
                  unit=" EA"
                  domain={[0, 1300]}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <ZAxis type="number" dataKey="value" range={[60, 450]} name="Valuation" unit="$" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: "#94a3b8" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-slate-900/95 dark:bg-zinc-800/95 text-white text-xs border border-slate-700 shadow-2xl backdrop-blur-md space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono font-bold text-blue-400">{data.sku}</span>
                            <span className="text-[10px] text-slate-400">{data.category}</span>
                          </div>
                          <div className="font-semibold text-slate-200">{data.name}</div>
                          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-700/80 text-[11px] font-mono">
                            <div>Unit Cost: <strong className="text-emerald-400">${data.cost.toFixed(2)}</strong></div>
                            <div>Stock: <strong className="text-blue-400">{data.stock} units</strong></div>
                            <div className="col-span-2">Total Capital: <strong className="text-white">${data.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine x={50} stroke="#94a3b8" strokeDasharray="3 3" opacity={0.6} label={{ value: "Median Price $50", position: "insideTopRight", fill: "#94a3b8", fontSize: 9 }} />
                <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="3 3" opacity={0.6} label={{ value: "Safety Floor 100 EA", position: "insideBottomLeft", fill: "#94a3b8", fontSize: 9 }} />
                <Scatter
                  name="Products"
                  data={
                    products.length > 0
                      ? products.map((p) => ({
                          sku: p.sku || p.code,
                          name: p.name,
                          cost: Number(p.unit_cost || 10),
                          stock: Number(p.on_hand ?? p.available ?? 40),
                          value: Number((p.on_hand ?? 40) * (p.unit_cost || 10)),
                          category: p.category || "General",
                        }))
                      : [
                          { sku: "BRG-6205", name: "Ball Bearing", cost: 14.85, stock: 450, value: 6682.5, category: "Mechanical" },
                          { sku: "HYD-SV-24V", name: "Solenoid Valve", cost: 128.5, stock: 18, value: 2313, category: "Hydraulics" },
                          { sku: "BELT-T10", name: "Timing Belt", cost: 32.4, stock: 280, value: 9072, category: "Power Trans" },
                          { sku: "LUB-SYN", name: "Synthetic Oil", cost: 18.2, stock: 1200, value: 21840, category: "Fluids" },
                          { sku: "ENC-1024", name: "Encoder", cost: 185, stock: 10, value: 1850, category: "Automation" },
                        ]
                  }
                  fill="#3B82F6"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Multi-Ring Catalog Health & Compliance Radar (RadialBarChart) */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Catalog Governance Radar
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Traceability and compliance ring meters
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60">
              92% Index
            </span>
          </div>

          <div className="h-44 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="25%"
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
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">92%</span>
              <span className="text-[9px] uppercase font-bold text-slate-400">Score</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800 text-xs">
            {RADIAL_HEALTH_DATA.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                  <span className="text-[11px] font-medium text-slate-700 dark:text-zinc-300 truncate">{item.name}</span>
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px] tabular-nums">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Search & Barcode Scan Trigger */}
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
            type="button"
            onClick={() => {
              setIsBarcodeScanModalOpen(true);
              setBarcodeScanInput("");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-semibold cursor-pointer transition-colors shadow-xs shrink-0"
            title="Scan Barcode with Optical Camera or USB Reader"
          >
            <Scan className="h-3.5 w-3.5" />
            <span>Scan Barcode</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
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
              <option value="ALL">All Stock Statuses</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>

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
              <option value="Mechanical Components">Mechanical Components</option>
              <option value="Hydraulics & Pneumatics">Hydraulics & Pneumatics</option>
              <option value="Power Transmission">Power Transmission</option>
              <option value="Sensors & Automation">Sensors & Automation</option>
              <option value="Chemicals & Fluids">Chemicals & Fluids</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (When selected) */}
      {selectedIds.length > 0 && (
        <div className="p-3 px-4 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 animate-in fade-in">
          <span className="font-semibold">{selectedIds.length} items selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkPrintBarcodes}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-zinc-800 cursor-pointer shadow-xs transition-colors"
            >
              Print Barcodes
            </button>
            <button
              onClick={handleBulkUpdateReorder}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-zinc-800 cursor-pointer shadow-xs transition-colors"
            >
              Update Reorder Rules
            </button>
            <button
              onClick={handleBulkArchive}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer shadow-xs transition-colors"
            >
              Archive Selected
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
                <th className="py-3.5 px-4 font-semibold">SKU & Item Name</th>
                <th className="py-3.5 px-4 font-semibold">Category & Brand</th>
                <th className="py-3.5 px-4 font-semibold text-center">Variants</th>
                <th className="py-3.5 px-4 font-semibold text-right">On-Hand</th>
                <th className="py-3.5 px-4 font-semibold text-right">Reserved</th>
                <th className="py-3.5 px-4 font-semibold text-right">Available</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Unit WAV</th>
                <th className="py-3.5 px-4 text-center w-12">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {paginatedProducts.map((p) => (
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                        {p.sku}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-zinc-100 mt-1">
                      {p.name}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="text-slate-800 dark:text-zinc-200 font-medium">
                      {p.category}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                      {p.brand}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      <Boxes className="h-3 w-3 text-slate-400" /> {p.variants_count || 1}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                    {(p.on_hand || 0).toLocaleString()} {p.unit}
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium tabular-nums text-purple-600 dark:text-purple-400">
                    {p.reserved > 0 ? `${p.reserved.toLocaleString()} ${p.unit}` : "-"}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {(p.available || 0).toLocaleString()} {p.unit}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        p.stock_status === "IN_STOCK"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                          : p.stock_status === "LOW_STOCK"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        p.stock_status === "IN_STOCK" ? "bg-emerald-500" : p.stock_status === "LOW_STOCK" ? "bg-amber-500" : "bg-rose-500"
                      }`} />
                      {(p.stock_status || "IN_STOCK").replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300 font-medium">
                    ${(p.unit_cost || 0).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenDetail(p)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Inspect Product Specifications"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 px-4 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, filteredProducts.length)} of{" "}
            {filteredProducts.length} products
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

      {/* Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Import Products CSV
                </h3>
              </div>
              <button
                onClick={() => setIsImportOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Paste CSV Lines (Format: SKU, Name, Category, Brand, Unit, Initial Qty, Cost)
                </label>
                <textarea
                  rows={5}
                  required
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="BRG-8801, Roller Bearing 8801, Mechanical Components, SKF, EA, 50, 18.50&#10;VALVE-SOL-12V, Solenoid Valve 12V, Hydraulics, Bosch, EA, 20, 85.00"
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono text-[11px]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Import Products
                </button>
              </div>
            </form>
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
            {/* Header */}
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

            {/* Viewfinder Graphic */}
            <div className="p-6 space-y-4">
              <div className="relative h-44 rounded-2xl bg-slate-950 flex flex-col items-center justify-center overflow-hidden border border-slate-800 shadow-inner">
                {/* Viewfinder Corners */}
                <div className="absolute top-4 left-4 h-6 w-6 border-t-2 border-l-2 border-blue-500 rounded-tl-md" />
                <div className="absolute top-4 right-4 h-6 w-6 border-t-2 border-r-2 border-blue-500 rounded-tr-md" />
                <div className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-blue-500 rounded-bl-md" />
                <div className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-blue-500 rounded-br-md" />

                {/* Animated Red Laser Scanning Beam */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-lg shadow-rose-500/80 animate-pulse" />

                {/* Center Content */}
                <div className="text-center space-y-1 text-slate-300 z-10 pointer-events-none">
                  <Camera className="h-7 w-7 mx-auto text-blue-400 opacity-80" />
                  <div className="text-xs font-semibold tracking-wide">
                    Align Barcode or QR Code within Frame
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Ready for Handheld Scanner or Rapid Keyboard Input
                  </div>
                </div>
              </div>

              {/* Fast Barcode Input Form */}
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

              {/* Quick Barcode Test Deck */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-blue-500" /> Quick-Test Catalog Barcodes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { code: "890123620501", label: "Ball Bearing (890123620501)" },
                    { code: "890123240012", label: "Hydraulic Valve (890123240012)" },
                    { code: "890123120034", label: "Timing Belt (890123120034)" },
                    { code: "890123102498", label: "Encoder (890123102498)" },
                    { code: "890123460077", label: "Lubricant (890123460077)" },
                  ].map((pill) => (
                    <button
                      key={pill.code}
                      type="button"
                      onClick={() => handleExecuteScan(pill.code)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 dark:bg-zinc-800 dark:hover:bg-blue-950/60 text-slate-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-300 font-mono text-[10px] font-semibold border border-slate-200/80 dark:border-zinc-700 transition-colors cursor-pointer"
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 px-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Audio scan chime enabled
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
