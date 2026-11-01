import React, { useState } from "react";
import { Tag, Plus, Search, Globe, CheckCircle2, Package, ArrowUpRight } from "lucide-react";
import { DEMO_BRANDS } from "../services/api";

export function BrandsPage() {
  const [brands, setBrands] = useState(DEMO_BRANDS);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBrand, setNewBrand] = useState({ name: "", code: "", country: "" });

  const filteredBrands = brands.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.code.toLowerCase().includes(search.toLowerCase()) ||
      b.country.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newBrand.name || !newBrand.code) return;
    setBrands((prev) => [
      ...prev,
      {
        id: `br-${Date.now()}`,
        name: newBrand.name,
        code: newBrand.code.toUpperCase(),
        country: newBrand.country || "Global",
        skus_count: 0,
        is_active: true,
      },
    ]);
    setNewBrand({ name: "", code: "", country: "" });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Brands & Manufacturers
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Registered equipment OEMs, suppliers, brand identity, and certified product lines.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs cursor-pointer transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Brand</span>
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
            placeholder="Search brands by name, code or country..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-400 dark:text-zinc-500 tabular-nums">
          {filteredBrands.length} registered OEMs
        </span>
      </div>

      {/* Brands Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBrands.map((b) => (
          <div
            key={b.id}
            className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-blue-500 transition-all flex flex-col justify-between space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-sm tracking-wider">
                  {b.code.slice(0, 3)}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">{b.name}</h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
                    <Globe className="h-3 w-3" />
                    <span>{b.country}</span>
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                ACTIVE
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/60 text-xs">
              <span className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
                <Package className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-slate-800 dark:text-zinc-200 tabular-nums">{b.skus_count}</span> SKUs in catalog
              </span>
              <a
                href="/inventory/products"
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline text-[11px] flex items-center gap-0.5"
              >
                View Items <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Tag className="h-4 w-4 text-blue-600" />
              Register Brand OEM
            </h2>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Brand / Manufacturer Name *
                </label>
                <input
                  type="text"
                  required
                  value={newBrand.name}
                  onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })}
                  placeholder="e.g. Parker Hannifin"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Brand Code *
                </label>
                <input
                  type="text"
                  required
                  value={newBrand.code}
                  onChange={(e) => setNewBrand({ ...newBrand, code: e.target.value })}
                  placeholder="e.g. PRK"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white uppercase font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Country of Origin
                </label>
                <input
                  type="text"
                  value={newBrand.country}
                  onChange={(e) => setNewBrand({ ...newBrand, country: e.target.value })}
                  placeholder="e.g. United States"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                />
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
                  Save Brand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

