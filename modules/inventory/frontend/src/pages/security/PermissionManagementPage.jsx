import React, { useState, useEffect } from "react";
import { ShieldAlert, Search, Filter, CheckCircle2, UserCheck } from "lucide-react";
import {
  SecurityHeader,
  SecurityStatCard,
  SecurityNavPills,
} from "./securityComponents";
import {
  fetchPermissions,
  fetchPermissionCategories,
  fetchEffectivePermissions,
  fetchUserAccess,
} from "../../services/securityApi";

export function PermissionManagementPage() {
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [categories, setCategories] = useState({ modules: [], resources: [], actions: [] });
  const [search, setSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedResource, setSelectedResource] = useState("");

  // Effective permission inspector
  const [users, setUsers] = useState([]);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [effectivePerms, setEffectivePerms] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pData, catData, uData] = await Promise.all([
        fetchPermissions({ search, module: selectedModule, resource: selectedResource }),
        fetchPermissionCategories(),
        fetchUserAccess(),
      ]);
      setPermissions(pData.results || pData || []);
      setCategories(catData || { modules: [], resources: [], actions: [] });
      setUsers(uData.results || uData || []);
    } catch (err) {
      console.error("Failed to load permissions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedModule, selectedResource]);

  const inspectEffective = async (username) => {
    setSelectedUsername(username);
    if (!username) {
      setEffectivePerms(null);
      return;
    }
    try {
      const data = await fetchEffectivePermissions(username);
      setEffectivePerms(data);
    } catch (err) {
      alert("Failed to resolve effective permissions");
    }
  };

  return (
    <div className="space-y-6">
      <SecurityHeader
        title="Permission Management"
        subtitle="Inspect discrete capability definitions across modules, resources, and operational actions."
        icon={ShieldAlert}
      />

      <SecurityNavPills activeTab="permissions" />

      {/* Effective Permission Inspector Box */}
      <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">User Effective Permissions Evaluator</h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Test and verify the computed permissions for any authenticated user account.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedUsername}
              onChange={(e) => inspectEffective(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200"
            >
              <option value="">Select User to Inspect...</option>
              {users.map((mem) => {
                const u = mem.user_details || {};
                return (
                  <option key={mem.id} value={u.username}>
                    {u.username} ({mem.company_id})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {effectivePerms && (
          <div className="mt-3 pt-3 border-t border-blue-200/60 dark:border-blue-900/40">
            <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
              Effective Permissions for <span className="font-mono text-blue-600 dark:text-blue-400">{effectivePerms.username}</span>:
              {effectivePerms.is_superuser && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  SUPERUSER BYPASS
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {effectivePerms.permissions.map((p) => (
                <span
                  key={p}
                  className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search permission code, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
          >
            <option value="">All Modules</option>
            {(categories.modules || []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedResource}
            onChange={(e) => setSelectedResource(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
          >
            <option value="">All Resources</option>
            {(categories.resources || []).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Permissions Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                <th className="py-3.5 px-4">Permission Code</th>
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4">Module</th>
                <th className="py-3.5 px-4">Resource</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading permissions...
                  </td>
                </tr>
              ) : permissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No permissions match your search criteria.
                  </td>
                </tr>
              ) : (
                permissions.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {p.code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-zinc-100">
                      {p.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {p.module}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{p.resource}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50">
                        {p.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-zinc-400 max-w-xs truncate" title={p.description}>
                      {p.description || "—"}
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

