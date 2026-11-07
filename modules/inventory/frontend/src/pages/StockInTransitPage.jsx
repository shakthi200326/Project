import React, { useState, useEffect, useMemo } from "react";
import {
  Truck,
  Package,
  Calendar,
  Clock,
  ArrowRight,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Eye,
  X,
  RefreshCw,
  MapPin,
  Barcode,
} from "lucide-react";
import { fetchStockInTransit, fetchWarehouses } from "../services/api";

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
      setTransfers(transitData.results || (Array.isArray(transitData) ? transitData : []));
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
      const carrier = String(item.carrier || "").toLowerCase();
      const tracking = String(item.tracking_reference || "").toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch =
        transferNo.includes(term) ||
        prodName.includes(term) ||
        sku.includes(term) ||
        carrier.includes(term) ||
        tracking.includes(term);

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
      if (dateFilter !== "ALL" && (item.transfer_date || item.transaction_date)) {
        const itemDate = new Date(item.transfer_date || item.transaction_date);
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
    return filteredTransfers.reduce((sum, t) => sum + (Number(t.dispatched_quantity) || 0), 0);
  }, [filteredTransfers]);

  const totalReceived = useMemo(() => {
    return filteredTransfers.reduce((sum, t) => sum + (Number(t.received_quantity) || 0), 0);
  }, [filteredTransfers]);

  const totalPendingInTransit = useMemo(() => {
    return filteredTransfers.reduce((sum, t) => {
      const dispatched = Number(t.dispatched_quantity) || 0;
      const received = Number(t.received_quantity) || 0;
      const pending = t.pending_quantity !== undefined ? Number(t.pending_quantity) : Math.max(0, dispatched - received);
      return sum + pending;
    }, 0);
  }, [filteredTransfers]);

  const activeShipmentsCount = useMemo(() => {
    return filteredTransfers.filter(
      (t) => (t.transit_status || t.status) !== "Received" && (Number(t.dispatched_quantity) || 0) > (Number(t.received_quantity) || 0)
    ).length;
  }, [filteredTransfers]);

  const getStatusBadge = (status) => {
    const s = String(status || "In Transit").toLowerCase();
    if (s.includes("partially")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
          <Clock className="h-3 w-3" />
          Partially Received
        </span>
      );
    }
    if (s.includes("received") || s.includes("completed")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
          <CheckCircle2 className="h-3 w-3" />
          Received
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
        <Truck className="h-3 w-3" />
        In Transit
      </span>
    );
  };

  const handleExportCSV = () => {
    const headers = [
      "Transfer Number",
      "Transfer Date",
      "Source Warehouse",
      "Source Location",
      "Destination Warehouse",
      "Destination Location",
      "Product Name",
      "SKU",
      "Dispatched Qty",
      "Received Qty",
      "Pending In-Transit Qty",
      "Carrier",
      "Tracking Number",
      "Status",
    ];

    const rows = filteredTransfers.map((item) => {
      const dispatched = Number(item.dispatched_quantity) || 0;
      const received = Number(item.received_quantity) || 0;
      const pending = item.pending_quantity !== undefined ? Number(item.pending_quantity) : Math.max(0, dispatched - received);
      return [
        `"${item.transfer_number || item.document_number || ""}"`,
        `"${item.transfer_date || item.transaction_date || ""}"`,
        `"${item.source_warehouse || item.source_warehouse_name || ""}"`,
        `"${item.source_location || item.source_location_code || ""}"`,
        `"${item.destination_warehouse || item.destination_warehouse_name || ""}"`,
        `"${item.destination_location || item.destination_location_code || ""}"`,
        `"${(item.product || item.product_name || "").replace(/"/g, '""')}"`,
        `"${item.sku || ""}"`,
        dispatched,
        received,
        pending,
        `"${item.carrier || ""}"`,
        `"${item.tracking_reference || ""}"`,
        `"${item.transit_status || item.status || "In Transit"}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_in_transit_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock in transit exported to CSV successfully.");
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Stock in Transit
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
              <Truck className="h-3.5 w-3.5" />
              Inter-Facility Pipeline
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Real-time tracking of inter-warehouse transfers dispatched from origin and pending receipt at destination.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Refresh In-Transit Stock"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Pending In-Transit
          </div>
          <div className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {totalPendingInTransit.toLocaleString()} <span className="text-xs font-normal text-slate-400">EA</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Physical goods currently in movement</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Total Dispatched
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            {totalDispatched.toLocaleString()} <span className="text-xs font-normal text-slate-400">EA</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Total outbound stock released</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Total Received
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
          <div className="text-[11px] text-slate-400 mt-0.5">Transfers requiring arrival check-in</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transfer #, product, SKU, carrier..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Source Warehouse Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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

      {/* Stock In Transit Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/40 text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                <th className="py-3 px-4">Transfer Number</th>
                <th className="py-3 px-4">Transfer Date</th>
                <th className="py-3 px-4">Origin</th>
                <th className="py-3 px-4">Destination</th>
                <th className="py-3 px-4">Product / Manifest</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4 text-right">Dispatched</th>
                <th className="py-3 px-4 text-right">Received</th>
                <th className="py-3 px-4 text-right font-bold">In-Transit</th>
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
                  const hasLines = Array.isArray(item.lines) && item.lines.length > 0;

                  return (
                    <tr
                      key={item.id || transferNo}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Transfer Number */}
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {transferNo}
                      </td>

                      {/* Transfer Date */}
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                        {date}
                      </td>

                      {/* Origin */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-zinc-200">{src}</div>
                        {item.source_location && (
                          <div className="font-mono text-[10px] text-slate-400">{item.source_location}</div>
                        )}
                      </td>

                      {/* Destination */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-zinc-200">
                          <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{dest}</span>
                        </div>
                        {item.destination_location && (
                          <div className="font-mono text-[10px] text-slate-400 ml-4.5">{item.destination_location}</div>
                        )}
                      </td>

                      {/* Product */}
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white" title={prod}>
                        <div className="max-w-[190px] truncate">{prod || (hasLines ? `${item.lines.length} Line Items` : "—")}</div>
                        {item.carrier && (
                          <div className="text-[10px] text-slate-400 font-normal">Carrier: {item.carrier}</div>
                        )}
                      </td>

                      {/* SKU */}
                      <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-600 dark:text-zinc-400">
                        {sku || (hasLines ? `${item.lines[0]?.item_code || "Manifest"}` : "—")}
                      </td>

                      {/* Dispatched */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                        {dispatched.toLocaleString()}
                      </td>

                      {/* Received */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                        {received.toLocaleString()}
                      </td>

                      {/* Pending In-Transit */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                        {pending.toLocaleString()}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {getStatusBadge(status)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setViewRecord(item)}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
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
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Transit Document {viewRecord.transfer_number || viewRecord.document_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Transfer Date</span>
                <span className="font-mono font-medium text-slate-800 dark:text-zinc-200">
                  {viewRecord.transfer_date || viewRecord.transaction_date || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Current Logistics Status</span>
                <div>{getStatusBadge(viewRecord.transit_status || viewRecord.status)}</div>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Origin Facility</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  {viewRecord.source_warehouse || viewRecord.source_warehouse_name}
                </span>
                {viewRecord.source_location && (
                  <span className="text-[11px] text-slate-500 block">Loc: {viewRecord.source_location}</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Destination Facility</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  {viewRecord.destination_warehouse || viewRecord.destination_warehouse_name}
                </span>
                {viewRecord.destination_location && (
                  <span className="text-[11px] text-slate-500 block">Loc: {viewRecord.destination_location}</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Carrier</span>
                <span className="font-medium text-slate-800 dark:text-zinc-200">
                  {viewRecord.carrier || "Standard Freight Carrier"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Tracking Number</span>
                <span className="font-mono font-medium text-blue-600 dark:text-blue-400">
                  {viewRecord.tracking_reference || "TRK-LOCAL-001"}
                </span>
              </div>

              {/* Quantities Summary Banner */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 col-span-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Dispatched</div>
                  <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">
                    {Number(viewRecord.dispatched_quantity) || 0}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-500 uppercase font-semibold">Received</div>
                  <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {Number(viewRecord.received_quantity) || 0}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-blue-500 uppercase font-semibold">In-Transit</div>
                  <div className="text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
                    {viewRecord.pending_quantity !== undefined ? Number(viewRecord.pending_quantity) : Math.max(0, (Number(viewRecord.dispatched_quantity) || 0) - (Number(viewRecord.received_quantity) || 0))}
                  </div>
                </div>
              </div>

              {/* Manifest Lines Breakdown */}
              {Array.isArray(viewRecord.lines) && viewRecord.lines.length > 0 && (
                <div className="col-span-2 border-t border-slate-100 dark:border-zinc-800 pt-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Manifest Line Items ({viewRecord.lines.length})
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[10px] uppercase font-semibold text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Item / SKU</th>
                          <th className="py-2 px-2 text-right">Dispatched</th>
                          <th className="py-2 px-2 text-right">Received</th>
                          <th className="py-2 px-3 text-right font-bold">In-Transit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                        {viewRecord.lines.map((l, i) => (
                          <tr key={i}>
                            <td className="py-2 px-3">
                              <div className="font-semibold text-slate-900 dark:text-white">{l.item_name || l.item_code}</div>
                              <div className="font-mono text-[10px] text-slate-400">{l.item_code}</div>
                            </td>
                            <td className="py-2 px-2 text-right font-mono">{Number(l.quantity) || 0}</td>
                            <td className="py-2 px-2 text-right font-mono text-emerald-600">{Number(l.received_quantity) || 0}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-blue-600">{Number(l.pending_quantity) || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setViewRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer"
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
