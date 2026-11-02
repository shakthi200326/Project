import React, { useState } from "react";
import { Settings, Save, Shield, HardDrive, Bell, Check, Cpu, Database, Sliders, RefreshCw, Layers } from "lucide-react";

export function SettingsPage() {
  const [horizon, setHorizon] = useState("90");
  const [valuationMethod, setValuationMethod] = useState("WAV");
  const [reorderPolicy, setReorderPolicy] = useState("AUTO_SUGGEST");
  const [storageBackend, setStorageBackend] = useState("minio");
  const [auditLogging, setAuditLogging] = useState(true);
  const [eventBusSync, setEventBusSync] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toast Notification */}
      {saved && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900/95 dark:bg-white/95 text-white dark:text-zinc-900 shadow-2xl backdrop-blur-md border border-slate-700/50 dark:border-zinc-200/50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold">Settings persisted and synchronized across runtime nodes</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Inventory Configuration & Architecture
            </h1>
           
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Global valuation policies, stock alert horizons, replenishment triggers, and pluggable storage backends.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 cursor-pointer transition-all self-start sm:self-auto"
        >
          <Save className="h-4 w-4" />
          <span>Save Changes</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Costing & Valuation Methodology */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800/80 pb-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Valuation & Cost Accounting
              </h2>
              <p className="text-[11px] text-slate-400">Inventory balance cost computation basis</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Costing Methodology
              </label>
              <select
                value={valuationMethod}
                onChange={(e) => setValuationMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              >
                <option value="WAV">Moving Weighted-Average Valuation (WAV - Recommended)</option>
                <option value="FIFO">First-In First-Out (FIFO - Strict Lot Consumption)</option>
                <option value="STANDARD">Standard Fixed Accounting Cost</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Batch Expiry Warning Horizon (Days)
              </label>
              <input
                type="number"
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all tabular-nums font-medium"
              />
              <span className="block mt-1 text-[11px] text-slate-400">
                Batches expiring within {horizon} days flag FEFO alerts on the movement console.
              </span>
            </div>
          </div>
        </div>

        {/* Replenishment Policy */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800/80 pb-3">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Replenishment & Procurement Policy
              </h2>
              <p className="text-[11px] text-slate-400">Reorder trigger behavior when below safety stock</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Low Stock Response Strategy
              </label>
              <select
                value={reorderPolicy}
                onChange={(e) => setReorderPolicy(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              >
                <option value="AUTO_SUGGEST">Auto-generate Replenishment Suggestions in Queue</option>
                <option value="DRAFT_PO">Publish Purchase Requisition Event (`stock.low` bus)</option>
                <option value="MANUAL">Manual Review Only (Strict Warehouse Control)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Universal File Storage Backend
              </label>
              <select
                value={storageBackend}
                onChange={(e) => setStorageBackend(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              >
                <option value="minio">MinIO S3 Pluggable Container (Standard)</option>
                <option value="local">Local Filesystem Storage (uploads/)</option>
                <option value="s3">Amazon S3 Enterprise Cluster</option>
              </select>
              <span className="block mt-1 text-[11px] text-slate-400">
                Shared backend provider abstraction defined in <code className="text-blue-500 font-mono">shared/backend/file-storage</code>
              </span>
            </div>
          </div>
        </div>

        {/* Enterprise Governance & Telemetry */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-4 md:col-span-2">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800/80 pb-3">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Enterprise Governance, Event Bus & Audit
              </h2>
              <p className="text-[11px] text-slate-400">Compliance logging and asynchronous event streaming</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200/60 dark:border-zinc-800/60 bg-slate-50/50 dark:bg-zinc-800/30">
              <div className="pr-4">
                <span className="font-semibold text-slate-900 dark:text-white block">Immutable Audit Log Capture</span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
                  Record all stock adjustments, reconciliation overrides, and transfers with cryptographic hashes.
                </span>
              </div>
              <input
                type="checkbox"
                checked={auditLogging}
                onChange={(e) => setAuditLogging(e.target.checked)}
                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 mt-1 cursor-pointer"
              />
            </div>

            <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200/60 dark:border-zinc-800/60 bg-slate-50/50 dark:bg-zinc-800/30">
              <div className="pr-4">
                <span className="font-semibold text-slate-900 dark:text-white block">Event Bus Outbox Synchronization</span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
                  Broadcast Redis / Celery event payloads for future Sales and Purchase module consumers.
                </span>
              </div>
              <input
                type="checkbox"
                checked={eventBusSync}
                onChange={(e) => setEventBusSync(e.target.checked)}
                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 mt-1 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
