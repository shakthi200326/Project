import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Barcode,
  CheckCircle2,
  Image as ImageIcon,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  assignVariantAttributesToItem,
  createVariant,
  enableItemVariants,
  fetchVariantAttributes,
  fetchVariantAttributeCatalogue,
  fetchVariantEligibleItems,
  previewVariantSku,
  updateVariant,
  uploadAttachment,
  generateEan13,
  seedStandardAttributes,
} from "../services/api";

const VARIANT_OWNER_TYPE = "inventory.inventoryitemvariant";

function getErrorMessage(error) {
  if (!error) return "An unexpected error occurred.";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  return JSON.stringify(error);
}

function formatStatus(variant) {
  if (!variant) return "Active";
  const status = String(variant.status || "").toUpperCase();
  if (status === "ACTIVE") return "Active";
  if (status === "INACTIVE" || status === "DISCONTINUED") return "Inactive";
  return variant.is_active !== false && variant.is_active !== undefined
    ? "Active"
    : "Inactive";
}

export function CreateProductVariantModal({
  isOpen = true,
  initialVariant = null,
  initialParentItemId = "",
  eligibleItems: passedEligibleItems = null,
  onClose,
  onCreated,
  onUpdated,
  onParentEnabled,
}) {
  const isEditing = Boolean(initialVariant);

  const [eligibleItems, setEligibleItems] = useState(passedEligibleItems || []);
  const [loadingItems, setLoadingItems] = useState(!passedEligibleItems);

  const [form, setForm] = useState(() => ({
    item: initialVariant?.item
      ? String(initialVariant.item)
      : initialParentItemId
      ? String(initialParentItemId)
      : "",
    variant_name: initialVariant?.variant_name || "",
    status: initialVariant ? formatStatus(initialVariant).toUpperCase() : "ACTIVE",
    barcode: initialVariant?.barcode || "",
    description: initialVariant?.description || "",
    image: null,
  }));

  const [imagePreviewUrl, setImagePreviewUrl] = useState(
    initialVariant?.image_url || initialVariant?.image || null
  );

  const [attributeRows, setAttributeRows] = useState([{ attributeId: "", valueId: "" }]);
  const [attributes, setAttributes] = useState([]);
  const [assignedAttributeIds, setAssignedAttributeIds] = useState([]);
  const [catalogueAttributes, setCatalogueAttributes] = useState(false);
  const [attributesLoading, setAttributesLoading] = useState(false);
  const [assigningAttribute, setAssigningAttribute] = useState(false);
  const [initializingAttributes, setInitializingAttributes] = useState(false);
  const [attributesError, setAttributesError] = useState("");
  const [preview, setPreview] = useState(
    initialVariant
      ? { sku: initialVariant.sku, variant_name: initialVariant.variant_name }
      : null
  );
  const [previewError, setPreviewError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [enablingParent, setEnablingParent] = useState(false);
  const [savedVariant, setSavedVariant] = useState(null);
  const [uploadedImageId, setUploadedImageId] = useState("");
  const previewRequest = useRef(0);

  // Load eligible parent items if not passed
  useEffect(() => {
    if (!passedEligibleItems) {
      let active = true;
      setLoadingItems(true);
      fetchVariantEligibleItems()
        .then((items) => {
          if (active) setEligibleItems(items);
        })
        .catch((err) => {
          if (active) setError(getErrorMessage(err));
        })
        .finally(() => {
          if (active) setLoadingItems(false);
        });
      return () => {
        active = false;
      };
    } else {
      setEligibleItems(passedEligibleItems);
    }
  }, [passedEligibleItems]);

  const selectedAttributes = useMemo(
    () =>
      attributeRows
        .filter((row) => row.attributeId && row.valueId)
        .map((row) => ({
          attribute_id: Number(row.attributeId),
          value_id: Number(row.valueId),
        })),
    [attributeRows]
  );

  // Fetch attributes whenever parent item changes
  useEffect(() => {
    let active = true;
    if (isEditing || !form.item) {
      setAttributes([]);
      setAssignedAttributeIds([]);
      setCatalogueAttributes(false);
      setAttributesError("");
      setAttributesLoading(false);
      return () => {
        active = false;
      };
    }

    setAttributes([]);
    setAssignedAttributeIds([]);
    setCatalogueAttributes(false);
    setAttributesError("");
    setAttributesLoading(true);

    fetchVariantAttributes(form.item)
      .then(async (result) => {
        if (!active) return;
        if (result.length) {
          setAttributes(result);
          setAssignedAttributeIds(result.map((attr) => String(attr.id)));
          return;
        }
        let catalogue = await fetchVariantAttributeCatalogue();
        if (!active) return;
        if (!catalogue.length) {
          try {
            await seedStandardAttributes(form.item);
            const refetched = await fetchVariantAttributes(form.item);
            if (refetched.length) {
              setAttributes(refetched);
              setAssignedAttributeIds(refetched.map((attr) => String(attr.id)));
              return;
            }
            catalogue = await fetchVariantAttributeCatalogue();
          } catch (e) {}
        }
        setAttributes(catalogue);
        setCatalogueAttributes(catalogue.length > 0);
      })
      .catch((loadError) => {
        if (active) setAttributesError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setAttributesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.item, isEditing]);

  // Debounced SKU and Variant Name preview
  useEffect(() => {
    const requestId = ++previewRequest.current;
    if (isEditing || !form.item || selectedAttributes.length === 0) {
      setPreview(null);
      setPreviewError("");
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const result = await previewVariantSku({
          item: Number(form.item),
          selected_attributes: selectedAttributes,
        });
        if (requestId !== previewRequest.current) return;
        setPreview(result);
        setPreviewError("");
      } catch (previewRequestError) {
        if (requestId !== previewRequest.current) return;
        setPreview(null);
        setPreviewError(getErrorMessage(previewRequestError));
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [form.item, isEditing, selectedAttributes]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((curr) => ({ ...curr, image: file }));
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }
  };

  const handleGenerateBarcode = async () => {
    try {
      const ean = await generateEan13();
      if (ean) setForm((curr) => ({ ...curr, barcode: ean }));
    } catch {
      // Fallback local barcode
      const randomCode = "VAR-" + Math.floor(100000000000 + Math.random() * 900000000000);
      setForm((curr) => ({ ...curr, barcode: randomCode }));
    }
  };

  const handleInitializeStandardAttributes = async () => {
    setInitializingAttributes(true);
    setError("");
    try {
      await seedStandardAttributes(form.item || null);
      if (form.item) {
        const result = await fetchVariantAttributes(form.item);
        if (result.length) {
          setAttributes(result);
          setAssignedAttributeIds(result.map((attr) => String(attr.id)));
          return;
        }
      }
      const catalogue = await fetchVariantAttributeCatalogue();
      setAttributes(catalogue);
      setCatalogueAttributes(catalogue.length > 0);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setInitializingAttributes(false);
    }
  };

  const changeParent = async (itemId) => {
    const item = eligibleItems.find((candidate) => String(candidate.id) === itemId);
    setError("");
    if (item && !item.has_variants) {
      setEnablingParent(true);
      try {
        await enableItemVariants(item.id);
        if (onParentEnabled) onParentEnabled(item.id);
      } catch (enableError) {
        setError(getErrorMessage(enableError));
        setEnablingParent(false);
        return;
      }
      setEnablingParent(false);
    }
    setForm((current) => ({
      ...current,
      item: itemId,
      variant_name: "",
    }));
    setAttributeRows([{ attributeId: "", valueId: "" }]);
  };

  const changeAttribute = async (rowIndex, attributeId) => {
    if (attributeId && !assignedAttributeIds.includes(String(attributeId))) {
      setAssigningAttribute(true);
      setError("");
      const nextAssignedIds = [...assignedAttributeIds, String(attributeId)];
      try {
        await assignVariantAttributesToItem(form.item, nextAssignedIds.map(Number));
        setAssignedAttributeIds(nextAssignedIds);
      } catch (assignmentError) {
        setError(getErrorMessage(assignmentError));
        setAssigningAttribute(false);
        return;
      }
      setAssigningAttribute(false);
    }
    setAttributeRows((current) =>
      current.map((row, index) => (index === rowIndex ? { attributeId, valueId: "" } : row))
    );
  };

  const changeAttributeValue = (rowIndex, valueId) => {
    setAttributeRows((current) =>
      current.map((row, index) => (index === rowIndex ? { ...row, valueId } : row))
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (isEditing) {
        let imageId = "";
        if (form.image) {
          const fileRecord = await uploadAttachment(
            form.image,
            VARIANT_OWNER_TYPE,
            initialVariant.id
          );
          imageId = fileRecord.id;
        }
        await updateVariant(initialVariant.id, {
          variant_name: form.variant_name.trim(),
          barcode: form.barcode.trim(),
          description: form.description.trim(),
          status: form.status,
          ...(imageId ? { image_id: imageId } : {}),
        });
        if (onUpdated) onUpdated();
        if (onClose) onClose();
        return;
      }

      let variant = savedVariant;
      if (!variant) {
        variant = await createVariant({
          item: Number(form.item),
          selected_attributes: selectedAttributes,
          status: form.status,
          barcode: form.barcode.trim(),
          description: form.description.trim(),
        });
        setSavedVariant(variant);
        if (onCreated) onCreated(variant);
      }

      if (form.image) {
        const imageId =
          uploadedImageId ||
          (await uploadAttachment(form.image, VARIANT_OWNER_TYPE, variant.id)).id;
        if (!uploadedImageId) setUploadedImageId(imageId);
        await updateVariant(variant.id, { image_id: imageId });
      }

      if (onUpdated) onUpdated();
      if (onClose) onClose();
    } catch (submitError) {
      setError(
        savedVariant
          ? `Variant was created, but its image could not be attached: ${getErrorMessage(
              submitError
            )}. Click save to retry.`
          : getErrorMessage(submitError)
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-variant-modal-title"
        className="max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-h-[calc(100vh-2.5rem)]"
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="create-variant-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                {isEditing ? "Edit Product Variant" : "Create Product Variant"}
              </h2>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                {isEditing
                  ? "Update variant status, barcode, image and description."
                  : "Create a new variant for an existing product."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-6">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: Parent Product */}
          {!isEditing && (
            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
              

              <div>
                <label
                  htmlFor="variant-parent-item"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Parent Item <span className="text-rose-600">*</span>
                </label>
                <select
                  id="variant-parent-item"
                  required
                  value={form.item}
                  onChange={(e) => changeParent(e.target.value)}
                  disabled={Boolean(savedVariant) || enablingParent || loadingItems}
                  className={inputClass}
                >
                  <option value="">Select existing Item Master product</option>
                  {eligibleItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} — {item.name}
                      {item.has_variants ? "" : " (variants will be enabled)"}
                    </option>
                  ))}
                </select>
                {loadingItems && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading products...
                  </p>
                )}
                {enablingParent && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Enabling variant support on parent item...
                  </p>
                )}
              </div>
            </section>
          )}

          {isEditing && (
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900/40">
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Parent Item
                </div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                  {initialVariant.item_code} — {initialVariant.item_name}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  SKU (Fixed)
                </div>
                <div className="mt-1 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {initialVariant.sku}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: Variant Attributes */}
          {!isEditing && (
            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
              
                <label
                  htmlFor="variant-parent-item"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Variant Attributes <span className="text-rose-600">*</span>
                </label>
              {/* Example Callout Box */}
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-300 flex items-center gap-2">
              
                <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>
                  <strong className="text-slate-900 dark:text-white">Example:</strong> Color &rarr; Red; Size &rarr; Medium
                </span>
              </div>

              {!form.item ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Select a parent item in step 1 to view and select attributes.
                </div>
              ) : attributesLoading ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-500" />
                  Loading available attributes...
                </div>
              ) : attributesError ? (
                <p className="text-xs text-rose-600 dark:text-rose-400">{attributesError}</p>
              ) : attributes.length === 0 ? (
                <div className="rounded-lg border border-amber-300/80 bg-amber-50/50 p-4 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>No active variant attributes configured yet for this item.</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleInitializeStandardAttributes}
                      disabled={initializingAttributes}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition disabled:opacity-50"
                    >
                      {initializingAttributes ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Initialize Standard Attributes (Color, Size, Material)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {catalogueAttributes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Selecting an attribute will automatically assign it to this product master.
                    </p>
                  )}

                  {attributeRows.map((row, rowIndex) => {
                    const usedAttributeIds = new Set(
                      attributeRows
                        .filter((_, idx) => idx !== rowIndex)
                        .map((entry) => entry.attributeId)
                        .filter(Boolean)
                    );
                    const selectedAttribute = attributes.find(
                      (attr) => String(attr.id) === row.attributeId
                    );

                    return (
                      <div
                        key={rowIndex}
                        className="grid gap-2.5 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto] dark:border-slate-700/80 dark:bg-slate-800/80"
                      >
                        <div>
                          <label
                            htmlFor={`variant-attr-${rowIndex}`}
                            className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            Attribute{rowIndex === 0 && <span className="text-rose-600"> *</span>}
                          </label>
                          <select
                            id={`variant-attr-${rowIndex}`}
                            required={rowIndex === 0 || Boolean(row.valueId)}
                            value={row.attributeId}
                            onChange={(e) => changeAttribute(rowIndex, e.target.value)}
                            className={inputClass}
                          >
                            <option value="">Select applicable attribute</option>
                            {attributes
                              .filter((attr) => !usedAttributeIds.has(String(attr.id)))
                              .map((attr) => (
                                <option key={attr.id} value={attr.id}>
                                  {attr.name} ({attr.code})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor={`variant-val-${rowIndex}`}
                            className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            Attribute Value{rowIndex === 0 && <span className="text-rose-600"> *</span>}
                          </label>
                          <select
                            id={`variant-val-${rowIndex}`}
                            required={Boolean(row.attributeId)}
                            disabled={!selectedAttribute}
                            value={row.valueId}
                            onChange={(e) => changeAttributeValue(rowIndex, e.target.value)}
                            className={inputClass}
                          >
                            <option value="">Select corresponding value</option>
                            {(selectedAttribute?.values || [])
                              .filter((val) => val.is_active)
                              .map((val) => (
                                <option key={val.id} value={val.id}>
                                  {val.value}
                                </option>
                              ))}
                          </select>
                        </div>

                        {attributeRows.length > 1 && (
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() =>
                                setAttributeRows((curr) => curr.filter((_, idx) => idx !== rowIndex))
                              }
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                              title="Remove attribute"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {attributes.length > attributeRows.length && (
                    <button
                      type="button"
                      disabled={!form.item || attributesLoading || assigningAttribute}
                      onClick={() =>
                        setAttributeRows((curr) => [...curr, { attributeId: "", valueId: "" }])
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Another Attribute (e.g. Size, Material)
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* SECTION 3: Variant Information */}
          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
           

            <div className="grid gap-3 sm:grid-cols-3">
              {/* Variant Name */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Variant Name <span className="text-rose-600">*</span>
                </label>
                {isEditing ? (
                  <input
                    required
                    maxLength={150}
                    value={form.variant_name}
                    onChange={(e) => setForm((curr) => ({ ...curr, variant_name: e.target.value }))}
                    className={inputClass}
                  />
                ) : (
                  <div className="min-h-[38px] rounded-lg border border-slate-300 bg-slate-100/80 px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 flex items-center">
                    {preview?.variant_name || (
                      <span className="text-slate-400 italic">Auto-generated</span>
                    )}
                  </div>
                )}
              </div>

              {/* SKU */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  SKU <span className="text-rose-600">*</span>
                </label>
                <div className="min-h-[38px] rounded-lg border border-slate-300 bg-slate-100/80 px-3 py-2 font-mono text-xs font-bold text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-400 flex items-center">
                  {preview?.sku || <span className="text-slate-400 italic font-sans font-normal">Auto-generated and unique</span>}
                </div>
              </div>

              {/* Status */}
              <div>
                <label
                  htmlFor="variant-status-select"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Status <span className="text-rose-600">*</span>
                </label>
                <select
                  id="variant-status-select"
                  required
                  value={form.status}
                  onChange={(e) => setForm((curr) => ({ ...curr, status: e.target.value }))}
                  className={inputClass}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            {previewError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{previewError}</p>
            )}
          </section>

          {/* SECTION 4: Additional Information */}
          <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex items-center justify-between">
              
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Optional
              </span>
            </div>

            {/* Barcode */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="variant-barcode-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Barcode
                </label>
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  className="text-[11px] font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Auto-generate EAN
                </button>
              </div>
              <div className="relative">
                <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="variant-barcode-input"
                  value={form.barcode}
                  onChange={(e) => setForm((curr) => ({ ...curr, barcode: e.target.value }))}
                  placeholder="Enter barcode or click Auto-generate"
                  className={`${inputClass} pl-9 font-mono`}
                />
              </div>
            </div>

            {/* Variant Image */}
            <div>
              <label
                htmlFor="variant-image-file"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Variant Image
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
                {imagePreviewUrl ? (
                  <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img
                      src={imagePreviewUrl}
                      alt="Variant preview"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setForm((curr) => ({ ...curr, image: null }));
                        setImagePreviewUrl(null);
                      }}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 hover:opacity-100 flex items-center justify-center transition"
                      title="Remove image"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <ImageIcon className="h-6 w-6 shrink-0 text-slate-400" />
                )}

                <input
                  id="variant-image-file"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="min-w-0 flex-1 text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-700 dark:text-slate-300 dark:file:bg-emerald-950/60 dark:file:text-emerald-400"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="variant-desc-area"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Description
              </label>
              <textarea
                id="variant-desc-area"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((curr) => ({ ...curr, description: e.target.value }))}
                placeholder="Optional description or special handling notes for this variant"
                className={`${inputClass} resize-y`}
              />
            </div>
          </section>

          {/* Modal Actions */}
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                saving ||
                (!isEditing &&
                  !savedVariant &&
                  (!form.item || selectedAttributes.length === 0 || !preview?.sku))
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 shadow-emerald-950/40"
            >
              {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
              {saving
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Create Variant"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default CreateProductVariantModal;

