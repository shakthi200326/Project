import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, Check, Clock3, Mail, RefreshCw, Save, Settings2, Webhook } from "lucide-react";
import { API_BASE } from "../services/api";

const ALERT_TYPES = [
  ["low_stock", "Low Stock Alerts", "Items at or below their reorder threshold."],
  ["out_of_stock", "Out of Stock Alerts", "Items with no available stock."],
  ["expiry", "Expiry Alerts", "Tracked batches expiring soon or already expired."],
  ["overstock", "Overstock Alerts", "Stock exceeding a configured maximum level."],
  ["pending_receipt", "Pending Receipt Alerts", "Receipts that are overdue or awaiting processing."],
  ["pending_approval", "Pending Approval Alerts", "Submitted stock transactions awaiting approval."],
  ["stock_discrepancy", "Stock Discrepancy Alerts", "Open receipt discrepancies and submitted count variances."],
];

const DEFAULT_SETTINGS = {
  alert_types: Object.fromEntries(ALERT_TYPES.map(([key]) => [key, true])),
  channels: { in_app: true, email: false, webhook: false },
  recipient_emails: [],
  webhook_url: "",
  expiry_warning_days: 30,
  pending_receipt_days: 1,
  pending_approval_hours: 24,
};

const API = `${API_BASE}/inventory/notifications`;

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data === "string" ? data : Object.values(data).flat().join(" ");
    throw new Error(message || `Request failed (HTTP ${response.status}).`);
  }
  return data;
}

export function NotificationsAlertsPage() {
  const [tab, setTab] = useState("alerts");
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [nextPage, setNextPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const loadAlerts = useCallback(async () => {
    setError("");
    try {
      const data = await readResponse(await fetch(`${API}/alerts/?active=true`));
      setAlerts(data.results || []);
      setNextPage(data.next);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (!nextPage) return;
    setError("");
    try {
      const data = await readResponse(await fetch(nextPage));
      setAlerts((current) => [...current, ...(data.results || [])]);
      setNextPage(data.next);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadSettings = useCallback(async () => {
    try {
      const data = await readResponse(await fetch(`${API}/settings/`));
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    loadSettings();
  }, [loadAlerts, loadSettings]);

  const setAlertType = (key, value) =>
    setSettings((state) => ({ ...state, alert_types: { ...state.alert_types, [key]: value } }));
  const setChannel = (key, value) =>
    setSettings((state) => ({ ...state, channels: { ...state.channels, [key]: value } }));

  const markRead = async (id) => {
    try {
      await readResponse(await fetch(`${API}/alerts/${id}/read/`, { method: "POST" }));
      await loadAlerts();
    } catch (err) {
      setError(err.message);
    }
  };

  const markAllRead = async () => {
    try {
      await readResponse(await fetch(`${API}/alerts/read-all/`, { method: "POST" }));
      await loadAlerts();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const data = await readResponse(await fetch(`${API}/settings/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }));
      setSettings({ ...DEFAULT_SETTINGS, ...data });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const change = (key, value) => setSettings((state) => ({ ...state, [key]: value }));
  const emailText = (settings.recipient_emails || []).join("\n");

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Notifications &amp; Alerts</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Monitor inventory risks and configure delivery channels.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => (tab === "alerts" ? loadAlerts() : loadSettings())}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </header>

      <nav className="flex gap-2 border-b border-slate-200 dark:border-zinc-800" aria-label="Notification sections">
        <button
          type="button"
          onClick={() => setTab("alerts")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === "alerts" ? "border-rose-500 text-rose-600" : "border-transparent text-slate-500 dark:text-zinc-400"}`}
        >
          Alerts {unreadCount > 0 && <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700">{unreadCount}</span>}
        </button>
        <button
          type="button"
          onClick={() => setTab("settings")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === "settings" ? "border-rose-500 text-rose-600" : "border-transparent text-slate-500 dark:text-zinc-400"}`}
        >
          Settings
        </button>
      </nav>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}

      {tab === "alerts" ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-zinc-400">{loading ? "Loading alerts…" : `${alerts.length} active alert${alerts.length === 1 ? "" : "s"}`}</div>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs font-semibold text-rose-600 hover:text-rose-700">
                Mark all as read
              </button>
            )}
          </div>
          {!loading && alerts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center">
              <Check className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-white">No active alerts</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Alerts are checked automatically every five minutes.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3">
                {alerts.map((alert) => (
                <article key={alert.id} className={`rounded-xl border p-4 ${alert.severity === "CRITICAL" ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/20" : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex gap-3 min-w-0">
                      <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${alert.severity === "CRITICAL" ? "text-rose-600" : "text-amber-500"}`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{alert.title}</h2>
                          {!alert.is_read && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">NEW</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">{alert.description}</p>
                        <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400"><Clock3 className="h-3 w-3" />{new Date(alert.last_seen_at).toLocaleString()}</p>
                        <Link className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400" to={alert.action_url || "/inventory"}>
                          View details
                        </Link>
                        {alert.delivery_error && (
                          <p role="status" className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                            Delivery issue: {alert.delivery_error}
                          </p>
                        )}
                      </div>
                    </div>
                    {!alert.is_read && <button type="button" onClick={() => markRead(alert.id)} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-zinc-700 dark:text-zinc-300">Mark read</button>}
                  </div>
                </article>
                ))}
              </div>
              {nextPage && <button type="button" onClick={loadMore} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-zinc-700 dark:text-zinc-300">Load more alerts</button>}
            </>
          )}
        </section>
      ) : (
        <form onSubmit={saveSettings} className="space-y-5">
          <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-rose-600" /><h2 className="text-sm font-bold text-slate-900 dark:text-white">Alert Types</h2></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ALERT_TYPES.map(([key, title, description]) => (
                <label key={key} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 dark:border-zinc-800">
                  <input type="checkbox" checked={!!settings.alert_types?.[key]} onChange={(event) => setAlertType(key, event.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600" />
                  <span><span className="block text-xs font-semibold text-slate-800 dark:text-white">{title}</span><span className="mt-0.5 block text-[11px] text-slate-500 dark:text-zinc-400">{description}</span></span>
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberSetting label="Expiry warning (days)" value={settings.expiry_warning_days} onChange={(v) => change("expiry_warning_days", v)} />
              <NumberSetting label="Pending receipt (days)" value={settings.pending_receipt_days} onChange={(v) => change("pending_receipt_days", v)} />
              <NumberSetting label="Pending approval (hours)" value={settings.pending_approval_hours} onChange={(v) => change("pending_approval_hours", v)} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-rose-600" /><h2 className="text-sm font-bold text-slate-900 dark:text-white">Delivery Channels</h2></div>
            <div className="grid gap-2 sm:grid-cols-3">
              <ChannelToggle label="In-App Notifications" checked={settings.channels.in_app} onChange={(v) => setChannel("in_app", v)} />
              <ChannelToggle label="Email Notifications" checked={settings.channels.email} onChange={(v) => setChannel("email", v)} icon={Mail} />
              <ChannelToggle label="Webhook Notifications" checked={settings.channels.webhook} onChange={(v) => setChannel("webhook", v)} icon={Webhook} />
            </div>
            {settings.channels.email && (
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Recipient email addresses
                <textarea rows={3} value={emailText} onChange={(event) => change("recipient_emails", event.target.value.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean))} placeholder="inventory@example.com" className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" />
                <span className="mt-1 block font-normal text-slate-500 dark:text-zinc-400">Use one email per line. Email delivery uses the server's configured Django email backend.</span>
              </label>
            )}
            {settings.channels.webhook && (
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                HTTPS webhook URL
                <input type="url" required value={settings.webhook_url} onChange={(event) => change("webhook_url", event.target.value)} placeholder="https://example.com/inventory-alerts" className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" />
                <span className="mt-1 block font-normal text-slate-500 dark:text-zinc-400">The server sends a JSON alert payload to this URL.</span>
              </label>
            )}
          </section>
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-xs font-semibold text-emerald-600">Settings saved</span>}
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" />{saving ? "Saving…" : "Save Notification Settings"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function NumberSetting({ label, value, onChange }) {
  return (
    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
      {label}
      <input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" />
    </label>
  );
}

function ChannelToggle({ label, checked, onChange, icon: Icon = Bell }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 text-xs font-semibold text-slate-800 dark:border-zinc-800 dark:text-white">
      <input type="checkbox" checked={!!checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-rose-600" />
      <Icon className="h-4 w-4 text-slate-500" />{label}
    </label>
  );
}

export default NotificationsAlertsPage;
