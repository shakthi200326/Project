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
} from "lucide-react";
import { fetchProducts } from "../services/api";
import { CreateProductModal } from "../components/CreateProductModal.jsx";
import { ProductDetailDrawer } from "../components/ProductDetailDrawer.jsx";

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

  useEffect(() => {
    fetchProducts().then((res) => setProducts(res.results || []));
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase());
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
    setProducts((prev) => [newProduct, ...prev]);
    showToast(`Product ${newProduct.name} created successfully.`);
  };

  const handleUpdateProduct = (updatedProduct) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    setSelectedProduct(updatedProduct);
    showToast(`Product ${updatedProduct.sku} (${updatedProduct.name}) updated successfully.`);
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
      navigate("/barcodes");
    }, 600);
  };

  const handleBulkUpdateReorder = () => {
    showToast(`Directing ${selectedIds.length} items to Replenishment Matrix...`);
    setTimeout(() => {
      navigate("/replenishment");
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
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 dark:bg-zinc-800 text-white text-xs font-medium shadow-xl border border-slate-700 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Products & Catalog
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Manage stock items, variant matrices, barcodes, UOM conversions & reorder parameters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Product</span>
          </button>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by SKU, product name, brand or barcode..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300">
            <Filter className="h-3 w-3 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Stock Statuses</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300">
            <SlidersHorizontal className="h-3 w-3 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent focus:outline-none cursor-pointer"
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
        <div className="p-2.5 px-4 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 animate-in fade-in">
          <span className="font-semibold">{selectedIds.length} items selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkPrintBarcodes}
              className="px-2.5 py-1 rounded bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 text-xs font-medium hover:bg-blue-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Print Barcodes
            </button>
            <button
              onClick={handleBulkUpdateReorder}
              className="px-2.5 py-1 rounded bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 text-xs font-medium hover:bg-blue-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Update Reorder Rules
            </button>
            <button
              onClick={handleBulkArchive}
              className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 cursor-pointer"
            >
              Archive Selected
            </button>
          </div>
        </div>
      )}

      {/* High-Density Data Table */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/40 text-slate-500 dark:text-zinc-400 select-none">
                <th className="py-3 px-4 w-10">
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
                <th className="py-3 px-4 font-semibold">SKU & Item Name</th>
                <th className="py-3 px-4 font-semibold">Category & Brand</th>
                <th className="py-3 px-4 font-semibold text-center">Variants</th>
                <th className="py-3 px-4 font-semibold text-right">On-Hand</th>
                <th className="py-3 px-4 font-semibold text-right">Reserved</th>
                <th className="py-3 px-4 font-semibold text-right">Available</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Unit WAV</th>
                <th className="py-3 px-4 text-center w-12">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {paginatedProducts.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => handleOpenDetail(p)}
                  className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => handleSelectOne(p.id)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      {p.sku}
                    </div>
                    <div className="font-medium text-slate-900 dark:text-zinc-100">
                      {p.name}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-800 dark:text-zinc-200 font-medium">
                      {p.category}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                      {p.brand}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      <Boxes className="h-3 w-3 text-slate-400" /> {p.variants_count || 1}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium tabular-nums text-slate-900 dark:text-zinc-100">
                    {(p.on_hand || 0).toLocaleString()} {p.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-medium tabular-nums text-purple-600 dark:text-purple-400">
                    {p.reserved > 0 ? `${p.reserved.toLocaleString()} ${p.unit}` : "-"}
                  </td>
                  <td className="py-3 px-4 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {(p.available || 0).toLocaleString()} {p.unit}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.stock_status === "IN_STOCK"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : p.stock_status === "LOW_STOCK"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                      }`}
                    >
                      {p.stock_status === "IN_STOCK" && <CheckCircle className="h-3 w-3" />}
                      {p.stock_status === "LOW_STOCK" && <AlertCircle className="h-3 w-3" />}
                      {p.stock_status === "OUT_OF_STOCK" && <XCircle className="h-3 w-3" />}
                      {(p.stock_status || "IN_STOCK").replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                    ${(p.unit_cost || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenDetail(p)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                      title="Inspect Product"
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
    </div>
  );
}
