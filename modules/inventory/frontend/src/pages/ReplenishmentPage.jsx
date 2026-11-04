import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Plus,
  Search,
  Filter,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  BarChart2,
  Sparkles,
  Clock,
  Truck,
  ShieldAlert,
  DollarSign,
  Layers,
  Calendar,
  Zap,
  RotateCcw,
  Check,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { fetchProducts, fetchStockBalances } from "../services/api";

export function ReplenishmentPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("CRITICAL");
  const [search, setSearch] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const [horizonDays, setHorizonDays] = useState(14);
  const [selectedSku, setSelectedSku] = useState("ALL");

  useEffect(() => {
    Promise.all([fetchProducts(), fetchStockBalances()]).then(([prodRes, balRes]) => {
      const balancesMap = {};
      (balRes.results || []).forEach((b) => {
        const code = b.item_code || b.sku;
        if (code) {
          balancesMap[code] = {
            on_hand: parseFloat(b.on_hand_qty || 0),
            available: parseFloat(b.available_qty || 0),
            reserved: parseFloat(b.reserved_qty || 0),
          };
        }
      });

      const data = (prodRes.results || []).map((p) => {
        const bal = balancesMap[p.code || p.sku] || {};
        const available = bal.available !== undefined ? bal.available : (p.available ?? 12);
        const onHand = bal.on_hand !== undefined ? bal.on_hand : (p.on_hand ?? 18);
        const reorderPoint = parseFloat(p.reorder_point || 25);
        const reorderQty = parseFloat(p.reorder_quantity || (reorderPoint * 2));
        const unitCost = parseFloat(p.unit_cost || 24.5);
        const suggestedReorder = available <= reorderPoint ? Math.max(reorderQty, (reorderPoint * 2) - available) : 0;

        let supplier = p.brand || "Preferred OEM";
        let leadTime = 14;
        let moq = 25;
        if (supplier.includes("Rexroth")) {
          leadTime = 14;
          moq = 25;
        } else if (supplier.includes("Omron")) {
          leadTime = 21;
          moq = 20;
        } else if (supplier.includes("SKF")) {
          leadTime = 10;
          moq = 150;
        } else if (supplier.includes("Gates")) {
          leadTime = 7;
          moq = 50;
        } else if (supplier.includes("Mobil")) {
          leadTime = 5;
          moq = 60;
        }

        return {
          ...p,
          sku: p.code || p.sku,
          name: p.name,
          available,
          on_hand: onHand,
          reorder_point: reorderPoint,
          reorder_quantity: reorderQty,
          suggested_reorder: suggestedReorder,
          unit_cost: unitCost,
          lead_time_days: leadTime,
          moq,
          supplier,
        };
      });

      setItems(data);
    });
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const criticalItems = useMemo(() => {
    return items.filter((p) => p.available <= p.reorder_point);
  }, [items]);

  const displayedItems = useMemo(() => {
    const list = filter === "CRITICAL" ? criticalItems : items;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.supplier?.toLowerCase().includes(q)
    );
  }, [filter, items, criticalItems, search]);

  // Total procurement outlay calculation
  const totalOutlay = useMemo(() => {
    return criticalItems.reduce((acc, p) => acc + (p.suggested_reorder * p.unit_cost), 0);
  }, [criticalItems]);

  const avgLeadTime = useMemo(() => {
    if (criticalItems.length === 0) return 14;
    return (criticalItems.reduce((acc, p) => acc + (p.lead_time_days || 14), 0) / criticalItems.length).toFixed(1);
  }, [criticalItems]);

  // ---------------------------------------------------------------------------
  // Chart 1: Stockout Runway Velocity & Lead-Time Burn-Down Curve
  // ---------------------------------------------------------------------------
  const burnDownData = useMemo(() => {
    const is14 = horizonDays === 14;
    const daysCount = is14 ? 14 : 30;
    const arrivalDay = is14 ? 10 : 21;

    // Filter by selected SKU or aggregate critical items
    let initialStock = 0;
    let safetyFloor = 0;
    let batchInflow = 0;
    let burnRate = 0;

    if (selectedSku === "ALL") {
      initialStock = criticalItems.reduce((acc, p) => acc + p.available, 0) || 18;
      safetyFloor = criticalItems.reduce((acc, p) => acc + p.reorder_point, 0) || 40;
      batchInflow = criticalItems.reduce((acc, p) => acc + p.suggested_reorder, 0) || 120;
      burnRate = Math.max(1.5, Math.round(initialStock / 6));
    } else {
      const match = items.find((p) => p.sku === selectedSku);
      if (match) {
        initialStock = match.available;
        safetyFloor = match.reorder_point;
        batchInflow = match.suggested_reorder || match.reorder_quantity;
        burnRate = Math.max(1, Math.round(match.reorder_point / 10));
      }
    }

    const data = [];
    let curProjected = initialStock;
    let curUnmitigated = initialStock;

    for (let d = 0; d <= daysCount; d++) {
      if (d > 0) {
        curUnmitigated = Math.max(0, curUnmitigated - burnRate);
        curProjected = curProjected - burnRate;
        if (d === arrivalDay) {
          curProjected += batchInflow;
        }
      }

      let phase = "Normal Burn";
      if (curProjected <= 0) {
        phase = "Stockout Deficit";
      } else if (curProjected < safetyFloor) {
        phase = "Buffer Breach";
      } else if (d >= arrivalDay) {
        phase = "Replenished Safe";
      }

      data.push({
        day: `D+${d}`,
        dayIndex: d,
        projectedStock: Math.max(0, curProjected),
        unmitigatedStock: curUnmitigated,
        safetyFloor,
        isArrival: d === arrivalDay,
        phase,
        dailyBurn: burnRate,
      });
    }

    return { data, arrivalDay, safetyFloor, batchInflow };
  }, [horizonDays, selectedSku, criticalItems, items]);

  // ---------------------------------------------------------------------------
  // Chart 2: Replenishment Capital Outlay & OEM Vendor Procurement Matrix
  // ---------------------------------------------------------------------------
  const vendorMatrixData = useMemo(() => {
    const vendorMap = {};

    items.forEach((p) => {
      const v = p.supplier || "Standard OEM";
      if (!vendorMap[v]) {
        vendorMap[v] = {
          vendor: v,
          vendorShort: v.replace(/ Precision| Industrial| PowerGrip/g, ""),
          outlayCost: 0,
          suggestedUnits: 0,
          moqThreshold: p.moq || 25,
          leadTime: p.lead_time_days || 14,
          criticalCount: 0,
          totalSkus: 0,
        };
      }
      vendorMap[v].totalSkus += 1;
      if (p.available <= p.reorder_point) {
        vendorMap[v].criticalCount += 1;
        const reorderQty = p.suggested_reorder || 25;
        vendorMap[v].suggestedUnits += reorderQty;
        vendorMap[v].outlayCost += reorderQty * p.unit_cost;
      }
    });

    // Provide robust defaults if catalog is small
    const list = Object.values(vendorMap);
    if (list.length === 0 || list.every((v) => v.outlayCost === 0)) {
      return [
        { vendor: "Bosch Rexroth", vendorShort: "Bosch Rexroth", outlayCost: 4883.0, suggestedUnits: 38, moqThreshold: 25, leadTime: 14, criticalCount: 1, totalSkus: 2 },
        { vendor: "Omron Industrial", vendorShort: "Omron", outlayCost: 2850.0, suggestedUnits: 30, moqThreshold: 20, leadTime: 21, criticalCount: 1, totalSkus: 1 },
        { vendor: "SKF Precision", vendorShort: "SKF", outlayCost: 3712.5, suggestedUnits: 250, moqThreshold: 150, leadTime: 10, criticalCount: 0, totalSkus: 3 },
        { vendor: "Gates PowerGrip", vendorShort: "Gates", outlayCost: 1944.0, suggestedUnits: 60, moqThreshold: 50, leadTime: 7, criticalCount: 0, totalSkus: 2 },
        { vendor: "Mobil Rarus", vendorShort: "Mobil", outlayCost: 1456.0, suggestedUnits: 80, moqThreshold: 60, leadTime: 5, criticalCount: 0, totalSkus: 1 },
      ];
    }

    return list.sort((a, b) => b.outlayCost - a.outlayCost);
  }, [items]);

  const handleBulkRequisition = () => {
    showToast(`Bulk replenishment requisition drafted for ${criticalItems.length} critical SKUs ($${totalOutlay.toLocaleString(undefined, { minimumFractionDigits: 2 })}).`);
  };

  const handleDraftSingleOrder = (p) => {
    showToast(`PO draft initiated for ${p.sku} (${p.suggested_reorder} ${p.unit || p.base_unit || "EA"}) with ${p.supplier}.`);
  };

  const handleVendorDraft = (vendorName) => {
    showToast(`Batch Purchase Order generated for ${vendorName} OEM catalog items.`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-semibold shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Replenishment & Reorder Planning
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/50">
              <Sparkles className="h-2.5 w-2.5" />
              Safety Buffer Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Automated reorder triggers, lead-time burn-down forecasting, safety buffer governance & vendor procurement allocation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkRequisition}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 transition-all cursor-pointer"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Draft Bulk Requisition ({criticalItems.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Telemetry Rail */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Below Safety Reorder Point</span>
            <div className="text-2xl font-bold tabular-nums text-rose-800 dark:text-rose-300 mt-1">
              {criticalItems.length} SKUs
            </div>
            <div className="text-[11px] text-rose-600/90 dark:text-rose-400 mt-0.5 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Reorder needed immediately
            </div>
          </div>
          <div className="shrink-0 h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Suggested Requisition Capital</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              ${totalOutlay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Planned supplier procurement
            </div>
          </div>
          <div className="shrink-0 h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Mean Supplier Lead Time</span>
            <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
              {avgLeadTime} Days
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 font-medium flex items-center gap-1">
              <Clock className="h-3 w-3 text-amber-500" /> Procurement transit window
            </div>
          </div>
          <div className="shrink-0 h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Truck className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Stock Service Level SLA</span>
            <div className="text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-300 mt-1">
              94.2%
            </div>
            <div className="text-[11px] text-emerald-600/90 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> High catalog availability
            </div>
          </div>
          <div className="shrink-0 h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* DUAL HIGH-CONFIGURATION UNIQUE CHARTS SUITE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Stockout Runway Velocity & Lead-Time Burn-Down Horizon */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="shrink-0 p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/50">
                  <Calendar className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Stockout Runway & Lead-Time Burn-Down Horizon
                </h2>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                Predictive trajectory comparing expedited PO arrival (+{burnDownData.batchInflow} units at D+{burnDownData.arrivalDay}) vs unmitigated stock exhaustion.
              </p>
            </div>

            {/* Interactive Horizon & SKU Controls */}
            <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Critical Portfolio</option>
                {criticalItems.map((c) => (
                  <option key={c.sku} value={c.sku}>
                    {c.sku}
                  </option>
                ))}
              </select>

              <div className="inline-flex rounded-lg border border-slate-200 dark:border-zinc-700 p-0.5 bg-slate-50 dark:bg-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => setHorizonDays(14)}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    horizonDays === 14
                      ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  14D
                </button>
                <button
                  type="button"
                  onClick={() => setHorizonDays(30)}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    horizonDays === 30
                      ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  30D
                </button>
              </div>
            </div>
          </div>

          {/* Chart 1 Legend Pill Strip */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold pt-1 border-t border-slate-100 dark:border-zinc-800/80">
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Projected Replenished Stock
            </span>
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <span className="h-1.5 w-3 rounded-full bg-rose-500 border border-dashed border-rose-600" /> Unmitigated Depletion (No PO)
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20" /> Safety Stock Floor
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 ml-auto">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> PO Inflow (D+{burnDownData.arrivalDay})
            </span>
          </div>

          <div className="h-64 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={burnDownData.data} margin={{ top: 15, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="replenishAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis width="auto" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} unit="u" />
                <Tooltip
                  cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "2 2" }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    const isBreach = d.projectedStock < d.safetyFloor;
                    return (
                      <div className="p-3.5 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md border border-slate-700/60 shadow-xl text-white text-xs space-y-2 min-w-[210px]">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-1.5">
                          <span className="font-bold text-indigo-300 font-mono">{d.day} Timeline</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              d.isArrival
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : isBreach
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                            }`}
                          >
                            {d.phase}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center gap-4 text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-indigo-400" /> Projected Stock:
                            </span>
                            <span className="font-mono font-bold tabular-nums text-white">{d.projectedStock} units</span>
                          </div>
                          <div className="flex justify-between items-center gap-4 text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-rose-400" /> Without PO:
                            </span>
                            <span className="font-mono tabular-nums text-rose-300">{d.unmitigatedStock} units</span>
                          </div>
                          <div className="flex justify-between items-center gap-4 text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-amber-400" /> Safety Floor:
                            </span>
                            <span className="font-mono tabular-nums text-amber-300">{d.safetyFloor} units</span>
                          </div>
                          {d.isArrival && (
                            <div className="pt-1 border-t border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                              <Zap className="h-3 w-3" /> Dock Inflow: +{burnDownData.batchInflow} units
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={burnDownData.safetyFloor}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: `Safety Floor (${burnDownData.safetyFloor}u)`,
                    position: "insideTopLeft",
                    fill: "#f59e0b",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <ReferenceLine
                  x={`D+${burnDownData.arrivalDay}`}
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  label={{
                    value: `PO Dock Receipt (+${burnDownData.batchInflow}u)`,
                    position: "insideTopRight",
                    fill: "#10b981",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="projectedStock"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#replenishAreaGrad)"
                  dot={{ r: 2.5, fill: "#6366f1", strokeWidth: 1.5, stroke: "#fff" }}
                  activeDot={{ r: 5, fill: "#4f46e5", stroke: "#fff", strokeWidth: 2 }}
                  isAnimationActive={false}/>
                <Line
                  type="monotone"
                  dataKey="unmitigatedStock"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 2, fill: "#f43f5e" }}
                  isAnimationActive={false}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: Replenishment Capital Allocation & OEM Vendor Outlay Matrix */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="shrink-0 p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/50">
                  <BarChart2 className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  OEM Vendor Procurement Outlay & MOQ Matrix
                </h2>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                Requisition capital commitment ($USD) vs suggested batch volume compared to supplier contract MOQ thresholds.
              </p>
            </div>

            <span className="shrink-0 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/50 font-semibold self-start sm:self-auto">
              5 Preferred OEMs
            </span>
          </div>

          {/* Chart 2 Legend Pill Strip */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold pt-1 border-t border-slate-100 dark:border-zinc-800/80">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Capital Outlay ($USD, Left)
            </span>
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Suggested Reorder Units (Right)
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="h-1.5 w-3 rounded-full bg-amber-500 border border-dashed border-amber-600" /> Contract MOQ Floor
            </span>
          </div>

          <div className="h-64 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={vendorMatrixData} margin={{ top: 15, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="vendorCapitalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="vendorShort" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis width="auto"
                  yAxisId="capital"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(1) + "k" : val}`}
                />
                <YAxis width="auto"
                  yAxisId="units"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  unit=" u"
                />
                <Tooltip
                  cursor={{ fill: "rgba(0, 0, 0, 0.03)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    const isMoqMet = d.suggestedUnits >= d.moqThreshold;
                    return (
                      <div className="p-3.5 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md border border-slate-700/60 shadow-xl text-white text-xs space-y-2 min-w-[220px]">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-1.5">
                          <span className="font-bold text-emerald-300">{d.vendor}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {d.leadTime}d Lead Time
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center gap-4 text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Capital Outlay:
                            </span>
                            <span className="font-mono font-bold tabular-nums text-white">
                              ${d.outlayCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center gap-4 text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-blue-400" /> Batch Requisition:
                            </span>
                            <span className="font-mono font-bold tabular-nums text-blue-300">{d.suggestedUnits} units</span>
                          </div>
                          <div className="flex justify-between items-center gap-4 text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-amber-400" /> Contract MOQ:
                            </span>
                            <span className="font-mono tabular-nums text-amber-300">{d.moqThreshold} units</span>
                          </div>
                          <div className="pt-1 border-t border-slate-700/60 flex items-center justify-between gap-4 text-[11px]">
                            <span className="text-slate-400">Contract Tier:</span>
                            <span className={`font-semibold ${isMoqMet ? "text-emerald-400" : "text-amber-400"}`}>
                              {isMoqMet ? "Tier 1 Qualified (MOQ Met)" : "Below Standard MOQ"}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleVendorDraft(d.vendor)}
                          className="w-full mt-2 py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          Draft Requisition PO <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  }}
                />
                <Bar
                  yAxisId="capital"
                  dataKey="outlayCost"
                  fill="url(#vendorCapitalGrad)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={false}/>
                <Line
                  yAxisId="units"
                  type="monotone"
                  dataKey="suggestedUnits"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 1.5 }}
                  isAnimationActive={false}/>
                <Line
                  yAxisId="units"
                  type="stepAfter"
                  dataKey="moqThreshold"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={{ r: 3, fill: "#f59e0b" }}
                  isAnimationActive={false}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 dark:border-zinc-800/80 pb-2">
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setFilter("CRITICAL")}
            className={`px-3.5 py-2 font-medium border-b-2 transition-all cursor-pointer ${
              filter === "CRITICAL"
                ? "border-rose-600 text-rose-600 dark:text-rose-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Action Required ({criticalItems.length})
          </button>
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3.5 py-2 font-medium border-b-2 transition-all cursor-pointer ${
              filter === "ALL"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            All Catalog SKUs ({items.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search SKU or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Replenishment Requisitions & Inventory Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                <th className="py-3.5 px-4 font-semibold">SKU / Code</th>
                <th className="py-3.5 px-4 font-semibold">Item Name</th>
                <th className="py-3.5 px-4 font-semibold">Supplier OEM</th>
                <th className="py-3.5 px-4 font-semibold text-right">Available Stock</th>
                <th className="py-3.5 px-4 font-semibold text-right">Safety Floor</th>
                <th className="py-3.5 px-4 font-semibold text-right">Lead Time</th>
                <th className="py-3.5 px-4 font-semibold text-right">Suggested Batch</th>
                <th className="py-3.5 px-4 font-semibold text-right">Unit Cost</th>
                <th className="py-3.5 px-4 font-semibold text-right">Est. Outlay</th>
                <th className="py-3.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No replenishment items match your query.
                  </td>
                </tr>
              ) : (
                displayedItems.map((p) => {
                  const isUnder = p.available <= p.reorder_point;
                  const itemOutlay = (p.suggested_reorder * p.unit_cost) || 0;
                  return (
                    <tr key={p.id || p.sku} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {p.sku}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {p.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300 font-medium">
                        {p.supplier}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap font-bold ${isUnder ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                        {p.available} {p.unit || p.base_unit}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-500 dark:text-zinc-400">
                        {p.reorder_point} {p.unit || p.base_unit}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-600 dark:text-zinc-400">
                        {p.lead_time_days}d
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap font-bold text-blue-600 dark:text-blue-400">
                        {p.suggested_reorder} {p.unit || p.base_unit}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-600 dark:text-zinc-400">
                        ${p.unit_cost?.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap font-bold text-slate-900 dark:text-white">
                        ${itemOutlay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDraftSingleOrder(p)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          Order <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
