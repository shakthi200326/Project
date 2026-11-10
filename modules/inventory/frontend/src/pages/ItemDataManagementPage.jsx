import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  Camera,
  Upload,
  Download,
  History,
  Database,
} from "lucide-react";
import { ProductMediaPage } from "./ProductMediaPage.jsx";
import { ProductImportPage } from "./ProductImportPage.jsx";
import { ProductExportPage } from "./ProductExportPage.jsx";
import { ProductImportHistoryPage } from "./ProductImportHistoryPage.jsx";

const tabs = [
  { id: "attachments", label: "Images & Attachments", icon: Camera },
  { id: "import", label: "Import Items", icon: Upload },
  { id: "export", label: "Export Items", icon: Download },
  { id: "history", label: "Import History", icon: History },
];

export function ItemDataManagementPage({ hideHeader = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const subtabParam = searchParams.get("subtab");
  const tabParam = searchParams.get("tab");

  const activeTab = tabs.some((tab) => tab.id === subtabParam)
    ? subtabParam
    : (tabs.some((tab) => tab.id === tabParam) ? tabParam : "attachments");

  const selectTab = (tabId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "data-management");
      next.set("subtab", tabId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            <Database className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Item Data Management
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage item attachments, spreadsheet imports, exports, and import audit history.
          </p>
        </div>
      )}

      <div
        className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-900"
        role="tablist"
        aria-label="Item data management sections"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectTab(tab.id)}
              className={`flex min-w-max items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                selected
                  ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {activeTab === "attachments" && <ProductMediaPage />}
        {activeTab === "import" && <ProductImportPage />}
        {activeTab === "export" && <ProductExportPage />}
        {activeTab === "history" && <ProductImportHistoryPage />}
      </div>
    </div>
  );
}

export default ItemDataManagementPage;
