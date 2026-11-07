import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Building2,
  MapPin,
  Tag,
  ShieldCheck,
  Package,
  Layers,
  Clock,
  Sparkles,
  Truck,
  ArrowRight,
  Send,
  Eye,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  fetchTransfers,
  fetchInterWarehouseTransfers,
  submitTransfer,
  approveTransfer,
  dispatchTransfer,
  completeTransfer,
} from "../services/transferApi";
import { fetchWarehouses } from "../services/api";
import { StockTransferCreateModal } from "../components/StockTransferCreateModal";
import { TransferDetailsModal } from "../components/TransferDetailsModal";

const STATUS_BADGES = {
  DRAFT: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  SUBMITTED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  APPROVED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  DISPATCHED: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  IN_TRANSIT: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  RECEIVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  COMPLETED: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  REJECTED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  CANCELLED: "bg-slate-700/30 text-slate-500 border-slate-700",
};

export function StockTransferPage({ mode = "ALL" }) {
  const isInterWarehouseMode = mode === "INTER_WAREHOUSE";
  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("ALL"); // ALL | SAME_CITY | INTER_CITY
  const [sourceWarehouseFilter, setSourceWarehouseFilter] = useState("ALL");
  const [destWarehouseFilter, setDestWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    loadData();
  }, [mode, scopeFilter, sourceWarehouseFilter, destWarehouseFilter, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (scopeFilter !== "ALL") params.transfer_scope = scopeFilter;
      if (sourceWarehouseFilter !== "ALL") params.source_warehouse = sourceWarehouseFilter;
      if (destWarehouseFilter !== "ALL") params.destination_warehouse = destWarehouseFilter;
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const [trfRes, whRes] = await Promise.all([
        isInterWarehouseMode ? fetchInterWarehouseTransfers(params) : fetchTransfers(params),
        fetchWarehouses(),
      ]);

      const list = trfRes.results || (Array.isArray(trfRes) ? trfRes : []);
      setTransfers(list);
      setWarehouses(Array.isArray(whRes) ? whRes : whRes.results || []);
    } catch (e) {
      console.error("Failed to load transfers", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleViewDetails = (id) => {
    setSelectedTransferId(id);
    setIsDetailsModalOpen(true);
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = transfers.length;
    const inTransit = transfers.filter((t) => t.status === "IN_TRANSIT" || t.status === "DISPATCHED").length;
    const completed = transfers.filter((t) => t.status === "COMPLETED" || t.status === "RECEIVED").length;
    const sameCity = transfers.filter((t) => t.transfer_scope === "SAME_CITY").length;
    const interCity = transfers.filter((t) => t.transfer_scope === "INTER_CITY").length;
    const totalQty = transfers.reduce((acc, t) => acc + (t.lines?.reduce((s, l) => s + Number(l.quantity || 0), 0) || 0), 0);

    return { total, inTransit, completed, sameCity, interCity, totalQty };
  }, [transfers]);

  // Export CSV
  const exportToCSV = () => {
    if (!transfers.length) {
      showToast("No transfers available to export.");
      return;
    }
    const headers = [
      "Transfer Number",
      "Date",
      "Scope",
      "Source Warehouse",
      "Source City",
      "Destination Warehouse",
      "Destination City",
      "Status",
      "Items Count",
      "Total Quantity",
      "Created By",
    ];
    const rows = transfers.map((t) => [
      t.document_number,
      t.transaction_date,
      t.transfer_scope,
      t.source_warehouse_name,
      t.source_city,
      t.destination_warehouse_name,
      t.destination_city,
      t.status,
      t.lines?.length || 0,
      t.lines?.reduce((s, l) => s + Number(l.quantity || 0), 0) || 0,
      t.created_by_username || "Admin",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((x) => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `stock_transfers_${isInterWarehouseMode ? "inter_wh" : "all"}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock Transfers exported successfully.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl shadow-2xl animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {isInterWarehouseMode ? "Inter-Warehouse Transfer" : "Stock Transfer"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {isInterWarehouseMode
                  ? "Enterprise warehouse-to-warehouse logistics spanning Same-City and Inter-City transfers"
                  : "Central stock movement management across all facility nodes and inventory hubs"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportToCSV}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 rounded-xl hover:bg-slate-800 hover:text-white transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-400" />
            Export CSV
          </button>
          <button
            onClick={() => loadData()}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/25 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Initiate Transfer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <div className="text-xs font-medium text-slate-400">Total Transfers</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-1">All recorded documents</div>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <div className="text-xs font-medium text-purple-400 flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" />
            Active In-Transit
          </div>
          <div className="text-2xl font-bold text-purple-300 mt-1">{stats.inTransit}</div>
          <div className="text-[11px] text-slate-500 mt-1">On road or pending receive</div>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <div className="text-xs font-medium text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">{stats.completed}</div>
          <div className="text-[11px] text-slate-500 mt-1">Fully received & posted</div>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <div className="text-xs font-medium text-blue-400">Same-City Transfers</div>
          <div className="text-2xl font-bold text-blue-300 mt-1">{stats.sameCity}</div>
          <div className="text-[11px] text-slate-500 mt-1">Direct local transit</div>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl col-span-2 lg:col-span-1">
          <div className="text-xs font-medium text-indigo-400">Inter-City Transfers</div>
          <div className="text-2xl font-bold text-indigo-300 mt-1">{stats.interCity}</div>
          <div className="text-[11px] text-slate-500 mt-1">Long haul freight</div>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Keyword Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search transfer no, item, SKU, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Scope Filter */}
          <div>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Scopes (Same & Inter-City)</option>
              <option value="SAME_CITY">Same-City Only</option>
              <option value="INTER_CITY">Inter-City Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="IN_TRANSIT">In-Transit</option>
              <option value="RECEIVED">Received</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Source Warehouse */}
          <div>
            <select
              value={sourceWarehouseFilter}
              onChange={(e) => setSourceWarehouseFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Source Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.city || "N/A"})
                </option>
              ))}
            </select>
          </div>

          {/* Destination Warehouse */}
          <div>
            <select
              value={destWarehouseFilter}
              onChange={(e) => setDestWarehouseFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Destination Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.city || "N/A"})
                </option>
              ))}
            </select>
          </div>
        </form>
      </div>

      {/* Main Transfers Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Transfer No</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Scope</th>
                <th className="px-5 py-3.5">Source (City)</th>
                <th className="px-5 py-3.5">Destination (City)</th>
                <th className="px-5 py-3.5 text-center">Items</th>
                <th className="px-5 py-3.5 text-right">Total Qty</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Fetching transfers...</span>
                    </div>
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <ArrowLeftRight className="w-8 h-8 text-slate-600" />
                      <p className="text-sm font-medium text-slate-400">No stock transfers found</p>
                      <p className="text-xs text-slate-500">
                        Adjust filters or click "Initiate Transfer" to create a new movement.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                transfers.map((tx) => {
                  const isSame = tx.transfer_scope === "SAME_CITY";
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-800/30 transition cursor-pointer"
                      onClick={() => handleViewDetails(tx.id)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {tx.document_number}
                        </div>
                        {tx.source_document_number && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            Ref: {tx.source_document_number}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                        {tx.transaction_date || tx.created_at?.slice(0, 10)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            isSame
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }`}
                        >
                          {isSame ? "Same-City" : "Inter-City"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-white text-xs">
                          {tx.source_warehouse_name || `WH #${tx.source_warehouse}`}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {tx.source_city || "Chennai"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-white text-xs">
                          {tx.destination_warehouse_name || `WH #${tx.destination_warehouse}`}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {tx.destination_city || "Coimbatore"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center font-mono text-xs">
                        {tx.total_items ?? tx.lines?.length ?? 0}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-white text-xs">
                        {tx.total_quantity ??
                          tx.lines?.reduce((s, l) => s + Number(l.quantity || 0), 0) ??
                          0}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                            STATUS_BADGES[tx.status] || "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleViewDetails(tx.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Creation Modal (Reusing GRN Product Modal) */}
      <StockTransferCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newTx) => {
          showToast(`Transfer ${newTx.document_number} saved successfully.`);
          loadData();
        }}
      />

      {/* Details & Workflow Transition Modal */}
      <TransferDetailsModal
        transferId={selectedTransferId}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedTransferId(null);
        }}
        onRefresh={() => loadData()}
      />
    </div>
  );
}

export default StockTransferPage;
