import React, { useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { StockTransferPage } from "./StockTransferPage.jsx";

const SUB_MODULE_TABS = [
  {
    id: "stock-transfer",
    label: "Stock Transfer",
    icon: ArrowLeftRight,
    badge: "All Transfers",
    description: "Complete registry of intra-location, bin-to-bin, and inter-facility stock movements",
  },
  {
    id: "inter-warehouse",
    label: "Inter-Warehouse Transfer",
    icon: Building2,
    badge: "Facility Shipments",
    description: "Multi-facility transit tracking, in-transit stock, shipping manifests, and receiving handoffs",
  },
];

export function StockTransferOperationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = (searchParams.get("tab") || "stock-transfer").toLowerCase();

  const tabsContainerRef = useRef(null);
  const activeTabRef = useRef(null);

  const activeTab = useMemo(() => {
    if (
      rawTab === "inter-warehouse" ||
      rawTab === "interwarehouse" ||
      rawTab === "inter-warehouse-transfer" ||
      rawTab === "facility"
    ) {
      return "inter-warehouse";
    }
    return "stock-transfer";
  }, [rawTab]);

  const currentIndex = SUB_MODULE_TABS.findIndex((t) => t.id === activeTab);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < SUB_MODULE_TABS.length - 1;

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeTab]);

  const handleTabChange = (tabId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabId === "stock-transfer") {
        next.set("tab", "stock-transfer");
      } else {
        next.set("tab", tabId);
      }
      return next;
    });
  };

  const goToPrevTab = () => {
    if (canGoPrev) {
      handleTabChange(SUB_MODULE_TABS[currentIndex - 1].id);
    }
  };

  const goToNextTab = () => {
    if (canGoNext) {
      handleTabChange(SUB_MODULE_TABS[currentIndex + 1].id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-Module Master Header */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <ArrowLeftRight className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Stock & Inter-Warehouse Transfers
                </h1>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50">
                  CONSOLIDATED SUB-MODULE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Maintain internal stock transfers and facility-to-facility inter-warehouse transit in a single sub-module.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
              <span>Transfer Network Synchronized</span>
            </span>
          </div>
        </div>

        {/* Sub-Module Navigation Tabs with < and > controls */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-zinc-800 dark:bg-zinc-950/60">
          {/* Less Than (<) Navigation Button */}
          <button
            type="button"
            onClick={goToPrevTab}
            disabled={!canGoPrev}
            title={canGoPrev ? `Previous: ${SUB_MODULE_TABS[currentIndex - 1]?.label} (<)` : "Start of tabs (<)"}
            aria-label="Previous tab (<)"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-all ${
              canGoPrev
                ? "border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                : "border-transparent text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-30"
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Tabs Strip - Scrollbar hidden completely, no moving line */}
          <div
            ref={tabsContainerRef}
            className="flex flex-1 items-center gap-2 overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Stock Transfer Operations sub-module sections"
          >
            {SUB_MODULE_TABS.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  ref={selected ? activeTabRef : null}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex min-w-max items-center gap-2.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    selected
                      ? "bg-white text-blue-700 shadow-sm dark:bg-zinc-800 dark:text-blue-400 font-bold"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      selected
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400 dark:text-zinc-500"
                    }`}
                  />
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      selected
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
                        : "bg-slate-200/70 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Greater Than (>) Navigation Button */}
          <button
            type="button"
            onClick={goToNextTab}
            disabled={!canGoNext}
            title={canGoNext ? `Next: ${SUB_MODULE_TABS[currentIndex + 1]?.label} (>)` : "End of tabs (>)"}
            aria-label="Next tab (>)"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-all ${
              canGoNext
                ? "border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                : "border-transparent text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-30"
            }`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Active Tab Panel */}
      <div role="tabpanel" className="transition-all duration-150">
        {activeTab === "stock-transfer" && <StockTransferPage key="all" mode="ALL" />}
        {activeTab === "inter-warehouse" && <StockTransferPage key="inter-warehouse" mode="INTER_WAREHOUSE" />}
      </div>
    </div>
  );
}

export default StockTransferOperationsPage;

