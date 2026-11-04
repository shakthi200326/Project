import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  MapPin,
  Plus,
  Search,
  Building2,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  RefreshCw,
  Sparkles,
  Layers,
  ShieldCheck,
  TrendingUp,
  Warehouse,
  Boxes,
  SlidersHorizontal,
  ChevronRight,
  AlertTriangle,
  Ban,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  fetchLocations,
  fetchWarehouses,
  createLocation,
  updateLocation,
  deleteLocation,
  fetchWarehouseConfig,
} from "../services/api";

const LOCATION_TYPES = [
  "Receiving",
  "Storage",
  "Picking",
  "Packing",
  "Dispatch",
  "Inspection",
  "Quarantine",
  "Returns",
];

const STATUS_OPTIONS = ["Active", "Inactive", "Blocked"];

const ZONE_SATURATION_DATA = [
  { zone: "Storage High-Bay", totalBins: 450, occupiedBins: 385, saturationPct: 85.5 },
  { zone: "Fast Pick Conveyor", totalBins: 380, occupiedBins: 240, saturationPct: 63.1 },
  { zone: "Receiving Staging", totalBins: 260, occupiedBins: 160, saturationPct: 61.5 },
  { zone: "Outbound Dispatch", totalBins: 180, occupiedBins: 95, saturationPct: 52.7 },
  { zone: "Quarantine Vault", totalBins: 150, occupiedBins: 45, saturationPct: 30.0 },
];

const TOPOLOGY_TYPE_DATA = [
  { name: "Storage", value: 42, color: "#4f46e5" },
  { name: "Picking", value: 24, color: "#10b981" },
  { name: "Receiving", value: 14, color: "#3b82f6" },
  { name: "Packing", value: 8, color: "#f59e0b" },
  { name: "Dispatch", value: 6, color: "#8b5cf6" },
  { name: "Inspection", value: 3, color: "#06b6d4" },
  { name: "Quarantine", value: 2, color: "#ef4444" },
  { name: "Returns", value: 1, color: "#f97316" },
];

export function LocationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState(
    searchParams.get("warehouse") || "ALL"
  );
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [locPrefix, setLocPrefix] = useState("LOC");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    warehouse: "WH-MAIN",
    warehouse_id: "",
    location_type: "Storage",
    description: "",
    status: "Active",
  });

  useEffect(() => {
    loadData();
    fetchWarehouseConfig().then((cfg) => {
      if (cfg?.location_code_prefix) {
        setLocPrefix(cfg.location_code_prefix);
      }
    });
  }, []);

  useEffect(() => {
    const whParam = searchParams.get("warehouse");
    if (whParam) {
      setSelectedWarehouse(whParam);
    }
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [locData, whData] = await Promise.all([
        fetchLocations(),
        fetchWarehouses(),
      ]);
      setLocations(locData || []);
      setWarehouses(whData || []);
    } catch (e) {
      console.error("Failed to load locations", e);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const generateLocationCode = () => {
    const num = Math.floor(100 + Math.random() * 900);
    return `${locPrefix}-${num}`;
  };

  const handleOpenCreateModal = () => {
    setEditingLocation(null);
    const defaultWh =
      selectedWarehouse !== "ALL"
        ? selectedWarehouse
        : warehouses[0]?.code || "WH-MAIN";
    const whObj = warehouses.find((w) => w.code === defaultWh) || warehouses[0];

    setFormData({
      code: generateLocationCode(),
      name: "",
      warehouse: whObj?.code || defaultWh,
      warehouse_id: whObj?.id || 1,
      location_type: "Storage",
      description: "",
      status: "Active",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (loc) => {
    setEditingLocation(loc);
    const whObj =
      warehouses.find(
        (w) => w.code === loc.warehouse || w.code === loc.warehouse_code || w.id === loc.warehouse_id
      ) || warehouses[0];

    setFormData({
      code: loc.code,
      name: loc.name,
      warehouse: loc.warehouse_code || loc.warehouse || whObj?.code || "WH-MAIN",
      warehouse_id: whObj?.id || 1,
      location_type: loc.location_type || "Storage",
      description: loc.description || "",
      status: loc.status || (loc.is_active !== false ? "Active" : "Inactive"),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      showToast("Location Code is required.");
      return;
    }
    if (!formData.name.trim()) {
      showToast("Location Name is required.");
      return;
    }
    if (!formData.warehouse) {
      showToast("Warehouse selection is required.");
      return;
    }
    if (!formData.location_type) {
      showToast("Location Type is required.");
      return;
    }
    if (!formData.status) {
      showToast("Status is required.");
      return;
    }

    setSubmitting(true);
    try {
      const whObj =
        warehouses.find(
          (w) => w.code === formData.warehouse || w.id === formData.warehouse
        ) || warehouses[0];

      const payload = {
        ...formData,
        warehouse: whObj?.id || 1,
        warehouse_id: whObj?.id || 1,
        warehouse_code: whObj?.code || formData.warehouse,
        warehouse_name: whObj?.name || "Facility",
        is_active: formData.status === "Active",
      };

      if (editingLocation) {
        const updated = await updateLocation(editingLocation.id, payload);
        setLocations((prev) =>
          prev.map((item) =>
            item.id === editingLocation.id ? { ...item, ...updated } : item
          )
        );
        showToast(`Storage Location "${payload.code}" updated.`);
      } else {
        const created = await createLocation(payload);
        setLocations((prev) => [created, ...prev]);
        showToast(`Storage Location "${created.code}" created successfully.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Operation failed. Please verify storage location details.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, code) => {
    if (window.confirm(`Are you sure you want to delete storage location "${code}"?`)) {
      try {
        await deleteLocation(id);
        setLocations((prev) => prev.filter((item) => item.id !== id));
        showToast(`Storage Location "${code}" deleted.`);
      } catch (err) {
        console.error(err);
        showToast("Cannot delete location with active inventory balances.");
      }
    }
  };

  const filteredLocations = locations.filter((loc) => {
    const q = search.toLowerCase();
    const matchesSearch =
      loc.code?.toLowerCase().includes(q) ||
      loc.name?.toLowerCase().includes(q) ||
      loc.description?.toLowerCase().includes(q) ||
      (loc.warehouse_name || "").toLowerCase().includes(q);

    const locWh = loc.warehouse_code || loc.warehouse;
    const matchesWarehouse =
      selectedWarehouse === "ALL" || locWh === selectedWarehouse;

    const matchesType =
      selectedType === "ALL" ||
      loc.location_type === selectedType ||
      loc.type === selectedType;

    const locStatus =
      loc.status || (loc.is_active !== false ? "Active" : "Inactive");
    const matchesStatus =
      selectedStatus === "ALL" ||
      locStatus.toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesWarehouse && matchesType && matchesStatus;
  });

  const getLocationTypeBadgeClass = (type) => {
    switch (type) {
      case "Receiving":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-900/50";
      case "Storage":
        return "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50";
      case "Picking":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50";
      case "Packing":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900/50";
      case "Dispatch":
        return "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-900/50";
      case "Inspection":
        return "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-400 border-cyan-200 dark:border-cyan-900/50";
      case "Quarantine":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900/50";
      case "Returns":
        return "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400 border-orange-200 dark:border-orange-900/50";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200 dark:border-zinc-700";
    }
  };

  const getStatusBadge = (status, isActive) => {
    const st = status || (isActive !== false ? "Active" : "Inactive");
    if (st.toLowerCase() === "active") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      );
    }
    if (st.toLowerCase() === "blocked") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
          <Ban className="h-2.5 w-2.5 text-rose-500" />
          Blocked
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Inactive
      </span>
    );
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Storage Location Management
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
              {locations.length} Locations Defined
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Manage functional warehouse areas: receiving docks, bulk storage, pick zones, packing benches, dispatch bays, and quarantine cells.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Refresh Locations"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Create Storage Location</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total Locations</span>
            <MapPin className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white">
            {locations.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">Across {warehouses.length} warehouses</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Active Storage</span>
            <Building2 className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-indigo-600 dark:text-indigo-400">
            {locations.filter((l) => (l.status || "Active").toLowerCase() === "active").length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">Ready for put-away</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Pick & Pack Zones</span>
            <Boxes className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
            {locations.filter((l) => l.location_type === "Picking" || l.location_type === "Packing").length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">High throughput zones</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Blocked / Hold</span>
            <Ban className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-rose-600 dark:text-rose-400">
            {locations.filter((l) => (l.status || "").toLowerCase() === "blocked" || l.location_type === "Quarantine").length}
          </div>
          <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">Quarantine & inspection hold</div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Storage Zone Saturation & Utilization
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Utilized capacity slots across functional warehouse zones.
              </p>
            </div>
          </div>
          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={ZONE_SATURATION_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis dataKey="zone" stroke="#94a3b8" fontSize={10} tickLine={false} interval={0} tickFormatter={(v) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
                <YAxis width="auto" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 text-white shadow-2xl text-xs space-y-1">
                        <div className="font-bold text-slate-100">{d.zone}</div>
                        <div className="text-blue-400 font-mono">Slots: {d.occupiedBins} / {d.totalBins}</div>
                        <div className="text-emerald-400 font-mono">Saturation: {d.saturationPct}%</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="totalBins" fill="#94a3b8" fillOpacity={0.3} radius={[4, 4, 0, 0]} barSize={28} isAnimationActive={false} />
                <Bar dataKey="occupiedBins" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={28} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              Functional Area Distribution
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
              Breakdown by functional location topology.
            </p>
          </div>

          <div className="h-[210px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={TOPOLOGY_TYPE_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  isAnimationActive={false}>
                  {TOPOLOGY_TYPE_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val, name) => [`${val}% of positions`, name]}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
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
            placeholder="Search by code, name, description, warehouse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Warehouse Filter */}
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.code || wh.id} value={wh.code}>{wh.name} ({wh.code})</option>
            ))}
          </select>

          {/* Location Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Location Types</option>
            {LOCATION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Storage Locations Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                <th className="py-3 px-4">Location Code</th>
                <th className="py-3 px-4">Location Name</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4">Location Type</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredLocations.map((loc) => {
                const whCode = loc.warehouse_code || loc.warehouse;
                const whObj = warehouses.find((w) => w.code === whCode);
                const locType = loc.location_type || "Storage";
                return (
                  <tr
                    key={loc.id || loc.code}
                    className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900/40">
                        {loc.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {loc.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium">{whObj?.name || whCode || "Main Hub"}</span>
                        <span className="text-[10px] font-mono text-slate-400">({whCode})</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getLocationTypeBadgeClass(locType)}`}>
                        {locType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400">
                      <div className="max-w-xs truncate">{loc.description || "—"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(loc.status, loc.is_active)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/inventory/racks-bins?warehouse=${whCode}&location=${loc.code}`)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                          title="Manage Racks & Bins in this location"
                        >
                          <Boxes className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(loc)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                          title="Edit location"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(loc.id, loc.code)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete location"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredLocations.length === 0 && (
            <div className="text-center py-12 p-8">
              <MapPin className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">No storage locations found</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Try adjusting your filters or search keywords.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Storage Location Modal with EXACT Necessary Fields */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {editingLocation ? "Edit Storage Location" : "Create Storage Location"}
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
                {/* Location Code (Auto-generated, Required) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-zinc-300">
                      Location Code *
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, code: generateLocationCode() })}
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
                    placeholder="e.g. LOC-001"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono uppercase"
                  />
                </div>

                {/* Location Name (Text, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Location Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. High-Bay Pallet Aisle 1"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Warehouse (Dropdown, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse *
                  </label>
                  <select
                    required
                    value={formData.warehouse}
                    onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.code || wh.id} value={wh.code}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location Type (Dropdown, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Location Type *
                  </label>
                  <select
                    required
                    value={formData.location_type}
                    onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    {LOCATION_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
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
                  placeholder="Operational purpose, aisle boundaries, conveyor link, hazard specs..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white resize-none"
                />
              </div>

              {/* Status (Active / Inactive / Blocked, Required) */}
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
                  <option value="Blocked">Blocked</option>
                </select>
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
                  {submitting ? "Saving..." : editingLocation ? "Save Changes" : "Create Storage Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
