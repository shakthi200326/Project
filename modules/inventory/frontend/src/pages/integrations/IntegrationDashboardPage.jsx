import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { IntegrationTabsHeader } from "../../components/IntegrationTabsHeader";
import {
  LayoutDashboard,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  Truck,
  RefreshCw,
  Send,
  Database,
  Layers,
  Activity,
  Server,
  Zap,
  ChevronRight,
} from "lucide-react";

export function IntegrationDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    outbox: { total: 0, pending: 0, published: 0, failed: 0 },
    inbox: { total: 0, processed: 0, processing: 0, failed: 0, dead_letter: 0 },
    dlq: { total: 0, unresolved: 0, resolved: 0 },
    in_transit_count: 0,
    settings: {},
    recent_outbox: [],
    recent_inbox: [],
    recent_errors: [],
  });
  const [draining, setDraining] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/inventory/integrations/dashboard/");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDrainOutbox = async () => {
    setDraining(true);
    try {
      const res = await fetch("/api/v1/inventory/integrations/outbox/drain/", { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDraining(false);
    }
  };

  const actionButtons = (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDrainOutbox}
        disabled={draining}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition cursor-pointer shadow-xs disabled:opacity-50"
      >
        <Send className="w-3.5 h-3.5" />
        <span>{draining ? "Draining..." : "Drain Outbox"}</span>
      </button>
      <button
        onClick={fetchData}
        className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
        title="Refresh Metrics"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <IntegrationTabsHeader
        title="Integration Dashboard"
        subtitle="Real-time event metrics, transactional outbox dispatch status, and queue telemetry."
        icon={LayoutDashboard}
        actions={actionButtons}
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Outgoing Events */}
        <Link
          to="/inventory/integrations/outgoing"
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 hover:border-cyan-500/50 transition block"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500 dark:text-zinc-400">Outgoing Published</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">{data.outbox.published}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800/80 pt-2.5">
            <span>Pending Relay:</span>
            <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{data.outbox.pending}</span>
          </div>
        </Link>

        {/* Incoming Events */}
        <Link
          to="/inventory/integrations/incoming"
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 hover:border-cyan-500/50 transition block"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500 dark:text-zinc-400">Incoming Processed</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">{data.inbox.processed}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800/80 pt-2.5">
            <span>Idempotent Deduplication:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Guaranteed</span>
          </div>
        </Link>

        {/* Failed Events / DLQ */}
        <Link
          to="/inventory/integrations/failed"
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 hover:border-rose-500/50 transition block"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500 dark:text-zinc-400">Failed / DLQ Errors</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">{data.dlq.unresolved}</p>
            </div>
            <div className={`p-2.5 rounded-lg ${data.dlq.unresolved > 0 ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400" : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500"}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800/80 pt-2.5">
            <span>Resolved Failures:</span>
            <span className="font-semibold tabular-nums text-slate-700 dark:text-zinc-300">{data.dlq.resolved}</span>
          </div>
        </Link>

        {/* In-Transit Count */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500 dark:text-zinc-400">Active In-Transit</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">{data.in_transit_count}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800/80 pt-2.5">
            <span>Transfer Shipments:</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">Monitored</span>
          </div>
        </div>
      </div>

      {/* Recent Streams Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Outbox */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex min-w-0 items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Recent Outgoing Events</h3>
            </div>
            <Link
              to="/inventory/integrations/outgoing"
              className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex shrink-0 items-center gap-1 font-medium"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {data.recent_outbox && data.recent_outbox.length > 0 ? (
              data.recent_outbox.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-lg flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold truncate">{evt.event_type}</div>
                    <div className="text-slate-500 dark:text-zinc-400 mt-0.5 truncate">Aggregate: {evt.aggregate_type} ({evt.aggregate_id})</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-semibold ${
                        evt.status === "PUBLISHED"
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40"
                          : evt.status === "PENDING"
                          ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40"
                          : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40"
                      }`}
                    >
                      {evt.status}
                    </span>
                    <div className="text-[10px] tabular-nums whitespace-nowrap text-slate-400 dark:text-zinc-500 mt-1">
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400 dark:text-zinc-500 text-xs">No recent outgoing events recorded.</div>
            )}
          </div>
        </div>

        {/* Recent Inbox */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex min-w-0 items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Recent Incoming Events</h3>
            </div>
            <Link
              to="/inventory/integrations/incoming"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex shrink-0 items-center gap-1 font-medium"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {data.recent_inbox && data.recent_inbox.length > 0 ? (
              data.recent_inbox.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-lg flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-indigo-700 dark:text-indigo-300 font-semibold truncate">{evt.event_type}</div>
                    <div className="text-slate-500 dark:text-zinc-400 mt-0.5 truncate">Source: {evt.event_source}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-semibold ${
                        evt.status === "PROCESSED"
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40"
                          : evt.status === "PROCESSING"
                          ? "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/40"
                          : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40"
                      }`}
                    >
                      {evt.status}
                    </span>
                    <div className="text-[10px] tabular-nums whitespace-nowrap text-slate-400 dark:text-zinc-500 mt-1">
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400 dark:text-zinc-500 text-xs">No recent incoming events received.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default IntegrationDashboardPage;

