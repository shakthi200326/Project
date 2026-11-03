import React from "react";
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
} from "lucide-react";

export function ConfigTabsHeader({ title, subtitle, icon: Icon = Settings }) {
  const location = useLocation();

  const tabs = [
    { label: "General Settings", path: "/inventory/configuration/general", icon: Settings },
    { label: "Stock Settings", path: "/inventory/configuration/stock", icon: Boxes },
    { label: "Product Tracking Settings", path: "/inventory/configuration/tracking", icon: Cpu },
    { label: "Valuation Settings", path: "/inventory/configuration/valuation", icon: DollarSign },
    { label: "Document Numbering", path: "/inventory/configuration/numbering", icon: Hash },
    { label: "Approval Settings", path: "/inventory/configuration/approvals", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-4">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h1>
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                CONFIG RULESET
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span>Active System Engine Rules</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-zinc-800 text-xs">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const TabIcon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              <TabIcon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

