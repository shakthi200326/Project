import React, { useState, useEffect } from "react";
import { ReportShell } from "../components/ReportShell";
import { fetchExpiryReport } from "../services/api";
import { AlertTriangle, Clock, XCircle, ShieldAlert } from "lucide-react";

export function ExpiryReportPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await fetchExpiryReport(params);
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

  const expiredBatches = data.filter((r) => r.expiry_status === "Expired" || Number(r.days_to_expiry) < 0);
  const expiringSoonBatches = data.filter((r) => r.expiry_status === "Expiring Soon" && Number(r.days_to_expiry) >= 0);
  const totalExpiredQty = expiredBatches.reduce((acc, r) => acc + Number(r.remaining_quantity || 0), 0);
  const totalExpiringSoonQty = expiringSoonBatches.reduce((acc, r) => acc + Number(r.remaining_quantity || 0), 0);

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
      header: "Batch Number",
      accessor: (r) => r.batch_number,
      cell: (r) => (
        <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
          {r.batch_number}
        </span>
      ),
    },
    {
      header: "Warehouse",
      accessor: (r) => r.warehouse,
      cell: (r) => <span className="font-medium text-slate-700 dark:text-zinc-300">{r.warehouse}</span>,
    },
    {
      header: "Expiry Date",
      accessor: (r) => r.expiry_date,
      cell: (r) => <span className="font-mono font-medium text-slate-700 dark:text-zinc-300">{r.expiry_date}</span>,
    },
    {
      header: "Remaining Quantity",
      accessor: (r) => r.remaining_quantity,
      align: "right",
      cell: (r) => <span className="font-mono font-bold text-slate-900 dark:text-white">{Number(r.remaining_quantity).toLocaleString()}</span>,
    },
    {
      header: "Days to Expiry",
      accessor: (r) => r.days_to_expiry,
      align: "right",
      cell: (r) => {
        const days = Number(r.days_to_expiry);
        return (
          <span className={`font-mono font-bold ${days < 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
            {days < 0 ? `${Math.abs(days)}d past` : `${days}d left`}
          </span>
        );
      },
    },
    {
      header: "Expiry Status",
      accessor: (r) => r.expiry_status,
      align: "center",
      cell: (r) => {
        const status = r.expiry_status;
        const isExpired = status === "Expired" || Number(r.days_to_expiry) < 0;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              isExpired
                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border-rose-200"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border-amber-200"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isExpired ? "bg-rose-500" : "bg-amber-500"}`} />
            {isExpired ? "EXPIRED" : "EXPIRING SOON"}
          </span>
        );
      },
    },
  ];

  const summary = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expiring Soon (Within 30 Days)</span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {expiringSoonBatches.length} batches
          </span>
          <span className="text-xs text-slate-500">({totalExpiringSoonQty.toLocaleString()} units)</span>
        </div>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expired Stock (Action Required)</span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {expiredBatches.length} batches
          </span>
          <span className="text-xs text-slate-500">({totalExpiredQty.toLocaleString()} units)</span>
        </div>
      </div>
    </div>
  );

  return (
    <ReportShell
      title="Expiry Report"
      subtitle="Monitor perishable and life-limited batches approaching or past certified expiration dates."
      badge="SHELF-LIFE SAFETY"
      badgeColor="rose"
      fileName="Expiry_Report"
      columns={columns}
      data={data}
      loading={loading}
      onApplyFilters={loadData}
      customSummary={summary}
    />
  );
}

export default ExpiryReportPage;
