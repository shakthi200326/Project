import React, { useMemo, useRef, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Upload,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { StockInPage } from "./StockInPage.jsx";
import { StockIssuePage } from "./StockIssuePage.jsx";
import { StockOutPage } from "./StockOutPage.jsx";
import { StockReturnsPage } from "./StockReturnsPage.jsx";
import { TabStrip } from "../components/ScrollableTabs.jsx";
import { FaGreaterThan, FaLessThan } from "react-icons/fa";

const SUB_MODULE_TABS = [
  {
    id: "stock-in",
    label: "Stock In",
    icon: ArrowDownLeft,
    badge: "Inward Receipts",
    description: "Inbound goods receipt records, supplier shipments, and initial warehouse arrivals",
  },
  {
    id: "stock-issue",
    label: "Stock Issue",
    icon: ArrowUpRight,
    badge: "Goods Issue (GIN)",
    description: "Stock issuance for internal consumption, work orders, departments, and projects",
  },
  {
    id: "stock-out",
    label: "Stock Out",
    icon: Upload,
    badge: "Outward Dispatches",
    description: "Outbound stock shipments, sales orders, transfers-out, and delivery logs",
  },
  {
    id: "stock-return",
    label: "Stock Return",
    icon: RotateCcw,
    badge: "Returns & Reversals",
    description: "Customer returns, vendor returns (RTV), RMA tracking, and restock dispositions",
  },
];

export function StockOperationsMasterPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = (searchParams.get("tab") || "stock-in").toLowerCase();

  const tabsContainerRef = useRef(null);

  const [tabsOverflow, setTabsOverflow] = useState(false);
  const activeTabRef = useRef(null);

  const activeTab = useMemo(() => {
    if (rawTab === "stock-issue" || rawTab === "issue" || rawTab === "gin") return "stock-issue";
    if (rawTab === "stock-out" || rawTab === "out" || rawTab === "outward") return "stock-out";
    if (rawTab === "stock-return" || rawTab === "return" || rawTab === "returns") return "stock-return";
    return "stock-in";
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
      if (tabId === "stock-in") {
        next.set("tab", "stock-in");
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
            <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <ArrowDownLeft className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Stock Inward & Outward Operations
                </h1>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50">
                  CONSOLIDATED SUB-MODULE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Maintain Stock In (receipts), Stock Issue (consumption), Stock Out (dispatches), and Stock Return (reversals) in a single sub-module.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
              <span>Movement Operations Synchronized</span>
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
            aria-label="Stock Operations sub-module sections"
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
        {activeTab === "stock-in" && <StockInPage />}
        {activeTab === "stock-issue" && <StockIssuePage />}
        {activeTab === "stock-out" && <StockOutPage />}
        {activeTab === "stock-return" && <StockReturnsPage />}
      </div>
    </div>
  );
}

export default StockOperationsMasterPage;

