import React, { useState, useEffect } from "react";
import { FileSpreadsheet, Download, Search, Filter, ShieldCheck, ArrowUpDown, CheckCircle2 } from "lucide-react";
import { fetchStockLedger } from "../services/api";

export function StockLedgerPage() {
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    fetchStockLedger().then((res) => {
      const formatted = (res.results || []).map((e) => ({
        id: e.id,
        timestamp: e.created_at,
        doc_ref: e.transaction_ref,
        tx_type: e.movement_type,
        item_sku: e.item_code,
        item_name: e.item_code === "BRG-6205-2RS" ? "Industrial Ball Bearing 6205-2RS" : e.item_code,
        warehouse: e.warehouse_code,
        location: "Aisle 3 - Rack B",
        delta: Number(e.quantity_delta),
        balance_after: Number(e.balance_after),
        unit_cost: Number(e.unit_cost),
        total_cost: Number(e.total_value_delta),
        user: e.actor || "system",
      }));
      setLedgerEntries(formatted);
    });
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filtered = ledgerEntries.filter((entry) => {
    const matchesType = typeFilter === "ALL" || entry.tx_type === typeFilter;
    const matchesSearch =
      entry.doc_ref.toLowerCase().includes(search.toLowerCase()) ||
      entry.item_sku.toLowerCase().includes(search.toLowerCase()) ||
      entry.user.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleExportCSV = () => {
    const headers = ["Timestamp,Document_Ref,Movement_Type,Item_SKU,Warehouse,Delta,Balance_After,Unit_Cost,Total_Value_Delta,Actor\n"];
    const rows = filtered.map(
      (e) => `"${e.timestamp}","${e.doc_ref}","${e.tx_type}","${e.item_sku}","${e.warehouse}",${e.delta},${e.balance_after},${e.unit_cost},${e.total_cost},"${e.user}"`
    );
    const blob = new Blob([headers.concat(rows).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `stock_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Immutable stock ledger exported as CSV.");
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Immutable Stock Ledger
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
              <ShieldCheck className="h-3 w-3 text-blue-500" /> Append-Only Log
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Regulatory write-once financial & physical transaction register with running balance tracking.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by doc ref, SKU or actor username..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Movement Types</option>
            <option value="RECEIPT">Goods Receipts</option>
            <option value="ISSUE">Stock Issues</option>
            <option value="TRANSFER_IN">Transfers In</option>
            <option value="TRANSFER_OUT">Transfers Out</option>
            <option value="ADJUSTMENT">Adjustments</option>
            <option value="REVERSAL">Reversals</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                <th className="py-3.5 px-4 font-semibold">Doc Reference</th>
                <th className="py-3.5 px-4 font-semibold">Type</th>
                <th className="py-3.5 px-4 font-semibold">Product SKU</th>
                <th className="py-3.5 px-4 font-semibold">Facility</th>
                <th className="py-3.5 px-4 font-semibold text-right">Quantity Delta</th>
                <th className="py-3.5 px-4 font-semibold text-right">Running Balance</th>
                <th className="py-3.5 px-4 font-semibold text-right">Unit WAV</th>
                <th className="py-3.5 px-4 font-semibold text-right">Value Delta</th>
                <th className="py-3.5 px-4 font-semibold text-center">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                    {new Date(entry.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                      {entry.doc_ref}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        entry.tx_type === "RECEIPT"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                          : entry.tx_type === "ISSUE"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        entry.tx_type === "RECEIPT" ? "bg-emerald-500" : entry.tx_type === "ISSUE" ? "bg-rose-500" : "bg-blue-500"
                      }`} />
                      {entry.tx_type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-800 dark:text-zinc-200">
                    {entry.item_sku}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300 font-mono text-[11px]">
                    {entry.warehouse}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold ${entry.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold tabular-nums text-slate-900 dark:text-zinc-100">
                    {entry.balance_after}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-400 font-medium">
                    ${entry.unit_cost.toFixed(2)}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-mono tabular-nums font-semibold ${entry.total_cost >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {entry.total_cost >= 0 ? `+$${entry.total_cost.toFixed(2)}` : `-$${Math.abs(entry.total_cost).toFixed(2)}`}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-500">
                    {entry.user}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
