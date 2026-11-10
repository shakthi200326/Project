import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Layers,
  Pencil,
  RotateCcw,
  ScanSearch,
  Send,
  ThumbsUp,
  Trash2,
  Undo2,
  FileWarning,
  ArrowDownToLine,
} from "lucide-react";
import {
  ATTACHMENT_OWNERS,
  deleteReceipt,
  fetchDiscrepancies,
  fetchInspections,
  fetchPutaways,
  fetchQualityInspections,
  fetchReceipt,
  fetchReceiptTimeline,
  receiptAction,
} from "../../services/goodsReceiptApi";
import {
  Attachments,
  Card,
  ConfirmModal,
  DataTable,
  ErrorBanner,
  GrnPage,
  LoadingBlock,
  Notice,
  ReadOnly,
  StatusBadge,
  SubmoduleGate,
  btnDanger,
  btnPrimary,
  btnSecondary,
  fmtDate,
  fmtDateTime,
  fmtQty,
  useGrnContext,
  useToast,
} from "./grnComponents";
import { ScrollableTabs } from "../../components/ScrollableTabs.jsx";

export function ReceiptDetailPage() {
  const grn = useGrnContext();
  const location = useLocation();
  const view = new URLSearchParams(location.search).get("view");
  return (
    <GrnPage title="Goods Receipt" subtitle="Receipt document with inspection, putaway and posting trail." icon={ClipboardList}>
      <SubmoduleGate grn={grn} submodule={view === "history" ? "history" : "register"}>
        <ReceiptDetail grn={grn} view={view} />
      </SubmoduleGate>
    </GrnPage>
  );
}

const ACTIONS = {
  submit: { label: "Submit", icon: Send, primary: true, message: "Submit this receipt? It can no longer be edited and will move to inspection or putaway. Stock is not changed until posting." },
  approve: { label: "Approve", icon: ThumbsUp, primary: true, message: "Approve this goods receipt for processing?" },
  return_to_draft: { label: "Return to Draft", icon: Undo2, reason: true, message: "Send this receipt back to draft for correction." },
  cancel: { label: "Cancel Receipt", icon: Ban, danger: true, reason: true, message: "Cancel this receipt? This cannot be undone." },
  post: { label: "Post to Stock", icon: ArrowDownToLine, primary: true, message: "Post accepted quantities to stock? This creates the stock-in ledger entries and cannot be edited afterwards (only reversed)." },
  reverse: { label: "Reverse", icon: RotateCcw, danger: true, reason: true, message: "Reverse this posted receipt? A compensating reversal document will remove the received stock." },
};

function ReceiptWorkflowStepper({ status, inspectionRequired, putawayProgress }) {
  const steps = [
    { key: "DRAFT", label: "Draft" },
    { key: "SUBMITTED", label: "Submitted" },
    ...(inspectionRequired ? [{ key: "INSPECTION", label: "Inspection" }] : []),
    { key: "PUTAWAY", label: "Putaway" },
    { key: "POSTED", label: "Posted to Stock" },
  ];

  const getStepState = (stepKey) => {
    if (status === "CANCELLED" || status === "REVERSED") return "default";
    if (status === "POSTED") return "completed";

    if (stepKey === "DRAFT") return status === "DRAFT" ? "active" : "completed";
    if (stepKey === "SUBMITTED") {
      if (status === "DRAFT") return "pending";
      if (status === "SUBMITTED" || status === "APPROVED") return "active";
      return "completed";
    }
    if (stepKey === "INSPECTION") {
      if (["DRAFT", "SUBMITTED", "APPROVED"].includes(status)) return "pending";
      if (status === "UNDER_INSPECTION") return "active";
      return "completed";
    }
    if (stepKey === "PUTAWAY") {
      if (["DRAFT", "SUBMITTED", "APPROVED", "UNDER_INSPECTION"].includes(status)) return "pending";
      if (putawayProgress === "COMPLETED") return "completed";
      if (["ACCEPTED", "PARTIALLY_ACCEPTED", "PUTAWAY_PENDING", "READY_TO_POST"].includes(status)) return "active";
      return "pending";
    }
    if (stepKey === "POSTED") {
      return status === "READY_TO_POST" ? "ready" : "pending";
    }
    return "pending";
  };

  return (
    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-sm mb-4">
      <div className="flex items-center justify-between gap-2 overflow-x-auto">
        {steps.map((st, i) => {
          const state = getStepState(st.key);
          return (
            <React.Fragment key={st.key}>
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    state === "completed"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : state === "active"
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950/50"
                      : state === "ready"
                      ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950/50 animate-pulse"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500"
                  }`}
                >
                  {state === "completed" ? "✓" : i + 1}
                </div>
                <div className="text-xs font-medium text-slate-700 dark:text-zinc-300">{st.label}</div>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 min-w-8 transition-colors ${
                    state === "completed" ? "bg-emerald-500" : "bg-slate-200 dark:bg-zinc-800"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function ReceiptDetail({ grn, view }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [toastNode, toast] = useToast();
  const [rec, setRec] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null);
  const [tab, setTab] = useState("lines");
  const [warnings, setWarnings] = useState(location.state?.warnings || []);

  const load = useCallback(() => {
    setError(null);
    return fetchReceipt(id, view ? { view } : undefined).then(setRec).catch(setError);
  }, [id, view]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (location.state?.toast) {
      toast(location.state.toast);
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error && !rec) return <ErrorBanner error={error} onRetry={load} />;
  if (!rec) return <LoadingBlock label="Loading receipt…" />;

  const availableActions = Array.isArray(rec.available_actions) ? rec.available_actions : [];
  const can = (a) => availableActions.includes(a);
  const runAction = async (action, reason) => {
    try {
      const updated = await receiptAction(rec.id, action, reason ? { reason } : {});
      setRec(updated);
      setWarnings(updated.warnings || []);
      toast(`${rec.document_number}: ${ACTIONS[action].label.toLowerCase()} completed.`);
    } catch (e) {
      if (e.status === 409 && e.data?.receipt) {
        // Retried post on an already-posted receipt: show the authoritative state.
        setRec(e.data.receipt);
        toast(e.message, "error");
        return;
      }
      throw e;
    }
  };

  const awaitingApproval = rec.status === "SUBMITTED" && can("approve");
  const goto = (path) => navigate(path.includes("?") ? `${path}&receipt=${rec.id}` : `${path}?receipt=${rec.id}`);
  const t = rec.totals || {};
  const receiptLines = Array.isArray(rec.lines) ? rec.lines : [];

  return (
    <div className="space-y-4">
      {toastNode}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={view === "history" ? "/inventory/goods-receipt/history" : "/inventory/goods-receipt/register"} className={btnSecondary}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="flex flex-wrap gap-2">
          {can("edit") && (
            <button className={btnSecondary} onClick={() => navigate(`/inventory/goods-receipt/receipts/${rec.id}/edit`)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
          {can("delete") && (
            <button className={btnDanger} onClick={() => setPending("delete")}>
              <Trash2 className="h-3.5 w-3.5" /> Delete Draft
            </button>
          )}
          {can("inspect") && (
            <button className={btnSecondary} onClick={() => goto("/inventory/goods-receipt/register?tab=inspection")}>
              <ScanSearch className="h-3.5 w-3.5" /> Inspect
            </button>
          )}
          {can("putaway") && Number(t.accepted) > Number(t.putaway) && Number(t.pending) === 0 && (
            <button className={btnSecondary} onClick={() => goto("/inventory/goods-receipt/putaway")}>
              <Layers className="h-3.5 w-3.5" /> Putaway
            </button>
          )}
          {can("discrepancy") && (
            <button className={btnSecondary} onClick={() => goto("/inventory/goods-receipt/register?tab=discrepancies")}>
              <FileWarning className="h-3.5 w-3.5" /> Discrepancy
            </button>
          )}
          {["return_to_draft", "cancel", "reverse", "approve", "submit", "post"].filter(can).map((a) => {
            const meta = ACTIONS[a];
            const Icon = meta.icon;
            return (
              <button key={a} className={meta.danger ? btnDanger : meta.primary ? btnPrimary : btnSecondary} onClick={() => setPending(a)}>
                <Icon className="h-3.5 w-3.5" /> {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {warnings.length > 0 && (
        <Notice title="Warnings">
          <ul className="list-disc ml-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}

      {/* Visual Workflow Stepper */}
      <ReceiptWorkflowStepper
        status={rec.status}
        inspectionRequired={rec.inspection_required}
        putawayProgress={rec.putaway_progress}
      />

      {awaitingApproval && <Notice tone="blue">This receipt is awaiting approval before it can be inspected, put away or posted.</Notice>}
      {rec.status === "POSTED" && (
        <Notice tone="blue" icon={CheckCircle2}>
          Posted by {rec.posted_by} on {fmtDateTime(rec.posted_at)}. Posted receipts cannot be edited; use Reverse to correct them.
        </Notice>
      )}
      {rec.status === "REVERSED" && <Notice tone="blue">Reversed by document {rec.reversal_document}.</Notice>}

      <Card
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono">{rec.document_number}</span>
            <StatusBadge status={rec.status} label={rec.status_label} />
          </span>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <ReadOnly label="Receipt Date" value={fmtDate(rec.transaction_date)} />
          <ReadOnly label="Receipt Type" value={rec.receipt_type_label} />
          <ReadOnly label="Warehouse" value={`${rec.warehouse_name} (${rec.warehouse_code})`} />
          <ReadOnly label="Receiving Location" value={rec.receiving_location_code ? `${rec.receiving_location_code} – ${rec.receiving_location_name}` : "—"} />
          <ReadOnly label="Supplier" value={rec.supplier || "—"} />
          <ReadOnly label="Supplier Reference" value={rec.supplier_reference || "—"} />
          <ReadOnly label="External Reference" value={rec.external_reference || "—"} />
          <ReadOnly label="Purchase Order" value={rec.purchase_order_reference || "—"} />
          <ReadOnly label="Expected Delivery" value={fmtDate(rec.expected_date)} />
          <ReadOnly label="Received By" value={rec.received_by || "—"} />
          <ReadOnly label="Inspection" value={rec.inspection_required ? "Required" : "Not required"} />
          <ReadOnly label="Putaway" value={<StatusBadge status={rec.putaway_progress} />} />
          <ReadOnly label="Created" value={`${rec.created_by || "—"} · ${fmtDateTime(rec.created_at)}`} />
          <ReadOnly label="Submitted" value={rec.submitted_at ? `${rec.submitted_by} · ${fmtDateTime(rec.submitted_at)}` : "—"} />
          <ReadOnly label="Approved" value={rec.approved_at ? `${rec.approved_by} · ${fmtDateTime(rec.approved_at)}` : "—"} />
          <ReadOnly label="Posted" value={rec.posted_at ? `${rec.posted_by} · ${fmtDateTime(rec.posted_at)}` : "—"} />
          {rec.remarks && <div className="col-span-2 sm:col-span-3 lg:col-span-6"><ReadOnly label="Remarks" value={<span className="whitespace-pre-wrap">{rec.remarks}</span>} /></div>}
          {rec.reason && <div className="col-span-2 sm:col-span-3 lg:col-span-6"><ReadOnly label="Reason" value={rec.reason} /></div>}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
          {[
            ["Lines", t.lines ?? receiptLines.length],
            ["Received", fmtQty(t.received)],
            ["Accepted", fmtQty(t.accepted)],
            ["Rejected", fmtQty(t.rejected)],
            ["On Hold", fmtQty(t.hold || 0)],
            ["Pending Inspection", fmtQty(t.pending)],
            ["Put Away", fmtQty(t.putaway)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
              <div className="text-base font-bold font-mono text-slate-900 dark:text-white">{v}</div>
            </div>
          ))}
        </div>
      </Card>

      <ScrollableTabs stripClassName="flex gap-1.5 border-b border-slate-200 dark:border-zinc-800 text-xs" role="group">
        {[
          ["lines", "Lines"],
          ["inspections", "Inspections"],
          ["putaways", "Putaway"],
          ["discrepancies", "Discrepancies"],
          ["attachments", "Attachments"],
          ["timeline", "History"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3.5 py-2 rounded-t-lg font-medium whitespace-nowrap cursor-pointer ${
              tab === key ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </ScrollableTabs>

      {tab === "lines" && <LinesTable lines={receiptLines} />}
      {tab === "inspections" && <RecordTab fetcher={() => fetchInspections({ receipt: rec.id })} columns={INSPECTION_COLUMNS} empty="No receipt inspections recorded." />}
      {tab === "putaways" && <RecordTab fetcher={() => fetchPutaways({ receipt: rec.id })} columns={PUTAWAY_COLUMNS} empty="No putaway recorded." />}
      {tab === "discrepancies" && <RecordTab fetcher={() => fetchDiscrepancies({ receipt: rec.id })} columns={DISCREPANCY_COLUMNS} empty="No discrepancies." />}
      {tab === "attachments" && (
        <Card>
          <Attachments
            ownerType={ATTACHMENT_OWNERS.receipt}
            ownerId={rec.id}
            canEdit={!["POSTED", "REVERSED", "CANCELLED"].includes(rec.status) && grn.can("create")}
            uploadedBy={grn.username}
          />
        </Card>
      )}
      {tab === "timeline" && <Timeline id={rec.id} canView={grn.can("history")} />}

      {pending === "delete" && (
        <ConfirmModal
          title="Delete draft receipt"
          message={`Delete draft ${rec.document_number}? This permanently removes the draft and its lines.`}
          danger
          confirmLabel="Delete"
          onClose={() => setPending(null)}
          onConfirm={async () => {
            await deleteReceipt(rec.id);
            navigate("/inventory/goods-receipt/register", { state: { toast: `${rec.document_number} deleted.` } });
          }}
        />
      )}
      {pending && ACTIONS[pending] && (
        <ConfirmModal
          title={`${ACTIONS[pending].label} – ${rec.document_number}`}
          message={ACTIONS[pending].message}
          requireReason={ACTIONS[pending].reason}
          danger={ACTIONS[pending].danger}
          confirmLabel={ACTIONS[pending].label}
          onClose={() => setPending(null)}
          onConfirm={(reason) => runAction(pending, reason)}
        />
      )}
    </div>
  );
}

function LinesTable({ lines }) {
  const columns = [
    {
      key: "item",
      label: "Item / Variant",
      render: (l) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">{l.item_name}</div>
          <div className="text-[10px] font-mono text-slate-400">
            {l.sku}
            {l.variant_name ? ` · ${l.variant_name}` : ""}
            {l.barcode ? ` · ${l.barcode}` : ""}
          </div>
          {l.description && l.description !== l.item_name && <div className="text-[10px] text-slate-500">{l.description}</div>}
        </div>
      ),
    },
    { key: "uom", label: "UOM" },
    { key: "expected_quantity", label: "Expected", align: "right", render: (l) => fmtQty(l.expected_quantity) },
    { key: "received_quantity", label: "Received", align: "right", render: (l) => fmtQty(l.received_quantity) },
    { key: "accepted_quantity", label: "Accepted", align: "right", render: (l) => fmtQty(l.accepted_quantity) },
    { key: "rejected_quantity", label: "Rejected", align: "right", render: (l) => fmtQty(l.rejected_quantity) },
    { key: "hold_quantity", label: "On Hold", align: "right", render: (l) => <span className="font-semibold text-amber-600 dark:text-amber-400">{fmtQty(l.hold_quantity || 0)}</span> },
    { key: "pending_inspection_quantity", label: "Pending Insp.", align: "right", render: (l) => fmtQty(l.pending_inspection_quantity) },
    { key: "putaway_quantity", label: "Put Away", align: "right", render: (l) => fmtQty(l.putaway_quantity) },
    { key: "inspection_status", label: "Inspection", render: (l) => <StatusBadge status={l.inspection_status} /> },
    { key: "putaway_status", label: "Putaway", render: (l) => <StatusBadge status={l.putaway_status} /> },
    {
      key: "tracking",
      label: "Batch / Serial / Dates",
      render: (l) => (
        <div className="text-[10px] text-slate-500 space-y-0.5">
          {l.batch_number && <div>Batch {l.batch_number}</div>}
          {l.serial_numbers?.length > 0 && <div className="font-mono">{l.serial_numbers.join(", ")}</div>}
          {l.manufacturing_date && <div>Mfg {l.manufacturing_date}</div>}
          {l.expiry_date && <div>Exp {l.expiry_date}</div>}
          {!l.batch_number && !l.serial_numbers?.length && !l.expiry_date && "—"}
        </div>
      ),
    },
    { key: "location_code", label: "Location", render: (l) => l.location_code || "—" },
    { key: "unit_cost", label: "Unit Cost", align: "right", render: (l) => fmtQty(l.unit_cost) },
  ];
  return <DataTable columns={columns} rows={lines} empty="This receipt has no lines." />;
}

function RecordTab({ fetcher, columns, empty }) {
  const [state, setState] = useState({ rows: null, error: null });
  const load = useCallback(() => {
    fetcher()
      .then((d) => setState({ rows: d.results || d, error: null }))
      .catch((error) => setState({ rows: [], error }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(load, [load]);
  return <DataTable columns={columns} rows={state.rows} loading={state.rows === null} error={state.error} onRetry={load} empty={empty} />;
}

const INSPECTION_COLUMNS = [
  { key: "inspection_number", label: "Inspection No.", render: (r) => <span className="font-mono">{r.inspection_number}</span> },
  { key: "item_code", label: "Item" },
  { key: "inspection_quantity", label: "Inspected", align: "right", render: (r) => fmtQty(r.inspection_quantity) },
  { key: "accepted_quantity", label: "Accepted", align: "right", render: (r) => fmtQty(r.accepted_quantity) },
  { key: "rejected_quantity", label: "Rejected", align: "right", render: (r) => fmtQty(r.rejected_quantity) },
  { key: "hold_quantity", label: "On Hold", align: "right", render: (r) => <span className="font-semibold text-amber-600 dark:text-amber-400">{fmtQty(r.hold_quantity || 0)}</span> },
  { key: "pending_quantity_after", label: "Pending After", align: "right", render: (r) => fmtQty(r.pending_quantity_after) },
  { key: "rejection_reason", label: "Reason", render: (r) => r.rejection_reason || "—" },
  { key: "rejection_disposition", label: "Disposition", render: (r) => r.rejection_disposition || "—" },
  { key: "inspector", label: "Inspector" },
  { key: "inspection_date", label: "Date", render: (r) => fmtDate(r.inspection_date) },
];
const QUALITY_COLUMNS = [
  { key: "inspection_number", label: "QI No.", render: (r) => <span className="font-mono">{r.inspection_number}</span> },
  { key: "item_code", label: "Item" },
  { key: "inspection_type", label: "Type" },
  { key: "sample_quantity", label: "Sample", align: "right", render: (r) => fmtQty(r.sample_quantity) },
  { key: "passed_quantity", label: "Passed", align: "right", render: (r) => fmtQty(r.passed_quantity) },
  { key: "failed_quantity", label: "Failed", align: "right", render: (r) => fmtQty(r.failed_quantity) },
  { key: "quality_result", label: "Result", render: (r) => <StatusBadge status={r.quality_result} /> },
  { key: "inspector", label: "Inspector" },
  { key: "inspection_date", label: "Date", render: (r) => fmtDate(r.inspection_date) },
];
const PUTAWAY_COLUMNS = [
  { key: "putaway_number", label: "Putaway No.", render: (r) => <span className="font-mono">{r.putaway_number}</span> },
  { key: "item_code", label: "Item" },
  { key: "location_code", label: "Location", render: (r) => `${r.location_code} – ${r.location_name}` },
  { key: "quantity", label: "Quantity", align: "right", render: (r) => fmtQty(r.quantity) },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "putaway_by", label: "By" },
  { key: "putaway_date", label: "Date", render: (r) => fmtDate(r.putaway_date) },
];
const DISCREPANCY_COLUMNS = [
  { key: "discrepancy_number", label: "No.", render: (r) => <span className="font-mono">{r.discrepancy_number}</span> },
  { key: "discrepancy_type", label: "Type" },
  { key: "item_code", label: "Item", render: (r) => r.item_code || "—" },
  { key: "difference_quantity", label: "Difference", align: "right", render: (r) => fmtQty(r.difference_quantity) },
  { key: "resolution_status", label: "Status", render: (r) => <StatusBadge status={r.resolution_status} /> },
  { key: "reason", label: "Reason" },
];

function Timeline({ id, canView }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (canView) fetchReceiptTimeline(id).then(setEvents).catch(setError);
  }, [id, canView]);
  if (!canView) return <Notice>You do not have access to receipt history.</Notice>;
  if (error) return <ErrorBanner error={error} />;
  if (!events) return <LoadingBlock />;
  return (
    <Card>
      <ol className="relative border-l border-slate-200 dark:border-zinc-700 ml-2 space-y-4">
        {events.map((e, i) => (
          <li key={i} className="ml-4">
            <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" />
            <div className="text-xs font-semibold text-slate-900 dark:text-white">{e.event}</div>
            <div className="text-[11px] text-slate-500">
              {fmtDateTime(e.at)} · {e.by || "system"}
            </div>
            {e.detail && <div className="text-[11px] text-slate-600 dark:text-zinc-400">{e.detail}</div>}
            {Array.isArray(e.ledger_entries) && e.ledger_entries.length > 0 && (
              <div className="mt-2 space-y-1 rounded-lg bg-slate-100 dark:bg-zinc-800/80 p-2 text-[10px] font-mono">
                <div className="font-semibold text-slate-700 dark:text-zinc-300">Stock Ledger Postings ({e.ledger_entries.length}):</div>
                {e.ledger_entries.map((entry, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-zinc-400">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Entry #{entry.id}</span>
                    <span>Item: {entry.item_code}</span>
                    <span>Qty: +{fmtQty(entry.quantity)}</span>
                    <span>Loc: {entry.location_code}</span>
                    <span>Bal After: {fmtQty(entry.balance_after)}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default ReceiptDetailPage;
