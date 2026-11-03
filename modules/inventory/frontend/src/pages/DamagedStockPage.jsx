import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldAlert,
  AlertOctagon,
  Download,
  Plus,
  Search,
  CheckCircle2,
  X,
  Eye,
  Calendar,
  Layers,
  Archive,
  Trash2,
  Lock,
  Check,
} from "lucide-react";
import {
  fetchDamagedStock,
  createDamagedStock,
  quarantineDamagedStock,
  approveWriteOffDamagedStock,
  disposeDamagedStock,
  fetchProducts,
  fetchWarehouses,
  fetchLocations,
} from "../services/api";

export function DamagedStockPage() {
  const [damagedRecords, setDamagedRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    product_sku: "HYD-SV-24V",
    warehouse: "Main Central Hub",
    location: "LOC-499 - Aisle 1",
    batch_number: "",
    damaged_qty: 1,
    damage_reason: "Forklift impact during pallet unloading",
    damage_date: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    try {
      const [dmgData, prodData, whData, locData] = await Promise.all([
        fetchDamagedStock(),
        fetchProducts(),
        fetchWarehouses(),
        fetchLocations(),
      ]);
      setDamagedRecords(dmgData.results || dmgData || []);
      setProducts(prodData.results || prodData || []);
      setWarehouses(whData || []);
      setLocations(locData || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = () => {
    setFormData({
      product_sku: products[0]?.sku || "HYD-SV-24V",
      warehouse: warehouses[0]?.name || "Main Central Hub",
      location: locations[0]?.name || "Aisle 1 - Buffer",
      batch_number: "",
      damaged_qty: 1,
      damage_reason: "Handling collision during racking",
      damage_date: new Date().toISOString().split("T")[0],
      remarks: "",
    });
    setShowModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const selectedProd = products.find((p) => p.sku === formData.product_sku) || {};
      const payload = {
        item_id: selectedProd.id,
        product_name: selectedProd.name || "Industrial Component",
        sku: formData.product_sku,
        warehouse: formData.warehouse,
        warehouse_name: formData.warehouse,
        location: formData.location,
        location_name: formData.location,
        batch_number: formData.batch_number,
        damaged_qty: Number(formData.damaged_qty),
        damage_reason: formData.damage_reason,
        damage_date: formData.damage_date,
        status: "PENDING",
        remarks: formData.remarks,
      };

      const created = await createDamagedStock(payload);
      setDamagedRecords((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
      setShowModal(false);
      showToast(`Damaged stock record created for ${formData.product_sku}.`);
      loadData();
    } catch (err) {
      showToast("Error creating damaged record: " + err.message);
    }
  };

  const handleQuarantine = async (id) => {
    await quarantineDamagedStock(id);
    setDamagedRecords((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "QUARANTINED" } : d))
    );
    showToast("Stock moved to Quarantined state and blocked from available balance.");
    loadData();
  };

  const handleApproveWriteOff = async (id) => {
    await approveWriteOffDamagedStock(id);
    setDamagedRecords((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "WRITTEN_OFF" } : d))
    );
    showToast("Damaged stock written off as loss.");
    loadData();
  };

  const handleDispose = async (id) => {
    await disposeDamagedStock(id);
    setDamagedRecords((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "DISPOSED" } : d))
    );
    showToast("Damaged stock disposed and logged.");
    loadData();
  };

  const filtered = useMemo(() => {
    return damagedRecords.filter((d) => {
      const q = searchTerm.trim().toLowerCase();
      const prod = d.product_name || d.item_name || "";
      const sku = d.sku || d.item_code || "";
      const reason = d.damage_reason || "";
      const matchesSearch =
        !q ||
        prod.toLowerCase().includes(q) ||
        sku.toLowerCase().includes(q) ||
        reason.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "ALL" || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [damagedRecords, searchTerm, statusFilter]);

  const totalDamagedQty = useMemo(() => {
    return filtered.reduce((acc, d) => acc + Number(d.damaged_qty || 0), 0);
  }, [filtered]);

  const handleExportCSV = () => {
    const headers = [
      "Product Name",
      "SKU",
      "Warehouse",
      "Storage Location",
      "Batch Number",
      "Damaged Quantity",
      "Damage Reason",
      "Damage Date",
      "Status",
      "Remarks",
    ];
    const rows = filtered.map((d) => [
      `"${d.product_name || d.item_name || ""}"`,
      `"${d.sku || d.item_code || ""}"`,
      `"${d.warehouse_name || d.warehouse || ""}"`,
      `"${d.location_name || d.location || ""}"`,
      `"${d.batch_number || ""}"`,
      d.damaged_qty,
      `"${d.damage_reason || ""}"`,
      `"${d.damage_date || ""}"`,
      `"${d.status}"`,
      `"${d.remarks || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `damaged_stock_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Damaged stock register exported as CSV.");
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
              Damaged Stock Management
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/50">
              <ShieldAlert className="h-3 w-3 text-rose-500" /> Non-Usable Inventory
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Monitor and manage damaged products separately from usable stock. Track quarantine, write-off, and disposal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xs cursor-pointer transition-all"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold shadow-xs hover:shadow-rose-500/25 cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Record Damaged Stock</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Incident Records
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            {damagedRecords.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Reported damage logs</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Quarantined (Blocked)
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {damagedRecords.filter((d) => d.status === "QUARANTINED").length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Isolated from order picking</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Written Off
          </div>
          <div className="text-2xl font-bold tabular-nums text-purple-600 dark:text-purple-400 mt-1">
            {damagedRecords.filter((d) => d.status === "WRITTEN_OFF").length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Loss claims approved</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Total Damaged Quantity
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400 mt-1">
            {totalDamagedQty.toLocaleString()} EA
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Physical non-usable units</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Product, SKU, Damage Reason..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-rose-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="QUARANTINED">Quarantined</option>
            <option value="WRITTEN_OFF">Written Off</option>
            <option value="DISPOSED">Disposed</option>
          </select>
        </div>
      </div>

      {/* Damaged Stock Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">Product</th>
                <th className="py-3.5 px-3 font-semibold">SKU</th>
                <th className="py-3.5 px-3 font-semibold">Warehouse</th>
                <th className="py-3.5 px-3 font-semibold">Storage Location</th>
                <th className="py-3.5 px-3 font-semibold text-center">Batch Number</th>
                <th className="py-3.5 px-3 font-semibold text-right">Damaged Qty</th>
                <th className="py-3.5 px-3 font-semibold">Damage Reason</th>
                <th className="py-3.5 px-3 font-semibold">Damage Date</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No damaged stock records found.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {d.product_name || d.item_name}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60">
                        {d.sku || d.item_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 dark:text-zinc-300 font-medium">
                      {d.warehouse_name || d.warehouse}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                      {d.location_name || d.location || "General Storage"}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-[11px] text-slate-500">
                      {d.batch_number || "—"}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                      {d.damaged_qty} EA
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 dark:text-zinc-300">
                      {d.damage_reason}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                      {d.damage_date || "2026-10-27"}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          d.status === "PENDING"
                            ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-zinc-800 dark:text-zinc-300"
                            : d.status === "QUARANTINED"
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400"
                            : d.status === "WRITTEN_OFF"
                            ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-400"
                            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewRecord(d)}
                          className="p-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {d.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => handleQuarantine(d.id)}
                            className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-semibold cursor-pointer shadow-xs"
                          >
                            Quarantine
                          </button>
                        )}
                        {d.status === "QUARANTINED" && (
                          <button
                            type="button"
                            onClick={() => handleApproveWriteOff(d.id)}
                            className="px-2 py-0.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-semibold cursor-pointer shadow-xs"
                          >
                            Approve Write-off
                          </button>
                        )}
                        {(d.status === "QUARANTINED" || d.status === "WRITTEN_OFF") && (
                          <button
                            type="button"
                            onClick={() => handleDispose(d.id)}
                            className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-semibold cursor-pointer shadow-xs"
                          >
                            Dispose
                          </button>
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

      {/* Create Damaged Stock Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertOctagon className="h-4 w-4 text-rose-600" />
                  Record Damaged Stock
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Log damaged units to remove them from available inventory and route to quarantine.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* Product */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Product *
                  </label>
                  <select
                    required
                    value={formData.product_sku}
                    onChange={(e) => setFormData({ ...formData, product_sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    {products.map((p) => (
                      <option key={p.id || p.sku} value={p.sku || p.code}>
                        {p.sku || p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Warehouse */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse *
                  </label>
                  <select
                    required
                    value={formData.warehouse}
                    onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id || w.name} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Storage Location */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Storage Location *
                  </label>
                  <select
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    {locations.map((l) => (
                      <option key={l.id || l.name} value={l.name || l.code}>
                        {l.code} - {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Batch Number */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Batch Number (If applicable)
                  </label>
                  <input
                    type="text"
                    value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                    placeholder="e.g. LOT-2025-DEC-09"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Damaged Quantity */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Damaged Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.damaged_qty}
                    onChange={(e) => setFormData({ ...formData, damaged_qty: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white tabular-nums font-bold focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                {/* Damage Date */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Damage Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.damage_date}
                    onChange={(e) => setFormData({ ...formData, damage_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Damage Reason */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Damage Reason *
                </label>
                <input
                  type="text"
                  required
                  value={formData.damage_reason}
                  onChange={(e) => setFormData({ ...formData, damage_reason: e.target.value })}
                  placeholder="e.g. Water damage, forklift collision, dropped during racking"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Quarantine rack location, incident report number..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Record Damaged Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-600" />
                Damaged Stock Dossier
              </h2>
              <button
                onClick={() => setViewRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-400">Product:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{viewRecord.product_name || viewRecord.item_name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-400">SKU:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{viewRecord.sku || viewRecord.item_code}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-400">Warehouse:</span>
                <span className="font-medium text-slate-900 dark:text-white">{viewRecord.warehouse_name || viewRecord.warehouse}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-400">Storage Location:</span>
                <span className="font-mono text-slate-700 dark:text-zinc-300">{viewRecord.location_name || viewRecord.location || "General Storage"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-400">Batch Number:</span>
                <span className="font-mono text-slate-700 dark:text-zinc-300">{viewRecord.batch_number || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-400">Damaged Quantity:</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{viewRecord.damaged_qty} EA</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-400">Damage Reason:</span>
                <span className="text-slate-900 dark:text-white">{viewRecord.damage_reason}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-400">Damage Date:</span>
                <span className="font-mono text-slate-700 dark:text-zinc-300">{viewRecord.damage_date}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{viewRecord.status}</span>
              </div>
              {viewRecord.remarks && (
                <div className="pt-2">
                  <span className="text-slate-400 block text-[11px] mb-0.5">Remarks:</span>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                    {viewRecord.remarks}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setViewRecord(null)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
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

export default DamagedStockPage;

