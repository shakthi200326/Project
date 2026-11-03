import React, { useState, useEffect } from "react";
import { ReportShell } from "../components/ReportShell";
import { fetchStockValuationReport } from "../services/api";
import { DollarSign, Coins, TrendingUp } from "lucide-react";

export function StockValuationReportPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await fetchStockValuationReport(params);
      setData(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalUnits = data.reduce((acc, r) => acc + Number(r.stock_quantity || 0), 0);
  const totalValuation = data.reduce((acc, r) => acc + Number(r.total_stock_value || 0), 0);
  const avgCostPerUnit = totalUnits > 0 ? totalValuation / totalUnits : 0;

  const columns = [
    {
      header: "Product",
      accessor: (r) => r.product,
      cell: (r) => <span className="font-semibold text-slate-900 dark:text-white">{r.product}</span>,
    },
    {
      header: "SKU",
      accessor: (r) => r.sku,
      cell: (r) => (
        <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-900/40">
          {r.sku}
        </span>
      ),
    },
    {
      header: "Warehouse",
      accessor: (r) => r.warehouse,
      cell: (r) => <span className="font-medium text-slate-700 dark:text-zinc-300">{r.warehouse}</span>,
    },
    {
      header: "Stock Quantity",
      accessor: (r) => r.stock_quantity,
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-slate-900 dark:text-white">
          {Number(r.stock_quantity).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Unit Cost",
      accessor: (r) => r.unit_cost,
      align: "right",
      cell: (r) => (
        <span className="font-mono text-slate-700 dark:text-zinc-300">
          ${Number(r.unit_cost).toFixed(2)}
        </span>
      ),
    },
    {
      header: "Total Stock Value",
      accessor: (r) => r.total_stock_value,
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
          ${Number(r.total_stock_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: "Valuation Method",
      accessor: (r) => r.valuation_method,
      align: "center",
      cell: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200">
          {r.valuation_method}
        </span>
      ),
    },
  ];

  const summary = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Inventory Valuation</span>
        <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
          ${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Quantities Valued</span>
        <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 block">
          {totalUnits.toLocaleString()} units
        </span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Blended Cost / Unit</span>
        <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 block">
          ${avgCostPerUnit.toFixed(2)}
        </span>
      </div>
    </div>
  );

  return (
    <ReportShell
      title="Stock Valuation Report"
      subtitle="Financial balance sheet evaluation using configured costing methodologies (WAV, FIFO, Standard Cost)."
      badge="FINANCIAL VALUATION"
      badgeColor="purple"
      fileName="Stock_Valuation_Report"
      columns={columns}
      data={data}
      loading={loading}
      onApplyFilters={loadData}
      customSummary={summary}
    />
  );
}

export default StockValuationReportPage;
