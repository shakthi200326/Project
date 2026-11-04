import React, { useEffect, useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import {
  ATTACHMENT_OWNERS,
  fetchQualityInspections,
  recordQualityInspection,
  uploadAttachment,
} from "../../services/goodsReceiptApi";
import {
  Attachments,
  Card,
  DataTable,
  ErrorBanner,
  Field,
  GrnPage,
  Notice,
  Pagination,
  ReadOnly,
  ReceiptLink,
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
  useToast,
} from "./grnComponents";
import { PendingInspectionQueue } from "./ReceiptInspectionPage";

export function QualityInspectionPage() {
  const grn = useGrnContext();
  return (
    <GrnPage
      title="Quality Inspection"
      subtitle="Sample-based quality checks against the configured criteria. A failed result blocks acceptance of the line."
      icon={FlaskConical}
    >
      <SubmoduleGate grn={grn} submodule="quality">
        <QualityWorkspace grn={grn} />
      </SubmoduleGate>
    </GrnPage>
  );
}

function QualityWorkspace({ grn }) {
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
            <QualityForm
              key={selected.id}
              line={selected}
              grn={grn}
              onSaved={(rec) => {
                toast(`${rec.inspection_number}: quality result ${rec.quality_result}.`, rec.quality_result === "FAIL" ? "error" : "success");
                setReloadKey((k) => k + 1);
              }}
            />
          ) : (
            <Notice tone="blue">Select a line from the queue to record a quality inspection.</Notice>
          )}
        </div>
      </div>
      <QualityLog reloadKey={reloadKey} />
    </div>
  );
}

function QualityForm({ line, grn, onSaved }) {
  const cfg = grn.settings("quality");
  const criteria = cfg.criteria || [];
  const [form, setForm] = useState({
    inspection_type: cfg.inspection_types?.[0] || "",
    sample_quantity: "",
    failed_quantity: "0",
    inspector: grn.username,
    inspection_date: today(),
    remarks: "",
  });
  const [values, setValues] = useState(() => Object.fromEntries(criteria.map((c) => [c.code, c.type === "BOOLEAN" ? null : ""])));
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const sample = Number(form.sample_quantity || 0);
  const failed = Number(form.failed_quantity || 0);
  const passed = sample - failed;
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const criterionPasses = (c) => {
    const v = values[c.code];
    if (v === null || v === "") return null;
    if (c.type === "BOOLEAN") return v === true;
    if (c.type === "NUMERIC") {
      const n = Number(v);
      return (c.min === undefined || c.min === "" || n >= Number(c.min)) && (c.max === undefined || c.max === "" || n <= Number(c.max));
    }
    return String(v).trim() !== "";
  };

  const submit = async () => {
    const e = {};
    if (!form.inspection_type) e.inspection_type = "Inspection type is required.";
    if (!(sample > 0)) e.sample_quantity = "Sample quantity must be greater than zero.";
    else if (sample > Number(line.received_quantity)) e.sample_quantity = `Cannot exceed received quantity (${fmtQty(line.received_quantity)}).`;
    if (failed < 0 || failed > sample) e.failed_quantity = "Failed quantity must be between 0 and the sample.";
    criteria.forEach((c) => {
      if ((c.mandatory ?? true) && criterionPasses(c) === null) e[`criteria_results.${c.code}`] = "Required.";
    });
    setErrors(e);
    setError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const rec = await recordQualityInspection({
        receipt: line.receipt_id,
        line: line.id,
        inspection_type: form.inspection_type,
        sample_quantity: String(sample),
        passed_quantity: String(passed),
        failed_quantity: String(failed),
        criteria_results: criteria
          .filter((c) => values[c.code] !== null && values[c.code] !== "")
          .map((c) => ({ code: c.code, value: values[c.code] })),
        inspector: form.inspector,
        inspection_date: form.inspection_date,
        remarks: form.remarks,
      });
      for (const f of files) await uploadAttachment(ATTACHMENT_OWNERS.inspection, rec.id, f, grn.username);
      onSaved(rec);
      setBusy(false);
    } catch (err) {
      setErrors(err.errors || {});
      setError(err);
      setBusy(false);
    }
  };

  const cls = (k) => `${inputCls} ${errors[k] ? errorInputCls : ""}`;
  return (
    <Card title="Record Quality Inspection">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <ReadOnly label="Receipt" value={<ReceiptLink id={line.receipt_id} number={line.receipt_number} />} />
          <ReadOnly label="Item / Variant" value={`${line.item_code}${line.variant_sku ? ` / ${line.variant_sku}` : ""}`} mono />
          <ReadOnly label="Received" value={`${fmtQty(line.received_quantity)} ${line.uom}`} />
          <ReadOnly label="Batch" value={line.batch_number || "—"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inspection Type" required error={errors.inspection_type}>
            <select className={cls("inspection_type")} value={form.inspection_type} onChange={(e) => set("inspection_type", e.target.value)}>
              <option value="">Select…</option>
              {(cfg.inspection_types || []).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sample Quantity" required error={errors.sample_quantity}>
            <input type="number" min="0" step="any" className={cls("sample_quantity")} value={form.sample_quantity} onChange={(e) => set("sample_quantity", e.target.value)} />
          </Field>
          <Field label="Failed Quantity" error={errors.failed_quantity || errors.passed_quantity}>
            <input type="number" min="0" step="any" className={cls("failed_quantity")} value={form.failed_quantity} onChange={(e) => set("failed_quantity", e.target.value)} />
          </Field>
          <ReadOnly label="Passed Quantity" value={sample > 0 ? fmtQty(passed) : "—"} />
        </div>
        <p className="text-[11px] text-slate-500">
          Result is decided by the server: any failed mandatory criterion or a failure rate above {cfg.max_failure_rate_percent}% is a FAIL.
        </p>

        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">Inspection Criteria</span>
          {criteria.length === 0 && <p className="text-[11px] text-slate-400">No criteria configured. Add them in Goods Receipt settings → Quality Inspection.</p>}
          {criteria.map((c) => {
            const pass = criterionPasses(c);
            const err = errors[`criteria_results.${c.code}`];
            return (
              <div key={c.code} className="flex items-center gap-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">
                    {c.name}
                    {(c.mandatory ?? true) && <span className="text-red-500 ml-0.5">*</span>}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {c.code} · {c.type}
                    {c.type === "NUMERIC" && ` · range ${c.min ?? "−∞"} – ${c.max ?? "∞"}`}
                  </div>
                  {err && <div className="text-[11px] text-red-600">{err}</div>}
                </div>
                {c.type === "BOOLEAN" ? (
                  <div className="flex gap-1">
                    {[true, false].map((v) => (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => setValues((s) => ({ ...s, [c.code]: v }))}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                          values[c.code] === v
                            ? v
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-red-600 text-white border-red-600"
                            : "border-slate-200 dark:border-zinc-700"
                        }`}
                      >
                        {v ? "Pass" : "Fail"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type={c.type === "NUMERIC" ? "number" : "text"}
                    step="any"
                    className={`${inputCls} w-32`}
                    value={values[c.code]}
                    onChange={(e) => setValues((s) => ({ ...s, [c.code]: e.target.value }))}
                  />
                )}
                {pass !== null && <StatusBadge status={pass ? "PASS" : "FAIL"} />}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Inspector">
            <input className={inputCls} value={form.inspector} maxLength={120} onChange={(e) => set("inspector", e.target.value)} />
          </Field>
          <Field label="Inspection Date" required error={errors.inspection_date}>
            <input type="date" className={cls("inspection_date")} value={form.inspection_date} max={today()} min={line.receipt_date} onChange={(e) => set("inspection_date", e.target.value)} />
          </Field>
        </div>
        <Field label="Remarks">
          <textarea rows={2} className={inputCls} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
        </Field>
        <Field label="Attachments" hint="Test reports or photos (max 25 MB each).">
          <input type="file" multiple className="text-xs" onChange={(e) => setFiles([...(e.target.files || [])].filter((f) => f.size <= 25 * 1024 * 1024))} />
        </Field>
        <ErrorBanner error={error} />
        <div className="flex justify-end">
          <button className={btnPrimary} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Record Quality Result
          </button>
        </div>
      </div>
    </Card>
  );
}

function QualityLog({ reloadKey }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    fetchQualityInspections({ page, result })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
  }, [page, result, reloadKey]);
  const columns = [
    { key: "inspection_number", label: "QI No.", render: (r) => <span className="font-mono">{r.inspection_number}</span> },
    { key: "receipt_number", label: "Receipt", render: (r) => <ReceiptLink id={r.receipt} number={r.receipt_number} /> },
    { key: "item_code", label: "Item / Variant", render: (r) => `${r.item_code}${r.variant_sku ? ` / ${r.variant_sku}` : ""}` },
    { key: "inspection_type", label: "Type" },
    { key: "sample_quantity", label: "Sample", align: "right", render: (r) => fmtQty(r.sample_quantity) },
    { key: "passed_quantity", label: "Passed", align: "right", render: (r) => fmtQty(r.passed_quantity) },
    { key: "failed_quantity", label: "Failed", align: "right", render: (r) => fmtQty(r.failed_quantity) },
    {
      key: "criteria_results",
      label: "Criteria",
      render: (r) =>
        (r.criteria_results || []).map((c) => (
          <div key={c.code} className={`text-[10px] ${c.passed ? "text-emerald-600" : "text-red-600"}`}>
            {c.name}: {String(c.value)}
          </div>
        )),
    },
    { key: "quality_result", label: "Result", render: (r) => <StatusBadge status={r.quality_result} /> },
    { key: "inspector", label: "Inspector" },
    { key: "inspection_date", label: "Date", render: (r) => fmtDate(r.inspection_date) },
  ];
  return (
    <Card
      title="Quality Inspection Log"
      actions={
        <SelectFilter
          value={result}
          onChange={(v) => {
            setResult(v);
            setPage(1);
          }}
          allLabel="All results"
          options={["PASS", "CONDITIONAL", "FAIL"].map((v) => ({ value: v, label: v }))}
        />
      }
    >
      <div className="space-y-3">
        <DataTable
          columns={columns}
          rows={state.data?.results}
          loading={state.loading}
          error={state.error}
          onRowClick={(r) => setExpanded(expanded === r.id ? null : r.id)}
          selectedKey={expanded}
          empty="No quality inspections recorded."
        />
        {expanded && <Attachments ownerType={ATTACHMENT_OWNERS.inspection} ownerId={expanded} title="Quality inspection attachments" />}
        <Pagination data={state.data} page={page} onPage={setPage} />
      </div>
    </Card>
  );
}

export default QualityInspectionPage;
