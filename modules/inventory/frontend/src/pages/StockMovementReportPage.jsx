import React, { useState, useEffect } from "react";
import { ReportShell } from "../components/ReportShell";
import { fetchStockMovementReport } from "../services/api";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, RotateCcw } from "lucide-react";

export function StockMovementReportPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await fetchStockMovementReport(params);
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

  const totalIn = data.reduce((acc, r) => acc + Number(r.quantity_in || 0), 0);
  const totalOut = data.reduce((acc, r) => acc + Number(r.quantity_out || 0), 0);
  const netFlow = totalIn - totalOut;

  const columns = [
    {
      header: "Transaction Date",
      accessor: (r) => r.transaction_date,
      cell: (r) => <span className="font-mono text-slate-600 dark:text-zinc-400">{r.transaction_date}</span>,
    },
    {
      header: "Transaction Number",
      accessor: (r) => r.transaction_number,
      cell: (r) => (
        <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-zinc-200">
          {r.transaction_number}
        </span>
      ),
    },
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
      header: "Transaction Type",
      accessor: (r) => r.transaction_type,
      align: "center",
      cell: (r) => {
        const type = r.transaction_type;
        const colorClass =
          type === "Receipt"
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
            : type === "Issue"
            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
            : type === "Transfer"
            ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-900/50"
            : type === "Return"
            ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-400 border-cyan-200 dark:border-cyan-900/50"
            : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900/50";
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${colorClass}`}>
            {type}
          </span>
        );
      },
    },
    {
      header: "Quantity In",
      accessor: (r) => r.quantity_in,
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
          {Number(r.quantity_in) > 0 ? `+${Number(r.quantity_in).toLocaleString()}` : "—"}
        </span>
      ),
    },
    {
      header: "Quantity Out",
      accessor: (r) => r.quantity_out,
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
          {Number(r.quantity_out) > 0 ? `-${Number(r.quantity_out).toLocaleString()}` : "—"}
        </span>
      ),
    },
    {
      header: "Reference Number",
      accessor: (r) => r.reference_number,
      cell: (r) => (
        <span className="font-mono text-slate-500 dark:text-zinc-400">
          {r.reference_number || "—"}
        </span>
      ),
    },
  ];

  const summary = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Inbound Quantity</span>
        <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">+{totalIn.toLocaleString()}</span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Outbound Quantity</span>
        <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">-{totalOut.toLocaleString()}</span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Volume Flow</span>
        <span className={`text-xl font-bold font-mono mt-1 block ${netFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {netFlow >= 0 ? `+${netFlow.toLocaleString()}` : netFlow.toLocaleString()}
        </span>
      </div>
    </div>
  );

  return (
    <ReportShell
      title="Stock Movement Report"
      subtitle="Analyze chronological incoming and outgoing movements by transaction type and reference number."
      badge="TRANSACTION AUDIT"
      fileName="Stock_Movement_Report"
      columns={columns}
      data={data}
      loading={loading}
      onApplyFilters={loadData}
      customSummary={summary}
    />
  );
}

export default StockMovementReportPage;
