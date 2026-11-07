import React, { useState, useEffect } from "react";
import { Users, Plus, Shield, Check, X, Search, Filter, Lock } from "lucide-react";
import {
  SecurityHeader,
  SecurityStatCard,
  SecurityNavPills,
  StatusBadge,
} from "./securityComponents";
import {
  fetchUserAccess,
  createUserAccess,
  assignUserRoles,
  toggleUserStatus,
  fetchRoles,
  fetchSecurityMetrics,
} from "../../services/securityApi";

export function UserAccessPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);

  // Create form state
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    company_id: "APEX-GLOBAL",
    branch_id: "HQ-PLANT",
    role_ids: [],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [uData, rData, mData] = await Promise.all([
        fetchUserAccess({ search, status: statusFilter }),
        fetchRoles(),
        fetchSecurityMetrics(),
      ]);
      setUsers(uData.results || uData || []);
      setRoles(rData.results || rData || []);
      setMetrics(mData.metrics || null);
    } catch (err) {
      console.error("Failed to load user access records:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await createUserAccess(newUser);
      setShowCreateModal(false);
      setNewUser({
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        password: "",
        company_id: "APEX-GLOBAL",
        branch_id: "HQ-PLANT",
        role_ids: [],
      });
      loadData();
    } catch (err) {
      alert(err.message || "Failed to create user access");
    }
  };

  const handleAssignRoles = async (e) => {
    e.preventDefault();
    if (!roleModalUser) return;
    try {
      await assignUserRoles(roleModalUser.id, selectedRoleIds);
      setRoleModalUser(null);
      loadData();
    } catch (err) {
      alert(err.message || "Failed to update roles");
    }
  };

  const handleStatusToggle = async (user, newStatus) => {
    if (!window.confirm(`Are you sure you want to change status to ${newStatus}?`)) return;
    try {
      await toggleUserStatus(user.id, newStatus, "Admin status toggle");
      loadData();
    } catch (err) {
      alert(err.message || "Failed to update user status");
    }
  };

  return (
    <div className="space-y-6">
      <SecurityHeader
        title="User Access Management"
        subtitle="Control identity access, company and branch membership, and role grants."
        icon={Users}
        action={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New User Access
          </button>
        }
      />

      <SecurityNavPills activeTab="users" />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SecurityStatCard
          label="Total Users"
          value={metrics?.total_users ?? 0}
          subtext="Identity logins"
          icon={Users}
          tone="blue"
        />
        <SecurityStatCard
          label="Active Memberships"
          value={metrics?.active_memberships ?? 0}
          subtext="Authorized org seats"
          icon={Shield}
          tone="emerald"
        />
        <SecurityStatCard
          label="Assigned Roles"
          value={metrics?.total_roles ?? 0}
          subtext="Enterprise roles"
          icon={Lock}
          tone="purple"
        />
        <SecurityStatCard
          label="Warehouse Grants"
          value={metrics?.total_warehouse_grants ?? 0}
          subtext="Facility access rules"
          icon={Shield}
          tone="amber"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search username, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:outline-hidden"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Company & Branch</th>
                <th className="py-3.5 px-4">Assigned Roles</th>
                <th className="py-3.5 px-4">Warehouse Access</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading user access records...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No user access memberships found.
                  </td>
                </tr>
              ) : (
                users.map((mem) => {
                  const u = mem.user_details || {};
                  return (
                    <tr key={mem.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-zinc-100">
                          {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-700 dark:text-zinc-300">{mem.company_id}</div>
                        <div className="text-[11px] text-slate-400">{mem.branch_id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(mem.roles || []).map((r) => (
                            <span
                              key={r.id}
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50"
                            >
                              {r.name}
                            </span>
                          ))}
                          {(!mem.roles || mem.roles.length === 0) && (
                            <span className="text-[11px] text-slate-400 italic">No roles</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-600 dark:text-zinc-400">
                          {mem.warehouse_grants?.length || 0} warehouse(s)
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={mem.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setRoleModalUser(mem);
                              setSelectedRoleIds((mem.roles || []).map((r) => r.id));
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 cursor-pointer"
                          >
                            Roles
                          </button>
                          {mem.status === "ACTIVE" ? (
                            <button
                              onClick={() => handleStatusToggle(mem, "SUSPENDED")}
                              className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 cursor-pointer"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusToggle(mem, "ACTIVE")}
                              className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 cursor-pointer"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Access Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-4">Grant New User Access</h3>
            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Username *</label>
                <input
                  required
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Email *</label>
                <input
                  required
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">First Name</label>
                  <input
                    type="text"
                    value={newUser.first_name}
                    onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={newUser.last_name}
                    onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Company Code</label>
                  <input
                    type="text"
                    value={newUser.company_id}
                    onChange={(e) => setNewUser({ ...newUser, company_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Branch Code</label>
                  <input
                    type="text"
                    value={newUser.branch_id}
                    onChange={(e) => setNewUser({ ...newUser, branch_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  Create Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Assignment Modal */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">
              Assign Roles: {roleModalUser.user_details?.username}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              Select roles to grant operational and configuration permissions.
            </p>
            <form onSubmit={handleAssignRoles} className="space-y-4">
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {roles.map((r) => {
                  const isChecked = selectedRoleIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoleIds([...selectedRoleIds, r.id]);
                          } else {
                            setSelectedRoleIds(selectedRoleIds.filter((id) => id !== r.id));
                          }
                        }}
                        className="mt-0.5 rounded-md text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">{r.name}</div>
                        <div className="text-[11px] text-slate-400">{r.description || r.code}</div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  Save Roles
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

