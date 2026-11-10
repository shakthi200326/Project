import React, { useState, useEffect } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Settings,
  ShieldAlert,
  Server,
  Zap,
  Filter,
  Search,
  ExternalLink,
  ChevronRight,
  Database,
  Truck,
  RotateCcw,
  Check,
  X,
} from "lucide-react";
import { ScrollableTabs } from "../../components/ScrollableTabs.jsx";

export function IntegrationHubPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
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

  // Outbox Tab State
  const [outboxEvents, setOutboxEvents] = useState([]);
  const [outboxStatusFilter, setOutboxStatusFilter] = useState("ALL");
  const [outboxSearch, setOutboxSearch] = useState("");

  // Inbox Tab State
  const [inboxEvents, setInboxEvents] = useState([]);
  const [inboxStatusFilter, setInboxStatusFilter] = useState("ALL");
  const [inboxSearch, setInboxSearch] = useState("");

  // DLQ Tab State
  const [dlqErrors, setDlqErrors] = useState([]);
  const [retryingId, setRetryingId] = useState(null);

  // Payload Viewer Modal
  const [selectedPayload, setSelectedPayload] = useState(null);

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    enable_purchase_integration: true,
    enable_sales_integration: true,
    enable_low_stock_alerts: true,
    outbox_poll_interval_seconds: 5,
    outbox_batch_size: 50,
    max_retry_attempts: 5,
    backoff_multiplier: 2.0,
    dead_letter_threshold: 5,
    low_stock_suppression_hours: 24,
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Simulator State
  const [simForm, setSimForm] = useState({
    type: "purchase.goods_received",
    itemCode: "BRG-6205",
    quantity: 50,
    unitCost: 18.5,
    orderId: "PO-2026-" + Math.floor(1000 + Math.random() * 9000),
    customer: "Global Heavy Industries",
    warehouseCode: "WH-MAIN",
  });
  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // Load Dashboard Data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/inventory/integrations/dashboard/");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.settings) {
          setSettingsForm(json.settings);
        }
      }
    } catch (err) {
      console.error("Failed to load integration dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOutbox = async () => {
    try {
      const res = await fetch("/api/v1/inventory/integrations/outbox/");
      if (res.ok) {
        const json = await res.json();
        setOutboxEvents(json.results || json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchInbox = async () => {
    try {
      const res = await fetch("/api/v1/inventory/integrations/inbox/");
      if (res.ok) {
        const json = await res.json();
        setInboxEvents(json.results || json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDlq = async () => {
    try {
      const res = await fetch("/api/v1/inventory/integrations/errors/");
      if (res.ok) {
        const json = await res.json();
        setDlqErrors(json.results || json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === "outbox") fetchOutbox();
    if (activeTab === "inbox") fetchInbox();
    if (activeTab === "dlq") fetchDlq();
  }, [activeTab]);

  // Drain Outbox Handler
  const handleDrainOutbox = async () => {
    try {
      const res = await fetch("/api/v1/inventory/integrations/outbox/drain/", { method: "POST" });
      if (res.ok) {
        fetchDashboardData();
        if (activeTab === "outbox") fetchOutbox();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Force Publish Single Outbox Event
  const handlePublishNow = async (id) => {
    try {
      const res = await fetch(`/api/v1/inventory/integrations/outbox/${id}/publish-now/`, { method: "POST" });
      if (res.ok) {
        fetchOutbox();
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Retry DLQ Error
  const handleRetryDlq = async (id) => {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/v1/inventory/integrations/errors/${id}/retry/`, { method: "POST" });
      if (res.ok) {
        fetchDlq();
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRetryingId(null);
    }
  };

  // Resolve DLQ Error
  const handleResolveDlq = async (id) => {
    try {
      const res = await fetch(`/api/v1/inventory/integrations/errors/${id}/resolve/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Resolved manually by operator from UI" }),
      });
      if (res.ok) {
        fetchDlq();
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/inventory/integrations/settings/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      if (res.ok) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Run Simulator
  const handleRunSimulation = async (e) => {
    e.preventDefault();
    setSimulating(true);
    setSimResult(null);

    let payload = {};
    if (simForm.type === "purchase.goods_received") {
      payload = {
        purchase_order_id: simForm.orderId,
        grn_number: "GRN-" + simForm.orderId,
        warehouse_code: simForm.warehouseCode,
        supplier: "Global Industrial Bearings",
        lines: [
          {
            item_code: simForm.itemCode,
            quantity: Number(simForm.quantity),
            unit_cost: Number(simForm.unitCost),
          },
        ],
      };
    } else if (simForm.type === "sales.order_confirmed") {
      payload = {
        sales_order_id: simForm.orderId,
        customer: simForm.customer,
        warehouse_code: simForm.warehouseCode,
        lines: [
          {
            item_code: simForm.itemCode,
            quantity: Number(simForm.quantity),
          },
        ],
      };
    } else if (simForm.type === "sales.order_dispatched") {
      payload = {
        sales_order_id: simForm.orderId,
        dispatch_ref: "DSP-" + simForm.orderId,
        warehouse_code: simForm.warehouseCode,
        lines: [
          {
            item_code: simForm.itemCode,
            quantity: Number(simForm.quantity),
          },
        ],
      };
    } else if (simForm.type === "sales.order_cancelled") {
      payload = {
        sales_order_id: simForm.orderId,
      };
    }

    try {
      const res = await fetch("/api/v1/inventory/integrations/simulate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: simForm.type,
          payload: payload,
        }),
      });
      const json = await res.json();
      setSimResult({ ok: res.ok, data: json });
      fetchDashboardData();
    } catch (err) {
      setSimResult({ ok: false, error: String(err) });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
            <Zap className="w-4 h-4" />
            <span>Event-Driven Architecture & Integration Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Integration Hub & Transactional Outbox
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            PostgreSQL 16 Multi-Schema • Celery Async Workers • CloudEvents 1.0 • Idempotent Inbox • Dead-Letter Queue
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDrainOutbox}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition shadow-lg shadow-cyan-900/30 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Drain Outbox Now
          </button>
          <button
            onClick={() => {
              fetchDashboardData();
              if (activeTab === "outbox") fetchOutbox();
              if (activeTab === "inbox") fetchInbox();
              if (activeTab === "dlq") fetchDlq();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition border border-slate-700 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Architecture Badges Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 flex items-center gap-3">
          <div className="p-2 rounded bg-indigo-500/10 text-indigo-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Database Engine</div>
            <div className="text-sm font-semibold text-white">PostgreSQL 16 / 18</div>
          </div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 flex items-center gap-3">
          <div className="p-2 rounded bg-emerald-500/10 text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Schema Isolation</div>
            <div className="text-sm font-semibold text-white">inventory & shared</div>
          </div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-500/10 text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Event Standard</div>
            <div className="text-sm font-semibold text-white">CloudEvents 1.0</div>
          </div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 flex items-center gap-3">
          <div className="p-2 rounded bg-amber-500/10 text-amber-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Task Queue</div>
            <div className="text-sm font-semibold text-white">Celery & Redis</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <ScrollableTabs stripClassName="flex border-b border-slate-800 space-x-1" role="group">
        {[
          { id: "dashboard", label: "Dashboard & Metrics", icon: Activity },
          { id: "outbox", label: `Outbox Events (${data.outbox.total || 0})`, icon: ArrowUpRight },
          { id: "inbox", label: `Inbound Events (${data.inbox.total || 0})`, icon: ArrowDownLeft },
          {
            id: "dlq",
            label: `Dead-Letter Queue (${data.dlq.unresolved || 0})`,
            icon: ShieldAlert,
            badge: data.dlq.unresolved > 0 ? data.dlq.unresolved : null,
          },
          { id: "simulator", label: "Integration Simulator", icon: Zap },
          { id: "settings", label: "Integration Settings", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-rose-500 text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </ScrollableTabs>

      {/* TAB 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs uppercase font-medium text-slate-400">Outbox Published</p>
                  <p className="text-2xl font-bold text-white mt-1">{data.outbox.published}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2.5">
                <span>Pending dispatch:</span>
                <span className="font-semibold text-amber-400">{data.outbox.pending}</span>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs uppercase font-medium text-slate-400">Inbound Processed</p>
                  <p className="text-2xl font-bold text-white mt-1">{data.inbox.processed}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2.5">
                <span>Idempotent deduplication:</span>
                <span className="font-semibold text-emerald-400">Active</span>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs uppercase font-medium text-slate-400">Dead-Letter DLQ</p>
                  <p className="text-2xl font-bold text-white mt-1">{data.dlq.unresolved}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${data.dlq.unresolved > 0 ? "bg-rose-500/10 text-rose-400" : "bg-slate-800 text-slate-400"}`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2.5">
                <span>Resolved errors:</span>
                <span className="font-semibold text-slate-300">{data.dlq.resolved}</span>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs uppercase font-medium text-slate-400">Stock In-Transit</p>
                  <p className="text-2xl font-bold text-white mt-1">{data.in_transit_count}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2.5">
                <span>Source to destination:</span>
                <span className="font-semibold text-indigo-400">Tracked</span>
              </div>
            </div>
          </div>

          {/* Quick Overview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Outbox */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-white">Recent Outbox Events</h3>
                </div>
                <button
                  onClick={() => setActiveTab("outbox")}
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {data.recent_outbox && data.recent_outbox.length > 0 ? (
                  data.recent_outbox.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-mono text-cyan-300 font-semibold">{evt.event_type}</div>
                        <div className="text-slate-400 mt-0.5">Aggregate: {evt.aggregate_type} ({evt.aggregate_id})</div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            evt.status === "PUBLISHED"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : evt.status === "PENDING"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {evt.status}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-1">
                          {new Date(evt.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-500 text-xs">No recent outbox events recorded.</div>
                )}
              </div>
            </div>

            {/* Recent Inbox */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-semibold text-white">Recent Inbound Events</h3>
                </div>
                <button
                  onClick={() => setActiveTab("inbox")}
                  className="text-xs text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {data.recent_inbox && data.recent_inbox.length > 0 ? (
                  data.recent_inbox.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-mono text-indigo-300 font-semibold">{evt.event_type}</div>
                        <div className="text-slate-400 mt-0.5">Source: {evt.event_source}</div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            evt.status === "PROCESSED"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : evt.status === "PROCESSING"
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {evt.status}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-1">
                          {new Date(evt.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-500 text-xs">No recent inbound events received.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OUTBOX EVENTS */}
      {activeTab === "outbox" && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search event ID, type..."
                  value={outboxSearch}
                  onChange={(e) => setOutboxSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <select
                value={outboxStatusFilter}
                onChange={(e) => setOutboxStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 px-3 py-1.5 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PUBLISHED">Published</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
            <button
              onClick={handleDrainOutbox}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Drain Outbox
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Event ID</th>
                  <th className="p-3">Aggregate</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Retries</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {outboxEvents
                  .filter((e) => outboxStatusFilter === "ALL" || e.status === outboxStatusFilter)
                  .filter((e) => !outboxSearch || e.event_type.toLowerCase().includes(outboxSearch.toLowerCase()) || e.event_id.includes(outboxSearch))
                  .map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-medium text-cyan-300">{evt.event_type}</td>
                      <td className="p-3 font-mono text-slate-400">{evt.event_id.slice(0, 16)}...</td>
                      <td className="p-3 text-slate-300">
                        {evt.aggregate_type}: <span className="font-mono text-slate-400">{evt.aggregate_id}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            evt.status === "PUBLISHED"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : evt.status === "PENDING"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {evt.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400">{evt.retry_count} / {evt.max_retries}</td>
                      <td className="p-3 text-slate-400">{new Date(evt.created_at).toLocaleString()}</td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => setSelectedPayload(evt.payload)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                        >
                          Payload
                        </button>
                        {evt.status !== "PUBLISHED" && (
                          <button
                            onClick={() => handlePublishNow(evt.id)}
                            className="px-2 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-medium cursor-pointer"
                          >
                            Publish Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INBOUND EVENTS */}
      {activeTab === "inbox" && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search inbound ID, type..."
                  value={inboxSearch}
                  onChange={(e) => setInboxSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <select
                value={inboxStatusFilter}
                onChange={(e) => setInboxStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 px-3 py-1.5 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PROCESSED">Processed</option>
                <option value="PROCESSING">Processing</option>
                <option value="FAILED">Failed</option>
                <option value="DEAD_LETTER">Dead Letter</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Event ID</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Received At</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {inboxEvents
                  .filter((e) => inboxStatusFilter === "ALL" || e.status === inboxStatusFilter)
                  .filter((e) => !inboxSearch || e.event_type.toLowerCase().includes(inboxSearch.toLowerCase()) || e.event_id.includes(inboxSearch))
                  .map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-medium text-indigo-300">{evt.event_type}</td>
                      <td className="p-3 font-mono text-slate-400">{evt.event_id.slice(0, 16)}...</td>
                      <td className="p-3 text-slate-300">{evt.event_source}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            evt.status === "PROCESSED"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : evt.status === "PROCESSING"
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {evt.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400">{evt.attempts ? evt.attempts.length : 1}</td>
                      <td className="p-3 text-slate-400">{new Date(evt.created_at).toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedPayload(evt.payload)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                        >
                          View Data
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DEAD-LETTER QUEUE (DLQ) */}
      {activeTab === "dlq" && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-rose-300 text-sm">Dead-Letter Queue Management</h4>
              <p className="text-xs text-rose-200/80 mt-1">
                Events that have exceeded maximum retry thresholds or experienced non-transient processing failures
                are quarantined here. Operators can inspect the root cause stack trace and perform safe manual replay.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Direction</th>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Error Reason</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Retries</th>
                  <th className="p-3">Logged At</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {dlqErrors.length > 0 ? (
                  dlqErrors.map((err) => (
                    <tr key={err.id} className="hover:bg-slate-800/40">
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${err.direction === "INBOUND" ? "bg-indigo-500/20 text-indigo-400" : "bg-cyan-500/20 text-cyan-400"}`}>
                          {err.direction}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-medium text-slate-200">{err.event_type}</td>
                      <td className="p-3 text-rose-300 max-w-xs truncate" title={err.error_message}>
                        {err.error_message}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${err.status === "UNRESOLVED" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                          {err.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{err.retry_count}</td>
                      <td className="p-3 text-slate-400">{new Date(err.created_at).toLocaleString()}</td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => setSelectedPayload({ error: err.error_message, stack_trace: err.stack_trace, payload: err.payload })}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                        >
                          Trace
                        </button>
                        {err.status === "UNRESOLVED" && (
                          <>
                            <button
                              onClick={() => handleRetryDlq(err.id)}
                              disabled={retryingId === err.id}
                              className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white text-xs font-medium cursor-pointer"
                            >
                              {retryingId === err.id ? "Retrying..." : "Retry Event"}
                            </button>
                            <button
                              onClick={() => handleResolveDlq(err.id)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-medium cursor-pointer"
                            >
                              Resolve
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                      No errors in Dead-Letter Queue. System healthy!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: INTEGRATION SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-white">Event Simulation Workbench</h3>
            </div>
            <p className="text-xs text-slate-400">
              Trigger simulated cross-module events from Purchase or Sales modules to verify end-to-end
              inventory stock posting, reservation, moving average calculation, and outbox generation.
            </p>

            <form onSubmit={handleRunSimulation} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Select Integration Event Contract:</label>
                <select
                  value={simForm.type}
                  onChange={(e) => setSimForm({ ...simForm, type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="purchase.goods_received">purchase.goods_received (PO Receipt / GRN Intake)</option>
                  <option value="sales.order_confirmed">sales.order_confirmed (Lock & Soft-Reserve Stock)</option>
                  <option value="sales.order_dispatched">sales.order_dispatched (Execute Physical Issue)</option>
                  <option value="sales.order_cancelled">sales.order_cancelled (Release Reservation)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Order / Reference ID:</label>
                  <input
                    type="text"
                    value={simForm.orderId}
                    onChange={(e) => setSimForm({ ...simForm, orderId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Warehouse Code:</label>
                  <input
                    type="text"
                    value={simForm.warehouseCode}
                    onChange={(e) => setSimForm({ ...simForm, warehouseCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Item Code:</label>
                  <input
                    type="text"
                    value={simForm.itemCode}
                    onChange={(e) => setSimForm({ ...simForm, itemCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Quantity:</label>
                  <input
                    type="number"
                    value={simForm.quantity}
                    onChange={(e) => setSimForm({ ...simForm, quantity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Unit Cost ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={simForm.unitCost}
                    onChange={(e) => setSimForm({ ...simForm, unitCost: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={simulating}
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-900/40"
              >
                <Zap className="w-4 h-4" />
                {simulating ? "Executing Engine Pipeline..." : "Dispatch Simulated Event"}
              </button>
            </form>
          </div>

          {/* Simulation Output Display */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col">
            <h3 className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Execution Response & Inventory Mutation Result
            </h3>
            <div className="flex-1 bg-slate-950 rounded-lg p-4 font-mono text-xs overflow-auto border border-slate-800 text-slate-300">
              {simResult ? (
                <pre>{JSON.stringify(simResult, null, 2)}</pre>
              ) : (
                <div className="text-slate-500 h-full flex items-center justify-center">
                  Configure simulation parameters and click dispatch to view real-time engine response.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SETTINGS */}
      {activeTab === "settings" && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 max-w-3xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white">Integration & Event Relay Settings</h3>
            <p className="text-xs text-slate-400 mt-1">
              Configure cross-module feature flags, retry thresholds, outbox polling parameters, and alert suppression.
            </p>
          </div>

          {settingsSaved && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
              <Check className="w-4 h-4" /> Settings updated successfully!
            </div>
          )}

          <div className="space-y-4 text-sm">
            <h4 className="font-semibold text-slate-300 uppercase text-xs tracking-wider border-b border-slate-800 pb-2">
              Module Interconnect Flags
            </h4>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.enable_purchase_integration}
                  onChange={(e) => setSettingsForm({ ...settingsForm, enable_purchase_integration: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                />
                <span className="text-slate-200">Enable Purchase Module Inbound Receipts (purchase.goods_received)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.enable_sales_integration}
                  onChange={(e) => setSettingsForm({ ...settingsForm, enable_sales_integration: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                />
                <span className="text-slate-200">Enable Sales Module Orders (Confirmation, Dispatch, Cancellation)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.enable_low_stock_alerts}
                  onChange={(e) => setSettingsForm({ ...settingsForm, enable_low_stock_alerts: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                />
                <span className="text-slate-200">Publish Outgoing Low-Stock Alerts (inventory.low_stock)</span>
              </label>
            </div>

            <h4 className="font-semibold text-slate-300 uppercase text-xs tracking-wider border-b border-slate-800 pb-2 pt-4">
              Reliability & Dead-Letter Policies
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Max Retry Attempts:</label>
                <input
                  type="number"
                  value={settingsForm.max_retry_attempts}
                  onChange={(e) => setSettingsForm({ ...settingsForm, max_retry_attempts: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Backoff Multiplier (Exponential):</label>
                <input
                  type="number"
                  step="0.1"
                  value={settingsForm.backoff_multiplier}
                  onChange={(e) => setSettingsForm({ ...settingsForm, backoff_multiplier: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Dead-Letter Threshold (Attempts):</label>
                <input
                  type="number"
                  value={settingsForm.dead_letter_threshold}
                  onChange={(e) => setSettingsForm({ ...settingsForm, dead_letter_threshold: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Low-Stock Alert Suppression Window (Hours):</label>
                <input
                  type="number"
                  value={settingsForm.low_stock_suppression_hours}
                  onChange={(e) => setSettingsForm({ ...settingsForm, low_stock_suppression_hours: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition cursor-pointer shadow-lg shadow-cyan-900/30"
          >
            Save Integration Settings
          </button>
        </form>
      )}

      {/* JSON Payload Modal */}
      {selectedPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" /> CloudEvent Payload Inspector
              </h4>
              <button
                onClick={() => setSelectedPayload(null)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
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
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
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
export default IntegrationHubPage;

