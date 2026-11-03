import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingDown,
  Search,
  Filter,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Warehouse as WarehouseIcon,
  RefreshCw,
  Sparkles,
  BarChart3,
  Layers,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  fetchStockForecast,
  fetchProducts,
  fetchWarehouses,
} from "@/services/api";

export function StockForecastPage() {
  const [forecasts, setForecasts] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form / Filter Controls - Exactly the 3 inputs from Phase 5
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("30 Days");
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [fRes, pRes, wRes] = await Promise.all([
        fetchStockForecast({
          product: selectedProduct,
          warehouse: selectedWarehouse,
          forecast_period: selectedPeriod,
        }),
        fetchProducts(),
        fetchWarehouses(),
      ]);
      setForecasts(fRes.results || fRes || []);
      setProducts(pRes.results || pRes || []);
      setWarehouses(wRes.results || wRes || []);
    } catch (err) {
      console.error("Failed to load stock forecast", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProduct, selectedWarehouse, selectedPeriod]);

  const filteredForecasts = useMemo(() => {
    return forecasts.filter((f) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (f.product_name && f.product_name.toLowerCase().includes(q)) ||
        (f.sku && f.sku.toLowerCase().includes(q));

      const matchProd = !selectedProduct || String(f.product) === String(selectedProduct);
      const matchWh = !selectedWarehouse || String(f.warehouse) === String(selectedWarehouse);

      return matchSearch && matchProd && matchWh;
    });
  }, [forecasts, searchTerm, selectedProduct, selectedWarehouse]);

  // KPIs
  const totalMonitored = filteredForecasts.length;
  const projectedStockouts = filteredForecasts.filter((f) => Number(f.projected_stock || 0) <= 0).length;
  const totalExpectedDemand = Math.round(
    filteredForecasts.reduce((sum, f) => sum + Number(f.expected_demand || 0), 0)
  );
  const avgDailyBurn = filteredForecasts.length
    ? (
        filteredForecasts.reduce((sum, f) => sum + Number(f.average_daily_demand || 0), 0) /
        filteredForecasts.length
      ).toFixed(1)
    : "0.0";

  const exportCSV = () => {
    const headers = [
      "Product Name",
      "SKU",
      "Warehouse",
      "Forecast Period",
      "Historical Demand (30d)",
      "Avg Daily Demand",
      "Current Available Stock",
      "Expected Demand",
      "Projected Stock",
      "Risk",
    ];
    const rows = filteredForecasts.map((f) => [
      f.product_name || "",
      f.sku || "",
      f.warehouse_name || f.warehouse || "",
      f.forecast_period || selectedPeriod,
      f.historical_demand || 0,
      f.average_daily_demand || 0,
      f.current_available_stock || 0,
      f.expected_demand || 0,
      f.projected_stock || 0,
      Number(f.projected_stock || 0) <= 0 ? "Stockout Risk" : "Healthy",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_forecast_${selectedPeriod.replace(" ", "_")}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Stock Forecast
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Predictive Runaway
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Estimate future stock requirements using historical consumption patterns and demand velocity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <Link
            to="/inventory/planning/purchase-suggestions"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            View Purchase Suggestions
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Projected Stockouts</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{projectedStockouts}</span>
            <span className="text-xs text-slate-400">Depleted within {selectedPeriod}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Expected Total Demand</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{totalExpectedDemand}</span>
            <span className="text-xs text-slate-400">Projected units consumed</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Avg Daily Burn Rate</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{avgDailyBurn}</span>
            <span className="text-xs text-slate-400">Units / Day per SKU</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Forecast Horizons</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{selectedPeriod}</span>
            <span className="text-xs text-slate-400">{totalMonitored} SKUs evaluated</span>
          </div>
        </div>
      </div>

      {/* Forecast Parameters Form & Filter Toolbar - Exactly the 3 Required Inputs */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
            Forecast Configuration
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* 1. Product (Dropdown, Required) */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Product
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku || p.code})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Warehouse (Dropdown, Required) */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Warehouse
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Forecast Period (Dropdown, Required: 7 Days, 30 Days, 60 Days, 90 Days) */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Forecast Period <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7 Days">7 Days (Short Horizon)</option>
              <option value="30 Days">30 Days (Standard Month)</option>
              <option value="60 Days">60 Days (Two Months)</option>
              <option value="90 Days">90 Days (Quarterly Horizon)</option>
            </select>
          </div>

          {/* Search Filter */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Search SKU
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Details Table - Exactly the Phase 6 fields */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4 text-center">Period</th>
                <th className="py-3 px-4 text-right">Historical Demand (30d)</th>
                <th className="py-3 px-4 text-right">Avg Daily Demand</th>
                <th className="py-3 px-4 text-right">Current Available Stock</th>
                <th className="py-3 px-4 text-right">Expected Demand</th>
                <th className="py-3 px-4 text-right">Projected Stock</th>
                <th className="py-3 px-4 text-center">Stockout Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Calculating historical burn rates and projections...
                  </td>
                </tr>
              ) : filteredForecasts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No forecast projections found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredForecasts.map((f, idx) => {
                  const projected = Number(f.projected_stock !== undefined ? f.projected_stock : 0);
                  const isStockout = projected <= 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {f.product_name || "Product"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                        {f.sku || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                        {f.warehouse_name || f.warehouse || "Warehouse"}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono">
                          {f.forecast_period || selectedPeriod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-slate-700 dark:text-zinc-300 font-medium">
                        {Number(f.historical_demand || 0).toFixed(0)} units
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-slate-700 dark:text-zinc-300 font-medium">
                        {Number(f.average_daily_demand || 0).toFixed(2)} / d
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                        {Number(f.current_available_stock || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-amber-600 dark:text-amber-400">
                        {Number(f.expected_demand || 0).toFixed(0)}
                      </td>
                      <td className={`py-3.5 px-4 text-right tabular-nums font-bold ${isStockout ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {projected > 0 ? `+${projected}` : projected}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isStockout ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            <AlertTriangle className="h-3 w-3" /> Deficit Risk
                          </span>
                        ) : projected <= 10 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            <Clock className="h-3 w-3" /> Low Buffer
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle className="h-3 w-3" /> Safe Runway
                          </span>
                        )}
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
export default StockForecastPage;
