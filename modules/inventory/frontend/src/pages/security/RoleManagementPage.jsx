import React, { useState, useEffect } from "react";
import { KeyRound, Plus, Copy, Trash2, Edit2, Shield, Search, Lock } from "lucide-react";
import {
  SecurityHeader,
  SecurityStatCard,
  SecurityNavPills,
  StatusBadge,
} from "./securityComponents";
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  cloneRole,
  fetchPermissions,
  fetchSecurityMetrics,
} from "../../services/securityApi";

export function RoleManagementPage() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [search, setSearch] = useState("");

  const [modalMode, setModalMode] = useState(null); // 'create', 'edit', 'clone'
  const [selectedRole, setSelectedRole] = useState(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    permission_codes: [],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, pData, mData] = await Promise.all([
        fetchRoles({ search }),
        fetchPermissions(),
        fetchSecurityMetrics(),
      ]);
      setRoles(rData.results || rData || []);
      setPermissions(pData.results || pData || []);
      setMetrics(mData.metrics || null);
    } catch (err) {
      console.error("Failed to load roles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const openCreateModal = () => {
    setForm({ code: "", name: "", description: "", permission_codes: [] });
    setModalMode("create");
    setSelectedRole(null);
  };

  const openEditModal = (role) => {
    setSelectedRole(role);
    setForm({
      code: role.code,
      name: role.name,
      description: role.description || "",
      permission_codes: role.permission_codes || [],
    });
    setModalMode("edit");
  };

  const openCloneModal = (role) => {
    setSelectedRole(role);
    setForm({
      code: `${role.code}-COPY`,
      name: `${role.name} (Copy)`,
      description: role.description || "",
      permission_codes: role.permission_codes || [],
    });
    setModalMode("clone");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === "create") {
        await createRole(form);
      } else if (modalMode === "edit") {
        await updateRole(selectedRole.id, form);
      } else if (modalMode === "clone") {
        await cloneRole(selectedRole.id, { code: form.code, name: form.name });
      }
      setModalMode(null);
      loadData();
    } catch (err) {
      alert(err.message || "Failed to process role action");
    }
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`Are you sure you want to delete role '${role.name}'?`)) return;
    try {
      await deleteRole(role.id);
      loadData();
    } catch (err) {
      alert(err.message || "Failed to delete role");
    }
  };

  const togglePermission = (code) => {
    if (form.permission_codes.includes(code)) {
      setForm({
        ...form,
        permission_codes: form.permission_codes.filter((c) => c !== code),
      });
    } else {
      setForm({
        ...form,
        permission_codes: [...form.permission_codes, code],
      });
    }
  };

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, p) => {
    acc[p.module] = acc[p.module] || [];
    acc[p.module].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <SecurityHeader
        title="Role Management"
        subtitle="Define enterprise roles, assign capability sets, and maintain separation of responsibilities."
        icon={KeyRound}
        action={
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create Role
          </button>
        }
      />

      <SecurityNavPills activeTab="roles" />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SecurityStatCard
          label="Total Roles"
          value={metrics?.total_roles ?? 0}
          subtext="Configured roles"
          icon={KeyRound}
          tone="purple"
        />
        <SecurityStatCard
          label="Catalog Permissions"
          value={metrics?.total_permissions ?? 0}
          subtext="Discrete grants"
          icon={Shield}
          tone="blue"
        />
        <SecurityStatCard
          label="Active Users"
          value={metrics?.total_users ?? 0}
          subtext="Role assignees"
          icon={Lock}
          tone="emerald"
        />
        <SecurityStatCard
          label="System Roles"
          value={roles.filter((r) => r.is_system_role).length}
          subtext="Protected policies"
          icon={Shield}
          tone="amber"
        />
      </div>

      {/* Search & Actions */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search role name, code, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Role Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading roles...</div>
        ) : roles.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">No roles configured.</div>
        ) : (
          roles.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{r.name}</h3>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">{r.code}</div>
                  </div>
                  {r.is_system_role && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60">
                      System
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-3 line-clamp-2">
                  {r.description || "No description provided."}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                  <span>{r.permissions_count || 0} permissions</span>
                  <span>{r.users_count || 0} user(s) assigned</span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-end gap-2">
                <button
                  onClick={() => openCloneModal(r)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                  title="Clone Role"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => openEditModal(r)}
                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                  title="Edit Role & Permissions"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                {!r.is_system_role && (
                  <button
                    onClick={() => handleDelete(r)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                    title="Delete Role"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Role Create / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">
              {modalMode === "create" && "Create New Role"}
              {modalMode === "edit" && `Edit Role: ${selectedRole?.name}`}
              {modalMode === "clone" && `Clone Role: ${selectedRole?.name}`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              Configure role metadata and select permissions.
            </p>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Role Code *</label>
                  <input
                    required
                    disabled={modalMode === "edit" && selectedRole?.is_system_role}
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Role Name *</label>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                />
              </div>

              {/* Permissions Checklist */}
              {modalMode !== "clone" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-2">
                    Assigned Permissions ({form.permission_codes.length} selected)
                  </label>
                  <div className="space-y-4 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/30">
                    {Object.entries(groupedPermissions).map(([mod, perms]) => (
                      <div key={mod} className="space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-200/60 dark:border-zinc-800/60 pb-1">
                          Module: {mod}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {perms.map((p) => {
                            const isChecked = form.permission_codes.includes(p.code);
                            return (
                              <label
                                key={p.id}
                                className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(p.code)}
                                  className="mt-0.5 rounded-md text-blue-600"
                                />
                                <div>
                                  <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">{p.name}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{p.code}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

