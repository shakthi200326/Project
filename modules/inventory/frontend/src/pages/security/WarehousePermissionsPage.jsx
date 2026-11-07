import React, { useState, useEffect } from "react";
import { Warehouse, Plus, Trash2, Search, Filter, ShieldCheck, User } from "lucide-react";
import {
  SecurityHeader,
  SecurityStatCard,
  SecurityNavPills,
  StatusBadge,
} from "./securityComponents";
import {
  fetchWarehouseAccess,
  assignWarehouseAccess,
  deleteWarehouseAccess,
  fetchUserAccess,
} from "../../services/securityApi";
import { fetchActiveWarehouses } from "../../services/goodsReceiptApi";

export function WarehousePermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [accessList, setAccessList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [viewMode, setViewMode] = useState("user-wise"); // 'user-wise' or 'warehouse-wise'
  const [search, setSearch] = useState("");

  const [showGrantModal, setShowGrantModal] = useState(false);
  const [form, setForm] = useState({
    membership_id: "",
    warehouse_id: "",
    access_level: "READ_ONLY",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [waData, whData, memData] = await Promise.all([
        fetchWarehouseAccess({ search }),
        fetchActiveWarehouses().catch(() => []),
        fetchUserAccess(),
      ]);
      setAccessList(waData.results || waData || []);
      setWarehouses(whData || []);
      setMemberships(memData.results || memData || []);
    } catch (err) {
      console.error("Failed to load warehouse permissions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!form.membership_id || !form.warehouse_id) {
      alert("Please select both a User Membership and a Warehouse.");
      return;
    }
    try {
      await assignWarehouseAccess(form);
      setShowGrantModal(false);
      setForm({ membership_id: "", warehouse_id: "", access_level: "READ_ONLY" });
      loadData();
    } catch (err) {
      alert(err.message || "Failed to grant warehouse access");
    }
  };

  const handleRevoke = async (id, whCode, username) => {
    if (!window.confirm(`Revoke warehouse access for ${username} on ${whCode}?`)) return;
    try {
      await deleteWarehouseAccess(id);
      loadData();
    } catch (err) {
      alert(err.message || "Failed to revoke access");
    }
  };

  return (
    <div className="space-y-6">
      <SecurityHeader
        title="Warehouse-level Permissions"
        subtitle="Enforce strict facility-level boundaries across stock viewing, goods receipt, inspections, putaway, and transfers."
        icon={Warehouse}
        action={
          <button
            onClick={() => setShowGrantModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Assign Warehouse Access
          </button>
        }
      />

      <SecurityNavPills activeTab="warehouse" />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SecurityStatCard
          label="Total Grants"
          value={accessList.length}
          subtext="Active authorization rules"
          icon={ShieldCheck}
          tone="emerald"
        />
        <SecurityStatCard
          label="Active Warehouses"
          value={warehouses.length}
          subtext="Configured facilities"
          icon={Warehouse}
          tone="blue"
        />
        <SecurityStatCard
          label="Full Access Seats"
          value={accessList.filter((a) => a.access_level === "FULL_ACCESS").length}
          subtext="Administrative facility grants"
          icon={ShieldCheck}
          tone="purple"
        />
        <SecurityStatCard
          label="Operational Seats"
          value={accessList.filter((a) => a.access_level === "OPERATIONAL").length}
          subtext="Receiving & transfer handlers"
          icon={ShieldCheck}
          tone="amber"
        />
      </div>

      {/* Filter and View Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search user, warehouse code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("user-wise")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
              viewMode === "user-wise"
                ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300"
            }`}
          >
            User-wise View
          </button>
          <button
            onClick={() => setViewMode("warehouse-wise")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
              viewMode === "warehouse-wise"
                ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300"
            }`}
          >
            Warehouse-wise View
          </button>
        </div>
      </div>

      {/* Access Grants Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Warehouse</th>
                <th className="py-3.5 px-4">Access Level</th>
                <th className="py-3.5 px-4">Effective Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading warehouse permissions...
                  </td>
                </tr>
              ) : accessList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No warehouse access grants found.
                  </td>
                </tr>
              ) : (
                accessList.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-zinc-100">{a.user_full_name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{a.user_email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-zinc-200 font-mono">{a.warehouse_code}</div>
                      <div className="text-[11px] text-slate-400">{a.warehouse_name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={a.access_level} />
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                      {a.valid_from} {a.valid_until ? `to ${a.valid_until}` : "(Indefinite)"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {a.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleRevoke(a.id, a.warehouse_code, a.username)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        title="Revoke Warehouse Access"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant Access Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">Grant Warehouse Access</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              Authorize a user membership to access inventory records and operations at a warehouse.
            </p>

            <form onSubmit={handleGrant} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Select User *</label>
                <select
                  required
                  value={form.membership_id}
                  onChange={(e) => setForm({ ...form, membership_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                >
                  <option value="">Choose User Membership...</option>
                  {memberships.map((m) => {
                    const u = m.user_details || {};
                    return (
                      <option key={m.id} value={m.id}>
                        {u.username} — {u.email} ({m.company_id}/{m.branch_id})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Select Warehouse *</label>
                <select
                  required
                  value={form.warehouse_id}
                  onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                >
                  <option value="">Choose Warehouse Facility...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} - {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Access Level *</label>
                <select
                  required
                  value={form.access_level}
                  onChange={(e) => setForm({ ...form, access_level: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                >
                  <option value="READ_ONLY">READ_ONLY (View stock, balances, and reports)</option>
                  <option value="OPERATIONAL">OPERATIONAL (Receipts, counts, transfers, putaway)</option>
                  <option value="FULL_ACCESS">FULL_ACCESS (Post, reverse, approve, configure)</option>
                  <option value="NO_ACCESS">NO_ACCESS (Explicit Deny)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  Save Grant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

