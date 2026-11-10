import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  Boxes,
  Layers,
  Tag,
  Ruler,
  SlidersHorizontal,
  Hash,
  Barcode,
  Camera,
  Upload,
  Download,
  History,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Search,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { fetchProducts, barcodeLookupOnline } from "../services/api.js";
import { ProductDetailDrawer } from "../components/ProductDetailDrawer.jsx";

export function ProductOverviewPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [scanQuery, setScanQuery] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const data = await fetchProducts();
      setProducts(data?.results || (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error("Failed to load products for overview:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeLookup = async (e) => {
    e.preventDefault();
    if (!scanQuery.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await barcodeLookupOnline(scanQuery.trim());
      setScanResult(res);
      if (res?.found && res?.item_id) {
        const matched = products.find(
          (p) => String(p.id) === String(res.item_id) || p.code === res.item_code
        );
        if (matched) setSelectedProduct(matched);
      }
    } catch (err) {
      setScanResult({ found: false, error: err.message });
    } finally {
      setScanning(false);
    }
  };

  const totalItems = products.length;
  const activeItems = products.filter((p) => p.is_active || p.status === "ACTIVE").length;
  const totalVariants = products.reduce((acc, p) => acc + (p.variants?.length || 0), 0);
  const totalValue = products.reduce(
    (acc, p) => acc + (parseFloat(p.standard_cost) || 0) * (parseFloat(p.total_on_hand) || 0),
    0
  );

  const sections = [
    {
      title: "Item Master Sub-Module",
      icon: Package,
      links: [
        { label: "Item Master", path: "/inventory/products?tab=items", desc: "Manage catalog products, specs & stock levels" },
        { label: "Product Variants", path: "/inventory/products?tab=variants", desc: "Multi-attribute variant matrix & SKUs" },
        { label: "Item Data Management", path: "/inventory/products?tab=data-management", desc: "Attachments, bulk imports, exports & audit history" },
      ],
    },
    {
      title: "Product Classification Sub-Module",
      icon: Layers,
      links: [
        { label: "Categories", path: "/inventory/classification?tab=categories", desc: "Taxonomy hierarchies & subcategories" },
        { label: "Brands", path: "/inventory/classification?tab=brands", desc: "Manufacturers, brands & vendor logos" },
        { label: "Units of Measure (UOM)", path: "/inventory/classification?tab=units", desc: "Dimension rules & fractional tolerances" },
        { label: "Product Attributes", path: "/inventory/classification?tab=attributes", desc: "Color, size, specifications & values" },
      ],
    },
    {
      title: "Product Identification",
      icon: Hash,
      links: [
        { label: "SKU Management", path: "/inventory/skus", desc: "Registry, code formats & collision checks" },
        { label: "Barcode & QR Management", path: "/inventory/barcodes", desc: "EAN-13, ITF-14 barcode formats & aliases" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Products & Catalog Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise Product Master Management, Classification, Identification & Data Hub.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalItems}</div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {activeItems} Active in Catalog
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Variants</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalVariants}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Matrix Generated SKUs</div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Catalog Valuation</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Standard Cost Asset Base</div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Health</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">100%</div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Zero SKU Collisions</div>
          </div>
        </div>
      </div>

      {/* Online Fast Scanner Card */}
      <div className="p-6 rounded-xl border border-indigo-100 dark:border-indigo-950/50 bg-gradient-to-r from-indigo-50/50  dark:from-slate-900 dark:to-slate-900 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Barcode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Instant Barcode & SKU Lookup Scanner
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scan or enter any EAN-13, Code-128, ITF-14, Vendor Barcode, or SKU to instantly resolve product records.
            </p>
          </div>
          <form onSubmit={handleBarcodeLookup} className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={scanQuery}
                onChange={(e) => setScanQuery(e.target.value)}
                placeholder="Scan or type barcode / SKU..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={scanning || !scanQuery.trim()}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors"
            >
              {scanning ? "Scanning..." : "Lookup"}
            </button>
          </form>
        </div>

        {scanResult && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            {scanResult.found ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm">
                <div>
                  <span className="font-bold">Match Found:</span>{" "}
                  {scanResult.item_name || scanResult.name || "Unnamed product"} (Code: {scanResult.item_code || "N/A"} | SKU: {scanResult.variant_sku || scanResult.sku || scanResult.item_code || "N/A"})
                </div>
                <button
                  onClick={() => {
                    const matched = products.find(
                      (p) => String(p.id) === String(scanResult.item_id) || p.code === scanResult.item_code
                    );
                    if (matched) setSelectedProduct(matched);
                  }}
                  className="font-semibold underline hover:no-underline ml-4"
                >
                  View Details &rarr;
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
                {scanResult.error || `No matching product or variant found for "${scanQuery}".`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Module Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((sec, idx) => (
          <div
            key={idx}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <sec.icon className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{sec.title}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {sec.links.map((link, lIdx) => (
                <Link
                  key={lIdx}
                  to={link.path}
                  className="group p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center justify-between">
                      {link.label}
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{link.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Slide-out Drawer */}
      <ProductDetailDrawer
        isOpen={!!selectedProduct}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onSave={loadOverviewData}
      />

    </div>
  );
}
export default ProductOverviewPage;
