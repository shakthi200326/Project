import React, { useState } from "react";
import { Ruler, Plus, Search, CheckCircle2, ArrowRightLeft, Scale } from "lucide-react";
import { DEMO_UNITS } from "../services/api";

export function UnitsPage() {
  const [units, setUnits] = useState(DEMO_UNITS);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUnit, setNewUnit] = useState({ code: "", name: "", symbol: "", decimal_places: 0, is_base: true, conversion_factor: 1, base_unit: "EA" });

  const filteredUnits = units.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newUnit.code || !newUnit.name) return;
    setUnits((prev) => [
      ...prev,
      {
        id: `uom-${Date.now()}`,
        code: newUnit.code.toUpperCase(),
        name: newUnit.name,
        symbol: newUnit.symbol || newUnit.code.toLowerCase(),
        decimal_places: Number(newUnit.decimal_places) || 0,
        is_base: newUnit.is_base,
        conversion_factor: newUnit.is_base ? 1 : Number(newUnit.conversion_factor) || 1,
        base_unit: newUnit.is_base ? null : newUnit.base_unit,
      },
    ]);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Units of Measure (UOM)
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Standard inventory counting units, pack sizes, volume metrics, and conversion formulas.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs cursor-pointer transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Unit</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search units of measure..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-400 dark:text-zinc-500 tabular-nums">
          {filteredUnits.length} configured units
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">Unit Code</th>
                <th className="py-3.5 px-4 font-semibold">Unit Name</th>
                <th className="py-3.5 px-4 font-semibold">Symbol</th>
                <th className="py-3.5 px-4 font-semibold">Type</th>
                <th className="py-3.5 px-4 font-semibold">Conversion Ratio</th>
                <th className="py-3.5 px-4 font-semibold text-right">Precision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredUnits.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                      {u.code}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {u.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-zinc-300 font-medium">
                    {u.symbol}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        u.is_base
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                          : "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${u.is_base ? "bg-emerald-500" : "bg-purple-500"}`} />
                      {u.is_base ? "Base Unit" : "Secondary Unit"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300 font-mono tabular-nums">
                    {u.is_base ? (
                      <span className="text-slate-400">1.0 (Standard Reference)</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                        <ArrowRightLeft className="h-3 w-3" /> 1 {u.code} = {u.conversion_factor} {u.base_unit}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500">
                    {u.decimal_places} decimal places
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Ruler className="h-4 w-4 text-blue-600" />
              Define Unit of Measure
            </h2>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  UOM Code *
                </label>
                <input
                  type="text"
                  required
                  value={newUnit.code}
                  onChange={(e) => setNewUnit({ ...newUnit, code: e.target.value })}
                  placeholder="e.g. PACK"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white uppercase font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newUnit.name}
                  onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
                  placeholder="e.g. Pack of 25 Units"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Symbol
                  </label>
                  <input
                    type="text"
                    value={newUnit.symbol}
                    onChange={(e) => setNewUnit({ ...newUnit, symbol: e.target.value })}
                    placeholder="pk"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Decimals
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={newUnit.decimal_places}
                    onChange={(e) => setNewUnit({ ...newUnit, decimal_places: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600"
                >
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">
                  Save Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

