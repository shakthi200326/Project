import React, { useState, useEffect } from "react";
import { ReportShell } from "../components/ReportShell";
import { fetchWarehouseReport } from "../services/api";
import { Warehouse, Building2, Boxes, DollarSign } from "lucide-react";

export function WarehouseReportPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await fetchWarehouseReport(params);
      setData(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const grandTotalStock = data.reduce((acc, r) => acc + Number(r.total_stock || 0), 0);
  const grandAvailable = data.reduce((acc, r) => acc + Number(r.available_stock || 0), 0);
  const grandTotalValue = data.reduce((acc, r) => acc + Number(r.stock_value || 0), 0);

  const columns = [
    {
      header: "Warehouse",
      accessor: (r) => r.warehouse,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-400" />
          <span className="font-semibold text-slate-900 dark:text-white">{r.warehouse}</span>
        </div>
      ),
    },
    {
      header: "Total Products",
      accessor: (r) => r.total_products,
      align: "right",
      cell: (r) => (
        <span className="font-mono font-medium text-slate-700 dark:text-zinc-300">
          {Number(r.total_products).toLocaleString()} SKUs
        </span>
      ),
    },
    {
      header: "Total Stock",
      accessor: (r) => r.total_stock,
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-slate-900 dark:text-white">
          {Number(r.total_stock).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Available Stock",
      accessor: (r) => r.available_stock,
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
          {Number(r.available_stock).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Reserved Stock",
      accessor: (r) => r.reserved_stock,
      align: "right",
      cell: (r) => (
        <span className="font-mono text-purple-600 dark:text-purple-400 font-medium">
          {Number(r.reserved_stock).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Damaged Stock",
      accessor: (r) => r.damaged_stock,
      align: "right",
      cell: (r) => (
        <span className="font-mono text-amber-600 dark:text-amber-400">
          {Number(r.damaged_stock).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Stock Value",
      accessor: (r) => r.stock_value,
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
          ${Number(r.stock_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
  ];

  const summary = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Network Physical Stock</span>
        <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 block">
          {grandTotalStock.toLocaleString()} units
        </span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Network Available Stock</span>
        <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
          {grandAvailable.toLocaleString()} units
        </span>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Network Inventory Value</span>
        <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 block">
          ${grandTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );

  return (
    <ReportShell
      title="Warehouse Report"
      subtitle="Multi-warehouse comparative matrix of total inventory volumes, available stock, and valuation."
      badge="FACILITY MATRIX"
      fileName="Warehouse_Comparative_Report"
      columns={columns}
      data={data}
      loading={loading}
      onApplyFilters={loadData}
      customSummary={summary}
    />
  );
}

export default WarehouseReportPage;
