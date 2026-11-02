import React, { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Search,
  FolderTree,
  Tag,
  CheckCircle2,
  ChevronRight,
  Hash,
  TrendingUp,
  Percent,
  DollarSign,
  Boxes,
  PieChart as PieIcon,
  Sparkles,
  ArrowUpRight,
  Target,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  Treemap,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { fetchCategories, createCategory } from "../services/api";

const categoryTreemapData = [
  {
    name: "Sensors & Automation",
    code: "CAT-SENS",
    size: 184500,
    skus: 84,
    margin: "46.5%",
    velocity: "9.2x",
    fill: "#3b82f6",
    health: "Optimal",
  },
  {
    name: "Mechanical Components",
    code: "CAT-MECH",
    size: 162300,
    skus: 126,
    margin: "34.2%",
    velocity: "8.4x",
    fill: "#6366f1",
    health: "Healthy",
  },
  {
    name: "Hydraulics & Pneumatics",
    code: "CAT-HYD",
    size: 114800,
    skus: 68,
    margin: "42.0%",
    velocity: "7.1x",
    fill: "#8b5cf6",
    health: "Prime",
  },
  {
    name: "Power Transmission",
    code: "CAT-TRANS",
    size: 92400,
    skus: 52,
    margin: "38.5%",
    velocity: "6.8x",
    fill: "#06b6d4",
    health: "Healthy",
  },
  {
    name: "Chemicals & Fluids",
    code: "CAT-CHEM",
    size: 48200,
    skus: 38,
    margin: "29.8%",
    velocity: "5.4x",
    fill: "#10b981",
    health: "Normal",
  },
  {
    name: "Electrical Hardware",
    code: "CAT-ELEC",
    size: 38600,
    skus: 46,
    margin: "41.2%",
    velocity: "7.9x",
    fill: "#f59e0b",
    health: "Prime",
  },
];

const categoryMarginData = [
  { name: "Sensors & Auto", code: "CAT-SENS", margin: 46.5, skus: 84, tier: "High Margin Leader" },
  { name: "Hydraulics & Pneu", code: "CAT-HYD", margin: 42.0, skus: 68, tier: "High Margin Core" },
  { name: "Electrical Hdw", code: "CAT-ELEC", margin: 41.2, skus: 46, tier: "Target Outperformer" },
  { name: "Power Trans", code: "CAT-TRANS", margin: 38.5, skus: 52, tier: "Above Target" },
  { name: "Mechanical Comp", code: "CAT-MECH", margin: 34.2, skus: 126, tier: "Near Target" },
  { name: "Chemicals & Fluid", code: "CAT-CHEM", margin: 29.8, skus: 38, tier: "Volume Base" },
];

const CustomTreemapContent = (props) => {
  const { x, y, width, height, name, code, skus, size, fill } = props;
  if (!width || !height || width < 25 || height < 25) return null;

  const showSubtext = width > 85 && height > 55;
  const showCode = width > 55 && height > 38;

  return (
    <g>
      <rect
        x={x + 2}
        y={y + 2}
        width={width - 4}
        height={height - 4}
        rx={10}
        ry={10}
        fill={fill || "#3b82f6"}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1.5}
        style={{
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.12))",
          cursor: "pointer",
        }}
      />
      {width > 60 && height > 26 && (
        <text
          x={x + 10}
          y={y + 20}
          fill="#ffffff"
          fontSize={width > 120 ? 12 : 10}
          fontWeight="700"
          style={{ pointerEvents: "none" }}
        >
          {name && name.length > 18 && width < 140 ? `${name.slice(0, 15)}...` : name}
        </text>
      )}
      {showCode && (
        <text
          x={x + 10}
          y={y + (showSubtext ? 36 : 32)}
          fill="rgba(255,255,255,0.85)"
          fontSize={9}
          fontFamily="monospace"
          fontWeight="600"
          style={{ pointerEvents: "none" }}
        >
          {code}
        </text>
      )}
      {showSubtext && (
        <text
          x={x + 10}
          y={y + 52}
          fill="rgba(255,255,255,0.95)"
          fontSize={10}
          fontWeight="600"
          style={{ pointerEvents: "none" }}
        >
          {skus} SKUs • ${(size / 1000).toFixed(1)}k
        </text>
      )}
    </g>
  );
};

export function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", code: "", parent: "" });

  useEffect(() => {
    fetchCategories().then((res) => {
      const list = res.results || res || [];
      if (list.length > 0) {
        setCategories(list);
      } else {
        setCategories(categoryTreemapData.map((d, i) => ({
          id: `cat-${i}`,
          name: d.name,
          code: d.code,
          items_count: d.skus,
          parent: null,
        })));
      }
    });
  }, []);

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newCat.name || !newCat.code) return;
    try {
      const item = await createCategory({
        name: newCat.name.trim(),
        code: newCat.code.trim().toUpperCase(),
        parent: newCat.parent || null,
      });
      setCategories((prev) => [
        item,
        ...prev.filter((c) => c.id !== item.id && c.code !== item.code),
      ]);
      setNewCat({ name: "", code: "", parent: "" });
      setIsCreateOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Product Categories & Taxonomy Hierarchy
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
              Taxonomy Rollup
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Hierarchical catalog tree, multi-level SKU grouping, capital density & category gross margin telemetry.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Category</span>
        </button>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Active Taxonomies</span>
            <FolderTree className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {categories.length || 6} Categories
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            100% Tree Synchronized
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Classified Items</span>
            <Boxes className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            414 SKUs
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            0 unassigned catalog orphan
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Catalog Valuation</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            $640.8k USD
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
            Avg $106.8k / category
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Avg Gross Margin</span>
            <Percent className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            38.7%
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            +3.7% vs 35.0% target
          </div>
        </div>
      </div>

      {/* High-Configuration Analytics Section: Treemap & Horizontal Benchmark BarChart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Category Catalog Volume & Capital Valuation Treemap */}
        <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Category Catalog Volume & Capital Allocation
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                  Treemap Density
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Proportional capital concentration & SKU footprints across taxonomy branches.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">$640.8k</span>
              <span className="text-[10px] text-slate-400 block">Total Catalog Value</span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={categoryTreemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#ffffff"
                content={<CustomTreemapContent />}
                isAnimationActive={true}
              >
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-1">
                          <span className="font-bold text-slate-100">{d.name}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {d.code}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] pt-0.5">
                          <div>
                            <span className="text-slate-400 text-[10px]">Capital Value:</span>
                            <div className="font-mono font-bold text-emerald-400">
                              ${(d.size || 0).toLocaleString()} USD
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Active SKUs:</span>
                            <div className="font-mono font-bold text-blue-400">{d.skus} SKUs</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Gross Margin:</span>
                            <div className="font-mono font-bold text-purple-300">{d.margin}</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Turn Velocity:</span>
                            <div className="font-mono font-bold text-amber-300">{d.velocity} / yr</div>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Category Gross Margin % Benchmark (Horizontal BarChart layout="vertical") */}
        <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Category Profitability Benchmark
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                  Horizontal Margin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Gross margin % per category vs 35.0% enterprise target benchmark line.
              </p>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryMarginData}
                layout="vertical"
                margin={{ top: 5, right: 35, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 55]}
                  tickFormatter={(v) => `${v}%`}
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                  width={95}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    const diff = (d.margin - 35).toFixed(1);
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 text-white shadow-2xl text-xs space-y-1">
                        <div className="font-bold text-slate-200">{d.name}</div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-emerald-400 font-bold text-sm">{d.margin}%</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            d.margin >= 35 ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                          }`}>
                            {diff > 0 ? `+${diff}% vs target` : `${diff}% vs target`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">{d.tier} • {d.skus} SKUs</div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  x={35}
                  stroke="#3b82f6"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "Target 35%",
                    fill: "#3b82f6",
                    fontSize: 9,
                    position: "top",
                  }}
                />
                <Bar
                  dataKey="margin"
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={true}
                >
                  {categoryMarginData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.margin >= 42 ? "#10b981" : entry.margin >= 35 ? "#6366f1" : "#f59e0b"}
                    />
                  ))}
                </Bar>
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
            placeholder="Search categories by title, code or classification..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-400 dark:text-zinc-500 tabular-nums font-mono">
          {filteredCategories.length} categories active
        </span>
      </div>

      {/* Categories Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map((cat, idx) => (
          <div
            key={cat.id || idx}
            className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs hover:shadow-md hover:border-blue-400/60 dark:hover:border-blue-700/60 transition-all flex flex-col justify-between space-y-3.5 group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{cat.name}</h3>
                  <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                    {cat.code}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 tabular-nums border border-slate-200/60 dark:border-zinc-700">
                {cat.items_count ?? (idx % 2 === 0 ? 84 : 52)} SKUs
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800/80 text-[11px] text-slate-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <FolderTree className="h-3.5 w-3.5 text-slate-400" />
                {cat.parent ? `Subcategory of ${cat.parent}` : "Root Category"}
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                Create New Category
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  placeholder="e.g. Electrical Components"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Category Code *
                </label>
                <input
                  type="text"
                  required
                  value={newCat.code}
                  onChange={(e) => setNewCat({ ...newCat, code: e.target.value })}
                  placeholder="e.g. CAT-ELEC-01"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 uppercase font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-xs shadow-blue-500/25 transition-all"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
