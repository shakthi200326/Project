import React, { useState, useEffect } from "react";
import {
  SlidersHorizontal,
  Plus,
  Search,
  CheckCircle2,
  Ban,
  RefreshCw,
  Tag,
  Layers,
  Sparkles,
} from "lucide-react";
import { fetchAttributes, createAttribute, addAttributeValue } from "../services/api.js";

export function ProductAttributesPage() {
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // New Attribute Form
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDataType, setNewDataType] = useState("TEXT");
  const [isVariantGen, setIsVariantGen] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);

  // Add Value Modal
  const [activeAttrForValue, setActiveAttrForValue] = useState(null);
  const [newValueInput, setNewValueInput] = useState("");
  const [addingValue, setAddingValue] = useState(false);

  useEffect(() => {
    loadAttributes();
  }, []);

  const loadAttributes = async () => {
    setLoading(true);
    try {
      const data = await fetchAttributes();
      setAttributes(data?.results || (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error("Failed to load attributes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAttribute = async (e) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;
    setCreating(true);
    try {
      await createAttribute({
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        data_type: newDataType,
        is_variant_generator: isVariantGen,
        sort_order: parseInt(sortOrder, 10) || 0,
        is_active: true,
      });
      setIsCreateOpen(false);
      setNewCode("");
      setNewName("");
      setNewDataType("TEXT");
      setIsVariantGen(false);
      setSortOrder(0);
      loadAttributes();
    } catch (err) {
      alert("Failed to create attribute: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleAddValue = async (e) => {
    e.preventDefault();
    if (!newValueInput.trim() || !activeAttrForValue) return;
    setAddingValue(true);
    try {
      await addAttributeValue(activeAttrForValue.id, newValueInput.trim());
      setNewValueInput("");
      setActiveAttrForValue(null);
      loadAttributes();
    } catch (err) {
      alert("Failed to add attribute value: " + err.message);
    } finally {
      setAddingValue(false);
    }
  };

  const filteredAttributes = attributes.filter((a) => {
    const q = search.toLowerCase();
    return (
      !search ||
      a.code?.toLowerCase().includes(q) ||
      a.name?.toLowerCase().includes(q) ||
      a.data_type?.toLowerCase().includes(q)
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
            onClick={() => setIsCreateOpen(true)}
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
            placeholder="Search attributes by code, name, data type..."
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
                <th className="py-3.5 px-4">Data Type</th>
                <th className="py-3.5 px-4 text-center">Variant Generator</th>
                <th className="py-3.5 px-4">Configured Values</th>
                <th className="py-3.5 px-4 text-center">Sort Order</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading product attributes...
                  </td>
                </tr>
              ) : filteredAttributes.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
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
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {attr.data_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {attr.is_variant_generator ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                          <Sparkles className="w-3 h-3" /> Yes
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No</span>
                      )}
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
                    <td className="py-3.5 px-4 text-center font-mono text-xs">
                      {attr.sort_order}
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

      {/* Create Attribute Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Create Product Attribute
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAttribute} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Attribute Code *
                </label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="e.g. COLOR, SIZE, RAM"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono uppercase focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Attribute Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Garment Color, RAM Capacity"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Data Type *
                  </label>
                  <select
                    value={newDataType}
                    onChange={(e) => setNewDataType(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="TEXT">Text</option>
                    <option value="NUMBER">Integer Number</option>
                    <option value="DECIMAL">Decimal Number</option>
                    <option value="BOOLEAN">Boolean (Yes/No)</option>
                    <option value="DATE">Date</option>
                    <option value="SELECT">Predefined Options</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_variant_gen"
                  checked={isVariantGen}
                  onChange={(e) => setIsVariantGen(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="is_variant_gen" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Variant Generator Attribute (Used to create SKU combinations)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm"
                >
                  {creating ? "Creating..." : "Save Attribute"}
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
                onClick={() => setActiveAttrForValue(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddValue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  New Value *
                </label>
                <input
                  type="text"
                  required
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

