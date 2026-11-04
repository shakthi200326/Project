import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  RefreshCw,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Shuffle,
  Package,
  Paperclip,
} from "lucide-react";
import {
  createReclassification,
  deleteReclassification,
  fetchLocationsStrict,
  fetchReclassEligibility,
  fetchReclassifications,
  fetchStockItems,
  fetchWarehousesStrict,
  reclassAction,
  RECLASS_ATTACHMENT_OWNER,
} from "../services/stockReclassificationApi";
import { uploadAttachment } from "../services/goodsReceiptApi";

const STATUS_LABELS = {
  AVAILABLE: "AVAILABLE (On-Hand Ready)",
  QUARANTINED: "QUARANTINED (Hold for Testing)",
  BLOCKED: "BLOCKED (Locked Stock)",
  DAMAGED: "DAMAGED (Segregated Damaged Stock)",
};
const STATUS_TONE = {
  AVAILABLE: "text-emerald-400",
  QUARANTINED: "text-amber-400",
  BLOCKED: "text-rose-400",
  DAMAGED: "text-orange-400",
};
const today = () => new Date().toISOString().slice(0, 10);
const newKey = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const fmt = (v, places = 4) =>
  v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: places });

const emptyForm = () => ({
  item_id: "",
  variant_id: "",
  warehouse_id: "",
  location_id: "",
  destination_location_id: "",
  quantity: "",
  from_status: "AVAILABLE",
  to_status: "",
  batch_number: "",
  serial_numbers: [],
  transaction_date: today(),
  reference_number: "",
  reason: "",
  notes: "",
});

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none disabled:opacity-50";

export function StockReclassificationPage() {
  const [reclassRecords, setReclassRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [busyRow, setBusyRow] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [records, items, whs] = await Promise.all([fetchReclassifications(), fetchStockItems(), fetchWarehousesStrict()]);
      setReclassRecords(records);
      setProducts(items);
      setWarehouses(whs);
    } catch (e) {
      setLoadError(e.message || "Failed to load reclassification data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg, isError = false) => {
    setToastMessage({ text: msg, isError });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredRecords = useMemo(() => {
    const q = search.toLowerCase();
    return reclassRecords.filter((rec) => {
      const matchesSearch =
        !q ||
        (rec.document_number && rec.document_number.toLowerCase().includes(q)) ||
        (rec.item && rec.item.toLowerCase().includes(q)) ||
        (rec.item_code && rec.item_code.toLowerCase().includes(q)) ||
        (rec.reference_number && rec.reference_number.toLowerCase().includes(q)) ||
        (rec.reason && rec.reason.toLowerCase().includes(q));
      const matchesWh = warehouseFilter === "ALL" || String(rec.warehouse) === String(warehouseFilter);
      const matchesStatus = statusFilter === "ALL" || rec.status === statusFilter;
      return matchesSearch && matchesWh && matchesStatus;
    });
  }, [reclassRecords, search, warehouseFilter, statusFilter]);

  const summary = useMemo(() => {
    const totalQty = filteredRecords.reduce((acc, r) => acc + Math.abs(Number(r.quantity || 0)), 0);
    const postedCount = filteredRecords.filter((r) => r.status === "POSTED").length;
    const pendingCount = filteredRecords.filter((r) => ["DRAFT", "SUBMITTED", "APPROVED"].includes(r.status)).length;
    return { count: filteredRecords.length, totalQty, postedCount, pendingCount };
  }, [filteredRecords]);

  const handleAction = async (rec, action) => {
    let body = {};
    if (action === "reject") {
      const reason = window.prompt(`Reason for rejecting ${rec.document_number}:`);
      if (!reason || !reason.trim()) return;
      body = { reason: reason.trim() };
    }
    if (action === "post" && !window.confirm(`Post ${rec.document_number}? Stock status changes cannot be edited afterwards.`)) return;
    setBusyRow(rec.id);
    try {
      if (action === "delete") await deleteReclassification(rec.id);
      else await reclassAction(rec.id, action, body);
      showToast(`${rec.document_number}: ${action === "post" ? "posted to stock" : `${action} completed`}.`);
    } catch (e) {
      showToast(e.message || `Failed to ${action} ${rec.document_number}.`, true);
    } finally {
      setBusyRow(null);
      loadData();
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-xl border ${
            toastMessage.isError
              ? "bg-rose-950 text-rose-200 border-rose-800"
              : "bg-emerald-950 text-emerald-200 border-emerald-800"
          }`}
        >
          {toastMessage.isError ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          {toastMessage.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Shuffle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Stock Reclassification</h1>
              <p className="text-sm text-slate-400">
                Shift inventory status between Available, Quarantined, Blocked & Damaged classifications with audit history.
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
            onClick={() => setShowCreateModal(true)}
            disabled={!!loadError}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 transition disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New Reclassification
          </button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-950/80 border border-rose-800 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Shuffle className="h-4 w-4 text-indigo-400" />
            Total Events
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{summary.count}</div>
          <div className="text-xs text-slate-500">Classification transitions</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Package className="h-4 w-4 text-purple-400" />
            Total Reclassified Units
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-400">{summary.totalQty.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Shifted between inventory states</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Posted Transitions
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">{summary.postedCount}</div>
          <div className="text-xs text-slate-500">Committed to ledger</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Pending Review
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">{summary.pendingCount}</div>
          <div className="text-xs text-slate-500">Draft / Submitted / Approved</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by reclassification number, item, reference, reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="POSTED">Posted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-800/60 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Doc Number</th>
                <th className="py-3 px-4">Effective Date</th>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Warehouse / Location</th>
                <th className="py-3 px-4 text-center">Transition</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Reason / Reference</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    Loading reclassifications...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No reclassification records found. Click "+ New Reclassification" to execute quality state changes.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const line = rec.lines?.[0] || {};
                  const qty = Math.abs(Number(line.quantity ?? rec.quantity ?? 0));
                  const busy = busyRow === rec.id;
                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-medium text-indigo-400">{rec.document_number}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">{rec.transaction_date || rec.created_at?.slice(0, 10)}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100">{line.item_name || rec.item || "—"}</div>
                        <div className="text-xs font-mono text-slate-400">
                          {line.item_code || rec.item_code || "—"}
                          {line.batch_number ? ` · ${line.batch_number}` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-slate-200">{rec.warehouse_name || rec.warehouse_code || "—"}</div>
                        <div className="text-slate-500">
                          {line.location_code || "Warehouse level"}
                          {rec.destination_location_name ? ` → ${rec.destination_location_name}` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-xs font-mono">
                          <span className={STATUS_TONE[line.from_status] || "text-slate-300"}>{line.from_status || "—"}</span>
                          <span className="text-slate-500">→</span>
                          <span className={STATUS_TONE[line.to_status] || "text-slate-300"}>{line.to_status || "—"}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-100">
                        {qty.toLocaleString()} {line.transaction_uom || rec.unit || ""}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 max-w-[220px]">
                        <div className="truncate">{rec.reason || "—"}</div>
                        {rec.reference_number && <div className="font-mono text-slate-500 truncate">Ref: {rec.reference_number}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            rec.status === "POSTED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : rec.status === "APPROVED"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : rec.status === "REJECTED"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <RowActions rec={rec} busy={busy} onAction={handleAction} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateReclassificationModal
          products={products}
          warehouses={warehouses}
          onClose={() => setShowCreateModal(false)}
          onSaved={(tx, msg) => {
            setShowCreateModal(false);
            showToast(msg);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function RowActions({ rec, busy, onAction }) {
  // The server enforces permissions, approval and transitions; these only offer the next valid step.
  const link = "text-xs font-medium underline disabled:opacity-50";
  if (busy) return <span className="text-xs text-slate-400">Working…</span>;
  switch (rec.status) {
    case "DRAFT":
      return (
        <div className="flex justify-center gap-3">
          <button className={`${link} text-indigo-400 hover:text-indigo-300`} onClick={() => onAction(rec, "submit")}>Submit</button>
          <button className={`${link} text-rose-400 hover:text-rose-300`} onClick={() => onAction(rec, "delete")}>Delete</button>
        </div>
      );
    case "SUBMITTED":
      return (
        <div className="flex justify-center gap-3">
          <button className={`${link} text-blue-400 hover:text-blue-300`} onClick={() => onAction(rec, "approve")}>Approve</button>
          <button className={`${link} text-rose-400 hover:text-rose-300`} onClick={() => onAction(rec, "reject")}>Reject</button>
          <button className={`${link} text-indigo-400 hover:text-indigo-300`} onClick={() => onAction(rec, "post")}>Post</button>
        </div>
      );
    case "APPROVED":
      return (
        <button className={`${link} text-indigo-400 hover:text-indigo-300`} onClick={() => onAction(rec, "post")}>
          Post Reclass
        </button>
      );
    default:
      return <span className="text-xs text-slate-500">{rec.status === "POSTED" ? "Posted" : "Closed"}</span>;
  }
}

function FieldError({ msg }) {
  return msg ? <p className="mt-1 text-[11px] text-rose-400">{msg}</p> : null;
}

function CreateReclassificationModal({ products, warehouses, onClose, onSaved }) {
  const [formData, setFormData] = useState(emptyForm);
  const [locations, setLocations] = useState([]);
  const [elig, setElig] = useState(null);
  const [eligError, setEligError] = useState("");
  const [eligLoading, setEligLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const idemKey = useRef(newKey());

  const set = (patch) => {
    setFormData((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  useEffect(() => {
    setLocations([]);
    if (formData.warehouse_id) fetchLocationsStrict(formData.warehouse_id).then(setLocations).catch((e) => setFormError(e.message));
  }, [formData.warehouse_id]);

  // Eligibility drives UOM, tracking inputs, permitted targets, batches/serials and the quantity limit.
  useEffect(() => {
    if (!formData.item_id) {
      setElig(null);
      return;
    }
    let alive = true;
    setEligLoading(true);
    setEligError("");
    const t = setTimeout(() => {
      fetchReclassEligibility({
        item: formData.item_id,
        variant: formData.variant_id,
        warehouse: formData.warehouse_id,
        location: formData.location_id,
        from_status: formData.from_status,
        batch_number: formData.batch_number,
        effective_date: formData.transaction_date,
      })
        .then((d) => alive && setElig(d))
        .catch((e) => alive && (setElig(null), setEligError(e.message)))
        .finally(() => alive && setEligLoading(false));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [formData.item_id, formData.variant_id, formData.warehouse_id, formData.location_id, formData.from_status, formData.batch_number, formData.transaction_date]);

  const uom = elig?.item?.uom || { code: "", decimal_places: 4, allow_fractional: true };
  const tracking = elig?.item?.tracking || {};
  const selectedBatch = elig?.batches?.find((b) => b.batch_number === formData.batch_number);
  const targets = selectedBatch ? selectedBatch.permitted_targets : elig?.permitted_targets || [];
  const eligibleQty =
    elig && formData.warehouse_id ? Number(selectedBatch ? selectedBatch.eligible_quantity : elig.eligible_quantity) : null;
  const requiredTargetTypes = (elig?.target_location_types || {})[formData.to_status] || [];
  const targetLocations = locations.filter(
    (l) => String(l.id) !== String(formData.location_id) && (!requiredTargetTypes.length || requiredTargetTypes.includes(l.location_type))
  );
  const step = uom.decimal_places > 0 ? (1 / 10 ** uom.decimal_places).toFixed(uom.decimal_places) : "1";

  // Drop choices the new eligibility no longer allows.
  useEffect(() => {
    if (formData.to_status && !targets.includes(formData.to_status)) set({ to_status: "" });
    if (!tracking.batch && formData.batch_number) set({ batch_number: "" });
    if (!tracking.serial && formData.serial_numbers.length) set({ serial_numbers: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elig]);

  const validate = () => {
    const e = {};
    if (!formData.item_id) e.item_id = "Select an item.";
    if (elig?.item?.variants?.length && !formData.variant_id) e.variant_id = "Select a variant.";
    if (!formData.warehouse_id) e.warehouse_id = "Select a warehouse.";
    if (!formData.to_status) e.to_status = "Select a permitted target status.";
    else if (formData.to_status === formData.from_status) e.to_status = "Target status must differ from the source status.";
    const q = Number(formData.quantity);
    if (!formData.quantity || !(q > 0)) e.quantity = "Quantity must be greater than zero.";
    else {
      const decimals = (String(formData.quantity).split(".")[1] || "").replace(/0+$/, "").length;
      if (decimals > uom.decimal_places)
        e.quantity = uom.decimal_places === 0 ? `${uom.code} does not allow fractional quantities.` : `${uom.code} allows at most ${uom.decimal_places} decimal places.`;
      else if (eligibleQty !== null && q > eligibleQty) e.quantity = `Only ${fmt(eligibleQty, uom.decimal_places)} ${uom.code} is eligible.`;
    }
    if (tracking.batch && !formData.batch_number) e.batch_number = "Select a batch.";
    if (tracking.serial && formData.serial_numbers.length !== q) e.serial_numbers = `Select exactly ${q || 0} serial number(s).`;
    if (requiredTargetTypes.length && !formData.destination_location_id)
      e.destination_location_id = `${formData.to_status} stock must move to a ${requiredTargetTypes.join(" / ")} location.`;
    if (!formData.transaction_date) e.transaction_date = "Effective date is required.";
    else if (formData.transaction_date > today()) e.transaction_date = "Effective date cannot be in the future.";
    if (!formData.reason.trim()) e.reason = "Please enter a business reason.";
    return e;
  };

  const SERVER_FIELD = {
    item: "item_id", variant: "variant_id", warehouse: "warehouse_id", location: "location_id",
    destination_location: "destination_location_id", transaction_date: "transaction_date",
  };
  const mapServerErrors = (errs) =>
    Object.fromEntries(
      Object.entries(errs || {}).map(([k, v]) => {
        const field = k.replace(/^lines\[\d+\]\./, "");
        return [SERVER_FIELD[field] || field, v];
      })
    );

  const handleSubmit = async (submit) => {
    setFormError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setSubmitting(true);
    let tx = null;
    try {
      tx = await createReclassification(
        {
          warehouse: Number(formData.warehouse_id),
          transaction_date: formData.transaction_date,
          reference_number: formData.reference_number.trim(),
          reason: formData.reason.trim(),
          notes: formData.notes,
          lines: [
            {
              item: Number(formData.item_id),
              variant: formData.variant_id ? Number(formData.variant_id) : null,
              location: formData.location_id ? Number(formData.location_id) : null,
              destination_location: formData.destination_location_id ? Number(formData.destination_location_id) : null,
              quantity: formData.quantity,
              from_status: formData.from_status,
              to_status: formData.to_status,
              batch_number: formData.batch_number,
              serial_numbers: formData.serial_numbers,
            },
          ],
        },
        idemKey.current
      );
      for (const f of files) await uploadAttachment(RECLASS_ATTACHMENT_OWNER, tx.id, f);
      if (submit) {
        tx = await reclassAction(tx.id, "submit");
        if (!elig?.approval_required) tx = await reclassAction(tx.id, "post");
      }
      onSaved(
        tx,
        `${tx.document_number} ${tx.status === "POSTED" ? "posted to stock" : tx.status === "SUBMITTED" ? "submitted for approval" : "saved as draft"}.`
      );
    } catch (err) {
      setErrors(mapServerErrors(err.errors));
      setFormError(
        tx ? `${tx.document_number} was saved but could not be completed: ${err.message} It is listed in the register for retry.` : err.message
      );
      setSubmitting(false);
      if (tx) idemKey.current = newKey();
    }
  };

  const toggleSerial = (sn) =>
    set({
      serial_numbers: formData.serial_numbers.includes(sn)
        ? formData.serial_numbers.filter((s) => s !== sn)
        : [...formData.serial_numbers, sn],
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Create Stock Reclassification</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {formError && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-950/80 border border-rose-800 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Item *</label>
            <select
              value={formData.item_id}
              onChange={(e) => set({ item_id: e.target.value, variant_id: "", batch_number: "", serial_numbers: [], quantity: "" })}
              className={inputCls}
            >
              <option value="">-- Choose Item --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
            <FieldError msg={errors.item_id} />
          </div>

          {elig?.item?.variants?.length > 0 && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Variant *</label>
              <select value={formData.variant_id} onChange={(e) => set({ variant_id: e.target.value, batch_number: "", serial_numbers: [] })} className={inputCls}>
                <option value="">-- Choose Variant --</option>
                {elig.item.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku} - {v.name}
                  </option>
                ))}
              </select>
              <FieldError msg={errors.variant_id} />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Warehouse *</label>
            <select
              value={formData.warehouse_id}
              onChange={(e) => set({ warehouse_id: e.target.value, location_id: "", destination_location_id: "", batch_number: "", serial_numbers: [] })}
              className={inputCls}
            >
              <option value="">-- Choose Warehouse --</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} - {wh.name}
                </option>
              ))}
            </select>
            <FieldError msg={errors.warehouse_id} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Source Location</label>
            <select
              value={formData.location_id}
              disabled={!formData.warehouse_id}
              onChange={(e) => set({ location_id: e.target.value, destination_location_id: "", serial_numbers: [] })}
              className={inputCls}
            >
              <option value="">-- Warehouse level (no location) --</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} - {loc.name}
                </option>
              ))}
            </select>
            <FieldError msg={errors.location_id} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Source Status *</label>
            <select
              value={formData.from_status}
              onChange={(e) => set({ from_status: e.target.value, to_status: "", batch_number: "", serial_numbers: [] })}
              className={inputCls}
            >
              {(elig?.permitted_statuses || Object.keys(STATUS_LABELS)).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s] || s}
                </option>
              ))}
            </select>
            <FieldError msg={errors.from_status} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target Status *</label>
            <select value={formData.to_status} disabled={!elig} onChange={(e) => set({ to_status: e.target.value })} className={inputCls}>
              <option value="">{elig && !targets.length ? "-- No permitted transition --" : "-- Choose Target --"}</option>
              {targets.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s] || s}
                </option>
              ))}
            </select>
            <FieldError msg={errors.to_status} />
            {selectedBatch?.expired && <p className="mt-1 text-[11px] text-amber-400">Expired batch: only restricted targets are permitted.</p>}
          </div>

          {elig?.allow_location_change && formData.warehouse_id && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Target Location {requiredTargetTypes.length ? "*" : "(only if stock physically moves)"}
              </label>
              <select
                value={formData.destination_location_id}
                onChange={(e) => set({ destination_location_id: e.target.value })}
                className={inputCls}
              >
                <option value="">{requiredTargetTypes.length ? "-- Choose Target Location --" : "-- Same as source (status change only) --"}</option>
                {targetLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} - {loc.name}
                    {loc.location_type ? ` (${loc.location_type})` : ""}
                  </option>
                ))}
              </select>
              <FieldError msg={errors.destination_location_id} />
              {formData.destination_location_id && (
                <p className="mt-1 text-[11px] text-slate-500">Recorded as a balanced internal transfer; total on-hand is unchanged.</p>
              )}
            </div>
          )}

          {tracking.batch && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Batch *</label>
              <select value={formData.batch_number} onChange={(e) => set({ batch_number: e.target.value, serial_numbers: [] })} className={inputCls}>
                <option value="">{elig?.batches?.length ? "-- Choose Batch --" : "-- No eligible batch at this location --"}</option>
                {(elig?.batches || []).map((b) => (
                  <option key={b.batch_number} value={b.batch_number}>
                    {b.batch_number} · {fmt(b.eligible_quantity, uom.decimal_places)} {uom.code} eligible
                    {b.expiry_date ? ` · exp ${b.expiry_date}` : ""}
                    {b.expired ? " · EXPIRED" : ""}
                  </option>
                ))}
              </select>
              <FieldError msg={errors.batch_number} />
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">Reclassification Quantity *</label>
            <div className="flex items-stretch">
              <input
                type="number"
                min="0"
                step={step}
                placeholder={uom.decimal_places ? `up to ${uom.decimal_places} decimals` : "whole units"}
                value={formData.quantity}
                onChange={(e) => set({ quantity: e.target.value })}
                className={`${inputCls} rounded-r-none`}
              />
              <span className="inline-flex items-center rounded-r-lg border border-l-0 border-slate-700 bg-slate-800/60 px-3 text-xs font-mono text-slate-300">
                {uom.code || "UOM"}
              </span>
            </div>
            <FieldError msg={errors.quantity} />
            <p className="mt-1 text-[11px] text-slate-400">
              {eligLoading
                ? "Checking eligible stock…"
                : eligError
                ? <span className="text-rose-400">{eligError}</span>
                : eligibleQty === null
                ? "Select item and warehouse to see eligible stock."
                : (
                  <>
                    Eligible {formData.from_status}: <b className="text-slate-200">{fmt(eligibleQty, uom.decimal_places)} {uom.code}</b>
                    {elig?.balance && ` · On-hand ${fmt(elig.balance.on_hand, uom.decimal_places)}, reserved ${fmt(elig.balance.reserved, uom.decimal_places)}`}
                  </>
                )}
            </p>
          </div>

          {tracking.serial && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Serial Numbers * ({formData.serial_numbers.length} of {Number(formData.quantity) || 0} selected)
              </label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/50 p-2">
                {(elig?.serials || []).length === 0 && <span className="text-xs text-slate-500">No eligible serials in {formData.from_status} at this location.</span>}
                {(elig?.serials || []).map((s) => (
                  <label key={s.serial_number} className="flex items-center gap-1 text-xs font-mono text-slate-200 px-2 py-1 rounded bg-slate-800">
                    <input type="checkbox" checked={formData.serial_numbers.includes(s.serial_number)} onChange={() => toggleSerial(s.serial_number)} />
                    {s.serial_number}
                  </label>
                ))}
              </div>
              <FieldError msg={errors.serial_numbers} />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Effective Date *</label>
            <input type="date" max={today()} value={formData.transaction_date} onChange={(e) => set({ transaction_date: e.target.value })} className={inputCls} />
            <FieldError msg={errors.transaction_date} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Reference (optional)</label>
            <input
              type="text"
              maxLength={100}
              placeholder="e.g. QC-REPORT-2026-114"
              value={formData.reference_number}
              onChange={(e) => set({ reference_number: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">Business Reason *</label>
            <input
              type="text"
              placeholder="e.g. Quality audit sample testing hold, quarantine release, supplier recall"
              value={formData.reason}
              onChange={(e) => set({ reason: e.target.value })}
              className={inputCls}
            />
            <FieldError msg={errors.reason} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">Evidence (optional)</label>
            <label className="flex items-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-400 cursor-pointer hover:border-indigo-500">
              <Paperclip className="h-4 w-4" />
              {files.length ? files.map((f) => f.name).join(", ") : "Attach QC reports or photos (max 25 MB each)"}
              <input
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.csv,.xlsx,.xls,.doc,.docx,.txt"
                onChange={(e) => setFiles([...(e.target.files || [])].filter((f) => f.size <= 25 * 1024 * 1024))}
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
          <span className="text-[11px] text-slate-500">
            {elig?.approval_required ? "Requires approval before posting." : "Posts immediately after submission."}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(true)}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 transition disabled:opacity-50"
            >
              {submitting ? "Processing..." : elig?.approval_required ? "Submit for Approval" : "Confirm Reclassification"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StockReclassificationPage;
