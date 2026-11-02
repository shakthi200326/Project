import React, { useState, useEffect, useMemo } from "react";
import {
  BookmarkCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Plus,
  ArrowRight,
  X,
  Sparkles,
  Filter,
  Check,
  Layers,
  Zap,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { fetchReservations } from "../services/api";

export function StockReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [newRes, setNewRes] = useState({ reference_doc: "", item_sku: "BRG-6205-2RS", quantity: 10, warehouse: "Main Central Hub", expires_days: 7 });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    fetchReservations().then((res) => {
      const items = (res.results || []).map((r) => ({
        id: r.id,
        reference_doc: r.reference_doc,
        item_sku: r.item_code || r.item_sku || "SKU-ITEM",
        item_name: r.item || r.item_name || "Stock Item",
        warehouse: r.warehouse || "Main Central Hub",
        quantity: r.quantity,
        unit: "EA",
        status: r.status,
        expires_at: r.expires_at || "2026-11-10T12:00:00Z",
      }));
      setReservations(items);
    });
  }, []);

  const handleExportCSV = () => {
    const headers = ["Reference Document", "SKU", "Item Description", "Warehouse", "Quantity", "Unit", "Status", "Expiration Date"];
    const rows = reservations.map(r => [
      `"${r.reference_doc}"`,
      `"${r.item_sku}"`,
      `"${r.item_name.replace(/"/g, '""')}"`,
      `"${r.warehouse}"`,
      r.quantity,
      `"${r.unit}"`,
      `"${r.status}"`,
      `"${r.expires_at}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_reservations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock reservations register exported as CSV");
  };

  const handleRelease = (id) => {
    const item = reservations.find(r => r.id === id);
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "RELEASED" } : r))
    );
    showToast(`Hold ${item ? item.reference_doc : ""} successfully released to available stock.`);
  };

  const handleFulfill = (id) => {
    const item = reservations.find(r => r.id === id);
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "FULFILLED" } : r))
    );
    showToast(`Reservation ${item ? item.reference_doc : ""} fulfilled and dispatched.`);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newRes.reference_doc) return;
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + Number(newRes.expires_days));
    
    const created = {
      id: `res-${Date.now()}`,
      reference_doc: newRes.reference_doc,
      item_sku: newRes.item_sku,
      item_name: newRes.item_sku === "BRG-6205-2RS" ? "Industrial Ball Bearing 6205-2RS" : "Hydraulic Valve",
      warehouse: newRes.warehouse,
      quantity: Number(newRes.quantity),
      unit: "EA",
      status: "PENDING",
      expires_at: expDate.toISOString(),
    };
    setReservations((prev) => [created, ...prev]);
    setIsModalOpen(false);
    showToast(`Reservation hold ${newRes.reference_doc} successfully locked.`);
    setNewRes({ reference_doc: "", item_sku: "BRG-6205-2RS", quantity: 10, warehouse: "Main Central Hub", expires_days: 7 });
  };

  const pendingHolds = reservations.filter((r) => r.status === "PENDING");
  const totalReservedUnits = pendingHolds.reduce((acc, r) => acc + r.quantity, 0);

  const dynamicAllocationHorizon = useMemo(() => {
    const baseReserved = Math.max(totalReservedUnits, 220);
    const days = [
      "Day 1 (Today)",
      "Day 2",
      "Day 3",
      "Day 4",
      "Day 5",
      "Day 6",
      "Day 7 (Horizon)",
    ];
    const decayFactors = [1.0, 0.91, 0.82, 0.69, 0.54, 0.38, 0.22];
    const expiringPaces = [12, 24, 38, 48, 56, 62, 70];
    const baseFree = 1950;

    return days.map((day, idx) => {
      const hard = Math.round(baseReserved * decayFactors[idx]);
      const exp = expiringPaces[idx];
      const free = baseFree + Math.round((baseReserved - hard) * 0.95);
      return {
        day,
        hardReserved: hard,
        expiringUnits: exp,
        freeToPromise: free,
        bufferFloor: 400,
      };
    });
  }, [totalReservedUnits]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900/95 dark:bg-white/95 text-white dark:text-zinc-900 shadow-2xl backdrop-blur-md border border-slate-700/50 dark:border-zinc-200/50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Stock Reservations & Order Holds
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50">
              <Sparkles className="h-2.5 w-2.5" />
              Allocation Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Soft and hard inventory allocations, sales order commitments, and expiration schedules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/60 shadow-xs cursor-pointer transition-all hover:border-slate-300"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>New Reservation Hold</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="group relative overflow-hidden p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Active Pending Holds</span>
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-2">
            {pendingHolds.length}{" "}
            <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">orders</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span>Locked against dispatch</span>
          </div>
        </div>

        <div className="group relative overflow-hidden p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Total Units Reserved</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <BookmarkCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-2">
            {totalReservedUnits.toLocaleString()}{" "}
            <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">EA</span>
          </div>
          <span className="block mt-2 text-[11px] text-slate-400">Deducted from available stock balance</span>
        </div>

        <div className="group relative overflow-hidden p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Fulfillment Efficiency</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-2">
            96.8%
          </div>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            <span>+2.4% vs last cycle</span>
            <span className="text-slate-400 font-normal">· SLA compliance</span>
          </div>
        </div>
      </div>

      {/* High-Configuration Chart: 7-Day Dynamic Order Allocation & Hard Hold Expiry Trajectory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  7-Day Dynamic Order Allocation & Hard Hold Expiry Horizon
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40">
                  Stepped Composed
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Discrete hard allocations vs scheduled expiry releases mapped against Free-to-Promise availability.
              </p>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                  {totalReservedUnits} EA
                </span>
                <span className="text-[10px] text-slate-400 block">Total Locked</span>
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  1,950+ EA
                </span>
                <span className="text-[10px] text-slate-400 block">Free to Promise</span>
              </div>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dynamicAllocationHorizon}
                margin={{ top: 15, right: 15, left: -20, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="hardAllocGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#8b5cf6"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                  tickFormatter={(v) => `${v}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#10b981"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1.5">
                        <div className="font-semibold text-slate-200 border-b border-slate-700/60 pb-1 flex items-center justify-between gap-3">
                          <span>{d.day}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Forecast Window
                          </span>
                        </div>
                        <div className="space-y-1 pt-0.5">
                          <div className="flex items-center justify-between gap-4 text-[11px]">
                            <span className="text-purple-300 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-sm bg-purple-500 inline-block" />
                              Active Hard Holds:
                            </span>
                            <span className="font-mono font-bold text-white">{d.hardReserved} EA</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-[11px]">
                            <span className="text-amber-300 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-sm bg-amber-500 inline-block" />
                              Expiring Releases:
                            </span>
                            <span className="font-mono font-bold text-amber-300">+{d.expiringUnits} EA</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-[11px] border-t border-slate-700/60 pt-1">
                            <span className="text-emerald-300 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                              Free-to-Promise:
                            </span>
                            <span className="font-mono font-bold text-emerald-400">{d.freeToPromise} EA</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={32}
                  iconType="circle"
                  iconSize={8}
                  formatter={(val) => (
                    <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium ml-1">
                      {val}
                    </span>
                  )}
                />
                <Area
                  yAxisId="left"
                  type="stepAfter"
                  dataKey="hardReserved"
                  name="Hard Order Holds"
                  fill="url(#hardAllocGrad)"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                />
                <Bar
                  yAxisId="left"
                  dataKey="expiringUnits"
                  name="Scheduled Releases"
                  barSize={16}
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="freeToPromise"
                  name="Free-to-Promise Stock"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#10b981", strokeWidth: 1.5, stroke: "#064e3b" }}
                  activeDot={{ r: 6 }}
                />
                <ReferenceLine
                  yAxisId="left"
                  y={180}
                  stroke="#f43f5e"
                  strokeDasharray="3 3"
                  label={{ value: "Max Hold Quota (180 EA)", position: "insideTopLeft", fill: "#f43f5e", fontSize: 9 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Allocation Telemetry & Priority Breakdown Rail */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3">
          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Allocation Queue Ratio</span>
              <Layers className="h-4 w-4 text-purple-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">14.2%</span>
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded">
                Normal Band
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
              <div className="bg-purple-600 h-full rounded-full w-[42%]" />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
              Proportion of total inventory committed to open sales & work orders.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">48h Release Velocity</span>
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">36 EA</span>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                Auto-Reclaim
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
              <div className="bg-amber-500 h-full rounded-full w-[65%]" />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
              Expired soft reservations automatically returning to general pick pool.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-linear-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-900 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-bold">Safety Stock Floor Seal</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">
              Guaranteed 400 EA emergency buffer floor. Hard locks prevent overselling across all B2B EDI channels.
            </p>
          </div>
        </div>
      </div>

      {/* Reservations Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white">Active Allocation Registry</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              {reservations.length} records
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-800/30 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3 px-5 font-semibold">Reference Document</th>
                <th className="py-3 px-5 font-semibold">Product Item</th>
                <th className="py-3 px-5 font-semibold">Warehouse</th>
                <th className="py-3 px-5 font-semibold text-right">Reserved Qty</th>
                <th className="py-3 px-5 font-semibold">Status</th>
                <th className="py-3 px-5 font-semibold">Hold Expiration</th>
                <th className="py-3 px-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {reservations.map((res) => (
                <tr key={res.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 px-5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md font-mono text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                      {res.reference_doc}
                    </span>
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="font-semibold text-slate-900 dark:text-zinc-100">{res.item_name}</div>
                    <div className="font-mono text-[11px] text-slate-400 mt-0.5">{res.item_sku}</div>
                  </td>
                  <td className="py-3.5 px-5 text-slate-600 dark:text-zinc-300 font-medium">
                    {res.warehouse}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    {res.quantity.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{res.unit}</span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        res.status === "PENDING"
                          ? "bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/50"
                          : res.status === "FULFILLED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50"
                          : "bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700/50"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          res.status === "PENDING"
                            ? "bg-purple-500 animate-pulse"
                            : res.status === "FULFILLED"
                            ? "bg-emerald-500"
                            : "bg-slate-400"
                        }`}
                      />
                      {res.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                    {new Date(res.expires_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    {res.status === "PENDING" ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleRelease(res.id)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Release Hold
                        </button>
                        <button
                          onClick={() => handleFulfill(res.id)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          Fulfill & Dispatch
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No actions pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookmarkCheck className="h-4 w-4 text-purple-600" />
                Create Stock Reservation Hold
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Sales / Work Order Reference *
                </label>
                <input
                  type="text"
                  required
                  value={newRes.reference_doc}
                  onChange={(e) => setNewRes({ ...newRes, reference_doc: e.target.value })}
                  placeholder="e.g. SO-2026-8910"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  SKU to Allocate *
                </label>
                <select
                  value={newRes.item_sku}
                  onChange={(e) => setNewRes({ ...newRes, item_sku: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="BRG-6205-2RS">BRG-6205-2RS - Industrial Ball Bearing (Avail: 405)</option>
                  <option value="HYD-SV-24V">HYD-SV-24V - Hydraulic Solenoid Valve (Avail: 12)</option>
                  <option value="BELT-T10-1200">BELT-T10-1200 - Timing Belt (Avail: 260)</option>
                  <option value="LUB-SYN-VG46">LUB-SYN-VG46 - Synthetic Lubricant (Avail: 1,150)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Hold Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newRes.quantity}
                    onChange={(e) => setNewRes({ ...newRes, quantity: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Expires In (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={newRes.expires_days}
                    onChange={(e) => setNewRes({ ...newRes, expires_days: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Lock Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
