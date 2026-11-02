import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Layers,
  Boxes,
  Plus,
  Search,
  Building2,
  MapPin,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  RefreshCw,
  Sparkles,
  Barcode,
  Copy,
  Check,
  Ban,
  ShieldCheck,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight,
  Split,
  Eye,
} from "lucide-react";
import {
  fetchRacks,
  createRack,
  updateRack,
  deleteRack,
  fetchBins,
  createBin,
  updateBin,
  deleteBin,
  fetchWarehouses,
  fetchLocations,
  fetchWarehouseConfig,
} from "../services/api";

const STATUS_OPTIONS = ["Active", "Inactive", "Blocked"];

export function RackBinPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "bins" ? "bins" : "racks"
  );

  const [racks, setRacks] = useState([]);
  const [bins, setBins] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Configuration prefixes
  const [rackPrefix, setRackPrefix] = useState("RACK");
  const [binPrefix, setBinPrefix] = useState("BIN");

  // Filters
  const [search, setSearch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState(
    searchParams.get("warehouse") || "ALL"
  );
  const [selectedLocation, setSelectedLocation] = useState(
    searchParams.get("location") || "ALL"
  );
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Modals
  const [isRackModalOpen, setIsRackModalOpen] = useState(false);
  const [editingRack, setEditingRack] = useState(null);
  const [rackSubmitting, setRackSubmitting] = useState(false);
  const [rackFormData, setRackFormData] = useState({
    code: "",
    name: "",
    warehouse: "WH-MAIN",
    warehouse_id: "",
    location: "",
    location_id: "",
    number_of_levels: 4,
    status: "Active",
  });

  const [isBinModalOpen, setIsBinModalOpen] = useState(false);
  const [editingBin, setEditingBin] = useState(null);
  const [binSubmitting, setBinSubmitting] = useState(false);
  const [binFormData, setBinFormData] = useState({
    code: "",
    name: "",
    warehouse: "WH-MAIN",
    warehouse_id: "",
    location: "",
    location_id: "",
    rack: "",
    rack_id: "",
    rack_level: 1,
    barcode: "",
    status: "Active",
  });

  // Barcode Inspection Modal
  const [barcodePreviewItem, setBarcodePreviewItem] = useState(null);

  useEffect(() => {
    loadAllData();
    fetchWarehouseConfig().then((cfg) => {
      if (cfg?.rack_code_prefix) setRackPrefix(cfg.rack_code_prefix);
      if (cfg?.bin_code_prefix) setBinPrefix(cfg.bin_code_prefix);
    });
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [racksData, binsData, whData, locData] = await Promise.all([
        fetchRacks(),
        fetchBins(),
        fetchWarehouses(),
        fetchLocations(),
      ]);
      setRacks(racksData || []);
      setBins(binsData || []);
      setWarehouses(whData || []);
      setLocations(locData || []);
    } catch (e) {
      console.error("Failed to load racks & bins data", e);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
    showToast(`Copied barcode "${text}" to clipboard.`);
  };

  // Auto-generation helpers
  const generateRackCode = () => {
    const num = Math.floor(100 + Math.random() * 900);
    return `${rackPrefix}-${num}`;
  };

  const generateBinCode = () => {
    const num = Math.floor(100 + Math.random() * 900);
    return `${binPrefix}-${num}`;
  };

  const generateBinBarcode = (code) => {
    const seed = Math.floor(1000 + Math.random() * 9000);
    return `${code || "BIN"}-${seed}`;
  };

  // Open Rack Modal
  const handleOpenCreateRackModal = () => {
    setEditingRack(null);
    const defaultWh =
      selectedWarehouse !== "ALL"
        ? selectedWarehouse
        : warehouses[0]?.code || "WH-MAIN";
    const whObj = warehouses.find((w) => w.code === defaultWh) || warehouses[0];
    const availableLocs = locations.filter(
      (l) => (l.warehouse_code || l.warehouse) === defaultWh
    );
    const defaultLoc = availableLocs[0]?.code || "";

    setRackFormData({
      code: generateRackCode(),
      name: "",
      warehouse: defaultWh,
      warehouse_id: whObj?.id || 1,
      location: defaultLoc,
      location_id: availableLocs[0]?.id || "",
      number_of_levels: 4,
      status: "Active",
    });
    setIsRackModalOpen(true);
  };

  const handleOpenEditRackModal = (r) => {
    setEditingRack(r);
    const whObj = warehouses.find(
      (w) => w.code === r.warehouse || w.code === r.warehouse_code
    ) || warehouses[0];
    const locObj = locations.find(
      (l) => l.code === r.location || l.code === r.location_code
    );

    setRackFormData({
      code: r.code,
      name: r.name,
      warehouse: r.warehouse_code || r.warehouse || whObj?.code || "WH-MAIN",
      warehouse_id: whObj?.id || 1,
      location: r.location_code || r.location || locObj?.code || "",
      location_id: locObj?.id || "",
      number_of_levels: r.number_of_levels || 4,
      status: r.status || "Active",
    });
    setIsRackModalOpen(true);
  };

  // Open Bin Modal
  const handleOpenCreateBinModal = () => {
    setEditingBin(null);
    const defaultWh =
      selectedWarehouse !== "ALL"
        ? selectedWarehouse
        : warehouses[0]?.code || "WH-MAIN";
    const whObj = warehouses.find((w) => w.code === defaultWh) || warehouses[0];
    const availableLocs = locations.filter(
      (l) => (l.warehouse_code || l.warehouse) === defaultWh
    );
    const defaultLoc = availableLocs[0]?.code || "";
    const availableRacks = racks.filter(
      (r) =>
        (r.warehouse_code || r.warehouse) === defaultWh &&
        (!defaultLoc || (r.location_code || r.location) === defaultLoc)
    );
    const defaultRack = availableRacks[0]?.code || "";
    const binCode = generateBinCode();

    setBinFormData({
      code: binCode,
      name: "",
      warehouse: defaultWh,
      warehouse_id: whObj?.id || 1,
      location: defaultLoc,
      location_id: availableLocs[0]?.id || "",
      rack: defaultRack,
      rack_id: availableRacks[0]?.id || "",
      rack_level: 1,
      barcode: generateBinBarcode(binCode),
      status: "Active",
    });
    setIsBinModalOpen(true);
  };

  const handleOpenEditBinModal = (b) => {
    setEditingBin(b);
    const whObj = warehouses.find(
      (w) => w.code === b.warehouse || w.code === b.warehouse_code
    ) || warehouses[0];
    const locObj = locations.find(
      (l) => l.code === b.location || l.code === b.location_code
    );
    const rackObj = racks.find(
      (r) => r.code === b.rack || r.code === b.rack_code
    );

    setBinFormData({
      code: b.code,
      name: b.name,
      warehouse: b.warehouse_code || b.warehouse || whObj?.code || "WH-MAIN",
      warehouse_id: whObj?.id || 1,
      location: b.location_code || b.location || locObj?.code || "",
      location_id: locObj?.id || "",
      rack: b.rack_code || b.rack || rackObj?.code || "",
      rack_id: rackObj?.id || "",
      rack_level: b.rack_level || 1,
      barcode: b.barcode || "",
      status: b.status || "Active",
    });
    setIsBinModalOpen(true);
  };

  // Submit Rack Form
  const handleSubmitRack = async (e) => {
    e.preventDefault();
    if (!rackFormData.code.trim()) {
      showToast("Rack Code is required.");
      return;
    }
    if (!rackFormData.name.trim()) {
      showToast("Rack Name is required.");
      return;
    }
    if (!rackFormData.warehouse) {
      showToast("Warehouse is required.");
      return;
    }
    if (!rackFormData.location) {
      showToast("Storage Location is required.");
      return;
    }
    if (!rackFormData.number_of_levels || rackFormData.number_of_levels < 1) {
      showToast("Number of Levels must be at least 1.");
      return;
    }

    setRackSubmitting(true);
    try {
      const whObj = warehouses.find(
        (w) => w.code === rackFormData.warehouse || w.id === rackFormData.warehouse
      ) || warehouses[0];
      const locObj = locations.find(
        (l) => l.code === rackFormData.location || l.id === rackFormData.location
      );

      const payload = {
        ...rackFormData,
        warehouse: whObj?.id || 1,
        warehouse_id: whObj?.id || 1,
        warehouse_code: whObj?.code || rackFormData.warehouse,
        warehouse_name: whObj?.name || "Facility",
        location: locObj?.id || null,
        location_id: locObj?.id || null,
        location_code: locObj?.code || rackFormData.location,
        location_name: locObj?.name || "Location",
      };

      if (editingRack) {
        const updated = await updateRack(editingRack.id, payload);
        setRacks((prev) =>
          prev.map((item) =>
            item.id === editingRack.id ? { ...item, ...updated } : item
          )
        );
        showToast(`Rack "${payload.code}" updated successfully.`);
      } else {
        const created = await createRack(payload);
        setRacks((prev) => [created, ...prev]);
        showToast(`Rack "${created.code}" created successfully.`);
      }
      setIsRackModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Operation failed. Please verify rack parameters.");
    } finally {
      setRackSubmitting(false);
    }
  };

  // Submit Bin Form
  const handleSubmitBin = async (e) => {
    e.preventDefault();
    if (!binFormData.code.trim()) {
      showToast("Bin Code is required.");
      return;
    }
    if (!binFormData.name.trim()) {
      showToast("Bin Name is required.");
      return;
    }
    if (!binFormData.warehouse) {
      showToast("Warehouse is required.");
      return;
    }
    if (!binFormData.location) {
      showToast("Storage Location is required.");
      return;
    }
    if (!binFormData.rack) {
      showToast("Rack selection is required.");
      return;
    }
    if (!binFormData.rack_level) {
      showToast("Rack Level is required.");
      return;
    }

    setBinSubmitting(true);
    try {
      const whObj = warehouses.find(
        (w) => w.code === binFormData.warehouse || w.id === binFormData.warehouse
      ) || warehouses[0];
      const locObj = locations.find(
        (l) => l.code === binFormData.location || l.id === binFormData.location
      );
      const rackObj = racks.find(
        (r) => r.code === binFormData.rack || r.id === binFormData.rack
      );

      const payload = {
        ...binFormData,
        warehouse: whObj?.id || 1,
        warehouse_id: whObj?.id || 1,
        warehouse_code: whObj?.code || binFormData.warehouse,
        warehouse_name: whObj?.name || "Facility",
        location: locObj?.id || null,
        location_id: locObj?.id || null,
        location_code: locObj?.code || binFormData.location,
        location_name: locObj?.name || "Location",
        rack: rackObj?.id || null,
        rack_id: rackObj?.id || null,
        rack_code: rackObj?.code || binFormData.rack,
        rack_name: rackObj?.name || "Rack",
      };

      if (editingBin) {
        const updated = await updateBin(editingBin.id, payload);
        setBins((prev) =>
          prev.map((item) =>
            item.id === editingBin.id ? { ...item, ...updated } : item
          )
        );
        showToast(`Bin "${payload.code}" updated successfully.`);
      } else {
        const created = await createBin(payload);
        setBins((prev) => [created, ...prev]);
        showToast(`Bin "${created.code}" created successfully.`);
      }
      setIsBinModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Operation failed. Please verify bin parameters.");
    } finally {
      setBinSubmitting(false);
    }
  };

  // Delete handlers
  const handleDeleteRack = async (id, code) => {
    if (window.confirm(`Are you sure you want to delete rack "${code}"?`)) {
      try {
        await deleteRack(id);
        setRacks((prev) => prev.filter((r) => r.id !== id));
        showToast(`Rack "${code}" deleted.`);
      } catch (e) {
        showToast("Failed to delete rack.");
      }
    }
  };

  const handleDeleteBin = async (id, code) => {
    if (window.confirm(`Are you sure you want to delete bin "${code}"?`)) {
      try {
        await deleteBin(id);
        setBins((prev) => prev.filter((b) => b.id !== id));
        showToast(`Bin "${code}" deleted.`);
      } catch (e) {
        showToast("Failed to delete bin.");
      }
    }
  };

  // Filtered lists
  const filteredRacks = racks.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      r.code?.toLowerCase().includes(q) ||
      r.name?.toLowerCase().includes(q) ||
      (r.location_code || r.location || "").toLowerCase().includes(q) ||
      (r.warehouse_code || r.warehouse || "").toLowerCase().includes(q);

    const rWh = r.warehouse_code || r.warehouse;
    const matchesWarehouse =
      selectedWarehouse === "ALL" || rWh === selectedWarehouse;

    const rLoc = r.location_code || r.location;
    const matchesLocation =
      selectedLocation === "ALL" || rLoc === selectedLocation;

    const matchesStatus =
      selectedStatus === "ALL" ||
      (r.status || "Active").toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesWarehouse && matchesLocation && matchesStatus;
  });

  const filteredBins = bins.filter((b) => {
    const q = search.toLowerCase();
    const matchesSearch =
      b.code?.toLowerCase().includes(q) ||
      b.name?.toLowerCase().includes(q) ||
      b.barcode?.toLowerCase().includes(q) ||
      (b.rack_code || b.rack || "").toLowerCase().includes(q) ||
      (b.location_code || b.location || "").toLowerCase().includes(q) ||
      (b.warehouse_code || b.warehouse || "").toLowerCase().includes(q);

    const bWh = b.warehouse_code || b.warehouse;
    const matchesWarehouse =
      selectedWarehouse === "ALL" || bWh === selectedWarehouse;

    const bLoc = b.location_code || b.location;
    const matchesLocation =
      selectedLocation === "ALL" || bLoc === selectedLocation;

    const matchesStatus =
      selectedStatus === "ALL" ||
      (b.status || "Active").toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesWarehouse && matchesLocation && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const s = status || "Active";
    if (s.toLowerCase() === "active") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      );
    }
    if (s.toLowerCase() === "blocked") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
          <Ban className="h-2.5 w-2.5 text-rose-500" />
          Blocked
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Inactive
      </span>
    );
  };

  // Filter locations available for the chosen warehouse in modals
  const rackModalLocations = locations.filter(
    (l) => (l.warehouse_code || l.warehouse) === rackFormData.warehouse
  );

  const binModalLocations = locations.filter(
    (l) => (l.warehouse_code || l.warehouse) === binFormData.warehouse
  );

  const binModalRacks = racks.filter(
    (r) =>
      (r.warehouse_code || r.warehouse) === binFormData.warehouse &&
      (!binFormData.location || (r.location_code || r.location) === binFormData.location)
  );

  const selectedBinRackObj = racks.find(
    (r) => r.code === binFormData.rack || r.id === binFormData.rack_id
  );
  const maxLevelsForSelectedRack = selectedBinRackObj?.number_of_levels || 5;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 dark:bg-zinc-800 text-white text-xs font-medium shadow-xl border border-slate-700 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Rack & Bin Management
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
              {racks.length} Racks • {bins.length} Bins
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Manage granular physical storage hierarchy: high-density multi-level racks and item-level pick/put bins with auto-generated barcodes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAllData}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Refresh Registry"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {activeTab === "racks" ? (
            <button
              onClick={handleOpenCreateRackModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 cursor-pointer transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Create Rack</span>
            </button>
          ) : (
            <button
              onClick={handleOpenCreateBinModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 cursor-pointer transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Create Bin</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total Racks</span>
            <Layers className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white">
            {racks.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            Across {warehouses.length} facilities
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Registered Bins</span>
            <Boxes className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-indigo-600 dark:text-indigo-400">
            {bins.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            Discrete picking addresses
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Active Storage Units</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
            {racks.filter((r) => (r.status || "Active").toLowerCase() === "active").length +
             bins.filter((b) => (b.status || "Active").toLowerCase() === "active").length}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Available for replenishment
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Blocked / Hold</span>
            <Ban className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-rose-600 dark:text-rose-400">
            {racks.filter((r) => (r.status || "").toLowerCase() === "blocked").length +
             bins.filter((b) => (b.status || "").toLowerCase() === "blocked").length}
          </div>
          <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
            Restricted quarantine cells
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("racks")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "racks"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Rack Management</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === "racks"
                ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
            }`}>
              {racks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("bins")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "bins"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>Bin Management</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === "bins"
                ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
            }`}>
              {bins.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === "racks"
                ? "Search racks by code, name, location..."
                : "Search bins by code, name, barcode, rack..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Warehouse Filter */}
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.code || wh.id} value={wh.code}>
                {wh.name} ({wh.code})
              </option>
            ))}
          </select>

          {/* Storage Location Filter */}
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.code || loc.id} value={loc.code}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab 1: Racks Table */}
      {activeTab === "racks" && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Rack Code</th>
                  <th className="py-3 px-4">Rack Name</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">Storage Location</th>
                  <th className="py-3 px-4">Number of Levels</th>
                  <th className="py-3 px-4">Associated Bins</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {filteredRacks.map((r) => {
                  const whCode = r.warehouse_code || r.warehouse;
                  const locCode = r.location_code || r.location;
                  const assignedBins = bins.filter(
                    (b) => (b.rack_code || b.rack) === r.code
                  );

                  return (
                    <tr
                      key={r.id || r.code}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900/40">
                          {r.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {r.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{whCode}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{locCode || "—"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                            {r.number_of_levels}
                          </span>
                          <span className="text-[10px] text-slate-400">Levels</span>
                          <div className="flex items-center gap-0.5 ml-2">
                            {Array.from({ length: Math.min(r.number_of_levels || 4, 8) }).map((_, idx) => (
                              <div
                                key={idx}
                                className="h-3 w-1.5 rounded-xs bg-indigo-500/60 dark:bg-indigo-400/60"
                                title={`Level ${idx + 1}`}
                              />
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-semibold text-slate-700 dark:text-zinc-300">
                          {assignedBins.length} Bins
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(r.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditRackModal(r)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                            title="Edit rack"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRack(r.id, r.code)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete rack"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredRacks.length === 0 && (
              <div className="text-center py-12 p-8">
                <Layers className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">No racks found</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Try adjusting your filters or click "+ Create Rack".</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Bins Table */}
      {activeTab === "bins" && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Bin Code</th>
                  <th className="py-3 px-4">Bin Name</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">Storage Location</th>
                  <th className="py-3 px-4">Rack</th>
                  <th className="py-3 px-4">Rack Level</th>
                  <th className="py-3 px-4">Barcode</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {filteredBins.map((b) => {
                  const whCode = b.warehouse_code || b.warehouse;
                  const locCode = b.location_code || b.location;
                  const rackCode = b.rack_code || b.rack;

                  return (
                    <tr
                      key={b.id || b.code}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900/40">
                          {b.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {b.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{whCode}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{locCode || "—"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-900/40">
                          {rackCode || "—"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                          Lvl {b.rack_level || 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {b.barcode ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                              {b.barcode}
                            </span>
                            <button
                              onClick={() => copyToClipboard(b.barcode)}
                              className="p-1 rounded text-slate-400 hover:text-blue-600 cursor-pointer"
                              title="Copy barcode"
                            >
                              {copiedCode === b.barcode ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => setBarcodePreviewItem(b)}
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 cursor-pointer"
                              title="Scan / Preview Barcode"
                            >
                              <Barcode className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(b.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditBinModal(b)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                            title="Edit bin"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBin(b.id, b.code)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete bin"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredBins.length === 0 && (
              <div className="text-center py-12 p-8">
                <Boxes className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">No bins found</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Try adjusting your filters or click "+ Create Bin".</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Rack Modal */}
      {isRackModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {editingRack ? "Edit Rack Parameters" : "Create Rack"}
                </h3>
              </div>
              <button
                onClick={() => setIsRackModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRack} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Rack Code (Auto-generated, Required) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-zinc-300">
                      Rack Code *
                    </label>
                    <button
                      type="button"
                      onClick={() => setRackFormData({ ...rackFormData, code: generateRackCode() })}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" /> Auto-generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={rackFormData.code}
                    onChange={(e) => setRackFormData({ ...rackFormData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. RACK-001"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono uppercase"
                  />
                </div>

                {/* Rack Name (Text, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Rack Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={rackFormData.name}
                    onChange={(e) => setRackFormData({ ...rackFormData, name: e.target.value })}
                    placeholder="e.g. Aisle 1 Heavy Pallet Rack"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Warehouse (Dropdown, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse *
                  </label>
                  <select
                    required
                    value={rackFormData.warehouse}
                    onChange={(e) => {
                      const newWh = e.target.value;
                      const validLocs = locations.filter(
                        (l) => (l.warehouse_code || l.warehouse) === newWh
                      );
                      setRackFormData({
                        ...rackFormData,
                        warehouse: newWh,
                        location: validLocs[0]?.code || "",
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.code || wh.id} value={wh.code}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Storage Location (Dropdown, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Storage Location *
                  </label>
                  <select
                    required
                    value={rackFormData.location}
                    onChange={(e) => setRackFormData({ ...rackFormData, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">Select Location...</option>
                    {rackModalLocations.map((loc) => (
                      <option key={loc.code || loc.id} value={loc.code}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Number of Levels (Number, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Number of Levels *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={rackFormData.number_of_levels}
                    onChange={(e) =>
                      setRackFormData({
                        ...rackFormData,
                        number_of_levels: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                  />
                  <span className="block mt-1 text-[11px] text-slate-400">
                    Defines available vertical tiers (1 to 20).
                  </span>
                </div>

                {/* Status (Active / Inactive / Blocked, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Status *
                  </label>
                  <select
                    required
                    value={rackFormData.status}
                    onChange={(e) => setRackFormData({ ...rackFormData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsRackModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rackSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {rackSubmitting ? "Saving..." : editingRack ? "Save Changes" : "Create Rack"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Bin Modal */}
      {isBinModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {editingBin ? "Edit Bin Parameters" : "Create Bin"}
                </h3>
              </div>
              <button
                onClick={() => setIsBinModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBin} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bin Code (Auto-generated, Required) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-zinc-300">
                      Bin Code *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const newCode = generateBinCode();
                        setBinFormData({
                          ...binFormData,
                          code: newCode,
                          barcode: generateBinBarcode(newCode),
                        });
                      }}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" /> Auto-generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={binFormData.code}
                    onChange={(e) => setBinFormData({ ...binFormData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. BIN-001"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono uppercase"
                  />
                </div>

                {/* Bin Name (Text, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Bin Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={binFormData.name}
                    onChange={(e) => setBinFormData({ ...binFormData, name: e.target.value })}
                    placeholder="e.g. Aisle 1 Level 1 Pick Bin"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Warehouse (Dropdown, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse *
                  </label>
                  <select
                    required
                    value={binFormData.warehouse}
                    onChange={(e) => {
                      const newWh = e.target.value;
                      const validLocs = locations.filter(
                        (l) => (l.warehouse_code || l.warehouse) === newWh
                      );
                      const defaultLoc = validLocs[0]?.code || "";
                      const validRacks = racks.filter(
                        (r) =>
                          (r.warehouse_code || r.warehouse) === newWh &&
                          (!defaultLoc || (r.location_code || r.location) === defaultLoc)
                      );
                      setBinFormData({
                        ...binFormData,
                        warehouse: newWh,
                        location: defaultLoc,
                        rack: validRacks[0]?.code || "",
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.code || wh.id} value={wh.code}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Storage Location (Dropdown, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Storage Location *
                  </label>
                  <select
                    required
                    value={binFormData.location}
                    onChange={(e) => {
                      const newLoc = e.target.value;
                      const validRacks = racks.filter(
                        (r) =>
                          (r.warehouse_code || r.warehouse) === binFormData.warehouse &&
                          (!newLoc || (r.location_code || r.location) === newLoc)
                      );
                      setBinFormData({
                        ...binFormData,
                        location: newLoc,
                        rack: validRacks[0]?.code || "",
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">Select Location...</option>
                    {binModalLocations.map((loc) => (
                      <option key={loc.code || loc.id} value={loc.code}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Rack (Dropdown, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Rack *
                  </label>
                  <select
                    required
                    value={binFormData.rack}
                    onChange={(e) => setBinFormData({ ...binFormData, rack: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">Select Rack...</option>
                    {binModalRacks.map((r) => (
                      <option key={r.code || r.id} value={r.code}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rack Level (Dropdown / Number, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Rack Level *
                  </label>
                  <select
                    required
                    value={binFormData.rack_level}
                    onChange={(e) =>
                      setBinFormData({
                        ...binFormData,
                        rack_level: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    {Array.from({ length: maxLevelsForSelectedRack }).map((_, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        Level {idx + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Barcode (Auto-generated, Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-zinc-300">
                      Barcode (Auto-generated)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setBinFormData({
                          ...binFormData,
                          barcode: generateBinBarcode(binFormData.code),
                        })
                      }
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" /> Regenerate
                    </button>
                  </div>
                  <input
                    type="text"
                    value={binFormData.barcode}
                    onChange={(e) => setBinFormData({ ...binFormData, barcode: e.target.value })}
                    placeholder="e.g. BIN-A1-01-8849"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                {/* Status (Active / Inactive / Blocked, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Status *
                  </label>
                  <select
                    required
                    value={binFormData.status}
                    onChange={(e) => setBinFormData({ ...binFormData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsBinModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={binSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {binSubmitting ? "Saving..." : editingBin ? "Save Changes" : "Create Bin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Inspection Modal */}
      {barcodePreviewItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                Bin Location Barcode
              </span>
              <button
                onClick={() => setBarcodePreviewItem(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-inner flex flex-col items-center justify-center space-y-3">
              {/* Scalable Barcode Graphic */}
              <div className="flex items-center justify-center space-x-1 py-2">
                {[3, 1, 4, 2, 5, 2, 1, 4, 2, 3, 1, 5, 2, 4, 1, 3, 2, 4, 1, 5].map((w, idx) => (
                  <div
                    key={idx}
                    className="bg-black h-14"
                    style={{ width: `${w * 2}px` }}
                  />
                ))}
              </div>
              <span className="font-mono text-sm font-bold tracking-widest text-slate-900">
                {barcodePreviewItem.barcode}
              </span>
            </div>

            <div className="text-xs text-slate-500 dark:text-zinc-400">
              <span className="font-semibold text-slate-800 dark:text-zinc-200 block">
                {barcodePreviewItem.name}
              </span>
              <span>
                {barcodePreviewItem.warehouse} / {barcodePreviewItem.location} / {barcodePreviewItem.rack} (Lvl {barcodePreviewItem.rack_level})
              </span>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => copyToClipboard(barcodePreviewItem.barcode)}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Barcode Payload</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

