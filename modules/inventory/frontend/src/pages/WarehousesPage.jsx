import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  Plus,
  ChevronRight,
  Search,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  RefreshCw,
  Sparkles,
  Zap,
  Activity,
  ShieldCheck,
  TrendingUp,
  Warehouse,
  User,
  Phone,
  Mail,
  Globe,
  SlidersHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from "recharts";
import {
  fetchWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  fetchWarehouseConfig,
} from "../services/api";

const WAREHOUSE_TYPES = [
  "Main Warehouse",
  "Distribution Warehouse",
  "Production Warehouse",
  "Retail Warehouse",
  "Transit Warehouse",
];

const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Japan",
  "Australia",
  "India",
  "Singapore",
  "Mexico",
  "Brazil",
  "Netherlands",
];

const WAREHOUSE_MANAGERS = [
  "Alex Morgan",
  "Sarah Chen",
  "David Kim",
  "Elena Rostova",
  "Marcus Vance",
  "Rachel Torres",
];

const FACILITY_RADAR_DATA = [
  { metric: "Space Density", WH_MAIN: 78, WH_EAST: 64, WH_COLD: 42, fullMark: 100 },
  { metric: "Pick SLA Rate", WH_MAIN: 88, WH_EAST: 74, WH_COLD: 62, fullMark: 100 },
  { metric: "Accuracy %", WH_MAIN: 96, WH_EAST: 94, WH_COLD: 98, fullMark: 100 },
  { metric: "Buffer Safety", WH_MAIN: 82, WH_EAST: 90, WH_COLD: 85, fullMark: 100 },
  { metric: "Dock Velocity", WH_MAIN: 72, WH_EAST: 84, WH_COLD: 68, fullMark: 100 },
];

const FACILITY_VELOCITY_DATA = [
  {
    facility: "WH-MAIN",
    fullName: "Chicago Central Hub",
    utilizedM2: 32.8,
    totalM2: 42.0,
    dockTurnaroundHrs: 2.8,
    fillPct: 78,
    status: "Optimal Flow",
  },
  {
    facility: "WH-EAST",
    fullName: "Newark Port Terminal",
    utilizedM2: 15.6,
    totalM2: 24.5,
    dockTurnaroundHrs: 3.4,
    fillPct: 64,
    status: "Healthy Buffer",
  },
  {
    facility: "WH-COLD",
    fullName: "Dallas Cold Chain Hub",
    utilizedM2: 7.5,
    totalM2: 18.0,
    dockTurnaroundHrs: 4.2,
    fillPct: 42,
    status: "High Reserve",
  },
];

export function WarehousesPage() {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [whPrefix, setWhPrefix] = useState("WH");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    warehouse_type: "Main Warehouse",
    description: "",
    address: "",
    city: "",
    state: "",
    country: "United States",
    postal_code: "",
    manager: "",
    contact_number: "",
    status: "Active",
  });

  useEffect(() => {
    loadWarehouses();
    fetchWarehouseConfig().then((cfg) => {
      if (cfg?.warehouse_code_prefix) {
        setWhPrefix(cfg.warehouse_code_prefix);
      }
    });
  }, []);

  const loadWarehouses = async () => {
    setLoading(true);
    try {
      const data = await fetchWarehouses();
      setWarehouses(data || []);
    } catch (e) {
      console.error("Failed to load warehouses", e);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const generateWarehouseCode = () => {
    const num = Math.floor(100 + Math.random() * 900);
    return `${whPrefix}-${num}`;
  };

  const handleOpenCreateModal = () => {
    setEditingWarehouse(null);
    setFormData({
      code: generateWarehouseCode(),
      name: "",
      warehouse_type: "Main Warehouse",
      description: "",
      address: "",
      city: "",
      state: "",
      country: "United States",
      postal_code: "",
      manager: "",
      contact_number: "",
      status: "Active",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (wh) => {
    setEditingWarehouse(wh);
    setFormData({
      code: wh.code,
      name: wh.name,
      warehouse_type: wh.warehouse_type || "Main Warehouse",
      description: wh.description || "",
      address: wh.address || "",
      city: wh.city || "",
      state: wh.state || "",
      country: wh.country || "United States",
      postal_code: wh.postal_code || "",
      manager: wh.manager || "",
      contact_number: wh.contact_number || "",
      status: wh.status || (wh.is_active !== false ? "Active" : "Inactive"),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      showToast("Warehouse Code is required.");
      return;
    }
    if (!formData.name.trim()) {
      showToast("Warehouse Name is required.");
      return;
    }
    if (!formData.address.trim()) {
      showToast("Address is required.");
      return;
    }
    if (!formData.city.trim()) {
      showToast("City is required.");
      return;
    }
    if (!formData.country.trim()) {
      showToast("Country is required.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingWarehouse) {
        const updated = await updateWarehouse(editingWarehouse.id, formData);
        setWarehouses((prev) =>
          prev.map((item) =>
            item.id === editingWarehouse.id ? { ...item, ...updated } : item
          )
        );
        showToast(`Warehouse "${formData.name}" updated successfully.`);
      } else {
        const created = await createWarehouse(formData);
        setWarehouses((prev) => [created, ...prev]);
        showToast(`Warehouse "${formData.name}" provisioned successfully.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Operation failed. Please verify warehouse data.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete warehouse "${name}"?`)) {
      try {
        await deleteWarehouse(id);
        setWarehouses((prev) => prev.filter((item) => item.id !== id));
        showToast(`Warehouse "${name}" deleted.`);
      } catch (err) {
        console.error(err);
        showToast("Cannot delete warehouse with active stock balances.");
      }
    }
  };

  const filteredWarehouses = warehouses.filter((wh) => {
    const q = search.toLowerCase();
    const matchesSearch =
      wh.name?.toLowerCase().includes(q) ||
      wh.code?.toLowerCase().includes(q) ||
      wh.city?.toLowerCase().includes(q) ||
      wh.country?.toLowerCase().includes(q) ||
      wh.manager?.toLowerCase().includes(q) ||
      wh.warehouse_type?.toLowerCase().includes(q);

    const matchesType =
      typeFilter === "ALL" || wh.warehouse_type === typeFilter;

    const currentStatus =
      wh.status || (wh.is_active !== false ? "Active" : "Inactive");
    const matchesStatus =
      statusFilter === "ALL" ||
      currentStatus.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesType && matchesStatus;
  });

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case "Main Warehouse":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-900/50";
      case "Distribution Warehouse":
        return "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50";
      case "Production Warehouse":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50";
      case "Retail Warehouse":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900/50";
      case "Transit Warehouse":
        return "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-900/50";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200 dark:border-zinc-700";
    }
  };

  return (
    <div className="space-y-6">
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Warehouse Management
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
              {warehouses.length} Active Facilities
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Configure enterprise physical warehouses, distribution hubs, storage topologies, and regional facilities.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadWarehouses}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Refresh Warehouse Registry"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Create Warehouse</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total Warehouses</span>
            <Building2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white">
            {warehouses.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">Across 3 geographical regions</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Main Hubs</span>
            <Warehouse className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-indigo-600 dark:text-indigo-400">
            {warehouses.filter((w) => w.warehouse_type === "Main Warehouse").length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">Primary fulfillment centers</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Distribution Nodes</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
            {warehouses.filter((w) => w.warehouse_type === "Distribution Warehouse").length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">Regional transit cross-docks</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Active Operational</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
            {warehouses.filter((w) => (w.status ? w.status.toLowerCase() === "active" : w.is_active !== false)).length}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">100% telemetry online</div>
        </div>
      </div>

      {/* High-Config Analytics Radar & Velocity Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  Facility Operational Radar Performance
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60">
                  Radar Profile
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Multi-facility benchmark: Space Density, Pick SLA, Accuracy %, Buffer Safety & Dock Velocity.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="text-blue-500">WH-MAIN</span>
              <span className="text-indigo-500">WH-EAST</span>
              <span className="text-emerald-500">WH-COLD</span>
            </div>
          </div>

          <div className="h-[260px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={FACILITY_RADAR_DATA}>
                <PolarGrid stroke="#94a3b8" strokeDasharray="3 3" opacity={0.2} />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: "#94a3b8" }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 text-white shadow-2xl text-xs space-y-1">
                        <div className="font-bold text-slate-100">{label} Benchmark</div>
                        <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px]">
                          <span className="text-blue-400 font-mono">MAIN: {payload[0]?.value}%</span>
                          <span className="text-indigo-300 font-mono">EAST: {payload[1]?.value}%</span>
                          <span className="text-emerald-400 font-mono">COLD: {payload[2]?.value}%</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Radar name="WH_MAIN" dataKey="WH_MAIN" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} />
                <Radar name="WH_EAST" dataKey="WH_EAST" stroke="#6366F1" fill="#6366F1" fillOpacity={0.25} />
                <Radar name="WH_COLD" dataKey="WH_COLD" stroke="#10B981" fill="#10B981" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  Storage Utilization vs Dock Velocity
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60">
                  Dual-Axis Flow
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Active Storage Utilized (k m²) vs Carrier Dock Turnaround SLA (Hrs).
              </p>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-[11px]">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Storage (k m²)
              </span>
              <span className="flex items-center gap-1 text-amber-500 text-[11px]">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Dock SLA (Hrs)
              </span>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={FACILITY_VELOCITY_DATA}
                margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis dataKey="facility" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `${v}k`} />
                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={10} tickLine={false} tickFormatter={(v) => `${v}h`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 text-white shadow-2xl text-xs space-y-1">
                        <div className="font-bold text-slate-100">{d.fullName} ({d.facility})</div>
                        <div className="flex justify-between gap-4 text-slate-300">
                          <span>Occupied Footprint:</span>
                          <span className="font-mono text-blue-400">{d.utilizedM2}k / {d.totalM2}k m²</span>
                        </div>
                        <div className="flex justify-between gap-4 text-slate-300">
                          <span>Turnaround Velocity:</span>
                          <span className="font-mono text-amber-400">{d.dockTurnaroundHrs} Hours</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine yAxisId="left" y={35} stroke="#3b82f6" strokeDasharray="3 3" strokeOpacity={0.4} />
                <Bar yAxisId="left" dataKey="utilizedM2" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={26} />
                <Line yAxisId="right" type="monotone" dataKey="dockTurnaroundHrs" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: "#f59e0b" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by code, name, city, country, manager..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Warehouse Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Warehouse Types</option>
            {WAREHOUSE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredWarehouses.map((wh) => {
          const isActive = wh.status ? wh.status.toLowerCase() === "active" : wh.is_active !== false;
          return (
            <div
              key={wh.id || wh.code}
              className="group p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {wh.code}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getTypeBadgeClass(wh.warehouse_type)}`}>
                          {wh.warehouse_type || "Main Warehouse"}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {wh.name}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEditModal(wh)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                      title="Edit warehouse"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(wh.id, wh.name)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete warehouse"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {wh.description && (
                  <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">
                    {wh.description}
                  </p>
                )}

                {/* Location & Address */}
                <div className="space-y-1 text-xs text-slate-600 dark:text-zinc-300 bg-slate-50/70 dark:bg-zinc-800/40 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="truncate">{wh.address || "No address provided"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[11px] pl-5">
                    <Globe className="h-3 w-3 text-slate-400" />
                    <span>
                      {[wh.city, wh.state, wh.country, wh.postal_code].filter(Boolean).join(", ") || "City / Country"}
                    </span>
                  </div>
                </div>

                {/* Manager & Contact */}
                {(wh.manager || wh.contact_number) && (
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {wh.manager && (
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{wh.manager}</span>
                      </div>
                    )}
                    {wh.contact_number && (
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{wh.contact_number}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status and Actions footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                      : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                  {isActive ? "Active" : "Inactive"}
                </span>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/inventory/locations?warehouse=${wh.code}`)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    Storage Locations <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => navigate(`/inventory/racks-bins?warehouse=${wh.code}`)}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    Racks & Bins <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredWarehouses.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-8">
          <Warehouse className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">No warehouses found</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Try adjusting your filters or search keywords.</p>
        </div>
      )}

      {/* Create / Edit Warehouse Modal with EXACT Necessary Fields */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {editingWarehouse ? "Edit Warehouse" : "Create Warehouse"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Warehouse Code (Auto-generated, Required) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-zinc-300">
                      Warehouse Code *
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, code: generateWarehouseCode() })}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" /> Auto-generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. WH-001"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono uppercase"
                  />
                </div>

                {/* Warehouse Name (Text, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Central Fulfillment Hub"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Warehouse Type (Dropdown, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse Type *
                  </label>
                  <select
                    required
                    value={formData.warehouse_type}
                    onChange={(e) => setFormData({ ...formData, warehouse_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    {WAREHOUSE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Status (Active / Inactive, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Status *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Description (Textarea, Optional) */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Operational purpose, loading dock limits, special temperature parameters..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white resize-none"
                />
              </div>

              {/* Address (Textarea, Required) */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Address *
                </label>
                <textarea
                  rows={2}
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address, building number, industrial park..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white resize-none"
                />
              </div>

              {/* City, State, Country, Postal Code */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Chicago"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. IL"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Country *
                  </label>
                  <select
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="e.g. 60601"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Warehouse Manager & Contact Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse Manager
                  </label>
                  <select
                    value={formData.manager}
                    onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">Select Warehouse Manager...</option>
                    {WAREHOUSE_MANAGERS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_number}
                    onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    placeholder="e.g. +1 (312) 555-0192"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingWarehouse ? "Save Changes" : "Create Warehouse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
