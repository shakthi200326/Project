import React, { useState, useEffect, useMemo } from "react";
import {
  Cpu,
  Search,
  Plus,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  X,
  Warehouse as WarehouseIcon,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  QrCode,
  Tag,
  Barcode,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchSerialNumbers,
  createSerialNumber,
  updateSerialNumberStatus,
  fetchProducts,
  fetchWarehouses,
  fetchLocations,
  fetchBatches,
} from "@/services/api";

export function SerialManagementPage() {
  const navigate = useNavigate();
  const [serials, setSerials] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Scanner simulation modal
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannedInput, setScannedInput] = useState("");

  // Form State - Exactly the 8 Phase 5 fields
  const [formData, setFormData] = useState({
    serial_number: "",
    product: "",
    sku: "",
    batch_number: "",
    warehouse: "",
    storage_location: "",
    received_date: new Date().toISOString().split("T")[0],
    serial_status: "Available",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, prodRes, whRes, locRes, bRes] = await Promise.all([
        fetchSerialNumbers(),
        fetchProducts(),
        fetchWarehouses(),
        fetchLocations(),
        fetchBatches(),
      ]);
      setSerials(sRes.results || sRes || []);
      setProducts(prodRes.results || prodRes || []);
      setWarehouses(whRes.results || whRes || []);
      setLocations(locRes.results || locRes || []);
      setBatches(bRes.results || bRes || []);
    } catch (err) {
      console.error("Failed to load serial management data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    const prod = products.find((p) => String(p.id) === String(prodId));
    setFormData((prev) => ({
      ...prev,
      product: prodId,
      sku: prod ? prod.sku || prod.code || "" : "",
      batch_number: "",
    }));
  };

  // Batches for selected product
  const modalProductBatches = useMemo(() => {
    if (!formData.product) return batches;
    return batches.filter(
      (b) =>
        String(b.product) === String(formData.product) ||
        (b.product_name && b.product_name === formData.product)
    );
  }, [batches, formData.product]);

  // Locations for selected warehouse
  const modalWarehouseLocations = useMemo(() => {
    if (!formData.warehouse) return locations;
    return locations.filter(
      (l) =>
        String(l.warehouse) === String(formData.warehouse) ||
        String(l.warehouse_id) === String(formData.warehouse) ||
        l.warehouse_name === formData.warehouse
    );
  }, [locations, formData.warehouse]);

  const handleGenerateSerial = () => {
    const prefix = formData.sku ? formData.sku.slice(0, 4).toUpperCase() : "SN";
    const rand = Math.floor(100000 + Math.random() * 900000);
    setFormData((prev) => ({ ...prev, serial_number: `${prefix}-${rand}` }));
  };

  const handleRegisterSerial = async (e) => {
    e.preventDefault();
    if (!formData.serial_number.trim()) {
      setErrorMsg("Serial Number is required.");
      return;
    }
    if (!formData.product) {
      setErrorMsg("Product is required.");
      return;
    }
    if (!formData.warehouse) {
      setErrorMsg("Warehouse is required.");
      return;
    }
    if (!formData.storage_location) {
      setErrorMsg("Storage Location is required.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      await createSerialNumber({
        serial_number: formData.serial_number.trim(),
        product: formData.product,
        sku: formData.sku,
        batch: formData.batch_number || null,
        warehouse: formData.warehouse,
        location: formData.storage_location,
        received_date: formData.received_date,
        status: formData.serial_status,
      });

      setShowRegisterModal(false);
      setFormData({
        serial_number: "",
        product: "",
        sku: "",
        batch_number: "",
        warehouse: "",
        storage_location: "",
        received_date: new Date().toISOString().split("T")[0],
        serial_status: "Available",
      });
      loadData();
    } catch (err) {
      setErrorMsg(err.message || "Failed to register serial number.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateSerialNumberStatus(id, newStatus);
      loadData();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const filteredSerials = useMemo(() => {
    return serials.filter((s) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (s.serial_number && s.serial_number.toLowerCase().includes(q)) ||
        (s.product_name && s.product_name.toLowerCase().includes(q)) ||
        (s.sku && s.sku.toLowerCase().includes(q));

      const matchProduct = !productFilter || String(s.product) === String(productFilter) || s.product_name === productFilter;
      const matchWarehouse = !warehouseFilter || String(s.warehouse) === String(warehouseFilter) || s.warehouse_name === warehouseFilter;
      const matchStatus = !statusFilter || s.status === statusFilter;

      return matchSearch && matchProduct && matchWarehouse && matchStatus;
    });
  }, [serials, searchTerm, productFilter, warehouseFilter, statusFilter]);

  // KPIs
  const totalCount = serials.length;
  const availableCount = serials.filter((s) => s.status === "Available" || s.status === "IN_STOCK").length;
  const reservedCount = serials.filter((s) => s.status === "Reserved").length;
  const inTransitOrIssued = serials.filter(
    (s) => s.status === "Issued" || s.status === "In Transit" || s.status === "DISPATCHED"
  ).length;
  const quarantinedOrScrapped = serials.filter(
    (s) => s.status === "Quarantined" || s.status === "Scrapped" || s.status === "DEFECTIVE"
  ).length;

  const exportCSV = () => {
    const headers = [
      "Serial Number",
      "Product Name",
      "SKU",
      "Batch Number",
      "Warehouse",
      "Storage Location",
      "Received Date",
      "Serial Status",
    ];
    const rows = filteredSerials.map((s) => [
      s.serial_number,
      s.product_name || "",
      s.sku || "",
      s.batch_number || "",
      s.warehouse_name || s.warehouse || "",
      s.location_name || s.location || "",
      s.received_date || "",
      s.status || "Available",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `serials_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    const s = String(status || "Available").toUpperCase();
    if (s === "AVAILABLE" || s === "IN_STOCK") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="h-3 w-3" /> Available
        </span>
      );
    }
    if (s === "RESERVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          <Clock className="h-3 w-3" /> Reserved
        </span>
      );
    }
    if (s === "ISSUED" || s === "DISPATCHED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
          Issued
        </span>
      );
    }
    if (s === "IN TRANSIT" || s === "IN_TRANSIT") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
          In Transit
        </span>
      );
    }
    if (s === "RETURNED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
          Returned
        </span>
      );
    }
    if (s === "QUARANTINED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <ShieldAlert className="h-3 w-3" /> Quarantined
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
        <AlertTriangle className="h-3 w-3" /> Scrapped
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Serial Number Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Unit Traceability
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Track each individual unit using a unique serial number, barcode verification, and lifecycle state.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            Register Serial Number
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Registered</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{totalCount}</span>
            <span className="text-xs text-slate-400">Units</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Available</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{availableCount}</span>
            <span className="text-xs text-slate-400">Ready to issue</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Reserved</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{reservedCount}</span>
            <span className="text-xs text-slate-400">Allocated</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Issued / In Transit</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">{inTransitOrIssued}</span>
            <span className="text-xs text-slate-400">Dispatched</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Quarantine / Scrapped</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{quarantinedOrScrapped}</span>
            <span className="text-xs text-slate-400">Blocked</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search serial #, product, or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.name || p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.name || w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Issued">Issued</option>
              <option value="In Transit">In Transit</option>
              <option value="Returned">Returned</option>
              <option value="Quarantined">Quarantined</option>
              <option value="Scrapped">Scrapped</option>
            </select>
          </div>
        </div>
      </div>

      {/* Serials Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Serial Number</th>
                <th className="py-3 px-4">Product & SKU</th>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Warehouse & Location</th>
                <th className="py-3 px-4">Received Date</th>
                <th className="py-3 px-4">Serial Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading serialized unit inventory...
                  </td>
                </tr>
              ) : filteredSerials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No serialized units found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSerials.map((s) => (
                  <tr key={s.id || s.serial_number} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <Barcode className="h-3.5 w-3.5 text-slate-400" />
                      {s.serial_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {s.product_name || "Product Unit"}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                        SKU: {s.sku || "N/A"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                      {s.batch_number ? (
                        <Link
                          to={`/inventory/tracking/batches?search=${encodeURIComponent(s.batch_number)}`}
                          className="hover:text-blue-600 hover:underline"
                        >
                          {s.batch_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 dark:text-zinc-200">
                        {s.warehouse_name || s.warehouse || "Warehouse"}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {s.location_name || s.location || "Storage Location"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400">
                      {s.received_date || "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(s.status)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          to={`/inventory/tracking/serial-movements?serial=${encodeURIComponent(s.serial_number)}`}
                          title="View Unit Movements"
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        <select
                          value={s.status}
                          onChange={(e) => handleStatusChange(s.id, e.target.value)}
                          className="text-[10px] px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 focus:outline-none"
                          title="Update unit status"
                        >
                          <option value="Available">Available</option>
                          <option value="Reserved">Reserved</option>
                          <option value="Issued">Issued</option>
                          <option value="In Transit">In Transit</option>
                          <option value="Returned">Returned</option>
                          <option value="Quarantined">Quarantined</option>
                          <option value="Scrapped">Scrapped</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Register Serial Number Form (Exact 8 Phase 5 fields) */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Register Serial Number Form
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Register an individually traceable unit with unique serial identification.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterSerial} className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                {/* 1. Serial Number (Text / Scan, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Serial Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. SN-BRG-849102"
                      value={formData.serial_number}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                      required
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateSerial}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 font-medium"
                    >
                      Generate
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScannerModal(true)}
                      className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                      title="Scan Barcode"
                    >
                      <Barcode className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 2. Product (Dropdown, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Product <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.product}
                      onChange={handleProductChange}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. SKU (Auto-filled, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      SKU (Auto-filled)
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      readOnly
                      placeholder="Product SKU"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-800/30 text-slate-600 dark:text-zinc-400 font-mono cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* 4. Batch Number (Dropdown, Optional) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Batch Number (Optional)
                  </label>
                  <select
                    value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None / Not linked to batch</option>
                    {modalProductBatches.map((b) => (
                      <option key={b.id || b.batch_number} value={b.batch_number}>
                        {b.batch_number} (Exp: {b.expiry_date || "N/A"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 5. Warehouse (Dropdown, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Warehouse <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.warehouse}
                      onChange={(e) => setFormData({ ...formData, warehouse: e.target.value, storage_location: "" })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select warehouse...</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 6. Storage Location (Dropdown, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Storage Location <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.storage_location}
                      onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select location...</option>
                      {modalWarehouseLocations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name || l.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 7. Received Date (Date, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Received Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.received_date}
                      onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* 8. Serial Status (Dropdown, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Serial Status <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.serial_status}
                      onChange={(e) => setFormData({ ...formData, serial_status: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Available">Available</option>
                      <option value="Reserved">Reserved</option>
                      <option value="Issued">Issued</option>
                      <option value="In Transit">In Transit</option>
                      <option value="Returned">Returned</option>
                      <option value="Quarantined">Quarantined</option>
                      <option value="Scrapped">Scrapped</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? "Registering..." : "Register Serial"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-6 text-center space-y-4">
            <div className="p-3 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 w-fit mx-auto">
              <Barcode className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Scan Barcode / QR</h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter or scan the unit serial barcode using a handheld scanner or keyboard entry.
              </p>
            </div>
            <input
              type="text"
              autoFocus
              placeholder="Scan or type serial number..."
              value={scannedInput}
              onChange={(e) => setScannedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && scannedInput.trim()) {
                  setFormData((prev) => ({ ...prev, serial_number: scannedInput.trim() }));
                  setShowScannerModal(false);
                  setScannedInput("");
                }
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-center font-mono text-slate-900 dark:text-white"
            />
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => {
                  if (scannedInput.trim()) {
                    setFormData((prev) => ({ ...prev, serial_number: scannedInput.trim() }));
                  }
                  setShowScannerModal(false);
                  setScannedInput("");
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Apply Serial
              </button>
              <button
                type="button"
                onClick={() => setShowScannerModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default SerialManagementPage;

