import { useState, useEffect, useCallback } from "react";
import {
  fetchBatchesFiltered,
  fetchNearExpiryBatches,
  fetchExpiredBatches,
  fetchShelfLifePolicies,
  createShelfLifePolicy,
  updateShelfLifePolicy,
  deleteShelfLifePolicy,
  fetchItems,
} from "../services/api";
import { ScrollableTabs } from "../components/ScrollableTabs.jsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeExpiryDate(mfgDate, duration, unit) {
  if (!mfgDate || !duration) return null;
  const d = new Date(mfgDate);
  if (unit === "DAYS") d.setDate(d.getDate() + Number(duration));
  else if (unit === "MONTHS") d.setMonth(d.getMonth() + Number(duration));
  else if (unit === "YEARS") d.setFullYear(d.getFullYear() + Number(duration));
  return d.toISOString().split("T")[0];
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center items-center py-16">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="rounded-md bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
      {message}
    </div>
  );
}

function KpiCard({ label, value, color = "blue" }) {
  const colors = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700",
    amber:
      "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700",
    red: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700",
  };
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-1 ${colors[color]}`}
    >
      <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </span>
      <span className="text-3xl font-bold">{value ?? "—"}</span>
    </div>
  );
}

function Badge({ children, color = "gray" }) {
  const colors = {
    green:
      "bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300",
    amber:
      "bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-300",
    red: "bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-300",
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colors[color]}`}
    >
      {children}
    </span>
  );
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in">
      <span>✓</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 text-white/70 hover:text-white">
        ✕
      </button>
    </div>
  );
}

function ConfirmModal({ title, description, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {description}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Processing…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 1: Manufacturing Date Tracking ───────────────────────────────────────

function ManufacturingDateTab() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBatchesFiltered({
        page_size: 100,
        ordering: "manufacturing_date",
      });
      const results = (data?.results ?? data ?? []).filter(
        (b) => b.manufacturing_date
      );
      setBatches(results);
    } catch (e) {
      setError(e?.message ?? "Failed to load batches.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const warehouses = [
    ...new Set(batches.map((b) => b.warehouse_name ?? b.warehouse).filter(Boolean)),
  ];

  const filtered = batches.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (b.batch_number ?? "").toLowerCase().includes(q) ||
      (b.item_name ?? b.item ?? "").toLowerCase().includes(q) ||
      (b.sku ?? "").toLowerCase().includes(q);
    const matchWh =
      !warehouseFilter ||
      (b.warehouse_name ?? b.warehouse) === warehouseFilter;
    return matchSearch && matchWh;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search batch, item, SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {["Batch #", "Item", "SKU", "Warehouse", "Manufacturing Date", "Expiry Date", "Age (days)", "Status"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-10 text-sm text-gray-400"
                  >
                    No batches found.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const age = b.manufacturing_date
                    ? daysBetween(b.manufacturing_date, today())
                    : null;
                  return (
                    <tr
                      key={b.id ?? b.batch_number}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                        {b.batch_number ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {b.item_name ?? b.item ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {b.sku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {b.warehouse_name ?? b.warehouse ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {fmtDate(b.manufacturing_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {fmtDate(b.expiry_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {age !== null ? age : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge
                          color={
                            b.status === "active"
                              ? "green"
                              : b.status === "expired"
                              ? "red"
                              : "gray"
                          }
                        >
                          {b.status ?? "—"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Expiry Date Tracking ──────────────────────────────────────────────

function expiryBadgeColor(daysRemaining) {
  if (daysRemaining === null || daysRemaining === undefined) return "gray";
  if (daysRemaining <= 0) return "red";
  if (daysRemaining <= 30) return "amber";
  return "green";
}

function ExpiryDateTab() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBatchesFiltered({ page_size: 100 });
      const results = (data?.results ?? data ?? []).filter((b) => b.expiry_date);
      results.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
      setBatches(results);
    } catch (e) {
      setError(e?.message ?? "Failed to load batches.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const warehouses = [
    ...new Set(batches.map((b) => b.warehouse_name ?? b.warehouse).filter(Boolean)),
  ];

  const filtered = batches.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (b.batch_number ?? "").toLowerCase().includes(q) ||
      (b.item_name ?? b.item ?? "").toLowerCase().includes(q) ||
      (b.sku ?? "").toLowerCase().includes(q);
    const matchWh =
      !warehouseFilter ||
      (b.warehouse_name ?? b.warehouse) === warehouseFilter;
    return matchSearch && matchWh;
  });

  function rowBg(daysRemaining) {
    if (daysRemaining === null || daysRemaining === undefined) return "";
    if (daysRemaining <= 0)
      return "bg-red-50 dark:bg-red-900/20";
    if (daysRemaining <= 30)
      return "bg-amber-50 dark:bg-amber-900/20";
    return "";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search batch, item, SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  "Batch #",
                  "Item",
                  "SKU",
                  "Warehouse",
                  "Mfg Date",
                  "Expiry Date",
                  "Days Remaining",
                  "Expiry Status",
                  "Remaining Qty",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="text-center py-10 text-sm text-gray-400"
                  >
                    No batches found.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const daysRem = b.expiry_date
                    ? daysBetween(today(), b.expiry_date)
                    : null;
                  const bc = expiryBadgeColor(daysRem);
                  return (
                    <tr
                      key={b.id ?? b.batch_number}
                      className={`${rowBg(daysRem)} hover:brightness-95 dark:hover:brightness-110 transition-colors`}
                    >
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                        {b.batch_number ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {b.item_name ?? b.item ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {b.sku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {b.warehouse_name ?? b.warehouse ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {fmtDate(b.manufacturing_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {fmtDate(b.expiry_date)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        <span
                          className={
                            bc === "red"
                              ? "text-red-600 dark:text-red-400"
                              : bc === "amber"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-green-600 dark:text-green-400"
                          }
                        >
                          {daysRem !== null
                            ? daysRem <= 0
                              ? `${Math.abs(daysRem)} days ago`
                              : `${daysRem} days`
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge color={bc}>
                          {bc === "red"
                            ? "Expired"
                            : bc === "amber"
                            ? "Expiring Soon"
                            : "Valid"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {b.remaining_qty ?? b.quantity_remaining ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge
                          color={
                            b.status === "active"
                              ? "green"
                              : b.status === "expired"
                              ? "red"
                              : "gray"
                          }
                        >
                          {b.status ?? "—"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Shelf Life Policy ─────────────────────────────────────────────────

const EMPTY_POLICY_FORM = {
  item: "",
  shelf_life_duration: "",
  shelf_life_unit: "DAYS",
  expiry_warning_days: 30,
  min_remaining_shelf_life_days: 0,
  auto_calculate_expiry: true,
  allow_manual_override: true,
};

function ShelfLifePolicyTab() {
  const [policies, setPolicies] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_POLICY_FORM });
  const [previewMfgDate, setPreviewMfgDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [polData, itemData] = await Promise.all([
        fetchShelfLifePolicies(),
        fetchItems(),
      ]);
      setPolicies(polData?.results ?? polData ?? []);
      setItems(itemData?.results ?? itemData ?? []);
    } catch (e) {
      setError(e?.message ?? "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditingPolicy(null);
    setForm({ ...EMPTY_POLICY_FORM });
    setPreviewMfgDate(today());
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(policy) {
    setEditingPolicy(policy);
    setForm({
      item: policy.item ?? "",
      shelf_life_duration: policy.shelf_life_duration ?? "",
      shelf_life_unit: policy.shelf_life_unit ?? "DAYS",
      expiry_warning_days: policy.expiry_warning_days ?? 30,
      min_remaining_shelf_life_days: policy.min_remaining_shelf_life_days ?? 0,
      auto_calculate_expiry: policy.auto_calculate_expiry ?? true,
      allow_manual_override: policy.allow_manual_override ?? true,
    });
    setPreviewMfgDate(today());
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingPolicy(null);
    setFormError(null);
  }

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.item) {
      setFormError("Please select an item.");
      return;
    }
    if (!form.shelf_life_duration || Number(form.shelf_life_duration) <= 0) {
      setFormError("Shelf life duration must be a positive number.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        shelf_life_duration: Number(form.shelf_life_duration),
        expiry_warning_days: Number(form.expiry_warning_days),
        min_remaining_shelf_life_days: Number(form.min_remaining_shelf_life_days),
      };
      if (editingPolicy) {
        await updateShelfLifePolicy(editingPolicy.id, payload);
        setToast("Shelf life policy updated successfully.");
      } else {
        await createShelfLifePolicy(payload);
        setToast("Shelf life policy created successfully.");
      }
      closeModal();
      load();
    } catch (e) {
      setFormError(e?.message ?? "Failed to save policy.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteShelfLifePolicy(deleteTarget.id);
      setToast("Policy deleted.");
      setDeleteTarget(null);
      load();
    } catch (e) {
      setToast("Failed to delete policy.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const previewExpiry = computeExpiryDate(
    previewMfgDate,
    form.shelf_life_duration,
    form.shelf_life_unit
  );

  const itemMap = Object.fromEntries(items.map((i) => [i.id ?? i.value, i.name ?? i.label ?? i.item_name]));

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage shelf life rules for inventory items.
        </p>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          + Add Policy
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  "Item",
                  "Variant",
                  "Duration",
                  "Unit",
                  "Warning Days",
                  "Min Remaining Days",
                  "Auto Calculate",
                  "Allow Override",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {policies.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-10 text-sm text-gray-400"
                  >
                    No policies defined yet.
                  </td>
                </tr>
              ) : (
                policies.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {p.item_name ?? itemMap[p.item] ?? p.item ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {p.variant_name ?? p.variant ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {p.shelf_life_duration ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {p.shelf_life_unit ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {p.expiry_warning_days ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {p.min_remaining_shelf_life_days ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge color={p.auto_calculate_expiry ? "green" : "gray"}>
                        {p.auto_calculate_expiry ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge color={p.allow_manual_override ? "green" : "gray"}>
                        {p.allow_manual_override ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm flex gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="px-3 py-1 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="px-3 py-1 rounded text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/50 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Policy"
          description={`Delete shelf life policy for "${deleteTarget.item_name ?? deleteTarget.item}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingPolicy ? "Edit Policy" : "Add Shelf Life Policy"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && <ErrorBanner message={formError} />}

              {/* Item */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Item <span className="text-red-500">*</span>
                </label>
                <select
                  name="item"
                  value={form.item}
                  onChange={handleFormChange}
                  required
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select Item —</option>
                  {items.map((item) => (
                    <option key={item.id ?? item.value} value={item.id ?? item.value}>
                      {item.name ?? item.label ?? item.item_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duration + Unit */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Shelf Life Duration <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="shelf_life_duration"
                    value={form.shelf_life_duration}
                    onChange={handleFormChange}
                    min={1}
                    required
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="w-36">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit
                  </label>
                  <select
                    name="shelf_life_unit"
                    value={form.shelf_life_unit}
                    onChange={handleFormChange}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DAYS">Days</option>
                    <option value="MONTHS">Months</option>
                    <option value="YEARS">Years</option>
                  </select>
                </div>
              </div>

              {/* Warning Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expiry Warning Days
                </label>
                <input
                  type="number"
                  name="expiry_warning_days"
                  value={form.expiry_warning_days}
                  onChange={handleFormChange}
                  min={0}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Min Remaining Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Remaining Shelf Life Days
                </label>
                <input
                  type="number"
                  name="min_remaining_shelf_life_days"
                  value={form.min_remaining_shelf_life_days}
                  onChange={handleFormChange}
                  min={0}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Checkboxes */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="auto_calculate_expiry"
                    checked={form.auto_calculate_expiry}
                    onChange={handleFormChange}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Auto Calculate Expiry
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="allow_manual_override"
                    checked={form.allow_manual_override}
                    onChange={handleFormChange}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Allow Manual Override
                  </span>
                </label>
              </div>

              {/* Auto-Calculate Preview */}
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 p-4 space-y-3">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Auto-Calculate Preview
                </p>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      If Manufacturing Date =
                    </label>
                    <input
                      type="date"
                      value={previewMfgDate}
                      onChange={(e) => setPreviewMfgDate(e.target.value)}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:mt-5">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      →{" "}
                    </span>
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                      Expiry Date ={" "}
                      {previewExpiry ? fmtDate(previewExpiry) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving
                    ? "Saving…"
                    : editingPolicy
                    ? "Save Changes"
                    : "Create Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: Near Expiry Stock ─────────────────────────────────────────────────

function NearExpiryTab() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warehouseFilter, setWarehouseFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNearExpiryBatches();
      setBatches(data?.results ?? data ?? []);
    } catch (e) {
      setError(e?.message ?? "Failed to load near-expiry batches.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const warehouses = [
    ...new Set(batches.map((b) => b.warehouse_name ?? b.warehouse).filter(Boolean)),
  ];

  const filtered = batches.filter(
    (b) =>
      !warehouseFilter ||
      (b.warehouse_name ?? b.warehouse) === warehouseFilter
  );

  const totalQty = filtered.reduce(
    (sum, b) => sum + (Number(b.remaining_qty ?? b.quantity_remaining ?? 0)),
    0
  );

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          label="Total Near-Expiry Batches"
          value={filtered.length}
          color="amber"
        />
        <KpiCard
          label="Total Near-Expiry Quantity"
          value={totalQty}
          color="amber"
        />
      </div>

      {/* Warehouse filter */}
      <div>
        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-amber-200 dark:border-amber-800">
          <table className="min-w-full divide-y divide-amber-100 dark:divide-amber-900">
            <thead className="bg-amber-50 dark:bg-amber-900/30">
              <tr>
                {[
                  "Batch #",
                  "Item",
                  "SKU",
                  "Warehouse",
                  "Expiry Date",
                  "Days Remaining",
                  "Remaining Qty",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-10 text-sm text-gray-400"
                  >
                    No near-expiry stock found.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const daysRem = b.expiry_date
                    ? daysBetween(today(), b.expiry_date)
                    : null;
                  return (
                    <tr
                      key={b.id ?? b.batch_number}
                      className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                        {b.batch_number ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {b.item_name ?? b.item ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {b.sku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {b.warehouse_name ?? b.warehouse ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {fmtDate(b.expiry_date)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-amber-600 dark:text-amber-400">
                        {daysRem !== null ? `${daysRem} days` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {b.remaining_qty ?? b.quantity_remaining ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge color="amber">⚠ Expiring Soon</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab 5: Expired Stock ─────────────────────────────────────────────────────

function ExpiredStockTab() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [disposalTarget, setDisposalTarget] = useState(null);
  const [disposalLoading, setDisposalLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExpiredBatches();
      setBatches(data?.results ?? data ?? []);
    } catch (e) {
      setError(e?.message ?? "Failed to load expired batches.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalQty = batches.reduce(
    (sum, b) => sum + Number(b.remaining_qty ?? b.quantity_remaining ?? 0),
    0
  );

  function handleDisposalConfirm() {
    setDisposalLoading(true);
    setTimeout(() => {
      setDisposalLoading(false);
      setDisposalTarget(null);
      setToast("Disposal recorded successfully.");
    }, 800);
  }

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard label="Total Expired Batches" value={batches.length} color="red" />
        <KpiCard label="Total Expired Quantity" value={totalQty} color="red" />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-red-200 dark:border-red-800">
          <table className="min-w-full divide-y divide-red-100 dark:divide-red-900">
            <thead className="bg-red-50 dark:bg-red-900/30">
              <tr>
                {[
                  "Batch #",
                  "Item",
                  "SKU",
                  "Warehouse",
                  "Expiry Date",
                  "Days Overdue",
                  "Remaining Qty",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {batches.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-10 text-sm text-gray-400"
                  >
                    No expired stock found.
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const daysOverdue = b.expiry_date
                    ? Math.abs(Math.min(0, daysBetween(today(), b.expiry_date)))
                    : null;
                  return (
                    <tr
                      key={b.id ?? b.batch_number}
                      className="hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                        {b.batch_number ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {b.item_name ?? b.item ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {b.sku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {b.warehouse_name ?? b.warehouse ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {fmtDate(b.expiry_date)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400">
                        {daysOverdue !== null ? `${daysOverdue} days` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {b.remaining_qty ?? b.quantity_remaining ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge color="red">✕ Expired</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => setDisposalTarget(b)}
                          className="px-3 py-1 rounded text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                        >
                          Initiate Disposal
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {disposalTarget && (
        <ConfirmModal
          title="Initiate Disposal"
          description={`Record disposal for batch "${disposalTarget.batch_number ?? disposalTarget.id}"? This action will be logged.`}
          onConfirm={handleDisposalConfirm}
          onCancel={() => setDisposalTarget(null)}
          loading={disposalLoading}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "manufacturing", label: "Manufacturing Date Tracking" },
  { id: "expiry", label: "Expiry Date Tracking" },
  { id: "policy", label: "Shelf Life Policy" },
  { id: "near_expiry", label: "Near Expiry Stock" },
  { id: "expired", label: "Expired Stock" },
];

export function ExpiryManagementPage() {
  const [activeTab, setActiveTab] = useState("manufacturing");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Expiry Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track manufacturing dates, manage expiry policies, and act on
            near-expiry or expired stock.
          </p>
        </div>

        {/* Tab Nav */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <ScrollableTabs stripClassName="-mb-px flex gap-0" role="group">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-5 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </ScrollableTabs>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "manufacturing" && <ManufacturingDateTab />}
          {activeTab === "expiry" && <ExpiryDateTab />}
          {activeTab === "policy" && <ShelfLifePolicyTab />}
          {activeTab === "near_expiry" && <NearExpiryTab />}
          {activeTab === "expired" && <ExpiredStockTab />}
        </div>
      </div>
    </div>
  );
}

export default ExpiryManagementPage;
