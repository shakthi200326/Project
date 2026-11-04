import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileWarning, Loader2, Plus } from "lucide-react";
import {
  ATTACHMENT_OWNERS,
  createDiscrepancy,
  fetchDiscrepancies,
  fetchReceipt,
  fetchReceipts,
  updateDiscrepancy,
} from "../../services/goodsReceiptApi";
import {
  Attachments,
  DataTable,
  DateRange,
  ErrorBanner,
  Field,
  FilterBar,
  GrnPage,
  Modal,
  Pagination,
  ReadOnly,
  ReceiptLink,
  SearchInput,
  SelectFilter,
  StatusBadge,
  SubmoduleGate,
  btnPrimary,
  btnSecondary,
  errorInputCls,
  fmtDate,
  fmtDateTime,
  fmtQty,
  inputCls,
  statusLabel,
  useGrnContext,
  usePagedQuery,
  useToast,
} from "./grnComponents";

const NEXT_STATUS = {
  OPEN: ["UNDER_REVIEW", "RESOLVED"],
  UNDER_REVIEW: ["RESOLVED", "OPEN"],
  RESOLVED: ["CLOSED", "UNDER_REVIEW"],
  CLOSED: [],
};

export function ReceiptDiscrepancyPage() {
  const grn = useGrnContext();
  return (
    <GrnPage
      title="Receipt Discrepancy"
      subtitle="Shortages, excess, damage and other variances raised against receipts, with resolution tracking."
      icon={FileWarning}
    >
      <SubmoduleGate grn={grn} submodule="discrepancy">
        <DiscrepancyWorkspace grn={grn} />
      </SubmoduleGate>
    </GrnPage>
  );
}

function DiscrepancyWorkspace({ grn }) {
  const cfg = grn.settings("discrepancy");
  const [searchParams] = useSearchParams();
  const [creating, setCreating] = useState(!!searchParams.get("receipt"));
  const [editing, setEditing] = useState(null);
  const [toastNode, toast] = useToast();
  const { data, loading, error, filters, setFilter, reload } = usePagedQuery(fetchDiscrepancies, [
    "search",
    "resolution_status",
    "discrepancy_type",
    "date_from",
    "date_to",
    "receipt",
  ]);

  const columns = [
    { key: "discrepancy_number", label: "Discrepancy No.", render: (r) => <span className="font-mono">{r.discrepancy_number}</span> },
    { key: "receipt_number", label: "Receipt", render: (r) => <ReceiptLink id={r.receipt} number={r.receipt_number} /> },
    { key: "line", label: "Line / Item", render: (r) => (r.line ? `#${r.line} ${r.item_code}` : "Whole receipt") },
    { key: "discrepancy_type", label: "Type" },
    { key: "expected_quantity", label: "Expected", align: "right", render: (r) => fmtQty(r.expected_quantity) },
    { key: "received_quantity", label: "Received", align: "right", render: (r) => fmtQty(r.received_quantity) },
    { key: "difference_quantity", label: "Difference", align: "right", render: (r) => fmtQty(r.difference_quantity) },
    { key: "reason", label: "Reason", render: (r) => <span className="line-clamp-2">{r.reason}</span> },
    { key: "resolution_status", label: "Resolution", render: (r) => <StatusBadge status={r.resolution_status} /> },
    { key: "resolved_by", label: "Resolved By", render: (r) => (r.resolved_by ? `${r.resolved_by} · ${fmtDate(r.resolved_at)}` : "—") },
    { key: "created_at", label: "Raised", render: (r) => `${fmtDate(r.created_at)}${r.is_system_generated ? " (auto)" : ""}` },
  ];

  return (
    <div className="space-y-3">
      {toastNode}
      <div className="flex justify-end">
        <button className={btnPrimary} onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Raise Discrepancy
        </button>
      </div>
      <FilterBar count={data?.count}>
        <SearchInput value={filters.search} onChange={(v) => setFilter("search", v)} placeholder="Receipt no. or item…" />
        <SelectFilter
          value={filters.resolution_status}
          onChange={(v) => setFilter("resolution_status", v)}
          allLabel="All resolution statuses"
          options={Object.keys(NEXT_STATUS).map((s) => ({ value: s, label: statusLabel(s) }))}
        />
        <SelectFilter
          value={filters.discrepancy_type}
          onChange={(v) => setFilter("discrepancy_type", v)}
          allLabel="All types"
          options={(cfg.discrepancy_types || []).map((t) => ({ value: t, label: t }))}
        />
        <DateRange from={filters.date_from} to={filters.date_to} onFrom={(v) => setFilter("date_from", v)} onTo={(v) => setFilter("date_to", v)} />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={data?.results}
        loading={loading}
        error={error}
        onRetry={reload}
        onRowClick={setEditing}
        empty="No discrepancies recorded."
      />
      <Pagination data={data} page={filters.page} onPage={(p) => setFilter("page", p)} />
      {creating && (
        <CreateDiscrepancyModal
          grn={grn}
          initialReceipt={searchParams.get("receipt")}
          onClose={() => setCreating(false)}
          onSaved={(rec) => {
            setCreating(false);
            toast(`${rec.discrepancy_number} raised.`);
            reload();
            setEditing(rec);
          }}
        />
      )}
      {editing && (
        <ResolveModal
          record={editing}
          grn={grn}
          onClose={() => setEditing(null)}
          onSaved={(rec) => {
            toast(`${rec.discrepancy_number} updated.`);
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function CreateDiscrepancyModal({ grn, initialReceipt, onClose, onSaved }) {
  const cfg = grn.settings("discrepancy");
  const [receiptSearch, setReceiptSearch] = useState("");
  const [options, setOptions] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [form, setForm] = useState({ line: "", discrepancy_type: cfg.discrepancy_types?.[0] || "", expected_quantity: "", received_quantity: "", reason: "", remarks: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialReceipt) fetchReceipt(initialReceipt).then(setReceipt).catch(setError);
  }, [initialReceipt]);
  useEffect(() => {
    if (receipt) return;
    const t = setTimeout(() => {
      fetchReceipts({ search: receiptSearch, page_size: 10 })
        .then((d) => setOptions(d.results.filter((r) => !["DRAFT", "CANCELLED"].includes(r.status))))
        .catch(setError);
    }, 250);
    return () => clearTimeout(t);
  }, [receiptSearch, receipt]);

  const line = receipt?.lines?.find((l) => String(l.id) === String(form.line));
  const set = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "line") {
        const l = receipt?.lines?.find((x) => String(x.id) === String(v));
        next.expected_quantity = l?.expected_quantity ?? "";
        next.received_quantity = l?.received_quantity ?? "";
      }
      return next;
    });
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const diff =
    form.expected_quantity !== "" && form.received_quantity !== "" ? Number(form.received_quantity) - Number(form.expected_quantity) : null;

  const submit = async () => {
    const e = {};
    if (!receipt) e.receipt = "Select a receipt.";
    if (!form.discrepancy_type) e.discrepancy_type = "Select a type.";
    if (!form.reason.trim()) e.reason = "A reason is required.";
    setErrors(e);
    setError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const rec = await createDiscrepancy({
        receipt: receipt.id,
        line: form.line ? Number(form.line) : null,
        discrepancy_type: form.discrepancy_type,
        expected_quantity: form.expected_quantity === "" ? null : form.expected_quantity,
        received_quantity: form.received_quantity === "" ? null : form.received_quantity,
        reason: form.reason,
        remarks: form.remarks,
      });
      onSaved(rec);
    } catch (err) {
      setErrors(err.errors || {});
      setError(err);
      setBusy(false);
    }
  };
  const cls = (k) => `${inputCls} ${errors[k] ? errorInputCls : ""}`;

  return (
    <Modal
      title="Raise Receipt Discrepancy"
      wide
      onClose={onClose}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>
            Close
          </button>
          <button className={btnPrimary} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Raise Discrepancy
          </button>
        </>
      }
    >
      <ErrorBanner error={error} />
      {receipt ? (
        <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-zinc-800 px-3 py-2 text-xs">
          <span>
            <b className="font-mono">{receipt.document_number}</b> · {receipt.supplier || "No supplier"} · <StatusBadge status={receipt.status} />
          </span>
          <button className="underline cursor-pointer" onClick={() => setReceipt(null)}>
            Change
          </button>
        </div>
      ) : (
        <Field label="Receipt Reference" required error={errors.receipt}>
          <input className={cls("receipt")} placeholder="Search receipt number…" value={receiptSearch} onChange={(e) => setReceiptSearch(e.target.value)} />
          <div className="max-h-40 overflow-y-auto mt-1 space-y-1">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                onClick={() => fetchReceipt(o.id).then(setReceipt).catch(setError)}
              >
                <span className="font-mono font-bold">{o.document_number}</span> · {o.supplier || "—"} · {statusLabel(o.status)}
              </button>
            ))}
          </div>
        </Field>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Receipt Line" error={errors.line} hint="Leave empty for a receipt-level discrepancy.">
          <select className={cls("line")} value={form.line} disabled={!receipt} onChange={(e) => set("line", e.target.value)}>
            <option value="">Whole receipt</option>
            {(receipt?.lines || []).map((l) => (
              <option key={l.id} value={l.id}>
                #{l.id} {l.item_code} – {l.item_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Discrepancy Type" required error={errors.discrepancy_type}>
          <select className={cls("discrepancy_type")} value={form.discrepancy_type} onChange={(e) => set("discrepancy_type", e.target.value)}>
            {(cfg.discrepancy_types || []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <ReadOnly label="Item" value={line ? `${line.item_code} – ${line.item_name}` : "—"} />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Expected" error={errors.expected_quantity}>
            <input type="number" step="any" className={cls("expected_quantity")} value={form.expected_quantity} onChange={(e) => set("expected_quantity", e.target.value)} />
          </Field>
          <Field label="Received" error={errors.received_quantity}>
            <input type="number" step="any" className={cls("received_quantity")} value={form.received_quantity} onChange={(e) => set("received_quantity", e.target.value)} />
          </Field>
          <ReadOnly label="Difference" value={diff === null ? "—" : fmtQty(diff)} />
        </div>
      </div>
      <Field label="Reason" required error={errors.reason}>
        <textarea rows={3} className={cls("reason")} value={form.reason} onChange={(e) => set("reason", e.target.value)} />
      </Field>
      <Field label="Remarks">
        <textarea rows={2} className={inputCls} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
      </Field>
      <p className="text-[11px] text-slate-400">Supporting evidence can be attached once the discrepancy is raised.</p>
    </Modal>
  );
}

function ResolveModal({ record, grn, onClose, onSaved }) {
  const [form, setForm] = useState({
    resolution_status: record.resolution_status,
    resolution_notes: record.resolution_notes || "",
    remarks: record.remarks || "",
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const closed = record.resolution_status === "CLOSED";
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = { resolution_notes: form.resolution_notes, remarks: form.remarks };
      if (form.resolution_status !== record.resolution_status) payload.resolution_status = form.resolution_status;
      onSaved(await updateDiscrepancy(record.id, payload));
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`${record.discrepancy_number} – ${record.discrepancy_type}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>
            Close
          </button>
          {!closed && (
            <button className={btnPrimary} onClick={save} disabled={busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ReadOnly label="Receipt" value={<ReceiptLink id={record.receipt} number={record.receipt_number} />} />
        <ReadOnly label="Line / Item" value={record.line ? `#${record.line} ${record.item_code}` : "Whole receipt"} />
        <ReadOnly label="Expected / Received" value={`${fmtQty(record.expected_quantity)} / ${fmtQty(record.received_quantity)}`} />
        <ReadOnly label="Difference" value={fmtQty(record.difference_quantity)} />
        <ReadOnly label="Raised By" value={`${record.created_by || "system"} · ${fmtDateTime(record.created_at)}`} />
        <ReadOnly label="Resolved" value={record.resolved_by ? `${record.resolved_by} · ${fmtDateTime(record.resolved_at)}` : "—"} />
      </div>
      <ReadOnly label="Reason" value={record.reason} />
      <Field label="Resolution Status">
        <select
          className={inputCls}
          value={form.resolution_status}
          disabled={closed}
          onChange={(e) => setForm((f) => ({ ...f, resolution_status: e.target.value }))}
        >
          <option value={record.resolution_status}>{statusLabel(record.resolution_status)} (current)</option>
          {NEXT_STATUS[record.resolution_status].map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Resolution Notes" required={form.resolution_status === "RESOLVED"}>
        <textarea rows={3} className={inputCls} disabled={closed} value={form.resolution_notes} onChange={(e) => setForm((f) => ({ ...f, resolution_notes: e.target.value }))} />
      </Field>
      <Field label="Remarks">
        <textarea rows={2} className={inputCls} disabled={closed} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
      </Field>
      <Attachments ownerType={ATTACHMENT_OWNERS.discrepancy} ownerId={record.id} canEdit={!closed} uploadedBy={grn.username} title="Supporting evidence" />
      <ErrorBanner error={error} />
    </Modal>
  );
}

export default ReceiptDiscrepancyPage;
