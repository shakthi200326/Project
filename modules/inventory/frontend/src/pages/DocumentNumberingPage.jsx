import React, { useState, useEffect } from "react";
import { ConfigTabsHeader } from "../components/ConfigTabsHeader";
import {
  fetchDocumentNumberingRules,
  updateDocumentNumberingRule,
  generateDocumentNumber,
} from "../services/api";
import { Hash, Edit2, Play, Save, X, CheckCircle2, AlertCircle, Sparkles, RefreshCw } from "lucide-react";

export function DocumentNumberingPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await fetchDocumentNumberingRules();
      setRules(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (rule) => {
    setEditingRule({
      ...rule,
      starting_number: rule.starting_number ?? 1,
      number_length: rule.number_length ?? 5,
      reset_frequency: rule.reset_frequency || "Never",
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRule) return;
    setSaving(true);
    try {
      await updateDocumentNumberingRule(editingRule.id, {
        prefix: editingRule.prefix,
        starting_number: Number(editingRule.starting_number),
        number_length: Number(editingRule.number_length),
        reset_frequency: editingRule.reset_frequency,
      });
      setToast({ type: "success", message: `Numbering rule for ${editingRule.document_type} updated successfully.` });
      setEditingRule(null);
      await loadRules();
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setToast({ type: "error", message: "Failed to update numbering rule." });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleTestGenerate = async (docType) => {
    try {
      const generated = await generateDocumentNumber(docType);
      setTestResult({ docType, number: generated });
      await loadRules();
      setToast({ type: "success", message: `Successfully generated atomic number: ${generated}` });
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <ConfigTabsHeader
        title="Document Numbering"
        subtitle="Configure sequence masks, prefixes, and thread-safe automatic document number generation."
        icon={Hash}
      />

      {toast && (
        <div
          className={`flex items-center gap-2 p-3 text-xs font-medium rounded-xl border ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Test Generator Banner */}
      {testResult && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-xs">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="text-slate-700 dark:text-zinc-200">
              Generated Number for <strong>{testResult.docType}</strong>:
            </span>
            <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
              {testResult.number}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Rules Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Document Numbering Rules
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              11 system document types automatically sequenced with collision-free atomic counters.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRules}
            className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-700/80 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                <th className="py-3 px-4">Document Type</th>
                <th className="py-3 px-3">Prefix</th>
                <th className="py-3 px-3 text-right">Starting #</th>
                <th className="py-3 px-3 text-right">Number Length</th>
                <th className="py-3 px-3">Reset Frequency</th>
                <th className="py-3 px-3">Sample Next Number</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading document numbering rules...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No numbering rules configured.
                  </td>
                </tr>
              ) : (
                rules.map((r) => {
                  const seq = String(r.current_number || r.starting_number || 1).padStart(r.number_length || 5, "0");
                  const sample = `${r.prefix}-${seq}`;
                  return (
                    <tr key={r.id || r.document_type} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {r.document_type}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-900/40">
                          {r.prefix}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-zinc-300">
                        {r.starting_number ?? 1}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-zinc-300">
                        {r.number_length ?? 5} digits
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700">
                          {r.reset_frequency || "Never"}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                        {sample}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditClick(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-[11px] font-medium transition-colors cursor-pointer"
                            title="Edit Mask & Sequence"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTestGenerate(r.document_type)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 text-[11px] font-medium transition-colors cursor-pointer"
                            title="Test Atomic Number Generation"
                          >
                            <Play className="h-3 w-3" />
                            Generate Next
                          </button>
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

      {/* Edit Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-xl w-full max-w-md space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Edit Numbering Rule
                </h3>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                  {editingRule.document_type}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Document Type
                </label>
                <input
                  type="text"
                  disabled
                  value={editingRule.document_type}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 text-slate-500 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Prefix <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingRule.prefix}
                  onChange={(e) => setEditingRule({ ...editingRule, prefix: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-mono font-bold uppercase focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Starting Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingRule.starting_number}
                    onChange={(e) => setEditingRule({ ...editingRule, starting_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Number Length <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="10"
                    required
                    value={editingRule.number_length}
                    onChange={(e) => setEditingRule({ ...editingRule, number_length: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Reset Frequency <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={editingRule.reset_frequency}
                  onChange={(e) => setEditingRule({ ...editingRule, reset_frequency: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Never">Never (Continuous Sequence)</option>
                  <option value="Yearly">Yearly (Reset Sequence Every Year)</option>
                </select>
              </div>

              {/* Sample calculation preview */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700">
                <span className="text-[11px] text-slate-400 block">Preview Sequence Format:</span>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {editingRule.prefix}-{String(editingRule.starting_number || 1).padStart(Number(editingRule.number_length) || 5, "0")}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentNumberingPage;

