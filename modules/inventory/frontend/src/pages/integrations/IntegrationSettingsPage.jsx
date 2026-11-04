import React, { useState, useEffect } from "react";
import { IntegrationTabsHeader } from "../../components/IntegrationTabsHeader";
import {
  Settings,
  Save,
  CheckCircle2,
  Sliders,
  ShieldAlert,
  Zap,
  RotateCcw,
  Check,
} from "lucide-react";

export function IntegrationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    enable_purchase_integration: true,
    enable_sales_integration: true,
    enable_low_stock_alerts: true,
    outbox_poll_interval_seconds: 5,
    outbox_batch_size: 50,
    max_retry_attempts: 5,
    backoff_multiplier: 2.0,
    dead_letter_threshold: 5,
    low_stock_suppression_hours: 24,
  });

  // Simulator
  const [simForm, setSimForm] = useState({
    type: "purchase.goods_received",
    orderId: "PO-SIM-" + Math.floor(1000 + Math.random() * 9000),
    warehouseCode: "WH-MAIN",
    itemCode: "BRG-6205",
    quantity: 100,
    unitCost: 15.0,
  });
  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/inventory/integrations/settings/");
      if (res.ok) {
        const json = await res.json();
        setForm(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/v1/inventory/integrations/settings/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSimulate = async (e) => {
    e.preventDefault();
    setSimulating(true);
    setSimResult(null);

    let payload = {};
    if (simForm.type === "purchase.goods_received") {
      payload = {
        purchase_order_id: simForm.orderId,
        grn_number: `GRN-${simForm.orderId}`,
        warehouse_code: simForm.warehouseCode,
        lines: [{ item_code: simForm.itemCode, quantity: Number(simForm.quantity), unit_cost: Number(simForm.unitCost) }],
      };
    } else if (simForm.type === "sales.order_confirmed") {
      payload = {
        sales_order_id: simForm.orderId,
        warehouse_code: simForm.warehouseCode,
        lines: [{ item_code: simForm.itemCode, quantity: Number(simForm.quantity) }],
      };
    } else if (simForm.type === "sales.order_dispatched") {
      payload = {
        sales_order_id: simForm.orderId,
        dispatch_ref: `DSP-${simForm.orderId}`,
        warehouse_code: simForm.warehouseCode,
        lines: [{ item_code: simForm.itemCode, quantity: Number(simForm.quantity) }],
      };
    } else if (simForm.type === "sales.order_cancelled") {
      payload = { sales_order_id: simForm.orderId };
    }

    try {
      const res = await fetch("/api/v1/inventory/integrations/simulate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: simForm.type, payload }),
      });
      const json = await res.json();
      setSimResult({ ok: res.ok, data: json });
    } catch (err) {
      setSimResult({ ok: false, error: String(err) });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      <IntegrationTabsHeader
        title="Integration Settings"
        subtitle="Manage cross-module feature flags, dead-letter retry policies, and outbox relay frequencies."
        icon={Settings}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Integration Engine Rules</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Parameters controlling transactional outbox and event consumers.</p>
            </div>
            {saved && (
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="w-4 h-4" /> Saved!
              </span>
            )}
          </div>

          {/* Module Interconnect Toggles */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-500">Cross-Module Feature Flags</h4>
            
            <label className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={form.enable_purchase_integration}
                onChange={(e) => setForm({ ...form, enable_purchase_integration: e.target.checked })}
                className="mt-0.5 shrink-0 rounded border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
              />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Enable Purchase Integration</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">Accept and process inbound purchase.goods_received events.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={form.enable_sales_integration}
                onChange={(e) => setForm({ ...form, enable_sales_integration: e.target.checked })}
                className="mt-0.5 shrink-0 rounded border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
              />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Enable Sales Integration</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">Accept sales reservations, dispatches, and cancellations.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={form.enable_low_stock_alerts}
                onChange={(e) => setForm({ ...form, enable_low_stock_alerts: e.target.checked })}
                className="mt-0.5 shrink-0 rounded border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
              />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Publish Outgoing Low-Stock Alerts</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">Broadcast inventory.low_stock events when items breach reorder point.</div>
              </div>
            </label>
          </div>

          {/* Reliability Policies */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-500">Reliability & Dead-Letter Thresholds</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 mb-1 font-medium">Max Retry Attempts:</label>
                <input
                  type="number"
                  value={form.max_retry_attempts}
                  onChange={(e) => setForm({ ...form, max_retry_attempts: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 mb-1 font-medium">Backoff Multiplier:</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.backoff_multiplier}
                  onChange={(e) => setForm({ ...form, backoff_multiplier: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 mb-1 font-medium">Dead-Letter Threshold:</label>
                <input
                  type="number"
                  value={form.dead_letter_threshold}
                  onChange={(e) => setForm({ ...form, dead_letter_threshold: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 mb-1 font-medium">Alert Suppression (Hours):</label>
                <input
                  type="number"
                  value={form.low_stock_suppression_hours}
                  onChange={(e) => setForm({ ...form, low_stock_suppression_hours: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving..." : "Save Integration Settings"}</span>
          </button>
        </form>

        {/* Integration Test Bench / Simulator */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs flex flex-col space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
              <span>Event Simulator Workbench</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Simulate external triggers from Purchase or Sales to verify live stock mutations.
            </p>
          </div>

          <form onSubmit={handleSimulate} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Event Type:</label>
              <select
                value={simForm.type}
                onChange={(e) => setSimForm({ ...simForm, type: e.target.value })}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-slate-900 dark:text-white"
              >
                <option value="purchase.goods_received">purchase.goods_received (PO Receipt)</option>
                <option value="sales.order_confirmed">sales.order_confirmed (Reserve Stock)</option>
                <option value="sales.order_dispatched">sales.order_dispatched (Dispatch Issue)</option>
                <option value="sales.order_cancelled">sales.order_cancelled (Release Reservation)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 dark:text-zinc-400 mb-1">Order ID:</label>
                <input
                  type="text"
                  value={simForm.orderId}
                  onChange={(e) => setSimForm({ ...simForm, orderId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded p-1.5 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-zinc-400 mb-1">Item Code:</label>
                <input
                  type="text"
                  value={simForm.itemCode}
                  onChange={(e) => setSimForm({ ...simForm, itemCode: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded p-1.5 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={simulating}
              className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>{simulating ? "Executing..." : "Dispatch Test Signal"}</span>
            </button>
          </form>

          {/* Simulator Output */}
          <div className="flex-1 bg-slate-950 rounded-lg p-3 font-mono text-[10px] text-cyan-300 max-h-48 overflow-auto border border-slate-800">
            {simResult ? (
              <pre>{JSON.stringify(simResult, null, 2)}</pre>
            ) : (
              <span className="text-slate-400">Simulator output will appear here.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default IntegrationSettingsPage;

