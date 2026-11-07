import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { CreateProductVariantModal } from "../components/CreateProductVariantModal.jsx";
import {
  AlertCircle,
  Barcode,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  assignVariantAttributesToItem,
  createVariant,
  enableItemVariants,
  fetchVariantAttributes,
  fetchVariantAttributeCatalogue,
  fetchVariantEligibleItems,
  fetchVariantParentItems,
  fetchVariantsPage,
  previewVariantSku,
  toggleVariantActive,
  updateVariant,
  uploadAttachment,
} from "../services/api.js";

const PAGE_SIZE = 25;
const VARIANT_OWNER_TYPE = "apps.products.models.InventoryItemVariant";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

function getErrorMessage(error) {
  return error?.message || "Something went wrong. Please try again.";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function formatStatus(variant) {
  return variant.is_active && variant.status !== "INACTIVE"
    ? "Active"
    : "Inactive";
}

const VariantFormModal = CreateProductVariantModal;

function VariantDetailModal({ variant, onClose }) {
  if (!variant) return null;
  const attributes = Object.entries(variant.attributes || {});
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="variant-detail-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="variant-detail-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Variant Details
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {variant.item_code} — {variant.item_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close variant details"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Variant Name</dt>
            <dd className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-white">{variant.variant_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">SKU</dt>
            <dd className="mt-1 break-all font-mono text-sm font-bold text-indigo-700 dark:text-indigo-300">{variant.sku}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Status</dt>
            <dd className="mt-1 text-sm text-slate-900 dark:text-white">{formatStatus(variant)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Created</dt>
            <dd className="mt-1 text-sm text-slate-900 dark:text-white">{formatDate(variant.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Barcode</dt>
            <dd className="mt-1 font-mono text-sm text-slate-900 dark:text-white">{variant.barcode || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Selected Attributes</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {attributes.length > 0 ? (
                attributes.map(([name, value]) => (
                  <span
                    key={name}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <strong>{name}:</strong> {value}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No attributes recorded</span>
              )}
            </dd>
          </div>
          {variant.description && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Description</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
                {variant.description}
              </dd>
            </div>
          )}
        </dl>
        <div className="mt-6 flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

export function ProductVariantsPage() {
  const [variants, setVariants] = useState([]);
  const [eligibleItems, setEligibleItems] = useState([]);
  const [parentItems, setParentItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [referenceReload, setReferenceReload] = useState(0);
  const [referenceError, setReferenceError] = useState("");
  const [openingCreate, setOpeningCreate] = useState(false);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [parentFilter, setParentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [modal, setModal] = useState(null);
  const [savedVariant, setSavedVariant] = useState(null);
  const [actionError, setActionError] = useState("");
  const [busyVariantId, setBusyVariantId] = useState(null);
  const [pendingDeactivation, setPendingDeactivation] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (
      location.pathname.endsWith("/create") ||
      location.pathname.endsWith("/new") ||
      searchParams.get("action") === "create" ||
      searchParams.get("create") === "true"
    ) {
      openCreate();
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetchVariantEligibleItems(),
      fetchVariantParentItems(),
    ]).then((results) => {
      if (!active) return;
      const [eligibleResult, parentsResult] = results;
      if (eligibleResult.status === "fulfilled") setEligibleItems(eligibleResult.value);
      if (parentsResult.status === "fulfilled") setParentItems(parentsResult.value);
      const failures = results.filter((result) => result.status === "rejected");
      setReferenceError(
        failures.length
          ? "Some variant setup data could not be loaded. Refresh to retry."
          : ""
      );
    });
    return () => {
      active = false;
    };
  }, [referenceReload]);

  const loadVariants = async () => {
    setLoading(true);
    setListError("");
    try {
      const result = await fetchVariantsPage({
        page,
        page_size: PAGE_SIZE,
        search: searchQuery,
        ...(parentFilter ? { item: parentFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ordering: "-created_at",
      });
      setVariants(result.results || []);
      setCount(result.count || 0);
      setHasPrevious(Boolean(result.previous));
      setHasNext(Boolean(result.next));
    } catch (loadError) {
      setVariants([]);
      setCount(0);
      setHasPrevious(false);
      setHasNext(false);
      setListError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVariants();
  }, [page, parentFilter, searchQuery, statusFilter]);

  const openCreate = async () => {
    setSavedVariant(null);
    setOpeningCreate(true);
    setReferenceError("");
    try {
      setEligibleItems(await fetchVariantEligibleItems());
      setModal({ type: "create" });
    } catch (loadError) {
      setReferenceError(getErrorMessage(loadError));
    } finally {
      setOpeningCreate(false);
    }
  };

  const closeModal = () => {
    setModal(null);
    setSavedVariant(null);
  };

  const refreshAfterSave = () => {
    closeModal();
    loadVariants();
  };

  const handleToggleStatus = async (variant) => {
    const isActive = formatStatus(variant) === "Active";
    if (isActive) {
      setActionError("");
      setPendingDeactivation(variant);
      return;
    }

    await saveVariantStatus(variant);
  };

  const saveVariantStatus = async (variant) => {
    setActionError("");
    setBusyVariantId(variant.id);
    try {
      await toggleVariantActive(variant.id);
      await loadVariants();
    } catch (toggleError) {
      setActionError(getErrorMessage(toggleError));
    } finally {
      setBusyVariantId(null);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Layers className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Product Variants
            </h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Create and manage item variants with server-generated SKUs and validated attribute combinations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setReferenceReload((current) => current + 1);
              loadVariants();
            }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            disabled={openingCreate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            {openingCreate ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {openingCreate ? "Loading Items..." : "Create Product Variant"}
          </button>
        </div>
      </header>

      {pendingDeactivation && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center"
        >
          <AlertCircle className="hidden h-4 w-4 shrink-0 sm:block" />
          <p className="flex-1">
            Deactivate variant <strong>{pendingDeactivation.sku}</strong>?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingDeactivation(null)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-amber-950/60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const variant = pendingDeactivation;
                setPendingDeactivation(null);
                saveVariantStatus(variant);
              }}
              className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              Deactivate
            </button>
          </div>
        </div>
      )}

      {(referenceError || actionError || listError) && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">{actionError || listError || referenceError}</div>
          {listError && (
            <button
              type="button"
              onClick={loadVariants}
              className="font-semibold underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(240px,1fr)_minmax(180px,240px)_minmax(160px,200px)] sm:p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="relative block">
          <span className="sr-only">Search variants</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, SKU, barcode..."
            className={`${inputClass} pl-9`}
          />
        </label>
        <label>
          <span className="sr-only">Filter by parent item</span>
          <select
            value={parentFilter}
            onChange={(event) => {
              setParentFilter(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All Parent Items</option>
            {parentItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
              <tr>
                <th scope="col" className="px-4 py-3.5">Variant Name</th>
                <th scope="col" className="px-4 py-3.5">Parent Item</th>
                <th scope="col" className="px-4 py-3.5">SKU</th>
                <th scope="col" className="px-4 py-3.5">Selected Attributes</th>
                <th scope="col" className="px-4 py-3.5">Status</th>
                <th scope="col" className="px-4 py-3.5">Created Date</th>
                <th scope="col" className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-slate-600 dark:text-slate-300">
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-600" />
                    Loading variants…
                  </td>
                </tr>
              ) : listError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-rose-700 dark:text-rose-300">
                    Variants could not be loaded. Use Retry to try again.
                  </td>
                </tr>
              ) : variants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <Package className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                    <p className="font-semibold text-slate-800 dark:text-slate-100">No variants found</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Try a different filter or add a variant to an eligible Item Master record.
                    </p>
                  </td>
                </tr>
              ) : (
                variants.map((variant) => (
                  <tr key={variant.id} className="align-top hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="max-w-64 px-4 py-3.5 font-semibold text-slate-900 dark:text-white">
                      <span className="break-words">{variant.variant_name}</span>
                      {variant.barcode && (
                        <span className="mt-1 flex items-center gap-1 font-mono text-xs font-normal text-slate-500 dark:text-slate-400">
                          <Barcode className="h-3.5 w-3.5" />
                          {variant.barcode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{variant.item_name || "—"}</div>
                      <div className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">{variant.item_code || "—"}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-indigo-700 dark:text-indigo-300">{variant.sku}</td>
                    <td className="max-w-72 px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(variant.attributes || {}).length > 0 ? (
                          Object.entries(variant.attributes).map(([name, value]) => (
                            <span
                              key={name}
                              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <strong>{name}:</strong> {value}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          formatStatus(variant) === "Active"
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {formatStatus(variant)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                      {formatDate(variant.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setModal({ type: "view", variant })}
                          aria-label={`View ${variant.sku}`}
                          title="View"
                          className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setModal({ type: "edit", variant })}
                          aria-label={`Edit ${variant.sku}`}
                          title="Edit"
                          className="rounded-lg border border-indigo-200 p-2 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/70 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                        >
                          <Layers className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(variant)}
                          disabled={busyVariantId === variant.id}
                          aria-label={`${formatStatus(variant) === "Active" ? "Deactivate" : "Activate"} ${variant.sku}`}
                          title={formatStatus(variant) === "Active" ? "Deactivate" : "Activate"}
                          className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {busyVariantId === variant.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            formatStatus(variant) === "Active" ? (
                              <X className="h-4 w-4" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {count === 0
              ? "No variants"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, count)} of ${count} variants`}
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={!hasPrevious || loading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="min-w-16 text-center text-xs text-slate-600 dark:text-slate-300">
              Page {page}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={!hasNext || loading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </section>

      {modal?.type === "create" && (
        <VariantFormModal
          createdVariant={savedVariant}
          eligibleItems={eligibleItems}
          onParentEnabled={(itemId) =>
            {
              const markVariantEnabled = (items) =>
                items.map((item) =>
                  item.id === itemId ? { ...item, has_variants: true } : item
                );
              setEligibleItems(markVariantEnabled);
              setParentItems(markVariantEnabled);
            }
          }
          onClose={closeModal}
          onCreated={setSavedVariant}
          onUpdated={refreshAfterSave}
        />
      )}
      {modal?.type === "edit" && (
        <VariantFormModal
          eligibleItems={eligibleItems}
          initialVariant={modal.variant}
          onClose={closeModal}
          onCreated={setSavedVariant}
          onUpdated={refreshAfterSave}
        />
      )}
      {modal?.type === "view" && (
        <VariantDetailModal
          variant={modal.variant}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

export default ProductVariantsPage;
