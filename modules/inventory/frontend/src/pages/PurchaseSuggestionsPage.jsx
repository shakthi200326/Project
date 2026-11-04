import React, { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart,
  Search,
  Filter,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Warehouse as WarehouseIcon,
  RefreshCw,
  Check,
  Ban,
  ArrowRight,
  ExternalLink,
  Sparkles,
  FileCheck2,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  fetchPurchaseSuggestions,
  approvePurchaseSuggestion,
  rejectPurchaseSuggestion,
  convertPurchaseSuggestion,
  generatePurchaseSuggestions,
  fetchProducts,
  fetchWarehouses,
} from "@/services/api";

export function PurchaseSuggestionsPage() {
  const [suggestions, setSuggestions] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, pRes, wRes] = await Promise.all([
        fetchPurchaseSuggestions(),
        fetchProducts(),
        fetchWarehouses(),
      ]);
      setSuggestions(sRes.results || sRes || []);
      setProducts(pRes.results || pRes || []);
      setWarehouses(wRes.results || wRes || []);
    } catch (err) {
      console.error("Failed to load purchase suggestions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (sug) => {
    try {
      await approvePurchaseSuggestion(sug.id);
      setToastMsg(`Suggestion ${sug.suggestion_number} approved! Ready for purchase conversion.`);
      setTimeout(() => setToastMsg(""), 4000);
      loadData();
    } catch (err) {
      console.error("Approve failed", err);
    }
  };

  const handleReject = async (sug) => {
    try {
      await rejectPurchaseSuggestion(sug.id);
      setToastMsg(`Suggestion ${sug.suggestion_number} rejected.`);
      setTimeout(() => setToastMsg(""), 4000);
      loadData();
    } catch (err) {
      console.error("Reject failed", err);
    }
  };

  const handleConvert = async (sug) => {
    try {
      const res = await convertPurchaseSuggestion(sug.id);
      setToastMsg(
        `Suggestion ${sug.suggestion_number} converted! Dispatched to Procurement Module as ${res.purchase_request_id || "PR-REQ"}.`
      );
      setTimeout(() => setToastMsg(""), 5000);
      loadData();
    } catch (err) {
      console.error("Conversion failed", err);
    }
  };

  const handleAutoGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generatePurchaseSuggestions();
      setToastMsg(res.message || "Calculated purchase suggestions based on reorder thresholds.");
      setTimeout(() => setToastMsg(""), 4500);
      loadData();
    } catch (err) {
      console.error("Generate failed", err);
    } finally {
      setGenerating(false);
    }
  };

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (s.suggestion_number && s.suggestion_number.toLowerCase().includes(q)) ||
        (s.product_name && s.product_name.toLowerCase().includes(q)) ||
        (s.sku && s.sku.toLowerCase().includes(q)) ||
        (s.supplier && s.supplier.toLowerCase().includes(q));

      const matchProduct = !productFilter || String(s.product) === String(productFilter) || s.product_name === productFilter;
      const matchWarehouse = !warehouseFilter || String(s.warehouse) === String(warehouseFilter) || s.warehouse_name === warehouseFilter;
      const matchStatus = !statusFilter || s.status === statusFilter;

      return matchSearch && matchProduct && matchWarehouse && matchStatus;
    });
  }, [suggestions, searchTerm, productFilter, warehouseFilter, statusFilter]);

  // KPIs
  const totalSuggestedQty = filteredSuggestions.reduce((sum, s) => sum + Number(s.suggested_quantity || 0), 0);
  const pendingCount = filteredSuggestions.filter((s) => s.status === "Pending" || s.status === "PENDING").length;
  const approvedCount = filteredSuggestions.filter((s) => s.status === "Approved" || s.status === "APPROVED").length;
  const convertedCount = filteredSuggestions.filter((s) => s.status === "Converted" || s.status === "CONVERTED").length;

  const exportCSV = () => {
    const headers = [
      "Suggestion Number",
      "Suggestion Date",
      "Product Name",
      "SKU",
      "Warehouse",
      "Available Stock",
      "Reorder Point",
      "Suggested Quantity",
      "Supplier",
      "Status",
    ];
    const rows = filteredSuggestions.map((s) => [
      s.suggestion_number || "",
      s.suggestion_date || "",
      s.product_name || "",
      s.sku || "",
      s.warehouse_name || s.warehouse || "",
      s.available_stock || 0,
      s.reorder_point || 0,
      s.suggested_quantity || 0,
      s.supplier || "—",
      s.status || "Pending",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `purchase_suggestions_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    const s = String(status || "Pending").toUpperCase();
    if (s === "CONVERTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
          <FileCheck2 className="h-3 w-3" /> Converted to PR
        </span>
      );
    }
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="h-3 w-3" /> Approved
        </span>
      );
    }
    if (s === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <Ban className="h-3 w-3" /> Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/80 border border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-100 text-xs font-semibold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg("")} className="text-blue-600 dark:text-blue-400 hover:opacity-80">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Purchase Suggestions
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Procurement Bridge
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Automated purchase recommendations for depleted inventory. Dispatches approved requests to the Procurement module.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleAutoGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? "Calculating..." : "Generate Suggestions"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Suggested Units</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{totalSuggestedQty}</span>
            <span className="text-xs text-slate-400">Units suggested</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Pending Review</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{pendingCount}</span>
            <span className="text-xs text-slate-400">Awaiting approval</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Approved Suggestions</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{approvedCount}</span>
            <span className="text-xs text-slate-400">Ready to convert</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Converted to PR</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400">
              <FileCheck2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">{convertedCount}</span>
            <span className="text-xs text-slate-400">Sent to Procurement</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Suggestion #, Product, or Supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.name || p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.name || w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Converted">Converted</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Purchase Suggestions Table - Exactly the 10 Phase 6 fields */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 dark:border-zinc-800 whitespace-nowrap">
              <tr>
                <th className="py-3 px-4">Suggestion #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4 text-right">Available Stock</th>
                <th className="py-3 px-4 text-right">Reorder Point</th>
                <th className="py-3 px-4 text-right">Suggested Qty</th>
                <th className="py-3 px-4">Preferred Supplier</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading purchase replenishment suggestions...
                  </td>
                </tr>
              ) : filteredSuggestions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No purchase suggestions generated. Click "Generate Suggestions" to evaluate current stock deficits.
                  </td>
                </tr>
              ) : (
                filteredSuggestions.map((sug) => {
                  const avail = Number(sug.available_stock || 0);
                  const reorderPt = Number(sug.reorder_point || 0);
                  return (
                    <tr key={sug.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {sug.suggestion_number || "SUG-000"}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap tabular-nums text-slate-600 dark:text-zinc-400">
                        {sug.suggestion_date || "—"}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {sug.product_name || "Product"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                        {sug.sku || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                        {sug.warehouse_name || sug.warehouse || "Warehouse"}
                      </td>
                      <td className={`py-3.5 px-4 text-right tabular-nums font-bold ${avail <= reorderPt ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {avail}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-slate-700 dark:text-zinc-300">
                        {reorderPt}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-blue-600 dark:text-blue-400">
                        +{Number(sug.suggested_quantity || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400">
                        {sug.supplier || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {getStatusBadge(sug.status)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {sug.status === "Pending" && (
                            <>
                              <button
                                onClick={() => handleApprove(sug)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                                title="Approve Suggestion"
                              >
                                <Check className="h-3 w-3" /> Approve
                              </button>
                              <button
                                onClick={() => handleReject(sug)}
                                className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors"
                                title="Reject"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {sug.status === "Approved" && (
                            <button
                              onClick={() => handleConvert(sug)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors"
                              title="Convert to Purchase Request"
                            >
                              <FileCheck2 className="h-3 w-3" /> Convert to PR
                            </button>
                          )}
                          {sug.status === "Converted" && (
                            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> PR Created
                            </span>
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
    </div>
  );
}
export default PurchaseSuggestionsPage;

