import React, { useState, useEffect } from "react";
import {
  SlidersHorizontal,
  Plus,
  Search,
  RefreshCw,
  Pencil,
} from "lucide-react";
import {
  fetchAttributes,
  createAttribute,
  updateAttribute,
  addAttributeValue,
} from "../services/api.js";

export function ProductAttributesPage() {
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editingAttribute, setEditingAttribute] = useState(null);

  // New Attribute Form
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newConfiguredValues, setNewConfiguredValues] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);

  // Add Value Modal
  const [activeAttrForValue, setActiveAttrForValue] = useState(null);
  const [newValueInput, setNewValueInput] = useState("");
  const [addingValue, setAddingValue] = useState(false);
  const [valueError, setValueError] = useState("");

  useEffect(() => {
    loadAttributes();
  }, []);

  const loadAttributes = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchAttributes({ throwOnError: true });
      setAttributes(data?.results || (Array.isArray(data) ? data : []));
    } catch (err) {
      setLoadError(err.message || "Failed to load product attributes.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAttribute = async (e) => {
    e.preventDefault();
    setCreateError("");
    const code = newCode.trim().toUpperCase();
    const name = newName.trim();
    if (!code || !name) {
      setCreateError("Attribute code and name are required.");
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      setCreateError("Use only letters, numbers, underscores, and hyphens in the attribute code.");
      return;
    }
    const configuredValues = [
      ...new Map(
        newConfiguredValues
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => [value.toLowerCase(), value])
      ).values(),
    ];
    setCreating(true);
    let savedAttribute = null;
    try {
      savedAttribute = editingAttribute
        ? await updateAttribute(editingAttribute.id, { code, name, is_active: newIsActive })
        : await createAttribute({ code, name, is_active: newIsActive });
      const existingValues = new Set(
        (editingAttribute?.values || []).map((value) => value.value.toLowerCase())
      );
      for (const value of configuredValues) {
        if (existingValues.has(value.toLowerCase())) continue;
        try {
          await addAttributeValue(savedAttribute.id, value);
        } catch (err) {
          throw new Error(`Attribute saved, but configured value "${value}" could not be added: ${err.message}`);
        }
      }
      await loadAttributes();
      closeAttributeForm();
    } catch (err) {
      if (savedAttribute) await loadAttributes();
      setCreateError(
        err.message ||
          `Failed to ${editingAttribute ? "update" : "create"} attribute.`
      );
    } finally {
      setCreating(false);
    }
  };

  const openEditAttribute = (attribute) => {
    setEditingAttribute(attribute);
    setNewCode(attribute.code || "");
    setNewName(attribute.name || "");
    setNewConfiguredValues((attribute.values || []).map((value) => value.value).join(", "));
    setNewIsActive(attribute.is_active !== false);
    setCreateError("");
    setIsCreateOpen(true);
  };

  const closeAttributeForm = () => {
    setIsCreateOpen(false);
    setEditingAttribute(null);
    setNewCode("");
    setNewName("");
    setNewConfiguredValues("");
    setNewIsActive(true);
    setCreateError("");
  };

  const handleAddValue = async (e) => {
    e.preventDefault();
    if (!newValueInput.trim() || !activeAttrForValue) return;
    setValueError("");
    setAddingValue(true);
    try {
      await addAttributeValue(activeAttrForValue.id, newValueInput.trim());
      setNewValueInput("");
      setActiveAttrForValue(null);
      await loadAttributes();
    } catch (err) {
      setValueError(err.message || "Failed to add attribute value.");
    } finally {
      setAddingValue(false);
    }
  };

  const filteredAttributes = attributes.filter((a) => {
    const q = search.toLowerCase();
    return (
      !search ||
      a.code?.toLowerCase().includes(q) ||
      a.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Product Attributes Configuration
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure dynamic technical, aesthetic, and variant-generating specifications (Color, Size, Material, RAM).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAttributes}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              closeAttributeForm();
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Attribute
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search attributes by code or name..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Attributes Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Attribute Name</th>
                <th className="py-3.5 px-4">Configured Values</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading product attributes...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-rose-700 dark:text-rose-300">
                    <p role="alert">{loadError}</p>
                    <button
                      type="button"
                      onClick={loadAttributes}
                      className="mt-3 font-semibold underline"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : filteredAttributes.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    No attributes found. Click "New Attribute" to create one.
                  </td>
                </tr>
              ) : (
                filteredAttributes.map((attr) => (
                  <tr key={attr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {attr.code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {attr.name}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex flex-wrap gap-1 items-center">
                        {attr.values && attr.values.length > 0 ? (
                          attr.values.map((v) => (
                            <span
                              key={v.id}
                              className="px-2 py-0.5 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              {v.value}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">None yet</span>
                        )}
                        <button
                          onClick={() => setActiveAttrForValue(attr)}
                          className="px-1.5 py-0.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors"
                          title="Add Value"
                        >
                          + Add
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          attr.is_active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {attr.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEditAttribute(attr)}
                        aria-label={`Edit ${attr.name}`}
                        className="mr-2 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAttrForValue(attr)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        Manage Values
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Attribute Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                {editingAttribute ? "Edit Product Attribute" : "Create Product Attribute"}
              </h3>
              <button
                onClick={closeAttributeForm}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAttribute} className="space-y-4">
              {createError && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                  {createError}
                </p>
              )}
              <div>
                <label htmlFor="attribute-code" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Attribute Code *
                </label>
                <input
                  id="attribute-code"
                  type="text"
                  required
                  maxLength={40}
                  pattern="[A-Za-z0-9_-]+"
                  title="Use only letters, numbers, underscores, and hyphens."
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="e.g. COLOR, SIZE, RAM"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono uppercase focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="attribute-name" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Attribute Display Name *
                </label>
                <input
                  id="attribute-name"
                  type="text"
                  required
                  maxLength={100}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Garment Color, RAM Capacity"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="attribute-values" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Configured Values
                </label>
                <input
                  id="attribute-values"
                  type="text"
                  value={newConfiguredValues}
                  onChange={(e) => setNewConfiguredValues(e.target.value)}
                  placeholder="e.g. Small, Medium, Large"
                  aria-describedby="attribute-values-hint"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
                <p id="attribute-values-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Separate values with commas. Existing values are retained when editing.
                </p>
              </div>

              <div>
                <label htmlFor="attribute-status" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Status *
                </label>
                <select
                  id="attribute-status"
                  value={newIsActive ? "active" : "inactive"}
                  onChange={(e) => setNewIsActive(e.target.value === "active")}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeAttributeForm}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm"
                >
                  {creating
                    ? editingAttribute
                      ? "Saving..."
                      : "Creating..."
                    : editingAttribute
                      ? "Save Changes"
                      : "Save Attribute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Attribute Value Modal */}
      {activeAttrForValue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Add Option to {activeAttrForValue.name} ({activeAttrForValue.code})
              </h3>
              <button
                type="button"
                onClick={() => setActiveAttrForValue(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddValue} className="space-y-4">
              {valueError && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                  {valueError}
                </p>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  New Value *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  autoFocus
                  value={newValueInput}
                  onChange={(e) => setNewValueInput(e.target.value)}
                  placeholder="e.g. Navy, Crimson, 32GB"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveAttrForValue(null)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingValue || !newValueInput.trim()}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm"
                >
                  {addingValue ? "Adding..." : "Add Value"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default ProductAttributesPage;
