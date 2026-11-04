// Accepted / Rejected / Partial Acceptance views are derived from receipt lines
// and inspection records; nothing is stored separately for them.
import React, { useState } from "react";
import { PackageCheck, PackageX, Split } from "lucide-react";
import { fetchInspections, fetchReceiptLines, setRejectionDisposition } from "../../services/goodsReceiptApi";
import {
  DataTable,
  DateRange,
  ErrorBanner,
  FilterBar,
  GrnPage,
  Pagination,
  ReceiptLink,
  SearchInput,
  SelectFilter,
  StatusBadge,
  SubmoduleGate,
  fmtDate,
  fmtQty,
  inputCls,
  useGrnContext,
  usePagedQuery,
  useToast,
} from "./grnComponents";
import { useWarehouses } from "./ReceiptInspectionPage";

const itemCell = (r) => (
  <div>
    <div className="font-semibold text-slate-900 dark:text-white">{r.item_name}</div>
    <div className="text-[10px] font-mono text-slate-400">
      {r.sku}
      {r.variant_name ? ` · ${r.variant_name}` : ""}
      {r.batch_number ? ` · Batch ${r.batch_number}` : ""}
    </div>
  </div>
);

function LineOutcomeTable({ outcome, columns, empty, pageSize }) {
  const warehouses = useWarehouses();
  const { data, loading, error, filters, setFilter, reload } = usePagedQuery(
    (params) => fetchReceiptLines(outcome, params),
    ["search", "warehouse", "posted", "date_from", "date_to", "receipt"]
  );
  return (
    <div className="space-y-3">
      <FilterBar count={data?.count}>
        <SearchInput value={filters.search} onChange={(v) => setFilter("search", v)} placeholder="Receipt no., item, batch, supplier…" />
        <SelectFilter
          value={filters.warehouse}
          onChange={(v) => setFilter("warehouse", v)}
          allLabel="All warehouses"
          options={warehouses.map((w) => ({ value: String(w.id), label: `${w.name} (${w.code})` }))}
        />
        <SelectFilter
          value={filters.posted}
          onChange={(v) => setFilter("posted", v)}
          allLabel="Posted & unposted"
          options={[{ value: "true", label: "Posted to stock" }, { value: "false", label: "Not yet posted" }]}
        />
        <DateRange from={filters.date_from} to={filters.date_to} onFrom={(v) => setFilter("date_from", v)} onTo={(v) => setFilter("date_to", v)} />
      </FilterBar>
      <DataTable columns={columns} rows={data?.results} loading={loading} error={error} onRetry={reload} empty={empty} />
      <Pagination data={data} page={filters.page} pageSize={pageSize} onPage={(p) => setFilter("page", p)} />
    </div>
  );
}

const receiptCols = [
  { key: "receipt_number", label: "Receipt", render: (r) => <ReceiptLink id={r.receipt_id} number={r.receipt_number} /> },
  { key: "receipt_date", label: "Date", render: (r) => fmtDate(r.receipt_date) },
  { key: "supplier", label: "Supplier", render: (r) => r.supplier || "—" },
  { key: "warehouse_code", label: "Warehouse" },
  { key: "item", label: "Item / Variant", render: itemCell },
  { key: "uom", label: "UOM" },
];

export function AcceptedGoodsPage() {
  const grn = useGrnContext();
  const columns = [
    ...receiptCols,
    { key: "received_quantity", label: "Received", align: "right", render: (r) => fmtQty(r.received_quantity) },
    { key: "accepted_quantity", label: "Accepted", align: "right", render: (r) => fmtQty(r.accepted_quantity) },
    { key: "putaway_quantity", label: "Put Away", align: "right", render: (r) => fmtQty(r.putaway_quantity) },
    { key: "pending_putaway_quantity", label: "Pending Putaway", align: "right", render: (r) => fmtQty(r.pending_putaway_quantity) },
    { key: "inspection_status", label: "Inspection", render: (r) => <StatusBadge status={r.inspection_status} /> },
    { key: "receipt_status", label: "Receipt Status", render: (r) => <StatusBadge status={r.receipt_status} /> },
  ];
  return (
    <GrnPage title="Accepted Goods" subtitle="Receipt lines with accepted quantity: eligible for putaway and stock recognition." icon={PackageCheck}>
      <SubmoduleGate grn={grn} submodule="accepted">
        <LineOutcomeTable outcome="accepted" columns={columns} empty="No accepted goods match these filters." pageSize={grn.settings("accepted").page_size} />
      </SubmoduleGate>
    </GrnPage>
  );
}

export function PartialAcceptancePage() {
  const grn = useGrnContext();
  const columns = [
    ...receiptCols,
    { key: "received_quantity", label: "Received", align: "right", render: (r) => fmtQty(r.received_quantity) },
    { key: "accepted_quantity", label: "Accepted", align: "right", render: (r) => fmtQty(r.accepted_quantity) },
    { key: "rejected_quantity", label: "Rejected", align: "right", render: (r) => fmtQty(r.rejected_quantity) },
    { key: "pending_inspection_quantity", label: "Pending Insp.", align: "right", render: (r) => fmtQty(r.pending_inspection_quantity) },
    {
      key: "acceptance_rate",
      label: "Acceptance",
      align: "right",
      render: (r) => `${((Number(r.accepted_quantity) / Number(r.received_quantity)) * 100).toFixed(1)}%`,
    },
    { key: "rejection_reason", label: "Last Rejection Reason", render: (r) => r.rejection_reason || "—" },
    { key: "receipt_status", label: "Receipt Status", render: (r) => <StatusBadge status={r.receipt_status} /> },
  ];
  const cfg = grn.settings("partial");
  return (
    <GrnPage
      title="Partial Acceptance"
      subtitle="Lines where only part of the received quantity was accepted, or inspection is still in progress."
      icon={Split}
    >
      <SubmoduleGate grn={grn} submodule="partial">
        {!cfg.allow_partial_acceptance && (
          <div className="mb-3 text-xs text-amber-700 dark:text-amber-400">
            Partial acceptance is currently disabled: new inspections must fully accept or fully reject a line.
          </div>
        )}
        <LineOutcomeTable outcome="partial" columns={columns} empty="No partially accepted lines." pageSize={cfg.page_size} />
      </SubmoduleGate>
    </GrnPage>
  );
}

export function RejectedGoodsPage() {
  const grn = useGrnContext();
  return (
    <GrnPage
      title="Rejected Goods"
      subtitle="Rejected quantities by inspection, with reason and disposition. Rejected goods never enter available stock."
      icon={PackageX}
    >
      <SubmoduleGate grn={grn} submodule="rejected">
        <RejectedTable grn={grn} />
      </SubmoduleGate>
    </GrnPage>
  );
}

function RejectedTable({ grn }) {
  const cfg = grn.settings("rejected");
  const canDispose = grn.can("rejected", "disposition_permission");
  const [toastNode, toast] = useToast();
  const [error, setError] = useState(null);
  const warehouses = useWarehouses();
  const { data, loading, error: loadError, filters, setFilter, reload } = usePagedQuery(
    (params) => fetchInspections({ ...params, rejected: "true" }),
    ["search", "warehouse", "date_from", "date_to", "receipt"]
  );

  const changeDisposition = async (row, value) => {
    setError(null);
    try {
      await setRejectionDisposition(row.id, value);
      toast(`${row.inspection_number}: disposition set to ${value}.`);
      reload();
    } catch (e) {
      setError(e);
    }
  };

  const columns = [
    { key: "inspection_number", label: "Inspection", render: (r) => <span className="font-mono">{r.inspection_number}</span> },
    { key: "receipt_number", label: "Receipt", render: (r) => <ReceiptLink id={r.receipt} number={r.receipt_number} /> },
    { key: "inspection_date", label: "Date", render: (r) => fmtDate(r.inspection_date) },
    {
      key: "item",
      label: "Item / Variant",
      render: (r) => (
        <div>
          <div className="font-semibold">{r.item_name}</div>
          <div className="text-[10px] font-mono text-slate-400">
            {r.item_code}
            {r.variant_sku ? ` / ${r.variant_sku}` : ""}
            {r.batch_number ? ` · Batch ${r.batch_number}` : ""}
          </div>
        </div>
      ),
    },
    { key: "received_quantity", label: "Received", align: "right", render: (r) => `${fmtQty(r.received_quantity)} ${r.uom}` },
    { key: "rejected_quantity", label: "Rejected", align: "right", render: (r) => fmtQty(r.rejected_quantity) },
    { key: "rejected_serial_numbers", label: "Serials", render: (r) => (r.rejected_serial_numbers?.length ? <span className="font-mono text-[10px]">{r.rejected_serial_numbers.join(", ")}</span> : "—") },
    { key: "rejection_reason", label: "Reason", render: (r) => r.rejection_reason || "—" },
    {
      key: "rejection_disposition",
      label: "Disposition",
      render: (r) =>
        canDispose ? (
          <select className={`${inputCls} w-auto`} value={r.rejection_disposition} onChange={(e) => changeDisposition(r, e.target.value)}>
            {!cfg.dispositions?.includes(r.rejection_disposition) && <option value={r.rejection_disposition}>{r.rejection_disposition || "—"}</option>}
            {(cfg.dispositions || []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        ) : (
          r.rejection_disposition || "—"
        ),
    },
    { key: "inspector", label: "Inspector" },
    { key: "receipt_status", label: "Receipt Status", render: (r) => <StatusBadge status={r.receipt_status} /> },
  ];

  return (
    <div className="space-y-3">
      {toastNode}
      <ErrorBanner error={error} />
      <FilterBar count={data?.count}>
        <SearchInput value={filters.search} onChange={(v) => setFilter("search", v)} placeholder="Receipt no. or item…" />
        <SelectFilter
          value={filters.warehouse}
          onChange={(v) => setFilter("warehouse", v)}
          allLabel="All warehouses"
          options={warehouses.map((w) => ({ value: String(w.id), label: `${w.name} (${w.code})` }))}
        />
        <DateRange from={filters.date_from} to={filters.date_to} onFrom={(v) => setFilter("date_from", v)} onTo={(v) => setFilter("date_to", v)} />
      </FilterBar>
      <DataTable columns={columns} rows={data?.results} loading={loading} error={loadError} onRetry={reload} empty="No rejected goods." />
      <Pagination data={data} page={filters.page} pageSize={cfg.page_size} onPage={(p) => setFilter("page", p)} />
    </div>
  );
}
