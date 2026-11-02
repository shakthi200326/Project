import React, { useState, useEffect } from "react";
import {
  Tag,
  Plus,
  Search,
  Globe,
  CheckCircle2,
  Package,
  ArrowUpRight,
  ShieldCheck,
  Award,
  Clock,
  TrendingUp,
  Percent,
  DollarSign,
  Building2,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import { fetchBrands, DEMO_BRANDS } from "../services/api";

const brandSlaData = [
  {
    brand: "SKF Precision",
    shortName: "SKF",
    otif: 98.4,
    quality: 99.6,
    leadTimeDays: 3.8,
    defectPpm: 12,
    iso: "ISO 9001:2015",
  },
  {
    brand: "Bosch Rexroth",
    shortName: "Bosch",
    otif: 96.2,
    quality: 98.8,
    leadTimeDays: 5.2,
    defectPpm: 24,
    iso: "IATF 16949",
  },
  {
    brand: "Gates PowerGrip",
    shortName: "Gates",
    otif: 97.5,
    quality: 99.1,
    leadTimeDays: 4.1,
    defectPpm: 18,
    iso: "ISO 14001",
  },
  {
    brand: "Omron Industrial",
    shortName: "Omron",
    otif: 99.2,
    quality: 99.9,
    leadTimeDays: 2.9,
    defectPpm: 6,
    iso: "ISO 13485",
  },
  {
    brand: "Mobil Rarus",
    shortName: "Mobil",
    otif: 93.8,
    quality: 97.4,
    leadTimeDays: 6.8,
    defectPpm: 45,
    iso: "ISO 9001",
  },
  {
    brand: "Parker Hannifin",
    shortName: "Parker",
    otif: 96.8,
    quality: 98.5,
    leadTimeDays: 4.6,
    defectPpm: 21,
    iso: "AS9100D",
  },
];

const brandCapitalData = [
  {
    brand: "Bosch Rexroth",
    shortName: "Bosch",
    capitalValue: 198.5,
    warrantyUnits: 340,
    country: "Germany",
    riskTier: "Low Risk",
  },
  {
    brand: "SKF Precision",
    shortName: "SKF",
    capitalValue: 164.2,
    warrantyUnits: 280,
    country: "Sweden",
    riskTier: "Prime",
  },
  {
    brand: "Omron Industrial",
    shortName: "Omron",
    capitalValue: 142.8,
    warrantyUnits: 250,
    country: "Japan",
    riskTier: "Prime",
  },
  {
    brand: "Gates PowerGrip",
    shortName: "Gates",
    capitalValue: 88.4,
    warrantyUnits: 180,
    country: "USA",
    riskTier: "Low Risk",
  },
  {
    brand: "Parker Hannifin",
    shortName: "Parker",
    capitalValue: 74.5,
    warrantyUnits: 155,
    country: "USA",
    riskTier: "Low Risk",
  },
  {
    brand: "Mobil Rarus",
    shortName: "Mobil",
    capitalValue: 46.2,
    warrantyUnits: 120,
    country: "USA",
    riskTier: "Standard",
  },
];

export function BrandsPage() {
  const [brands, setBrands] = useState(DEMO_BRANDS);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [newBrand, setNewBrand] = useState({ name: "", code: "", country: "" });

  useEffect(() => {
    fetchBrands().then((res) => {
      const list = res.results || res || [];
      if (list.length > 0) {
        setBrands(list);
      }
    });
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredBrands = brands.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.code.toLowerCase().includes(search.toLowerCase()) ||
      (b.country && b.country.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newBrand.name || !newBrand.code) return;
    const createdItem = {
      id: `br-${Date.now()}`,
      name: newBrand.name,
      code: newBrand.code.toUpperCase(),
      country: newBrand.country || "Global",
      skus_count: 0,
      is_active: true,
    };
    setBrands((prev) => [createdItem, ...prev]);
    showToast(`Brand OEM "${newBrand.name}" registered successfully.`);
    setNewBrand({ name: "", code: "", country: "" });
    setIsModalOpen(false);
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
              Brands, OEMs & Manufacturers
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
              Certified OEM Registry
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Registered equipment manufacturers, warranty authorizations, supplier lead-time reliability & capital concentration.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Brand</span>
        </button>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Registered OEMs</span>
            <Building2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {brands.length || 6} Manufacturers
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            100% Certified Active
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Certified SKUs</span>
            <Package className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            324 Products
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Across 5 global origins
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">OEM Capital Value</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            $714.6k USD
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
            Bosch leading ($198.5k)
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Composite OTIF SLA</span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            96.9%
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            +1.9% above 95% SLA target
          </div>
        </div>
      </div>

      {/* High-Configuration Unique Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: OEM Fulfillment SLA & Quality Assurance Index (LineChart) */}
        <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  OEM Fulfillment SLA & Quality Assurance Index
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                  Spline Trajectory
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                On-Time In-Full Delivery (OTIF %) vs First-Pass Quality Acceptance % with 95.0% contract threshold.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> OTIF %
              </span>
              <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium text-[11px]">
                <span className="h-2 w-2 rounded-full bg-indigo-500" /> Quality %
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={brandSlaData}
                margin={{ top: 10, right: 25, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="shortName"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                />
                <YAxis
                  domain={[90, 100]}
                  tickFormatter={(v) => `${v}%`}
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-700/60 pb-1">
                          <span className="font-bold text-slate-100">{d.brand}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {d.iso}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] pt-0.5">
                          <div>
                            <span className="text-slate-400 text-[10px]">OTIF Delivery:</span>
                            <div className="font-mono font-bold text-emerald-400">{d.otif}%</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Quality Yield:</span>
                            <div className="font-mono font-bold text-indigo-300">{d.quality}%</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Avg Lead Time:</span>
                            <div className="font-mono font-bold text-amber-300">{d.leadTimeDays} Days</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Defect PPM:</span>
                            <div className="font-mono font-bold text-rose-300">{d.defectPpm} PPM</div>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={95}
                  stroke="#3b82f6"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "SLA Target 95%",
                    fill: "#3b82f6",
                    fontSize: 10,
                    position: "insideTopLeft",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="otif"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#ffffff" }}
                  activeDot={{ r: 6, fill: "#10b981", strokeWidth: 2, stroke: "#ffffff" }}
                  isAnimationActive={true}
                />
                <Line
                  type="monotone"
                  dataKey="quality"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "#ffffff" }}
                  activeDot={{ r: 6, fill: "#6366f1", strokeWidth: 2, stroke: "#ffffff" }}
                  isAnimationActive={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Brand Capital Valuation & Warranty Coverage (Grouped BarChart) */}
        <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Brand Capital & Warranty Density
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                  Grouped Benchmark
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Capital Valuation ($k USD) vs Registered Warranty Units (EA).
              </p>
            </div>
            <div className="flex items-center gap-2.5 text-xs">
              <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-medium text-[11px]">
                <span className="h-2 w-2 rounded-full bg-cyan-500" /> Capital ($k)
              </span>
              <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium text-[11px]">
                <span className="h-2 w-2 rounded-full bg-purple-500" /> Warranty (EA)
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={brandCapitalData}
                margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="shortName"
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
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 text-white shadow-2xl text-xs space-y-1">
                        <div className="font-bold text-slate-200 flex items-center justify-between gap-3">
                          <span>{d.brand}</span>
                          <span className="text-[10px] text-slate-400">{d.country}</span>
                        </div>
                        <div className="text-cyan-400 font-mono font-bold text-sm">
                          ${d.capitalValue}k <span className="text-xs font-normal text-slate-400">Capital Value</span>
                        </div>
                        <div className="text-purple-300 font-mono text-xs">
                          {d.warrantyUnits} Units Under Warranty
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="capitalValue"
                  fill="#06b6d4"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={true}
                />
                <Bar
                  dataKey="warrantyUnits"
                  fill="#8b5cf6"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={true}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands by OEM name, code or country of origin..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-400 dark:text-zinc-500 tabular-nums font-mono">
          {filteredBrands.length} registered OEMs
        </span>
      </div>

      {/* Brands Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBrands.map((b, idx) => (
          <div
            key={b.id || idx}
            className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs hover:shadow-md hover:border-blue-400/60 dark:hover:border-blue-700/60 transition-all flex flex-col justify-between space-y-3.5 group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-tr from-slate-100 to-slate-200 dark:from-zinc-800 dark:to-zinc-700 text-slate-800 dark:text-zinc-200 font-bold font-mono text-sm tracking-wider border border-slate-200/60 dark:border-zinc-700 group-hover:scale-105 transition-transform">
                  {b.code.slice(0, 3)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{b.name}</h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                    <Globe className="h-3 w-3" />
                    <span>{b.country || "Global"}</span>
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                ACTIVE
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800/80 text-xs">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                <Package className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-bold text-slate-800 dark:text-zinc-200 tabular-nums">
                  {b.skus_count ?? (idx % 2 === 0 ? 34 : 28)}
                </span> SKUs in catalog
              </span>
              <a
                href="/products"
                className="text-blue-600 dark:text-blue-400 font-bold hover:underline text-[11px] flex items-center gap-0.5"
              >
                View Items <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Register Brand Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="h-4 w-4 text-blue-600" />
                Register Brand OEM
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Brand / Manufacturer Name *
                </label>
                <input
                  type="text"
                  required
                  value={newBrand.name}
                  onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })}
                  placeholder="e.g. Parker Hannifin"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Brand Code *
                </label>
                <input
                  type="text"
                  required
                  value={newBrand.code}
                  onChange={(e) => setNewBrand({ ...newBrand, code: e.target.value })}
                  placeholder="e.g. PRK"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Country of Origin
                </label>
                <input
                  type="text"
                  value={newBrand.country}
                  onChange={(e) => setNewBrand({ ...newBrand, country: e.target.value })}
                  placeholder="e.g. United States"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-xs shadow-blue-500/25 transition-all"
                >
                  Save Brand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
