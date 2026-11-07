import React, { useState, useEffect } from "react";
import { FileText, Search, Clock, CheckCircle2, ChevronRight, User } from "lucide-react";
import {
  SecurityHeader,
  SecurityStatCard,
  SecurityNavPills,
  StatusBadge,
} from "./securityComponents";
import {
  fetchDocumentAuditEvents,
  fetchDocumentTimeline,
} from "../../services/securityApi";

export function DocumentAuditTrailPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedDocType, setSelectedDocType] = useState("");
  const [timelineDocNumber, setTimelineDocNumber] = useState("");
  const [timelineEvents, setTimelineEvents] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchDocumentAuditEvents({
        search,
        document_type: selectedDocType,
      });
      setEvents(data.results || data || []);
    } catch (err) {
      console.error("Failed to load document audit events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedDocType]);

  const viewTimeline = async (docNumber) => {
    setTimelineDocNumber(docNumber);
    try {
      const res = await fetchDocumentTimeline(docNumber);
      setTimelineEvents(res.events || []);
    } catch (err) {
      alert("Failed to load document timeline");
    }
  };

  return (
    <div className="space-y-6">
      <SecurityHeader
        title="Document Audit Trail"
        subtitle="End-to-end lifecycle verification tracking document state transitions from creation to final stock posting and reversal."
        icon={FileText}
      />

      <SecurityNavPills activeTab="audit" />

      {/* Interactive Timeline Modal */}
      {timelineEvents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-zinc-800/80">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  Document Timeline: {timelineDocNumber}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Chronological lifecycle progression and approval signatures
                </p>
              </div>
              <button
                onClick={() => setTimelineEvents(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-5 space-y-6">
              {timelineEvents.map((evt, idx) => (
                <div key={evt.id} className="relative flex items-start gap-4">
                  {idx < timelineEvents.length - 1 && (
                    <div className="absolute left-3.5 top-7 bottom-0 w-0.5 bg-slate-200 dark:bg-zinc-800 -mb-6" />
                  )}
                  <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">{evt.action}</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(evt.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                      <span>Status transition:</span>
                      <span className="font-semibold text-slate-500">{evt.previous_status || "INITIAL"}</span>
                      <ChevronRight className="h-3 w-3 text-slate-400" />
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{evt.new_status}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-400" />
                      <span>Performed by: <b className="text-slate-700 dark:text-zinc-300">{evt.performed_by}</b></span>
                    </div>
                    {evt.remarks && (
                      <div className="mt-2 text-xs italic text-slate-600 dark:text-zinc-400 p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                        "{evt.remarks}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200/80 dark:border-zinc-800/80">
              <button
                onClick={() => setTimelineEvents(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search document no, performed by, remarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
          >
            <option value="">All Document Types</option>
            <option value="Goods Receipt">Goods Receipt</option>
            <option value="Stock Transfer">Stock Transfer</option>
            <option value="Stock Adjustment">Stock Adjustment</option>
            <option value="Stock Issue">Stock Issue</option>
            <option value="Physical Count">Physical Count</option>
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                <th className="py-3.5 px-4">Document Number</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Status Transition</th>
                <th className="py-3.5 px-4">Performed By</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4 text-right">Timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading document audit events...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No document audit events recorded.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {evt.document_number}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-zinc-200">
                      {evt.document_type}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-zinc-300">
                      {evt.action}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400">
                        <span>{evt.previous_status || "INITIAL"}</span>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-semibold text-slate-900 dark:text-zinc-100">{evt.new_status}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-zinc-100">
                      {evt.performed_by}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(evt.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => viewTimeline(evt.document_number)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 cursor-pointer"
                      >
                        View Lifecycle
                      </button>
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

