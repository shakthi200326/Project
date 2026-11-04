import React, { useState, useEffect } from "react";
import {
  Settings,
  Warehouse,
  Save,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  GitPullRequest,
  Sliders,
  ShieldAlert,
} from "lucide-react";
import {
  fetchWarehouses,
  fetchWarehouseOperationalConfig,
  updateWarehouseOperationalConfig,
  fetchLocations,
} from "../services/api";

export function WarehouseConfigPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWhId, setSelectedWhId] = useState("");
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form
  const [config, setConfig] = useState({
    receiving_strategy: "PO_DIRECT",
    putaway_strategy: "FIXED_LOCATION",
    picking_strategy: "FIFO",
    dispatch_strategy: "WAVE",
    returns_routing: "INSPECTION_FIRST",
    capacity_enforcement: "SOFT_WARNING",
    allow_cross_docking: false,
    auto_generate_bins: false,
  });

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [whs, locs] = await Promise.all([
          fetchWarehouses(),
          fetchLocations(),
        ]);
        setWarehouses(whs);
        setLocations(locs);
        if (whs.length > 0) {
          const firstId = whs[0].id;
          setSelectedWhId(firstId);
          const currentConfig = await fetchWarehouseOperationalConfig(firstId);
          setConfig(currentConfig);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleWarehouseChange = async (whId) => {
    setSelectedWhId(whId);
    setLoading(true);
    setSaveSuccess(false);
    try {
      const currentConfig = await fetchWarehouseOperationalConfig(whId);
      setConfig(currentConfig);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await updateWarehouseOperationalConfig(selectedWhId, config);
      setConfig(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      alert("Failed to save operational configuration: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              Warehouse Facility Operational Configuration
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200">
              Facility-Specific
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Configure automated intralogistics routing, picking algorithms, cross-docking, and capacity enforcement gates.
          </p>
        </div>

        {/* Facility Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Warehouse className="h-5 w-5 text-slate-400" />
          <select
            value={selectedWhId}
            onChange={(e) => handleWarehouseChange(e.target.value)}
            className="w-full sm:w-64 text-sm font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Warehouse operational configurations saved successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Inbound & Receiving Defaults */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Inbound Receiving & Putaway Policies
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Receiving Flow Strategy
              </label>
              <select
                value={config.receiving_strategy}
                onChange={(e) => setConfig({ ...config, receiving_strategy: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
              >
                <option value="PO_DIRECT">Direct PO Goods Receipt</option>
                <option value="BLIND_RECEIVING">Blind Receiving with Weight Check</option>
                <option value="CROSS_DOCK">Cross-Docking Priority</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Putaway Allocation Strategy
              </label>
              <select
                value={config.putaway_strategy}
                onChange={(e) => setConfig({ ...config, putaway_strategy: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
              >
                <option value="FIXED_LOCATION">Fixed Designated Location</option>
                <option value="DYNAMIC_NEAREST">Dynamic Nearest Available Bay</option>
                <option value="VELOCITY_ABC">ABC Velocity Slotting</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.allow_cross_docking}
                onChange={(e) => setConfig({ ...config, allow_cross_docking: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Enable Inbound Cross-Docking (Bypass Bulk Storage to Staging)
            </label>
          </div>
        </div>

        {/* Section 2: Picking & Outbound Strategies */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Outbound Picking & Dispatch Protocols
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Inventory Rotation & Picking Algorithm
              </label>
              <select
                value={config.picking_strategy}
                onChange={(e) => setConfig({ ...config, picking_strategy: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
              >
                <option value="FIFO">FIFO (First-In, First-Out)</option>
                <option value="FEFO">FEFO (First-Expired, First-Out)</option>
                <option value="LIFO">LIFO (Last-In, First-Out)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Dispatch Staging Strategy
              </label>
              <select
                value={config.dispatch_strategy}
                onChange={(e) => setConfig({ ...config, dispatch_strategy: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
              >
                <option value="WAVE">Wave Staging</option>
                <option value="ZONE_ROUTED">Zone-Routed Consolidation</option>
                <option value="DIRECT_LANE">Direct Vehicle Lane Loading</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Returns & Quality Routing */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Returns & Reverse Logistics Routing
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Inbound Returns Mandatory Route
              </label>
              <select
                value={config.returns_routing}
                onChange={(e) => setConfig({ ...config, returns_routing: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
              >
                <option value="INSPECTION_FIRST">Mandatory QA Inspection Hold</option>
                <option value="QUARANTINE_FIRST">Automatic Quarantine Isolation</option>
                <option value="DIRECT_RESTOCK">Direct Restock (Grade A Items Only)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Capacity Enforcement Level
              </label>
              <select
                value={config.capacity_enforcement}
                onChange={(e) => setConfig({ ...config, capacity_enforcement: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
              >
                <option value="SOFT_WARNING">Soft Warning (Allows Operator Override)</option>
                <option value="STRICT_BLOCK">Strict Block (Hard Stop on Exceeded Max Weight/Volume)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving Facility Config..." : "Save Facility Configuration"}
          </button>
        </div>
      </form>
    </div>
  );
}
export default WarehouseConfigPage;

