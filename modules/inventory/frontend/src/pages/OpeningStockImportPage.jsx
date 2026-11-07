import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ExcelJS from "exceljs";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
} from "lucide-react";
import {
  fetchLocations,
  fetchProducts,
  fetchWarehouses,
  postStockTransaction,
} from "../services/api";

const TEMPLATE_HEADERS = [
  "item_code",
  "warehouse_code",
  "quantity",
  "unit_cost",
  "location_code",
  "batch_number",
  "expiry_date",
  "serial_numbers",
  "remarks",
];

const FIELDS = [
  { key: "item", label: "Item code or name", required: true, aliases: ["item", "product", "sku", "code", "itemcode", "productcode"] },
  { key: "warehouse", label: "Warehouse code or name", required: true, aliases: ["warehouse", "warehousecode", "warehousename", "facility"] },
  { key: "quantity", label: "Opening quantity", required: true, aliases: ["quantity", "qty", "openingquantity", "openingqty"] },
  { key: "unit_cost", label: "Unit cost", aliases: ["unitcost", "cost", "standardcost"] },
  { key: "location", label: "Location code or name", aliases: ["location", "locationcode", "storagelocation", "bin"] },
  { key: "batch_number", label: "Batch number", aliases: ["batch", "batchnumber", "lot", "lotnumber"] },
  { key: "expiry_date", label: "Expiry date", aliases: ["expiry", "expirydate", "expirationdate"] },
  { key: "serial_numbers", label: "Serial numbers", aliases: ["serial", "serialnumber", "serialnumbers"] },
  { key: "remarks", label: "Remarks", aliases: ["remarks", "notes", "reason", "reference"] },
];

const cardClass =
  "rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-slate-100";
const fieldClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30";

function normalizeHeader(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function recordsFromResponse(response) {
  return response?.results || response || [];
}

function matchByValue(records, value, keys) {
  const search = String(value ?? "").trim().toLowerCase();
  if (!search) return null;
  const exactMatches = records.filter((record) =>
    keys.some((key) => String(record[key] ?? "").trim().toLowerCase() === search),
  );
  return exactMatches.length === 1 ? exactMatches[0] : null;
}

function parseNumber(value) {
  const cleaned = String(value ?? "").trim().replace(/,/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    if (value < 1 || value > 2958465) return null;
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000)).toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

function makeUniqueHeaders(values) {
  const seen = new Map();
  return Array.from(values, (value, index) => {
    const base = String(value ?? "").replace(/^\uFEFF/, "").trim() || `Column ${index + 1}`;
    const count = (seen.get(base.toLowerCase()) || 0) + 1;
    seen.set(base.toLowerCase(), count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function valueFromCell(value) {
  if (value instanceof Date || value === null || value === undefined) return value ?? "";
  if (typeof value !== "object") return value;
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("");
  if (Object.prototype.hasOwnProperty.call(value, "result")) return value.result ?? "";
  if (Object.prototype.hasOwnProperty.call(value, "text")) return value.text ?? "";
  return "";
}

function parseCsv(text) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field === "") {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("The CSV file contains an unterminated quoted field.");
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadTemplate(type) {
  if (type === "csv") {
    triggerDownload(
      new Blob([`${TEMPLATE_HEADERS.join(",")}\r\n`], { type: "text/csv;charset=utf-8" }),
      "opening-stock-template.csv",
    );
    return;
  }
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Opening Stock").addRow(TEMPLATE_HEADERS);
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "opening-stock-template.xlsx",
  );
}

export function OpeningStockImportPage() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [sourceRows, setSourceRows] = useState([]);
  const [mappings, setMappings] = useState({});
  const [validation, setValidation] = useState(null);
  const [step, setStep] = useState("upload");
  const [posting, setPosting] = useState(false);
  const [results, setResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchProducts(), fetchWarehouses(), fetchLocations()])
      .then(([productResponse, warehouseResponse, locationResponse]) => {
        if (!active) return;
        setProducts(recordsFromResponse(productResponse));
        setWarehouses(recordsFromResponse(warehouseResponse));
        setLocations(recordsFromResponse(locationResponse));
      })
      .catch((error) => {
        if (active) setLoadError(error.message || "Unable to load inventory reference data.");
      });
    return () => {
      active = false;
    };

    const handleTemplateDownload = async (type) => {
      setErrorMessage("");
      try {
        await downloadTemplate(type);
      } catch (error) {
        setErrorMessage(error.message || "Could not create the import template.");
      }
    };
  }, []);

  const validRows = useMemo(
    () => validation?.rows.filter((row) => row.errors.length === 0) || [],
    [validation],
  );

  const handleFile = async (event) => {
    const selectedFile = event.target.files?.[0];
    setErrorMessage("");
    setValidation(null);
    setResults(null);
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setSourceRows([]);
    setMappings({});
    if (!selectedFile) return;

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx"].includes(extension)) {
      setErrorMessage("Choose a CSV or Excel file (.csv or .xlsx).");
      event.target.value = "";
      return;
    }

    try {
      let columns;
      let rows;
      if (extension === "csv") {
        const parsed = parseCsv(await selectedFile.text());
        columns = makeUniqueHeaders(parsed[0] || []);
        rows = parsed.slice(1).map((cells, index) => ({
          rowNumber: index + 2,
          row: Object.fromEntries(columns.map((header, columnIndex) => [header, cells[columnIndex] ?? ""])),
        })).filter(({ row }) => Object.values(row).some((value) => String(value).trim() !== ""));
      } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await selectedFile.arrayBuffer());
        const worksheet = workbook.worksheets[0];
        if (!worksheet) throw new Error("The selected file does not contain a worksheet.");
        columns = makeUniqueHeaders(worksheet.getRow(1).values.slice(1));
        rows = [];
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
          const row = worksheet.getRow(rowNumber);
          const values = columns.map((_, index) => valueFromCell(row.getCell(index + 1).value));
          if (values.some((value) => String(value ?? "").trim() !== "")) {
            rows.push({
              rowNumber,
              row: Object.fromEntries(columns.map((header, index) => [header, values[index]])),
            });
          }
        }
      }
      if (!columns.length) throw new Error("The selected file has no header row or data.");

      const nextMappings = {};
      for (const field of FIELDS) {
        const header = columns.find((column) =>
          field.aliases.includes(normalizeHeader(column)),
        );
        if (header) nextMappings[field.key] = header;
      }

      setFile(selectedFile);
      setHeaders(columns);
      setSourceRows(rows);
      setMappings(nextMappings);
    } catch (error) {
      setErrorMessage(error.message || "Could not read the selected spreadsheet.");
      event.target.value = "";
    }
  };

  const validateImport = () => {
    const missingMappings = FIELDS.filter(
      (field) => field.required && !mappings[field.key],
    );
    if (missingMappings.length) {
      setErrorMessage(`Map the required columns: ${missingMappings.map((field) => field.label).join(", ")}.`);
      return;
    }
    if (!sourceRows.length) {
      setErrorMessage("The selected file does not contain any data rows.");
      return;
    }

    const rows = sourceRows.map(({ row, rowNumber }) => {
      const errors = [];
      const value = (key) => mappings[key] ? row[mappings[key]] : "";
      const itemValue = value("item");
      const warehouseValue = value("warehouse");
      const quantity = parseNumber(value("quantity"));
      const unitCostValue = value("unit_cost");
      const unitCost = unitCostValue === "" ? 0 : parseNumber(unitCostValue);
      const product = matchByValue(products, itemValue, ["code", "sku", "item_code", "name"]);
      const warehouse = matchByValue(warehouses, warehouseValue, ["code", "name"]);
      const locationValue = value("location");
      const location = locationValue
        ? matchByValue(locations, locationValue, ["code", "name"])
        : null;

      if (!product) errors.push({ field: "Item", message: `No unique item matches "${itemValue}".` });
      if (!warehouse) errors.push({ field: "Warehouse", message: `No unique warehouse matches "${warehouseValue}".` });
      if (quantity === null || quantity <= 0) errors.push({ field: "Quantity", message: "Quantity must be a number greater than zero." });
      if (unitCost === null || unitCost < 0) errors.push({ field: "Unit cost", message: "Unit cost must be zero or a positive number." });
      if (locationValue && !location) errors.push({ field: "Location", message: `No unique location matches "${locationValue}".` });
      if (location && warehouse && String(location.warehouse) !== String(warehouse.id)
        && String(location.warehouse_code || location.warehouse) !== String(warehouse.code)) {
        errors.push({ field: "Location", message: "The location does not belong to the selected warehouse." });
      }

      const expiryValue = value("expiry_date");
      const expiryDate = expiryValue ? normalizeDate(expiryValue) : null;
      if (expiryValue && !expiryDate) errors.push({ field: "Expiry date", message: "Enter a valid expiry date." });

      const serialNumbers = String(value("serial_numbers") ?? "")
        .split(/[,\n|;]/)
        .map((serial) => serial.trim())
        .filter(Boolean);

      return {
        rowNumber,
        errors,
        data: {
          product,
          warehouse,
          location,
          quantity,
          unitCost,
          batchNumber: String(value("batch_number") ?? "").trim(),
          expiryDate,
          serialNumbers,
          remarks: String(value("remarks") ?? "").trim(),
        },
      };
    }).filter((row) => row.errors.length || row.data.product || row.data.warehouse || row.data.quantity !== null);

    setValidation({ rows });
    setErrorMessage("");
    setStep("preview");
  };

  const confirmImport = async () => {
    setPosting(true);
    setErrorMessage("");
    const posted = [];
    const failed = [];
    for (const row of validRows) {
      const { product, warehouse, location, quantity, unitCost, batchNumber, expiryDate, serialNumbers, remarks } = row.data;
      try {
        const transaction = await postStockTransaction({
          transaction_type: "OPENING",
          warehouse: Number(warehouse.id),
          transaction_date: new Date().toISOString().slice(0, 10),
          reason: remarks || "Bulk opening stock import",
          item_id: Number(product.id),
          item_code: product.code || product.sku,
          itemName: product.name,
          quantity,
          unit_cost: unitCost,
          lines: [{
            item: Number(product.id),
            location: location ? Number(location.id) : null,
            quantity,
            unit_cost: unitCost,
            batch_number: batchNumber,
            expiry_date: expiryDate,
            serial_numbers: serialNumbers,
          }],
        }, "post", { strict: true });
        posted.push({ row: row.rowNumber, document: transaction.document_number });
      } catch (error) {
        failed.push({ row: row.rowNumber, message: error.message || "Posting failed." });
      }
    }
    setResults({ posted, failed });
    setPosting(false);
    setStep("results");
  };

  const resetImport = () => {
    setFile(null);
    setHeaders([]);
    setSourceRows([]);
    setMappings({});
    setValidation(null);
    setResults(null);
    setErrorMessage("");
    setStep("upload");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            to="/inventory/operations/opening-stock"
            aria-label="Back to Opening Stock"
            className="mt-1 rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-purple-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">Bulk Opening Stock Import</h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">Upload, map, validate, and post opening balances from a spreadsheet.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {["upload", "preview", "confirm", "results"].map((item, index) => (
            <span
              key={item}
              className={`rounded-full border px-3 py-1.5 capitalize ${
                step === item ? "border-purple-500 bg-purple-500/10 text-purple-300" : "border-slate-700 text-slate-500"
              }`}
            >
              {index + 1}. {item}
            </span>
          ))}
        </div>
      </header>

      {loadError && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" /> {loadError}
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" /> {errorMessage}
        </div>
      )}

      {step === "upload" && (
        <>
          <section className={`${cardClass} space-y-5`}>
            <div>
              <h2 className="text-base font-semibold">1. Download a template</h2>
              <p className="mt-1 text-sm text-slate-400">Use one row per item, with an item code, warehouse code, and positive quantity.</p>
              <p className="mt-2 break-words font-mono text-xs text-slate-500">{TEMPLATE_HEADERS.join(", ")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleTemplateDownload("csv")} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <Download className="h-4 w-4" /> CSV template
              </button>
              <button type="button" onClick={() => handleTemplateDownload("xlsx")} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <Download className="h-4 w-4" /> Excel template
              </button>
            </div>
          </section>

          <section className={`${cardClass} space-y-4`}>
            <div>
              <h2 className="text-base font-semibold">2. Upload your file</h2>
              <p className="mt-1 text-sm text-slate-400">Supported formats: CSV and Excel (.xlsx).</p>
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/40 px-4 py-10 text-center hover:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500">
              <Upload className="h-7 w-7 text-purple-400" />
              <span className="text-sm font-medium text-slate-200">Choose a spreadsheet</span>
              <span className="text-xs text-slate-500">{file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : "No file selected"}</span>
              <input type="file" accept=".csv,.xlsx" onChange={handleFile} className="sr-only" />
            </label>
            {headers.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">3. Map spreadsheet columns</h3>
                  <p className="mt-1 text-xs text-slate-400">We matched common headers automatically. Verify the required columns before validation.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {FIELDS.map((field) => (
                    <label key={field.key} className="space-y-1 text-xs text-slate-300">
                      <span>{field.label}{field.required ? " *" : ""}</span>
                      <select
                        value={mappings[field.key] || ""}
                        onChange={(event) => setMappings((current) => ({ ...current, [field.key]: event.target.value }))}
                        className={fieldClass}
                      >
                        <option value="">Not mapped</option>
                        {headers.map((header) => (
                          <option key={`${field.key}-${header}`} value={header}>{header}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <button type="button" onClick={validateImport} disabled={Boolean(loadError)} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-purple-400">
                  Validate and preview <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {step === "preview" && validation && (
        <section className={`${cardClass} space-y-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Validation and preview</h2>
              <p className="mt-1 text-sm text-slate-400">{validRows.length} valid rows; {validation.rows.length - validRows.length} rows with errors.</p>
            </div>
            <button type="button" onClick={() => setStep("upload")} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500">Back to mapping</button>
          </div>
          {validation.rows.some((row) => row.errors.length > 0) && (
            <div className="overflow-x-auto rounded-lg border border-rose-900/80">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-rose-950/50 text-rose-200"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Field</th><th className="px-3 py-2">Error</th></tr></thead>
                <tbody className="divide-y divide-rose-900/60 text-rose-100">
                  {validation.rows.flatMap((row) => row.errors.map((error, index) => (
                    <tr key={`${row.rowNumber}-${index}`}><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2">{error.field}</td><td className="px-3 py-2">{error.message}</td></tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[700px] text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Warehouse</th><th className="px-3 py-2">Location</th><th className="px-3 py-2 text-right">Quantity</th><th className="px-3 py-2 text-right">Unit cost</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {validation.rows.slice(0, 100).map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="px-3 py-2">{row.rowNumber}</td>
                    <td className="px-3 py-2">{row.data.product?.code || row.data.product?.sku || row.data.product?.name || "—"}</td>
                    <td className="px-3 py-2">{row.data.warehouse?.code || row.data.warehouse?.name || "—"}</td>
                    <td className="px-3 py-2">{row.data.location?.code || row.data.location?.name || "—"}</td>
                    <td className="px-3 py-2 text-right">{row.data.quantity ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{row.data.unitCost ?? "—"}</td>
                    <td className={`px-3 py-2 font-semibold ${row.errors.length ? "text-rose-300" : "text-emerald-300"}`}>{row.errors.length ? "Invalid" : "Valid"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {validation.rows.length > 100 && <p className="border-t border-slate-800 p-2 text-center text-xs text-slate-500">Showing the first 100 rows in the preview.</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Link to="/inventory/operations/opening-stock" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</Link>
            <button type="button" disabled={!validRows.length} onClick={() => setStep("confirm")} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-purple-400">
              Review confirmation <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {step === "confirm" && validation && (
        <section className={`${cardClass} space-y-5`}>
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <h2 className="text-base font-semibold">Confirm stock posting</h2>
              <p className="mt-1 text-sm text-slate-400">This will post {validRows.length} valid opening stock rows to the stock ledger. Posted balances are recorded through the existing stock posting service and cannot be edited.</p>
              {validation.rows.length !== validRows.length && <p className="mt-2 text-sm text-amber-300">{validation.rows.length - validRows.length} invalid rows will be skipped.</p>}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
            <button type="button" disabled={posting} onClick={() => setStep("preview")} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">Cancel</button>
            <button type="button" disabled={posting || validRows.length === 0} onClick={confirmImport} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400">
              {posting ? <><RefreshCw className="h-4 w-4 animate-spin" /> Posting…</> : <><CheckCircle2 className="h-4 w-4" /> Confirm and post {validRows.length} rows</>}
            </button>
          </div>
        </section>
      )}

      {step === "results" && results && (
        <section className={`${cardClass} space-y-5`}>
          <div className="flex items-start gap-3">
            {results.failed.length ? <AlertCircle className="mt-0.5 h-5 w-5 text-amber-400" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />}
            <div>
              <h2 className="text-base font-semibold">Import results</h2>
              <p className="mt-1 text-sm text-slate-400">{results.posted.length} rows posted successfully; {results.failed.length} valid rows failed to post.</p>
            </div>
          </div>
          {results.posted.length > 0 && (
            <div className="rounded-lg border border-emerald-900/80 bg-emerald-950/30 p-3 text-sm text-emerald-200">
              <p className="mb-2 font-semibold">Posted rows</p>
              <ul className="grid gap-1 sm:grid-cols-2">{results.posted.map((entry) => <li key={entry.row}>Row {entry.row}{entry.document ? ` · ${entry.document}` : ""}</li>)}</ul>
            </div>
          )}
          {results.failed.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-rose-900/80">
              <table className="w-full min-w-[400px] text-left text-xs">
                <thead className="bg-rose-950/50 text-rose-200"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Posting error</th></tr></thead>
                <tbody className="divide-y divide-rose-900/60 text-rose-100">{results.failed.map((entry) => <tr key={entry.row}><td className="px-3 py-2">{entry.row}</td><td className="px-3 py-2">{entry.message}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
            <button type="button" onClick={resetImport} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Import another file</button>
            <Link to="/inventory/operations/opening-stock" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500">Back to Opening Stock</Link>
          </div>
        </section>
      )}

      <div className="sr-only" aria-live="polite">
        {step === "preview" && `${validRows.length} valid rows ready for preview.`}
        {step === "results" && `${results?.posted.length || 0} rows posted, ${results?.failed.length || 0} failed.`}
      </div>
    </div>
  );
}

export default OpeningStockImportPage;
