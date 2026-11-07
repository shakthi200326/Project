import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  Users,
  KeyRound,
  ShieldAlert,
  Warehouse,
  History,
  FileText,
  FileDiff,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";

export function SecurityHeader({ title, subtitle, icon: Icon = Shield, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-zinc-800/80">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 shadow-xs">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">{title}</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function SecurityStatCard({ label, value, subtext, icon: Icon = Activity, tone = "blue" }) {
  const toneMap = {
    blue: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-800/50",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/50",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/50",
    purple: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200/60 dark:border-purple-800/50",
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">{label}</span>
        <div className={`p-2 rounded-xl border ${toneMap[tone] || toneMap.blue}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">{value}</div>
      {subtext && <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">{subtext}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE" || s === "SUCCESS" || s === "POSTED" || s === "PASSED" || s === "FULL_ACCESS") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
        <CheckCircle2 className="h-3 w-3" />
        {status}
      </span>
    );
  }
  if (s === "OPERATIONAL" || s === "INSPECTED" || s === "SUBMITTED" || s === "CONDITIONAL") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60">
        <Clock className="h-3 w-3" />
        {status}
      </span>
    );
  }
  if (s === "READ_ONLY" || s === "DRAFT" || s === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60">
        <AlertTriangle className="h-3 w-3" />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200/80 dark:border-red-800/60">
      <XCircle className="h-3 w-3" />
      {status || "UNKNOWN"}
    </span>
  );
}

export function SecurityNavPills({ activeTab }) {
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
  }, [activeTab, updateScrollState]);

  const scrollTabs = (direction) => {
    const tabs = tabsRef.current;
    tabs?.scrollBy({ left: direction * Math.max(180, tabs.clientWidth * 0.7), behavior: "smooth" });
  };

  const tabs = [
    { key: "users", label: "User Access", path: "/security/users", icon: Users },
    { key: "roles", label: "Role Management", path: "/security/roles", icon: KeyRound },
    { key: "permissions", label: "Permissions", path: "/security/permissions", icon: ShieldAlert },
    { key: "warehouse", label: "Warehouse Access", path: "/security/warehouse-access", icon: Warehouse },
    { key: "actions", label: "Action Matrix", path: "/security/actions", icon: Shield },
    { key: "logs", label: "Activity Logs", path: "/security/activity-logs", icon: Activity },
    { key: "audit", label: "Document Audit", path: "/security/document-audit", icon: FileText },
    { key: "history", label: "Data Changes", path: "/security/data-history", icon: FileDiff },
  ];

  return (
    <div className="flex min-w-0 items-center gap-1 border-b border-slate-200/80 pb-2 text-xs dark:border-zinc-800/80">
      <button
        type="button"
        aria-label="Scroll security tabs left"
        disabled={!scrollState.left}
        onClick={() => scrollTabs(-1)}
        className="shrink-0 rounded-lg px-2 py-1.5 font-bold text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        {"<"}
      </button>
      <div
        ref={tabsRef}
        onScroll={updateScrollState}
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-hidden"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <Link
              key={t.key}
              ref={isActive ? activeTabRef : undefined}
              to={t.path}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Link>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Scroll security tabs right"
        disabled={!scrollState.right}
        onClick={() => scrollTabs(1)}
        className="shrink-0 rounded-lg px-2 py-1.5 font-bold text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        {">"}
      </button>
    </div>
  );
}
