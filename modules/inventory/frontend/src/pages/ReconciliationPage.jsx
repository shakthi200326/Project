import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Plus,
  Download,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Save,
  Check,
  Search,
  RefreshCw,
  Warehouse,
  History,
  FileSpreadsheet,
  X,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Scale,
  Scan,
  Barcode,
  Camera,
  Sparkles,
  Package,
  Eye,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from "recharts";
import {
  fetchReconciliationCounts,
  createStockCount,
  reconcileStockCount,
  fetchWarehouses,
  fetchProducts,
  playScanBeep,
  lookupProductByBarcode,
} from "@/services/api";

export function ReconciliationPage() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCountId, setActiveCountId] = useState("cnt-1");
  const [showNewCountModal, setShowNewCountModal] = useState(false);
  const [postingAdjustment, setPostingAdjustment] = useState(false);
  const [reconciledState, setReconciledState] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Barcode Scanner & Line Inspection State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const [scannedLineDetail, setScannedLineDetail] = useState(null);

  // New Count Form
  const [newCountForm, setNewCountForm] = useState({
    count_number: `CC-${new Date().getFullYear()}-Q4-${Math.floor(10 + Math.random() * 90)}`,
    warehouse: "WH-MAIN",
    warehouse_name: "Main Central Fulfillment Hub",
    count_type: "CYCLE_A_ITEMS",
    notes: "Mandatory Q4 Physical Stock Count Audit",
  });

  // Active line items state (allows inline physical counting adjustments)
  const [activeCountLines, setActiveCountLines] = useState([
    {
      id: "line-1",
      sku: "BRG-6205-2RS",
      item: "Industrial Ball Bearing 6205-2RS",
      location: "Aisle 3 - Rack B",
      snapshot_qty: 450,
      counted_qty: 448,
      unit: "EA",
      unit_cost: 14.85,
    },
    {
      id: "line-2",
      sku: "HYD-SV-24V",
      item: "Hydraulic Solenoid Valve 24V DC",
      location: "Aisle 1 - Bin 4",
      snapshot_qty: 18,
      counted_qty: 18,
      unit: "EA",
      unit_cost: 128.50,
    },
    {
      id: "line-3",
      sku: "BELT-T10-1200",
      item: "Polyurethane Timing Belt T10-1200",
      location: "Bay 2",
      snapshot_qty: 280,
      counted_qty: 282,
      unit: "EA",
      unit_cost: 32.40,
    },
    {
      id: "line-4",
      sku: "ENC-OPT-1024",
      item: "Optical Rotary Encoder 1024 PPR",
      location: "Aisle 1 - Bin 4",
      snapshot_qty: 0,
      counted_qty: 0,
      unit: "EA",
      unit_cost: 95.00,
    },
    {
      id: "line-5",
      sku: "LUB-SYN-VG46",
      item: "Synthetic Compressor Lubricant ISO VG 46",
      location: "Chemical Vault",
      snapshot_qty: 1250,
      counted_qty: 1245,
      unit: "LTR",
      unit_cost: 18.20,
    },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [countsData, whData, prodsData] = await Promise.all([
        fetchReconciliationCounts(),
        fetchWarehouses(),
        fetchProducts(),
      ]);
      setCounts(countsData.results || countsData || []);
      setWarehouses(whData || []);
      setProducts(prodsData.results || prodsData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const productMap = React.useMemo(() => {
    const map = {};
    products.forEach((p) => {
      const key = p.sku || p.code || p.id;
      if (key) map[key] = p;
    });
    return map;
  }, [products]);

  const handleExecuteScan = (rawCode) => {
    const clean = rawCode?.trim();
    if (!clean) return;

    const matchedProduct = lookupProductByBarcode(clean, products);
    const targetSku = matchedProduct ? matchedProduct.sku : clean;
    const line = activeCountLines.find(
      (l) =>
        l.sku?.toLowerCase() === targetSku?.toLowerCase() ||
        l.item?.toLowerCase().includes(clean.toLowerCase())
    );

    if (line) {
      playScanBeep();
      setScannedLineDetail({ line, product: matchedProduct || productMap[line.sku] || {} });
      setSearchTerm(line.sku);
      setIsScannerOpen(false);
      setScannerInput("");
      showToast(`Scanned audit line: ${line.item} (${line.sku})`);
    } else {
      showToast(`No audit line found for barcode "${clean}".`);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchTerm.trim()) {
      e.preventDefault();
      handleExecuteScan(searchTerm);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCountChange = (lineId, val) => {
    const num = val === "" ? 0 : parseFloat(val);
    setActiveCountLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, counted_qty: isNaN(num) ? 0 : num } : line))
    );
  };

  const handlePostReconciliation = async () => {
    setPostingAdjustment(true);
    try {
      await reconcileStockCount(activeCountId);
      setReconciledState(true);
      showToast("Audited stock variances posted successfully! Ledger adjustments logged.");
    } catch (e) {
      showToast("Reconciliation adjustment executed (Demo offline fallback mode).");
      setReconciledState(true);
    } finally {
      setPostingAdjustment(false);
    }
  };

  const handleCreateCount = async (e) => {
    e.preventDefault();
    const created = await createStockCount({
      ...newCountForm,
      total_lines: activeCountLines.length,
    });
    setCounts((prev) => [created, ...prev]);
    setActiveCountId(created.id);
    setShowNewCountModal(false);
    setReconciledState(false);
    showToast(`New cycle count session ${newCountForm.count_number} opened.`);
  };

  const exportDiscrepancies = () => {
    const headers = ["SKU", "Item Name", "Location", "Snapshot Qty", "Counted Qty", "Variance Qty", "Unit Cost ($)", "Valuation Impact ($)"];
    const rows = activeCountLines.map((l) => {
      const diff = l.counted_qty - l.snapshot_qty;
      const impact = (diff * l.unit_cost).toFixed(2);
      return [
        `"${l.sku}"`,
        `"${l.item}"`,
        `"${l.location}"`,
        l.snapshot_qty,
        l.counted_qty,
        diff,
        l.unit_cost.toFixed(2),
        impact,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Discrepancies_${activeCountId}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Discrepancies report downloaded as CSV.");
  };

  const filteredLines = activeCountLines.filter((l) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    const prod = productMap[l.sku];
    return (
      l.sku.toLowerCase().includes(q) ||
      l.item.toLowerCase().includes(q) ||
      l.location.toLowerCase().includes(q) ||
      (prod?.barcode && String(prod.barcode).toLowerCase().includes(q))
    );
  });

  const totalVarianceValue = activeCountLines.reduce((acc, l) => {
    return acc + (Number(l.counted_qty) - Number(l.snapshot_qty)) * l.unit_cost;
  }, 0);

  const totalLinesWithVariance = activeCountLines.filter(
    (l) => Number(l.counted_qty) !== Number(l.snapshot_qty)
  ).length;

  const varianceChartData = activeCountLines.map((line) => {
    const varianceQty = Number(line.counted_qty) - Number(line.snapshot_qty);
    const valueImpact = varianceQty * line.unit_cost;
    return {
      id: line.id,
      sku: line.sku,
      item: line.item,
      location: line.location,
      snapshot_qty: Number(line.snapshot_qty),
      counted_qty: Number(line.counted_qty),
      varianceQty,
      valueImpact,
      unit: line.unit,
      unit_cost: line.unit_cost,
    };
  });

  const totalShrinkageVal = activeCountLines.reduce((acc, l) => {
    const delta = Number(l.counted_qty) - Number(l.snapshot_qty);
    return delta < 0 ? acc + Math.abs(delta) * l.unit_cost : acc;
  }, 0);

  const totalSurplusVal = activeCountLines.reduce((acc, l) => {
    const delta = Number(l.counted_qty) - Number(l.snapshot_qty);
    return delta > 0 ? acc + delta * l.unit_cost : acc;
  }, 0);

  const toleranceBreachCount = activeCountLines.filter(
    (l) => Math.abs(Number(l.counted_qty) - Number(l.snapshot_qty)) > 2
  ).length;

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
              Stock Reconciliation & Audits
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
              Audit Standard ISO 9001
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Snapshot cycle count management, physical variance discovery, and dual-entry ledger adjustments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportDiscrepancies}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Discrepancies</span>
          </button>
          <button
            onClick={() => setShowNewCountModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Initiate New Count Cycle</span>
          </button>
        </div>
      </div>

      {/* Active Session Overview Banner */}
      <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs font-bold">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  CC-2026-Q4-01
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    reconciledState
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {reconciledState ? "POSTED & RECONCILED" : "IN REVIEW / PENDING POST"}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">
                Facility: Main Central Fulfillment Hub (WH-MAIN) • Snapshot Timestamp: Today, 08:00 UTC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] uppercase font-bold text-slate-400">Net Valuation Variance</div>
              <div
                className={`text-sm font-bold font-mono tabular-nums ${
                  totalVarianceValue === 0
                    ? "text-slate-500"
                    : totalVarianceValue > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {totalVarianceValue > 0 ? `+$${totalVarianceValue.toFixed(2)}` : `-$${Math.abs(totalVarianceValue).toFixed(2)}`}
              </div>
            </div>

            {!reconciledState ? (
              <button
                onClick={handlePostReconciliation}
                disabled={postingAdjustment}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors"
              >
                {postingAdjustment ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Post Audited Variance Adjustment</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                <span>Adjustments Posted to Immutable Ledger</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Lines in Audit</div>
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {activeCountLines.length} Items
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Variances Detected</div>
            <div className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
              {totalLinesWithVariance} Discrepancies
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Audit Accuracy Rate</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
              {(((activeCountLines.length - totalLinesWithVariance) / activeCountLines.length) * 100).toFixed(1)}%
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Reconciliation Type</div>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5 truncate">
              Cycle Count (ABC)
            </div>
          </div>
        </div>
      </div>

      {/* High-Configuration Chart: Cycle Count Discrepancy & Shrinkage / Surplus Waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Physical Inventory Discrepancy & Shrinkage / Surplus Waterfall
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                  Diverging Variance
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Unit discrepancies (Counted Qty − Snapshot Qty) with ±2 unit audit tolerance corridor.
              </p>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  {activeCountLines.length - totalLinesWithVariance}/{activeCountLines.length}
                </span>
                <span className="text-[10px] text-slate-400 block">Exact Matches</span>
              </div>
              <div>
                <span
                  className={`text-xs font-mono font-bold ${
                    toleranceBreachCount === 0 ? "text-emerald-500" : "text-amber-500"
                  }`}
                >
                  {toleranceBreachCount} Outliers
                </span>
                <span className="text-[10px] text-slate-400 block">&gt; ±2 Units</span>
              </div>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={varianceChartData}
                margin={{ top: 20, right: 15, left: -20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="sku"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                  angle={-15}
                  textAnchor="end"
                  height={40}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                  tickFormatter={(v) => (v > 0 ? `+${v}` : `${v}`)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    const isSurplus = d.varianceQty > 0;
                    const isShrink = d.varianceQty < 0;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-1">
                          <span className="font-mono text-xs font-bold text-blue-400">{d.sku}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isSurplus
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : isShrink
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            {isSurplus ? "PHYSICAL SURPLUS" : isShrink ? "SHRINKAGE DEFICIT" : "VERIFIED BALANCED"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 font-medium">{d.item}</div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Snapshot:</span>
                            <span className="font-mono text-slate-200">{d.snapshot_qty} {d.unit}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Physical Count:</span>
                            <span className="font-mono text-slate-200">{d.counted_qty} {d.unit}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-700/60 pt-1 text-[11px]">
                          <span className="text-slate-400">Variance Delta:</span>
                          <span
                            className={`font-mono font-bold ${
                              isSurplus ? "text-emerald-400" : isShrink ? "text-rose-400" : "text-slate-300"
                            }`}
                          >
                            {isSurplus ? `+${d.varianceQty}` : d.varianceQty} {d.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Valuation Impact:</span>
                          <span
                            className={`font-mono font-bold ${
                              d.valueImpact > 0 ? "text-emerald-400" : d.valueImpact < 0 ? "text-rose-400" : "text-slate-300"
                            }`}
                          >
                            {d.valueImpact > 0 ? `+$${d.valueImpact.toFixed(2)}` : d.valueImpact < 0 ? `-$${Math.abs(d.valueImpact).toFixed(2)}` : "$0.00"}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />
                <ReferenceLine
                  y={2}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={{ value: "+2 Max Tol", position: "right", fill: "#f59e0b", fontSize: 9 }}
                />
                <ReferenceLine
                  y={-2}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={{ value: "-2 Min Tol", position: "right", fill: "#f59e0b", fontSize: 9 }}
                />
                <Bar dataKey="varianceQty" radius={[4, 4, 4, 4]}>
                  {varianceChartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.id}`}
                      fill={
                        entry.varianceQty > 0
                          ? "#10b981"
                          : entry.varianceQty < 0
                          ? "#f43f5e"
                          : "#64748b"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Audit Discrepancy Severity & Net Valuation Telemetry Rail */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3">
          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Shrinkage Loss Exposure</span>
              <div className="p-1 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                <TrendingDown className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
                -${totalShrinkageVal.toFixed(2)}
              </span>
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
                Physical Shortfall
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
              Cumulative unrecorded stock depletion or damage requiring book write-off.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Surplus Discovery Value</span>
              <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                +${totalSurplusVal.toFixed(2)}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                Recovered Stock
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
              Unregistered items discovered during scan and staged for book recovery.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-linear-to-br from-blue-500/10 via-indigo-500/5 to-transparent dark:from-blue-950/30 dark:via-zinc-900 dark:to-zinc-900 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Scale className="h-4 w-4" />
                <span className="text-xs font-bold">Net Financial Variance</span>
              </div>
              <span
                className={`text-xs font-mono font-bold ${
                  totalVarianceValue >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {totalVarianceValue >= 0 ? `+$${totalVarianceValue.toFixed(2)}` : `-$${Math.abs(totalVarianceValue).toFixed(2)}`}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1.5">
              Audit tolerance rate:{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {activeCountLines.length > 0
                  ? (((activeCountLines.length - toleranceBreachCount) / activeCountLines.length) * 100).toFixed(0)
                  : 100}
                %
              </span>{" "}
              within threshold. Double-entry journal voucher generated on post.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Table Filter Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search or scan barcode/SKU (Press Enter to locate)..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setIsScannerOpen(true);
              setScannerInput("");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-semibold cursor-pointer transition-colors shadow-xs shrink-0"
            title="Scan Barcode to Audit Item"
          >
            <Scan className="h-3.5 w-3.5" />
            <span>Scan Barcode</span>
          </button>
        </div>
        <div className="text-xs text-slate-500 dark:text-zinc-400">
          Showing {filteredLines.length} of {activeCountLines.length} audit lines
        </div>
      </div>

      {/* Lines Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">SKU Code</th>
                <th className="py-3.5 px-4 font-semibold">Item Description</th>
                <th className="py-3.5 px-4 font-semibold">Bin Location</th>
                <th className="py-3.5 px-4 font-semibold text-right">System Snapshot</th>
                <th className="py-3.5 px-4 font-semibold text-right">Physical Count</th>
                <th className="py-3.5 px-4 font-semibold text-right">Variance Qty</th>
                <th className="py-3.5 px-4 font-semibold text-right">Unit WAV</th>
                <th className="py-3.5 px-4 font-semibold text-right">Valuation Impact</th>
                <th className="py-3.5 px-4 font-semibold text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredLines.map((line) => {
                const variance = line.counted_qty - line.snapshot_qty;
                const valueImpact = variance * line.unit_cost;

                return (
                  <tr key={line.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                        {line.sku}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-zinc-100">
                      {line.item}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 font-mono">
                      {line.location}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-medium text-slate-700 dark:text-zinc-300">
                      {line.snapshot_qty} {line.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {reconciledState ? (
                        <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                          {line.counted_qty} {line.unit}
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1 justify-end">
                          <input
                            type="number"
                            step="any"
                            value={line.counted_qty}
                            onChange={(e) => handleCountChange(line.id, e.target.value)}
                            className="w-20 px-2 py-1 text-right text-xs font-bold tabular-nums rounded-lg border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-[10px] text-slate-400">{line.unit}</span>
                        </div>
                      )}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right tabular-nums font-bold ${
                        variance === 0
                          ? "text-slate-400"
                          : variance > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {variance > 0 ? `+${variance}` : variance} {line.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500">
                      ${line.unit_cost.toFixed(2)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono tabular-nums font-semibold ${
                        valueImpact === 0
                          ? "text-slate-400"
                          : valueImpact > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {valueImpact > 0 ? `+$${valueImpact.toFixed(2)}` : valueImpact < 0 ? `-$${Math.abs(valueImpact).toFixed(2)}` : "$0.00"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleExecuteScan(line.sku)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        title="Audit & Barcode Verification"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cycle Count History Section */}
      <div className="space-y-3 pt-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <History className="h-4 w-4 text-slate-400" />
          <span>Past Count Sessions & Audits</span>
        </h2>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-500">
                <th className="py-2.5 px-4 font-semibold">Count Reference</th>
                <th className="py-2.5 px-4 font-semibold">Warehouse / Facility</th>
                <th className="py-2.5 px-4 font-semibold">Date Registered</th>
                <th className="py-2.5 px-4 font-semibold text-right">Items Audited</th>
                <th className="py-2.5 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {counts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {c.count_number}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-zinc-300 font-medium">
                    {c.warehouse_name || c.warehouse}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-800 dark:text-zinc-200">
                    {c.total_lines || 36} SKUs
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.status === "RECONCILED" || c.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Count Cycle Modal */}
      {showNewCountModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Initiate New Stock Count Cycle
                </h3>
              </div>
              <button
                onClick={() => setShowNewCountModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCount} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Count Reference Number
                </label>
                <input
                  type="text"
                  required
                  value={newCountForm.count_number}
                  onChange={(e) => setNewCountForm({ ...newCountForm, count_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Target Facility / Warehouse
                </label>
                <select
                  value={newCountForm.warehouse}
                  onChange={(e) => {
                    const sel = warehouses.find((w) => w.code === e.target.value);
                    setNewCountForm({
                      ...newCountForm,
                      warehouse: e.target.value,
                      warehouse_name: sel ? sel.name : "Warehouse",
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                >
                  <option value="WH-MAIN">Main Central Fulfillment Hub (WH-MAIN)</option>
                  <option value="WH-EAST">East Coast Logistics Terminal (WH-EAST)</option>
                  <option value="WH-COLD">Cold Storage & Perishables Facility (WH-COLD)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Audit Scope Type
                </label>
                <select
                  value={newCountForm.count_type}
                  onChange={(e) => setNewCountForm({ ...newCountForm, count_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                >
                  <option value="CYCLE_A_ITEMS">High-Velocity 'A' Items (Continuous Cycle)</option>
                  <option value="FULL_WALL_TO_WALL">Wall-to-Wall Complete Physical Inventory</option>
                  <option value="ZONE_AISLE">Specific Zone / Bin Location Sweep</option>
                  <option value="EXPIRY_AUDIT">Expiring & Perishable Batch Verification</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Audit Scope Notes & Directives
                </label>
                <textarea
                  rows={2}
                  value={newCountForm.notes}
                  onChange={(e) => setNewCountForm({ ...newCountForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowNewCountModal(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors"
                >
                  Freeze Snapshot & Open Cycle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Station Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                  <Scan className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Physical Stock Count Barcode Scanner
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse" />
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Scan pallet, carton, or item barcodes during physical warehouse stock cycle sweeps.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Viewfinder Graphic */}
            <div className="p-6 space-y-4">
              <div className="relative h-44 rounded-2xl bg-slate-950 flex flex-col items-center justify-center overflow-hidden border border-slate-800 shadow-inner">
                {/* Viewfinder Corners */}
                <div className="absolute top-4 left-4 h-6 w-6 border-t-2 border-l-2 border-blue-500 rounded-tl-md" />
                <div className="absolute top-4 right-4 h-6 w-6 border-t-2 border-r-2 border-blue-500 rounded-tr-md" />
                <div className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-blue-500 rounded-bl-md" />
                <div className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-blue-500 rounded-br-md" />

                {/* Red Laser Scanning Beam */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-lg shadow-rose-500/80 animate-pulse" />

                <div className="text-center space-y-1 text-slate-300 z-10 pointer-events-none">
                  <Camera className="h-7 w-7 mx-auto text-blue-400 opacity-80" />
                  <div className="text-xs font-semibold tracking-wide">
                    Align Item Barcode or SKU Label
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Ready for Handheld Scanner or Rapid Keyboard Input
                  </div>
                </div>
              </div>

              {/* Fast Barcode Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleExecuteScan(scannerInput);
                }}
                className="space-y-2"
              >
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Scan Barcode or Enter SKU:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      autoFocus
                      type="text"
                      value={scannerInput}
                      onChange={(e) => setScannerInput(e.target.value)}
                      placeholder="e.g. 890123620501 or BRG-6205-2RS"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Locate
                  </button>
                </div>
              </form>

              {/* Quick Barcode Test Deck */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-blue-500" /> Quick-Test Audit Barcodes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { code: "890123620501", label: "Ball Bearing (890123620501)" },
                    { code: "890123240012", label: "Hydraulic Valve (890123240012)" },
                    { code: "890123120034", label: "Timing Belt (890123120034)" },
                    { code: "890123102498", label: "Encoder (890123102498)" },
                    { code: "890123460077", label: "Lubricant (890123460077)" },
                  ].map((pill) => (
                    <button
                      key={pill.code}
                      type="button"
                      onClick={() => handleExecuteScan(pill.code)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 dark:bg-zinc-800 dark:hover:bg-blue-950/60 text-slate-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-300 font-mono text-[10px] font-semibold border border-slate-200/80 dark:border-zinc-700 transition-colors cursor-pointer"
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 px-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Audio scan chime enabled
              </span>
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-semibold cursor-pointer"
              >
                Close Station
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanned Audit Item Details Modal */}
      {scannedLineDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-start justify-between bg-slate-50/50 dark:bg-zinc-900/50">
              <div className="flex items-start gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      {scannedLineDetail.line.sku}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                      {scannedLineDetail.line.location}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {scannedLineDetail.line.item}
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setScannedLineDetail(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Barcode Banner */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Barcode className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Primary Barcode</span>
                    <div className="font-mono font-bold text-slate-900 dark:text-white">
                      {scannedLineDetail.product?.barcode || scannedLineDetail.line.sku}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Audit Verified
                </span>
              </div>

              {/* Audit Counts Comparison */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
                  <span className="text-[10px] text-slate-400 block font-medium">System Snapshot</span>
                  <span className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5 block tabular-nums">
                    {scannedLineDetail.line.snapshot_qty}
                  </span>
                  <span className="text-[9px] text-slate-400">{scannedLineDetail.line.unit}</span>
                </div>
                <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
                  <span className="text-[10px] text-slate-400 block font-medium">Physical Counted</span>
                  <span className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5 block tabular-nums">
                    {scannedLineDetail.line.counted_qty}
                  </span>
                  <span className="text-[9px] text-slate-400">{scannedLineDetail.line.unit}</span>
                </div>
                <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
                  <span className="text-[10px] text-slate-400 block font-medium">Variance</span>
                  <span
                    className={`text-lg font-bold font-mono mt-0.5 block tabular-nums ${
                      scannedLineDetail.line.counted_qty - scannedLineDetail.line.snapshot_qty === 0
                        ? "text-slate-400"
                        : scannedLineDetail.line.counted_qty - scannedLineDetail.line.snapshot_qty > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {scannedLineDetail.line.counted_qty - scannedLineDetail.line.snapshot_qty > 0
                      ? `+${scannedLineDetail.line.counted_qty - scannedLineDetail.line.snapshot_qty}`
                      : scannedLineDetail.line.counted_qty - scannedLineDetail.line.snapshot_qty}
                  </span>
                  <span className="text-[9px] text-slate-400">{scannedLineDetail.line.unit}</span>
                </div>
              </div>

              {/* Adjust Count Inline Form */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
                <label className="block text-xs font-bold text-slate-800 dark:text-zinc-200">
                  Update Physical Count on Bin:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(0, scannedLineDetail.line.counted_qty - 1);
                      handleCountChange(scannedLineDetail.line.id, next);
                      setScannedLineDetail((prev) => ({
                        ...prev,
                        line: { ...prev.line, counted_qty: next },
                      }));
                    }}
                    className="h-9 w-9 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-sm"
                  >
                    -1
                  </button>
                  <input
                    type="number"
                    value={scannedLineDetail.line.counted_qty}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      handleCountChange(scannedLineDetail.line.id, val);
                      setScannedLineDetail((prev) => ({
                        ...prev,
                        line: { ...prev.line, counted_qty: val },
                      }));
                    }}
                    className="flex-1 px-3 py-1.5 text-center text-sm font-bold font-mono rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = scannedLineDetail.line.counted_qty + 1;
                      handleCountChange(scannedLineDetail.line.id, next);
                      setScannedLineDetail((prev) => ({
                        ...prev,
                        line: { ...prev.line, counted_qty: next },
                      }));
                    }}
                    className="h-9 w-9 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-sm"
                  >
                    +1
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 px-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                Valuation: ${(scannedLineDetail.line.unit_cost * scannedLineDetail.line.counted_qty).toFixed(2)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScannedLineDetail(null);
                    navigate(`/inventory/products?sku=${encodeURIComponent(scannedLineDetail.line.sku)}`);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold cursor-pointer transition-colors"
                >
                  View Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setScannedLineDetail(null)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
