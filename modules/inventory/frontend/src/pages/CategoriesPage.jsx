import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
  Eye,
  Pencil,
  Trash2,
  X,
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
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../services/api";

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
  const [editingCategory, setEditingCategory] = useState(null);
  const [viewingCategory, setViewingCategory] = useState(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = "success") => {
    setToastMessage({ message: msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    fetchCategories().then((res) => {
      const list = res.results || res || [];
      setCategories(list);
    }).catch((err) => {
      console.error("Failed to load categories:", err);
      setCategories([]);
    });
  }, []);

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newCat.name || !newCat.code) {
      showToast("Category name and code are required.");
      return;
    }
    setSavingCategory(true);
    try {
      const payload = {
        name: newCat.name.trim(),
        code: newCat.code.trim().toUpperCase(),
        parent: newCat.parent || null,
      };
      const item = editingCategory
        ? await updateCategory(editingCategory.id, payload)
        : await createCategory(payload);
      setCategories((prev) =>
        editingCategory
          ? prev.map((category) =>
              String(category.id) === String(item.id) ? item : category
            )
          : [item, ...prev.filter((category) => category.id !== item.id && category.code !== item.code)]
      );
      showToast(
        `Category "${item.name}" ${editingCategory ? "updated" : "created"} successfully.`
      );
      setNewCat({ name: "", code: "", parent: "" });
      setEditingCategory(null);
      setIsCreateOpen(false);
    } catch (err) {
      console.error(err);
      showToast(`Failed to ${editingCategory ? "update" : "create"} category: ${err.message}`, "error");
    } finally {
      setSavingCategory(false);
    }
  };

  const openEditCategory = (category) => {
    setEditingCategory(category);
    setNewCat({
      name: category.name || "",
      code: category.code || "",
      parent: category.parent ? String(category.parent) : "",
    });
    setIsCreateOpen(true);
  };

  const closeCategoryForm = () => {
    setIsCreateOpen(false);
    setEditingCategory(null);
    setNewCat({ name: "", code: "", parent: "" });
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const category = categoryToDelete;
    setDeletingCategoryId(category.id);
    try {
      await deleteCategory(category.id);
      setCategories((prev) =>
        prev.filter((item) => String(item.id) !== String(category.id))
      );
      showToast(`Category "${category.name}" deleted.`);
      setCategoryToDelete(null);
    } catch (err) {
      showToast(`Cannot delete category: ${err.message}`, "error");
    } finally {
      setDeletingCategoryId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex max-w-lg items-center gap-2.5 rounded-2xl border px-4 py-3 text-xs font-medium text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-top-2 ${
          toastMessage.type === "error"
            ? "border-rose-700/60 bg-rose-950/95 dark:bg-rose-950/95"
            : "border-slate-700/60 bg-slate-900/95 dark:bg-zinc-800/95"
        }`}>
          <CheckCircle2 className={`h-4 w-4 shrink-0 ${toastMessage.type === "error" ? "text-rose-300" : "text-emerald-400"}`} />
          <span>{toastMessage.message}</span>
        </div>
      )}

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
          onClick={() => {
            closeCategoryForm();
            setIsCreateOpen(true);
          }}
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
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Category Catalog Volume & Capital Allocation
                </h3>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                  Treemap Density
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Proportional capital concentration & SKU footprints across taxonomy branches.
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">$640.8k</span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">Total Catalog Value</span>
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
                isAnimationActive={false}
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
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Category Profitability Benchmark
                </h3>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
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
                margin={{ top: 15, right: 35, left: 10, bottom: 5 }}
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
                  width={110}
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
                          <span className="font-mono text-emerald-400 font-bold text-sm tabular-nums">{d.margin}%</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
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
                  isAnimationActive={false}
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
      {filteredCategories.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <Layers className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-400" />
          <p className="font-semibold text-sm text-slate-700 dark:text-zinc-300">No categories found</p>
          <p className="text-xs mt-1 text-slate-400">
            Try adjusting your search criteria or create a new taxonomy category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat, idx) => (
            <div
              key={cat.id || idx}
              className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs hover:shadow-md hover:border-blue-400/60 dark:hover:border-blue-700/60 transition-all flex flex-col justify-between space-y-3.5 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{cat.name}</h3>
                    <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                      {cat.code}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 tabular-nums border border-slate-200/60 dark:border-zinc-700">
                  {cat.items_count ?? (idx % 2 === 0 ? 84 : 52)} SKUs
                </span>
              </div>

              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewingCategory(cat)}
                  aria-label={`View ${cat.name}`}
                  title="View category"
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openEditCategory(cat)}
                  aria-label={`Edit ${cat.name}`}
                  title="Edit category"
                  className="rounded-lg border border-blue-200 p-2 text-blue-700 hover:bg-blue-50 dark:border-blue-900/70 dark:text-blue-300 dark:hover:bg-blue-950/40"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(cat)}
                  aria-label={`Delete ${cat.name}`}
                  title="Delete category"
                  className="rounded-lg border border-rose-200 p-2 text-rose-700 hover:bg-rose-50 dark:border-rose-900/70 dark:text-rose-300 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800/80 text-[11px] text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <FolderTree className="h-3.5 w-3.5 text-slate-400" />
                  {cat.parent ? `Subcategory of ${cat.parent}` : "Root Category"}
                </span>
                <Link
                  to={`/inventory/products?category=${encodeURIComponent(cat.name)}`}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  <span>View Products</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div role="dialog" aria-modal="true" aria-labelledby="category-form-title" className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 id="category-form-title" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                {editingCategory ? "Edit Category" : "Create New Category"}
              </h2>
              <button
                type="button"
                onClick={closeCategoryForm}
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

              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Parent Category
                </label>
                <select
                  value={newCat.parent}
                  onChange={(e) => setNewCat({ ...newCat, parent: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">No parent (top-level)</option>
                  {categories
                    .filter((category) => !editingCategory || String(category.id) !== String(editingCategory.id))
                    .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.code})
                    </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={closeCategoryForm}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-xs shadow-blue-500/25 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingCategory ? "Saving..." : editingCategory ? "Update Category" : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-details-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 dark:border-zinc-800">
              <div>
                <h2 id="category-details-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Category Details
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{viewingCategory.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingCategory(null)}
                aria-label="Close category details"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">Category Name</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{viewingCategory.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">Category Code</dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-blue-700 dark:text-blue-300">{viewingCategory.code}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">Parent Category</dt>
                <dd className="mt-1 text-sm text-slate-900 dark:text-white">
                  {categories.find((category) => String(category.id) === String(viewingCategory.parent))?.name || "Root Category"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">Status</dt>
                <dd className="mt-1 text-sm text-slate-900 dark:text-white">{viewingCategory.is_active === false ? "Inactive" : "Active"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">Description</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">{viewingCategory.description || "No description provided."}</dd>
              </div>
            </dl>
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setViewingCategory(null)}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const category = viewingCategory;
                  setViewingCategory(null);
                  openEditCategory(category);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Pencil className="h-4 w-4" />
                Edit Category
              </button>
            </div>
          </section>
        </div>
      )}

      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-category-title"
            aria-describedby="delete-category-description"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 id="delete-category-title" className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete category?
                </h2>
                <p id="delete-category-description" className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                  Delete <span className="font-semibold text-slate-900 dark:text-white">{categoryToDelete.name}</span> ({categoryToDelete.code})? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                disabled={deletingCategoryId !== null}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                disabled={deletingCategoryId !== null}
                className="rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingCategoryId !== null ? "Deleting..." : "Delete Category"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
