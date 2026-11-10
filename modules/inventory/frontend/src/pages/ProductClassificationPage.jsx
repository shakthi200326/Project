import React, { useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Layers,
  Tag,
  Ruler,
  SlidersHorizontal,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { CategoriesPage } from "./CategoriesPage.jsx";
import { BrandsPage } from "./BrandsPage.jsx";
import { UnitsPage } from "./UnitsPage.jsx";
import { ProductAttributesPage } from "./ProductAttributesPage.jsx";

const SUB_MODULE_TABS = [
  {
    id: "categories",
    label: "Categories",
    icon: Layers,
    badge: "Taxonomy Hierarchy",
    description: "Hierarchical product categories, parent-child trees & taxonomy rollups",
  },
  {
    id: "brands",
    label: "Brands",
    icon: Tag,
    badge: "Brands & OEMs",
    description: "Brand registries, OEM manufacturers, and vendor supplier performance",
  },
  {
    id: "units",
    label: "Units of Measurement (UOM)",
    icon: Ruler,
    badge: "Conversion Ladders",
    description: "Base UOMs, packaging hierarchies, and fractional precision rules",
  },
  {
    id: "attributes",
    label: "Product Attributes",
    icon: SlidersHorizontal,
    badge: "Specifications",
    description: "Specification attributes, value sets, and variant generator rules",
  },
];

export function ProductClassificationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = (searchParams.get("tab") || "categories").toLowerCase();

  const tabsContainerRef = useRef(null);
  const activeTabRef = useRef(null);

  const activeTab = useMemo(() => {
    if (rawTab === "brands" || rawTab === "brand") return "brands";
    if (rawTab === "units" || rawTab === "unit" || rawTab === "uom") return "units";
    if (rawTab === "attributes" || rawTab === "attribute") return "attributes";
    return "categories";
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
      if (tabId === "categories") {
        next.set("tab", "categories");
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
            <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Layers className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Product Classification
                </h1>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/50">
                  CONSOLIDATED SUB-MODULE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Maintain product categories, brands & OEMs, units of measurement (UOM), and product attributes in a single sub-module.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Taxonomy Rules Active</span>
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
            aria-label="Product Classification sub-module sections"
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
                      ? "bg-white text-indigo-700 shadow-sm dark:bg-zinc-800 dark:text-indigo-400 font-bold"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      selected
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-slate-400 dark:text-zinc-500"
                    }`}
                  />
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      selected
                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200"
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
        {activeTab === "categories" && <CategoriesPage />}
        {activeTab === "brands" && <BrandsPage />}
        {activeTab === "units" && <UnitsPage />}
        {activeTab === "attributes" && <ProductAttributesPage />}
      </div>
    </div>
  );
}

export default ProductClassificationPage;
