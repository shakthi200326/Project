import React, { useState, useEffect } from "react";
import {
  Ruler,
  Plus,
  Search,
  CheckCircle2,
  ArrowRightLeft,
  Scale,
  Layers,
  Box,
  Truck,
  Sparkles,
  ShieldCheck,
  Percent,
  TrendingUp,
  Hash,
  Activity,
  Calculator,
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
import { fetchUnits, DEMO_UNITS } from "../services/api";

const conversionLadderData = [
  {
    code: "EA",
    name: "Individual Unit",
    factor: 1,
    ratio: "1 : 1",
    tier: "Base Reference",
    handling: "Manual Pick",
    fill: "#3b82f6",
  },
  {
    code: "BOX",
    name: "Dispenser Box",
    factor: 10,
    ratio: "1 : 10",
    tier: "Inner Multipack",
    handling: "Carton Flow",
    fill: "#6366f1",
  },
  {
    code: "CASE",
    name: "Master Case",
    factor: 24,
    ratio: "1 : 24",
    tier: "Intermediate Pack",
    handling: "Tote Staged",
    fill: "#8b5cf6",
  },
  {
    code: "PAL",
    name: "Warehouse Pallet",
    factor: 100,
    ratio: "1 : 100",
    tier: "Logistics Pallet",
    handling: "Forklift Required",
    fill: "#10b981",
  },
  {
    code: "SKID",
    name: "Industrial Freight Skid",
    factor: 500,
    ratio: "1 : 500",
    tier: "Heavy Freight",
    handling: "Dock Leveler Staging",
    fill: "#f59e0b",
  },
];

const precisionGaugeData = [
  { name: "Precision Invariant", value: 99.98, fill: "#10b981" },
  { name: "Rounding Tolerance", value: 0.02, fill: "#334155" },
];

const dimensionDistributionData = [
  { name: "Discrete Count (EA/BOX/PAL)", share: "68.4%", color: "bg-blue-500", text: "text-blue-500" },
  { name: "Mass & Weight (KG)", share: "18.2%", color: "bg-indigo-500", text: "text-indigo-500" },
  { name: "Fluid Volume (LTR)", share: "8.6%", color: "bg-purple-500", text: "text-purple-500" },
  { name: "Linear Distance (MTR)", share: "4.8%", color: "bg-amber-500", text: "text-amber-500" },
];

export function UnitsPage() {
  const [units, setUnits] = useState(DEMO_UNITS);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [newUnit, setNewUnit] = useState({
    code: "",
    name: "",
    symbol: "",
    decimal_places: 0,
    is_base: true,
    conversion_factor: 1,
    base_unit: "EA",
  });

  useEffect(() => {
    fetchUnits().then((res) => {
      const list = res.results || res || [];
      if (list.length > 0) {
        setUnits(list);
      }
    });
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredUnits = units.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newUnit.code || !newUnit.name) return;
    const created = {
      id: `uom-${Date.now()}`,
      code: newUnit.code.toUpperCase(),
      name: newUnit.name,
      symbol: newUnit.symbol || newUnit.code.toLowerCase(),
      decimal_places: Number(newUnit.decimal_places) || 0,
      is_base: newUnit.is_base,
      conversion_factor: newUnit.is_base ? 1 : Number(newUnit.conversion_factor) || 1,
      base_unit: newUnit.is_base ? null : newUnit.base_unit,
    };
    setUnits((prev) => [...prev, created]);
    showToast(`Unit of measure ${created.code} (${created.name}) created successfully.`);
    setIsModalOpen(false);
    setNewUnit({
      code: "",
      name: "",
      symbol: "",
      decimal_places: 0,
      is_base: true,
      conversion_factor: 1,
      base_unit: "EA",
    });
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
              Units of Measure (UOM) & Conversion Formulas
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
              ISO Dimensional Standard
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Standard inventory counting units, packaging pack multipliers, conversion ratios, and precision decimal scaling.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Unit</span>
        </button>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Configured Units</span>
            <Ruler className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {units.length} Metrics
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active ISO Standard
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Primary Base Units</span>
            <Scale className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {units.filter((u) => u.is_base).length} Dimensions
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            EA, KG, LTR, MTR standards
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Pack Multipliers</span>
            <Box className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {units.filter((u) => !u.is_base).length} Packaging Tiers
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
            Ratios up to 1:500 EA
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Conversion Precision</span>
            <Calculator className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            99.98%
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            0 rounding truncation error
          </div>
        </div>
      </div>

      {/* High-Configuration Unique Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Packaging Multipack & Conversion Hierarchy Ladder */}
        <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Packaging Multipack & Conversion Hierarchy Ladder
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40">
                  Multiplier Cascade
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Conversion factor scaling relative to 1.0 Base Reference Unit (EA).
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">1:500 Max</span>
              <span className="text-[10px] text-slate-400 block">Freight Ratio</span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={conversionLadderData}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="code"
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
                  tickFormatter={(v) => `${v}x`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-700/60 pb-1">
                          <span className="font-bold text-slate-100">{d.name} ({d.code})</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {d.ratio}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] pt-0.5">
                          <div>
                            <span className="text-slate-400 text-[10px]">Multiplier:</span>
                            <div className="font-mono font-bold text-emerald-400">{d.factor}x Base EA</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Packaging Tier:</span>
                            <div className="font-mono font-bold text-indigo-300">{d.tier}</div>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-400 text-[10px]">Logistics Handling:</span>
                            <div className="font-medium text-amber-300">{d.handling}</div>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="factor"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={true}
                >
                  {conversionLadderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: 180° Conversion Precision Arc Speedometer & Dimension Share */}
        <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Conversion Precision & Dimensional Share
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                  180° Arc Gauge
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Mathematical rounding invariant meter with physical dimension distribution.
              </p>
            </div>
          </div>

          {/* 180° Semi-Circular Gauge */}
          <div className="relative h-[150px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={precisionGaugeData}
                  cx="50%"
                  cy="92%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  isAnimationActive={true}
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#334155" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center Speedometer Metric */}
            <div className="absolute bottom-2 text-center pointer-events-none">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
                99.98%
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block uppercase tracking-wider">
                Precision Invariant
              </span>
            </div>
          </div>

          {/* Physical Dimension Share Telemetry */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800/80 mt-2">
            {dimensionDistributionData.map((d, i) => (
              <div
                key={i}
                className="p-2 rounded-xl border border-slate-100 dark:border-zinc-800/60 bg-slate-50/60 dark:bg-zinc-800/40"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${d.color}`} />
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">{d.name}</span>
                </div>
                <div className="font-mono font-bold text-xs text-slate-900 dark:text-white mt-1">
                  {d.share}
                </div>
              </div>
            ))}
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
            placeholder="Search units of measure by code, name or symbol..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-400 dark:text-zinc-500 tabular-nums font-mono">
          {filteredUnits.length} configured standards
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">Unit Code</th>
                <th className="py-3.5 px-4 font-semibold">Unit Name</th>
                <th className="py-3.5 px-4 font-semibold">Symbol</th>
                <th className="py-3.5 px-4 font-semibold">Type</th>
                <th className="py-3.5 px-4 font-semibold">Conversion Ratio</th>
                <th className="py-3.5 px-4 font-semibold text-right">Precision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredUnits.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                      {u.code}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {u.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-zinc-300 font-medium">
                    {u.symbol}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        u.is_base
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                          : "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${u.is_base ? "bg-emerald-500" : "bg-purple-500"}`} />
                      {u.is_base ? "Base Standard" : "Secondary Pack"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300 font-mono tabular-nums">
                    {u.is_base ? (
                      <span className="text-slate-400">1.0000 (Universal Reference)</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                        <ArrowRightLeft className="h-3 w-3" /> 1 {u.code} = {Number(u.conversion_factor)} {u.base_unit_code || u.base_unit || "EA"}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500">
                    {u.decimal_places} decimal places
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Ruler className="h-4 w-4 text-blue-600" />
                Define Unit of Measure
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
                  UOM Code *
                </label>
                <input
                  type="text"
                  required
                  value={newUnit.code}
                  onChange={(e) => setNewUnit({ ...newUnit, code: e.target.value })}
                  placeholder="e.g. PACK"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white uppercase font-mono focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newUnit.name}
                  onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
                  placeholder="e.g. Pack of 25 Units"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Symbol
                  </label>
                  <input
                    type="text"
                    value={newUnit.symbol}
                    onChange={(e) => setNewUnit({ ...newUnit, symbol: e.target.value })}
                    placeholder="pk"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Decimals Precision
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={newUnit.decimal_places}
                    onChange={(e) => setNewUnit({ ...newUnit, decimal_places: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white tabular-nums focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
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
                  Save Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
