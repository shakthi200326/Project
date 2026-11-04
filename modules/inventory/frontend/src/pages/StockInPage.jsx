import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowDownLeft,
  Search,
  Filter,
  Download,
  Calendar,
  Building2,
  Package,
  Layers,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { fetchStockInHistory, fetchWarehouses } from "../services/api";

export function StockInPage() {
  const [inwardRecords, setInwardRecords] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [movementFilter, setMovementFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTx, setSelectedTx] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ledgerRes, whRes] = await Promise.all([
        fetchStockInHistory({ warehouse: warehouseFilter !== "ALL" ? warehouseFilter : undefined }),
        fetchWarehouses(),
      ]);
      const results = ledgerRes.results || ledgerRes || [];
      setInwardRecords(Array.isArray(results) ? results : []);
      const whList = whRes.results || whRes || [];
      setWarehouses(Array.isArray(whList) ? whList : []);
    } catch (e) {
      console.error("Failed to load stock in records", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [warehouseFilter]);

  const filteredRecords = useMemo(() => {
    return inwardRecords.filter((rec) => {
      const matchesSearch =
        !search ||
        (rec.transaction_ref && rec.transaction_ref.toLowerCase().includes(search.toLowerCase())) ||
        (rec.sku && rec.sku.toLowerCase().includes(search.toLowerCase())) ||
        (rec.product_name && rec.product_name.toLowerCase().includes(search.toLowerCase())) ||
        (rec.batch_number && rec.batch_number.toLowerCase().includes(search.toLowerCase())) ||
        (rec.reason && rec.reason.toLowerCase().includes(search.toLowerCase()));

      const matchesWh =
        warehouseFilter === "ALL" ||
        String(rec.warehouse_id) === String(warehouseFilter) ||
        rec.warehouse === warehouseFilter ||
        rec.warehouse_name === warehouseFilter;

      const matchesType =
        movementFilter === "ALL" ||
        rec.movement_type === movementFilter ||
        (rec.reason && rec.reason.toLowerCase().includes(movementFilter.toLowerCase()));

      let matchesDate = true;
      if (startDate && rec.created_at) {
        matchesDate = matchesDate && rec.created_at.slice(0, 10) >= startDate;
      }
      if (endDate && rec.created_at) {
        matchesDate = matchesDate && rec.created_at.slice(0, 10) <= endDate;
      }

      return matchesSearch && matchesWh && matchesType && matchesDate;
    });
  }, [inwardRecords, search, warehouseFilter, movementFilter, startDate, endDate]);

  const summary = useMemo(() => {
    const totalQty = filteredRecords.reduce((acc, r) => acc + Math.abs(Number(r.quantity_delta || r.quantity || 0)), 0);
    const grnCount = filteredRecords.filter((r) => (r.transaction_ref || "").startsWith("GRN")).length;
    const opnCount = filteredRecords.filter((r) => (r.transaction_ref || "").startsWith("OPN") || (r.reason || "").includes("Opening")).length;
    const trfCount = filteredRecords.filter((r) => r.movement_type === "TRANSFER_IN" || (r.transaction_ref || "").startsWith("TRF")).length;
    const retCount = filteredRecords.filter((r) => r.movement_type === "RETURN" || (r.transaction_ref || "").startsWith("RET")).length;
    return { totalQty, grnCount, opnCount, trfCount, retCount };
  }, [filteredRecords]);

  const exportCSV = () => {
    const headers = ["Reference", "Date", "Movement Type", "Item Code", "Product Name", "Warehouse", "Location", "Quantity Delta", "Balance After", "Batch", "Serial", "Reason"];
    const rows = filteredRecords.map((r) => [
      r.transaction_ref || "",
      r.created_at ? r.created_at.slice(0, 10) : "",
      r.movement_type || "INWARD",
      r.sku || r.item_code || "",
      r.product_name || r.item_name || "",
      r.warehouse_name || r.warehouse || "",
      r.location_name || r.location || "",
      r.quantity_delta || "",
      r.balance_after || "",
      r.batch_number || "",
      r.serial_number || "",
      r.reason || "",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_in_register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <ArrowDownLeft className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Stock In Register</h1>
              <p className="text-sm text-slate-400">
                Authoritative register of inward stock intake across Goods Receipt, Opening Stock, Transfers & Customer Returns.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Package className="h-4 w-4 text-emerald-400" />
            Total Inward Units
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{summary.totalQty.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Across {filteredRecords.length} posted records</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <CheckCircle2 className="h-4 w-4 text-blue-400" />
            Goods Receipts (GRN)
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-400">{summary.grnCount}</div>
          <div className="text-xs text-slate-500">PO & Direct Receipts</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Layers className="h-4 w-4 text-purple-400" />
            Opening Stock
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-400">{summary.opnCount}</div>
          <div className="text-xs text-slate-500">System Initialization</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Building2 className="h-4 w-4 text-cyan-400" />
            Transfers In
          </div>
          <div className="mt-2 text-2xl font-bold text-cyan-400">{summary.trfCount}</div>
          <div className="text-xs text-slate-500">Inter-Warehouse/Loc</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Clock className="h-4 w-4 text-amber-400" />
            Customer Returns
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">{summary.retCount}</div>
          <div className="text-xs text-slate-500">Restocked items</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference, item code, product, batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} - {wh.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={movementFilter}
              onChange={(e) => setMovementFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Inward Types</option>
              <option value="RECEIPT">Goods Receipt / Opening</option>
              <option value="TRANSFER_IN">Transfer In</option>
              <option value="RETURN">Customer Return In</option>
              <option value="ADJUSTMENT">Positive Adjustment</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-800/60 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Transaction Ref</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Source / Type</th>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Warehouse & Loc</th>
                <th className="py-3 px-4 text-right">Inward Qty</th>
                <th className="py-3 px-4 text-right">Balance After</th>
                <th className="py-3 px-4">Batch / Serials</th>
                <th className="py-3 px-4">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    Loading Stock In transactions...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No inward stock transactions found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => {
                  const qty = Number(rec.quantity_delta || rec.quantity || 0);
                  const isGRN = (rec.transaction_ref || "").startsWith("GRN");
                  const isOPN = (rec.transaction_ref || "").startsWith("OPN") || (rec.reason || "").includes("Opening");
                  const isTRF = rec.movement_type === "TRANSFER_IN" || (rec.transaction_ref || "").startsWith("TRF");
                  const isRET = rec.movement_type === "RETURN" || (rec.transaction_ref || "").startsWith("RET");

                  return (
                    <tr key={rec.id || idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-medium text-emerald-400">
                        {rec.transaction_ref || `TX-${rec.id}`}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {rec.created_at ? rec.created_at.slice(0, 10) : rec.transaction_date || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isGRN
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : isOPN
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : isTRF
                              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                              : isRET
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {isGRN ? "Goods Receipt" : isOPN ? "Opening Stock" : isTRF ? "Transfer In" : isRET ? "Return In" : rec.movement_type || "Inward"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100">{rec.product_name || rec.item_name || "—"}</div>
                        <div className="text-xs font-mono text-slate-400">{rec.sku || rec.item_code || "—"}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-slate-200">{rec.warehouse_name || rec.warehouse || "—"}</div>
                        <div className="text-slate-500">{rec.location_name || rec.location || "Default Loc"}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                        +{Math.abs(qty).toLocaleString()} {rec.transaction_uom || "EA"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {Number(rec.balance_after || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-400">
                        {rec.batch_number ? (
                          <div className="text-amber-400">B: {rec.batch_number}</div>
                        ) : null}
                        {rec.serial_number ? (
                          <div className="text-cyan-400">S: {rec.serial_number}</div>
                        ) : null}
                        {!rec.batch_number && !rec.serial_number ? "—" : null}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">{rec.actor || "system"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default StockInPage;

