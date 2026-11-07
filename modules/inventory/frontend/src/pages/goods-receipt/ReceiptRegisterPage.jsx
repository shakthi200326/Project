import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, History, Plus, CheckCircle2, Clock, AlertTriangle, Layers, ArrowDownToLine, Package } from "lucide-react";
import { fetchActiveWarehouses, fetchReceiptMetrics, fetchReceipts } from "../../services/goodsReceiptApi";
import {
  DataTable,
  DateRange,
  FilterBar,
  GrnPage,
  Pagination,
  RECEIPT_STATUSES,
  ReceiptLink,
  SearchInput,
  SelectFilter,
  StatusBadge,
  SubmoduleGate,
  btnPrimary,
  fmtDate,
  fmtQty,
  statusLabel,
  useGrnContext,
  usePagedQuery,
  useToast,
} from "./grnComponents";

const FILTERS = ["search", "status", "receipt_type", "warehouse", "date_from", "date_to", "posted", "putaway"];
const HISTORY_STATUSES = ["POSTED", "REVERSED", "REJECTED", "CANCELLED"];

/** Metric KPI Card component for enterprise header overview */
function GrnMetricCard({ label, value, subtext, icon: Icon, color = "indigo" }) {
  const colorMap = {
    indigo: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900",
    amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900",
    blue: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900",
    emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
  };
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
      <div className={`p-2.5 rounded-lg border ${colorMap[color] || colorMap.indigo}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs font-medium text-slate-500 dark:text-zinc-400">{label}</div>
        <div className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{value}</div>
        {subtext && <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">{subtext}</div>}
      </div>
    </div>
  );
}

/** Receipt Register (all receipts) and Receipt History (closed receipts) share this page. */
export function ReceiptRegisterPage({ view = "register" }) {
  const grn = useGrnContext();
  const submodule = view === "history" ? "history" : "register";
  return (
    <GrnPage
      title={view === "history" ? "Receipt History" : "Receipt Register"}
      subtitle={
        view === "history"
          ? "Posted, reversed, rejected and cancelled receipts with full drill-down."
          : "Every goods receipt with its inspection, putaway and posting progress."
      }
      icon={view === "history" ? History : ClipboardList}
      actions={
        view === "register" &&
        grn.can("create") && (
          <NewReceiptButton />
        )
      }
    >
      <SubmoduleGate grn={grn} submodule={submodule}>
        <RegisterTable view={view} grn={grn} />
      </SubmoduleGate>
    </GrnPage>
  );
}

function NewReceiptButton() {
  const navigate = useNavigate();
  return (
    <button className={btnPrimary} onClick={() => navigate("/inventory/goods-receipt/create")}>
      <Plus className="h-4 w-4" /> New Goods Receipt
    </button>
  );
}

function RegisterTable({ view, grn }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [toastNode, toast] = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const { data, loading, error, filters, setFilter, reload } = usePagedQuery(
    (params) => fetchReceipts({ ...params, view }),
    FILTERS
  );

  const loadMetrics = () => {
    fetchReceiptMetrics({ warehouse: filters.warehouse }).then(setMetrics).catch(() => {});
  };

  useEffect(() => {
    fetchActiveWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
    loadMetrics();
  }, [filters.warehouse]);

  useEffect(() => {
    if (location.state?.toast) {
      toast(location.state.toast);
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate, toast]);

  const receiptTypes = grn.settings("create").receipt_types || [];
  const statuses = view === "history" ? HISTORY_STATUSES : RECEIPT_STATUSES;
  const columns = [
    { key: "document_number", label: "Receipt No.", render: (r) => <ReceiptLink id={r.id} number={r.document_number} /> },
    { key: "transaction_date", label: "Date", render: (r) => fmtDate(r.transaction_date) },
    { key: "receipt_type", label: "Type", render: (r) => r.receipt_type_label || r.receipt_type || "—" },
    {
      key: "supplier",
      label: "Supplier / Ext. Ref",
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">{r.supplier || "—"}</div>
          <div className="text-[10px] text-slate-400 font-mono">{r.external_reference || r.purchase_order_reference || ""}</div>
        </div>
      ),
    },
    { key: "warehouse", label: "Warehouse", render: (r) => `${r.warehouse_code}${r.receiving_location_code ? ` / ${r.receiving_location_code}` : ""}` },
    { key: "lines", label: "Lines", align: "right", render: (r) => r.totals?.lines ?? r.lines?.length ?? 0 },
    { key: "received", label: "Received", align: "right", render: (r) => fmtQty(r.totals?.received) },
    { key: "accepted", label: "Accepted", align: "right", render: (r) => fmtQty(r.totals?.accepted) },
    { key: "rejected", label: "Rejected", align: "right", render: (r) => fmtQty(r.totals?.rejected) },
    { key: "pending", label: "Pending Insp.", align: "right", render: (r) => fmtQty(r.totals?.pending) },
    { key: "putaway_progress", label: "Putaway", render: (r) => <StatusBadge status={r.putaway_progress} /> },
    { key: "status", label: "Receipt Status", render: (r) => <StatusBadge status={r.status} label={r.status_label} /> },
    { key: "posted", label: "Posted", render: (r) => (r.posted ? "Yes" : "No") },
    { key: "created_by", label: "Created By" },
    { key: "posted_by", label: "Posted By", render: (r) => r.posted_by || "—" },
    { key: "created_at", label: "Created", render: (r) => fmtDate(r.created_at) },
  ];

  return (
    <div className="space-y-4">
      {toastNode}

      {/* Enterprise KPI Metrics Bar */}
      {view === "register" && metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GrnMetricCard
            label="Total Receipts"
            value={metrics.total_receipts}
            subtext={`${metrics.draft_count} Drafts`}
            icon={ClipboardList}
            color="indigo"
          />
          <GrnMetricCard
            label="Under Inspection"
            value={metrics.under_inspection_count}
            subtext={`${fmtQty(metrics.pending_inspection_units)} units pending`}
            icon={AlertTriangle}
            color="amber"
          />
          <GrnMetricCard
            label="Putaway Pending"
            value={metrics.putaway_pending_count}
            subtext="Ready for storage placement"
            icon={Layers}
            color="blue"
          />
          <GrnMetricCard
            label="Posted to Stock"
            value={metrics.posted_count}
            subtext={`${fmtQty(metrics.total_accepted_qty)} accepted units`}
            icon={CheckCircle2}
            color="emerald"
          />
        </div>
      )}

      <FilterBar count={data?.count}>
        <SearchInput
          value={filters.search}
          onChange={(v) => setFilter("search", v)}
          placeholder="Search GRN no., supplier, reference, item, batch…"
        />
        <SelectFilter
          value={filters.status}
          onChange={(v) => setFilter("status", v)}
          allLabel="All statuses"
          options={statuses.map((s) => ({ value: s, label: statusLabel(s) }))}
        />
        <SelectFilter
          value={filters.receipt_type}
          onChange={(v) => setFilter("receipt_type", v)}
          allLabel="All receipt types"
          options={receiptTypes.map((t) => ({ value: t.code, label: t.label }))}
        />
        <SelectFilter
          value={filters.warehouse}
          onChange={(v) => setFilter("warehouse", v)}
          allLabel="All warehouses"
          options={warehouses.map((w) => ({ value: String(w.id), label: `${w.name} (${w.code})` }))}
        />
        {view === "register" && (
          <>
            <SelectFilter
              value={filters.posted}
              onChange={(v) => setFilter("posted", v)}
              allLabel="Posted & unposted"
              options={[{ value: "true", label: "Posted" }, { value: "false", label: "Not posted" }]}
            />
            <SelectFilter
              value={filters.putaway}
              onChange={(v) => setFilter("putaway", v)}
              allLabel="Any putaway status"
              options={["PENDING", "PARTIAL", "COMPLETED"].map((s) => ({ value: s, label: `Putaway ${statusLabel(s).toLowerCase()}` }))}
            />
          </>
        )}
        <DateRange
          from={filters.date_from}
          to={filters.date_to}
          onFrom={(v) => setFilter("date_from", v)}
          onTo={(v) => setFilter("date_to", v)}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={data?.results}
        loading={loading}
        error={error}
        onRetry={reload}
        onRowClick={(r) => navigate(`/inventory/goods-receipt/receipts/${r.id}${view === "history" ? "?view=history" : ""}`)}
        empty={view === "history" ? "No closed receipts match these filters." : "No goods receipts match these filters."}
      />
      <Pagination
        data={data}
        page={filters.page}
        pageSize={grn.settings(view === "history" ? "history" : "register").page_size}
        onPage={(p) => setFilter("page", p)}
      />
    </div>
  );
}

export default ReceiptRegisterPage;
