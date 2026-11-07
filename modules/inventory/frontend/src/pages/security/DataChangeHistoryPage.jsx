import React, { useState, useEffect } from "react";
import { FileDiff, Search, ArrowRight, User, Calendar, Database } from "lucide-react";
import {
  SecurityHeader,
  SecurityStatCard,
  SecurityNavPills,
} from "./securityComponents";
import { fetchDataChangeRecords } from "../../services/securityApi";

export function DataChangeHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchDataChangeRecords({
        search,
        entity_type: entityFilter,
        changed_by: userFilter,
      });
      setRecords(data.results || data || []);
    } catch (err) {
      console.error("Failed to load data change history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, entityFilter, userFilter]);

  return (
    <div className="space-y-6">
      <SecurityHeader
        title="Data Change History"
        subtitle="Forensic field-level before-and-after audit comparison for master data, stock adjustments, and operational configuration."
        icon={FileDiff}
      />

      <SecurityNavPills activeTab="history" />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SecurityStatCard
          label="Tracked Field Changes"
          value={records.length}
          subtext="Captured delta comparisons"
          icon={FileDiff}
          tone="purple"
        />
        <SecurityStatCard
          label="Tracked Entities"
          value={new Set(records.map((r) => r.entity_type)).size}
          subtext="Domain entities"
          icon={Database}
          tone="blue"
        />
        <SecurityStatCard
          label="Change Actors"
          value={new Set(records.map((r) => r.changed_by)).size}
          subtext="Modifying principals"
          icon={User}
          tone="emerald"
        />
        <SecurityStatCard
          label="Document Linked"
          value={records.filter((r) => r.document_reference).length}
          subtext="Transactional mutations"
          icon={FileDiff}
          tone="amber"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search field, entity, user, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
          >
            <option value="">All Entity Types</option>
            <option value="Item">Item</option>
            <option value="Warehouse">Warehouse</option>
            <option value="WarehouseAccess">WarehouseAccess</option>
            <option value="UserMembership">UserMembership</option>
            <option value="StockAdjustment">StockAdjustment</option>
          </select>
        </div>
      </div>

      {/* Changes Comparison Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                <th className="py-3.5 px-4">Entity & Reference</th>
                <th className="py-3.5 px-4">Field Name</th>
                <th className="py-3.5 px-4 min-w-[280px]">Old Value vs. New Value</th>
                <th className="py-3.5 px-4">Changed By</th>
                <th className="py-3.5 px-4">Reason / Notes</th>
                <th className="py-3.5 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading data change comparisons...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No field modifications recorded.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-zinc-100">
                        {r.entity_display_name || r.entity_type}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {r.entity_type} #{r.entity_id.substring(0, 8)}
                        {r.document_reference ? ` • Ref: ${r.document_reference}` : ""}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-zinc-200">
                      {r.field_name}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-md bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200/80 dark:border-red-800/60 font-mono text-[11px] max-w-[150px] truncate" title={r.old_value}>
                          {r.old_value || "(empty)"}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 font-mono text-[11px] max-w-[150px] truncate" title={r.new_value}>
                          {r.new_value || "(empty)"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-zinc-100">
                      {r.changed_by}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 max-w-xs truncate" title={r.change_reason}>
                      {r.change_reason || "—"}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap text-right">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

