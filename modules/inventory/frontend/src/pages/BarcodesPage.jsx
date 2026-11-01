import React, { useState } from "react";
import { Barcode, Search, Printer, Download, Eye, QrCode, CheckCircle2, Copy } from "lucide-react";
import { DEMO_PRODUCTS } from "../services/api";

export function BarcodesPage() {
  const [products] = useState(DEMO_PRODUCTS);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(DEMO_PRODUCTS[0]);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filtered = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search)
  );

  const handlePrint = (barcode) => {
    showToast(`Sending thermal print job for barcode ${barcode}...`);
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const handleCopy = (barcode) => {
    navigator.clipboard.writeText(barcode);
    showToast(`Barcode ${barcode} copied to clipboard.`);
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-medium shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Barcode & Tag Registry
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Generate GS1 standard barcodes, warehouse bin labels, and QR asset tracking tags.
          </p>
        </div>

        <button
          onClick={() => handlePrint(selectedProduct.barcode)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          <span>Print Selected Labels</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Product Barcode Table */}
        <div className="lg:col-span-2 space-y-3">
          <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by SKU, item name or barcode number..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="py-3.5 px-4 font-semibold">SKU</th>
                    <th className="py-3.5 px-4 font-semibold">Item Name</th>
                    <th className="py-3.5 px-4 font-semibold">Barcode</th>
                    <th className="py-3.5 px-4 font-semibold">Format</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedProduct(item)}
                      className={`cursor-pointer transition-colors ${
                        selectedProduct?.id === item.id
                          ? "bg-blue-50/70 dark:bg-blue-950/40"
                          : "hover:bg-slate-50/60 dark:hover:bg-zinc-800/40"
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {item.sku}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {item.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                        {item.barcode}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700">
                          EAN-13
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(item);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold text-[11px] cursor-pointer"
                        >
                          Preview Label →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Printable Label Simulation Panel */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                <Barcode className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Physical Label Preview
              </h2>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">Thermal 4x2 in</span>
            </div>

            {/* Simulated Industrial Label */}
            <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-zinc-700 bg-white text-slate-900 space-y-3 font-sans shadow-inner">
              <div className="flex items-start justify-between border-b border-slate-200 pb-2">
                <div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    ONE ERP INVENTORY TAG
                  </div>
                  <div className="text-xs font-bold leading-tight">{selectedProduct.name}</div>
                  <div className="font-mono text-[10px] font-semibold text-blue-700 mt-0.5">
                    SKU: {selectedProduct.sku}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center border border-slate-300 rounded p-1">
                  <QrCode className="h-full w-full text-slate-900" />
                </div>
              </div>

              {/* Barcode graphic lines simulation */}
              <div className="text-center py-2 space-y-1">
                <div className="flex items-center justify-center gap-[2px] h-14 w-full px-2 overflow-hidden bg-slate-50 p-1 rounded">
                  {/* Procedurally generated barcode bar lines */}
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-slate-900 h-full"
                      style={{
                        width: (i % 3 === 0 ? "3px" : i % 5 === 0 ? "1px" : "2px"),
                        marginRight: (i % 4 === 0 ? "2px" : "1px"),
                      }}
                    />
                  ))}
                </div>
                <div className="font-mono text-xs tracking-widest font-bold tabular-nums">
                  {selectedProduct.barcode}
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-200">
                <span>Facility: WH-MAIN</span>
                <span>UOM: {selectedProduct.base_unit || "EA"}</span>
                <span className="font-bold text-emerald-700">Verified: OK</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => handlePrint(selectedProduct.barcode)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs shadow-blue-500/25 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Label</span>
              </button>
              <button
                onClick={() => handleCopy(selectedProduct.barcode)}
                className="p-2.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Copy Barcode String"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
