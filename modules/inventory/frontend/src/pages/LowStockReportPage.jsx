import React, { useState, useEffect } from "react";
import { ReportShell } from "../components/ReportShell";
import { fetchLowStockReport } from "../services/api";
import { AlertTriangle, AlertCircle, ShoppingCart } from "lucide-react";

export function LowStockReportPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await fetchLowStockReport(params);
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

  const outOfStockCount = data.filter((r) => r.stock_status === "Out of Stock" || Number(r.available_stock) <= 0).length;
  const lowStockCount = data.length - outOfStockCount;
  const totalRequiredQty = data.reduce((acc, r) => acc + Number(r.required_quantity || 0), 0);

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
      header: "Available Stock",
      accessor: (r) => r.available_stock,
      align: "right",
      cell: (r) => {
        const avail = Number(r.available_stock);
        return (
          <span className={`font-mono font-bold ${avail <= 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
            {avail.toLocaleString()}
          </span>
        );
      },
    },
    {
      header: "Reorder Level",
      accessor: (r) => r.reorder_level,
      align: "right",
      cell: (r) => <span className="font-mono font-medium text-slate-700 dark:text-zinc-300">{Number(r.reorder_level).toLocaleString()}</span>,
    },
    {
      header: "Required Quantity",
      accessor: (r) => r.required_quantity,
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200/50">
          +{Number(r.required_quantity).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Stock Status",
      accessor: (r) => r.stock_status,
      align: "center",
      cell: (r) => {
        const status = r.stock_status;
        const isOut = status === "Out of Stock" || Number(r.available_stock) <= 0;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              isOut
                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border-rose-200"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border-amber-200"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isOut ? "bg-rose-500" : "bg-amber-500"}`} />
            {isOut ? "OUT OF STOCK" : "LOW STOCK"}
          </span>
        );
      },
    },
  ];

  const summary = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stockout SKU Count</span>
        <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">
          {outOfStockCount}
        </span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Low Stock SKU Count</span>
        <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
          {lowStockCount}
        </span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Deficit Replenishment Need</span>
        <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 block">
          +{totalRequiredQty.toLocaleString()} units
        </span>
      </div>
    </div>
  );

  return (
    <ReportShell
      title="Low Stock Report"
      subtitle="Identify products breached below safety reorder levels and calculate replenishment deficit requirements."
      badge="REPLENISHMENT ALERT"
      badgeColor="rose"
      fileName="Low_Stock_Report"
      columns={columns}
      data={data}
      loading={loading}
      onApplyFilters={loadData}
      customSummary={summary}
    />
  );
}

export default LowStockReportPage;
