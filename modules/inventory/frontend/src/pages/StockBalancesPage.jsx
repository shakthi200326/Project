import React, { useState, useEffect, useMemo } from "react";

import {

  Boxes,

  Search,

  Filter,

  Download,

  CheckCircle2,

  AlertTriangle,

  ShieldCheck,

  ShieldAlert,

  Lock,

  Layers,

  Warehouse as WarehouseIcon,

  MapPin,

  RefreshCw,

  QrCode,

  X,

  Sparkles,

  ArrowRight,

  Eye,

  SlidersHorizontal,

} from "lucide-react";

import { fetchStockBalances, fetchProducts, fetchWarehouses } from "../services/api";



export function StockBalancesPage() {

  const [balances, setBalances] = useState([]);

  const [products, setProducts] = useState([]);

  const [warehouses, setWarehouses] = useState([]);

  const [loading, setLoading] = useState(true);



  // Filters

  const [search, setSearch] = useState("");

  const [warehouseFilter, setWarehouseFilter] = useState("ALL");

  const [statusFilter, setStatusFilter] = useState("ALL");

  const [toastMessage, setToastMessage] = useState(null);



  // Scanner & Detail Modal State

  const [selectedDetail, setSelectedDetail] = useState(null);



  const showToast = (msg) => {

    setToastMessage(msg);

    setTimeout(() => setToastMessage(null), 3500);

  };



  const loadData = async () => {

    setLoading(true);

    try {

      const [balRes, prodRes, whRes] = await Promise.all([

        fetchStockBalances(),

        fetchProducts(),

        fetchWarehouses(),

      ]);

      setBalances(balRes.results || balRes || []);

      setProducts(prodRes.results || prodRes || []);

      setWarehouses(whRes.results || whRes || []);

    } catch (e) {

      console.error("Failed to load balances", e);

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

    loadData();

  }, []);



  const filtered = useMemo(() => {

    return balances.filter((b) => {

      const q = search.trim().toLowerCase();

      const matchesSearch =

        !q ||

        b.product_name?.toLowerCase().includes(q) ||

        b.item_name?.toLowerCase().includes(q) ||

        b.sku?.toLowerCase().includes(q) ||

        b.item_code?.toLowerCase().includes(q) ||

        (b.location_name && b.location_name.toLowerCase().includes(q)) ||

        (b.warehouse_name && b.warehouse_name.toLowerCase().includes(q));



      const matchesWh =

        warehouseFilter === "ALL" ||

        b.warehouse_name === warehouseFilter ||

        b.warehouse_code === warehouseFilter ||

        String(b.warehouse) === String(warehouseFilter);



      const status = b.stock_status || (b.available_stock <= 0 ? "Out of Stock" : "In Stock");

      const matchesStatus = statusFilter === "ALL" || status === statusFilter;



      return matchesSearch && matchesWh && matchesStatus;

    });

  }, [balances, search, warehouseFilter, statusFilter]);



  // Aggregate the 9 Required Stock Metrics across the active filtered set

  const metrics = useMemo(() => {

    let current = 0;

    let available = 0;

    let reserved = 0;

    let damaged = 0;

    let blocked = 0;

    let quarantined = 0;

    let safety = 0;

    let minStock = 0;

    let maxStock = 0;



    filtered.forEach((b) => {

      current += Number(b.current_stock ?? b.total_stock ?? b.on_hand_qty ?? 0);

      available += Number(b.available_stock ?? b.available_qty ?? 0);

      reserved += Number(b.reserved_stock ?? b.reserved_qty ?? 0);

      damaged += Number(b.damaged_stock ?? b.damaged_qty ?? 0);

      blocked += Number(b.blocked_stock ?? b.blocked_qty ?? 0);

      quarantined += Number(b.quarantined_stock ?? b.quarantined_qty ?? 0);

      safety += Number(b.safety_stock ?? 0);

      minStock += Number(b.min_stock ?? 0);

      maxStock += Number(b.max_stock ?? 0);

    });



    return {

      current,

      available,

      reserved,

      damaged,

      blocked,

      quarantined,

      safety,

      minStock,

      maxStock,

      count: filtered.length,

    };

  }, [filtered]);



  const handleExportCSV = () => {

    const headers = [

      "SKU",

      "Product Name",

      "Warehouse",

      "Storage Location",

      "Current Stock",

      "Available Stock",

      "Reserved Stock",

      "Damaged Stock",

      "Blocked Stock",

      "Quarantined Stock",

      "Safety Stock",

      "Minimum Stock",

      "Maximum Stock",

      "UOM",

      "Status",

    ];



    const rows = filtered.map((b) => [

      `"${b.sku || b.item_code || ""}"`,

      `"${b.product_name || b.item_name || ""}"`,

      `"${b.warehouse_name || ""}"`,

      `"${b.location_name || ""}"`,

      b.current_stock ?? b.total_stock ?? b.on_hand_qty ?? 0,

      b.available_stock ?? b.available_qty ?? 0,

      b.reserved_stock ?? b.reserved_qty ?? 0,

      b.damaged_stock ?? b.damaged_qty ?? 0,

      b.blocked_stock ?? b.blocked_qty ?? 0,

      b.quarantined_stock ?? b.quarantined_qty ?? 0,

      b.safety_stock ?? 0,

      b.min_stock ?? 0,

      b.max_stock ?? 0,

      `"${b.unit || "EA"}"`,

      `"${b.stock_status || "In Stock"}"`,

    ]);



    const csvContent =

      "data:text/csv;charset=utf-8," +

      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);

    const link = document.createElement("a");

    link.setAttribute("href", encodedUri);

    link.setAttribute(

      "download",

      `stock_overview_and_levels_${new Date().toISOString().split("T")[0]}.csv`

    );

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    showToast("Stock Overview exported as CSV.");

  };



  return (

    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">

      {toastMessage && (

        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 rounded-lg bg-emerald-600 text-white text-sm font-medium shadow-xl animate-in fade-in">

          <CheckCircle2 className="w-5 h-5" />

          <span>{toastMessage}</span>

        </div>

      )}



      {/* Header */}

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">

        <div>

          <div className="flex items-center space-x-2">

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">

              Stock Overview & Levels

            </h1>

            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">

              Stock Control

            </span>

          </div>

          <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 mt-1">

            Authoritative multi-facility inventory monitoring across all 9 operational stock classifications and configured buffers.

          </p>

        </div>



        <div className="flex flex-wrap items-center gap-2 sm:gap-3">

          <button

            onClick={loadData}

            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"

          >

            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />

            <span>Refresh</span>

          </button>

          <button

            onClick={handleExportCSV}

            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"

          >

            <Download className="w-4 h-4" />

            <span>Export CSV</span>

          </button>

        </div>

      </div>



      {/* Exactly 9 Required Stock Metrics in Enterprise Cards */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-9 gap-3">

        {/* 1. Current Stock */}

        <div className="min-h-28 flex flex-col justify-between gap-2 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20">

          <div className="min-h-8 text-[10px] leading-4 font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">

            1. Current Stock

          </div>

          <div className="text-xl font-bold tracking-tight text-blue-900 dark:text-blue-200 font-mono tabular-nums">

            {metrics.current.toLocaleString()}

          </div>

          <div className="text-[11px] leading-4 text-blue-700 dark:text-blue-300">Physical On-Hand</div>

        </div>



        {/* 2. Available Stock */}

        <div className="min-h-28 flex flex-col justify-between gap-2 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20">

          <div className="min-h-8 text-[10px] leading-4 font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">

            2. Available Stock

          </div>

          <div className="text-xl font-bold tracking-tight text-emerald-900 dark:text-emerald-200 font-mono tabular-nums">

            {metrics.available.toLocaleString()}

          </div>

          <div className="text-[11px] leading-4 text-emerald-700 dark:text-emerald-300">Free for Allocation</div>

        </div>



        {/* 3. Reserved Stock */}

        <div className="min-h-28 flex flex-col justify-between gap-2 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20">

          <div className="min-h-8 text-[10px] leading-4 font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">

            3. Reserved Stock

          </div>

          <div className="text-xl font-bold tracking-tight text-amber-900 dark:text-amber-200 font-mono tabular-nums">

            {metrics.reserved.toLocaleString()}

          </div>

          <div className="text-[11px] leading-4 text-amber-700 dark:text-amber-300">Active Reservations</div>

        </div>



        {/* 4. Damaged Stock */}

        <div className="min-h-28 flex flex-col justify-between gap-2 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20">

          <div className="min-h-8 text-[10px] leading-4 font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">

            4. Damaged Stock

          </div>

          <div className="text-xl font-bold tracking-tight text-rose-900 dark:text-rose-200 font-mono tabular-nums">

            {metrics.damaged.toLocaleString()}

          </div>

          <div className="text-[11px] leading-4 text-rose-700 dark:text-rose-300">Physical Damage</div>

        </div>



        {/* 5. Blocked Stock */}

        <div className="min-h-28 flex flex-col justify-between gap-2 p-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20">

          <div className="min-h-8 text-[10px] leading-4 font-bold uppercase tracking-wider text-red-700 dark:text-red-300">

            5. Blocked Stock

          </div>

          <div className="text-xl font-bold tracking-tight text-red-900 dark:text-red-200 font-mono tabular-nums">

            {metrics.blocked.toLocaleString()}

          </div>

          <div className="text-[11px] leading-4 text-red-700 dark:text-red-300">Operational Hold</div>

        </div>



        {/* 6. Quarantined Stock */}

        <div className="min-h-28 flex flex-col justify-between gap-2 p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20">

          <div className="min-h-8 text-[10px] leading-4 font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">

            6. Quarantined

          </div>

          <div className="text-xl font-bold tracking-tight text-purple-900 dark:text-purple-200 font-mono tabular-nums">

            {metrics.quarantined.toLocaleString()}

          </div>

          <div className="text-[11px] leading-4 text-purple-700 dark:text-purple-300">QC & Inspection</div>

        </div>



        {/* 7. Safety Stock */}

        <div className="min-h-28 flex flex-col justify-between gap-2 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20">

          <div className="min-h-8 text-[10px] leading-4 font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">

            7. Safety Stock

          </div>

          <div className="text-xl font-bold tracking-tight text-indigo-900 dark:text-indigo-200 font-mono tabular-nums">

            {metrics.safety.toLocaleString()}

          </div>

          <div className="text-[11px] leading-4 text-indigo-700 dark:text-indigo-300">Configured Floor</div>

        </div>



        {/* 8. Minimum Stock */}

        <div className="min-h-28 flex flex-col justify-between gap-2 p-3.5 rounded-xl border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/40 dark:bg-cyan-950/20">

          <div className="min-h-8 text-[10px] leading-4 font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">

            8. Minimum Stock

          </div>

          <div className="text-xl font-bold tracking-tight text-cyan-900 dark:text-cyan-200 font-mono tabular-nums">

            {metrics.minStock.toLocaleString()}

          </div>

          <div className="text-[11px] leading-4 text-cyan-700 dark:text-cyan-300">Threshold Target</div>

        </div>



        {/* 9. Maximum Stock */}

        <div className="min-h-28 flex flex-col justify-between gap-2 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">

          <div className="min-h-8 text-[10px] leading-4 font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">

            9. Maximum Stock

          </div>

          <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono tabular-nums">

            {metrics.maxStock.toLocaleString()}

          </div>

          <div className="text-[11px] leading-4 text-slate-600 dark:text-slate-300">Capacity Ceiling</div>

        </div>

      </div>



      {/* Filter Bar */}

      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch lg:items-center justify-between">

        <div className="flex w-full lg:flex-1 min-w-0 lg:max-w-md items-center relative">

          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />

          <input

            type="text"

            placeholder="Search by SKU, product name, location..."

            value={search}

            onChange={(e) => setSearch(e.target.value)}

            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"

          />

        </div>



        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto">

          <select

            value={warehouseFilter}

            onChange={(e) => setWarehouseFilter(e.target.value)}

            className="w-full min-w-0 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"

          >

            <option value="ALL">All Facilities</option>

            {warehouses.map((wh) => (

              <option key={wh.id} value={wh.name}>

                {wh.name}

              </option>

            ))}

          </select>



          <select

            value={statusFilter}

            onChange={(e) => setStatusFilter(e.target.value)}

            className="w-full min-w-0 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"

          >

            <option value="ALL">All Stock Statuses</option>

            <option value="In Stock">In Stock</option>

            <option value="Low Stock">Low Stock</option>

            <option value="Critical">Critical</option>

            <option value="Out of Stock">Out of Stock</option>

          </select>

        </div>

      </div>



      {/* Main Stock Table */}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1100px] text-left text-sm">

            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">

              <tr>

                <th className="px-4 py-3">Product / SKU</th>

                <th className="px-4 py-3">Warehouse & Bin</th>

                <th className="px-4 py-3 text-right">Current Stock</th>

                <th className="px-4 py-3 text-right">Available Stock</th>

                <th className="px-4 py-3 text-right">Reserved</th>

                <th className="px-4 py-3 text-right">Damaged</th>

                <th className="px-4 py-3 text-right">Blocked</th>

                <th className="px-4 py-3 text-right">Quarantined</th>

                <th className="px-4 py-3 text-right">Safety Buffer</th>

                <th className="px-4 py-3 text-center">Status</th>

                <th className="px-4 py-3 text-right">Action</th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">

              {loading ? (

                <tr>

                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">

                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />

                    Loading live stock balances from PostgreSQL database...

                  </td>

                </tr>

              ) : filtered.length === 0 ? (

                <tr>

                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">

                    No stock balance records found in the database matching these filters.

                  </td>

                </tr>

              ) : (

                filtered.map((b) => {

                  const onHand = Number(b.current_stock ?? b.total_stock ?? b.on_hand_qty ?? 0);

                  const avail = Number(b.available_stock ?? b.available_qty ?? 0);

                  const reserved = Number(b.reserved_stock ?? b.reserved_qty ?? 0);

                  const damaged = Number(b.damaged_stock ?? b.damaged_qty ?? 0);

                  const blocked = Number(b.blocked_stock ?? b.blocked_qty ?? 0);

                  const quarantined = Number(b.quarantined_stock ?? b.quarantined_qty ?? 0);

                  const safety = Number(b.safety_stock ?? 0);

                  const status = b.stock_status || (avail <= 0 ? "Out of Stock" : "In Stock");



                  return (

                    <tr

                      key={b.id}

                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"

                    >

                      <td className="px-4 py-3">

                        <div className="font-semibold text-slate-900 dark:text-slate-100">

                          {b.product_name || b.item_name || "Catalog Product"}

                        </div>

                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">

                          {b.sku || b.item_code}

                        </div>

                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">

                        <div className="flex items-center space-x-1">

                          <WarehouseIcon className="w-3.5 h-3.5 text-slate-400" />

                          <span>{b.warehouse_name || "Main Hub"}</span>

                        </div>

                        <div className="text-slate-400 font-mono text-[11px] mt-0.5">

                          {b.location_name || b.bin_name || "Standard Bin"}

                        </div>

                      </td>

                      <td className="px-4 py-3 text-right font-medium font-mono">

                        {onHand.toLocaleString()} <span className="text-xs text-slate-400">{b.unit || "EA"}</span>

                      </td>

                      <td className="px-4 py-3 text-right font-bold font-mono">

                        <span

                          className={

                            avail <= 0

                              ? "text-red-600 dark:text-red-400"

                              : avail <= safety

                              ? "text-amber-500"

                              : "text-emerald-600 dark:text-emerald-400"

                          }

                        >

                          {avail.toLocaleString()} {b.unit || "EA"}

                        </span>

                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">

                        {reserved > 0 ? (

                          <span className="text-amber-600 dark:text-amber-400 font-medium">

                            {reserved.toLocaleString()}

                          </span>

                        ) : (

                          "—"

                        )}

                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">

                        {damaged > 0 ? (

                          <span className="text-rose-600 dark:text-rose-400 font-medium">

                            {damaged.toLocaleString()}

                          </span>

                        ) : (

                          "—"

                        )}

                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">

                        {blocked > 0 ? (

                          <span className="text-red-600 dark:text-red-400 font-medium">

                            {blocked.toLocaleString()}

                          </span>

                        ) : (

                          "—"

                        )}

                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">

                        {quarantined > 0 ? (

                          <span className="text-purple-600 dark:text-purple-400 font-medium">

                            {quarantined.toLocaleString()}

                          </span>

                        ) : (

                          "—"

                        )}

                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">

                        {safety > 0 ? `${safety.toLocaleString()}` : "—"}

                      </td>

                      <td className="px-4 py-3 text-center">

                        <span

                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${

                            status === "In Stock"

                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"

                              : status === "Low Stock" || status === "Critical"

                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"

                              : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"

                          }`}

                        >

                          {status}

                        </span>

                      </td>

                      <td className="px-4 py-3 text-right">

                        <button

                          onClick={() => setSelectedDetail(b)}

                          className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition inline-flex items-center space-x-1"

                        >

                          <Eye className="w-3.5 h-3.5" />

                          <span>Detail</span>

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



      {/* Product Detail Modal */}

      {selectedDetail && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-3xl max-h-[calc(100vh-1.5rem)] overflow-y-auto shadow-2xl p-4 sm:p-6 relative">

            <button

              onClick={() => setSelectedDetail(null)}

              aria-label="Close stock details"

              className="absolute top-4 right-4 p-2 text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"

            >

              <X className="w-5 h-5" />

            </button>

            <div className="flex items-center space-x-2 text-emerald-600 mb-2">

              <Boxes className="w-5 h-5" />

              <h2 className="pr-10 text-lg sm:text-xl leading-tight font-bold text-slate-900 dark:text-slate-100">

                Item Stock Details & Classification

              </h2>

            </div>

            <p className="text-sm leading-5 text-slate-600 dark:text-slate-300 mb-4">

              Comprehensive breakdown of all physical and logical inventory quantities.

            </p>



            <div className="space-y-4 text-sm">

              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">

                <div className="break-words text-base sm:text-lg leading-6 font-bold text-slate-900 dark:text-slate-100">

                  {selectedDetail.product_name || selectedDetail.item_name}

                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">

                  <span>SKU: <span className="font-mono text-emerald-700 dark:text-emerald-300 font-semibold">{selectedDetail.sku || selectedDetail.item_code}</span></span>

                  <span>Facility: {selectedDetail.warehouse_name || "Main Hub"}</span>

                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300">

                  Location: {selectedDetail.location_name || "Standard Bin"}

                </div>

              </div>



              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs">

                <div className="min-h-28 flex flex-col justify-between gap-2 p-3 rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/30">

                  <div className="min-h-8 text-slate-600 dark:text-slate-300 font-medium leading-4">1. Current Stock (On Hand)</div>

                  <div className="text-lg leading-6 font-bold text-blue-700 dark:text-blue-300 font-mono tabular-nums">

                    {Number(selectedDetail.current_stock ?? selectedDetail.total_stock ?? selectedDetail.on_hand_qty ?? 0)} {selectedDetail.unit}

                  </div>

                </div>

                <div className="min-h-28 flex flex-col justify-between gap-2 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/30">

                  <div className="min-h-8 text-slate-600 dark:text-slate-300 font-medium leading-4">2. Free Available Stock</div>

                  <div className="text-lg leading-6 font-bold text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">

                    {Number(selectedDetail.available_stock ?? selectedDetail.available_qty ?? 0)} {selectedDetail.unit}

                  </div>

                </div>

                <div className="min-h-28 flex flex-col justify-between gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/30">

                  <div className="min-h-8 text-slate-600 dark:text-slate-300 font-medium leading-4">3. Reserved Stock</div>

                  <div className="text-lg leading-6 font-bold text-amber-700 dark:text-amber-300 font-mono tabular-nums">

                    {Number(selectedDetail.reserved_stock ?? selectedDetail.reserved_qty ?? 0)} {selectedDetail.unit}

                  </div>

                </div>

                <div className="min-h-28 flex flex-col justify-between gap-2 p-3 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/30">

                  <div className="min-h-8 text-slate-600 dark:text-slate-300 font-medium leading-4">4. Damaged Stock</div>

                  <div className="text-lg leading-6 font-bold text-rose-700 dark:text-rose-300 font-mono tabular-nums">

                    {Number(selectedDetail.damaged_stock ?? selectedDetail.damaged_qty ?? 0)} {selectedDetail.unit}

                  </div>

                </div>

                <div className="min-h-28 flex flex-col justify-between gap-2 p-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/30">

                  <div className="min-h-8 text-slate-600 dark:text-slate-300 font-medium leading-4">5. Blocked Stock</div>

                  <div className="text-lg leading-6 font-bold text-red-700 dark:text-red-300 font-mono tabular-nums">

                    {Number(selectedDetail.blocked_stock ?? selectedDetail.blocked_qty ?? 0)} {selectedDetail.unit}

                  </div>

                </div>

                <div className="min-h-28 flex flex-col justify-between gap-2 p-3 rounded-lg border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/30">

                  <div className="min-h-8 text-slate-600 dark:text-slate-300 font-medium leading-4">6. Quarantined Stock</div>

                  <div className="text-lg leading-6 font-bold text-purple-700 dark:text-purple-300 font-mono tabular-nums">

                    {Number(selectedDetail.quarantined_stock ?? selectedDetail.quarantined_qty ?? 0)} {selectedDetail.unit}

                  </div>

                </div>

                <div className="min-h-28 flex flex-col justify-between gap-2 p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/30">

                  <div className="min-h-8 text-slate-600 dark:text-slate-300 font-medium leading-4">7. Safety Buffer</div>

                  <div className="text-lg leading-6 font-bold text-indigo-700 dark:text-indigo-300 font-mono tabular-nums">

                    {Number(selectedDetail.safety_stock ?? 0)} {selectedDetail.unit}

                  </div>

                </div>

                <div className="min-h-28 flex flex-col justify-between gap-2 p-3 rounded-lg border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/50 dark:bg-cyan-950/30">

                  <div className="min-h-8 text-slate-600 dark:text-slate-300 font-medium leading-4">8. Minimum Stock</div>

                  <div className="text-lg leading-6 font-bold text-cyan-700 dark:text-cyan-300 font-mono tabular-nums">

                    {Number(selectedDetail.min_stock ?? 0)} {selectedDetail.unit}

                  </div>

                </div>

                <div className="min-h-28 flex flex-col justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60">

                  <div className="min-h-8 text-slate-600 dark:text-slate-300 font-medium leading-4">9. Maximum Stock</div>

                  <div className="text-lg leading-6 font-bold text-slate-800 dark:text-slate-100 font-mono tabular-nums">

                    {Number(selectedDetail.max_stock ?? 0)} {selectedDetail.unit}

                  </div>

                </div>

              </div>



              <div className="flex justify-end pt-2">

                <button

                  onClick={() => setSelectedDetail(null)}

                  className="min-w-32 justify-center px-4 py-2.5 text-sm font-semibold rounded-lg bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 transition"

                >

                  Close Detail

                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}

export default StockBalancesPage;
