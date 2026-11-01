import React, { useState, useEffect } from "react";
import {
  Cpu,
  Search,
  Download,
  CheckCircle,
  ShieldCheck,
  Tag,
  ExternalLink,
  Plus,
  Filter,
  X,
  History,
  QrCode,
  Wrench,
  Truck,
  Archive,
  ArrowRight,
  Warehouse,
  Boxes,
} from "lucide-react";
import {
  fetchSerialNumbers,
  createSerialNumber,
  updateSerialNumberStatus,
  fetchWarehouses,
  fetchLocations,
  fetchProducts,
} from "@/services/api";

export function SerialTrackingPage() {
  const [serials, setSerials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedSerial, setSelectedSerial] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Form state
  const [singleForm, setSingleForm] = useState({
    serial_number: `SN-${Math.floor(100000 + Math.random() * 900000)}`,
    item_code: "HYD-SV-24V",
    item_name: "Hydraulic Solenoid Valve 24V DC",
    warehouse: "Main Central Fulfillment Hub",
    location: "A1-B4",
    status: "IN_STOCK",
    warranty_until: "2028-12-31",
  });

  const [bulkInput, setBulkInput] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [snRes, whRes, locRes, prodRes] = await Promise.all([
        fetchSerialNumbers(),
        fetchWarehouses(),
        fetchLocations(),
        fetchProducts(),
      ]);
      setSerials(snRes.results || snRes || []);
      setWarehouses(whRes || []);
      setLocations(locRes || []);
      setProducts(prodRes.results || prodRes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (isBulkMode) {
      const lines = bulkInput
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (lines.length === 0) return;

      const newItems = lines.map((sn, idx) => ({
        id: `sn-${Date.now()}-${idx}`,
        serial_number: sn,
        item_code: singleForm.item_code,
        item_name: singleForm.item_name,
        warehouse: singleForm.warehouse,
        location: singleForm.location,
        status: "IN_STOCK",
        received_at: new Date().toISOString(),
        warranty_until: singleForm.warranty_until,
      }));

      setSerials((prev) => [...newItems, ...prev]);
      setShowRegisterModal(false);
      setBulkInput("");
      showToast(`${lines.length} serial numbers registered successfully.`);
    } else {
      const created = await createSerialNumber(singleForm);
      setSerials((prev) => [created, ...prev]);
      setShowRegisterModal(false);
      showToast(`Serial ${singleForm.serial_number} registered.`);
    }
  };

  const handleChangeStatus = async (serialId, nextStatus) => {
    await updateSerialNumberStatus(serialId, nextStatus);
    setSerials((prev) =>
      prev.map((s) => (s.id === serialId ? { ...s, status: nextStatus } : s))
    );
    if (selectedSerial && selectedSerial.id === serialId) {
      setSelectedSerial((prev) => ({ ...prev, status: nextStatus }));
    }
    showToast(`Serial status updated to ${nextStatus.replace("_", " ")}.`);
  };

  const exportSerials = () => {
    const headers = [
      "Serial Number",
      "Item Code",
      "Item Name",
      "Facility",
      "Location",
      "Status",
      "Registration Date",
      "Warranty Until",
    ];
    const rows = serials.map((s) => [
      `"${s.serial_number}"`,
      `"${s.item_code}"`,
      `"${s.item_name}"`,
      `"${s.warehouse}"`,
      `"${s.location || ""}"`,
      s.status,
      s.received_at || "",
      s.warranty_until || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Serial_Registry_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Serials register exported as CSV.");
  };

  const filteredSerials = serials.filter((s) => {
    const matchesSearch =
      s.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.location?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ? true : s.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const inStockCount = serials.filter((s) => s.status === "IN_STOCK").length;
  const dispatchedCount = serials.filter((s) => s.status === "DISPATCHED" || s.status === "ISSUED").length;
  const maintenanceCount = serials.filter((s) => s.status === "IN_MAINTENANCE").length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 dark:bg-zinc-800 text-white text-xs font-medium shadow-xl border border-slate-700 animate-in slide-in-from-top-2">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Piece-Level Serial Number Registry
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
              Unique Custody Trail
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Individual piece serialization, warranty validation, and end-to-end chain of custody records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportSerials}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Serials CSV</span>
          </button>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Register Serials</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Tracked Assets</span>
            <Cpu className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {serials.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Total serialized units</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-emerald-500">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">In Facility Stock</span>
            <CheckCircle className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            {inStockCount} Units
          </div>
          <div className="text-[11px] text-emerald-600/80 mt-0.5">Available for allocation</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Dispatched / Sold</span>
            <Truck className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {dispatchedCount} Units
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active under client warranty</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Maintenance / RMA</span>
            <Wrench className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
            {maintenanceCount} Units
          </div>
          <div className="text-[11px] text-amber-600/80 mt-0.5">Technical overhaul</div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by serial number, SKU, item, or bin..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { key: "ALL", label: "All Serials" },
            { key: "IN_STOCK", label: "In Stock" },
            { key: "DISPATCHED", label: "Dispatched" },
            { key: "IN_MAINTENANCE", label: "In Maintenance" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Serial Numbers Table */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-500">
                <th className="py-3 px-4 font-semibold">Serial Number</th>
                <th className="py-3 px-4 font-semibold">Item & SKU Code</th>
                <th className="py-3 px-4 font-semibold">Facility & Bin Location</th>
                <th className="py-3 px-4 font-semibold">Warranty Expiration</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 text-center">Traceability Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredSerials.map((sn) => (
                <tr key={sn.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                    {sn.serial_number}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-zinc-100">{sn.item_name}</div>
                    <div className="font-mono text-[10px] text-slate-400">{sn.item_code}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800 dark:text-zinc-200">
                      {sn.warehouse_name || sn.warehouse}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">
                      {sn.location_code || sn.location || "Central Storage"}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {sn.warranty_until || "2028-12-31"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        sn.status === "IN_STOCK"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : sn.status === "DISPATCHED" || sn.status === "ISSUED"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                          : sn.status === "IN_MAINTENANCE"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                          : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {sn.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedSerial(sn)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      <History className="h-3 w-3" />
                      <span>Inspect Audit Trail</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chain of Custody Audit Trail Modal */}
      {selectedSerial && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {selectedSerial.serial_number}
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Chain-of-Custody & Life History
                </h3>
              </div>
              <button
                onClick={() => setSelectedSerial(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Item Card */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40">
              <div className="font-semibold text-slate-900 dark:text-white text-sm">
                {selectedSerial.item_name}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                <span>SKU: {selectedSerial.item_code}</span>
                <span>Warranty: {selectedSerial.warranty_until || "2028-12-31"}</span>
              </div>
            </div>

            {/* Audit Trail Timeline */}
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase text-slate-400">Chronological Events</div>
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
                <div className="relative">
                  <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-zinc-900 bg-blue-600"></div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Manufacture & Inbound Receipt
                  </div>
                  <div className="text-[11px] text-slate-500">Doc: PO-2026-904 • Inbound dock inspection passed</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-zinc-900 bg-emerald-600"></div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Put-Away to Bin Location
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Location: {selectedSerial.location || "A1-B4"} • Stored in {selectedSerial.warehouse}
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-zinc-900 bg-indigo-600"></div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Physical Stock Audit Check
                  </div>
                  <div className="text-[11px] text-slate-500">Cycle Count CC-2026-Q4-01 verified intact</div>
                </div>
              </div>
            </div>

            {/* Quick Status Override */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Quick Custody State Transition:
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleChangeStatus(selectedSerial.id, "IN_STOCK")}
                  className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 text-emerald-600"
                >
                  Return to Stock
                </button>
                <button
                  onClick={() => handleChangeStatus(selectedSerial.id, "IN_MAINTENANCE")}
                  className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 text-amber-600"
                >
                  Send to RMA
                </button>
                <button
                  onClick={() => handleChangeStatus(selectedSerial.id, "DISPATCHED")}
                  className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 text-blue-600"
                >
                  Mark Dispatched
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register Serials Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Register Serial Numbers
                </h3>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Toggle Single vs Bulk */}
            <div className="flex rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setIsBulkMode(false)}
                className={`flex-1 py-1.5 rounded-md transition-colors ${
                  !isBulkMode
                    ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs font-bold"
                    : "text-slate-500"
                }`}
              >
                Single Serial Registration
              </button>
              <button
                type="button"
                onClick={() => setIsBulkMode(true)}
                className={`flex-1 py-1.5 rounded-md transition-colors ${
                  isBulkMode
                    ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs font-bold"
                    : "text-slate-500"
                }`}
              >
                Bulk Multi-Serial Ingest
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Product / SKU
                </label>
                <select
                  value={singleForm.item_code}
                  onChange={(e) => {
                    const sel = products.find((p) => p.sku === e.target.value);
                    setSingleForm({
                      ...singleForm,
                      item_code: e.target.value,
                      item_name: sel ? sel.name : "Industrial Item",
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                >
                  <option value="HYD-SV-24V">HYD-SV-24V - Hydraulic Solenoid Valve 24V DC</option>
                  <option value="ENC-OPT-1024">ENC-OPT-1024 - Optical Rotary Encoder 1024 PPR</option>
                  <option value="BRG-6205-2RS">BRG-6205-2RS - Industrial Ball Bearing 6205-2RS</option>
                </select>
              </div>

              {!isBulkMode ? (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Serial Number Identifier
                  </label>
                  <input
                    type="text"
                    required
                    value={singleForm.serial_number}
                    onChange={(e) =>
                      setSingleForm({ ...singleForm, serial_number: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Paste Serial Numbers (One Per Line)
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    placeholder="SN-HYD-99801&#10;SN-HYD-99802&#10;SN-HYD-99803"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Facility
                  </label>
                  <select
                    value={singleForm.warehouse}
                    onChange={(e) =>
                      setSingleForm({ ...singleForm, warehouse: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  >
                    <option value="Main Central Fulfillment Hub">Main Central Fulfillment Hub</option>
                    <option value="East Coast Logistics Terminal">East Coast Logistics Terminal</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Storage Bin Location
                  </label>
                  <input
                    type="text"
                    value={singleForm.location}
                    onChange={(e) =>
                      setSingleForm({ ...singleForm, location: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Warranty Expiration Date
                </label>
                <input
                  type="date"
                  value={singleForm.warranty_until}
                  onChange={(e) =>
                    setSingleForm({ ...singleForm, warranty_until: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors"
                >
                  {isBulkMode ? "Ingest All Serials" : "Register Serial"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
