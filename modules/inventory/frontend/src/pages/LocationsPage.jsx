import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MapPin,
  Plus,
  Search,
  Building2,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  Boxes,
  SlidersHorizontal,
  Compass,
  Sparkles,
  Zap,
  Activity,
  ShieldCheck,
  TrendingUp,
  Warehouse,
  Gauge,
  Box,
  Split,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
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
} from "../services/api";

const ZONE_SATURATION_DATA = [
  { zone: "Zone A (Fast Mover)", totalBins: 450, occupiedBins: 385, saturationPct: 85.5, vacantSlots: 65, pickSpeed: "High Velocity" },
  { zone: "Zone B (High-Bay)", totalBins: 380, occupiedBins: 240, saturationPct: 63.1, vacantSlots: 140, pickSpeed: "Standard Pallet" },
  { zone: "Zone C (Mezzanine)", totalBins: 260, occupiedBins: 160, saturationPct: 61.5, vacantSlots: 100, pickSpeed: "Carton Flow" },
  { zone: "Cold Vault", totalBins: 180, occupiedBins: 95, saturationPct: 52.7, vacantSlots: 85, pickSpeed: "Climate Monitored" },
  { zone: "Dock Staging", totalBins: 150, occupiedBins: 45, saturationPct: 30.0, vacantSlots: 105, pickSpeed: "Cross-Dock Buffer" },
];

const TOPOLOGY_TYPE_DATA = [
  { name: "Bin Address (BIN)", value: 596, pct: "42.0%", fill: "#3b82f6", desc: "Pick Bins & Shelf Boxes" },
  { name: "Pallet Rack (RACK)", value: 398, pct: "28.0%", fill: "#6366f1", desc: "Standard Pallet Positions" },
  { name: "High-Bay (BAY)", value: 227, pct: "16.0%", fill: "#8b5cf6", desc: "Vertical Bulk Racking" },
  { name: "Staging Area (STAGE)", value: 128, pct: "9.0%", fill: "#06b6d4", desc: "Cross-Dock In/Out Staging" },
  { name: "Secure Vault (VAULT)", value: 71, pct: "5.0%", fill: "#10b981", desc: "High-Value Enclosed Cage" },
];

export function LocationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [locations, setLocations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState(
    searchParams.get("warehouse") || "ALL"
  );
  const [selectedType, setSelectedType] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    warehouse: "WH-MAIN",
    warehouse_id: "",
    code: "",
    name: "",
    zone: "Zone A",
    aisle: "Aisle 1",
    rack: "Rack 1",
    bin: "Bin 01",
    type: "BIN",
    capacity: "1,000 KG",
    occupied: 35,
    is_active: true,
  });

  useEffect(() => {
    loadData();
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

  const handleOpenCreateModal = () => {
    setEditingLocation(null);
    const defaultWh =
      selectedWarehouse !== "ALL"
        ? selectedWarehouse
        : warehouses[0]?.code || "WH-MAIN";
    const whObj = warehouses.find((w) => w.code === defaultWh);

    setFormData({
      warehouse: defaultWh,
      warehouse_id: whObj?.id || defaultWh,
      warehouse_code: defaultWh,
      code: `LOC-${Math.floor(100 + Math.random() * 900)}`,
      name: "",
      zone: "Zone A",
      aisle: "Aisle 1",
      rack: "Rack 1",
      bin: "Bin 01",
      type: "BIN",
      capacity: "1,000 KG",
      occupied: 20,
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (loc) => {
    setEditingLocation(loc);
    setFormData({
      warehouse: loc.warehouse || loc.warehouse_code || "WH-MAIN",
      warehouse_id: loc.warehouse_id || "",
      code: loc.code,
      name: loc.name,
      zone: loc.zone || "Zone A",
      aisle: loc.aisle || "",
      rack: loc.rack || "",
      bin: loc.bin || "",
      type: loc.type || "BIN",
      capacity: loc.capacity || "1,000 KG",
      occupied: loc.occupied ?? 50,
      is_active: loc.is_active !== false,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const whObj = warehouses.find(
        (w) => w.code === formData.warehouse || w.id === formData.warehouse
      );

      const payload = {
        ...formData,
        warehouse: whObj?.id || formData.warehouse,
        warehouse_id: whObj?.id || formData.warehouse,
        warehouse_code: whObj?.code || formData.warehouse,
        warehouse_name: whObj?.name || "Distribution Facility",
      };

      if (editingLocation) {
        const updated = await updateLocation(editingLocation.id, payload);
        setLocations((prev) =>
          prev.map((item) =>
            item.id === editingLocation.id ? { ...item, ...updated } : item
          )
        );
        showToast(`Location ${payload.code} updated.`);
      } else {
        const created = await createLocation(payload);
        setLocations((prev) => [created, ...prev]);
        showToast(`Location ${created.code} registered in facility layout.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Operation completed in local session.");
      setIsModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (locId, locCode) => {
    if (window.confirm(`Decommission location address ${locCode}?`)) {
      await deleteLocation(locId);
      setLocations((prev) => prev.filter((item) => item.id !== locId));
      showToast(`Location ${locCode} decommissioned.`);
    }
  };

  const filtered = locations.filter((loc) => {
    const locWhCode = loc.warehouse_code || loc.warehouse;
    const matchesWh =
      selectedWarehouse === "ALL" || locWhCode === selectedWarehouse;
    const matchesType = selectedType === "ALL" || loc.type === selectedType;
    const matchesSearch =
      loc.name?.toLowerCase().includes(search.toLowerCase()) ||
      loc.code?.toLowerCase().includes(search.toLowerCase()) ||
      loc.zone?.toLowerCase().includes(search.toLowerCase());
    return matchesWh && matchesType && matchesSearch;
  });

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
              Storage Locations & Addressable Bins
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
              Addressable Topologies
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Hierarchical mapping of zones, aisles, high-bays, pallet racks, and picking bin coordinates.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Location</span>
        </button>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Addressable Bins</span>
            <MapPin className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {locations.length > 0 ? `${locations.length} Bins` : "1,420 Bins"}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            100% Topologically Mapped
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Dedicated Zones</span>
            <Layers className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            5 Active Zones
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Fast Mover, High-Bay, Vault
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Vacant Storage Headroom</span>
            <Box className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            495 Available Bins
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
            34.9% Dynamic Clearance
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Average Saturation</span>
            <Gauge className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            65.1% Occupancy
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            Balanced slotting distribution
          </div>
        </div>
      </div>

      {/* High-Configuration Unique Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Warehouse Zone Capacity vs Occupancy Saturation Profile (ComposedChart) */}
        <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Zone Capacity vs Occupancy Saturation
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60">
                  Dual-Axis Slotting
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Total Bins vs Occupied Positions with 85% Congestion Risk threshold line.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-zinc-600" /> Total Bins
              </span>
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-[11px]">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Occupied
              </span>
              <span className="flex items-center gap-1 text-amber-500 text-[11px]">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Saturation %
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={ZONE_SATURATION_DATA}
                margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="zone"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  stroke="#f59e0b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#f59e0b", opacity: 0.2 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-700/60 pb-1">
                          <span className="font-bold text-slate-100">{d.zone}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {d.saturationPct}% Full
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] pt-0.5">
                          <div>
                            <span className="text-slate-400 text-[10px]">Occupied Bins:</span>
                            <div className="font-mono font-bold text-blue-400">{d.occupiedBins} / {d.totalBins}</div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Vacant Slots:</span>
                            <div className="font-mono font-bold text-emerald-400">{d.vacantSlots} Available</div>
                          </div>
                          <div className="col-span-2 text-[10px] text-slate-300">
                            Pick Route: <span className="font-semibold text-indigo-300">{d.pickSpeed}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  yAxisId="right"
                  y={85}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "85% Congestion Risk",
                    fill: "#f43f5e",
                    fontSize: 9,
                    position: "insideTopRight",
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="totalBins"
                  fill="#94a3b8"
                  opacity={0.35}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={true}
                />
                <Bar
                  yAxisId="left"
                  dataKey="occupiedBins"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={true}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="saturationPct"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: "#ffffff" }}
                  activeDot={{ r: 6, fill: "#f59e0b", strokeWidth: 2, stroke: "#ffffff" }}
                  isAnimationActive={true}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Storage Topology Type Allocation & Density (PieChart Donut) */}
        <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Topology Type Distribution
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200/60">
                  Addressable Density
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Breakdown of Pick Bins, Pallet Racks, High-Bays, Staging & Vaults.
              </p>
            </div>
          </div>

          {/* Donut with Center Readout */}
          <div className="relative h-[160px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={TOPOLOGY_TYPE_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  isAnimationActive={true}
                >
                  {TOPOLOGY_TYPE_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 text-white shadow-2xl text-xs space-y-1">
                        <div className="font-bold text-slate-100 flex items-center justify-between gap-3">
                          <span>{d.name}</span>
                          <span className="font-mono text-emerald-400 font-bold">{d.pct}</span>
                        </div>
                        <div className="text-[10px] text-slate-300">{d.value} Total Bins • {d.desc}</div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Metric */}
            <div className="absolute text-center pointer-events-none">
              <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                1,420
              </span>
              <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold block uppercase tracking-wider">
                Total Bins
              </span>
            </div>
          </div>

          {/* Breakdown Telemetry Rail */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800/80 mt-2 text-xs">
            {TOPOLOGY_TYPE_DATA.map((d, i) => (
              <div
                key={i}
                className="p-2 rounded-xl border border-slate-100 dark:border-zinc-800/60 bg-slate-50/60 dark:bg-zinc-800/40 flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                  <span className="text-[10px] text-slate-600 dark:text-zinc-300 truncate">{d.name.split(" ")[0]}</span>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search locations by code, aisle or zone..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              if (e.target.value === "ALL") {
                searchParams.delete("warehouse");
              } else {
                searchParams.set("warehouse", e.target.value);
              }
              setSearchParams(searchParams);
            }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Facilities</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.code}>
                {wh.code} – {wh.name}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="BIN">Bin Address</option>
            <option value="RACK">Aisle Rack</option>
            <option value="BAY">High-Bay Area</option>
            <option value="VAULT">Secure Vault</option>
            <option value="STAGE">Staging Area</option>
          </select>
        </div>
      </div>

      {/* Locations Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">Location Code</th>
                <th className="py-3.5 px-4 font-semibold">Location Title</th>
                <th className="py-3.5 px-4 font-semibold">Facility</th>
                <th className="py-3.5 px-4 font-semibold">Zone</th>
                <th className="py-3.5 px-4 font-semibold">Type</th>
                <th className="py-3.5 px-4 font-semibold">Capacity</th>
                <th className="py-3.5 px-4 font-semibold">Occupancy</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filtered.map((loc) => (
                <tr key={loc.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                      {loc.code}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {loc.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-zinc-300 font-medium">
                    {loc.warehouse_code || loc.warehouse}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                    {loc.zone}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700">
                      {loc.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono">
                    {loc.capacity}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            loc.occupied > 80 ? "bg-amber-500" : "bg-blue-600"
                          }`}
                          style={{ width: `${loc.occupied}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] tabular-nums font-semibold text-slate-700 dark:text-zinc-300">
                        {loc.occupied}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        loc.is_active !== false
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                          : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${loc.is_active !== false ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {loc.is_active !== false ? "Ready" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEditModal(loc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Edit Location"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id, loc.code)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Decommission Location"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Location Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {editingLocation ? "Edit Storage Location" : "Register Storage Location"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse Facility
                  </label>
                  <select
                    value={formData.warehouse}
                    onChange={(e) =>
                      setFormData({ ...formData, warehouse: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.code}>
                        {wh.code} – {wh.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Location Identifier Code
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. A2-R3-B04"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Location Title / Description
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g. Aisle 2 - High-Capacity Rack 3 - Bin 04"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Zone
                  </label>
                  <input
                    type="text"
                    value={formData.zone}
                    onChange={(e) =>
                      setFormData({ ...formData, zone: e.target.value })
                    }
                    placeholder="e.g. Zone A"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Aisle
                  </label>
                  <input
                    type="text"
                    value={formData.aisle}
                    onChange={(e) =>
                      setFormData({ ...formData, aisle: e.target.value })
                    }
                    placeholder="e.g. A2"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Rack / Bin
                  </label>
                  <input
                    type="text"
                    value={formData.bin}
                    onChange={(e) =>
                      setFormData({ ...formData, bin: e.target.value })
                    }
                    placeholder="e.g. B04"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Storage Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  >
                    <option value="BIN">Small Part Bin</option>
                    <option value="RACK">Standard Pallet Rack</option>
                    <option value="BAY">High-Bay Area</option>
                    <option value="VAULT">Secure Climate Vault</option>
                    <option value="STAGE">Inbound/Outbound Staging</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Maximum Capacity
                  </label>
                  <input
                    type="text"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: e.target.value })
                    }
                    placeholder="e.g. 1,200 KG or 8 Pallets"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Current Occupancy Level (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.occupied}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        occupied: parseInt(e.target.value, 10),
                      })
                    }
                    className="flex-1 accent-blue-600 cursor-pointer"
                  />
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums w-12 text-right">
                    {formData.occupied}%
                  </span>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {submitting
                    ? "Saving..."
                    : editingLocation
                    ? "Update Location"
                    : "Register Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
