import React, { useState, useEffect, useMemo } from "react";
import {
  Truck,
  ArrowRight,
  Download,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  Clock,
  Check,
  RefreshCw,
  Eye,
  X,
  PackageCheck,
  AlertCircle,
} from "lucide-react";
import {
  fetchStockInTransit,
  fetchWarehouses,
} from "../services/api";

export function StockInTransitPage() {
  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [destFilter, setDestFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [viewRecord, setViewRecord] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [transitData, whData] = await Promise.all([
        fetchStockInTransit(),
        fetchWarehouses(),
      ]);
      setTransfers(transitData.results || transitData || []);
      setWarehouses(whData || []);
    } catch (e) {
      console.error("Failed to load in-transit stock", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTransfers = useMemo(() => {
    return transfers.filter((item) => {
      const transferNo = String(item.transfer_number || item.document_number || "").toLowerCase();
      const prodName = String(item.product || item.product_name || "").toLowerCase();
      const sku = String(item.sku || "").toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch =
        transferNo.includes(term) || prodName.includes(term) || sku.includes(term);

      const srcName = item.source_warehouse || item.source_warehouse_name || "";
      const matchesSource =
        sourceFilter === "ALL" ||
        srcName === sourceFilter ||
        item.source_warehouse_code === sourceFilter;

      const destName = item.destination_warehouse || item.destination_warehouse_name || "";
      const matchesDest =
        destFilter === "ALL" ||
        destName === destFilter ||
        item.destination_warehouse_code === destFilter;

      const status = item.transit_status || item.status || "In Transit";
      const matchesStatus =
        statusFilter === "ALL" ||
        status.toLowerCase() === statusFilter.toLowerCase();

      let matchesDate = true;
      if (dateFilter !== "ALL" && item.transfer_date) {
        const itemDate = new Date(item.transfer_date);
        const now = new Date();
        if (dateFilter === "TODAY") {
          matchesDate = itemDate.toDateString() === now.toDateString();
        } else if (dateFilter === "7D") {
          const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = itemDate >= past;
        } else if (dateFilter === "30D") {
          const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = itemDate >= past;
        }
      }

      return matchesSearch && matchesSource && matchesDest && matchesStatus && matchesDate;
    });
  }, [transfers, searchTerm, sourceFilter, destFilter, statusFilter, dateFilter]);

  // Aggregate Metrics
  const totalDispatched = useMemo(() => {
    return transfers.reduce((sum, t) => sum + (Number(t.dispatched_quantity) || 0), 0);
  }, [transfers]);

  const totalPendingInTransit = useMemo(() => {
    return transfers.reduce((sum, t) => sum + (Number(t.pending_quantity) || 0), 0);
  }, [transfers]);

  const totalReceived = useMemo(() => {
    return transfers.reduce((sum, t) => sum + (Number(t.received_quantity) || 0), 0);
  }, [transfers]);

  const activeShipmentsCount = useMemo(() => {
    return transfers.filter((t) => {
      const st = (t.transit_status || t.status || "").toLowerCase();
      return st !== "received" && (Number(t.pending_quantity) > 0 || st === "in transit");
    }).length;
  }, [transfers]);

  const handleExportCSV = () => {
    const headers = [
      "Transfer Number",
      "Transfer Date",
      "Source Warehouse",
      "Destination Warehouse",
      "Product Name",
      "SKU",
      "Dispatched Qty",
      "Received Qty",
      "Pending Qty",
      "Status",
    ];

    const rows = filteredTransfers.map((t) => [
      t.transfer_number || t.document_number,
      t.transfer_date || t.transaction_date,
      t.source_warehouse || t.source_warehouse_name,
      t.destination_warehouse || t.destination_warehouse_name,
      t.product || t.product_name,
      t.sku,
      t.dispatched_quantity,
      t.received_quantity,
      t.pending_quantity,
      t.transit_status || t.status || "In Transit",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((x) => `"${x || ""}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Stock_In_Transit_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock in transit register exported as CSV.");
  };

  const getStatusBadge = (status) => {
    const s = String(status || "In Transit").toLowerCase();
    if (s.includes("partially")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50">
          <Clock className="h-3 w-3" /> Partially Received
        </span>
      );
    }
    if (s.includes("received")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
          <CheckCircle2 className="h-3 w-3" /> Received
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
        <Truck className="h-3 w-3 text-blue-500 animate-pulse" /> In Transit
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900/95 dark:bg-white/95 text-white dark:text-zinc-900 shadow-2xl backdrop-blur-md border border-slate-700/50 dark:border-zinc-200/50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Stock in Transit
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
              <Truck className="h-3 w-3 text-blue-500" /> Inter-Warehouse Logistics
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Track stock dispatched from origin warehouses pending physical receipt and check-in at destination.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xs cursor-pointer transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xs cursor-pointer transition-all"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Dispatched Quantity
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            {totalDispatched.toLocaleString()} <span className="text-xs font-normal text-slate-400">EA</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Cumulative origin issues</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Active In-Transit Stock
          </div>
          <div className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {totalPendingInTransit.toLocaleString()} <span className="text-xs font-normal text-slate-400">EA</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Pending destination receipt</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Total Received Quantity
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {totalReceived.toLocaleString()} <span className="text-xs font-normal text-slate-400">EA</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Checked into destination stock</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Active Shipments
          </div>
          <div className="text-2xl font-bold tabular-nums text-purple-600 dark:text-purple-400 mt-1">
            {activeShipmentsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Shipments currently moving</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transfer #, product, SKU..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Source Warehouse Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Source Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id || wh.code} value={wh.name || wh.code}>
                From: {wh.name || wh.code}
              </option>
            ))}
          </select>

          {/* Destination Warehouse Filter */}
          <select
            value={destFilter}
            onChange={(e) => setDestFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Destination Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id || wh.code} value={wh.name || wh.code}>
                To: {wh.name || wh.code}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="In Transit">In Transit</option>
            <option value="Partially Received">Partially Received</option>
            <option value="Received">Received</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today</option>
            <option value="7D">Last 7 Days</option>
            <option value="30D">Last 30 Days</option>
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Showing <span className="font-semibold text-slate-700 dark:text-zinc-200">{filteredTransfers.length}</span> transfers
        </div>
      </div>

      {/* Stock In Transit Table (Strictly Necessary Fields) */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/40 text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-4">Transfer Number</th>
                <th className="py-3 px-4">Transfer Date</th>
                <th className="py-3 px-4">Source Warehouse</th>
                <th className="py-3 px-4">Destination Warehouse</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4 text-right">Dispatched Qty</th>
                <th className="py-3 px-4 text-right">Received Qty</th>
                <th className="py-3 px-4 text-right font-bold">Pending Qty</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <Truck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold">No stock in transit matching criteria</p>
                    <p className="text-[11px] mt-0.5">Dispatched transfers will automatically appear here until fully received.</p>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((item) => {
                  const transferNo = item.transfer_number || item.document_number;
                  const date = item.transfer_date || item.transaction_date;
                  const src = item.source_warehouse || item.source_warehouse_name;
                  const dest = item.destination_warehouse || item.destination_warehouse_name;
                  const prod = item.product || item.product_name;
                  const sku = item.sku;
                  const dispatched = Number(item.dispatched_quantity) || 0;
                  const received = Number(item.received_quantity) || 0;
                  const pending = item.pending_quantity !== undefined ? Number(item.pending_quantity) : Math.max(0, dispatched - received);
                  const status = item.transit_status || item.status || "In Transit";

                  return (
                    <tr
                      key={item.id || transferNo}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* 1. Transfer Number */}
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {transferNo}
                      </td>

                      {/* 2. Transfer Date */}
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-zinc-400">
                        {date}
                      </td>

                      {/* 3. Source Warehouse */}
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-zinc-200">
                        {src}
                      </td>

                      {/* 4. Destination Warehouse */}
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-zinc-200">
                        <div className="flex items-center gap-1.5">
                          <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{dest}</span>
                        </div>
                      </td>

                      {/* 5. Product */}
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white max-w-[200px] truncate" title={prod}>
                        {prod}
                      </td>

                      {/* 6. SKU */}
                      <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-600 dark:text-zinc-400">
                        {sku}
                      </td>

                      {/* 7. Dispatched Quantity */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                        {dispatched.toLocaleString()}
                      </td>

                      {/* 8. Received Quantity */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                        {received.toLocaleString()}
                      </td>

                      {/* 9. Pending Quantity */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                        {pending.toLocaleString()}
                      </td>

                      {/* 10. Status */}
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(status)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setViewRecord(item)}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                          title="View Transfer Dispatch Details"
                        >
                          <Eye className="h-4 w-4" />
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

      {/* Transfer Details Modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Transit Document {viewRecord.transfer_number || viewRecord.document_number}
                </h3>
              </div>
              <button
                onClick={() => setViewRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Transfer Date</span>
                <span className="font-mono font-medium text-slate-800 dark:text-zinc-200">
                  {viewRecord.transfer_date || viewRecord.transaction_date}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Current Logistics Status</span>
                <div>{getStatusBadge(viewRecord.transit_status || viewRecord.status)}</div>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Source Warehouse (Origin)</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  {viewRecord.source_warehouse || viewRecord.source_warehouse_name}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Destination Warehouse (Target)</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  {viewRecord.destination_warehouse || viewRecord.destination_warehouse_name}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block mb-0.5">Product Asset</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {viewRecord.product || viewRecord.product_name}
                </span>
                <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 block mt-0.5">
                  SKU: {viewRecord.sku}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 col-span-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Dispatched</div>
                  <div className="text-base font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">
                    {Number(viewRecord.dispatched_quantity) || 0}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-500 uppercase font-semibold">Received</div>
                  <div className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {Number(viewRecord.received_quantity) || 0}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-blue-500 uppercase font-semibold">Pending In-Transit</div>
                  <div className="text-base font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
                    {viewRecord.pending_quantity !== undefined ? Number(viewRecord.pending_quantity) : Math.max(0, (Number(viewRecord.dispatched_quantity) || 0) - (Number(viewRecord.received_quantity) || 0))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-zinc-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default StockInTransitPage;

