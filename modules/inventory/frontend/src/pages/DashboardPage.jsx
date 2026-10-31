import React, { useState, useEffect } from "react";
import {
  Boxes,
  Building2,
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Calendar,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { fetchInventoryKPIs, fetchStockMovements } from "../services/api";

const MOVEMENT_DATA = [
  { date: "Oct 24", inbound: 450, outbound: 320 },
  { date: "Oct 25", inbound: 520, outbound: 410 },
  { date: "Oct 26", inbound: 680, outbound: 490 },
  { date: "Oct 27", inbound: 390, outbound: 550 },
  { date: "Oct 28", inbound: 720, outbound: 380 },
  { date: "Oct 29", inbound: 850, outbound: 620 },
  { date: "Oct 30", inbound: 610, outbound: 440 },
];

const CATEGORY_DATA = [
  { name: "Mechanical", value: 38, color: "#3B82F6" },
  { name: "Hydraulics", value: 24, color: "#10B981" },
  { name: "Sensors", value: 18, color: "#F59E0B" },
  { name: "Power Trans", value: 12, color: "#8B5CF6" },
  { name: "Chemicals", value: 8, color: "#EC4899" },
];

export function DashboardPage() {
  const [kpis, setKpis] = useState(null);
  const [recentMovements, setRecentMovements] = useState([]);
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    fetchInventoryKPIs().then(setKpis);
    fetchStockMovements().then((data) => setRecentMovements(data.results || []));
  }, []);

  if (!kpis) return null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Inventory Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Real-time multi-warehouse availability, moving weighted valuation & stock health.
          </p>
        </div>

        {/* Global Dashboard Filters */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">This Quarter</option>
              <option value="ytd">Year to Date</option>
            </select>
          </div>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors">
            <span>Export Summary</span>
          </button>
        </div>
      </div>

      {/* 7 Core KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Products */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span>Total SKUs</span>
            <Boxes className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {kpis.total_products.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
            <TrendingUp className="h-3 w-3" /> +12 this month
          </div>
        </div>

        {/* Total Warehouses */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span>Warehouses</span>
            <Building2 className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {kpis.total_warehouses}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            Across 3 regions
          </div>
        </div>

        {/* Total Stock Value */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span>Valuation (WAV)</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
            ${kpis.total_stock_value.toLocaleString("en-US", { minimumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
            Weighted Average
          </div>
        </div>

        {/* Available Stock */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span>Available</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
            {kpis.total_available.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            Free for dispatch
          </div>
        </div>

        {/* Reserved Stock */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span>Reserved</span>
            <Clock className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-purple-700 dark:text-purple-400">
            {kpis.total_reserved.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-purple-600 dark:text-purple-400">
            Allocated to orders
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span>Low Stock</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
            {kpis.low_stock_items}
          </div>
          <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            Requires reorder
          </div>
        </div>

        {/* Out of Stock */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span>Out of Stock</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-rose-600 dark:text-rose-400">
            {kpis.out_of_stock_items}
          </div>
          <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
            Critical stock-out
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Movement Trend (Inbound vs Outbound) */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Stock Movement Dynamics
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                Daily volume of Goods Receipts (Inbound) vs Stock Issues (Outbound)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Inbound
              </span>
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Outbound
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOVEMENT_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#27272a",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="inbound" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#inboundGrad)" />
                <Area type="monotone" dataKey="outbound" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#outboundGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Category Distribution */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Inventory by Category
            </h2>
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              Proportion of stock valuation by classification
            </p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={CATEGORY_DATA} innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {CATEGORY_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
            {CATEGORY_DATA.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-medium text-slate-900 dark:text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Sections: Recent Movements & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Stock Movements Table */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recent Stock Movements
            </h2>
            <a href="/inventory/control/ledger" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View Immutable Ledger <ChevronRight className="h-3 w-3" />
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500">
                  <th className="pb-2 font-medium">Doc Number</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Item & Location</th>
                  <th className="pb-2 font-medium text-right">Quantity</th>
                  <th className="pb-2 font-medium text-right">Unit Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {recentMovements.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                    <td className="py-2.5 font-mono text-[11px] font-medium text-slate-900 dark:text-zinc-200">
                      {tx.document_number}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          tx.type === "RECEIPT"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : tx.type === "ISSUE"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="font-medium text-slate-800 dark:text-zinc-200">{tx.item}</div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500">{tx.location}</div>
                    </td>
                    <td className={`py-2.5 text-right font-medium tabular-nums ${tx.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-zinc-200"}`}>
                      {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity} {tx.unit}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-400">
                      ${tx.unit_cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operational Replenishment / Stock Alerts */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Stock Replenishment Alerts
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
              4 Critical
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-zinc-200">
                <span>Hydraulic Solenoid Valve 24V</span>
                <span className="text-amber-600 dark:text-amber-400">12 / 25 Min</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: "48%" }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                <span>Reorder Qty: 40 EA</span>
                <button className="text-blue-600 font-medium hover:underline">Draft Order</button>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-zinc-200">
                <span>Optical Rotary Encoder 1024 PPR</span>
                <span className="text-rose-600 dark:text-rose-400">0 / 15 Min</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: "0%" }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                <span className="text-rose-600 font-semibold">OUT OF STOCK</span>
                <button className="text-blue-600 font-medium hover:underline">Draft Order</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
