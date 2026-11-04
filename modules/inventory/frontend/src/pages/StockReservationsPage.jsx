import React, { useState, useEffect, useMemo } from "react";
import {
  BookmarkCheck,
  Clock,
  CheckCircle2,
  Download,
  Plus,
  X,
  Sparkles,
  Layers,
  Check,
  RotateCcw,
  CheckCircle,
} from "lucide-react";
import {
  fetchStockReservations,
  createStockReservation,
  fulfillStockReservation,
  releaseStockReservation,
  fetchProducts,
  fetchWarehouses,
  fetchStockBalances,
} from "../services/api";

export function StockReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Form State matching Phase 4 fields
  const generateResNumber = () =>
    `RES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const [formData, setFormData] = useState({
    reservation_number: generateResNumber(),
    reservation_date: new Date().toISOString().split("T")[0],
    reservation_type: "Sales",
    reference_number: "",
    product_sku: "BRG-6205-2RS",
    warehouse: "Main Central Hub",
    available_quantity: 405,
    reservation_quantity: 10,
    required_date: "",
    batch_number: "",
    remarks: "",
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = () => {
    fetchStockReservations().then((res) => {
      setReservations(res.results || []);
    });
    fetchProducts().then((res) => setProducts(res.results || res || []));
    fetchWarehouses().then((res) => setWarehouses(res.results || res || []));
    fetchStockBalances().then((res) => setBalances(res.results || []));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update available quantity when product or warehouse changes
  useEffect(() => {
    const bal = balances.find(
      (b) =>
        (b.sku === formData.product_sku || b.item_code === formData.product_sku) &&
        (b.warehouse_name === formData.warehouse || b.warehouse === formData.warehouse)
    );
    if (bal) {
      const avail = Number(bal.available_stock !== undefined ? bal.available_stock : (bal.available_qty || 0));
      setFormData((prev) => ({ ...prev, available_quantity: avail }));
    }
  }, [formData.product_sku, formData.warehouse, balances]);

  const handleOpenModal = () => {
    setFormData({
      reservation_number: generateResNumber(),
      reservation_date: new Date().toISOString().split("T")[0],
      reservation_type: "Sales",
      reference_number: "",
      product_sku: products[0]?.sku || "BRG-6205-2RS",
      warehouse: warehouses[0]?.name || "Main Central Hub",
      available_quantity: 405,
      reservation_quantity: 10,
      required_date: "",
      batch_number: "",
      remarks: "",
    });
    setIsModalOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const qty = Number(formData.reservation_quantity);
    if (!qty || qty <= 0) {
      showToast("Reservation quantity must be greater than zero.");
      return;
    }
    if (qty > formData.available_quantity) {
      showToast(`Warning: Requested quantity (${qty}) exceeds available stock (${formData.available_quantity}).`);
    }

    try {
      const selectedProd = products.find((p) => p.sku === formData.product_sku) || {};
      const payload = {
        reservation_number: formData.reservation_number,
        reservation_date: formData.reservation_date,
        reservation_type: formData.reservation_type,
        reference_number: formData.reference_number,
        product_name: selectedProd.name || "Industrial Component",
        item_name: selectedProd.name || "Industrial Component",
        sku: formData.product_sku,
        item_sku: formData.product_sku,
        item_id: selectedProd.id,
        warehouse: formData.warehouse,
        warehouse_name: formData.warehouse,
        available_quantity: formData.available_quantity,
        reservation_quantity: qty,
        quantity: qty,
        required_date: formData.required_date || null,
        batch_number: formData.batch_number,
        remarks: formData.remarks,
        status: "RESERVED",
      };

      const created = await createStockReservation(payload);
      setReservations((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setIsModalOpen(false);
      showToast(`Reservation ${formData.reservation_number} confirmed. Available stock adjusted.`);
      loadData();
    } catch (err) {
      showToast("Failed to create reservation: " + err.message);
    }
  };

  const handleFulfill = async (id) => {
    await fulfillStockReservation(id);
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "FULFILLED" } : r))
    );
    showToast("Reservation marked as Fulfilled.");
    loadData();
  };

  const handleRelease = async (id) => {
    await releaseStockReservation(id);
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "RELEASED" } : r))
    );
    showToast("Reservation released back into available stock.");
    loadData();
  };

  const activeReservations = reservations.filter(
    (r) => r.status === "RESERVED" || r.status === "PARTIALLY_FULFILLED" || r.status === "PENDING"
  );
  const totalReservedUnits = activeReservations.reduce(
    (acc, r) => acc + Number(r.reservation_quantity || r.quantity || 0),
    0
  );

  const handleExportCSV = () => {
    const headers = [
      "Reservation Number",
      "Reservation Date",
      "Reservation Type",
      "Reference Number",
      "Product Name",
      "SKU",
      "Warehouse",
      "Available Quantity",
      "Reservation Quantity",
      "Required Date",
      "Batch Number",
      "Status",
      "Remarks",
    ];
    const rows = reservations.map((r) => [
      `"${r.reservation_number || r.reference_doc}"`,
      `"${r.reservation_date || ""}"`,
      `"${r.reservation_type || "Sales"}"`,
      `"${r.reference_number || ""}"`,
      `"${r.product_name || r.item_name || r.item}"`,
      `"${r.sku || r.item_code || r.item_sku}"`,
      `"${r.warehouse_name || r.warehouse}"`,
      r.available_quantity || 0,
      r.reservation_quantity || r.quantity,
      `"${r.required_date || ""}"`,
      `"${r.batch_number || ""}"`,
      `"${r.status}"`,
      `"${r.remarks || ""}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_reservations_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Reservations exported as CSV.");
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
              Stock Reservation
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50">
              <Sparkles className="h-2.5 w-2.5" /> Soft Allocation Lock
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Reserve available stock for future requirements without physically removing it from the warehouse.
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Create Reservation</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Active Reserved Holds
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            {activeReservations.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Orders with locked stock</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Total Units Reserved
          </div>
          <div className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {totalReservedUnits.toLocaleString()} EA
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Deducted from available balance</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Fulfilled / Released
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            {reservations.filter((r) => r.status === "FULFILLED" || r.status === "RELEASED").length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Completed lifecycles</div>
        </div>
      </div>

      {/* Reservations Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="whitespace-nowrap border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">Reservation #</th>
                <th className="py-3.5 px-3 font-semibold">Date</th>
                <th className="py-3.5 px-3 font-semibold">Type</th>
                <th className="py-3.5 px-3 font-semibold">Product</th>
                <th className="py-3.5 px-3 font-semibold">Warehouse</th>
                <th className="py-3.5 px-3 font-semibold text-right">Available Qty</th>
                <th className="py-3.5 px-3 font-semibold text-right">Reserved Qty</th>
                <th className="py-3.5 px-3 font-semibold">Required Date</th>
                <th className="py-3.5 px-3 font-semibold text-center">Batch #</th>
                <th className="py-3.5 px-3 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No reservations recorded. Click "Create Reservation" to allocate stock.
                  </td>
                </tr>
              ) : (
                reservations.map((res) => {
                  const status = res.status || "RESERVED";
                  const resNum = res.reservation_number || res.reference_doc;
                  return (
                    <tr key={res.id || resNum} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {resNum}
                        </span>
                        {res.reference_number && (
                          <span className="block font-mono text-[10px] text-slate-400 mt-0.5">
                            Ref: {res.reference_number}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                        {res.reservation_date || (res.created_at ? res.created_at.split("T")[0] : "2026-10-28")}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {res.reservation_type || "Sales"}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {res.product_name || res.item_name || res.item}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                          {res.sku || res.item_code || res.item_sku}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-zinc-300 font-medium">
                        {res.warehouse_name || res.warehouse}
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums text-slate-600 dark:text-zinc-300">
                        {res.available_quantity ?? 100} EA
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums font-bold text-purple-600 dark:text-purple-400">
                        {res.reservation_quantity || res.quantity} EA
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                        {res.required_date || "—"}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-[10px] text-slate-500">
                        {res.batch_number || "—"}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            status === "RESERVED" || status === "PENDING"
                              ? "bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/50"
                              : status === "FULFILLED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50"
                              : status === "PARTIALLY_FULFILLED"
                              ? "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/50"
                              : status === "RELEASED"
                              ? "bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700/50"
                              : "bg-rose-50 text-rose-700 border-rose-200/60 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-300"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              status === "RESERVED" || status === "PENDING"
                                ? "bg-purple-500 animate-pulse"
                                : status === "FULFILLED"
                                ? "bg-emerald-500"
                                : status === "RELEASED"
                                ? "bg-slate-400"
                                : "bg-blue-500"
                            }`}
                          />
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {(status === "RESERVED" || status === "PENDING" || status === "PARTIALLY_FULFILLED") ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRelease(res.id)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[11px] font-medium transition-colors cursor-pointer"
                            >
                              Release
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFulfill(res.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold shadow-xs transition-colors cursor-pointer"
                            >
                              Fulfill
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Closed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Reservation Modal - Exact Phase 4 fields */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookmarkCheck className="h-4 w-4 text-purple-600" />
                  Create Reservation Form
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Reserve stock for sales, production or internal orders without physical movement.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Reservation Number */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Reservation Number *
                  </label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={formData.reservation_number}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800/80 text-slate-900 dark:text-white font-mono cursor-not-allowed"
                  />
                </div>

                {/* 2. Reservation Date */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Reservation Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.reservation_date}
                    onChange={(e) => setFormData({ ...formData, reservation_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 3. Reservation Type */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Reservation Type *
                  </label>
                  <select
                    required
                    value={formData.reservation_type}
                    onChange={(e) => setFormData({ ...formData, reservation_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Production">Production</option>
                    <option value="Internal Use">Internal Use</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* 4. Reference Number */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Reference Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    placeholder="e.g. SO-2026-8910"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 5. Product */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Product *
                  </label>
                  <select
                    required
                    value={formData.product_sku}
                    onChange={(e) => setFormData({ ...formData, product_sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {products.length > 0 ? (
                      products.map((p) => (
                        <option key={p.id || p.sku} value={p.sku || p.code}>
                          {p.sku || p.code} - {p.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="BRG-6205-2RS">BRG-6205-2RS - Industrial Ball Bearing</option>
                        <option value="HYD-SV-24V">HYD-SV-24V - Hydraulic Solenoid Valve</option>
                        <option value="BELT-T10-1200">BELT-T10-1200 - Polyurethane Belt</option>
                        <option value="LUB-SYN-VG46">LUB-SYN-VG46 - Compressor Lubricant</option>
                      </>
                    )}
                  </select>
                </div>

                {/* 6. Warehouse */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse *
                  </label>
                  <select
                    required
                    value={formData.warehouse}
                    onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {warehouses.length > 0 ? (
                      warehouses.map((w) => (
                        <option key={w.id || w.name} value={w.name}>
                          {w.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Main Central Hub">Main Central Hub</option>
                        <option value="East Coast Logistics Terminal">East Coast Logistics Terminal</option>
                        <option value="Cold Storage Facility">Cold Storage Facility</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 7. Available Quantity (Auto-filled) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Available Quantity (Auto-filled) *
                  </label>
                  <input
                    type="number"
                    readOnly
                    value={formData.available_quantity}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800/80 text-emerald-600 dark:text-emerald-400 font-mono font-bold cursor-not-allowed"
                  />
                </div>

                {/* 8. Reservation Quantity */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Reservation Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.reservation_quantity}
                    onChange={(e) => setFormData({ ...formData, reservation_quantity: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white tabular-nums font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 9. Required Date */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Required Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.required_date}
                    onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* 10. Batch Number */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Batch Number (Conditional)
                  </label>
                  <input
                    type="text"
                    value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                    placeholder="e.g. LOT-2026-BRG-01"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 11. Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Notes, allocation priorities or assembly work center..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Save Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockReservationsPage;
