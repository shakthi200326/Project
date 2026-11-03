import React, { useState, useEffect, useMemo } from "react";
import {
  Hash,
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
  ExternalLink,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchBatches,
  createBatch,
  fetchProducts,
  fetchWarehouses,
  fetchLocations,
  quarantineBatch,
  releaseBatch,
} from "@/services/api";

export function BatchManagementPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Create Form State - Exactly the 11 Phase 5 fields
  const [formData, setFormData] = useState({
    batch_number: "",
    product: "",
    sku: "",
    supplier: "",
    manufacturing_date: "",
    expiry_date: "",
    received_date: new Date().toISOString().split("T")[0],
    initial_quantity: 100,
    warehouse: "",
    storage_location: "",
    batch_status: "Pending Inspection",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchRes, prodRes, whRes, locRes] = await Promise.all([
        fetchBatches(),
        fetchProducts(),
        fetchWarehouses(),
        fetchLocations(),
      ]);
      setBatches(batchRes.results || batchRes || []);
      setProducts(prodRes.results || prodRes || []);
      setWarehouses(whRes.results || whRes || []);
      setLocations(locRes.results || locRes || []);
    } catch (err) {
      console.error("Failed to load batch management data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered locations based on selected warehouse in create modal
  const modalFilteredLocations = useMemo(() => {
    if (!formData.warehouse) return locations;
    return locations.filter(
      (loc) =>
        String(loc.warehouse) === String(formData.warehouse) ||
        String(loc.warehouse_id) === String(formData.warehouse) ||
        loc.warehouse_name === formData.warehouse
    );
  }, [locations, formData.warehouse]);

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    const prod = products.find((p) => String(p.id) === String(prodId));
    setFormData((prev) => ({
      ...prev,
      product: prodId,
      sku: prod ? prod.sku || prod.code || "" : "",
    }));
  };

  const handleGenerateBatchNumber = () => {
    const yr = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    setFormData((prev) => ({ ...prev, batch_number: `BAT-${yr}-${rand}` }));
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!formData.batch_number.trim()) {
      setErrorMsg("Batch Number is required.");
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
    if (!formData.initial_quantity || Number(formData.initial_quantity) <= 0) {
      setErrorMsg("Initial Quantity must be greater than 0.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const payload = {
        batch_number: formData.batch_number,
        product: formData.product,
        sku: formData.sku,
        supplier: formData.supplier || "",
        manufacturing_date: formData.manufacturing_date || null,
        expiry_date: formData.expiry_date || null,
        received_date: formData.received_date,
        initial_quantity: Number(formData.initial_quantity),
        remaining_quantity: Number(formData.initial_quantity),
        warehouse: formData.warehouse,
        location: formData.storage_location,
        batch_status: formData.batch_status,
      };
      await createBatch(payload);
      setShowCreateModal(false);
      // Reset form
      setFormData({
        batch_number: "",
        product: "",
        sku: "",
        supplier: "",
        manufacturing_date: "",
        expiry_date: "",
        received_date: new Date().toISOString().split("T")[0],
        initial_quantity: 100,
        warehouse: "",
        storage_location: "",
        batch_status: "Pending Inspection",
      });
      loadData();
    } catch (err) {
      setErrorMsg(err.message || "Failed to create batch.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (b.batch_number && b.batch_number.toLowerCase().includes(q)) ||
        (b.product_name && b.product_name.toLowerCase().includes(q)) ||
        (b.sku && b.sku.toLowerCase().includes(q));

      const matchProduct = !selectedProduct || String(b.product) === String(selectedProduct) || b.product_name === selectedProduct;
      const matchWarehouse = !selectedWarehouse || String(b.warehouse) === String(selectedWarehouse) || b.warehouse_name === selectedWarehouse;
      const matchStatus = !selectedStatus || b.batch_status === selectedStatus || b.status === selectedStatus;

      return matchSearch && matchProduct && matchWarehouse && matchStatus;
    });
  }, [batches, searchTerm, selectedProduct, selectedWarehouse, selectedStatus]);

  // KPI Calculations
  const totalBatches = batches.length;
  const releasedBatches = batches.filter(
    (b) => b.batch_status === "Released" || b.status === "RELEASED" || b.status === "Released"
  ).length;
  const quarantinedBatches = batches.filter(
    (b) => b.batch_status === "Quarantined" || b.status === "QUARANTINED" || b.status === "Quarantined" || Number(b.quarantined_quantity || 0) > 0
  ).length;
  const pendingBatches = batches.filter(
    (b) => b.batch_status === "Pending Inspection" || b.status === "PENDING_INSPECTION" || b.status === "Pending Inspection"
  ).length;

  const exportCSV = () => {
    const headers = [
      "Batch Number",
      "Product Name",
      "SKU",
      "Warehouse",
      "Storage Location",
      "Initial Qty",
      "Remaining Qty",
      "Quarantined Qty",
      "Received Date",
      "Expiry Date",
      "Days to Expiry",
      "Expiry Status",
      "Batch Status",
    ];
    const rows = filteredBatches.map((b) => [
      b.batch_number,
      b.product_name || "",
      b.sku || "",
      b.warehouse_name || b.warehouse || "",
      b.location_name || b.location || "",
      b.initial_quantity || 0,
      b.remaining_quantity || 0,
      b.quarantined_quantity || 0,
      b.received_date || "",
      b.expiry_date || "",
      b.days_to_expiry !== undefined ? b.days_to_expiry : "",
      b.expiry_status || "Healthy",
      b.batch_status || b.status || "Pending Inspection",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `batches_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    const s = String(status || "Pending Inspection").toUpperCase();
    if (s.includes("RELEASED")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="h-3 w-3" /> Released
        </span>
      );
    }
    if (s.includes("QUARANTINE")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <ShieldAlert className="h-3 w-3" /> Quarantined
        </span>
      );
    }
    if (s.includes("REJECTED")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <AlertTriangle className="h-3 w-3" /> Rejected
        </span>
      );
    }
    if (s.includes("CLOSED")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
          Closed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
        <Clock className="h-3 w-3" /> Pending Inspection
      </span>
    );
  };

  const getExpiryBadge = (expiryStatus, days) => {
    if (!expiryStatus || expiryStatus === "N/A") {
      return <span className="text-slate-400 dark:text-zinc-500 text-[11px]">—</span>;
    }
    if (expiryStatus === "Expired" || (days !== null && days !== undefined && days <= 0)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
          Expired ({days}d)
        </span>
      );
    }
    if (expiryStatus === "Expiring Soon" || (days !== null && days !== undefined && days <= 30)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Expiring Soon ({days}d)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
        Healthy ({days}d)
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
              Batch Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Traceability
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Create, monitor, and inspect product batches and manufacturing lots across facilities.
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
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Batch
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Batches</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <Hash className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{totalBatches}</span>
            <span className="text-xs text-slate-400">Active Registry</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Released (Usable)</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{releasedBatches}</span>
            <span className="text-xs text-slate-400">Available for picking</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Quarantined</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{quarantinedBatches}</span>
            <span className="text-xs text-slate-400">Blocked from issue</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Pending Inspection</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{pendingBatches}</span>
            <span className="text-xs text-slate-400">Awaiting QC pass</span>
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
              placeholder="Search batch #, product, or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.name || p.id}>
                  {p.name} ({p.sku || p.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.name || w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="Pending Inspection">Pending Inspection</option>
              <option value="Released">Released</option>
              <option value="Quarantined">Quarantined</option>
              <option value="Rejected">Rejected</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Batches Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Product & SKU</th>
                <th className="py-3 px-4">Warehouse & Location</th>
                <th className="py-3 px-4 text-right">Remaining / Initial</th>
                <th className="py-3 px-4 text-right">Quarantined</th>
                <th className="py-3 px-4">Received Date</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Batch Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading batches...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No batches found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => (
                  <tr key={b.id || b.batch_number} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {b.batch_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {b.product_name || "Product"}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                        SKU: {b.sku || "N/A"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 dark:text-zinc-200 font-medium">
                        {b.warehouse_name || b.warehouse || "Warehouse"}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {b.location_name || b.location || "Default Location"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {Number(b.remaining_quantity || b.initial_quantity || 0)}
                      </span>
                      <span className="text-slate-400 dark:text-zinc-500 text-[10px] ml-1">
                        / {Number(b.initial_quantity || 0)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                      {Number(b.quarantined_quantity || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400">
                      {b.received_date || "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 dark:text-zinc-200 font-mono text-[11px]">
                        {b.expiry_date || "—"}
                      </div>
                      {b.expiry_date && (
                        <div className="mt-0.5">
                          {getExpiryBadge(b.expiry_status, b.days_to_expiry)}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(b.batch_status || b.status)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          to={`/inventory/tracking/batch-movements?batch=${encodeURIComponent(b.batch_number)}`}
                          title="View Ledger Movements"
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        {b.batch_status !== "Quarantined" && Number(b.quarantined_quantity || 0) === 0 ? (
                          <Link
                            to={`/inventory/tracking/batch-quarantine?batch=${encodeURIComponent(b.batch_number)}`}
                            title="Quarantine Lot"
                            className="p-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/50 text-slate-400 hover:text-amber-600 transition-colors"
                          >
                            <ShieldAlert className="h-4 w-4" />
                          </Link>
                        ) : (
                          <Link
                            to={`/inventory/tracking/batch-release?batch=${encodeURIComponent(b.batch_number)}`}
                            title="Release Quarantined Lot"
                            className="p-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-400 hover:text-emerald-600 transition-colors"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Batch Form (Phase 5 - Exact 11 fields) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Create Batch Form
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Register a production lot or supplier batch for traceability.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Batch Number (Auto-generated / Text, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Batch Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. BAT-2026-9041"
                      value={formData.batch_number}
                      onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                      required
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateBatchNumber}
                      className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 font-medium text-[11px]"
                    >
                      Generate
                    </button>
                  </div>
                </div>

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
                        {p.name} ({p.sku || p.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. SKU (Auto-filled, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    SKU <span className="text-rose-500">*</span> (Auto-filled)
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    readOnly
                    placeholder="Selected product SKU"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-800/30 text-slate-600 dark:text-zinc-400 font-mono cursor-not-allowed"
                  />
                </div>

                {/* 4. Supplier (Dropdown, Optional) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Supplier
                  </label>
                  <input
                    type="text"
                    placeholder="Supplier Name / Identifier"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 5. Manufacturing Date (Date, Optional) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Manufacturing Date
                  </label>
                  <input
                    type="date"
                    value={formData.manufacturing_date}
                    onChange={(e) => setFormData({ ...formData, manufacturing_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 6. Expiry Date (Date, Conditional) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

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

                {/* 8. Initial Quantity (Number, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Initial Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.initial_quantity}
                    onChange={(e) => setFormData({ ...formData, initial_quantity: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 9. Warehouse (Dropdown, Required) */}
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

                {/* 10. Storage Location (Dropdown, Required) */}
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
                    <option value="">Select storage location...</option>
                    {modalFilteredLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name || loc.code} ({loc.location_type || "Storage"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 11. Batch Status (Dropdown, Required) */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Batch Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.batch_status}
                    onChange={(e) => setFormData({ ...formData, batch_status: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Pending Inspection">Pending Inspection</option>
                    <option value="Released">Released</option>
                    <option value="Quarantined">Quarantined</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default BatchManagementPage;

