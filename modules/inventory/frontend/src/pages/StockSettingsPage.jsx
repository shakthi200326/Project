import React, { useState, useEffect } from "react";
import { ConfigTabsHeader } from "../components/ConfigTabsHeader";
import { fetchGlobalConfig, updateGlobalConfig } from "../services/api";
import { Boxes, Save, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";

export function StockSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({
    allow_negative_stock: false,
    enable_stock_reservation: true,
    enable_stock_transfer: true,
    require_warehouse_selection: true,
    require_storage_location: true,
    require_bin_selection: false,
    default_low_stock_threshold: 20,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const cfg = await fetchGlobalConfig();
      if (cfg) {
        setForm({
          allow_negative_stock: cfg.allow_negative_stock ?? false,
          enable_stock_reservation: cfg.enable_stock_reservation ?? true,
          enable_stock_transfer: cfg.enable_stock_transfer ?? true,
          require_warehouse_selection: cfg.require_warehouse_selection ?? true,
          require_storage_location: cfg.require_storage_location ?? true,
          require_bin_selection: cfg.require_bin_selection ?? false,
          default_low_stock_threshold: Number(cfg.default_low_stock_threshold) || 20,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateGlobalConfig({
        ...form,
        default_low_stock_threshold: Number(form.default_low_stock_threshold),
        _section: "Stock Settings",
        changed_by: "Operations Admin",
      });
      setToast({ type: "success", message: "Stock Settings successfully persisted to inventory engine." });
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setToast({ type: "error", message: "Failed to save Stock Settings." });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const toggles = [
    {
      key: "allow_negative_stock",
      label: "Allow Negative Stock",
      required: true,
      desc: "Permit stock issues when on-hand quantity is zero or less. (Caution: Causes financial variance).",
      warn: true,
    },
    {
      key: "enable_stock_reservation",
      label: "Enable Stock Reservation",
      required: true,
      desc: "Allows reserving stock allocations for open sales orders, production kits, and project dispatches.",
    },
    {
      key: "enable_stock_transfer",
      label: "Enable Stock Transfer",
      required: true,
      desc: "Activates inter-warehouse transfer documents, in-transit workflows, and shipment tracking.",
    },
    {
      key: "require_warehouse_selection",
      label: "Require Warehouse Selection",
      required: true,
      desc: "Enforces explicit warehouse facility selection on all inbound and outbound stock transactions.",
    },
    {
      key: "require_storage_location",
      label: "Require Storage Location",
      required: true,
      desc: "Demands a designated zone (Storage, Receiving, Picking, Packing) on every transaction line.",
    },
    {
      key: "require_bin_selection",
      label: "Require Bin Selection",
      required: false,
      desc: "Optional granular constraint requiring specific rack bin addresses for line item storage.",
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <ConfigTabsHeader
        title="Stock Settings"
        subtitle="Control transaction execution rules, negative balance constraints, and location requirements."
        icon={Boxes}
      />

      {toast && (
        <div
          className={`flex items-center gap-2 p-3 text-xs font-medium rounded-xl border ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Stock Transaction Rules Form
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Configure transaction guardrails and inventory boundary constraints.
          </p>
        </div>

        {/* Threshold setting */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
          <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
            Default Low Stock Threshold <span className="text-rose-500">*</span>
          </label>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-2">
            Global threshold units triggering replenishment warnings when item-level reorder points are not configured.
          </span>
          <div className="w-48">
            <input
              type="number"
              min="0"
              required
              value={form.default_low_stock_threshold}
              onChange={(e) => setForm({ ...form, default_low_stock_threshold: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Toggles list */}
        <div className="space-y-3 pt-2">
          {toggles.map((t) => (
            <div
              key={t.key}
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {t.label}
                  </span>
                  {t.required ? (
                    <span className="text-rose-500 font-bold">*</span>
                  ) : (
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500">(Optional)</span>
                  )}
                  {t.warn && form[t.key] && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">
                      <AlertTriangle className="h-3 w-3" />
                      Auditor Warning
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">
                  {t.desc}
                </span>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={form[t.key]}
                  onChange={(e) => setForm({ ...form, [t.key]: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving Changes..." : "Save Stock Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default StockSettingsPage;
