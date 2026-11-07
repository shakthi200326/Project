import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FilePlus, Loader2, Paperclip, Plus, Save, Send, Trash2, X } from "lucide-react";
import {
  ATTACHMENT_OWNERS,
  createReceipt,
  fetchActiveWarehouses,
  fetchReceipt,
  fetchReceiptItem,
  fetchWarehouseLocations,
  receiptAction,
  searchReceiptItems,
  updateReceipt,
  uploadAttachment,
} from "../../services/goodsReceiptApi";
import {
  Attachments,
  Card,
  ErrorBanner,
  Field,
  GrnPage,
  LoadingBlock,
  Notice,
  ReadOnly,
  SubmoduleGate,
  btnPrimary,
  btnSecondary,
  errorInputCls,
  fmtQty,
  inputCls,
  today,
  useGrnContext,
  useToast,
} from "./grnComponents";

const newKey = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const emptyLine = () => ({
  key: newKey(),
  item: null,
  variant: "",
  uom: "",
  expected_quantity: "",
  received_quantity: "",
  unit_cost: "",
  batch_number: "",
  serials: "",
  manufacturing_date: "",
  expiry_date: "",
  description: "",
  location: "",
});

const splitSerials = (text) =>
  String(text || "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

export function ReceiptFormPage() {
  const grn = useGrnContext();
  const { id } = useParams();
  return (
    <GrnPage
      title={id ? "Edit Goods Receipt" : "Create Goods Receipt"}
      subtitle="Record received goods as a draft. Drafts never affect stock; submit sends the receipt to inspection or putaway."
      icon={FilePlus}
    >
      <SubmoduleGate grn={grn} submodule="create">
        <ReceiptForm grn={grn} receiptId={id} />
      </SubmoduleGate>
    </GrnPage>
  );
}

function ReceiptForm({ grn, receiptId }) {
  const navigate = useNavigate();
  const [toastNode, toast] = useToast();
  const cfg = grn.settings("create");
  const inspCfg = grn.settings("inspection");
  const qualityCfg = grn.settings("quality");
  const idemKey = useRef(newKey());

  const [loading, setLoading] = useState(!!receiptId);
  const [loadError, setLoadError] = useState(null);
  const [documentNumber, setDocumentNumber] = useState("");
  const [header, setHeader] = useState(() => ({
    document_number: "",
    receipt_type: cfg.default_receipt_type || "",
    transaction_date: today(),
    external_reference: "",
    supplier: "",
    supplier_reference: "",
    purchase_order_reference: "",
    warehouse: cfg.default_warehouse_id ? String(cfg.default_warehouse_id) : "",
    receiving_location: cfg.default_location_id ? String(cfg.default_location_id) : "",
    expected_date: "",
    received_by: grn.username,
    remarks: "",
    inspection_required: !!inspCfg.default_inspection_required,
  }));
  const [lines, setLines] = useState([emptyLine()]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);

  const manualAllowed = cfg.allow_manual_number && grn.hasPerm(cfg.manual_number_permission);
  const inspectionForced =
    (qualityCfg.enabled && qualityCfg.quality_inspection_required) ||
    !inspCfg.enabled ||
    inspCfg.inspection_mode !== "OPTIONAL";
  const inspectionForcedValue =
    (qualityCfg.enabled && qualityCfg.quality_inspection_required) ||
    (inspCfg.enabled && inspCfg.inspection_mode === "MANDATORY");

  useEffect(() => {
    fetchActiveWarehouses().then(setWarehouses).catch(setServerError);
  }, []);

  useEffect(() => {
    if (!header.warehouse) {
      setLocations([]);
      return;
    }
    fetchWarehouseLocations(header.warehouse).then(setLocations).catch(setServerError);
  }, [header.warehouse]);

  // Edit mode: load the draft and the item master rows behind its lines.
  useEffect(() => {
    if (!receiptId) return;
    let alive = true;
    (async () => {
      try {
        const rec = await fetchReceipt(receiptId);
        if (rec.status !== "DRAFT") {
          navigate(`/inventory/goods-receipt/receipts/${rec.id}`, { replace: true });
          return;
        }
        const receiptLines = Array.isArray(rec.lines) ? rec.lines : [];
        const itemIds = [...new Set(receiptLines.map((l) => l.item))];
        const items = Object.fromEntries(
          (await Promise.all(itemIds.map((i) => fetchReceiptItem(i)))).filter(Boolean).map((i) => [i.id, i])
        );
        if (!alive) return;
        setDocumentNumber(rec.document_number);
        setHeader({
          document_number: rec.document_number,
          receipt_type: rec.receipt_type,
          transaction_date: rec.transaction_date,
          external_reference: rec.external_reference,
          supplier: rec.supplier,
          supplier_reference: rec.supplier_reference,
          purchase_order_reference: rec.purchase_order_reference,
          warehouse: String(rec.warehouse),
          receiving_location: rec.receiving_location ? String(rec.receiving_location) : "",
          expected_date: rec.expected_date || "",
          received_by: rec.received_by,
          remarks: rec.remarks,
          inspection_required: rec.inspection_required,
        });
        setLines(
          receiptLines.length
            ? receiptLines.map((l) => ({
                key: String(l.id),
                item: items[l.item] || { id: l.item, code: l.item_code, name: l.item_name, variants: [], uom_options: [l.uom], tracking: l.tracking, inactive: true },
                variant: l.variant ? String(l.variant) : "",
                uom: l.uom,
                expected_quantity: l.expected_quantity ?? "",
                received_quantity: l.received_quantity,
                unit_cost: l.unit_cost,
                batch_number: l.batch_number,
                serials: (l.serial_numbers || []).join("\n"),
                manufacturing_date: l.manufacturing_date || "",
                expiry_date: l.expiry_date || "",
                description: l.description,
                location: l.location && String(l.location) !== String(rec.receiving_location) ? String(l.location) : "",
              }))
            : [emptyLine()]
        );
      } catch (e) {
        if (alive) setLoadError(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [receiptId, navigate]);

  const setH = (key, value) => {
    setHeader((h) => {
      const next = { ...h, [key]: value };
      if (key === "warehouse") next.receiving_location = "";
      return next;
    });
    if (key === "warehouse") setLines((ls) => ls.map((l) => ({ ...l, location: "" })));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setL = (idx, patch) => {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[`lines[${idx}].${k === "serials" ? "serial_numbers" : k}`]);
      return next;
    });
  };

  const validate = (forSubmit) => {
    const e = {};
    if (!header.receipt_type) e.receipt_type = "Receipt type is required.";
    if (!header.transaction_date) e.transaction_date = "Receipt date is required.";
    else if (!cfg.allow_future_receipt_date && header.transaction_date > today()) e.transaction_date = "Receipt date cannot be in the future.";
    if (!header.warehouse) e.warehouse = "Destination warehouse is required.";
    if (manualAllowed && header.document_number && header.document_number.length > 60) e.document_number = "At most 60 characters.";
    if (forSubmit) {
      const reqMap = {
        external_reference: header.external_reference,
        supplier: header.supplier,
        supplier_reference: header.supplier_reference,
        purchase_order_reference: header.purchase_order_reference,
        expected_delivery_date: header.expected_date,
        receiving_location: header.receiving_location,
        remarks: header.remarks,
      };
      (cfg.required_fields || []).forEach((f) => {
        if (f in reqMap && !reqMap[f]) e[f === "expected_delivery_date" ? "expected_date" : f] = "Required by configuration.";
      });
      if ((cfg.required_fields || []).includes("attachments") && !pendingFiles.length && !receiptId)
        e.attachments = "At least one attachment is required.";
      if (!lines.some((l) => l.item)) e.lines = "Add at least one receipt line.";
    }
    const seen = new Set();
    lines.forEach((l, i) => {
      if (!l.item) {
        if (lines.length > 1 || forSubmit) e[`lines[${i}].item`] = "Item is required.";
        return;
      }
      const p = (k) => `lines[${i}].${k}`;
      const variants = l.item.variants || [];
      if (variants.length && !l.variant) e[p("variant")] = "Select a variant.";
      const qty = Number(l.received_quantity);
      if (!(qty > 0)) e[p("received_quantity")] = "Received quantity must be greater than zero.";
      if (l.expected_quantity !== "" && Number(l.expected_quantity) < 0) e[p("expected_quantity")] = "Cannot be negative.";
      if (header.purchase_order_reference && cfg.require_expected_quantity_with_po && l.expected_quantity === "")
        e[p("expected_quantity")] = "Required when a purchase order is referenced.";
      if (l.unit_cost !== "" && Number(l.unit_cost) < 0) e[p("unit_cost")] = "Cannot be negative.";
      if (cfg.require_receiving_location && !header.receiving_location && !l.location)
        e[p("location")] = "Set a receiving location on the header or this line.";
      const t = l.item.tracking || {};
      if (t.batch && !l.batch_number.trim()) e[p("batch_number")] = "Batch number is required.";
      if (t.expiry && !l.expiry_date) e[p("expiry_date")] = "Expiry date is required.";
      if (l.manufacturing_date && l.manufacturing_date > header.transaction_date) e[p("manufacturing_date")] = "Cannot be after the receipt date.";
      if (l.expiry_date && l.manufacturing_date && l.expiry_date <= l.manufacturing_date) e[p("expiry_date")] = "Must be after the manufacturing date.";
      if (l.expiry_date && cfg.reject_expired_goods && l.expiry_date <= header.transaction_date) e[p("expiry_date")] = "Goods are already expired.";
      const serials = splitSerials(l.serials);
      if (t.serial) {
        if (new Set(serials).size !== serials.length) e[p("serial_numbers")] = "Serial numbers must be unique.";
        else if ((!l.uom || l.uom === l.item.base_uom) && qty > 0 && serials.length !== qty)
          e[p("serial_numbers")] = `${qty} serial number(s) required; ${serials.length} entered.`;
      } else if (serials.length) e[p("serial_numbers")] = "This item is not serial-tracked.";
      const dupKey = `${l.item.id}|${l.variant}|${l.batch_number.trim()}|${l.uom || l.item.base_uom}`;
      if (!cfg.allow_duplicate_lines && seen.has(dupKey)) e[p("item")] = "Duplicate of another line.";
      seen.add(dupKey);
    });
    return e;
  };

  const payload = () => ({
    ...(receiptId || !manualAllowed || !header.document_number.trim() ? {} : { document_number: header.document_number.trim() }),
    receipt_type: header.receipt_type,
    transaction_date: header.transaction_date,
    external_reference: header.external_reference,
    supplier: header.supplier,
    supplier_reference: header.supplier_reference,
    purchase_order_reference: header.purchase_order_reference,
    warehouse: Number(header.warehouse),
    receiving_location: header.receiving_location ? Number(header.receiving_location) : null,
    expected_date: header.expected_date || null,
    received_by: header.received_by,
    remarks: header.remarks,
    inspection_required: header.inspection_required,
    lines: lines
      .filter((l) => l.item)
      .map((l) => ({
        item: l.item.id,
        variant: l.variant ? Number(l.variant) : null,
        uom: l.uom || l.item.base_uom,
        expected_quantity: l.expected_quantity === "" ? null : l.expected_quantity,
        received_quantity: l.received_quantity,
        unit_cost: l.unit_cost === "" ? "0" : l.unit_cost,
        batch_number: l.batch_number.trim(),
        serial_numbers: splitSerials(l.serials),
        manufacturing_date: l.manufacturing_date || null,
        expiry_date: l.expiry_date || null,
        description: l.description,
        location: l.location ? Number(l.location) : null,
      })),
  });

  const save = async (submit) => {
    if (busy) return;
    const clientErrors = validate(submit);
    setErrors(clientErrors);
    setServerError(null);
    if (Object.keys(clientErrors).length) {
      setServerError({ message: "Please correct the highlighted fields." });
      return;
    }
    setBusy(submit ? "submit" : "save");
    let saved = null;
    try {
      saved = receiptId ? await updateReceipt(receiptId, payload()) : await createReceipt(payload(), idemKey.current);
      for (const f of pendingFiles) await uploadAttachment(ATTACHMENT_OWNERS.receipt, saved.id, f, grn.username);
      setPendingFiles([]);
      const warnings = saved.warnings || [];
      if (submit) {
        const submitted = await receiptAction(saved.id, "submit");
        warnings.push(...(submitted.warnings || []));
      }
      navigate(submit ? "/inventory/goods-receipt/register" : `/inventory/goods-receipt/receipts/${saved.id}`, {
        state: { toast: `${saved.document_number} ${submit ? "submitted" : "saved as draft"}.`, warnings },
      });
    } catch (e) {
      setErrors(e.errors || {});
      setServerError(e);
      setBusy(null);
      // The draft exists even if a later step (upload/submit) failed: continue in edit mode.
      if (saved && !receiptId) navigate(`/inventory/goods-receipt/receipts/${saved.id}/edit`, { replace: true });
    }
  };

  if (loading) return <LoadingBlock label="Loading receipt…" />;
  if (loadError) return <ErrorBanner error={loadError} />;

  const err = (k) => errors[k];
  const cls = (k) => `${inputCls} ${err(k) ? errorInputCls : ""}`;
  const receivingLocations = locations;

  return (
    <div className="space-y-4">
      {toastNode}
      <ErrorBanner error={serverError} />

      <Card title="Receipt Header">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {manualAllowed && !receiptId ? (
            <Field label="Receipt Number" error={err("document_number")} hint="Leave blank to auto-generate.">
              <input className={cls("document_number")} value={header.document_number} onChange={(e) => setH("document_number", e.target.value)} />
            </Field>
          ) : (
            <ReadOnly label="Receipt Number" value={documentNumber || "Auto-generated on save"} mono />
          )}
          <Field label="Receipt Date" required error={err("transaction_date")}>
            <input type="date" className={cls("transaction_date")} value={header.transaction_date} max={cfg.allow_future_receipt_date ? undefined : today()} onChange={(e) => setH("transaction_date", e.target.value)} />
          </Field>
          <Field label="Receipt Type" required error={err("receipt_type")}>
            <select className={cls("receipt_type")} value={header.receipt_type} onChange={(e) => setH("receipt_type", e.target.value)}>
              <option value="">Select type…</option>
              {(cfg.receipt_types || []).map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Received By" error={err("received_by")}>
            <input className={cls("received_by")} value={header.received_by} onChange={(e) => setH("received_by", e.target.value)} maxLength={120} />
          </Field>
          <Field label="Destination Warehouse" required error={err("warehouse")}>
            <select className={cls("warehouse")} value={header.warehouse} onChange={(e) => setH("warehouse", e.target.value)}>
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Receiving Location"
            required={cfg.require_receiving_location}
            error={err("receiving_location")}
            hint={!header.warehouse ? "Select a warehouse first." : undefined}
          >
            <select className={cls("receiving_location")} value={header.receiving_location} disabled={!header.warehouse} onChange={(e) => setH("receiving_location", e.target.value)}>
              <option value="">{cfg.require_receiving_location ? "Select location…" : "None"}</option>
              {receivingLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} – {l.name}
                  {l.allow_receiving ? " (receiving)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="External Reference" error={err("external_reference")} required={(cfg.required_fields || []).includes("external_reference")}>
            <input className={cls("external_reference")} value={header.external_reference} onChange={(e) => setH("external_reference", e.target.value)} maxLength={100} placeholder="Delivery note / ASN" />
          </Field>
          <Field label="Supplier" error={err("supplier")} required={(cfg.required_fields || []).includes("supplier")}>
            <input className={cls("supplier")} value={header.supplier} onChange={(e) => setH("supplier", e.target.value)} maxLength={150} />
          </Field>
          <Field label="Supplier Reference" error={err("supplier_reference")} required={(cfg.required_fields || []).includes("supplier_reference")}>
            <input className={cls("supplier_reference")} value={header.supplier_reference} onChange={(e) => setH("supplier_reference", e.target.value)} maxLength={100} />
          </Field>
          <Field
            label="Purchase Order Reference"
            error={err("purchase_order_reference")}
            required={(cfg.required_fields || []).includes("purchase_order_reference")}
            hint="Optional. Works without the Purchase module."
          >
            <input className={cls("purchase_order_reference")} value={header.purchase_order_reference} onChange={(e) => setH("purchase_order_reference", e.target.value)} maxLength={100} />
          </Field>
          <Field label="Expected Delivery Date" error={err("expected_date")} required={(cfg.required_fields || []).includes("expected_delivery_date")}>
            <input type="date" className={cls("expected_date")} value={header.expected_date} onChange={(e) => setH("expected_date", e.target.value)} />
          </Field>
          <Field
            label="Inspection Required"
            hint={inspectionForced ? `Set by configuration (${inspectionForcedValue ? "always" : "never"}).` : "Send lines to receipt inspection on submit."}
          >
            <label className="flex items-center gap-2 text-xs py-1.5">
              <input
                type="checkbox"
                checked={inspectionForced ? inspectionForcedValue : header.inspection_required}
                disabled={inspectionForced}
                onChange={(e) => setH("inspection_required", e.target.checked)}
              />
              Inspect before acceptance
            </label>
          </Field>
          <Field label="Remarks" className="sm:col-span-2 lg:col-span-4" error={err("remarks")} required={(cfg.required_fields || []).includes("remarks")}>
            <textarea rows={2} className={cls("remarks")} value={header.remarks} onChange={(e) => setH("remarks", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card
        title={`Receipt Lines (${lines.filter((l) => l.item).length})`}
        actions={
          <button className={btnSecondary} onClick={() => setLines((ls) => [...ls, emptyLine()])}>
            <Plus className="h-3.5 w-3.5" /> Add Line
          </button>
        }
      >
        {err("lines") && <p className="text-xs text-red-600 mb-2">{err("lines")}</p>}
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 mb-3">
          Accepted, rejected and pending-inspection quantities are set by inspection after submission and are shown on the receipt.
        </p>
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <LineEditor
              key={line.key}
              idx={idx}
              line={line}
              errors={errors}
              locations={locations}
              headerLocation={header.receiving_location}
              cfg={cfg}
              onChange={(patch) => setL(idx, patch)}
              onRemove={lines.length > 1 ? () => setLines((ls) => ls.filter((_, i) => i !== idx)) : null}
            />
          ))}
        </div>
      </Card>

      <Card title="Attachments">
        {receiptId ? (
          <Attachments ownerType={ATTACHMENT_OWNERS.receipt} ownerId={receiptId} canEdit uploadedBy={grn.username} />
        ) : (
          <PendingFiles files={pendingFiles} setFiles={setPendingFiles} error={err("attachments")} />
        )}
      </Card>

      <div className="flex flex-wrap justify-end gap-2 sticky bottom-0 py-3 bg-gradient-to-t from-slate-50 dark:from-zinc-950">
        <button className={btnSecondary} onClick={() => navigate(receiptId ? `/inventory/goods-receipt/receipts/${receiptId}` : "/inventory/goods-receipt/register")} disabled={!!busy}>
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
        <button className={btnSecondary} onClick={() => save(false)} disabled={!!busy}>
          {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Draft
        </button>
        <button className={btnPrimary} onClick={() => save(true)} disabled={!!busy}>
          {busy === "submit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Save & Submit
        </button>
      </div>
    </div>
  );
}

function PendingFiles({ files, setFiles, error }) {
  const ref = useRef(null);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">Files are uploaded when the draft is saved (max 25 MB each).</span>
        <input
          ref={ref}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.csv,.xlsx,.xls,.doc,.docx,.txt"
          onChange={(e) => {
            const picked = [...(e.target.files || [])].filter((f) => f.size <= 25 * 1024 * 1024);
            setFiles((f) => [...f, ...picked]);
            e.target.value = "";
          }}
        />
        <button type="button" className={btnSecondary} onClick={() => ref.current?.click()}>
          <Paperclip className="h-3.5 w-3.5" /> Add files
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800">
          <span className="truncate">{f.name}</span>
          <button type="button" className="cursor-pointer" aria-label={`Remove ${f.name}`} onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}>
            <X className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>
      ))}
    </div>
  );
}

function LineEditor({ idx, line, errors, locations, headerLocation, cfg, onChange, onRemove }) {
  const p = (k) => `lines[${idx}].${k}`;
  const err = (k) => errors[p(k)];
  const cls = (k) => `${inputCls} ${err(k) ? errorInputCls : ""}`;
  const item = line.item;
  const variant = item?.variants?.find((v) => String(v.id) === String(line.variant));
  const tracking = item?.tracking || {};
  const qty = Number(line.received_quantity);
  const expected = line.expected_quantity === "" ? null : Number(line.expected_quantity);
  const tolerance = Number(cfg.over_receipt_tolerance_percent || 0);
  const overReceipt = expected && qty > expected * (1 + tolerance / 100);
  const variance = expected !== null && qty > 0 ? qty - expected : null;

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500">Line {idx + 1}</span>
        {onRemove && (
          <button className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer" onClick={onRemove} aria-label={`Remove line ${idx + 1}`}>
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <Field label="Item" required error={err("item")} className="sm:col-span-2">
          <ItemPicker
            value={item}
            invalid={!!err("item")}
            onSelect={(it) =>
              onChange({
                item: it,
                variant: "",
                uom: it?.base_uom || "",
                description: it?.description || "",
                unit_cost: line.unit_cost === "" && it ? it.standard_cost : line.unit_cost,
                serials: it?.tracking?.serial ? line.serials : "",
              })
            }
          />
        </Field>
        <Field label="Variant" required={!!item?.variants?.length} error={err("variant")}>
          <select className={cls("variant")} value={line.variant} disabled={!item?.variants?.length} onChange={(e) => onChange({ variant: e.target.value })}>
            <option value="">{item?.variants?.length ? "Select variant…" : "No variants"}</option>
            {(item?.variants || []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.sku} – {v.name}
              </option>
            ))}
          </select>
        </Field>
        <ReadOnly label="SKU" value={variant?.sku || item?.code || "—"} mono />
        <ReadOnly label="Barcode" value={variant?.barcode || item?.barcode || "—"} mono />
        <Field label="UOM" error={err("uom")}>
          <select className={cls("uom")} value={line.uom} disabled={!item} onChange={(e) => onChange({ uom: e.target.value })}>
            {(item?.uom_options || []).map((u) => (
              <option key={u} value={u}>
                {u}
                {u === item?.base_uom ? " (base)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description" error={err("description")} className="sm:col-span-2">
          <input className={cls("description")} value={line.description} maxLength={255} onChange={(e) => onChange({ description: e.target.value })} />
        </Field>
        <Field label="Expected Qty" error={err("expected_quantity")} hint={variance ? `Variance ${variance > 0 ? "+" : ""}${fmtQty(variance)}` : undefined}>
          <input type="number" min="0" step="any" className={cls("expected_quantity")} value={line.expected_quantity} onChange={(e) => onChange({ expected_quantity: e.target.value })} />
        </Field>
        <Field
          label="Received Qty"
          required
          error={err("received_quantity") || (overReceipt && cfg.over_receipt_policy === "BLOCK" ? `Exceeds ${tolerance}% over-receipt tolerance.` : undefined)}
          hint={overReceipt && cfg.over_receipt_policy === "WARN" ? `Over-receipt beyond ${tolerance}% (warning).` : undefined}
        >
          <input type="number" min="0" step="any" className={cls("received_quantity")} value={line.received_quantity} onChange={(e) => onChange({ received_quantity: e.target.value })} />
        </Field>
        <Field label="Unit Cost" error={err("unit_cost")}>
          <input type="number" min="0" step="any" className={cls("unit_cost")} value={line.unit_cost} onChange={(e) => onChange({ unit_cost: e.target.value })} />
        </Field>
        <Field label="Line Location" error={err("location")} hint={headerLocation ? "Defaults to the receiving location." : undefined}>
          <select className={cls("location")} value={line.location} onChange={(e) => onChange({ location: e.target.value })}>
            <option value="">{headerLocation ? "Same as header" : "Select…"}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} – {l.name}
              </option>
            ))}
          </select>
        </Field>
        {(tracking.batch || line.batch_number) && (
          <Field label="Batch Number" required={tracking.batch} error={err("batch_number")}>
            <input className={cls("batch_number")} value={line.batch_number} maxLength={80} onChange={(e) => onChange({ batch_number: e.target.value })} />
          </Field>
        )}
        {(tracking.batch || tracking.expiry || line.manufacturing_date) && (
          <Field label="Manufacturing Date" error={err("manufacturing_date")}>
            <input type="date" className={cls("manufacturing_date")} value={line.manufacturing_date} max={today()} onChange={(e) => onChange({ manufacturing_date: e.target.value })} />
          </Field>
        )}
        {(tracking.expiry || tracking.batch || line.expiry_date) && (
          <Field label="Expiry Date" required={tracking.expiry} error={err("expiry_date")}>
            <input type="date" className={cls("expiry_date")} value={line.expiry_date} onChange={(e) => onChange({ expiry_date: e.target.value })} />
          </Field>
        )}
        {tracking.serial && (
          <Field
            label={`Serial Numbers (${splitSerials(line.serials).length}${qty > 0 ? ` of ${qty}` : ""})`}
            required
            error={err("serial_numbers")}
            hint="One per line or comma-separated; count must equal the received quantity in base units."
            className="sm:col-span-2 lg:col-span-3"
          >
            <textarea rows={3} className={`${cls("serial_numbers")} font-mono`} value={line.serials} onChange={(e) => onChange({ serials: e.target.value })} />
          </Field>
        )}
      </div>
      {item?.inactive && <Notice tone="red">This item is no longer active; replace it before submitting.</Notice>}
    </div>
  );
}

/** Debounced server-side item search (code, name, SKU or barcode). */
function ItemPicker({ value, onSelect, invalid }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const search = useCallback((term) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      searchReceiptItems(term)
        .then((r) => {
          setResults(r);
          setError(null);
        })
        .catch(setError)
        .finally(() => setLoading(false));
    }, 250);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const label = useMemo(() => (value ? `${value.code} – ${value.name}` : ""), [value]);

  if (value && !open) {
    return (
      <div className={`${inputCls} flex items-center justify-between gap-2 ${invalid ? errorInputCls : ""}`}>
        <span className="truncate">{label}</span>
        <button
          type="button"
          className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer shrink-0"
          onClick={() => {
            setOpen(true);
            setText("");
            search("");
          }}
        >
          Change
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input
        className={`${inputCls} ${invalid ? errorInputCls : ""}`}
        placeholder="Search code, name, SKU or scan barcode…"
        value={text}
        autoFocus={open}
        onFocus={() => {
          setOpen(true);
          if (!results.length) search(text);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setText(e.target.value);
          search(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results.length === 1) {
            e.preventDefault();
            onSelect(results[0]);
            setOpen(false);
          }
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl">
          {loading && <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>}
          {error && <div className="px-3 py-2 text-xs text-red-600">{error.message}</div>}
          {!loading && !error && !results.length && <div className="px-3 py-2 text-xs text-slate-400">No active stock items found.</div>}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(r);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
            >
              <div className="font-semibold text-slate-900 dark:text-white">
                {r.code} – {r.name}
              </div>
              <div className="text-[10px] text-slate-400">
                {r.base_uom}
                {r.tracking.batch ? " · batch" : ""}
                {r.tracking.serial ? " · serial" : ""}
                {r.tracking.expiry ? " · expiry" : ""}
                {r.variants.length ? ` · ${r.variants.length} variants` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReceiptFormPage;
