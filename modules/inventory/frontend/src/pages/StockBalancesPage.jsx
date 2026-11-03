import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Boxes,
  Search,
  Filter,
  Download,
  ArrowUpDown,
  Warehouse,
  ShieldAlert,
  CheckCircle2,
  Layers,
  Activity,
  CheckCircle,
  AlertTriangle,
  Zap,
  Scan,
  Barcode,
  Eye,
  X,
  Package,
  Camera,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
  ReferenceLine,
} from "recharts";
import {
  fetchStockBalances,
  fetchProducts,
  playScanBeep,
  lookupProductByBarcode,
} from "../services/api";

export function StockBalancesPage() {
  const navigate = useNavigate();
  const [balances, setBalances] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [toastMessage, setToastMessage] = useState(null);

  // Barcode Scanner & Details Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);

  useEffect(() => {
    fetchStockBalances().then((res) => setBalances(res.results || []));
    fetchProducts().then((res) => setProducts(res.results || res || []));
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      const key = p.sku || p.code || p.id;
      if (key) map[key] = p;
    });
    return map;
  }, [products]);

  const warehousesList = useMemo(() => {
    const set = new Set();
    balances.forEach((b) => {
      const w = b.warehouse_name || b.warehouse;
      if (w) set.add(w);
    });
    return Array.from(set);
  }, [balances]);

  const categoriesList = useMemo(() => {
    const set = new Set();
    balances.forEach((b) => {
      const c = b.category_name || b.category;
      if (c) set.add(c);
    });
    return Array.from(set);
  }, [balances]);

  const locationsList = useMemo(() => {
    const set = new Set();
    balances.forEach((b) => {
      const l = b.location_name || b.location_code || b.location;
      if (l) set.add(l);
    });
    return Array.from(set);
  }, [balances]);

  const handleExecuteScan = (rawCode) => {
    const clean = rawCode?.trim();
    if (!clean) return;

    // First try lookup in products catalog
    const matchedProduct = lookupProductByBarcode(clean, products);
    // Also try finding in balances
    const matchedBalance = balances.find((b) =>
      b.item_code?.toLowerCase() === clean.toLowerCase() ||
      b.sku?.toLowerCase() === clean.toLowerCase() ||
      b.item_name?.toLowerCase().includes(clean.toLowerCase()) ||
      b.product_name?.toLowerCase().includes(clean.toLowerCase()) ||
      (matchedProduct && (b.item_code?.toLowerCase() === matchedProduct.sku?.toLowerCase() || b.sku?.toLowerCase() === matchedProduct.sku?.toLowerCase()))
    );

    if (matchedProduct || matchedBalance) {
      playScanBeep();
      const code = matchedProduct?.sku || matchedBalance?.sku || matchedBalance?.item_code;
      const prod = matchedProduct || productMap[code] || {};
      const bal = matchedBalance || balances.find((b) => b.sku === code || b.item_code === code) || {};

      setSelectedDetail({
        sku: code,
        name: prod.name || bal.product_name || bal.item_name || "Catalog Product",
        barcode: prod.barcode || clean,
        warehouse: bal.warehouse_name || "Main Central Hub",
        location: bal.location_name || bal.location_code || "A3-RB",
        bin: bal.bin_name || "Default Bin",
        on_hand: bal.total_stock ?? bal.on_hand_qty ?? prod.on_hand ?? 0,
        reserved: bal.reserved_stock ?? bal.reserved_qty ?? prod.reserved ?? 0,
        blocked: bal.damaged_stock ?? bal.blocked_qty ?? 0,
        available: bal.available_stock ?? bal.available_qty ?? prod.available ?? 0,
        unit: bal.unit || prod.unit || "EA",
        unit_cost: prod.unit_cost || 14.85,
        category: bal.category_name || prod.category || "Mechanical Components",
        brand: prod.brand || "OEM Standard",
        reorder_point: prod.reorder_point || 50,
      });

      setSearch(code || clean);
      setIsScannerOpen(false);
      setScannerInput("");
      showToast(`Scanned: ${prod.name || bal.product_name || bal.item_name} (${code})`);
    } else {
      showToast(`No stock balance or catalog item for barcode "${clean}".`);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && search.trim()) {
      e.preventDefault();
      handleExecuteScan(search);
    }
  };

  const filtered = balances.filter((b) => {
    const matchesWh = warehouseFilter === "ALL" || (b.warehouse_name || b.warehouse) === warehouseFilter;
    const matchesCat = categoryFilter === "ALL" || (b.category_name || b.category) === categoryFilter;
    const matchesLoc = locationFilter === "ALL" || (b.location_name || b.location_code || b.location) === locationFilter;
    const currentStatus = b.stock_status || (Number(b.available_stock ?? b.available_qty ?? 0) <= 0 ? "Out of Stock" : Number(b.available_stock ?? b.available_qty ?? 0) <= 20 ? "Low Stock" : "In Stock");
    const matchesStatus = statusFilter === "ALL" || currentStatus === statusFilter;
    const q = search.trim().toLowerCase();
    const productForCode = productMap[b.sku || b.item_code];
    const matchesSearch =
      !q ||
      b.product_name?.toLowerCase().includes(q) ||
      b.item_name?.toLowerCase().includes(q) ||
      b.sku?.toLowerCase().includes(q) ||
      b.item_code?.toLowerCase().includes(q) ||
      (b.location_name && b.location_name.toLowerCase().includes(q)) ||
      (b.bin_name && b.bin_name.toLowerCase().includes(q)) ||
      (b.barcode && String(b.barcode).toLowerCase().includes(q)) ||
      (productForCode?.barcode && String(productForCode.barcode).toLowerCase().includes(q));
    return matchesWh && matchesCat && matchesLoc && matchesStatus && matchesSearch;
  });

  const totalProducts = new Set(filtered.map((b) => b.sku || b.item_code)).size;
  const totalStockQty = filtered.reduce((acc, b) => acc + Number(b.total_stock !== undefined ? b.total_stock : (b.on_hand_qty || 0)), 0);
  const totalOnHand = totalStockQty;
  const totalReserved = filtered.reduce((acc, b) => acc + Number(b.reserved_stock !== undefined ? b.reserved_stock : (b.reserved_qty || 0)), 0);
  const totalDamaged = filtered.reduce((acc, b) => acc + Number(b.damaged_stock !== undefined ? b.damaged_stock : (b.blocked_qty || 0)), 0);
  const totalAvailable = filtered.reduce((acc, b) => acc + Number(b.available_stock !== undefined ? b.available_stock : (b.available_qty || 0)), 0);
  const lowStockCount = filtered.filter((b) => {
    const avail = Number(b.available_stock !== undefined ? b.available_stock : (b.available_qty || 0));
    return b.stock_status === "Low Stock" || (avail > 0 && avail <= 20);
  }).length;
  const outOfStockCount = filtered.filter((b) => {
    const avail = Number(b.available_stock !== undefined ? b.available_stock : (b.available_qty || 0));
    return b.stock_status === "Out of Stock" || avail <= 0;
  }).length;

  const facilityBreakdownData = useMemo(() => {
    const facilitiesMap = {};
    balances.forEach((b) => {
      const wh = b.warehouse_name || "Main Central Hub";
      if (!facilitiesMap[wh]) {
        facilitiesMap[wh] = { facility: wh, available: 0, reserved: 0, blocked: 0 };
      }
      facilitiesMap[wh].available += b.available_qty || 0;
      facilitiesMap[wh].reserved += b.reserved_qty || 0;
      facilitiesMap[wh].blocked += b.blocked_qty || 0;
    });

    const entries = Object.values(facilitiesMap);
    if (entries.length > 0) return entries;
    return [
      { facility: "Main Central Hub", available: 1650, reserved: 120, blocked: 18 },
      { facility: "East Coast Terminal", available: 1180, reserved: 85, blocked: 0 },
      { facility: "West Coast Depot", available: 890, reserved: 45, blocked: 12 },
    ];
  }, [balances]);

  const skuBufferData = useMemo(() => {
    const metaMap = {
      "BRG-6205-2RS": { sku: "BRG-6205", name: "Industrial Ball Bearing 6205-2RS", rpoint: 100, sfloor: 50, runway: "38 days" },
      "HYD-SV-24V": { sku: "HYD-SV-24V", name: "Hydraulic Solenoid Valve 24V", rpoint: 25, sfloor: 10, runway: "5.4 days" },
      "BELT-T10-1200": { sku: "BELT-T10", name: "Timing Belt T10-1200", rpoint: 80, sfloor: 30, runway: "24 days" },
      "ENC-OPT-1024": { sku: "ENC-OPT", name: "Optical Rotary Encoder 1024", rpoint: 15, sfloor: 5, runway: "0 days (Stockout)" },
      "LUB-SYN-VG46": { sku: "LUB-VG46", name: "Compressor Lubricant VG 46", rpoint: 300, sfloor: 120, runway: "45 days" },
    };

    const result = [];
    balances.forEach((b) => {
      const code = b.item_code || "BRG-6205-2RS";
      const meta = metaMap[code] || {
        sku: code.slice(0, 8),
        name: b.item_name || code,
        rpoint: 50,
        sfloor: 20,
        runway: "15 days",
      };
      result.push({
        id: b.id,
        sku: meta.sku,
        item_name: b.item_name || meta.name,
        available: Number(b.available_qty || 0),
        on_hand: Number(b.on_hand_qty || 0),
        reserved: Number(b.reserved_qty || 0),
        reorderPoint: meta.rpoint,
        safetyFloor: meta.sfloor,
        runway: meta.runway,
      });
    });

    if (result.length > 0) return result;

    return [
      { id: "1", sku: "BRG-6205", item_name: "Industrial Ball Bearing 6205-2RS", available: 440, on_hand: 450, reserved: 10, reorderPoint: 100, safetyFloor: 50, runway: "38 days" },
      { id: "2", sku: "HYD-SV-24V", item_name: "Hydraulic Solenoid Valve 24V", available: 18, on_hand: 18, reserved: 0, reorderPoint: 25, safetyFloor: 10, runway: "5.4 days" },
      { id: "3", sku: "BELT-T10", item_name: "Timing Belt T10-1200", available: 270, on_hand: 280, reserved: 10, reorderPoint: 80, safetyFloor: 30, runway: "24 days" },
      { id: "4", sku: "ENC-OPT", item_name: "Optical Rotary Encoder 1024", available: 0, on_hand: 0, reserved: 0, reorderPoint: 15, safetyFloor: 5, runway: "0 days (Stockout)" },
      { id: "5", sku: "LUB-VG46", item_name: "Compressor Lubricant VG 46", available: 1240, on_hand: 1250, reserved: 10, reorderPoint: 300, safetyFloor: 120, runway: "45 days" },
    ];
  }, [balances]);

  const lowBufferCount = useMemo(
    () => skuBufferData.filter((d) => d.available > 0 && d.available <= d.reorderPoint).length,
    [skuBufferData]
  );
  const stockoutCount = useMemo(
    () => skuBufferData.filter((d) => d.available <= 0).length,
    [skuBufferData]
  );

  const handleExportCSV = () => {
    const headers = [
      "SKU Code",
      "Product Description",
      "Warehouse Hub",
      "Location Code",
      "Physical On-Hand",
      "Reserved Qty",
      "Blocked (QC) Qty",
      "Free Available Qty",
      "Unit",
      "Status",
    ];

    const rows = filtered.map((b) => [
      `"${b.item_code}"`,
      `"${b.item_name}"`,
      `"${b.warehouse_name}"`,
      `"${b.location_code || "A3-RB"}"`,
      b.on_hand_qty,
      b.reserved_qty,
      b.blocked_qty,
      b.available_qty,
      b.unit,
      b.available_qty <= 0 ? "OUT OF STOCK" : b.available_qty < 25 ? "LOW STOCK" : "IN STOCK",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Stock_Balances_Report_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock balances report exported as CSV.");
  };

  return (
    <div className="space-y-5">
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Real-Time Stock Balances
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Multi-facility availability matrix: On-hand, Reserved (sales locks), Blocked (quarantine), and Free Available.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Balance Sheet</span>
        </button>
      </div>

      {/* 6 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Total Products
          </div>
          <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums mt-1">
            {totalProducts.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active catalog SKUs</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Total Stock Quantity
          </div>
          <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums mt-1">
            {totalStockQty.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Physical on-hand</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Available Stock
          </div>
          <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            {totalAvailable.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Usable quantity</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Reserved Stock
          </div>
          <div className="text-xl font-bold tracking-tight text-purple-700 dark:text-purple-400 tabular-nums mt-1">
            {totalReserved.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Allocated quantity</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Low Stock Items
          </div>
          <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums mt-1">
            {lowStockCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Below safety buffer</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Out of Stock Items
          </div>
          <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400 tabular-nums mt-1">
            {outOfStockCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Zero stock level</div>
        </div>
      </div>

      {/* High-Configuration Charts: Dual Fleet Allocation & Safety Buffer Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Multi-Facility Stock State & Commitment Allocation Matrix */}
        <div className="lg:col-span-6 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Multi-Facility Stock State Allocation
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                  Stacked State
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Free Dispatchable stock vs Committed Holds vs QC Quarantine per hub.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {totalStockQty > 0 ? ((totalAvailable / totalStockQty) * 100).toFixed(1) : "100"}%
              </span>
              <span className="text-[10px] text-slate-400 block">Fleet Availability</span>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={facilityBreakdownData}
                margin={{ top: 15, right: 15, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="facility"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    const totalHub = d.available + d.reserved + d.blocked;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1.5">
                        <div className="font-semibold text-slate-200 border-b border-slate-700/60 pb-1 flex items-center justify-between gap-3">
                          <span>{d.facility}</span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {totalHub.toLocaleString()} Total EA
                          </span>
                        </div>
                        <div className="space-y-1 pt-0.5">
                          <div className="flex items-center justify-between gap-4 text-[11px]">
                            <span className="text-emerald-300 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-sm bg-emerald-500 inline-block" />
                              Free Available:
                            </span>
                            <span className="font-mono font-bold text-emerald-400">{d.available.toLocaleString()} EA</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-[11px]">
                            <span className="text-purple-300 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-sm bg-purple-500 inline-block" />
                              Committed Holds:
                            </span>
                            <span className="font-mono font-bold text-purple-300">{d.reserved.toLocaleString()} EA</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-[11px]">
                            <span className="text-amber-300 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-sm bg-amber-500 inline-block" />
                              QC Blocked:
                            </span>
                            <span className="font-mono font-bold text-amber-300">{d.blocked.toLocaleString()} EA</span>
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
                <Bar
                  dataKey="available"
                  name="Free Available"
                  stackId="state"
                  fill="#10b981"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="reserved"
                  name="Committed Holds"
                  stackId="state"
                  fill="#8b5cf6"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="blocked"
                  name="QC Quarantine"
                  stackId="state"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: SKU Safety Buffer vs Reorder Point (ROP) Threshold Matrix */}
        <div className="lg:col-span-6 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  SKU Safety Buffer vs Reorder Point (ROP)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                  Buffer & ROP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Available stock plotted against Reorder Point (amber) and Critical Safety Floor (red).
              </p>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div>
                <span className="text-xs font-mono font-bold text-amber-500">
                  {lowBufferCount} Reorder
                </span>
                <span className="text-[10px] text-slate-400 block">&le; ROP Point</span>
              </div>
              <div>
                <span
                  className={`text-xs font-mono font-bold ${
                    stockoutCount === 0 ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {stockoutCount} Outage
                </span>
                <span className="text-[10px] text-slate-400 block">Stockouts</span>
              </div>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={skuBufferData}
                margin={{ top: 15, right: 15, left: -20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="sku"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                  angle={-15}
                  textAnchor="end"
                  height={35}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    const isStockout = d.available <= 0;
                    const isBelowSafety = d.available > 0 && d.available <= d.safetyFloor;
                    const isBelowROP = d.available > d.safetyFloor && d.available <= d.reorderPoint;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-1">
                          <span className="font-mono text-xs font-bold text-blue-400">{d.sku}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isStockout
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : isBelowSafety
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : isBelowROP
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            }`}
                          >
                            {isStockout
                              ? "OUT OF STOCK"
                              : isBelowSafety
                              ? "BELOW SAFETY FLOOR"
                              : isBelowROP
                              ? "REORDER REQUIRED"
                              : "HEALTHY BUFFER"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 font-medium">{d.item_name}</div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Free Available:</span>
                            <span className="font-mono font-bold text-white">{d.available} EA</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Total On-Hand:</span>
                            <span className="font-mono text-slate-300">{d.on_hand} EA</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Reorder Point (ROP):</span>
                            <span className="font-mono text-amber-400">{d.reorderPoint} EA</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Safety Floor:</span>
                            <span className="font-mono text-rose-400">{d.safetyFloor} EA</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-700/60 pt-1 text-[11px]">
                          <span className="text-slate-400">Estimated Runway:</span>
                          <span className="font-mono font-bold text-indigo-300">{d.runway}</span>
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
                <Bar
                  dataKey="available"
                  name="Available Units"
                  radius={[4, 4, 0, 0]}
                >
                  {skuBufferData.map((entry) => (
                    <Cell
                      key={`cell-${entry.id}`}
                      fill={
                        entry.available <= entry.safetyFloor
                          ? "#f43f5e"
                          : entry.available <= entry.reorderPoint
                          ? "#f59e0b"
                          : "#10b981"
                      }
                    />
                  ))}
                </Bar>
                <Line
                  type="stepAfter"
                  dataKey="reorderPoint"
                  name="Reorder Point (ROP)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: "#f59e0b" }}
                />
                <Line
                  type="stepAfter"
                  dataKey="safetyFloor"
                  name="Safety Floor"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  dot={{ r: 2.5, fill: "#ef4444" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stock Availability & Liquidity Health Rail */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Free Stock Liquidity</span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {totalStockQty > 0 ? ((totalAvailable / totalStockQty) * 100).toFixed(1) : "100"}%
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
              High Liquidity
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-emerald-500 h-full rounded-full"
              style={{ width: `${totalStockQty > 0 ? (totalAvailable / totalStockQty) * 100 : 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Uncommitted inventory immediately deliverable for order picking.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Allocation Lock Pressure</span>
            <Layers className="h-4 w-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
              {totalStockQty > 0 ? ((totalReserved / totalStockQty) * 100).toFixed(1) : "0.0"}%
            </span>
            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded">
              Sales Committed
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-purple-600 h-full rounded-full"
              style={{ width: `${totalStockQty > 0 ? (totalReserved / totalStockQty) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Units reserved for B2B contracts & open manufacturing orders.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-linear-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-bold">Replenishment Health</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
              {lowBufferCount + stockoutCount} Action Triggers
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1.5">
            Automated purchase reorder generated for <span className="font-semibold text-slate-900 dark:text-white">HYD-SV-24V</span>. Stockout expediting active for <span className="font-semibold text-slate-900 dark:text-white">ENC-OPT-1024</span>.
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Filter by Product Name or SKU..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setIsScannerOpen(true);
              setScannerInput("");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-semibold cursor-pointer transition-colors shadow-xs shrink-0"
            title="Scan Barcode to View Stock Balances & Specs"
          >
            <Scan className="h-3.5 w-3.5" />
            <span>Scan Barcode</span>
          </button>
        </div>

        {/* 4 Dropdown Filters: Warehouse, Category, Location, Stock Status */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Warehouse Filter */}
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/60 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Warehouses</option>
            {warehousesList.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/60 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categoriesList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Location Filter */}
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/60 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Locations</option>
            {locationsList.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {/* Stock Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/60 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Stock Details Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">Product Name</th>
                <th className="py-3.5 px-3 font-semibold">SKU</th>
                <th className="py-3.5 px-3 font-semibold">Warehouse</th>
                <th className="py-3.5 px-3 font-semibold">Storage Location</th>
                <th className="py-3.5 px-3 font-semibold">Bin</th>
                <th className="py-3.5 px-3 font-semibold text-right">Total Stock</th>
                <th className="py-3.5 px-3 font-semibold text-right">Reserved Stock</th>
                <th className="py-3.5 px-3 font-semibold text-right">Available Stock</th>
                <th className="py-3.5 px-3 font-semibold text-right">Damaged Stock</th>
                <th className="py-3.5 px-3 text-center">Stock Status</th>
                <th className="py-3.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No stock records matching the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const total = Number(b.total_stock !== undefined ? b.total_stock : (b.on_hand_qty || 0));
                  const reserved = Number(b.reserved_stock !== undefined ? b.reserved_stock : (b.reserved_qty || 0));
                  const available = Number(b.available_stock !== undefined ? b.available_stock : (b.available_qty || 0));
                  const damaged = Number(b.damaged_stock !== undefined ? b.damaged_stock : (b.blocked_qty || 0));
                  const status = b.stock_status || (available <= 0 ? "Out of Stock" : available <= 20 ? "Low Stock" : "In Stock");

                  return (
                    <tr key={b.id || b.sku} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {b.product_name || b.item_name}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                          {b.sku || b.item_code}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-zinc-300 font-medium">
                        {b.warehouse_name || b.warehouse || "Main Central Hub"}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                        {b.location_name || b.location_code || b.location || "Aisle 1"}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                        {b.bin_name || b.bin_code || b.bin || "—"}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {total} {b.unit || "EA"}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums font-medium text-purple-600 dark:text-purple-400">
                        {reserved} {b.unit || "EA"}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        {available} {b.unit || "EA"}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums font-medium text-amber-600 dark:text-amber-400">
                        {damaged} {b.unit || "EA"}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            status === "Out of Stock"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                              : status === "Low Stock"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            status === "Out of Stock" ? "bg-rose-500" : status === "Low Stock" ? "bg-amber-500" : "bg-emerald-500"
                          }`} />
                          {status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleExecuteScan(b.sku || b.item_code)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors cursor-pointer"
                          title="Inspect Product & Barcode Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
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
                    Stock Balance Barcode Scanner
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse" />
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Scan any product barcode or SKU to inspect facility balances and specifications.
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
                    Align Barcode within Scanning Viewfinder
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
                  Scan Barcode or Enter Barcode / SKU:
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
                    Inspect
                  </button>
                </div>
              </form>

              {/* Quick Barcode Test Deck */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-blue-500" /> Quick-Test Catalog Barcodes:
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

      {/* Scanned Product Details Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-start justify-between bg-slate-50/50 dark:bg-zinc-900/50">
              <div className="flex items-start gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      {selectedDetail.sku}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        selectedDetail.available > 0
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {selectedDetail.available > 0 ? "IN STOCK" : "OUT OF STOCK"}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedDetail.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {selectedDetail.category} • {selectedDetail.brand}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 text-xs">
              {/* Barcode Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-xs">
                    <Barcode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Primary Barcode (EAN-13 / GS1)
                    </span>
                    <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {selectedDetail.barcode || selectedDetail.sku}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Grade A Verified
                </span>
              </div>

              {/* Balances Telemetry Strip */}
              <div className="grid grid-cols-4 gap-2.5 text-center">
                <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
                  <span className="text-[10px] text-slate-400 block font-medium">On-Hand</span>
                  <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5 block tabular-nums">
                    {selectedDetail.on_hand}
                  </span>
                  <span className="text-[9px] text-slate-400">{selectedDetail.unit}</span>
                </div>
                <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
                  <span className="text-[10px] text-slate-400 block font-medium">Available</span>
                  <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block tabular-nums">
                    {selectedDetail.available}
                  </span>
                  <span className="text-[9px] text-slate-400">{selectedDetail.unit}</span>
                </div>
                <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
                  <span className="text-[10px] text-slate-400 block font-medium">Reserved</span>
                  <span className="text-base font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5 block tabular-nums">
                    {selectedDetail.reserved}
                  </span>
                  <span className="text-[9px] text-slate-400">{selectedDetail.unit}</span>
                </div>
                <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
                  <span className="text-[10px] text-slate-400 block font-medium">Blocked QC</span>
                  <span className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5 block tabular-nums">
                    {selectedDetail.blocked}
                  </span>
                  <span className="text-[9px] text-slate-400">{selectedDetail.unit}</span>
                </div>
              </div>

              {/* Warehouse & Location Specs */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <div>
                  <span className="text-slate-400 block text-[10px]">Assigned Facility:</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 block mt-0.5">
                    {selectedDetail.warehouse}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Storage Bin / Rack:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 block mt-0.5">
                    {selectedDetail.location}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">WAV Unit Valuation:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                    ${Number(selectedDetail.unit_cost).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Total Holding Capital:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400 block mt-0.5">
                    ${(Number(selectedDetail.on_hand) * Number(selectedDetail.unit_cost)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 px-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                System Status: Active Registered Catalog
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDetail(null);
                    navigate(`/inventory/products?sku=${encodeURIComponent(selectedDetail.sku)}`);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold cursor-pointer transition-colors"
                >
                  View Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
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

export const StockOverviewPage = StockBalancesPage;
