import React, { useState, useEffect } from "react";
import { Activity, Download, Search, Filter, Eye, Clock, ShieldCheck } from "lucide-react";
import {
  SecurityHeader,
  SecurityStatCard,
  SecurityNavPills,
  StatusBadge,
} from "./securityComponents";
import {
  fetchActivityLogs,
  getActivityLogsExportUrl,
} from "../../services/securityApi";

export function ActivityLogsPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedLog, setSelectedLog] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchActivityLogs({
        search,
        module: moduleFilter,
        status: statusFilter,
        actor: actorFilter,
        date_from: dateFrom,
        date_to: dateTo,
      });
      setLogs(data.results || data || []);
    } catch (err) {
      console.error("Failed to load activity logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, moduleFilter, statusFilter, actorFilter, dateFrom, dateTo]);

  const handleExport = () => {
    const url = getActivityLogsExportUrl({
      search,
      module: moduleFilter,
      status: statusFilter,
      actor: actorFilter,
      date_from: dateFrom,
      date_to: dateTo,
    });
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      <SecurityHeader
        title="Activity Logs"
        subtitle="Immutable append-only record of user logins, role modifications, permissions changes, and critical business events."
        icon={Activity}
        action={
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        }
      />

      <SecurityNavPills activeTab="logs" />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SecurityStatCard
          label="Total Events Logged"
          value={logs.length}
          subtext="Retrieved audit records"
          icon={Activity}
          tone="blue"
        />
        <SecurityStatCard
          label="Successful Events"
          value={logs.filter((l) => l.status === "SUCCESS").length}
          subtext="Executed without violation"
          icon={ShieldCheck}
          tone="emerald"
        />
        <SecurityStatCard
          label="Security Interventions"
          value={logs.filter((l) => l.status === "DENIED" || l.status === "FAILED").length}
          subtext="Access denials & failures"
          icon={Clock}
          tone="amber"
        />
        <SecurityStatCard
          label="Active Modules"
          value={new Set(logs.map((l) => l.module)).size}
          subtext="Monitored subsystems"
          icon={Activity}
          tone="purple"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search actor, action, resource ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
          />
        </div>

        <div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
          >
            <option value="">All Modules</option>
            <option value="security">Security</option>
            <option value="inventory">Inventory</option>
            <option value="goods_receipt">Goods Receipt</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="DENIED">Denied</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-2 py-1 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
          />
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Module</th>
                <th className="py-3.5 px-4">Resource</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">IP Address</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading activity stream...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No activity logs recorded.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-zinc-100">
                      {log.actor_username}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-zinc-300">
                      {log.action}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                        {log.module}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-zinc-400">
                      {log.resource_type}
                      {log.resource_id ? ` #${log.resource_id.substring(0, 8)}` : ""}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {log.ip_address || "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                        title="View Metadata"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metadata Detail Drawer / Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-2">Event Payload & Metadata</h3>
            <div className="text-xs text-slate-500 mb-4 font-mono">Event ID: {selectedLog.id}</div>
            <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-80">
              {JSON.stringify(selectedLog, null, 2)}
            </pre>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

