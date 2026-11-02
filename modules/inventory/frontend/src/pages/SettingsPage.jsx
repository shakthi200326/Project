import React, { useState, useEffect } from "react";
import {
  Settings,
  Save,
  Shield,
  HardDrive,
  Bell,
  Check,
  Cpu,
  Database,
  Sliders,
  RefreshCw,
  Layers,
  Building2,
  MapPin,
  Boxes,
  ArrowLeftRight,
  MinusCircle,
  Hash,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
} from "lucide-react";
import {
  fetchWarehouses,
  fetchWarehouseConfig,
  updateWarehouseConfig,
} from "../services/api";

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("warehouse");

  // Warehouse Configuration State (Requirement 11)
  const [warehouses, setWarehouses] = useState([]);
  const [whConfig, setWhConfig] = useState({
    default_warehouse: "WH-MAIN",
    allow_negative_stock: false,
    require_storage_location: true,
    require_bin_selection: true,
    enable_multiple_warehouses: true,
    allow_inter_warehouse_transfer: true,
    warehouse_code_prefix: "WH",
    location_code_prefix: "LOC",
    rack_code_prefix: "RACK",
    bin_code_prefix: "BIN",
  });

  // General Settings State
  const [horizon, setHorizon] = useState("90");
  const [valuationMethod, setValuationMethod] = useState("WAV");
  const [reorderPolicy, setReorderPolicy] = useState("AUTO_SUGGEST");
  const [storageBackend, setStorageBackend] = useState("minio");
  const [auditLogging, setAuditLogging] = useState(true);
  const [eventBusSync, setEventBusSync] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [whList, configData] = await Promise.all([
        fetchWarehouses(),
        fetchWarehouseConfig(),
      ]);
      setWarehouses(whList || []);
      if (configData) {
        setWhConfig(configData);
      }
    } catch (e) {
      console.error("Failed to load configuration", e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWarehouseConfig(whConfig);
      setSaved(true);
      setToastMessage("Warehouse configuration & operational parameters persisted successfully.");
      setTimeout(() => {
        setSaved(false);
        setToastMessage(null);
      }, 3500);
    } catch (e) {
      console.error(e);
      setToastMessage("Failed to save configuration.");
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900/95 dark:bg-white/95 text-white dark:text-zinc-900 shadow-2xl backdrop-blur-md border border-slate-700/50 dark:border-zinc-200/50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Inventory & Warehouse Settings
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
              System Configuration
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Global warehouse operational constraints, code prefixes, negative stock policies, and valuation accounting rules.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 cursor-pointer transition-all self-start sm:self-auto disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? "Saving..." : "Save Changes"}</span>
        </button>
      </div>

      {/* Settings Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("warehouse")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "warehouse"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Warehouse Operations Configuration</span>
        </button>

        <button
          onClick={() => setActiveTab("system")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "system"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Valuation & Governance</span>
        </button>
      </div>

      {/* Tab 1: Warehouse Configuration (Requirement 11) */}
      {activeTab === "warehouse" && (
        <div className="space-y-6 animate-in fade-in-50 duration-150">
          {/* Operational Controls & Policies */}
          <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Warehouse Operational Controls
                </h2>
                <p className="text-[11px] text-slate-400">
                  Common settings that control multi-facility stock handling, validation rules, and negative balance thresholds.
                </p>
              </div>
            </div>

            {/* Default Warehouse Dropdown */}
            <div className="max-w-md">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300 text-xs mb-1.5">
                Default Warehouse
              </label>
              <select
                value={whConfig.default_warehouse}
                onChange={(e) =>
                  setWhConfig({ ...whConfig, default_warehouse: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                {warehouses.map((wh) => (
                  <option key={wh.code || wh.id} value={wh.code}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
              <span className="block mt-1 text-[11px] text-slate-400">
                Primary warehouse pre-selected on new stock transaction lines and receipts.
              </span>
            </div>

            {/* Operational Toggles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
              {/* Allow Negative Stock */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200/70 dark:border-zinc-800/70 bg-slate-50/60 dark:bg-zinc-800/30">
                <div className="pr-4">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-900 dark:text-white">Allow Negative Stock</span>
                    {whConfig.allow_negative_stock && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Warning
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
                    Allow stock quantity to drop below zero during issue transactions.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setWhConfig({
                      ...whConfig,
                      allow_negative_stock: !whConfig.allow_negative_stock,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    whConfig.allow_negative_stock ? "bg-blue-600" : "bg-slate-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      whConfig.allow_negative_stock ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Require Storage Location */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200/70 dark:border-zinc-800/70 bg-slate-50/60 dark:bg-zinc-800/30">
                <div className="pr-4">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    Require Storage Location
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
                    Require specific storage location selection during stock transactions.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setWhConfig({
                      ...whConfig,
                      require_storage_location: !whConfig.require_storage_location,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    whConfig.require_storage_location ? "bg-blue-600" : "bg-slate-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      whConfig.require_storage_location ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Require Bin Selection */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200/70 dark:border-zinc-800/70 bg-slate-50/60 dark:bg-zinc-800/30">
                <div className="pr-4">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    Require Bin Selection
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
                    Require bin during stock putaway, pick, and movement postings.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setWhConfig({
                      ...whConfig,
                      require_bin_selection: !whConfig.require_bin_selection,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    whConfig.require_bin_selection ? "bg-blue-600" : "bg-slate-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      whConfig.require_bin_selection ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Enable Multiple Warehouses */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200/70 dark:border-zinc-800/70 bg-slate-50/60 dark:bg-zinc-800/30">
                <div className="pr-4">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    Enable Multiple Warehouses
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
                    Allow provisioning and managing multiple warehouse facilities.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setWhConfig({
                      ...whConfig,
                      enable_multiple_warehouses: !whConfig.enable_multiple_warehouses,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    whConfig.enable_multiple_warehouses ? "bg-blue-600" : "bg-slate-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      whConfig.enable_multiple_warehouses ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Allow Inter-Warehouse Transfer */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200/70 dark:border-zinc-800/70 bg-slate-50/60 dark:bg-zinc-800/30 md:col-span-2">
                <div className="pr-4">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    Allow Inter-Warehouse Transfer
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
                    Allow transfers between distinct warehouses with transit reconciliation.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setWhConfig({
                      ...whConfig,
                      allow_inter_warehouse_transfer: !whConfig.allow_inter_warehouse_transfer,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    whConfig.allow_inter_warehouse_transfer ? "bg-blue-600" : "bg-slate-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      whConfig.allow_inter_warehouse_transfer ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Code Generation Prefixes */}
          <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <Hash className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Entity Code Prefixes
                </h2>
                <p className="text-[11px] text-slate-400">
                  Standard naming prefixes used by automatic code generators across warehouse structures.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {/* Warehouse Code Prefix */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Warehouse Code Prefix
                </label>
                <input
                  type="text"
                  value={whConfig.warehouse_code_prefix}
                  onChange={(e) =>
                    setWhConfig({ ...whConfig, warehouse_code_prefix: e.target.value.toUpperCase() })
                  }
                  placeholder="WH"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-mono uppercase"
                />
                <span className="block mt-1 text-[11px] text-slate-400">
                  Example: {whConfig.warehouse_code_prefix || "WH"}-001
                </span>
              </div>

              {/* Location Code Prefix */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Location Code Prefix
                </label>
                <input
                  type="text"
                  value={whConfig.location_code_prefix}
                  onChange={(e) =>
                    setWhConfig({ ...whConfig, location_code_prefix: e.target.value.toUpperCase() })
                  }
                  placeholder="LOC"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-mono uppercase"
                />
                <span className="block mt-1 text-[11px] text-slate-400">
                  Example: {whConfig.location_code_prefix || "LOC"}-001
                </span>
              </div>

              {/* Rack Code Prefix */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Rack Code Prefix
                </label>
                <input
                  type="text"
                  value={whConfig.rack_code_prefix}
                  onChange={(e) =>
                    setWhConfig({ ...whConfig, rack_code_prefix: e.target.value.toUpperCase() })
                  }
                  placeholder="RACK"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-mono uppercase"
                />
                <span className="block mt-1 text-[11px] text-slate-400">
                  Example: {whConfig.rack_code_prefix || "RACK"}-001
                </span>
              </div>

              {/* Bin Code Prefix */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Bin Code Prefix
                </label>
                <input
                  type="text"
                  value={whConfig.bin_code_prefix}
                  onChange={(e) =>
                    setWhConfig({ ...whConfig, bin_code_prefix: e.target.value.toUpperCase() })
                  }
                  placeholder="BIN"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-mono uppercase"
                />
                <span className="block mt-1 text-[11px] text-slate-400">
                  Example: {whConfig.bin_code_prefix || "BIN"}-001
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: System & Accounting Configuration */}
      {activeTab === "system" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in-50 duration-150">
          {/* Costing & Valuation Methodology */}
          <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
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
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
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
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
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
      )}
    </div>
  );
}
