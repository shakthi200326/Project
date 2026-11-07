import React, { useState, useEffect } from "react";
import { Shield, Check, X, Filter, Search, Info } from "lucide-react";
import {
  SecurityHeader,
  SecurityNavPills,
} from "./securityComponents";
import { fetchActionMatrix, fetchPermissions } from "../../services/securityApi";

export function ActionPermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [matrixData, setMatrixData] = useState({ actions: [], resources: [], matrix: [] });
  const [permissions, setPermissions] = useState([]);
  const [selectedAction, setSelectedAction] = useState("");
  const [search, setSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [mData, pData] = await Promise.all([
        fetchActionMatrix(),
        fetchPermissions(),
      ]);
      setMatrixData(mData || { actions: [], resources: [], matrix: [] });
      setPermissions(pData.results || pData || []);
    } catch (err) {
      console.error("Failed to load action matrix:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const roles = matrixData.matrix || [];
  const actionsList = [
    "VIEW",
    "CREATE",
    "EDIT",
    "DELETE",
    "SUBMIT",
    "APPROVE",
    "REJECT",
    "POST",
    "CANCEL",
    "REVERSE",
    "IMPORT",
    "EXPORT",
    "CONFIGURE",
  ];

  return (
    <div className="space-y-6">
      <SecurityHeader
        title="Action-level Permissions"
        subtitle="Fine-grained operational matrix governing actions across goods receipt, stock operations, and ledger adjustments."
        icon={Shield}
      />

      <SecurityNavPills activeTab="actions" />

      {/* Information Notice */}
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-300">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Backend-Enforced Action Boundary:</span>
          <p className="mt-0.5 text-blue-700 dark:text-blue-400">
            Hiding buttons in the interface does not substitute authorization. Sensitive state transitions (SUBMIT, APPROVE, POST, REVERSE) are authenticated and authorized on the server and subject to Separation of Duties (SoD) policies.
          </p>
        </div>
      </div>

      {/* Action Matrix Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Enterprise Role-to-Action Matrix</h3>
          <span className="text-xs text-slate-400 font-mono">{roles.length} Roles Defined</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold">
                <th className="py-3 px-4 text-left min-w-[200px]">Enterprise Role</th>
                {actionsList.map((act) => (
                  <th key={act} className="py-3 px-2 min-w-[70px]">
                    {act}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={actionsList.length + 1} className="py-8 text-center text-slate-400">
                    Computing action matrix...
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={actionsList.length + 1} className="py-8 text-center text-slate-400">
                    No roles found.
                  </td>
                </tr>
              ) : (
                roles.map((r) => {
                  const rolePerms = r.permissions || [];
                  const isSuper = rolePerms.includes("*") || r.role_code === "ROLE-SYSADMIN";

                  return (
                    <tr key={r.role_id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 text-left">
                        <div className="font-bold text-slate-900 dark:text-zinc-100">{r.role_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{r.role_code}</div>
                      </td>

                      {actionsList.map((act) => {
                        // Check if role has any permission with this action
                        const hasAction =
                          isSuper ||
                          permissions.some(
                            (p) => p.action === act && rolePerms.includes(p.code)
                          );

                        return (
                          <td key={act} className="py-3 px-2">
                            {hasAction ? (
                              <span className="inline-flex p-1 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              </span>
                            ) : (
                              <span className="inline-flex p-1 rounded-full text-slate-300 dark:text-zinc-700">
                                <X className="h-3.5 w-3.5 stroke-[1.5]" />
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

