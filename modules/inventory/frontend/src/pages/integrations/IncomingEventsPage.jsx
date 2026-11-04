import React, { useState, useEffect } from "react";
import { IntegrationTabsHeader } from "../../components/IntegrationTabsHeader";
import {
  ArrowDownLeft,
  Search,
  Filter,
  RefreshCw,
  X,
  Database,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from "lucide-react";

export function IncomingEventsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedPayload, setSelectedPayload] = useState(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/inventory/integrations/inbox/");
      if (res.ok) {
        const json = await res.json();
        setEvents(json.results || json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const filteredEvents = events
    .filter((e) => statusFilter === "ALL" || e.status === statusFilter)
    .filter((e) => !search || e.event_type.toLowerCase().includes(search.toLowerCase()) || e.event_id.includes(search));

  const actions = (
    <button
      onClick={fetchEvents}
      className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
      title="Refresh Inbox"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <IntegrationTabsHeader
        title="Incoming Events"
        subtitle="Idempotent consumer inbox receiving events from Purchase, Sales, and external partners."
        icon={ArrowDownLeft}
        actions={actions}
      />

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs space-y-4">
        {/* Controls Strip */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search inbound ID, event type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-slate-700 dark:text-zinc-300 px-3 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Statuses ({events.length})</option>
              <option value="PROCESSED">Processed</option>
              <option value="PROCESSING">Processing</option>
              <option value="FAILED">Failed</option>
              <option value="DEAD_LETTER">Dead Letter</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 dark:text-zinc-400">
            Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredEvents.length}</span> incoming event records
          </div>
        </div>

        {/* Inbound Events Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 uppercase font-semibold border-b border-slate-200 dark:border-zinc-800 text-[11px] whitespace-nowrap">
              <tr>
                <th className="p-3">Event Type</th>
                <th className="p-3">Event ID</th>
                <th className="p-3">Source Module</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Attempts</th>
                <th className="p-3">Received At</th>
                <th className="p-3 text-right">Data Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 bg-white dark:bg-zinc-900/50">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition">
                    <td className="p-3 font-mono font-medium text-indigo-700 dark:text-indigo-400">{evt.event_type}</td>
                    <td className="p-3 font-mono whitespace-nowrap text-slate-500 dark:text-zinc-400" title={evt.event_id}>
                      {evt.event_id.slice(0, 16)}...
                    </td>
                    <td className="p-3 font-medium text-slate-700 dark:text-zinc-300">{evt.event_source}</td>
                    <td className="p-3">
                      <span
                        className={`whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-semibold ${
                          evt.status === "PROCESSED"
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                            : evt.status === "PROCESSING"
                            ? "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/50"
                            : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50"
                        }`}
                      >
                        {evt.status}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-600 dark:text-zinc-400">
                      {evt.attempts ? evt.attempts.length : 1} attempt(s)
                    </td>
                    <td className="p-3 whitespace-nowrap tabular-nums text-slate-500 dark:text-zinc-400">{new Date(evt.created_at).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedPayload(evt.payload)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-medium cursor-pointer transition flex items-center gap-1.5 ml-auto"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-zinc-500 text-xs">
                    No incoming events found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payload Modal */}
      {selectedPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl max-w-2xl w-full p-5 shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-zinc-800 pb-2">
              <h4 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Inbound CloudEvent Payload
              </h4>
              <button
                onClick={() => setSelectedPayload(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-cyan-300 max-h-96 overflow-auto border border-slate-800">
              <pre>{JSON.stringify(selectedPayload, null, 2)}</pre>
            </div>
            <div className="text-right">
              <button
                onClick={() => setSelectedPayload(null)}
                className="px-4 py-1.5 rounded bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-medium cursor-pointer"
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
export default IncomingEventsPage;

