import React, { useEffect, useMemo, useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import {
  ATTACHMENT_OWNERS,
  fetchActiveWarehouses,
  fetchInspections,
  fetchReceiptLines,
  recordInspection,
  uploadAttachment,
} from "../../services/goodsReceiptApi";
import {
  Attachments,
  Card,
  DataTable,
  DateRange,
  ErrorBanner,
  Field,
  FilterBar,
  GrnPage,
  Notice,
  Pagination,
  ReadOnly,
  ReceiptLink,
  SearchInput,
  SelectFilter,
  StatusBadge,
  SubmoduleGate,
  btnPrimary,
  errorInputCls,
  fmtDate,
  fmtQty,
  inputCls,
  today,
  useGrnContext,
  usePagedQuery,
  useToast,
} from "./grnComponents";

export function ReceiptInspectionPage() {
  const grn = useGrnContext();
  return (
    <GrnPage
      title="Receipt Inspection"
      subtitle="Inspect received lines and split them into accepted and rejected quantities. Uninspected quantity stays out of stock."
      icon={ScanSearch}
    >
      <SubmoduleGate grn={grn} submodule="inspection">
        <InspectionWorkspace grn={grn} />
      </SubmoduleGate>
    </GrnPage>
  );
}

export function useWarehouses() {
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => {
    fetchActiveWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
  }, []);
  return warehouses;
}

/** Pending-inspection queue shared by receipt and quality inspection screens. */
export function PendingInspectionQueue({ selected, onSelect, reloadKey }) {
  const warehouses = useWarehouses();
  const { data, loading, error, filters, setFilter, reload } = usePagedQuery(
    (params) => fetchReceiptLines("pending_inspection", params),
    ["receipt", "search", "warehouse", "date_from", "date_to"]
  );
  useEffect(() => {
    if (reloadKey) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);
  useEffect(() => {
    // Keep the selection in sync with the refreshed row (pending quantity changes after each inspection).
    if (selected && data?.results) {
      const fresh = data.results.find((r) => r.id === selected.id);
      if (fresh !== selected) onSelect(fresh || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const columns = [
    { key: "receipt_number", label: "Receipt", render: (r) => <ReceiptLink id={r.receipt_id} number={r.receipt_number} /> },
    { key: "receipt_date", label: "Date", render: (r) => fmtDate(r.receipt_date) },
    {
      key: "item",
      label: "Item / Variant",
      render: (r) => (
        <div>
          <div className="font-semibold">{r.item_name}</div>
          <div className="text-[10px] font-mono text-slate-400">
            {r.sku}
            {r.batch_number ? ` · ${r.batch_number}` : ""}
          </div>
        </div>
      ),
    },
    { key: "received_quantity", label: "Received", align: "right", render: (r) => `${fmtQty(r.received_quantity)} ${r.uom}` },
    { key: "inspected", label: "Inspected", align: "right", render: (r) => fmtQty(Number(r.accepted_quantity) + Number(r.rejected_quantity)) },
    { key: "pending_inspection_quantity", label: "Pending", align: "right", render: (r) => fmtQty(r.pending_inspection_quantity) },
    { key: "warehouse_code", label: "Warehouse" },
  ];

  return (
    <div className="space-y-3">
      <FilterBar count={data?.count}>
        <SearchInput value={filters.search} onChange={(v) => setFilter("search", v)} placeholder="Receipt no., item, batch, supplier…" />
        <SelectFilter
          value={filters.warehouse}
          onChange={(v) => setFilter("warehouse", v)}
          allLabel="All warehouses"
          options={warehouses.map((w) => ({ value: String(w.id), label: w.code }))}
        />
        <DateRange from={filters.date_from} to={filters.date_to} onFrom={(v) => setFilter("date_from", v)} onTo={(v) => setFilter("date_to", v)} />
        {filters.receipt && (
          <button className="text-xs underline cursor-pointer" onClick={() => setFilter("receipt", "")}>
            Show all receipts
          </button>
        )}
      </FilterBar>
      <DataTable
        columns={columns}
        rows={data?.results}
        loading={loading}
        error={error}
        onRetry={reload}
        onRowClick={onSelect}
        selectedKey={selected?.id}
        empty="Nothing is waiting for inspection."
      />
      <Pagination data={data} page={filters.page} onPage={(p) => setFilter("page", p)} />
    </div>
  );
}

function InspectionWorkspace({ grn }) {
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toastNode, toast] = useToast();
  return (
    <div className="space-y-5">
      {toastNode}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <PendingInspectionQueue selected={selected} onSelect={setSelected} reloadKey={reloadKey} />
        </div>
        <div className="xl:col-span-2">
          {selected ? (
            <InspectionForm
              key={selected.id}
              line={selected}
              grn={grn}
              onSaved={(rec) => {
                toast(`${rec.inspection_number} recorded: ${fmtQty(rec.accepted_quantity)} accepted, ${fmtQty(rec.rejected_quantity)} rejected.`);
                setReloadKey((k) => k + 1);
              }}
            />
          ) : (
            <Notice tone="blue">Select a line from the queue to record an inspection.</Notice>
          )}
        </div>
      </div>
      <InspectionLog reloadKey={reloadKey} />
    </div>
  );
}

function InspectionForm({ line, grn, onSaved }) {
  const rejCfg = grn.settings("rejected");
  const partialCfg = grn.settings("partial");
  const qualityCfg = grn.settings("quality");
  const [form, setForm] = useState({
    accepted_quantity: "",
    rejected_quantity: "",
    rejection_reason: "",
    rejection_disposition: rejCfg.default_disposition || "",
    rejected_serial_numbers: [],
    inspector: grn.username,
    inspection_date: today(),
    remarks: "",
  });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const pending = Number(line.pending_inspection_quantity);
  const acc = Number(form.accepted_quantity || 0);
  const rej = Number(form.rejected_quantity || 0);
  const inspected = acc + rej;
  const pendingAfter = pending - inspected;
  const alreadyRejectedSerials = useMemo(() => new Set(line.rejected_serial_numbers || []), [line]);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (acc < 0 || rej < 0) e.accepted_quantity = "Quantities cannot be negative.";
    if (inspected <= 0) e.accepted_quantity = "Enter an accepted and/or rejected quantity.";
    if (inspected > pending) e.accepted_quantity = `Only ${fmtQty(pending)} remains to inspect.`;
    if (!partialCfg.allow_partial_acceptance) {
      const finalAcc = Number(line.accepted_quantity) + acc;
      const finalRej = Number(line.rejected_quantity) + rej;
      if (finalAcc > 0 && finalRej > 0) e.rejected_quantity = "Partial acceptance is disabled for this business.";
    }
    if (rej > 0 && rejCfg.require_rejection_reason && !form.rejection_reason) e.rejection_reason = "Select a rejection reason.";
    if (rej > 0 && line.tracking?.serial && form.rejected_serial_numbers.length !== rej)
      e.rejected_serial_numbers = `Tick exactly ${fmtQty(rej)} rejected serial number(s).`;
    if (!form.inspection_date) e.inspection_date = "Inspection date is required.";
    if (form.inspection_date > today() || form.inspection_date < line.receipt_date) e.inspection_date = "Must be between the receipt date and today.";
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    setError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const rec = await recordInspection({
        receipt: line.receipt_id,
        line: line.id,
        inspection_quantity: String(inspected),
        accepted_quantity: String(acc),
        rejected_quantity: String(rej),
        rejection_reason: rej > 0 ? form.rejection_reason : "",
        rejection_disposition: rej > 0 ? form.rejection_disposition : "",
        rejected_serial_numbers: rej > 0 ? form.rejected_serial_numbers : [],
        inspector: form.inspector,
        inspection_date: form.inspection_date,
        remarks: form.remarks,
      });
      for (const f of files) await uploadAttachment(ATTACHMENT_OWNERS.inspection, rec.id, f, grn.username);
      onSaved(rec);
    } catch (err) {
      setErrors(err.errors || {});
      setError(err);
      setBusy(false);
    }
  };

  const cls = (k) => `${inputCls} ${errors[k] ? errorInputCls : ""}`;
  return (
    <Card title="Record Inspection">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <ReadOnly label="Receipt" value={<ReceiptLink id={line.receipt_id} number={line.receipt_number} />} />
          <ReadOnly label="Receipt Line" value={`#${line.id} · ${line.item_code}${line.variant_sku ? ` / ${line.variant_sku}` : ""}`} mono />
          <ReadOnly label="Received" value={`${fmtQty(line.received_quantity)} ${line.uom}`} />
          <ReadOnly label="Previously Inspected" value={fmtQty(Number(line.accepted_quantity) + Number(line.rejected_quantity))} />
          <ReadOnly label="Pending Before" value={fmtQty(pending)} />
          <ReadOnly label="Inspection Status" value={<StatusBadge status={line.inspection_status} />} />
        </div>
        {qualityCfg.enabled && qualityCfg.quality_inspection_required && (
          <Notice tone="blue">Quality inspection is mandatory: accepting goods requires a passing or conditional quality result on this line.</Notice>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Accepted Qty" error={errors.accepted_quantity}>
            <input type="number" min="0" step="any" className={cls("accepted_quantity")} value={form.accepted_quantity} onChange={(e) => set("accepted_quantity", e.target.value)} />
          </Field>
          <Field label="Rejected Qty" error={errors.rejected_quantity}>
            <input type="number" min="0" step="any" className={cls("rejected_quantity")} value={form.rejected_quantity} onChange={(e) => set("rejected_quantity", e.target.value)} />
          </Field>
          <ReadOnly label="Inspection Qty" value={fmtQty(inspected)} />
        </div>
        <p className={`text-[11px] ${pendingAfter < 0 ? "text-red-600" : "text-slate-500"}`}>
          Pending after this inspection: <b>{fmtQty(pendingAfter)}</b> (received = accepted + rejected + pending)
        </p>
        {rej > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rejection Reason" required={rejCfg.require_rejection_reason} error={errors.rejection_reason}>
              <select className={cls("rejection_reason")} value={form.rejection_reason} onChange={(e) => set("rejection_reason", e.target.value)}>
                <option value="">Select reason…</option>
                {(rejCfg.rejection_reasons || []).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Disposition" error={errors.rejection_disposition}>
              <select className={cls("rejection_disposition")} value={form.rejection_disposition} onChange={(e) => set("rejection_disposition", e.target.value)}>
                {(rejCfg.dispositions || []).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        {rej > 0 && line.tracking?.serial && (
          <Field label="Rejected Serial Numbers" required error={errors.rejected_serial_numbers}>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {(line.serial_numbers || [])
                .filter((s) => !alreadyRejectedSerials.has(s))
                .map((s) => (
                  <label key={s} className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg bg-slate-50 dark:bg-zinc-800">
                    <input
                      type="checkbox"
                      checked={form.rejected_serial_numbers.includes(s)}
                      onChange={(e) =>
                        set(
                          "rejected_serial_numbers",
                          e.target.checked ? [...form.rejected_serial_numbers, s] : form.rejected_serial_numbers.filter((x) => x !== s)
                        )
                      }
                    />
                    {s}
                  </label>
                ))}
            </div>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inspector" error={errors.inspector}>
            <input className={cls("inspector")} value={form.inspector} maxLength={120} onChange={(e) => set("inspector", e.target.value)} />
          </Field>
          <Field label="Inspection Date" required error={errors.inspection_date}>
            <input type="date" className={cls("inspection_date")} value={form.inspection_date} max={today()} min={line.receipt_date} onChange={(e) => set("inspection_date", e.target.value)} />
          </Field>
        </div>
        <Field label="Inspection Remarks">
          <textarea rows={2} className={inputCls} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
        </Field>
        <Field label="Attachments" hint="Uploaded with the inspection record (max 25 MB each).">
          <input type="file" multiple className="text-xs" onChange={(e) => setFiles([...(e.target.files || [])].filter((f) => f.size <= 25 * 1024 * 1024))} />
        </Field>
        <ErrorBanner error={error} />
        <div className="flex justify-end">
          <button className={btnPrimary} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Record Inspection
          </button>
        </div>
      </div>
    </Card>
  );
}

function InspectionLog({ reloadKey }) {
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [expanded, setExpanded] = useState(null);
  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    fetchInspections({ page })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
  }, [page, reloadKey]);
  const columns = [
    { key: "inspection_number", label: "Inspection No.", render: (r) => <span className="font-mono">{r.inspection_number}</span> },
    { key: "receipt_number", label: "Receipt", render: (r) => <ReceiptLink id={r.receipt} number={r.receipt_number} /> },
    { key: "line", label: "Line", render: (r) => `#${r.line} ${r.item_code}` },
    { key: "inspection_quantity", label: "Inspected", align: "right", render: (r) => fmtQty(r.inspection_quantity) },
    { key: "accepted_quantity", label: "Accepted", align: "right", render: (r) => fmtQty(r.accepted_quantity) },
    { key: "rejected_quantity", label: "Rejected", align: "right", render: (r) => fmtQty(r.rejected_quantity) },
    { key: "pending_quantity_after", label: "Pending", align: "right", render: (r) => fmtQty(r.pending_quantity_after) },
    { key: "rejection_reason", label: "Rejection Reason", render: (r) => r.rejection_reason || "—" },
    { key: "inspector", label: "Inspector" },
    { key: "inspection_date", label: "Date", render: (r) => fmtDate(r.inspection_date) },
  ];
  return (
    <Card title="Inspection Log">
      <div className="space-y-3">
        <DataTable
          columns={columns}
          rows={state.data?.results}
          loading={state.loading}
          error={state.error}
          onRowClick={(r) => setExpanded(expanded === r.id ? null : r.id)}
          selectedKey={expanded}
          empty="No inspections recorded yet."
        />
        {expanded && <Attachments ownerType={ATTACHMENT_OWNERS.inspection} ownerId={expanded} title="Inspection attachments" />}
        <Pagination data={state.data} page={page} onPage={setPage} />
      </div>
    </Card>
  );
}

export default ReceiptInspectionPage;
