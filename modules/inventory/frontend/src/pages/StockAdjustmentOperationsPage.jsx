import React, { useMemo, useRef, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  SlidersHorizontal,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { StockAdjustmentPage } from "./StockAdjustmentPage.jsx";
import { StockReclassificationPage } from "./StockReclassificationPage.jsx";
import { TabStrip } from "../components/ScrollableTabs.jsx";
import { FaGreaterThan, FaLessThan } from "react-icons/fa";

const SUB_MODULE_TABS = [
  {
    id: "adjustment",
    label: "Stock Adjustment",
    icon: SlidersHorizontal,
    badge: "Cycle Adjustments",
    description: "Discrepancy write-offs, found inventory additions, damaged stock write-downs, and cycle count corrections",
  },
  {
    id: "reclassification",
    label: "Stock Reclassification",
    icon: RefreshCw,
    badge: "Status Conversion",
    description: "Status state transitions across Available, Quarantined, Blocked, and Damaged stock with audit approval trails",
  },
];

export function StockAdjustmentOperationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = (searchParams.get("tab") || "adjustment").toLowerCase();

  const tabsContainerRef = useRef(null);

  const [tabsOverflow, setTabsOverflow] = useState(false);
  const activeTabRef = useRef(null);

  const activeTab = useMemo(() => {
    if (
      rawTab === "reclassification" ||
      rawTab === "reclass" ||
      rawTab === "stock-reclassification" ||
      rawTab === "status"
    ) {
      return "reclassification";
    }
    return "adjustment";
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
      if (tabId === "adjustment") {
        next.set("tab", "adjustment");
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
            <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <SlidersHorizontal className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Stock Adjustment & Reclassification
                </h1>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/50">
                  CONSOLIDATED SUB-MODULE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Maintain inventory quantity adjustments, write-offs, and stock status reclassifications in a single sub-module.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />
              <span>Inventory Control Synchronized</span>
            </span>
          </div>
        </div>

        {/* Sub-Module Navigation Tabs with < and > controls */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-zinc-800 dark:bg-zinc-950/60">
          {/* Less Than (<) Navigation Button */}
          {tabsOverflow && (<button
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
            <FaLessThan className="h-3 w-3" />
          </button>)}

          {/* Tabs Strip - Scrollbar hidden completely, no moving line */}
          <TabStrip
            ref={tabsContainerRef}
            onScrollState={(st) => setTabsOverflow(st.left || st.right)}
            className="flex flex-1 items-center gap-2"
            role="tablist"
            aria-label="Stock Adjustment and Reclassification sub-module sections"
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
                      ? "bg-white text-amber-700 shadow-sm dark:bg-zinc-800 dark:text-amber-400 font-bold"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      selected
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-slate-400 dark:text-zinc-500"
                    }`}
                  />
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      selected
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                        : "bg-slate-200/70 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </TabStrip>

          {/* Greater Than (>) Navigation Button */}
          {tabsOverflow && (<button
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
            <FaGreaterThan className="h-3 w-3" />
          </button>)}
        </div>
      </div>

      {/* Active Tab Panel */}
      <div role="tabpanel" className="transition-all duration-150">
        {activeTab === "adjustment" && <StockAdjustmentPage />}
        {activeTab === "reclassification" && <StockReclassificationPage />}
      </div>
    </div>
  );
}

export default StockAdjustmentOperationsPage;

