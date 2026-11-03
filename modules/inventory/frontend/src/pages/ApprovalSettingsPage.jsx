import React, { useState, useEffect } from "react";
import { ConfigTabsHeader } from "../components/ConfigTabsHeader";
import { fetchGlobalConfig, updateGlobalConfig } from "../services/api";
import { ShieldCheck, Save, CheckCircle2, AlertCircle, Lock, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, SlidersHorizontal, RotateCcw, Scale, ShieldAlert } from "lucide-react";

export function ApprovalSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({
    goods_receipt_approval: false,
    stock_issue_approval: true,
    stock_transfer_approval: true,
    stock_adjustment_approval: true,
    stock_return_approval: true,
    stock_reconciliation_approval: true,
    batch_release_approval: true,
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
          goods_receipt_approval: cfg.goods_receipt_approval ?? false,
          stock_issue_approval: cfg.stock_issue_approval ?? true,
          stock_transfer_approval: cfg.stock_transfer_approval ?? true,
          stock_adjustment_approval: cfg.stock_adjustment_approval ?? true,
          stock_return_approval: cfg.stock_return_approval ?? true,
          stock_reconciliation_approval: cfg.stock_reconciliation_approval ?? true,
          batch_release_approval: cfg.batch_release_approval ?? true,
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
        _section: "Approval Settings",
        changed_by: "Compliance Officer",
      });
      setToast({ type: "success", message: "Approval workflow policies successfully updated." });
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setToast({ type: "error", message: "Failed to save Approval Settings." });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const approvalRules = [
    {
      key: "goods_receipt_approval",
      label: "Goods Receipt Approval",
      icon: ArrowDownLeft,
      desc: "Demands manager verification before incoming vendor goods receipt documents post to on-hand inventory.",
    },
    {
      key: "stock_issue_approval",
      label: "Stock Issue Approval",
      icon: ArrowUpRight,
      desc: "Requires supervisory sign-off before raw materials, components, or finished goods are dispatched.",
    },
    {
      key: "stock_transfer_approval",
      label: "Stock Transfer Approval",
      icon: ArrowLeftRight,
      desc: "Enforces dual authorization between source and destination warehouses on inter-facility shipments.",
    },
    {
      key: "stock_adjustment_approval",
      label: "Stock Adjustment Approval",
      icon: SlidersHorizontal,
      desc: "Demands financial controller or operations lead sign-off on cycle-count gains and losses.",
    },
    {
      key: "stock_return_approval",
      label: "Stock Return Approval",
      icon: RotateCcw,
      desc: "Requires QA disposition inspection and return authorization before restocking returned items.",
    },
    {
      key: "stock_reconciliation_approval",
      label: "Stock Reconciliation Approval",
      icon: Scale,
      desc: "Blocks physical stock variance write-offs until verified by the designated lead auditor.",
    },
    {
      key: "batch_release_approval",
      label: "Batch Release Approval",
      icon: ShieldAlert,
      desc: "Enforces Quality Control release authorization before quarantined or inspected batches can enter active stock.",
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <ConfigTabsHeader
        title="Approval Settings"
        subtitle="Define governance thresholds and multi-step authorization requirements for inventory transactions."
        icon={ShieldCheck}
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
            Operational Approval Matrix
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Configure transaction approval enforcement across all 7 operational workflows.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {approvalRules.map((rule) => {
            const RuleIcon = rule.icon;
            const isChecked = form[rule.key];
            return (
              <div
                key={rule.key}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <div className="flex items-start gap-3 pr-4">
                  <div
                    className={`p-2 rounded-lg border text-xs font-bold ${
                      isChecked
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
                    }`}
                  >
                    <RuleIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {rule.label}
                      </span>
                      <span className="text-rose-500 font-bold">*</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                          isChecked
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                            : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
                        }`}
                      >
                        {isChecked ? "APPROVAL REQUIRED" : "AUTO-POST"}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">
                      {rule.desc}
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => setForm({ ...form, [rule.key]: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving Changes..." : "Save Approval Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ApprovalSettingsPage;

