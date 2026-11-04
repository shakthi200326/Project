import React, { useState, useEffect } from "react";
import { ReportShell } from "../components/ReportShell";
import { fetchStockAgeingReport } from "../services/api";
import { Clock, History, AlertTriangle } from "lucide-react";

export function StockAgeingReportPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await fetchStockAgeingReport(params);
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

  const totalQty = data.reduce((acc, r) => acc + Number(r.current_quantity || 0), 0);
  const agedOver90 = data.filter((r) => r.ageing_bucket === "90+ days" || Number(r.age_in_days) > 90).reduce((acc, r) => acc + Number(r.current_quantity || 0), 0);
  const aged61To90 = data.filter((r) => r.ageing_bucket === "61–90 days").reduce((acc, r) => acc + Number(r.current_quantity || 0), 0);

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
      header: "Batch Number",
      accessor: (r) => r.batch_number,
      cell: (r) => (
        <span className="font-mono text-[11px] text-slate-800 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
          {r.batch_number}
        </span>
      ),
    },
    {
      header: "Received Date",
      accessor: (r) => r.received_date,
      cell: (r) => <span className="font-mono text-slate-600 dark:text-zinc-400">{r.received_date}</span>,
    },
    {
      header: "Current Quantity",
      accessor: (r) => r.current_quantity,
      align: "right",
      cell: (r) => <span className="font-mono font-bold text-slate-900 dark:text-white">{Number(r.current_quantity).toLocaleString()}</span>,
    },
    {
      header: "Age in Days",
      accessor: (r) => r.age_in_days,
      align: "right",
      cell: (r) => {
        const days = Number(r.age_in_days);
        const colorClass = days > 90 ? "text-rose-600 dark:text-rose-400 font-bold" : days > 60 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-700 dark:text-zinc-300";
        return <span className={`font-mono ${colorClass}`}>{days} d</span>;
      },
    },
    {
      header: "Ageing Bucket",
      accessor: (r) => r.ageing_bucket,
      align: "center",
      cell: (r) => {
        const bucket = r.ageing_bucket;
        const colorClass =
          bucket === "0–30 days"
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
            : bucket === "31–60 days"
            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-900/50"
            : bucket === "61–90 days"
            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900/50"
            : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900/50";
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${colorClass}`}>
            {bucket}
          </span>
        );
      },
    },
  ];

  const summary = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Tracked Inventory</span>
        <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 block">
          {totalQty.toLocaleString()} units
        </span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stagnant Stock (61–90 Days)</span>
        <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
          {aged61To90.toLocaleString()} units
        </span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Obsolete Risk Stock (90+ Days)</span>
        <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">
          {agedOver90.toLocaleString()} units
        </span>
      </div>
    </div>
  );

  return (
    <ReportShell
      title="Stock Ageing Report"
      subtitle="Analyze dwelling duration of warehouse inventory categorized into 0–30, 31–60, 61–90, and 90+ day ageing buckets."
      badge="INVENTORY AGE PROFILE"
      fileName="Stock_Ageing_Report"
      columns={columns}
      data={data}
      loading={loading}
      onApplyFilters={loadData}
      customSummary={summary}
    />
  );
}

export default StockAgeingReportPage;
