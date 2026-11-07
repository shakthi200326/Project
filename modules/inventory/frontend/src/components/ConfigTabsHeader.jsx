import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Settings,
  Boxes,
  Cpu,
  DollarSign,
  Hash,
  ShieldCheck,
  History,
  CheckCircle2,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export function ConfigTabsHeader({ title, subtitle, icon: Icon = Settings }) {
  const location = useLocation();
  const tabsRef = useRef(null);
  const activeTabRef = useRef(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });

  const updateScrollState = useCallback(() => {
    const tabs = tabsRef.current;
    if (!tabs) return;
    setScrollState({
      left: tabs.scrollLeft > 0,
      right: tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) return undefined;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(tabs);
    window.addEventListener("resize", updateScrollState);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    updateScrollState();
  }, [location.pathname, updateScrollState]);

  const scrollTabs = (direction) => {
    tabsRef.current?.scrollBy({ left: direction * Math.max(180, tabsRef.current.clientWidth * 0.7), behavior: "smooth" });
  };

  const tabs = [
    { label: "General Settings", path: "/inventory/configuration/general", icon: Settings },
    { label: "Stock Settings", path: "/inventory/configuration/stock", icon: Boxes },
    { label: "Product Tracking Settings", path: "/inventory/configuration/tracking", icon: Cpu },
    { label: "Valuation Settings", path: "/inventory/configuration/valuation", icon: DollarSign },
    { label: "Document Numbering", path: "/inventory/configuration/numbering", icon: Hash },
    { label: "Approval Settings", path: "/inventory/configuration/approvals", icon: ShieldCheck },
    { label: "Goods Receipt & Inspection", path: "/inventory/configuration/goods-receipt", icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-4">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h1>
              <span className="shrink-0 whitespace-nowrap text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                CONFIG RULESET
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>Active System Engine Rules</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex min-w-0 items-center gap-1 border-b border-slate-200 pb-1 text-xs dark:border-zinc-800">
        <button
          type="button"
          aria-label="Scroll configuration tabs left"
          disabled={!scrollState.left}
          onClick={() => scrollTabs(-1)}
          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          ref={tabsRef}
          onScroll={updateScrollState}
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-hidden"
        >
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            const TabIcon = tab.icon;
            return (
              <Link
                key={tab.path}
                ref={isActive ? activeTabRef : undefined}
                to={tab.path}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 font-semibold text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                }`}
              >
                <TabIcon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400 dark:text-zinc-500"}`} />
                {tab.label}
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Scroll configuration tabs right"
          disabled={!scrollState.right}
          onClick={() => scrollTabs(1)}
          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
