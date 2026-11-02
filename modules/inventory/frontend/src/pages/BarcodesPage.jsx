import React, { useState, useEffect } from "react";
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
import { DEMO_PRODUCTS, fetchProducts } from "../services/api";

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
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    fetchProducts().then((res) => {
      const list = res.results || res || [];
      if (list.length > 0) {
        setProducts(list);
        setSelectedProduct(list[0]);
      }
    });
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filtered = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search))
  );

  const handlePrint = (barcode) => {
    showToast(`Sending thermal print job for barcode ${barcode}...`);
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
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-medium shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2">
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
            Thermal label printing, GS1 symbology validation, optical scanner throughput & ANSI verification telemetry.
          </p>
        </div>

        <button
          onClick={() => handlePrint(selectedProduct?.barcode)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          <span>Print Selected Labels</span>
        </button>
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
          <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by SKU, item name or barcode number..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs text-slate-400 dark:text-zinc-500 tabular-nums font-mono">
              {filtered.length} products
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="py-3.5 px-4 font-semibold">SKU</th>
                    <th className="py-3.5 px-4 font-semibold">Item Name</th>
                    <th className="py-3.5 px-4 font-semibold">Barcode</th>
                    <th className="py-3.5 px-4 font-semibold">Format</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedProduct(item)}
                      className={`cursor-pointer transition-colors ${
                        selectedProduct?.id === item.id
                          ? "bg-blue-50/70 dark:bg-blue-950/40"
                          : "hover:bg-slate-50/60 dark:hover:bg-zinc-800/40"
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {item.sku}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {item.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                        {item.barcode || "890123620501"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700">
                          EAN-13
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(item);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold text-[11px] cursor-pointer"
                        >
                          Preview Label →
                        </button>
                      </td>
                    </tr>
                  ))}
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
                    ONE ERP INVENTORY TAG
                  </div>
                  <div className="text-xs font-bold leading-tight">{selectedProduct?.name}</div>
                  <div className="font-mono text-[10px] font-semibold text-blue-700 mt-0.5">
                    SKU: {selectedProduct?.sku}
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
                  {selectedProduct?.barcode || "890123620501"}
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-200">
                <span>Facility: WH-MAIN</span>
                <span>UOM: {selectedProduct?.base_unit || "EA"}</span>
                <span className="font-bold text-emerald-700">Verified: OK</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => handlePrint(selectedProduct?.barcode)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs shadow-blue-500/25 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Label</span>
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
    </div>
  );
}
