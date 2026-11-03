import React, { useState, useEffect } from "react";
import { ConfigTabsHeader } from "../components/ConfigTabsHeader";
import {
  fetchGlobalConfig,
  updateGlobalConfig,
  fetchWarehouses,
  fetchUnits,
} from "../services/api";
import { Settings, Save, CheckCircle2, Building2, Globe, Layers, AlertCircle } from "lucide-react";

export function GeneralSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [units, setUnits] = useState([]);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({
    inventory_module_name: "Enterprise Inventory Management",
    base_currency: "USD",
    default_warehouse: "",
    default_uom: "EA",
    enable_multiple_warehouses: true,
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfg, whs, uomList] = await Promise.all([
        fetchGlobalConfig(),
        fetchWarehouses(),
        fetchUnits(),
      ]);
      if (cfg) {
        setForm({
          inventory_module_name: cfg.inventory_module_name || "Enterprise Inventory Management",
          base_currency: cfg.base_currency || "USD",
          default_warehouse: cfg.default_warehouse || "",
          default_uom: cfg.default_uom || "EA",
          enable_multiple_warehouses: cfg.enable_multiple_warehouses ?? true,
        });
      }
      setWarehouses(whs || []);
      setUnits(uomList || []);
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
        default_warehouse: form.default_warehouse || null,
        _section: "General Settings",
        changed_by: "Operations Admin",
      });
      setToast({ type: "success", message: "General Settings updated and recorded in audit log." });
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setToast({ type: "error", message: "Failed to save General Settings." });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <ConfigTabsHeader
        title="General Settings"
        subtitle="Configure basic inventory preferences and global system defaults."
        icon={Settings}
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
            General Preferences Form
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Set fundamental parameters used across catalog creation and transactions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* 1. Inventory Module Name */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              Inventory Module Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.inventory_module_name}
              onChange={(e) => setForm({ ...form, inventory_module_name: e.target.value })}
              className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              placeholder="e.g. Enterprise Inventory Management"
            />
          </div>

          {/* 2. Base Currency */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              Base Currency <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={form.base_currency}
              onChange={(e) => setForm({ ...form, base_currency: e.target.value })}
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="USD">USD ($) - US Dollar</option>
              <option value="EUR">EUR (€) - Euro</option>
              <option value="GBP">GBP (£) - British Pound</option>
              <option value="CAD">CAD ($) - Canadian Dollar</option>
              <option value="AUD">AUD ($) - Australian Dollar</option>
              <option value="INR">INR (₹) - Indian Rupee</option>
              <option value="JPY">JPY (¥) - Japanese Yen</option>
              <option value="SGD">SGD ($) - Singapore Dollar</option>
              <option value="CHF">CHF (Fr) - Swiss Franc</option>
            </select>
          </div>

          {/* 3. Default Unit of Measure */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              Default Unit of Measure <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={form.default_uom}
              onChange={(e) => setForm({ ...form, default_uom: e.target.value })}
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="EA">EA - Each / Unit</option>
              <option value="PCS">PCS - Pieces</option>
              <option value="BOX">BOX - Box Container</option>
              <option value="KG">KG - Kilogram</option>
              <option value="MTR">MTR - Meter</option>
              <option value="LTR">LTR - Liter</option>
              {units.map((u) => (
                <option key={u.id || u.code} value={u.code}>
                  {u.code} – {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Default Warehouse */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              Default Warehouse <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <select
              value={form.default_warehouse || ""}
              onChange={(e) => setForm({ ...form, default_warehouse: e.target.value })}
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">No Default (Prompt for Warehouse)</option>
              {warehouses.map((w) => (
                <option key={w.id || w.code} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          {/* 5. Enable Multiple Warehouses */}
          <div className="md:col-span-2 flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Enable Multiple Warehouses <span className="text-rose-500">*</span>
              </span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">
                Permits multi-facility operations, inter-warehouse transfer orders, and multi-location balances.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.enable_multiple_warehouses}
                onChange={(e) => setForm({ ...form, enable_multiple_warehouses: e.target.checked })}
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
            {saving ? "Saving Changes..." : "Save General Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default GeneralSettingsPage;

