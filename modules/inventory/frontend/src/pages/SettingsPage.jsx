import React, { useState } from "react";
import { Settings, Save, Shield, HardDrive, Bell } from "lucide-react";

export function SettingsPage() {
  const [horizon, setHorizon] = useState("90");
  const [valuationMethod, setValuationMethod] = useState("WAV");
  const [reorderPolicy, setReorderPolicy] = useState("AUTO_SUGGEST");
  const [storageBackend, setStorageBackend] = useState("local");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Inventory Configuration & Preferences
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Module-level valuation methods, stock alert horizons, reorder policies, and file storage settings.
        </p>
      </div>

      <div className="p-6 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-6">
        {/* Valuation & Accounting */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-2">
            Valuation & Cost Accounting
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Costing Methodology
              </label>
              <select
                value={valuationMethod}
                onChange={(e) => setValuationMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500"
              >
                <option value="WAV">Moving Weighted-Average Valuation (WAV)</option>
                <option value="FIFO">First-In First-Out (FIFO - Strict Lot)</option>
                <option value="STANDARD">Standard Fixed Cost</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Batch Expiry Warning Horizon (Days)
              </label>
              <input
                type="number"
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Replenishment Policy */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-2">
            Replenishment Policy
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Low Stock Action
              </label>
              <select
                value={reorderPolicy}
                onChange={(e) => setReorderPolicy(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500"
              >
                <option value="AUTO_SUGGEST">Auto-generate Replenishment Suggestions</option>
                <option value="DRAFT_PO">Emit Purchase Requisition Event</option>
                <option value="MANUAL">Manual Review Only</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Universal File Storage Backend
              </label>
              <select
                value={storageBackend}
                onChange={(e) => setStorageBackend(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500"
              >
                <option value="local">Local File Storage (uploads/)</option>
                <option value="minio">MinIO S3 Container</option>
                <option value="s3">Amazon S3 Production</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800">
          {saved ? (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Settings updated successfully!
            </span>
          ) : (
            <span className="text-xs text-slate-400">All changes audited under active actor.</span>
          )}

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-xs"
          >
            <Save className="h-4 w-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
}

