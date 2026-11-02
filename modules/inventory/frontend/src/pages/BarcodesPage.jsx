import React, { useState, useEffect, useRef } from "react";
import {
  Barcode,
  Search,
  Printer,
  Download,
  Eye,
  QrCode,
  CheckCircle2,
  Copy,
  Scan,
  Sparkles,
  Zap,
  Activity,
  ShieldCheck,
  Radio,
  Sliders,
  Check,
  Camera,
  ExternalLink,
  Layers,
  Boxes,
  Package,
  MapPin,
  DollarSign,
  AlertCircle,
  X,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  PieChart,
  Pie,
} from "recharts";
import { DEMO_PRODUCTS, fetchProducts, playScanBeep, lookupProductByBarcode } from "../services/api";

const symbologyData = [
  {
    symbology: "GS1-128",
    cleanPass: 12150,
    retry: 210,
    reject: 40,
    total: 12400,
    rate: "98.0%",
    latency: "18ms",
    usage: "Shipping Pallets & Cartons",
  },
  {
    symbology: "EAN-13",
    cleanPass: 17850,
    retry: 290,
    reject: 60,
    total: 18200,
    rate: "98.1%",
    latency: "14ms",
    usage: "Retail & Individual Items",
  },
  {
    symbology: "QR Code 2D",
    cleanPass: 8520,
    retry: 70,
    reject: 10,
    total: 8600,
    rate: "99.1%",
    latency: "22ms",
    usage: "Asset Tags & Mobile Inspections",
  },
  {
    symbology: "DataMatrix",
    cleanPass: 4120,
    retry: 65,
    reject: 15,
    total: 4200,
    rate: "98.1%",
    latency: "28ms",
    usage: "Precision High-Density Parts",
  },
  {
    symbology: "UHF RFID",
    cleanPass: 24320,
    retry: 140,
    reject: 40,
    total: 24500,
    rate: "99.3%",
    latency: "8ms",
    usage: "Dock Portals & Autonomous Scan",
  },
  {
    symbology: "ITF-14",
    cleanPass: 3020,
    retry: 60,
    reject: 20,
    total: 3100,
    rate: "97.4%",
    latency: "32ms",
    usage: "Corrugated Master Outer Packs",
  },
];

const ansiGradeData = [
  { name: "Grade A (4.0)", label: "Grade A (Optimal)", value: 84.2, fill: "#10b981", desc: "Flawless modulation & edge contrast" },
  { name: "Grade B (3.0)", label: "Grade B (Good)", value: 11.5, fill: "#3b82f6", desc: "Minor optical reflectance variance" },
  { name: "Grade C (2.0)", label: "Grade C (Pass)", value: 3.6, fill: "#f59e0b", desc: "Acceptable contrast threshold" },
  { name: "Grade D/F (<2)", label: "Grade D/F (Fail)", value: 0.7, fill: "#f43f5e", desc: "Thermal ribbon void or burn-in" },
];

export function BarcodesPage() {
  const [products, setProducts] = useState(DEMO_PRODUCTS);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(DEMO_PRODUCTS[0]);
  const [scanResult, setScanResult] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Scanner Station & Product Details Modal States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const [scannerMode, setScannerMode] = useState("USB"); // "USB" or "OPTICAL"
  const scannerInputRef = useRef(null);

  useEffect(() => {
    fetchProducts().then((res) => {
      const list = res.results || res || [];
      if (list.length > 0) {
        setProducts(list);
        setSelectedProduct(list[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (isScannerOpen && scannerInputRef.current) {
      setTimeout(() => scannerInputRef.current?.focus(), 150);
    }
  }, [isScannerOpen]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      (p.barcode && String(p.barcode).toLowerCase().includes(q))
    );
  });

  // Universal Barcode Decode Handler
  const handleExecuteScan = (barcodeQuery, openDetailsModal = false) => {
    const clean = barcodeQuery?.trim();
    if (!clean) return;

    const match = lookupProductByBarcode(clean, products);
    if (match) {
      playScanBeep();
      setSelectedProduct(match);
      setScanResult({ found: true, barcode: clean, product: match });
      showToast(`Scanned: ${match.name} (${match.sku})`);
      if (openDetailsModal) {
        setIsDetailModalOpen(true);
      }
    } else {
      setScanResult({ found: false, barcode: clean });
      showToast(`No product matching barcode "${clean}".`);
    }
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setScanResult(null);

    // Auto-match if exact barcode or SKU is pasted or typed
    const match = lookupProductByBarcode(value, products);
    if (match && value.trim().length >= 6) {
      setSelectedProduct(match);
      setScanResult({ found: true, barcode: value.trim(), product: match });
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleExecuteScan(search, true);
    }
  };

  const handleScannerSubmit = (e) => {
    e.preventDefault();
    handleExecuteScan(scannerInput, true);
    setScannerInput("");
  };

  const handleTestPillClick = (testBarcode) => {
    setScannerInput(testBarcode);
    handleExecuteScan(testBarcode, true);
  };

  const handlePrint = (barcode) => {
    showToast(`Sending thermal print job for barcode ${barcode || selectedProduct?.sku}...`);
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const handleCopy = (barcode) => {
    if (!barcode) return;
    navigator.clipboard.writeText(barcode);
    showToast(`Barcode ${barcode} copied to clipboard.`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-semibold shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Barcode & RFID Tag Registry
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
              GS1 & EPC Gen2 Standard
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Thermal label printing, optical barcode scanning, real-time product verification & ANSI print grade diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Scan className="h-4 w-4" />
            <span>Interactive Barcode Scanner</span>
          </button>
          <button
            onClick={() => handlePrint(selectedProduct?.barcode)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
            <span>Print Thermal Label</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Daily Optical Scans</span>
            <Scan className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            71,000 Scans
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active Across 6 Symbologies
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">First-Pass Read Rate</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            98.6%
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            +0.6% vs 98.0% SLA target
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Avg Decode Latency</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            18.4 ms
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
            UHF RFID fastest (8ms)
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">ANSI Verification Grade</span>
            <Sparkles className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            3.84 / 4.0
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            Grade A Certified (95.7% A/B)
          </div>
        </div>
      </div>

      {/* High-Configuration Unique Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Symbology First-Pass Scan Reliability (Stacked BarChart) */}
        <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Symbology First-Pass Scan Reliability
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                  Stacked Optical Volume
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                First-Pass Clean Scans vs Optical Retries vs Damaged Tag Rejects across formats.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Clean Pass
              </span>
              <span className="flex items-center gap-1 text-amber-500 font-medium text-[11px]">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Retry
              </span>
              <span className="flex items-center gap-1 text-rose-500 font-medium text-[11px]">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Reject
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={symbologyData}
                margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="symbology"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-700/60 pb-1">
                          <span className="font-bold text-slate-100">{d.symbology}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {d.rate} First-Pass
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] pt-0.5">
                          <div>
                            <span className="text-slate-400 text-[10px]">Clean 1st Pass:</span>
                            <div className="font-mono font-bold text-emerald-400">
                              {d.cleanPass.toLocaleString()} Scans
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Decode Latency:</span>
                            <div className="font-mono font-bold text-blue-400">{d.latency}</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Retries:</span>
                            <div className="font-mono font-bold text-amber-300">{d.retry} Scans</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Rejects:</span>
                            <div className="font-mono font-bold text-rose-300">{d.reject} Scans</div>
                          </div>
                          <div className="col-span-2 pt-1 text-[10px] text-slate-300 border-t border-slate-800">
                            Usage: <span className="text-zinc-200">{d.usage}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="cleanPass"
                  stackId="a"
                  fill="#10b981"
                  isAnimationActive={true}
                />
                <Bar
                  dataKey="retry"
                  stackId="a"
                  fill="#f59e0b"
                  isAnimationActive={true}
                />
                <Bar
                  dataKey="reject"
                  stackId="a"
                  fill="#f43f5e"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={true}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Thermal Print ANSI Verification Grade Quality (Donut with Center Badge) */}
        <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  ANSI Print Grade Distribution
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40">
                  ISO/IEC 15416
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Optical edge modulation, contrast profile & barcode print quality grading.
              </p>
            </div>
          </div>

          {/* Donut with Central Score */}
          <div className="relative h-[160px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ansiGradeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  isAnimationActive={true}
                >
                  {ansiGradeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3 py-2 text-white shadow-2xl text-xs space-y-1">
                        <div className="font-bold text-slate-100 flex items-center justify-between gap-3">
                          <span>{d.label}</span>
                          <span className="font-mono text-emerald-400 font-bold">{d.value}%</span>
                        </div>
                        <div className="text-[10px] text-slate-300">{d.desc}</div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Score Badge */}
            <div className="absolute text-center pointer-events-none">
              <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                3.84
              </span>
              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold block uppercase tracking-wider">
                Grade A
              </span>
            </div>
          </div>

          {/* Verification Telemetry Grid */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800/80 mt-2 text-xs">
            {ansiGradeData.map((d, i) => (
              <div
                key={i}
                className="p-2 rounded-xl border border-slate-100 dark:border-zinc-800/60 bg-slate-50/60 dark:bg-zinc-800/40 flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                  <span className="text-[10px] text-slate-600 dark:text-zinc-300 truncate">{d.name}</span>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                  {d.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Product Barcode Table */}
        <div className="lg:col-span-2 space-y-3">
          <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Scan barcode (Enter to decode) or search SKU, name, brand..."
                  className="w-full pl-8 pr-20 py-2 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleExecuteScan(search, true)}
                  className="absolute right-1.5 top-1.5 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Decode
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                title="Open Camera / Handheld Barcode Scanner"
              >
                <Scan className="h-4 w-4" />
              </button>
            </div>

            {/* Live Scan Result Banner */}
            {scanResult && (
              <div
                role="status"
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-150 ${
                  scanResult.found
                    ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {scanResult.found ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  <span>
                    {scanResult.found
                      ? `Barcode identified: ${scanResult.product?.name} (${scanResult.product?.sku})`
                      : `No catalog product matches barcode "${scanResult.barcode}".`}
                  </span>
                </div>
                {scanResult.found && (
                  <button
                    onClick={() => setIsDetailModalOpen(true)}
                    className="font-bold underline cursor-pointer text-emerald-700 dark:text-emerald-300 hover:opacity-80"
                  >
                    View Details →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Barcode Products Table */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="py-3.5 px-4 font-semibold">SKU / Code</th>
                    <th className="py-3.5 px-4 font-semibold">Product Name</th>
                    <th className="py-3.5 px-4 font-semibold">Barcode</th>
                    <th className="py-3.5 px-4 font-semibold">Symbology</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Available Stock</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No catalog items match your search. Try another barcode or SKU.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => (
                      <tr
                        key={item.id || item.sku}
                        onClick={() => setSelectedProduct(item)}
                        className={`cursor-pointer transition-colors ${
                          selectedProduct?.sku === item.sku
                            ? "bg-blue-50/70 dark:bg-blue-950/40"
                            : "hover:bg-slate-50/60 dark:hover:bg-zinc-800/40"
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {item.sku || item.code}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 dark:text-zinc-300 font-semibold">
                          {item.barcode || "—"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700">
                            EAN-13
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                          {item.available ?? item.on_hand ?? 0} {item.unit || item.base_unit || "EA"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(item);
                              setIsDetailModalOpen(true);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold text-[11px] cursor-pointer inline-flex items-center gap-0.5"
                          >
                            Details <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Printable Label Simulation Panel */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                <Barcode className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Physical Label Preview
              </h2>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                Thermal 4x2 in
              </span>
            </div>

            {/* Simulated Industrial Label */}
            <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-zinc-700 bg-white text-slate-900 space-y-3 font-sans shadow-inner">
              <div className="flex items-start justify-between border-b border-slate-200 pb-2">
                <div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    INVENTORY TAG
                  </div>
                  <div className="text-xs font-bold leading-tight">{selectedProduct?.name}</div>
                  <div className="font-mono text-[10px] font-semibold text-blue-700 mt-0.5">
                    SKU: {selectedProduct?.sku || selectedProduct?.code}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center border border-slate-300 rounded p-1">
                  <QrCode className="h-full w-full text-slate-900" />
                </div>
              </div>

              {/* Barcode graphic lines simulation */}
              <div className="text-center py-2 space-y-1">
                <div className="flex items-center justify-center gap-[2px] h-14 w-full px-2 overflow-hidden bg-slate-50 p-1 rounded">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-slate-900 h-full"
                      style={{
                        width: i % 3 === 0 ? "3px" : i % 5 === 0 ? "1px" : "2px",
                        marginRight: i % 4 === 0 ? "2px" : "1px",
                      }}
                    />
                  ))}
                </div>
                <div className="font-mono text-xs tracking-widest font-bold tabular-nums">
                  {selectedProduct?.barcode || "No barcode assigned"}
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-200">
                <span>Facility: WH-MAIN</span>
                <span>UOM: {selectedProduct?.base_unit || selectedProduct?.unit || "EA"}</span>
                <span className="font-bold text-emerald-700">Verified: OK</span>
              </div>
            </div>

            {/* Product Details Card */}
            {selectedProduct && (
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3 bg-slate-50/50 dark:bg-zinc-800/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Boxes className="h-3.5 w-3.5 text-blue-500" />
                    Product Specifications
                  </h3>
                  <button
                    onClick={() => setIsDetailModalOpen(true)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                  >
                    Expand Modal ↗
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                  <div>
                    <dt className="text-slate-400 text-[10px]">Item Code</dt>
                    <dd className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {selectedProduct.sku || selectedProduct.code}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 text-[10px]">Category</dt>
                    <dd className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                      {selectedProduct.category_name || selectedProduct.category || "General Components"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 text-[10px]">Brand / OEM</dt>
                    <dd className="font-medium text-slate-800 dark:text-zinc-200">
                      {selectedProduct.brand || "Standard OEM"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 text-[10px]">Stock Available</dt>
                    <dd className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedProduct.available ?? selectedProduct.on_hand ?? 0} {selectedProduct.unit || "EA"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 text-[10px]">Unit Cost</dt>
                    <dd className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                      ${Number(selectedProduct.unit_cost || 14.85).toFixed(2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 text-[10px]">Tracking Mode</dt>
                    <dd className="font-semibold text-slate-700 dark:text-zinc-300">
                      {selectedProduct.tracking || "NONE"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handlePrint(selectedProduct?.barcode)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs shadow-blue-500/25 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Thermal Label</span>
              </button>
              <button
                onClick={() => handleCopy(selectedProduct?.barcode)}
                className="p-2.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Copy Barcode String"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* INTERACTIVE BARCODE SCANNER MODAL */}
      {/* --------------------------------------------------------------------- */}
      {isScannerOpen && (
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
                    Interactive Barcode Scanner Station
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse" />
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Supports Optical Camera, Handheld USB Scanners & Keyboard Emulation.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Viewfinder Graphic */}
            <div className="p-6 space-y-4">
              <div className="relative h-44 rounded-2xl bg-slate-950 flex flex-col items-center justify-center overflow-hidden border border-slate-800 shadow-inner">
                {/* Viewfinder Target Corners */}
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
              <form onSubmit={handleScannerSubmit} className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Scan Barcode or Enter Barcode String:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      ref={scannerInputRef}
                      type="text"
                      value={scannerInput}
                      onChange={(e) => setScannerInput(e.target.value)}
                      placeholder="e.g. 890123620501 or BRG-6205-2RS"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Decode
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
                      onClick={() => handleTestPillClick(pill.code)}
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
                <Check className="h-3.5 w-3.5 text-emerald-500" /> Audio scan chime enabled
              </span>
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-semibold cursor-pointer"
              >
                Close Station
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* EXPANDED SCANNED PRODUCT DETAILS MODAL */}
      {/* --------------------------------------------------------------------- */}
      {isDetailModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-start justify-between bg-slate-50/50 dark:bg-zinc-900/50">
              <div className="flex items-start gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      {selectedProduct.sku || selectedProduct.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        (selectedProduct.available ?? 1) > 0
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {(selectedProduct.available ?? 1) > 0 ? "IN STOCK" : "OUT OF STOCK"}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedProduct.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {selectedProduct.brand || "Preferred OEM"} • {selectedProduct.category_name || selectedProduct.category || "General Inventory"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 text-xs">
              {/* Barcode & Identity Strip */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-800/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Registered Barcode</span>
                  <div className="font-mono text-base font-bold text-slate-900 dark:text-white tracking-widest mt-0.5">
                    {selectedProduct.barcode || "No Barcode Assigned"}
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="h-3 w-3" /> GS1 Verified / EAN-13 Symbology
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedProduct.barcode)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 text-slate-700 dark:text-zinc-200 font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </button>
              </div>

              {/* Stock Telemetry 4-Pack */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                  <span className="text-[10px] text-slate-400 font-medium">Available</span>
                  <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {selectedProduct.available ?? 0} {selectedProduct.unit || "EA"}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                  <span className="text-[10px] text-slate-400 font-medium">Total On Hand</span>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                    {selectedProduct.on_hand ?? selectedProduct.available ?? 0} {selectedProduct.unit || "EA"}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                  <span className="text-[10px] text-slate-400 font-medium">Reserved Hold</span>
                  <div className="text-base font-bold font-mono text-amber-500 tabular-nums">
                    {selectedProduct.reserved ?? 0} {selectedProduct.unit || "EA"}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                  <span className="text-[10px] text-slate-400 font-medium">Unit Cost</span>
                  <div className="text-base font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
                    ${Number(selectedProduct.unit_cost || 14.85).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Storage & Logistics Metadata */}
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3 bg-white dark:bg-zinc-900">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <MapPin className="h-3.5 w-3.5 text-blue-500" /> Facility Storage & Tracking Logistics
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px]">Fulfillment Facility:</span>
                    <div className="font-semibold text-slate-800 dark:text-zinc-200">
                      Main Central Fulfillment Hub (WH-MAIN)
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Bin Location:</span>
                    <div className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
                      Aisle 3 - Rack B (Bin 04)
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Tracking Mode:</span>
                    <div className="font-semibold text-slate-800 dark:text-zinc-200">
                      {selectedProduct.tracking === "SERIAL"
                        ? "Individual Serialized Registry"
                        : selectedProduct.tracking === "BATCH"
                        ? "Lot & Expiry Tracked"
                        : "Aggregate Stock"}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Reorder Threshold:</span>
                    <div className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
                      Min {selectedProduct.reorder_point ?? 50} {selectedProduct.unit || "EA"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 px-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrint(selectedProduct.barcode)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Thermal Label</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
