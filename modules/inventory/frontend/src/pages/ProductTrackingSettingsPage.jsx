import React, { useState, useEffect } from "react";
import { ConfigTabsHeader } from "../components/ConfigTabsHeader";
import { fetchGlobalConfig, updateGlobalConfig } from "../services/api";
import { Cpu, Save, CheckCircle2, AlertCircle, Info, Hash, Barcode, Calendar, ShieldCheck } from "lucide-react";

export function ProductTrackingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({
    enable_batch_tracking: true,
    enable_serial_tracking: true,
    enable_expiry_tracking: true,
    enable_barcode_tracking: true,
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
          enable_batch_tracking: cfg.enable_batch_tracking ?? true,
          enable_serial_tracking: cfg.enable_serial_tracking ?? true,
          enable_expiry_tracking: cfg.enable_expiry_tracking ?? true,
          enable_barcode_tracking: cfg.enable_barcode_tracking ?? true,
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
        _section: "Product Tracking Settings",
        changed_by: "Operations Admin",
      });
      setToast({ type: "success", message: "Product Tracking Settings successfully saved to global engine." });
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setToast({ type: "error", message: "Failed to save Tracking Settings." });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const trackingFeatures = [
    {
      key: "enable_batch_tracking",
      label: "Enable Batch Tracking",
      icon: Hash,
      desc: "Activates batch and lot number grouping, quarantine statuses, inspection gates, and batch movement tracking.",
    },
    {
      key: "enable_serial_tracking",
      label: "Enable Serial Tracking",
      icon: Cpu,
      desc: "Activates individual unit-level serial number registries, warranty histories, and lifecycle commissioning.",
    },
    {
      key: "enable_expiry_tracking",
      label: "Enable Expiry Tracking",
      icon: Calendar,
      desc: "Activates shelf-life tracking, FEFO dispatch prioritization, and early expiry notifications.",
    },
    {
      key: "enable_barcode_tracking",
      label: "Enable Barcode Tracking",
      icon: Barcode,
      desc: "Enables hardware and camera barcode scanning, GS1-128 parsing, and thermal label generation.",
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <ConfigTabsHeader
        title="Product Tracking Settings"
        subtitle="Manage global traceability features across batches, serials, shelf-life expiry, and barcodes."
        icon={Cpu}
      />

      {/* Critical Rule Callout */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 text-xs">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-semibold block">Global Capability Switch & Hierarchy Rule</strong>
          <p className="text-slate-600 dark:text-zinc-300 leading-relaxed">
            These settings enable tracking capabilities globally across the module. Individual products determine whether batch, serial, or expiry tracking is specifically mandated based on their catalog item definition.
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
          {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Traceability Features Form
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Turn modules on or off across the enterprise. All 4 tracking toggles are required to be explicitly configured.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {trackingFeatures.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div
                key={item.key}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <div className="flex items-start gap-3 pr-4">
                  <div className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 mt-0.5">
                    <ItemIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {item.label}
                      </span>
                      <span className="text-rose-500 font-bold">*</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">
                      {item.desc}
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={form[item.key]}
                    onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
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
            {saving ? "Saving Changes..." : "Save Product Tracking Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProductTrackingSettingsPage;

