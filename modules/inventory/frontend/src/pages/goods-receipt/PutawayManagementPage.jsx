import React, { useEffect, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { cancelPutaway, fetchPutaways, fetchReceiptLines, fetchWarehouseLocations, recordPutaway } from "../../services/goodsReceiptApi";
import {
  Card,
  ConfirmModal,
  DataTable,
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
  btnDanger,
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
import { useWarehouses } from "./ReceiptInspectionPage";

const CLOSED = ["POSTED", "REVERSED", "CANCELLED", "REJECTED"];

export function PutawayManagementPage() {
  const grn = useGrnContext();
  return (
    <GrnPage
      title="Putaway Management"
      subtitle="Place accepted quantities into storage locations. Stock is recognised at these locations when the receipt is posted."
      icon={Layers}
    >
      <SubmoduleGate grn={grn} submodule="putaway">
        <PutawayWorkspace grn={grn} />
      </SubmoduleGate>
    </GrnPage>
  );
}

function PutawayWorkspace({ grn }) {
  const cfg = grn.settings("putaway");
  const warehouses = useWarehouses();
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toastNode, toast] = useToast();
  const { data, loading, error, filters, setFilter, reload } = usePagedQuery(
    (params) => fetchReceiptLines("pending_putaway", params),
    ["receipt", "search", "warehouse"]
  );
  useEffect(() => {
    if (selected && data?.results) setSelected(data.results.find((r) => r.id === selected.id) || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const columns = [
    { key: "receipt_number", label: "Receipt", render: (r) => <ReceiptLink id={r.receipt_id} number={r.receipt_number} /> },
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
    { key: "warehouse_code", label: "Warehouse", render: (r) => <span className="whitespace-nowrap font-mono text-[11px]">{r.warehouse_code || "—"}</span> },
    { key: "accepted_quantity", label: "Accepted", align: "right", render: (r) => <span className="whitespace-nowrap font-medium">{fmtQty(r.accepted_quantity)} {r.uom}</span> },
    { key: "putaway_quantity", label: "Put Away", align: "right", render: (r) => <span className="whitespace-nowrap">{fmtQty(r.putaway_quantity)}</span> },
    { key: "pending_putaway_quantity", label: "Pending", align: "right", render: (r) => fmtQty(r.pending_putaway_quantity) },
    { key: "putaway_status", label: "Status", render: (r) => <StatusBadge status={r.putaway_status} /> },
  ];

  return (
    <div className="space-y-5">
      {toastNode}
      <Notice tone="blue">
        Putaway is <b>{cfg.putaway_mandatory ? "mandatory" : "optional"}</b>:{" "}
        {cfg.putaway_mandatory
          ? "receipts post only after every accepted unit is put away."
          : "any accepted quantity not put away is posted to the receiving location."}{" "}
        {cfg.allow_multiple_locations ? "A line may be split across several locations." : "Each line must go to a single location."}
      </Notice>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-7 2xl:col-span-8 space-y-3 min-w-0">
          <FilterBar count={data?.count}>
            <SearchInput value={filters.search} onChange={(v) => setFilter("search", v)} placeholder="Receipt no., item, batch…" />
            <SelectFilter
              value={filters.warehouse}
              onChange={(v) => setFilter("warehouse", v)}
              allLabel="All warehouses"
              options={warehouses.map((w) => ({ value: String(w.id), label: w.code }))}
            />
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
            onRowClick={setSelected}
            selectedKey={selected?.id}
            empty="No accepted goods are waiting for putaway."
          />
          <Pagination data={data} page={filters.page} onPage={(p) => setFilter("page", p)} />
        </div>
        <div className="xl:col-span-5 2xl:col-span-4 min-w-0">
          {selected ? (
            <PutawayForm
              key={`${selected.id}-${selected.putaway_quantity}`}
              line={selected}
              grn={grn}
              onSaved={(rec) => {
                toast(`${rec.putaway_number}: ${fmtQty(rec.quantity)} put away to ${rec.location_code}.`);
                reload();
                setReloadKey((k) => k + 1);
              }}
            />
          ) : (
            <Notice tone="blue">Select a line to put away.</Notice>
          )}
        </div>
      </div>
      <PutawayLog reloadKey={reloadKey} onChanged={() => reload()} />
    </div>
  );
}

function PutawayForm({ line, grn, onSaved }) {
  const cfg = grn.settings("putaway");
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({
    location: "",
    quantity: line.pending_putaway_quantity,
    putaway_by: grn.username,
    putaway_date: today(),
    remarks: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const pending = Number(line.pending_putaway_quantity);

  useEffect(() => {
    fetchWarehouseLocations(line.warehouse)
      .then((list) => setLocations(cfg.require_location_allows_putaway ? list.filter((l) => l.allow_putaway) : list))
      .catch(setError);
  }, [line.warehouse, cfg.require_location_allows_putaway]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const submit = async () => {
    const e = {};
    const qty = Number(form.quantity);
    if (!form.location) e.location = "Select a destination location.";
    if (!(qty > 0)) e.quantity = "Quantity must be greater than zero.";
    else if (qty > pending) e.quantity = `Only ${fmtQty(pending)} is pending putaway.`;
    if (line.tracking?.serial && !Number.isInteger(qty)) e.quantity = "Serial-tracked items are put away in whole units.";
    if (!form.putaway_date || form.putaway_date > today() || form.putaway_date < line.receipt_date) e.putaway_date = "Must be between the receipt date and today.";
    setErrors(e);
    setError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const rec = await recordPutaway({
        receipt: line.receipt_id,
        line: line.id,
        location: Number(form.location),
        quantity: String(form.quantity),
        putaway_by: form.putaway_by,
        putaway_date: form.putaway_date,
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
    <Card title="Record Putaway">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <ReadOnly label="Receipt" value={<ReceiptLink id={line.receipt_id} number={line.receipt_number} />} />
          <ReadOnly label="Receipt Line" value={`#${line.id} · ${line.item_code}${line.variant_sku ? ` / ${line.variant_sku}` : ""}`} mono />
          <ReadOnly label="Warehouse" value={line.warehouse_code} />
          <ReadOnly label="Accepted" value={`${fmtQty(line.accepted_quantity)} ${line.uom}`} />
          <ReadOnly label="Previously Put Away" value={fmtQty(line.putaway_quantity)} />
          <ReadOnly label="Pending Putaway" value={fmtQty(pending)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Destination Location" required error={errors.location}>
            <select className={cls("location")} value={form.location} onChange={(e) => set("location", e.target.value)}>
              <option value="">Select location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} – {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Putaway Quantity" required error={errors.quantity}>
            <input type="number" min="0" step="any" className={cls("quantity")} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </Field>
          <Field label="Putaway By">
            <input className={inputCls} value={form.putaway_by} maxLength={120} onChange={(e) => set("putaway_by", e.target.value)} />
          </Field>
          <Field label="Putaway Date" required error={errors.putaway_date}>
            <input type="date" className={cls("putaway_date")} value={form.putaway_date} min={line.receipt_date} max={today()} onChange={(e) => set("putaway_date", e.target.value)} />
          </Field>
        </div>
        <Field label="Remarks">
          <textarea rows={2} className={inputCls} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
        </Field>
        <ErrorBanner error={error} />
        <div className="flex justify-end">
          <button className={btnPrimary} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm Putaway
          </button>
        </div>
      </div>
    </Card>
  );
}

function PutawayLog({ reloadKey, onChanged }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [tick, setTick] = useState(0);
  const [cancelling, setCancelling] = useState(null);
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    fetchPutaways({ page, status })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
  }, [page, status, reloadKey, tick]);

  const columns = [
    { key: "putaway_number", label: "Putaway No.", render: (r) => <span className="font-mono">{r.putaway_number}</span> },
    { key: "receipt_number", label: "Receipt", render: (r) => <ReceiptLink id={r.receipt} number={r.receipt_number} /> },
    { key: "line", label: "Line", render: (r) => `#${r.line} ${r.item_code}${r.variant_sku ? ` / ${r.variant_sku}` : ""}` },
    { key: "warehouse_code", label: "Warehouse", render: (r) => <span className="whitespace-nowrap font-mono text-[11px]">{r.warehouse_code || "—"}</span> },
    { key: "location_code", label: "Location", render: (r) => `${r.location_code} – ${r.location_name}` },
    { key: "quantity", label: "Qty", align: "right", render: (r) => `${fmtQty(r.quantity)} ${r.uom}` },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "putaway_by", label: "By" },
    { key: "putaway_date", label: "Date", render: (r) => fmtDate(r.putaway_date) },
    {
      key: "actions",
      label: "",
      render: (r) =>
        r.status === "COMPLETED" && !CLOSED.includes(r.receipt_status) ? (
          <button className={btnDanger} onClick={() => setCancelling(r)}>
            Cancel
          </button>
        ) : null,
    },
  ];

  return (
    <Card
      title="Putaway Log"
      actions={
        <SelectFilter
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          allLabel="All statuses"
          options={[{ value: "COMPLETED", label: "Completed" }, { value: "CANCELLED", label: "Cancelled" }]}
        />
      }
    >
      <div className="space-y-3">
        <DataTable columns={columns} rows={state.data?.results} loading={state.loading} error={state.error} empty="No putaway recorded yet." />
        <Pagination data={state.data} page={page} onPage={setPage} />
      </div>
      {cancelling && (
        <ConfirmModal
          title={`Cancel ${cancelling.putaway_number}`}
          message={`Return ${fmtQty(cancelling.quantity)} from ${cancelling.location_code} to the pending putaway queue? Allowed only before the receipt is posted.`}
          danger
          confirmLabel="Cancel Putaway"
          onClose={() => setCancelling(null)}
          onConfirm={async () => {
            await cancelPutaway(cancelling.id);
            setTick((t) => t + 1);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

export default PutawayManagementPage;
