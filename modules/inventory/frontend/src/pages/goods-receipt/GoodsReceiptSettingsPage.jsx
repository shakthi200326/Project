import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { History, Loader2, Plus, RotateCcw, Save, Settings2, Trash2 } from "lucide-react";
import {
  fetchActiveWarehouses,
  fetchGrnSettings,
  fetchGrnSettingsHistory,
  fetchWarehouseLocations,
  resetGrnSettings,
  saveGrnSettings,
} from "../../services/goodsReceiptApi";
import {
  Card,
  ConfirmModal,
  DataTable,
  ErrorBanner,
  Field,
  GrnPage,
  LoadingBlock,
  Notice,
  btnPrimary,
  btnSecondary,
  errorInputCls,
  fmtDate,
  fmtDateTime,
  inputCls,
  invalidateGrnContext,
  today,
  useGrnContext,
  useToast,
} from "./grnComponents";

const SUBMODULES = [
  ["register", "Receipt Register"],
  ["create", "Create Goods Receipt"],
  ["inspection", "Receipt Inspection"],
  ["quality", "Quality Inspection"],
  ["accepted", "Accepted Goods"],
  ["rejected", "Rejected Goods"],
  ["partial", "Partial Acceptance"],
  ["putaway", "Putaway Management"],
  ["discrepancy", "Receipt Discrepancy"],
  ["history", "Receipt History"],
];
const EVENTS = ["submitted", "approved", "inspection_completed", "quality_failed", "putaway_completed", "posted", "reversed", "discrepancy_raised"];
const HEADER_FIELDS = [
  ["external_reference", "External Reference"],
  ["supplier", "Supplier"],
  ["supplier_reference", "Supplier Reference"],
  ["purchase_order_reference", "Purchase Order Reference"],
  ["expected_delivery_date", "Expected Delivery Date"],
  ["receiving_location", "Receiving Location"],
  ["remarks", "Remarks"],
  ["attachments", "Attachments"],
];

// [key, type, label, hint?, extra?]
const COMMON = [
  ["enabled", "bool", "Enabled", "When off, this screen and its API are blocked for everyone."],
  ["required_permission", "text", "Required permission", "Permission code needed to use this screen."],
];
const NUMBERING = ["document_type", "text", "Numbering document type", "Sequence rule used from Document Numbering (prefix, length, reset)."];
const FIELDS = {
  register: [["page_size", "int", "Rows per page"], ["default_status_filter", "text", "Default status filter", "Comma-separated statuses, blank for all."]],
  create: [
    NUMBERING,
    ["allow_manual_number", "bool", "Allow manual receipt numbers"],
    ["manual_number_permission", "text", "Manual number permission"],
    ["receipt_types", "receipt_types", "Receipt types"],
    ["default_receipt_type", "receipt_type_select", "Default receipt type"],
    ["default_warehouse_id", "warehouse", "Default warehouse"],
    ["default_location_id", "location", "Default receiving location"],
    ["require_receiving_location", "bool", "Require receiving location (location tracking)"],
    ["required_fields", "multi", "Additional required header fields", "Enforced on submit.", HEADER_FIELDS],
    ["require_expected_quantity_with_po", "bool", "Require expected quantity when a PO is referenced"],
    ["over_receipt_policy", "select", "Over-receipt policy", "BLOCK rejects, WARN accepts with a warning, ALLOW ignores.", ["BLOCK", "WARN", "ALLOW"]],
    ["over_receipt_tolerance_percent", "number", "Over-receipt tolerance (%)"],
    ["allow_future_receipt_date", "bool", "Allow future receipt dates"],
    ["max_backdate_days", "int", "Maximum back-dating (days)"],
    ["allow_duplicate_lines", "bool", "Allow duplicate lines (same item/variant/batch/UOM)"],
    ["enforce_batch_tracking", "bool", "Enforce batch tracking from item settings"],
    ["enforce_serial_tracking", "bool", "Enforce serial tracking from item settings"],
    ["enforce_expiry_tracking", "bool", "Enforce expiry tracking from item settings"],
    ["reject_expired_goods", "bool", "Reject goods already expired on receipt"],
    ["min_remaining_shelf_life_days", "int", "Minimum remaining shelf life (days)"],
    ["approval_required", "bool", "Approval required after submit"],
    ["approval_permission", "text", "Approval permission"],
    ["post_permission", "text", "Posting permission"],
    ["reverse_permission", "text", "Reversal permission"],
  ],
  inspection: [
    NUMBERING,
    ["inspection_mode", "select", "Inspection mode", "MANDATORY forces inspection, DISABLED skips it, OPTIONAL lets the user choose.", ["OPTIONAL", "MANDATORY", "DISABLED"]],
    ["default_inspection_required", "bool", "Inspection ticked by default (optional mode)"],
  ],
  quality: [
    NUMBERING,
    ["quality_inspection_required", "bool", "Quality inspection required before acceptance"],
    ["inspection_types", "list", "Inspection types"],
    ["criteria", "criteria", "Inspection criteria"],
    ["max_failure_rate_percent", "number", "Maximum sample failure rate (%)", "Above this the result is FAIL."],
  ],
  accepted: [["page_size", "int", "Rows per page"]],
  rejected: [
    ["page_size", "int", "Rows per page"],
    ["disposition_permission", "text", "Disposition change permission"],
    ["require_rejection_reason", "bool", "Rejection reason required"],
    ["rejection_reasons", "list", "Rejection reasons"],
    ["dispositions", "list", "Dispositions"],
    ["default_disposition", "disposition_select", "Default disposition"],
  ],
  partial: [["allow_partial_acceptance", "bool", "Allow partial acceptance of a line"], ["page_size", "int", "Rows per page"]],
  putaway: [
    NUMBERING,
    ["putaway_mandatory", "bool", "Putaway mandatory before posting", "When off, unput-away accepted stock is posted to the receiving location."],
    ["allow_multiple_locations", "bool", "Allow multiple putaway locations per line"],
    ["require_location_allows_putaway", "bool", "Only locations flagged 'allow putaway'"],
  ],
  discrepancy: [
    NUMBERING,
    ["discrepancy_types", "list", "Discrepancy types"],
    ["auto_create_on_quantity_variance", "bool", "Auto-raise on expected vs received variance (at submit)"],
    ["auto_create_on_rejection", "bool", "Auto-raise on inspection rejection"],
    ["block_posting_with_open_discrepancies", "bool", "Block posting while discrepancies are open"],
  ],
  history: [["page_size", "int", "Rows per page"], ["include_cancelled", "bool", "Include cancelled receipts"]],
};

export function GoodsReceiptSettingsPage() {
  const grn = useGrnContext();
  const [params, setParams] = useSearchParams();
  const active = params.get("tab") || "create";
  const [all, setAll] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => fetchGrnSettings().then(setAll).catch(setError), []);
  useEffect(() => {
    load();
  }, [load]);

  const canWrite = grn.hasPerm("inventory.grn.configure");
  return (
    <GrnPage
      title="Goods Receipt & Inspection Settings"
  
      icon={Settings2}
    >
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-zinc-800 text-xs">
        {SUBMODULES.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setParams({ tab: key }, { replace: true })}
            className={`px-3.5 py-2 rounded-lg font-medium whitespace-nowrap cursor-pointer ${
              active === key ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            {label}
            {all && !all[key]?.settings?.enabled && <span className="ml-1 text-[10px] opacity-70">(off)</span>}
          </button>
        ))}
      </div>
      {error && <ErrorBanner error={error} onRetry={load} />}
      {!all && !error && <LoadingBlock />}
      {all && !canWrite && !grn.loading && (
        <Notice>You can view these settings but need the inventory.grn.configure permission to change them.</Notice>
      )}
      {all && all[active] && (
        <SubmoduleSettings
          key={`${active}-${all[active].active_version?.id || "default"}`}
          payload={all[active]}
          canWrite={canWrite}
          onSaved={(updated) => {
            setAll((a) => ({ ...a, [active]: updated }));
            invalidateGrnContext();
          }}
        />
      )}
    </GrnPage>
  );
}

function SubmoduleSettings({ payload, canWrite, onSaved }) {
  const [toastNode, toast] = useToast();
  const [draft, setDraft] = useState(payload.settings);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(payload.settings);
  const fields = [...COMMON, ...FIELDS[payload.submodule]];
  const set = (k, v) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await saveGrnSettings(payload.submodule, draft, effectiveFrom, reason);
      onSaved(updated);
      toast(effectiveFrom && effectiveFrom > today() ? `Scheduled from ${effectiveFrom}.` : "Settings saved and active.");
      setReason("");
      setEffectiveFrom("");
      setHistoryKey((k) => k + 1);
    } catch (e) {
      setErrors(e.errors || {});
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {toastNode}
      <Card
        title={payload.label}
        actions={
          <span className="text-[11px] text-slate-500">
            {payload.active_version
              ? `Version #${payload.active_version.id} by ${payload.active_version.created_by || "—"}, effective ${fmtDate(payload.active_version.effective_from)}`
              : "Using built-in defaults"}
          </span>
        }
      >
        {payload.scheduled_versions?.length > 0 && (
          <Notice tone="blue">
            {payload.scheduled_versions.length} scheduled change(s): next takes effect on {fmtDate(payload.scheduled_versions[0].effective_from)}.
          </Notice>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-2">
          {fields.map(([key, type, label, hint, extra]) => (
            <SettingField
              key={key}
              name={key}
              type={type}
              label={label}
              hint={hint}
              extra={extra}
              value={draft[key]}
              settings={draft}
              error={errors[key]}
              disabled={!canWrite}
              onChange={(v) => set(key, v)}
            />
          ))}
          <NotificationsField value={draft.notifications} error={errors.notifications} disabled={!canWrite} onChange={(v) => set("notifications", v)} />
        </div>
        {payload.submodule === "create" || ["inspection", "quality", "putaway", "discrepancy"].includes(payload.submodule) ? (
          <p className="text-[11px] text-slate-400 mt-3">
            Number prefixes and lengths are maintained in <Link className="underline" to="/inventory/configuration/numbering">Document Numbering</Link>.
          </p>
        ) : null}
      </Card>

      {canWrite && (
        <Card title="Apply Changes">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Field label="Effective from" hint="Blank = immediately. A future date schedules the change.">
              <input type="date" min={today()} className={inputCls} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </Field>
            <Field label="Change reason">
              <input className={inputCls} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="flex gap-2 justify-end">
              <button className={btnSecondary} onClick={() => setConfirmReset(true)} disabled={busy}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
              </button>
              <button className={btnPrimary} onClick={save} disabled={busy || !dirty}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
              </button>
            </div>
          </div>
          <div className="mt-3">
            <ErrorBanner error={error} />
          </div>
        </Card>
      )}

      <VersionHistory submodule={payload.submodule} reloadKey={historyKey} />

      {confirmReset && (
        <ConfirmModal
          title={`Reset ${payload.label}`}
          message="Replace these settings with the built-in defaults? The current version stays in history."
          confirmLabel="Reset"
          danger
          onClose={() => setConfirmReset(false)}
          onConfirm={async () => {
            const updated = await resetGrnSettings(payload.submodule);
            onSaved(updated);
            toast("Settings reset to defaults.");
            setHistoryKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function SettingField({ name, type, label, hint, extra, value, settings, error, disabled, onChange }) {
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  useEffect(() => {
    if (type === "warehouse") fetchActiveWarehouses().then(setWarehouses).catch(() => {});
  }, [type]);
  useEffect(() => {
    if (type === "location") fetchWarehouseLocations(settings.default_warehouse_id).then(setLocations).catch(() => {});
  }, [type, settings.default_warehouse_id]);
  const cls = `${inputCls} ${error ? errorInputCls : ""}`;
  const wide = ["receipt_types", "criteria", "multi", "list"].includes(type);

  let control;
  switch (type) {
    case "bool":
      return (
        <label className="flex items-start gap-2.5 py-1.5">
          <input type="checkbox" className="mt-0.5" checked={!!value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
          <span>
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">{label}</span>
            {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
            {error && <span className="block text-[11px] text-red-600">{error}</span>}
          </span>
        </label>
      );
    case "int":
    case "number":
      control = (
        <input
          type="number"
          step={type === "int" ? 1 : "any"}
          className={cls}
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : type === "int" ? parseInt(e.target.value, 10) : Number(e.target.value))}
        />
      );
      break;
    case "select":
      control = (
        <select className={cls} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}>
          {extra.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
      break;
    case "receipt_type_select":
    case "disposition_select": {
      const opts = type === "receipt_type_select" ? (settings.receipt_types || []).map((t) => [t.code, t.label]) : (settings.dispositions || []).map((d) => [d, d]);
      control = (
        <select className={cls} disabled={disabled} value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">None</option>
          {opts.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "warehouse":
      control = (
        <select className={cls} disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
          <option value="">None</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.code})
            </option>
          ))}
        </select>
      );
      break;
    case "location":
      control = (
        <select className={cls} disabled={disabled || !settings.default_warehouse_id} value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
          <option value="">None</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} – {l.name}
            </option>
          ))}
        </select>
      );
      break;
    case "multi":
      control = (
        <div className="flex flex-wrap gap-2">
          {extra.map(([code, text]) => (
            <label key={code} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-slate-50 dark:bg-zinc-800">
              <input
                type="checkbox"
                disabled={disabled}
                checked={(value || []).includes(code)}
                onChange={(e) => onChange(e.target.checked ? [...(value || []), code] : (value || []).filter((v) => v !== code))}
              />
              {text}
            </label>
          ))}
        </div>
      );
      break;
    case "list":
      control = (
        <textarea
          rows={4}
          className={cls}
          disabled={disabled}
          value={(value || []).join("\n")}
          onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
          placeholder="One value per line"
        />
      );
      break;
    case "receipt_types":
      control = <RowsEditor rows={value || []} disabled={disabled} onChange={onChange} columns={[["code", "Code"], ["label", "Label"]]} blank={{ code: "", label: "" }} />;
      break;
    case "criteria":
      control = (
        <RowsEditor
          rows={value || []}
          disabled={disabled}
          onChange={onChange}
          blank={{ code: "", name: "", type: "BOOLEAN", mandatory: true }}
          columns={[
            ["code", "Code"],
            ["name", "Name"],
            ["type", "Type", ["BOOLEAN", "NUMERIC", "TEXT"]],
            ["min", "Min", "number"],
            ["max", "Max", "number"],
            ["mandatory", "Mandatory", "bool"],
          ]}
        />
      );
      break;
    default:
      control = <input className={cls} disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <Field label={label} hint={hint} error={typeof error === "string" ? error : error?.[0]} className={wide ? "md:col-span-2" : ""}>
      {control}
    </Field>
  );
}

function RowsEditor({ rows, columns, blank, disabled, onChange }) {
  const update = (i, key, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          {columns.map(([key, label, kind]) =>
            kind === "bool" ? (
              <label key={key} className="flex items-center gap-1 text-[11px]">
                <input type="checkbox" disabled={disabled} checked={row[key] ?? true} onChange={(e) => update(i, key, e.target.checked)} />
                {label}
              </label>
            ) : Array.isArray(kind) ? (
              <select key={key} className={`${inputCls} w-28`} disabled={disabled} value={row[key]} onChange={(e) => update(i, key, e.target.value)}>
                {kind.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                key={key}
                placeholder={label}
                type={kind === "number" ? "number" : "text"}
                step="any"
                disabled={disabled || (kind === "number" && row.type !== "NUMERIC")}
                className={`${inputCls} ${kind === "number" ? "w-20" : "w-36"}`}
                value={row[key] ?? ""}
                onChange={(e) => update(i, key, kind === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
              />
            )
          )}
          {!disabled && (
            <button type="button" className="p-1 cursor-pointer" aria-label="Remove row" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" className={btnSecondary} onClick={() => onChange([...rows, { ...blank }])}>
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      )}
    </div>
  );
}

function NotificationsField({ value, error, disabled, onChange }) {
  const v = value || { enabled: false, events: [], recipients: [] };
  return (
    <Field label="Notifications" error={typeof error === "string" ? error : undefined} hint="Emitted as outbox events (inventory.goods_receipt.*) for the notification service." className="md:col-span-2">
      <div className="space-y-2 rounded-xl border border-slate-200/80 dark:border-zinc-800 p-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" disabled={disabled} checked={v.enabled} onChange={(e) => onChange({ ...v, enabled: e.target.checked })} />
          Send notifications
        </label>
        <div className="flex flex-wrap gap-2">
          {EVENTS.map((ev) => (
            <label key={ev} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-slate-50 dark:bg-zinc-800">
              <input
                type="checkbox"
                disabled={disabled || !v.enabled}
                checked={v.events.includes(ev)}
                onChange={(e) => onChange({ ...v, events: e.target.checked ? [...v.events, ev] : v.events.filter((x) => x !== ev) })}
              />
              {ev.replace(/_/g, " ")}
            </label>
          ))}
        </div>
        <input
          className={inputCls}
          disabled={disabled || !v.enabled}
          placeholder="Recipients (comma-separated emails or role codes)"
          value={v.recipients.join(", ")}
          onChange={(e) => onChange({ ...v, recipients: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </div>
    </Field>
  );
}

function VersionHistory({ submodule, reloadKey }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    fetchGrnSettingsHistory(submodule).then(setRows).catch(setError);
  }, [submodule, reloadKey]);
  const columns = useMemo(
    () => [
      { key: "id", label: "Version", render: (r) => `#${r.id}` },
      { key: "effective_from", label: "Effective From", render: (r) => fmtDate(r.effective_from) },
      { key: "created_by", label: "Changed By" },
      { key: "created_at", label: "Saved At", render: (r) => fmtDateTime(r.created_at) },
      { key: "change_reason", label: "Reason", render: (r) => (r.is_reset ? "Reset to defaults" : r.change_reason || "—") },
    ],
    []
  );
  return (
    <Card title={<span className="flex items-center gap-1.5"><History className="h-4 w-4" /> Configuration History</span>}>
      <DataTable
        columns={columns}
        rows={rows}
        loading={rows === null && !error}
        error={error}
        onRowClick={(r) => setOpen(open === r.id ? null : r.id)}
        selectedKey={open}
        empty="No saved versions: built-in defaults are in use."
      />
      {open && (
        <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-slate-900 text-slate-100 text-[11px] p-3">
          {JSON.stringify(rows.find((r) => r.id === open)?.settings, null, 2)}
        </pre>
      )}
    </Card>
  );
}

export default GoodsReceiptSettingsPage;
