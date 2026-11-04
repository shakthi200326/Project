import React, { useState, useEffect } from "react";
import { ConfigTabsHeader } from "../components/ConfigTabsHeader";
import { fetchGlobalConfig, updateGlobalConfig } from "../services/api";
import { DollarSign, Save, CheckCircle2, AlertCircle, ShieldAlert, Coins, HelpCircle } from "lucide-react";

export function ValuationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({
    valuation_method: "Weighted Average",
    cost_precision: 2,
    include_additional_costs: false,
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
          valuation_method: cfg.valuation_method || "Weighted Average",
          cost_precision: Number(cfg.cost_precision) || 2,
          include_additional_costs: cfg.include_additional_costs ?? false,
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
        cost_precision: Number(form.cost_precision),
        _section: "Valuation Settings",
        changed_by: "Financial Controller",
      });
      setToast({ type: "success", message: "Valuation Settings saved. Historical transactions remain immutable." });
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setToast({ type: "error", message: "Failed to save Valuation Settings." });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <ConfigTabsHeader
        title="Valuation Settings"
        subtitle="Configure inventory costing methodology, decimal precision, and landed cost treatments."
        icon={DollarSign}
      />

      {/* Audit & Accounting Integrity Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 text-xs">
        <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-semibold block">Accounting Integrity Rule</strong>
          <p className="text-slate-600 dark:text-zinc-300 leading-relaxed">
            Valuation method modifications apply forward to future inventory receipts and issues. In accordance with audit standards, system balances do not silently rewrite historical ledger unit values.
          </p>
        </div>
      </div>

      {toast && (
        <div
          className={`flex items-center gap-2 p-3 text-xs font-medium rounded-xl border ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Valuation Rules Form
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Configure how inventory financial worth is computed across financial statements.
          </p>
        </div>

        <div className="space-y-5 pt-2">
          {/* 1. Valuation Method */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              Valuation Method <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={form.valuation_method}
              onChange={(e) => setForm({ ...form, valuation_method: e.target.value })}
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="FIFO">FIFO (First-In, First-Out)</option>
              <option value="Weighted Average">Weighted Average (WAV)</option>
              <option value="Standard Cost">Standard Cost</option>
            </select>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
              Select between First-In First-Out, Moving Weighted Average, or predetermined Standard Costing.
            </p>
          </div>

          {/* 2. Cost Precision */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              Cost Precision (Decimal Places) <span className="text-rose-500">*</span>
            </label>
            <div className="w-48">
              <input
                type="number"
                min="0"
                max="6"
                required
                value={form.cost_precision}
                onChange={(e) => setForm({ ...form, cost_precision: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
              Number of fractional decimal places recorded on unit costs (typically 2 for retail or 4 for precision manufacturing).
            </p>
          </div>

          {/* 3. Include Additional Costs */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Include Additional Costs <span className="text-slate-400 font-normal">(Optional)</span>
              </span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">
                Automatically allocate freight, customs duties, insurance, and handling charges into inventory unit valuation.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={form.include_additional_costs}
                onChange={(e) => setForm({ ...form, include_additional_costs: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving Changes..." : "Save Valuation Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ValuationSettingsPage;

