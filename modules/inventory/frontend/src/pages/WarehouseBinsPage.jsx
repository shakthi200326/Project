import React, { useState, useEffect } from "react";
import {
  Boxes,
  Barcode,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  XCircle,
  Warehouse,
  MapPin,
  RefreshCw,
  QrCode,
  AlertCircle,
  Check,
} from "lucide-react";
import { lookupBinBarcode } from "../services/api";

export function WarehouseBinsPage() {
  const [bins, setBins] = useState([
    { id: 1, code: "BIN-A1-01-01", name: "Aisle 1 Level 1 Pos 1", bin_type: "STANDARD_PALLET", barcode: "BIN-A1-01-01", qr_code: "QR-BIN-A1-01-01", rack_level: 1, position: 1, max_weight: 1500.0, max_volume: 2.5, max_quantity: 100, current_weight: 850.0, allow_mixing_products: true, allow_mixing_batches: false, status: "Active" },
    { id: 2, code: "BIN-A1-01-02", name: "Aisle 1 Level 1 Pos 2", bin_type: "STANDARD_PALLET", barcode: "BIN-A1-01-02", qr_code: "QR-BIN-A1-01-02", rack_level: 1, position: 2, max_weight: 1500.0, max_volume: 2.5, max_quantity: 100, current_weight: 1420.0, allow_mixing_products: true, allow_mixing_batches: true, status: "Active" },
    { id: 3, code: "BIN-C1-02-01", name: "Cantilever Long Bar 1", bin_type: "CANTILEVER", barcode: "BIN-C1-02-01", qr_code: "QR-BIN-C1-02-01", rack_level: 2, position: 1, max_weight: 3000.0, max_volume: 5.0, max_quantity: 50, current_weight: 600.0, allow_mixing_products: false, allow_mixing_batches: false, status: "Active" },
    { id: 4, code: "BIN-COLD-01-01", name: "Cold Flow Bay 1", bin_type: "COLD_BIN", barcode: "BIN-COLD-01-01", qr_code: "QR-BIN-COLD-01-01", rack_level: 1, position: 1, max_weight: 800.0, max_volume: 1.2, max_quantity: 80, current_weight: 350.0, allow_mixing_products: true, allow_mixing_batches: true, status: "Active" },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanning, setScanning] = useState(false);

  const handleBarcodeLookup = async (e) => {
    e.preventDefault();
    if (!barcodeSearch.trim()) return;
    setScanning(true);
    setScanResult(null);
    setScanError(null);
    try {
      const data = await lookupBinBarcode(barcodeSearch.trim());
      setScanResult(data);
    } catch (err) {
      // Local fallback lookup
      const found = bins.find(
        (b) =>
          b.barcode.toLowerCase() === barcodeSearch.trim().toLowerCase() ||
          b.qr_code.toLowerCase() === barcodeSearch.trim().toLowerCase() ||
          b.code.toLowerCase() === barcodeSearch.trim().toLowerCase()
      );
      if (found) {
        setScanResult(found);
      } else {
        setScanError(`No bin found matching barcode/QR: "${barcodeSearch.trim()}"`);
      }
    } finally {
      setScanning(false);
    }
  };

  const filteredBins = bins.filter(
    (b) =>
      b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.barcode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              Bins & Granular Storage Positions
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
              Tier 4 Precision
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Configure discrete storage compartments, optical barcodes, physical limits, and mixing constraints.
          </p>
        </div>
      </div>

      {/* Barcode / QR Fast Lookup Scanner Bar */}
      <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20">
        <form onSubmit={handleBarcodeLookup} className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Barcode className="absolute left-3 top-2.5 h-5 w-5 text-indigo-500" />
            <input
              type="text"
              placeholder="Scan or enter Bin Barcode / QR Code (e.g. BIN-A1-01-01)..."
              value={barcodeSearch}
              onChange={(e) => setBarcodeSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={scanning}
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm"
          >
            <QrCode className="h-4 w-4" />
            {scanning ? "Scanning..." : "Scan Bin"}
          </button>
        </form>

        {scanResult && (
          <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 font-bold" />
              <span>
                <strong>Bin Located:</strong> {scanResult.code} ({scanResult.name}) • Level {scanResult.rack_level}, Pos {scanResult.position} • Max {scanResult.max_weight}kg
              </span>
            </div>
            <button onClick={() => setScanResult(null)} className="underline text-[11px]">
              Dismiss
            </button>
          </div>
        )}

        {scanError && (
          <div className="mt-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between">
            <span>{scanError}</span>
            <button onClick={() => setScanError(null)} className="underline text-[11px]">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search bins by code or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Bins Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-300">
          <thead className="bg-slate-50 dark:bg-zinc-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-3.5">Bin Code & Barcode</th>
              <th className="px-6 py-3.5">Description</th>
              <th className="px-6 py-3.5 text-center">Shelf / Pos</th>
              <th className="px-6 py-3.5">Load Utilization</th>
              <th className="px-6 py-3.5 text-center">Product Mixing</th>
              <th className="px-6 py-3.5 text-center">Batch Mixing</th>
              <th className="px-6 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
            {filteredBins.map((b) => {
              const utilPct = Math.round(((b.current_weight || 0) / b.max_weight) * 100);
              const barColor =
                utilPct > 90 ? "bg-rose-500" : utilPct > 75 ? "bg-amber-500" : "bg-emerald-500";

              return (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition">
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-slate-900 dark:text-zinc-100">{b.code}</div>
                    <div className="flex items-center gap-1 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                      <Barcode className="h-3 w-3" />
                      {b.barcode}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800 dark:text-zinc-200">
                    {b.name}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      L{b.rack_level} • P{b.position}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-32 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-zinc-200">{utilPct}%</span>
                        <span className="text-slate-400 text-[11px]">{b.max_weight} kg</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.min(100, utilPct)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {b.allow_mixing_products ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="h-4 w-4" /> Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <XCircle className="h-4 w-4" /> Single SKU
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {b.allow_mixing_batches ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="h-4 w-4" /> Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <XCircle className="h-4 w-4" /> Single Lot
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {b.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default WarehouseBinsPage;

