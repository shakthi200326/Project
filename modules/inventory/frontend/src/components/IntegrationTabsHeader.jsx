import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  History,
  Settings,
  Zap,
  CheckCircle2,
} from "lucide-react";

export function IntegrationTabsHeader({ title, subtitle, icon: Icon = Zap, actions = null }) {
  const location = useLocation();



  return (
    <div className="space-y-4">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-900/40">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h1>
              <span className="shrink-0 whitespace-nowrap text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-zinc-700">
                EVENT-DRIVEN BUS
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {actions}
        </div>
      </div>

      
    </div>
  );
}

