import React, { useState, useEffect } from "react";
import { ReportShell } from "../components/ReportShell";
import { fetchStockSummaryReport } from "../services/api";
import { Package, CheckCircle2, AlertTriangle, XCircle, Boxes } from "lucide-react";

export function StockSummaryReportPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await fetchStockSummaryReport(params);
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

  const totalStock = data.reduce((acc, r) => acc + Number(r.total_stock || 0), 0);
  const totalAvailable = data.reduce((acc, r) => acc + Number(r.available_stock || 0), 0);
  const totalReserved = data.reduce((acc, r) => acc + Number(r.reserved_stock || 0), 0);
  const totalDamaged = data.reduce((acc, r) => acc + Number(r.damaged_stock || 0), 0);

  const columns = [
    {
      header: "Product Name",
      accessor: (r) => r.product_name,
      cell: (r) => <span className="font-semibold text-slate-900 dark:text-white">{r.product_name}</span>,
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
      header: "Category",
      accessor: (r) => r.category,
      cell: (r) => <span className="text-slate-600 dark:text-zinc-300">{r.category}</span>,
    },
    {
      header: "Warehouse",
      accessor: (r) => r.warehouse,
      cell: (r) => <span className="font-medium text-slate-800 dark:text-zinc-200">{r.warehouse}</span>,
    },
    {
      header: "Total Stock",
      accessor: (r) => r.total_stock,
      align: "right",
      cell: (r) => <span className="font-mono font-bold text-slate-900 dark:text-white">{Number(r.total_stock).toLocaleString()}</span>,
    },
    {
      header: "Reserved Stock",
      accessor: (r) => r.reserved_stock,
      align: "right",
      cell: (r) => <span className="font-mono text-purple-600 dark:text-purple-400 font-medium">{Number(r.reserved_stock).toLocaleString()}</span>,
    },
    {
      header: "Available Stock",
      accessor: (r) => r.available_stock,
      align: "right",
      cell: (r) => <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{Number(r.available_stock).toLocaleString()}</span>,
    },
    {
      header: "Damaged Stock",
      accessor: (r) => r.damaged_stock,
      align: "right",
      cell: (r) => <span className="font-mono text-amber-600 dark:text-amber-400">{Number(r.damaged_stock).toLocaleString()}</span>,
    },
    {
      header: "Stock Status",
      accessor: (r) => r.stock_status,
      align: "center",
      cell: (r) => {
        const status = r.stock_status;
        const colorClass =
          status === "In Stock"
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200"
            : status === "Low Stock"
            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border-amber-200"
            : "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border-rose-200";
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${colorClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status === "In Stock" ? "bg-emerald-500" : status === "Low Stock" ? "bg-amber-500" : "bg-rose-500"}`} />
            {status}
          </span>
        );
      },
    },
  ];

  const summary = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Physical Stock</span>
        <span className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 block">{totalStock.toLocaleString()}</span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available to Issue</span>
        <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">{totalAvailable.toLocaleString()}</span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reserved Allocations</span>
        <span className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1 block">{totalReserved.toLocaleString()}</span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Damaged / Quarantine</span>
        <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">{totalDamaged.toLocaleString()}</span>
      </div>
    </div>
  );

  return (
    <ReportShell
      title="Stock Summary Report"
      subtitle="View current physical, reserved, available, and damaged quantities across all facilities."
      badge="CURRENT STOCK BALANCE"
      fileName="Stock_Summary_Report"
      columns={columns}
      data={data}
      loading={loading}
      onApplyFilters={loadData}
      customSummary={summary}
    />
  );
}

export default StockSummaryReportPage;
