import React, { useState, useEffect } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  BookmarkCheck,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Warehouse,
  RotateCcw,
} from "lucide-react";
import { fetchStockMovements } from "../services/api";
import { StockTransactionModal } from "../components/StockTransactionModal.jsx";

export function StockMovementsPage({ initialType = "ALL" }) {
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState(initialType);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    setActiveTab(initialType);
  }, [initialType]);

  useEffect(() => {
    fetchStockMovements().then((data) => setMovements(data.results || []));
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredMovements = movements.filter((m) => {
    const matchesTab = activeTab === "ALL" || m.type === activeTab;
    const matchesSearch =
      m.document_number?.toLowerCase().includes(search.toLowerCase()) ||
      m.item?.toLowerCase().includes(search.toLowerCase()) ||
      m.warehouse?.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleTransactionPosted = (newTx) => {
    setMovements((prev) => [newTx, ...prev]);
    showToast(`Transaction ${newTx.document_number} posted successfully.`);
  };

  const handleExportRegister = () => {
    const headers = [
      "Document No",
      "Operation Type",
      "Timestamp",
      "Product Item",
      "Warehouse",
      "Storage Location",
      "Quantity Delta",
      "Unit Cost (USD)",
      "Status",
    ];

    const rows = filteredMovements.map((m) => [
      `"${m.document_number}"`,
      m.type,
      `"${new Date(m.created_at).toISOString()}"`,
      `"${m.item}"`,
      `"${m.warehouse}"`,
      `"${m.location || ""}"`,
      m.quantity,
      (m.unit_cost || 0).toFixed(2),
      m.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Stock_Movements_Register_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock movements register exported as CSV.");
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Stock Operations & Movements
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Post goods receipts, issues, inter-warehouse transfers, cycle adjustments & reversals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportRegister}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Register</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Operation</span>
          </button>
        </div>
      </div>

      {/* Modern Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200/80 dark:border-zinc-800/80 text-xs">
        {[
          { key: "ALL", label: "All Movements" },
          { key: "RECEIPT", label: "Goods Receipts (In)" },
          { key: "ISSUE", label: "Stock Issues (Out)" },
          { key: "TRANSFER", label: "Warehouse Transfers" },
          { key: "ADJUSTMENT", label: "Cycle Adjustments" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-2.5 font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
                : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by document number, product name or facility..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono tabular-nums">
          {filteredMovements.length} transactions recorded
        </span>
      </div>

      {/* Movements Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">Document No.</th>
                <th className="py-3.5 px-4 font-semibold">Type</th>
                <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                <th className="py-3.5 px-4 font-semibold">Product Item</th>
                <th className="py-3.5 px-4 font-semibold">Warehouse / Bin</th>
                <th className="py-3.5 px-4 font-semibold text-right">Quantity Delta</th>
                <th className="py-3.5 px-4 font-semibold text-right">Unit Cost</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredMovements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                      {m.document_number}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        m.type === "RECEIPT"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                          : m.type === "ISSUE"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                          : m.type === "TRANSFER"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50"
                          : "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50"
                      }`}
                    >
                      {m.type === "RECEIPT" && <ArrowDownLeft className="h-3 w-3" />}
                      {m.type === "ISSUE" && <ArrowUpRight className="h-3 w-3" />}
                      {m.type === "TRANSFER" && <ArrowLeftRight className="h-3 w-3" />}
                      {m.type === "ADJUSTMENT" && <SlidersHorizontal className="h-3 w-3" />}
                      {m.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                    {new Date(m.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {m.item}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                    <div className="font-medium">{m.warehouse}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{m.location}</div>
                  </td>
                  <td className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold ${m.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-zinc-200"}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.unit}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300 font-medium">
                    ${m.unit_cost?.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700">
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Modal */}
      <StockTransactionModal
        isOpen={isModalOpen}
        initialType={activeTab === "ALL" ? "RECEIPT" : activeTab}
        onClose={() => setIsModalOpen(false)}
        onPosted={handleTransactionPosted}
      />
    </div>
  );
}
