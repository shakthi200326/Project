import React, { useState, useEffect } from "react";
import { ReportShell } from "../components/ReportShell";
import { fetchStockLedgerReport } from "../services/api";

export function StockLedgerReportPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await fetchStockLedgerReport(params);
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
      header: "Warehouse",
      accessor: (r) => r.warehouse,
      cell: (r) => <span className="font-medium text-slate-700 dark:text-zinc-300">{r.warehouse}</span>,
    },
    {
      header: "Transaction Type",
      accessor: (r) => r.transaction_type,
      align: "center",
      cell: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700">
          {r.transaction_type}
        </span>
      ),
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
      header: "Running Balance",
      accessor: (r) => r.running_balance,
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200/50 dark:border-blue-900/30">
          {Number(r.running_balance).toLocaleString()}
        </span>
      ),
    },
  ];

  const summary = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cumulative Inflows</span>
        <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">+{totalIn.toLocaleString()}</span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cumulative Outflows</span>
        <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">-{totalOut.toLocaleString()}</span>
      </div>
    </div>
  );

  return (
    <ReportShell
      title="Stock Ledger Report"
      subtitle="View the complete immutable chronological ledger with continuous running balances."
      badge="IMMUTABLE LEDGER"
      fileName="Stock_Ledger_Report"
      columns={columns}
      data={data}
      loading={loading}
      onApplyFilters={loadData}
      customSummary={summary}
    />
  );
}

export default StockLedgerReportPage;
