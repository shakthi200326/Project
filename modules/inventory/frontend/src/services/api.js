// Central API Client & Service Layer for Inventory Module

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export function generateEan13() {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
  const weightedSum = digits.reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3), 0);
  const checkDigit = (10 - (weightedSum % 10)) % 10;
  return `${digits.join("")}${checkDigit}`;
}



// Live connectivity status tracking

let isApiConnected = false;

const statusListeners = new Set();



export function getApiStatus() {

  return isApiConnected;

}



export function subscribeApiStatus(listener) {

  statusListeners.add(listener);

  return () => statusListeners.delete(listener);

}



function updateApiStatus(connected) {

  if (isApiConnected !== connected) {

    isApiConnected = connected;

    statusListeners.forEach((fn) => fn(connected));

  }

  async function fetchAllPages(url, signal) {
    const records = [];
    let nextUrl = url;
    while (nextUrl) {
      const res = await fetch(nextUrl, { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const data = await res.json();
      if (Array.isArray(data)) {
        records.push(...data);
        break;
      }
      records.push(...(data.results || []));
      nextUrl = data.next;
    }
    return records;
  }

}



// ---------------------------------------------------------------------------

// Barcode Scanner & Optical Chime Audio Helper

// ---------------------------------------------------------------------------

// The beep is a pre-rendered WAV played through an <audio> element rather than

// Web Audio. Constructing the first AudioContext is synchronous and, on some

// Windows audio setups, blocks the main thread for seconds -- which froze the

// page ("Page Unresponsive") on the first barcode decode of every screen.

let scanBeepUrl = null;



function buildScanBeepUrl() {

  const sampleRate = 8000;

  const duration = 0.08;

  const frequency = 1850;

  const samples = Math.floor(sampleRate * duration);

  const buffer = new ArrayBuffer(44 + samples * 2);

  const view = new DataView(buffer);

  const writeStr = (offset, str) => {

    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));

  };



  // 16-bit mono PCM WAV header

  writeStr(0, "RIFF");

  view.setUint32(4, 36 + samples * 2, true);

  writeStr(8, "WAVE");

  writeStr(12, "fmt ");

  view.setUint32(16, 16, true);

  view.setUint16(20, 1, true);

  view.setUint16(22, 1, true);

  view.setUint32(24, sampleRate, true);

  view.setUint32(28, sampleRate * 2, true);

  view.setUint16(32, 2, true);

  view.setUint16(34, 16, true);

  writeStr(36, "data");

  view.setUint32(40, samples * 2, true);



  // Sine tone with the same exponential fade-out as the original chime

  for (let i = 0; i < samples; i++) {

    const t = i / sampleRate;

    const envelope = 0.12 * Math.pow(0.001 / 0.12, t / duration);

    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope;

    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);

  }



  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));

}



export function playScanBeep() {

  // Defer so the decoded result renders first; audio never delays the UI.

  setTimeout(() => {

    try {

      if (typeof Audio === "undefined") return;

      if (!scanBeepUrl) scanBeepUrl = buildScanBeepUrl();

      const audio = new Audio(scanBeepUrl);

      const played = audio.play();

      if (played && typeof played.catch === "function") played.catch(() => {});

    } catch (e) {

      // Audio is optional feedback; ignore failures

    }

  }, 0);

}



export function lookupProductByBarcode(query, productsList = []) {

  if (!query) return null;

  const clean = String(query).trim().toLowerCase();

  return (

    productsList.find((p) => {
      const barcodes = [
        p.barcode,
        ...(p.multi_barcodes || []).map((barcode) => barcode.barcode_value),
        ...(p.variants || []).flatMap((variant) => [
          variant.barcode,
          variant.sku,
          ...(variant.multi_barcodes || []).map((barcode) => barcode.barcode_value),
        ]),
      ].map((value) => String(value || "").trim().toLowerCase());
      const sku = String(p.sku || p.code || "").trim().toLowerCase();
      const name = String(p.name || "").trim().toLowerCase();
      return barcodes.includes(clean) || sku === clean || name === clean;
    }) ||
    productsList.find((p) => {
      const barcodes = [
        p.barcode,
        ...(p.multi_barcodes || []).map((barcode) => barcode.barcode_value),
        ...(p.variants || []).flatMap((variant) => [
          variant.barcode,
          variant.sku,
          ...(variant.multi_barcodes || []).map((barcode) => barcode.barcode_value),
        ]),
      ].map((value) => String(value || "").trim().toLowerCase());
      const sku = String(p.sku || p.code || "").trim().toLowerCase();
      return barcodes.some((barcode) => barcode && barcode.includes(clean)) || (sku && sku.includes(clean));

    }) ||

    null

  );

}



export async function searchProductOnlineOrLocal(query, productsList = []) {

  if (!query) return null;

  const localMatch = lookupProductByBarcode(query, productsList);

  if (localMatch) return localMatch;



  try {

    const clean = encodeURIComponent(String(query).trim());

    const controller = new AbortController();

    const timeoutId = setTimeout(() => controller.abort(), 1800);

    try {

      const res = await fetch(`${API_BASE}/inventory/items/?search=${clean}`, {

        signal: controller.signal,

      });

      if (res.ok) {

        const data = await res.json();

        const list = Array.isArray(data) ? data : data.results || [];

        return lookupProductByBarcode(query, list);

      }

    } finally {

      clearTimeout(timeoutId);

    }

  } catch (err) {

    // Graceful fallback for offline / network timeout

  }

  return null;

}



// ---------------------------------------------------------------------------

// Universal Local Storage Persistence Helpers

// Guarantees 100% persistence on page refresh across all entities & offline mode

// ---------------------------------------------------------------------------

export function getLocalEntities(key) {

  try {

    const raw = localStorage.getItem(`inv_${key}`);

    return raw ? JSON.parse(raw) : [];

  } catch (e) {

    return [];

  }

}



export function saveLocalEntity(key, entity, matchField = "id") {

  try {

    const existing = getLocalEntities(key);

    const filtered = existing.filter((item) => {

      if (key === "products") {

        const matchesId = item.id && entity.id && String(item.id) === String(entity.id);

        const matchesSku = item.sku && entity.sku && item.sku.toLowerCase() === entity.sku.toLowerCase();

        const matchesCode = item.code && entity.code && item.code.toLowerCase() === entity.code.toLowerCase();

        return !matchesId && !matchesSku && !matchesCode;

      }

      return String(item[matchField]) !== String(entity[matchField]);

    });

    const updated = [entity, ...filtered];

    localStorage.setItem(`inv_${key}`, JSON.stringify(updated));

    return entity;

  } catch (e) {

    return entity;

  }

}



export function updateLocalEntity(key, id, partial, matchField = "id") {

  try {

    const existing = getLocalEntities(key);

    const updated = existing.map((item) => {

      const match = String(item[matchField]) === String(id) || (key === "products" && (item.sku === id || item.code === id));

      return match ? { ...item, ...partial } : item;

    });

    localStorage.setItem(`inv_${key}`, JSON.stringify(updated));

  } catch (e) {}

}



export function deleteLocalEntity(key, id, matchField = "id") {

  try {

    const existing = getLocalEntities(key);

    const filtered = existing.filter((item) => {

      if (key === "products") {

        return String(item.id) !== String(id) && item.sku !== id && item.code !== id;

      }

      return String(item[matchField]) !== String(id);

    });

    localStorage.setItem(`inv_${key}`, JSON.stringify(filtered));

  } catch (e) {}

}



function resolveCategoryId(cat) {

  if (typeof cat === "number" && !isNaN(cat)) return cat;

  if (!cat) return 1;

  const s = String(cat).toLowerCase().trim();

  if (/^\d+$/.test(s)) return Number(s);

  if (s.includes("mech") || s === "cat-1") return 1;

  if (s.includes("hyd") || s === "cat-2") return 2;

  if (s.includes("trans") || s === "cat-3") return 3;

  if (s.includes("sens") || s === "cat-4") return 4;

  if (s.includes("chem") || s === "cat-5") return 5;

  return null;

}



function resolveCategoryName(cat) {

  const id = resolveCategoryId(cat);

  switch (id) {

    case 1:

      return "Mechanical Components";

    case 2:

      return "Hydraulics & Pneumatics";

    case 3:

      return "Power Transmission";

    case 4:

      return "Sensors & Automation";

    case 5:

      return "Chemicals & Fluids";

    default:

      return typeof cat === "string" && !/^\d+$/.test(cat)

        ? cat

        : "Mechanical Components";

  }

}



// ---------------------------------------------------------------------------

// Enterprise Demo Fallback Data

// ---------------------------------------------------------------------------

export const DEMO_PRODUCTS = [

  {

    id: "prod-001",

    name: "Industrial Ball Bearing 6205-2RS",

    sku: "BRG-6205-2RS",

    code: "BRG-6205-2RS",

    category: "Mechanical Components",

    category_name: "Mechanical Components",

    brand: "SKF Precision",

    base_unit: "EA",

    unit: "EA",

    variants_count: 3,

    status: "ACTIVE",

    stock_status: "IN_STOCK",

    on_hand: 450,

    reserved: 45,

    available: 405,

    reorder_point: 100,

    reorder_quantity: 200,

    unit_cost: 14.85,

    currency: "USD",

    barcode: "890123620501",

    tracking: "BATCH",

  },

  {

    id: "prod-002",

    name: "Hydraulic Solenoid Valve 24V DC",

    sku: "HYD-SV-24V",

    code: "HYD-SV-24V",

    category: "Hydraulics & Pneumatics",

    category_name: "Hydraulics & Pneumatics",

    brand: "Bosch Rexroth",

    base_unit: "EA",

    unit: "EA",

    variants_count: 2,

    status: "ACTIVE",

    stock_status: "LOW_STOCK",

    on_hand: 18,

    reserved: 6,

    available: 12,

    reorder_point: 25,

    reorder_quantity: 50,

    unit_cost: 128.50,

    currency: "USD",

    barcode: "890123240012",

    tracking: "SERIAL",

  },

  {

    id: "prod-003",

    name: "Polyurethane Timing Belt T10-1200",

    sku: "BELT-T10-1200",

    code: "BELT-T10-1200",

    category: "Power Transmission",

    category_name: "Power Transmission",

    brand: "Gates PowerGrip",

    base_unit: "EA",

    unit: "EA",

    variants_count: 4,

    status: "ACTIVE",

    stock_status: "IN_STOCK",

    on_hand: 280,

    reserved: 20,

    available: 260,

    reorder_point: 50,

    reorder_quantity: 100,

    unit_cost: 32.40,

    currency: "USD",

    barcode: "890123120034",

    tracking: "NONE",

  },

  {

    id: "prod-004",

    name: "Optical Rotary Encoder 1024 PPR",

    sku: "ENC-OPT-1024",

    code: "ENC-OPT-1024",

    category: "Sensors & Automation",

    category_name: "Sensors & Automation",

    brand: "Omron Industrial",

    base_unit: "EA",

    unit: "EA",

    variants_count: 1,

    status: "ACTIVE",

    stock_status: "OUT_OF_STOCK",

    on_hand: 0,

    reserved: 0,

    available: 0,

    reorder_point: 15,

    reorder_quantity: 30,

    unit_cost: 95.00,

    currency: "USD",

    barcode: "890123102498",

    tracking: "SERIAL",

  },

  {

    id: "prod-005",

    name: "Synthetic Compressor Lubricant ISO VG 46",

    sku: "LUB-SYN-VG46",

    code: "LUB-SYN-VG46",

    category: "Chemicals & Fluids",

    category_name: "Chemicals & Fluids",

    brand: "Mobil Rarus",

    base_unit: "LTR",

    unit: "LTR",

    variants_count: 2,

    status: "ACTIVE",

    stock_status: "IN_STOCK",

    on_hand: 1250,

    reserved: 100,

    available: 1150,

    reorder_point: 300,

    reorder_quantity: 600,

    unit_cost: 18.20,

    currency: "USD",

    barcode: "890123460077",

    tracking: "BATCH",

  },

];



export const DEMO_TRANSACTIONS = [

  {

    id: "tx-1001",

    document_number: "GRN-2026-0001",

    type: "RECEIPT",

    transaction_type: "RECEIPT",

    created_at: "2026-10-26T08:18:46Z",

    transaction_date: "2026-10-26",

    item: "Industrial Ball Bearing 6205-2RS",

    item_code: "BRG-6205-2RS",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "Aisle 3 - Rack B",

    quantity: 36.0,

    unit: "EA",

    unit_cost: 14.85,

    supplier: "Apex Motion Bearings Ltd",

    reference_number: "PO-2026-8812",

    status: "POSTED",

  },

  {

    id: "tx-1002",

    document_number: "ISS-2026-0001",

    type: "ISSUE",

    transaction_type: "ISSUE",

    created_at: "2026-10-25T14:22:10Z",

    transaction_date: "2026-10-25",

    item: "Hydraulic Solenoid Valve 24V DC",

    item_code: "HYD-SV-24V",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "Aisle 1 - Bin 4",

    quantity: -2.0,

    unit: "EA",

    unit_cost: 128.50,

    issue_type: "Production",

    reference_number: "WO-9941",

    issued_to: "Assembly Line 2",

    reason: "Production run for Hydraulic Power Units",

    status: "POSTED",

  },

  {

    id: "tx-1003",

    document_number: "TRF-2026-0001",

    type: "TRANSFER",

    transaction_type: "TRANSFER",

    created_at: "2026-10-24T11:05:32Z",

    transaction_date: "2026-10-24",

    item: "Polyurethane Timing Belt T10-1200",

    item_code: "BELT-T10-1200",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "Bay 2",

    destination_warehouse: "East Coast Logistics Terminal",

    destination_warehouse_name: "East Coast Logistics Terminal",

    destination_location_name: "Storage Zone A",

    quantity: 25.0,

    unit: "EA",

    unit_cost: 32.40,

    status: "DISPATCHED",

    remarks: "Transfer to rebalance East Coast distribution inventory",

  },

  {

    id: "tx-1004",

    document_number: "ADJ-2026-0001",

    type: "ADJUSTMENT",

    transaction_type: "ADJUSTMENT",

    created_at: "2026-10-23T16:40:18Z",

    transaction_date: "2026-10-23",

    item: "Synthetic Compressor Lubricant ISO VG 46",

    item_code: "LUB-SYN-VG46",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "Chemical Vault",

    quantity: -12.0,

    unit: "LTR",

    unit_cost: 18.20,

    adjustment_type: "Decrease",

    reason: "Damage",

    system_quantity: 120,

    actual_quantity: 108,

    difference_quantity: -12,

    status: "POSTED",

    remarks: "Container dented during forklift staging",

  },

  {

    id: "tx-1005",

    document_number: "RET-2026-0001",

    type: "RETURN",

    transaction_type: "RETURN",

    created_at: "2026-10-22T09:30:00Z",

    transaction_date: "2026-10-22",

    item: "Industrial Ball Bearing 6205-2RS",

    item_code: "BRG-6205-2RS",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "Aisle 3 - Rack B",

    quantity: 8.0,

    unit: "EA",

    unit_cost: 14.85,

    return_type: "Customer Return",

    reference_number: "RMA-2026-4421",

    party_name: "Midwest Machinery Works",

    product_condition: "Good",

    return_disposition: "Restock",

    status: "POSTED",

    remarks: "Customer over-ordered for preventive maintenance schedule",

  },

  {

    id: "tx-1006",

    document_number: "OPN-2026-0001",

    type: "OPENING",

    transaction_type: "OPENING",

    created_at: "2026-10-01T08:00:00Z",

    transaction_date: "2026-10-01",

    item: "Industrial Ball Bearing 6205-2RS",

    item_code: "BRG-6205-2RS",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "LOC-499 - Aisle 3",

    quantity: 500.0,

    unit: "EA",

    unit_cost: 14.85,

    reference_number: "FY2026-INIT",

    reason: "Fiscal Year 2026 Baseline Balance",

    status: "POSTED",

    remarks: "Audited opening stock initialization",

  },

  {

    id: "tx-1007",

    document_number: "OPN-2026-0002",

    type: "OPENING",

    transaction_type: "OPENING",

    created_at: "2026-10-01T08:00:00Z",

    transaction_date: "2026-10-01",

    item: "Hydraulic Solenoid Valve 24V DC",

    item_code: "HYD-SV-24V",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "LOC-499 - Aisle 1",

    quantity: 250.0,

    unit: "EA",

    unit_cost: 128.50,

    reference_number: "FY2026-INIT",

    reason: "Fiscal Year 2026 Baseline Balance",

    status: "POSTED",

    remarks: "Audited opening stock initialization",

  },

  {

    id: "tx-1008",

    document_number: "RCL-2026-0001",

    type: "RECLASSIFICATION",

    transaction_type: "RECLASSIFICATION",

    created_at: "2026-10-27T10:15:00Z",

    transaction_date: "2026-10-27",

    item: "Industrial Ball Bearing 6205-2RS",

    item_code: "BRG-6205-2RS",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "LOC-499 - Aisle 3",

    quantity: 20.0,

    unit: "EA",

    unit_cost: 14.85,

    from_status: "AVAILABLE",

    to_status: "QUARANTINED",

    reference_number: "QC-HOLD-401",

    reason: "Awaiting QA Microscopic Surface Analysis",

    status: "POSTED",

    remarks: "Batch quarantine hold for metallurgical test",

  },

  {

    id: "tx-1009",

    document_number: "RCL-2026-0002",

    type: "RECLASSIFICATION",

    transaction_type: "RECLASSIFICATION",

    created_at: "2026-10-28T14:30:00Z",

    transaction_date: "2026-10-28",

    item: "Polyurethane Timing Belt T10-1200",

    item_code: "BELT-T10-1200",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "LOC-499 - Aisle 2",

    quantity: 15.0,

    unit: "EA",

    unit_cost: 32.40,

    from_status: "QUARANTINED",

    to_status: "AVAILABLE",

    reference_number: "QC-REL-109",

    reason: "QA Release Certificate Approved",

    status: "POSTED",

    remarks: "Quarantine lifted following tensile verification",

  },

  {

    id: "tx-1010",

    document_number: "TRF-LOC-2026-0001",

    type: "TRANSFER",

    transaction_type: "TRANSFER",

    created_at: "2026-10-29T11:20:00Z",

    transaction_date: "2026-10-29",

    item: "Industrial Ball Bearing 6205-2RS",

    item_code: "BRG-6205-2RS",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "LOC-499 - Aisle 3",

    destination_warehouse: "Main Central Fulfillment Hub",

    destination_warehouse_name: "Main Central Fulfillment Hub",

    destination_location: "VAULT-CHEM",

    destination_location_name: "VAULT-CHEM",

    quantity: 15.0,

    unit: "EA",

    unit_cost: 14.85,

    status: "POSTED",

    remarks: "Inter-location staging transfer to assembly forward bin",

  },

  {

    id: "tx-1011",

    document_number: "ISS-2026-0002",

    type: "ISSUE",

    transaction_type: "ISSUE",

    created_at: "2026-10-30T09:45:00Z",

    transaction_date: "2026-10-30",

    item: "Industrial Ball Bearing 6205-2RS",

    item_code: "BRG-6205-2RS",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "LOC-499 - Aisle 3",

    quantity: -40.0,

    unit: "EA",

    unit_cost: 14.85,

    reference_number: "SO-2026-8812",

    reservation_number: "RES-2026-8812",

    issued_to: "Apex Motion Logistics",

    reason: "Sales dispatch fulfilling reservation RES-2026-8812",

    status: "POSTED",

  },

  {

    id: "tx-1012",

    document_number: "ISS-2026-0003",

    type: "ISSUE",

    transaction_type: "ISSUE",

    created_at: "2026-10-31T15:10:00Z",

    transaction_date: "2026-10-31",

    item: "Polyurethane Timing Belt T10-1200",

    item_code: "BELT-T10-1200",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "LOC-499 - Aisle 2",

    quantity: -5.0,

    unit: "EA",

    unit_cost: 32.40,

    reference_number: "MNT-2026-088",

    issued_to: "Maintenance Dept",

    reason: "Conveyor drive emergency belt replacement",

    status: "POSTED",

  },

  {

    id: "tx-1013",

    document_number: "GRN-2026-0002",

    type: "RECEIPT",

    transaction_type: "RECEIPT",

    created_at: "2026-11-03T14:10:00Z",

    transaction_date: "2026-11-03",

    item: "Hydraulic Solenoid Valve 24V DC",

    item_code: "HYD-SV-24V",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "REC-01",

    quantity: 10.0,

    unit: "EA",

    unit_cost: 128.50,

    supplier: "Bosch Rexroth Corp",

    reference_number: "PO-2026-0842",

    status: "SUBMITTED",

    remarks: "Hydraulic solenoid valves received at receiving dock.",

  },

  {

    id: "tx-1014",

    document_number: "GRN-2026-0003",

    type: "RECEIPT",

    transaction_type: "RECEIPT",

    created_at: "2026-11-02T09:00:00Z",

    transaction_date: "2026-11-02",

    item: "Industrial Ball Bearing 6205-2RS",

    item_code: "BRG-6205-2RS",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "REC-01",

    quantity: 85.0,

    unit: "EA",

    unit_cost: 14.85,

    supplier: "SKF Precision Bearings Ltd",

    reference_number: "PO-2026-0799",

    status: "PARTIALLY_ACCEPTED",

    remarks: "85 approved, 15 rejected due to packaging moisture.",

  },

  {

    id: "tx-1015",

    document_number: "GRN-2026-0004",

    type: "RECEIPT",

    transaction_type: "RECEIPT",

    created_at: "2026-11-01T08:30:00Z",

    transaction_date: "2026-11-01",

    item: "Synthetic Compressor Lubricant ISO VG 46",

    item_code: "LUB-SYN-VG46",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "VAULT-CHEM",

    quantity: 200.0,

    unit: "LTR",

    unit_cost: 18.20,

    supplier: "Mobil Rarus Lubricants",

    reference_number: "PO-2026-0760",

    status: "PUTAWAY_PENDING",

    remarks: "Bulk synthetic compressor oil delivery.",

  },

  {

    id: "tx-1016",

    document_number: "GRN-2026-0005",

    type: "RECEIPT",

    transaction_type: "RECEIPT",

    created_at: "2026-11-02T13:00:00Z",

    transaction_date: "2026-11-02",

    item: "Polyurethane Timing Belt T10-1200",

    item_code: "BELT-T10-1200",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "STG-01",

    quantity: 60.0,

    unit: "EA",

    unit_cost: 32.40,

    supplier: "Gates Industrial Power",

    reference_number: "PO-2026-0810",

    status: "READY_TO_POST",

    remarks: "Urgent belts for production assembly. Fully inspected.",

  },

  {

    id: "tx-1017",

    document_number: "GRN-2026-0006",

    type: "RECEIPT",

    transaction_type: "RECEIPT",

    created_at: "2026-10-30T11:00:00Z",

    transaction_date: "2026-10-30",

    item: "Optical Rotary Encoder 1024 PPR",

    item_code: "ENC-OPT-1024",

    warehouse: "Main Central Fulfillment Hub",

    warehouse_code: "WH-MAIN",

    warehouse_name: "Main Central Fulfillment Hub",

    location: "STG-01",

    quantity: 5.0,

    unit: "EA",

    unit_cost: 215.00,

    supplier: "Omron Automation Global",

    reference_number: "PO-2026-0705",

    status: "POSTED",

    remarks: "High-precision rotary encoders. Posted to active stock ledger.",

  },

];



export const DEMO_KPIS = {

  total_products: 1420,

  total_warehouses: 3,

  total_stock_value: 428540.0,

  total_on_hand: 51660,

  total_available: 48210,

  total_reserved: 3450,

  low_stock_items: 18,

  out_of_stock_items: 4,

};



export const DEMO_CATEGORIES = [

  { id: 1, code: "CAT-MECH", name: "Mechanical Components", items_count: 42, parent: null },

  { id: 2, code: "CAT-HYD", name: "Hydraulics & Pneumatics", items_count: 28, parent: null },

  { id: 3, code: "CAT-TRANS", name: "Power Transmission", items_count: 19, parent: null },

  { id: 4, code: "CAT-SENS", name: "Sensors & Automation", items_count: 35, parent: null },

  { id: 5, code: "CAT-CHEM", name: "Chemicals & Fluids", items_count: 14, parent: null },

  { id: 6, code: "CAT-BEAR", name: "Bearings & Seals", items_count: 22, parent: 1 },

];



export const DEMO_BRANDS = [

  { id: 1, name: "SKF Precision", code: "SKF", country: "Sweden", skus_count: 28, is_active: true },

  { id: 2, name: "Bosch Rexroth", code: "REX", country: "Germany", skus_count: 34, is_active: true },

  { id: 3, name: "Gates PowerGrip", code: "GAT", country: "USA", skus_count: 18, is_active: true },

  { id: 4, name: "Omron Industrial", code: "OMR", country: "Japan", skus_count: 25, is_active: true },

  { id: 5, name: "Mobil Rarus", code: "MOB", country: "USA", skus_count: 12, is_active: true },

];



export const DEMO_UNITS = [

  { id: 1, code: "EA", name: "Each / Unit", symbol: "ea", decimal_places: 0, is_base: true },

  { id: 2, code: "KG", name: "Kilogram", symbol: "kg", decimal_places: 3, is_base: true },

  { id: 3, code: "LTR", name: "Liter", symbol: "L", decimal_places: 2, is_base: true },

  { id: 4, code: "MTR", name: "Meter", symbol: "m", decimal_places: 2, is_base: true },

  { id: 5, code: "BOX", name: "Box (10 units)", symbol: "bx", decimal_places: 0, conversion_factor: 10, base_unit: "EA" },

  { id: 6, code: "PAL", name: "Pallet (100 units)", symbol: "pal", decimal_places: 0, conversion_factor: 100, base_unit: "EA" },

];



export const DEMO_WAREHOUSES = [

  {

    id: 1,

    code: "WH-MAIN",

    name: "Main Central Fulfillment Hub",

    warehouse_type: "Main Warehouse",

    description: "Primary distribution center with high-rack automated picking and bulk receipt.",

    address: "Logistics Blvd 101, Industrial Park",

    city: "Chicago",

    state: "Illinois",

    country: "United States",

    postal_code: "60601",

    manager: "Alex Morgan",

    contact_number: "+1 (312) 555-0192",

    capacity_used: 78,

    zones_count: 5,

    locations_count: 120,

    total_skus: 420,

    status: "Active",

    is_active: true,

  },

  {

    id: 2,

    code: "WH-EAST",

    name: "East Coast Logistics Terminal",

    warehouse_type: "Distribution Warehouse",

    description: "Port-adjacent intermodal terminal handling maritime imports and transshipments.",

    address: "Harbor Road 42, Terminal 3",

    city: "Newark",

    state: "New Jersey",

    country: "United States",

    postal_code: "07101",

    manager: "Sarah Chen",

    contact_number: "+1 (973) 555-0144",

    capacity_used: 45,

    zones_count: 3,

    locations_count: 65,

    total_skus: 180,

    status: "Active",

    is_active: true,

  },

  {

    id: 3,

    code: "WH-COLD",

    name: "Specialized Temperature Vault",

    warehouse_type: "Production Warehouse",

    description: "Cold-chain facility maintaining strict ISO cleanroom specs for sensitive materials.",

    address: "Arctic Avenue 7, Zone B",

    city: "Dallas",

    state: "Texas",

    country: "United States",

    postal_code: "75201",

    manager: "David Kim",

    contact_number: "+1 (214) 555-0188",

    capacity_used: 92,

    zones_count: 2,

    locations_count: 30,

    total_skus: 45,

    status: "Active",

    is_active: true,

  },

];



export const DEMO_LOCATIONS = [

  { id: 1, code: "LOC-REC-01", name: "Receiving Bay 01", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location_type: "Receiving", description: "Inbound dock pallet inspection and sorting", status: "Active", is_active: true, capacity: "5,000 KG", occupied: 30 },

  { id: 2, code: "LOC-STO-A1", name: "Aisle 1 High Rack Storage", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location_type: "Storage", description: "Heavy pallet racking for high runners", status: "Active", is_active: true, capacity: "10,000 KG", occupied: 75 },

  { id: 3, code: "LOC-PIK-01", name: "Fast Pick Conveyor Zone", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location_type: "Picking", description: "Pick-to-light gravity shelves", status: "Active", is_active: true, capacity: "2,000 KG", occupied: 82 },

  { id: 4, code: "LOC-PAK-02", name: "Packing Station Bench 2", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location_type: "Packing", description: "Secondary packing and barcode verification", status: "Active", is_active: true, capacity: "1,500 KG", occupied: 40 },

  { id: 5, code: "LOC-DSP-01", name: "Outbound Dispatch Bay", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location_type: "Dispatch", description: "Trailer staging and carrier handoff", status: "Active", is_active: true, capacity: "8,000 KG", occupied: 55 },

  { id: 6, code: "LOC-INS-QA", name: "Incoming QA Inspection Lab", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location_type: "Inspection", description: "CMM and visual tolerance verification", status: "Active", is_active: true, capacity: "1,000 KG", occupied: 25 },

  { id: 7, code: "LOC-QAR-01", name: "Quarantine Vault 1", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location_type: "Quarantine", description: "Held pending disposition / NCR resolution", status: "Blocked", is_active: false, capacity: "3,000 KG", occupied: 90 },

  { id: 8, code: "LOC-RET-01", name: "Customer Returns RMA Bay", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location_type: "Returns", description: "RMA intake and triage", status: "Active", is_active: true, capacity: "2,000 KG", occupied: 15 },

];



export const DEMO_RACKS = [

  { id: 1, code: "RACK-001", name: "Aisle 1 Heavy Pallet Rack", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location: "LOC-STO-A1", location_code: "LOC-STO-A1", location_name: "Aisle 1 High Rack Storage", number_of_levels: 5, status: "Active" },

  { id: 2, code: "RACK-002", name: "Aisle 2 Carton Flow Rack", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location: "LOC-STO-A1", location_code: "LOC-STO-A1", location_name: "Aisle 1 High Rack Storage", number_of_levels: 4, status: "Active" },

  { id: 3, code: "RACK-003", name: "Receiving Staging Rack R3", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location: "LOC-REC-01", location_code: "LOC-REC-01", location_name: "Receiving Bay 01", number_of_levels: 3, status: "Active" },

  { id: 4, code: "RACK-004", name: "Quarantine Secure Rack Q4", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location: "LOC-QAR-01", location_code: "LOC-QAR-01", location_name: "Quarantine Vault 1", number_of_levels: 3, status: "Blocked" },

];



export const DEMO_BINS = [

  { id: 1, code: "BIN-A1-01", name: "Aisle 1 Level 1 Bin 01", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location: "LOC-STO-A1", location_code: "LOC-STO-A1", location_name: "Aisle 1 High Rack Storage", rack: "RACK-001", rack_code: "RACK-001", rack_name: "Aisle 1 Heavy Pallet Rack", rack_level: 1, barcode: "BIN-A1-01-8849", status: "Active" },

  { id: 2, code: "BIN-A1-02", name: "Aisle 1 Level 2 Bin 02", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location: "LOC-STO-A1", location_code: "LOC-STO-A1", location_name: "Aisle 1 High Rack Storage", rack: "RACK-001", rack_code: "RACK-001", rack_name: "Aisle 1 Heavy Pallet Rack", rack_level: 2, barcode: "BIN-A1-02-1923", status: "Active" },

  { id: 3, code: "BIN-A2-01", name: "Aisle 2 Level 1 Bin 01", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location: "LOC-STO-A1", location_code: "LOC-STO-A1", location_name: "Aisle 1 High Rack Storage", rack: "RACK-002", rack_code: "RACK-002", rack_name: "Aisle 2 Carton Flow Rack", rack_level: 1, barcode: "BIN-A2-01-4432", status: "Active" },

  { id: 4, code: "BIN-Q1-01", name: "Quarantine Level 1 Bin 01", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", location: "LOC-QAR-01", location_code: "LOC-QAR-01", location_name: "Quarantine Vault 1", rack: "RACK-004", rack_code: "RACK-004", rack_name: "Quarantine Secure Rack Q4", rack_level: 1, barcode: "BIN-Q1-01-9921", status: "Blocked" },

];



export const DEMO_WAREHOUSE_CONFIG = {

  default_warehouse: "WH-MAIN",

  allow_negative_stock: false,

  require_storage_location: true,

  require_bin_selection: true,

  enable_multiple_warehouses: true,

  allow_inter_warehouse_transfer: true,

  warehouse_code_prefix: "WH",

  location_code_prefix: "LOC",

  rack_code_prefix: "RACK",

  bin_code_prefix: "BIN",

};



// ---------------------------------------------------------------------------

// Dashboard KPI API

// ---------------------------------------------------------------------------

export async function fetchDashboardKPIs() {

  try {

    const res = await fetch(`${API_BASE}/inventory/dashboard/kpis/`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      const parsedRoot = Object.fromEntries(

        Object.entries(DEMO_KPIS).map(([key, fallback]) => {

          const value = data?.[key];

          const parsed = Number(value);

          return [

            key,

            value !== null &&

            value !== undefined &&

            value !== "" &&

            Number.isFinite(parsed)

              ? parsed

              : fallback,

          ];

        })

      );

      return {

        ...data,

        ...parsedRoot,

      };

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return DEMO_KPIS;

}



export async function approveStockTransaction(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/movements/${id}/approve/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return { id, status: "APPROVED" };

}



export async function rejectStockTransaction(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/movements/${id}/reject/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return { id, status: "REJECTED" };

}



export const fetchInventoryKPIs = fetchDashboardKPIs;



// ---------------------------------------------------------------------------

// Product Catalog APIs with Live Persistence

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Product master helpers
// ---------------------------------------------------------------------------
// Writable InventoryItem fields accepted by the items API.
const ITEM_WRITE_FIELDS = [
  "code", "name", "display_name", "short_description", "description", "long_description",
  "item_type", "classification", "brand", "manufacturer", "model_number", "country_of_origin",
  "status", "is_active", "track_inventory", "is_stockable", "is_purchasable", "is_salable",
  "allow_negative_stock", "tracking", "batch_tracking_required", "serial_tracking_required",
  "expiry_tracking_required", "has_variants", "base_unit", "reorder_point", "reorder_quantity",
  "valuation_method", "standard_cost", "list_price", "net_weight", "gross_weight", "length",
  "width", "height", "volume", "min_order_qty", "lead_time_days", "purchase_tax_code",
  "sales_tax_code", "barcode",
];

// The API serializer accepts either foreign-key IDs or registered unit codes.
const ITEM_FK_FIELDS = ["subcategory", "brand_ref", "base_uom", "purchase_uom", "sales_uom", "weight_uom", "dimension_uom"];
const ITEM_UOM_FIELDS = ["base_uom", "purchase_uom", "sales_uom", "weight_uom", "dimension_uom"];

const isRecordId = (v) => typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v));

function buildItemRequestBody(payload, categoryId) {
  const body = {};
  for (const field of ITEM_WRITE_FIELDS) {
    if (payload[field] !== undefined) body[field] = payload[field];
  }
  for (const field of ITEM_FK_FIELDS) {
    const isUomCode = ITEM_UOM_FIELDS.includes(field) && typeof payload[field] === "string" && payload[field].trim();
    if (isRecordId(payload[field]) || isUomCode) {
      body[field] = payload[field];
    }
  }
  if (typeof payload.base_uom === "string" && payload.base_uom.trim()) {
    body.base_unit = payload.base_uom;
  } else if (typeof payload.unit === "string" && payload.unit.trim()) {
    body.base_unit = payload.unit;
  }
  if (body.standard_cost === undefined && payload.unit_cost !== undefined) body.standard_cost = payload.unit_cost;
  // The UI's "INACTIVE" is the server's DISCONTINUED (what /deactivate/ sets).
  if (body.status === "INACTIVE") body.status = "DISCONTINUED";
  if (categoryId !== undefined && categoryId !== null) body.category = categoryId;
  return body;
}

// Turn a failed response into a readable message (DRF returns {error}, {detail} or per-field lists).
async function readApiError(res, fallback) {
  try {
    const data = await res.json();
    if (typeof data === "string") return data;
    if (data?.error) return data.error;
    if (data?.detail) return data.detail;
    const [field, messages] = Object.entries(data || {})[0] || [];
    if (field) return `${field}: ${Array.isArray(messages) ? messages[0] : messages}`;
  } catch (e) {
    // Non-JSON body (HTML error page)
  }
  return `${fallback} (HTTP ${res.status})`;
}

// Products deleted while offline (or demo products) are remembered here so
// they do not reappear from the server/demo list on the next load.
function getDeletedProductKeys() {
  return new Set(getLocalEntities("deleted_products").map((k) => String(k).toLowerCase()));
}

function rememberDeletedProduct(product) {
  try {
    const keys = getDeletedProductKeys();
    [product?.id, product?.sku, product?.code].filter(Boolean).forEach((k) => keys.add(String(k).toLowerCase()));
    localStorage.setItem("inv_deleted_products", JSON.stringify([...keys]));
  } catch (e) {}
}

const productKey = (item) => String(item.sku || item.code || item.id || "").toLowerCase();

function normalizeApiProduct(p) {
  const onHand = parseFloat(p.on_hand ?? p.total_on_hand ?? 0) || 0;
  const reserved = parseFloat(p.reserved ?? p.total_reserved ?? 0) || 0;
  const available = parseFloat(p.available ?? p.total_available ?? onHand - reserved) || 0;
  const reorderPoint = parseFloat(p.reorder_point ?? 0) || 0;
  return {
    ...p,
    sku: p.code || p.sku,
    name: p.name,
    category_id: p.category,
    category: p.category_name || resolveCategoryName(p.category),
    brand: p.brand || p.brand_name || "",
    unit: p.base_unit || p.base_uom_code || p.unit || "EA",
    unit_cost: parseFloat(p.unit_cost ?? p.standard_cost ?? 0) || 0,
    on_hand: onHand,
    reserved,
    available,
    reorder_point: reorderPoint,
    reorder_quantity: parseFloat(p.reorder_quantity ?? 0) || 0,
    stock_status: onHand <= 0 ? "OUT_OF_STOCK" : available <= reorderPoint ? "LOW_STOCK" : "IN_STOCK",
  };
}

export async function fetchProducts(params = {}) {
  let fetchedList = [];
  let apiReachable = false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const query = new URLSearchParams(params).toString();
    fetchedList = (await fetchAllPages(`${API_BASE}/inventory/items/?${query}`, controller.signal))
      .map(normalizeApiProduct);
    updateApiStatus(true);
    apiReachable = true;
  } catch (e) {
    fetchedList = [];
    updateApiStatus(false);
  } finally {
    clearTimeout(timeoutId);
  }

  const deleted = getDeletedProductKeys();
  const isDeleted = (item) =>
    [item.id, item.sku, item.code].some((k) => k !== undefined && k !== null && deleted.has(String(k).toLowerCase()));

  const localList = getLocalEntities("products");
  const baseList = apiReachable ? fetchedList : DEMO_PRODUCTS;
  const seen = new Set();
  const merged = [];
  const push = (item) => {
    const key = productKey(item);
    if (key && !seen.has(key) && !isDeleted(item)) {
      seen.add(key);
      merged.push(item);
    }
  };

  if (apiReachable) {
    // The server is the source of truth for every product it knows; local
    // copies are kept only for products it does not have (created offline).
    fetchedList.forEach(push);
    localList.forEach(push);
  } else {
    // Offline: local creates/edits take precedence over the demo catalogue.
    localList.forEach(push);
    baseList.forEach(push);
  }

  return { results: merged, count: merged.length };
}

export async function createProduct(payload) {
  const categoryValue = payload.category_id ?? payload.category;
  const categoryId = resolveCategoryId(categoryValue);
  const categoryName = payload.category_name || resolveCategoryName(payload.category || categoryId);
  const sku = (payload.code || payload.sku || `SKU-${Date.now().toString().slice(-6)}`).toUpperCase();
  const name = payload.name || "Untitled Product";
  const barcode = payload.barcode?.trim() || generateEan13();

  const requestBody = buildItemRequestBody(
    {
      reorder_quantity: Number(payload.reorder_point ?? 50) * 2,
      brand: "Preferred OEM",
      tracking: "NONE",
      item_type: "STOCK",
      is_active: (payload.status || "ACTIVE") === "ACTIVE",
      ...payload,
      code: sku,
      name,
      barcode,
      base_unit: payload.base_unit || payload.unit || "EA",
    },
    categoryId
  );

  let res = null;
  try {
    res = await fetch(`${API_BASE}/inventory/items/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  } catch (e) {
    updateApiStatus(false);
  }

  // Server reachable but rejected the product (duplicate code, invalid field...):
  // surface it instead of silently saving a local-only copy.
  if (res && !res.ok) {
    throw new Error(await readApiError(res, "Failed to create product"));
  }

  let createdProduct;
  if (res) {
    updateApiStatus(true);
    createdProduct = normalizeApiProduct(await res.json());
  } else {
    const onHand = 0;
    createdProduct = {
      ...requestBody,
      id: `prod-${Date.now()}`,
      sku,
      code: sku,
      category_id: categoryId,
      category: categoryName,
      category_name: categoryName,
      unit: requestBody.base_unit,
      unit_cost: Number(requestBody.standard_cost) || 0,
      on_hand: onHand,
      reserved: 0,
      available: 0,
      stock_status: "OUT_OF_STOCK",
      variants_count: 1,
      status: requestBody.status || "ACTIVE",
      currency: "USD",
    };
    // Offline only: keep it locally until the server is reachable again.
    saveLocalEntity("products", createdProduct, "sku");
  }
  return createdProduct;
}

export async function updateProduct(id, payload) {
  const categoryValue = payload.category_id ?? payload.category;
  const categoryId = categoryValue ? resolveCategoryId(categoryValue) : undefined;
  const patchData = buildItemRequestBody(payload, categoryId);
  delete patchData.code; // the item code is the product's identity; never re-key it from an edit

  let res = null;
  if (isRecordId(id)) {
    try {
      res = await fetch(`${API_BASE}/inventory/items/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      });
    } catch (e) {
      updateApiStatus(false);
    }
  }

  if (res && !res.ok) {
    throw new Error(await readApiError(res, "Failed to update product"));
  }

  if (res) {
    updateApiStatus(true);
    const saved = normalizeApiProduct({ ...payload, ...(await res.json()) });
    // Keep stock figures the page already had; the item endpoint is the master record.
    return {
      ...saved,
      on_hand: payload.on_hand ?? saved.on_hand,
      reserved: payload.reserved ?? saved.reserved,
      available: payload.available ?? saved.available,
      stock_status: payload.stock_status ?? saved.stock_status,
    };
  }

  // Offline, or a product that only exists locally.
  const updatedProduct = { ...payload, id };
  saveLocalEntity("products", updatedProduct, "sku");
  return updatedProduct;
}

export async function deleteProduct(id, product = null) {
  let res = null;
  if (isRecordId(id)) {
    try {
      res = await fetch(`${API_BASE}/inventory/items/${id}/`, { method: "DELETE" });
    } catch (e) {
      updateApiStatus(false);
    }
  }

  // 404 means the server never had it (local-only product): fine to drop locally.
  if (res && !res.ok && res.status !== 404) {
    // e.g. "Cannot delete item ... historical ledger transactions exist. Please deactivate the item instead."
    throw new Error(await readApiError(res, "Failed to delete product"));
  }

  deleteLocalEntity("products", id, "id");
  if (product?.sku) deleteLocalEntity("products", product.sku, "sku");
  rememberDeletedProduct(product || { id });
  return true;
}

// ---------------------------------------------------------------------------

// Categories API with Live Persistence

// ---------------------------------------------------------------------------

export async function fetchCategories() {

  let fetchedList = [];
  let apiReachable = false;

  try {
    fetchedList = await fetchAllPages(`${API_BASE}/inventory/categories/`);
    updateApiStatus(true);
    apiReachable = true;

  } catch (e) {

    updateApiStatus(false);

  }



  return apiReachable ? fetchedList : [];

}



export async function createCategory(payload) {

  const code = (payload.code || `CAT-${Date.now().toString().slice(-4)}`).toUpperCase();

  const name = payload.name;

  const res = await fetch(`${API_BASE}/inventory/categories/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      name,
      description: payload.description || "",
      parent: payload.parent || null,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || data.code?.[0] || data.name?.[0] || "Failed to create category.");
  }
  updateApiStatus(true);
  return await res.json();

}



// ---------------------------------------------------------------------------

// Brands API with Live Persistence

// ---------------------------------------------------------------------------

export async function fetchBrands() {

  let fetchedList = [];
  let apiReachable = false;

  try {
    fetchedList = await fetchAllPages(`${API_BASE}/inventory/brands/`);
    updateApiStatus(true);
    apiReachable = true;

  } catch (e) {

    updateApiStatus(false);

  }



  return apiReachable ? fetchedList : [];

}



export async function createBrand(payload) {

  const code = (payload.code || `BR-${Date.now().toString().slice(-4)}`).toUpperCase();

  const name = payload.name;

  const res = await fetch(`${API_BASE}/inventory/brands/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      name,
      country: payload.country || "Global",
      description: payload.description || "",
      is_active: true,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || data.code?.[0] || data.name?.[0] || "Failed to create brand.");
  }
  updateApiStatus(true);
  return await res.json();

}



// ---------------------------------------------------------------------------

// Units of Measure API with Live Persistence

// ---------------------------------------------------------------------------

export async function fetchUnits() {

  let fetchedList = [];
  let apiReachable = false;

  try {
    fetchedList = await fetchAllPages(`${API_BASE}/inventory/units/`);
    updateApiStatus(true);
    apiReachable = true;

  } catch (e) {

    updateApiStatus(false);

  }



  return apiReachable ? fetchedList : [];

}



export async function createUnit(payload) {

  const code = (payload.code || `U-${Date.now().toString().slice(-3)}`).toUpperCase();

  const res = await fetch(`${API_BASE}/inventory/units/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      name: payload.name,
      symbol: payload.symbol || code.toLowerCase(),
      dimension: payload.dimension || "COUNT",
      decimal_places: Number(payload.decimal_places) || 0,
      is_base: payload.is_base ?? true,
      base_unit: payload.base_unit || null,
      conversion_factor: Number(payload.conversion_factor) || 1,
      allow_fractional_quantity: Boolean(payload.allow_fractional_quantity),
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || data.code?.[0] || data.name?.[0] || "Failed to create unit.");
  }
  updateApiStatus(true);
  return await res.json();

}



// ---------------------------------------------------------------------------

// Warehouses API with Live Persistence

// ---------------------------------------------------------------------------

export async function fetchWarehouses() {

  let fetchedList = [];

  try {

    const res = await fetch(`${API_BASE}/inventory/warehouses/`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = (data.results || data).map((wh) => ({

        ...wh,

        warehouse_type: wh.warehouse_type || "Main Warehouse",

        city: wh.city || "Chicago",

        state: wh.state || "IL",

        country: wh.country || "United States",

        manager: wh.manager || "",

        contact_number: wh.contact_number || "",

        capacity_used: wh.capacity_used ?? 68,

        zones_count: wh.zones_count ?? 4,

        locations_count: wh.locations_count ?? 50,

        total_skus: wh.total_skus ?? 280,

        status: wh.status || (wh.is_active === false ? "Inactive" : "Active"),

        is_active: wh.status ? wh.status.toLowerCase() === "active" : (wh.is_active !== false),

      }));

    }

  } catch (e) {

    updateApiStatus(false);

  }



  const base = fetchedList.length > 0 ? fetchedList : DEMO_WAREHOUSES;

  const local = getLocalEntities("warehouses");



  const seen = new Set();

  const merged = [];

  for (const item of [...local, ...base]) {

    const key = (item.code || item.name || item.id).toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push(item);

    }

  }

  return merged;

}



export async function createWarehouse(payload) {

  let created = null;

  const statusStr = payload.status || (payload.is_active === false ? "Inactive" : "Active");

  const isActive = statusStr.toLowerCase() === "active";



  try {

    const res = await fetch(`${API_BASE}/inventory/warehouses/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        code: payload.code,

        name: payload.name,

        warehouse_type: payload.warehouse_type || "Main Warehouse",

        description: payload.description || "",

        address: payload.address || "",

        city: payload.city || "",

        state: payload.state || "",

        country: payload.country || "United States",

        postal_code: payload.postal_code || "",

        manager: payload.manager || "",

        contact_number: payload.contact_number || "",

        status: statusStr,

        is_active: isActive,

      }),

    });

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      created = {

        ...data,

        warehouse_type: payload.warehouse_type || data.warehouse_type || "Main Warehouse",

        description: payload.description || "",

        address: payload.address || "",

        city: payload.city || "",

        state: payload.state || "",

        country: payload.country || "United States",

        postal_code: payload.postal_code || "",

        manager: payload.manager || "",

        contact_number: payload.contact_number || "",

        capacity_used: payload.capacity_used || 20,

        zones_count: payload.zones_count || 1,

        locations_count: payload.locations_count || 0,

        total_skus: 0,

        status: statusStr,

        is_active: isActive,

      };

    }

  } catch (e) {}



  if (!created) {

    created = {

      id: `wh-${Date.now()}`,

      code: payload.code,

      name: payload.name,

      warehouse_type: payload.warehouse_type || "Main Warehouse",

      description: payload.description || "",

      address: payload.address || "",

      city: payload.city || "",

      state: payload.state || "",

      country: payload.country || "United States",

      postal_code: payload.postal_code || "",

      manager: payload.manager || "",

      contact_number: payload.contact_number || "",

      capacity_used: payload.capacity_used || 25,

      zones_count: payload.zones_count || 2,

      locations_count: payload.locations_count || 12,

      total_skus: 0,

      status: statusStr,

      is_active: isActive,

    };

  }



  saveLocalEntity("warehouses", created, "code");

  return created;

}



export async function updateWarehouse(id, payload) {

  const statusStr = payload.status || (payload.is_active === false ? "Inactive" : "Active");

  const enriched = {

    ...payload,

    status: statusStr,

    is_active: statusStr.toLowerCase() === "active",

  };

  try {

    const res = await fetch(`${API_BASE}/inventory/warehouses/${id}/`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(enriched),

    });

    if (res.ok) {

      updateApiStatus(true);

    }

  } catch (e) {}



  updateLocalEntity("warehouses", id, enriched, "id");

  return { id, ...enriched };

}



export async function deleteWarehouse(id) {

  deleteLocalEntity("warehouses", id, "id");

  try {

    const res = await fetch(`${API_BASE}/inventory/warehouses/${id}/`, {

      method: "DELETE",

    });

    return res.ok;

  } catch (e) {

    return true;

  }

}



// ---------------------------------------------------------------------------

// Storage Locations API with Live Persistence

// ---------------------------------------------------------------------------

export const fetchStorageLocations = fetchLocations;



export async function fetchLocations() {

  let fetchedList = [];

  try {

    const res = await fetch(`${API_BASE}/inventory/locations/`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = (data.results || data).map((loc) => ({

        ...loc,

        warehouse: loc.warehouse_code || (typeof loc.warehouse === "string" ? loc.warehouse : "WH-MAIN"),

        warehouse_code: loc.warehouse_code || "WH-MAIN",

        warehouse_name: loc.warehouse_name || "Main Central Fulfillment Hub",

        location_type: loc.location_type || "Storage",

        description: loc.description || "",

        status: loc.status || (loc.is_active === false ? "Inactive" : "Active"),

        type: loc.location_type || "Storage",

        capacity: loc.capacity || "1,000 KG",

        occupied: loc.occupied ?? 55,

      }));

    }

  } catch (e) {

    updateApiStatus(false);

  }



  const base = fetchedList.length > 0 ? fetchedList : DEMO_LOCATIONS;

  const local = getLocalEntities("locations");



  const seen = new Set();

  const merged = [];

  for (const item of [...local, ...base]) {

    const key = (item.code || item.id).toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push(item);

    }

  }

  return merged;

}



export async function createLocation(payload) {

  let created = null;

  const statusStr = payload.status || "Active";

  const isActive = statusStr.toLowerCase() === "active";



  try {

    const res = await fetch(`${API_BASE}/inventory/locations/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        warehouse: payload.warehouse_id || 1,

        code: payload.code,

        name: payload.name,

        location_type: payload.location_type || "Storage",

        description: payload.description || "",

        status: statusStr,

        is_active: isActive,

      }),

    });

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      created = {

        ...data,

        warehouse: payload.warehouse_code || payload.warehouse,

        warehouse_code: payload.warehouse_code || payload.warehouse,

        warehouse_name: payload.warehouse_name || "Facility",

        location_type: payload.location_type || "Storage",

        description: payload.description || "",

        status: statusStr,

        is_active: isActive,

        type: payload.location_type || "Storage",

        capacity: payload.capacity || "1,000 KG",

        occupied: payload.occupied || 10,

      };

    }

  } catch (e) {}



  if (!created) {

    created = {

      id: `loc-${Date.now()}`,

      code: payload.code,

      name: payload.name,

      warehouse: payload.warehouse_code || payload.warehouse || "WH-MAIN",

      warehouse_code: payload.warehouse_code || payload.warehouse || "WH-MAIN",

      warehouse_name: payload.warehouse_name || "Main Central Hub",

      location_type: payload.location_type || "Storage",

      description: payload.description || "",

      status: statusStr,

      is_active: isActive,

      type: payload.location_type || "Storage",

      capacity: payload.capacity || "1,000 KG",

      occupied: payload.occupied || 10,

    };

  }



  saveLocalEntity("locations", created, "code");

  return created;

}



export async function updateLocation(id, payload) {

  const statusStr = payload.status || "Active";

  const enriched = {

    ...payload,

    status: statusStr,

    is_active: statusStr.toLowerCase() === "active",

  };

  try {

    const res = await fetch(`${API_BASE}/inventory/locations/${id}/`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(enriched),

    });

    if (res.ok) {

      updateApiStatus(true);

    }

  } catch (e) {}



  updateLocalEntity("locations", id, enriched, "id");

  return { id, ...enriched };

}



export async function deleteLocation(id) {

  deleteLocalEntity("locations", id, "id");

  try {

    const res = await fetch(`${API_BASE}/inventory/locations/${id}/`, {

      method: "DELETE",

    });

    return res.ok;

  } catch (e) {

    return true;

  }

}



// ---------------------------------------------------------------------------

// Racks API with Live Persistence

// ---------------------------------------------------------------------------

export async function fetchRacks() {

  let fetchedList = [];

  try {

    const res = await fetch(`${API_BASE}/inventory/racks/`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = (data.results || data).map((r) => ({

        ...r,

        warehouse: r.warehouse_code || "WH-MAIN",

        warehouse_code: r.warehouse_code || "WH-MAIN",

        location: r.location_code || "",

        location_code: r.location_code || "",

        status: r.status || "Active",

      }));

    }

  } catch (e) {

    updateApiStatus(false);

  }



  const base = fetchedList.length > 0 ? fetchedList : DEMO_RACKS;

  const local = getLocalEntities("racks");



  const seen = new Set();

  const merged = [];

  for (const item of [...local, ...base]) {

    const key = (item.code || item.id).toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push(item);

    }

  }

  return merged;

}



export async function createRack(payload) {

  let created = null;

  try {

    const res = await fetch(`${API_BASE}/inventory/racks/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        warehouse: payload.warehouse_id || 1,

        location: payload.location_id || null,

        code: payload.code,

        name: payload.name,

        number_of_levels: parseInt(payload.number_of_levels, 10) || 4,

        status: payload.status || "Active",

      }),

    });

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      created = {

        ...data,

        warehouse: payload.warehouse_code || payload.warehouse,

        warehouse_code: payload.warehouse_code || payload.warehouse,

        warehouse_name: payload.warehouse_name || "Facility",

        location: payload.location_code || payload.location,

        location_code: payload.location_code || payload.location,

        location_name: payload.location_name || "Location",

      };

    }

  } catch (e) {}



  if (!created) {

    created = {

      id: `rack-${Date.now()}`,

      code: payload.code,

      name: payload.name,

      warehouse: payload.warehouse_code || payload.warehouse || "WH-MAIN",

      warehouse_code: payload.warehouse_code || payload.warehouse || "WH-MAIN",

      warehouse_name: payload.warehouse_name || "Facility",

      location: payload.location_code || payload.location || "",

      location_code: payload.location_code || payload.location || "",

      location_name: payload.location_name || "Location",

      number_of_levels: parseInt(payload.number_of_levels, 10) || 4,

      status: payload.status || "Active",

    };

  }



  saveLocalEntity("racks", created, "code");

  return created;

}



export async function updateRack(id, payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/racks/${id}/`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) updateApiStatus(true);

  } catch (e) {}



  updateLocalEntity("racks", id, payload, "id");

  return { id, ...payload };

}



export async function deleteRack(id) {

  deleteLocalEntity("racks", id, "id");

  try {

    const res = await fetch(`${API_BASE}/inventory/racks/${id}/`, {

      method: "DELETE",

    });

    return res.ok;

  } catch (e) {

    return true;

  }

}



// ---------------------------------------------------------------------------

// Bins API with Live Persistence

// ---------------------------------------------------------------------------

export async function fetchBins() {

  let fetchedList = [];

  try {

    const res = await fetch(`${API_BASE}/inventory/bins/`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = (data.results || data).map((b) => ({

        ...b,

        warehouse: b.warehouse_code || "WH-MAIN",

        warehouse_code: b.warehouse_code || "WH-MAIN",

        location: b.location_code || "",

        location_code: b.location_code || "",

        rack: b.rack_code || "",

        rack_code: b.rack_code || "",

        status: b.status || "Active",

      }));

    }

  } catch (e) {

    updateApiStatus(false);

  }



  const base = fetchedList.length > 0 ? fetchedList : DEMO_BINS;

  const local = getLocalEntities("bins");



  const seen = new Set();

  const merged = [];

  for (const item of [...local, ...base]) {

    const key = (item.code || item.id).toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push(item);

    }

  }

  return merged;

}



export async function createBin(payload) {

  let created = null;

  try {

    const res = await fetch(`${API_BASE}/inventory/bins/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        warehouse: payload.warehouse_id || 1,

        location: payload.location_id || null,

        rack: payload.rack_id || null,

        code: payload.code,

        name: payload.name,

        rack_level: parseInt(payload.rack_level, 10) || 1,

        barcode: payload.barcode || "",

        status: payload.status || "Active",

      }),

    });

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      created = {

        ...data,

        warehouse: payload.warehouse_code || payload.warehouse,

        warehouse_code: payload.warehouse_code || payload.warehouse,

        warehouse_name: payload.warehouse_name || "Facility",

        location: payload.location_code || payload.location,

        location_code: payload.location_code || payload.location,

        location_name: payload.location_name || "Location",

        rack: payload.rack_code || payload.rack,

        rack_code: payload.rack_code || payload.rack,

        rack_name: payload.rack_name || "Rack",

      };

    }

  } catch (e) {}



  if (!created) {

    created = {

      id: `bin-${Date.now()}`,

      code: payload.code,

      name: payload.name,

      warehouse: payload.warehouse_code || payload.warehouse || "WH-MAIN",

      warehouse_code: payload.warehouse_code || payload.warehouse || "WH-MAIN",

      warehouse_name: payload.warehouse_name || "Facility",

      location: payload.location_code || payload.location || "",

      location_code: payload.location_code || payload.location || "",

      location_name: payload.location_name || "Location",

      rack: payload.rack_code || payload.rack || "",

      rack_code: payload.rack_code || payload.rack || "",

      rack_name: payload.rack_name || "Rack",

      rack_level: parseInt(payload.rack_level, 10) || 1,

      barcode: payload.barcode || `${payload.code}-${Math.floor(1000 + Math.random() * 9000)}`,

      status: payload.status || "Active",

    };

  }



  saveLocalEntity("bins", created, "code");

  return created;

}



export async function updateBin(id, payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/bins/${id}/`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) updateApiStatus(true);

  } catch (e) {}



  updateLocalEntity("bins", id, payload, "id");

  return { id, ...payload };

}



export async function deleteBin(id) {

  deleteLocalEntity("bins", id, "id");

  try {

    const res = await fetch(`${API_BASE}/inventory/bins/${id}/`, {

      method: "DELETE",

    });

    return res.ok;

  } catch (e) {

    return true;

  }

}



// ---------------------------------------------------------------------------

// Warehouse Configuration API with Live Persistence

// ---------------------------------------------------------------------------

export async function fetchWarehouseConfig() {

  try {

    const res = await fetch(`${API_BASE}/inventory/warehouse-config/`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      if (data && typeof data === "object") {

        return {

          ...DEMO_WAREHOUSE_CONFIG,

          ...data,

          default_warehouse: data.default_warehouse_code || data.default_warehouse || DEMO_WAREHOUSE_CONFIG.default_warehouse,

        };

      }

    }

  } catch (e) {}



  const local = localStorage.getItem("inv_warehouse_config");

  if (local) {

    try {

      return { ...DEMO_WAREHOUSE_CONFIG, ...JSON.parse(local) };

    } catch (e) {}

  }

  return DEMO_WAREHOUSE_CONFIG;

}



export async function updateWarehouseConfig(payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/warehouse-config/1/`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) updateApiStatus(true);

  } catch (e) {}



  localStorage.setItem("inv_warehouse_config", JSON.stringify(payload));

  return payload;

}



// ---------------------------------------------------------------------------

// Stock Movements & Transactions with Live Persistence

// ---------------------------------------------------------------------------

export function normalizeMovement(item) {

  if (!item) return null;

  const line = Array.isArray(item.lines) && item.lines.length > 0 ? item.lines[0] : null;

  const rawType = item.type || item.transaction_type || (line && Number(line.quantity) < 0 ? "ISSUE" : "RECEIPT");

  const type = String(rawType || "RECEIPT").toUpperCase();



  const itemName =

    item.item ||

    item.item_name ||

    (line && (line.item_name || line.item_code)) ||

    "Industrial Ball Bearing 6205-2RS";

  const itemCode =

    item.item_code || (line && line.item_code) || "BRG-6205-2RS";

  const warehouse =

    item.warehouse_name ||

    (typeof item.warehouse === "string" ? item.warehouse : null) ||

    "Main Central Fulfillment Hub";

  const location =

    item.location ||

    item.location_code ||

    (line && (line.location_code || line.location)) ||

    "Aisle 3 - Rack B";

  const destWarehouse =

    item.destination_warehouse_name ||

    (typeof item.destination_warehouse === "string" ? item.destination_warehouse : null) ||

    "";

  const destLocation =

    item.destination_location_name ||

    (line && (line.destination_location_code || line.destination_location)) ||

    "";



  const rawQty =

    item.quantity !== undefined && item.quantity !== null

      ? Number(item.quantity)

      : line && line.quantity !== undefined

      ? Number(line.quantity)

      : 10;

  const quantity = type === "ISSUE" && rawQty > 0 ? -rawQty : rawQty;

  const unit = item.unit || (line && line.unit) || "EA";

  const unitCost =

    item.unit_cost !== undefined && item.unit_cost !== null

      ? Number(item.unit_cost)

      : line && line.unit_cost !== undefined

      ? Number(line.unit_cost)

      : 14.85;



  return {

    ...item,

    id: item.id || `tx-${Math.random()}`,

    document_number:

      item.document_number ||

      `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,

    type,

    transaction_type: type,

    created_at: item.created_at || new Date().toISOString(),

    transaction_date: item.transaction_date || (item.created_at ? item.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),

    item: itemName,

    item_code: itemCode,

    warehouse,

    warehouse_name: warehouse,

    location,

    destination_warehouse: destWarehouse,

    destination_warehouse_name: destWarehouse,

    destination_location: destLocation,

    destination_location_name: destLocation,

    quantity,

    unit,

    unit_cost: unitCost,

    batch_number: item.batch_number || (line && line.batch_number) || "",

    expiry_date: item.expiry_date || (line && line.expiry_date) || "",

    serial_number: item.serial_number || (line && line.serial_numbers && line.serial_numbers[0]) || "",

    supplier: item.supplier || "",

    reference_number: item.reference_number || "",

    issue_type: item.issue_type || "",

    issued_to: item.issued_to || "",

    party_name: item.party_name || "",

    return_type: item.return_type || "",

    product_condition: item.product_condition || "",

    return_disposition: item.return_disposition || "",

    adjustment_type: item.adjustment_type || "",

    reason: item.reason || "",

    system_quantity: item.system_quantity !== undefined ? Number(item.system_quantity) : (line ? Number(line.system_quantity) : 0),

    actual_quantity: item.actual_quantity !== undefined ? Number(item.actual_quantity) : (line ? Number(line.actual_quantity) : 0),

    difference_quantity: item.difference_quantity !== undefined ? Number(item.difference_quantity) : (line ? Number(line.difference_quantity) : 0),

    remarks: item.notes || item.remarks || "",

    notes: item.notes || item.remarks || "",

    status: item.status || "POSTED",

  };

}



export async function fetchStockMovements(params = {}) {

  let fetchedList = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/movements/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      const list = data.results || data;

      if (Array.isArray(list)) {

        fetchedList = list;

      }

    }

  } catch (e) {

    updateApiStatus(false);

  }



  const local = getLocalEntities("movements");

  const basePool = [...local, ...fetchedList, ...DEMO_TRANSACTIONS];



  const seen = new Set();

  const merged = [];

  for (const raw of basePool) {

    const norm = normalizeMovement(raw);

    if (!norm) continue;

    const key = (norm.document_number || String(norm.id)).toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push(norm);

    }

  }

  return { results: merged, count: merged.length };

}



export async function postStockTransaction(payload, action = "post") {

  const docNum = payload.document_number || `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const qty = Number(payload.quantity !== undefined ? payload.quantity : (payload.actual_quantity !== undefined ? payload.actual_quantity : 1));

  const txType = payload.type || payload.transaction_type || "RECEIPT";



  let targetStatus = "POSTED";

  if (action === "save_draft") targetStatus = "DRAFT";

  else if (action === "submit") targetStatus = "SUBMITTED";

  else if (action === "dispatch") targetStatus = "DISPATCHED";

  else if (action === "approve") targetStatus = "APPROVED";

  else if (action === "inspect") targetStatus = "INSPECTED";

  else if (action === "receive") targetStatus = "POSTED";

  else if (action === "post") targetStatus = "POSTED";



  let created = null;



  try {

    const res = await fetch(`${API_BASE}/inventory/movements/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        document_number: docNum,

        transaction_type: txType,

        transaction_date: payload.transaction_date || new Date().toISOString().split("T")[0],

        status: action === "save_draft" ? "DRAFT" : "DRAFT",

        warehouse: payload.warehouse_id || (typeof payload.warehouse === "number" ? payload.warehouse : 1),

        destination_warehouse: payload.destination_warehouse_id || (typeof payload.destination_warehouse === "number" ? payload.destination_warehouse : null),

        reference_number: payload.reference_number || "",

        supplier: payload.supplier || "",

        issue_type: payload.issue_type || "",

        issued_to: payload.issued_to || "",

        party_name: payload.party_name || "",

        return_type: payload.return_type || "",

        product_condition: payload.product_condition || "",

        return_disposition: payload.return_disposition || "",

        adjustment_type: payload.adjustment_type || "",

        reason: payload.reason || "",

        notes: payload.remarks || payload.notes || "",

        lines: [

          {

            item: payload.item_id || payload.itemId || payload.product_id || payload.item || 1,

            location: payload.location_id || (typeof payload.location === "number" ? payload.location : null),

            destination_location: payload.destination_location_id || (typeof payload.destination_location === "number" ? payload.destination_location : null),

            quantity: txType === "ADJUSTMENT" ? Math.abs(Number(payload.difference_quantity || qty)) : Math.abs(qty),

            unit_cost: Number(payload.unitCost || payload.unit_cost || 0),

            batch_number: payload.batchNumber || payload.batch_number || "",

            expiry_date: payload.expiryDate || payload.expiry_date || null,

            serial_numbers: payload.serialNumber || payload.serial_number ? [String(payload.serialNumber || payload.serial_number)] : (payload.serial_numbers || []),

            system_quantity: Number(payload.system_quantity || 0),

            actual_quantity: Number(payload.actual_quantity || 0),

            difference_quantity: Number(payload.difference_quantity || 0),

          },

        ],

      }),

    });

    if (res.ok) {

      updateApiStatus(true);

      created = await res.json();

      if (action !== "save_draft" && created && created.id) {

        try {

          const actionEndpoint = action === "post" ? "post" : action;

          const actRes = await fetch(`${API_BASE}/inventory/movements/${created.id}/${actionEndpoint}/`, { method: "POST" });

          if (actRes.ok) {

            created = await actRes.json();

          }

        } catch (e) {}

      }

    }

  } catch (e) {

    updateApiStatus(false);

  }



  const mergedTx = normalizeMovement({

    ...(created || {}),

    id: (created && created.id) || `tx-${Date.now()}`,

    document_number: docNum,

    type: txType,

    transaction_type: txType,

    transaction_date: payload.transaction_date || new Date().toISOString().split("T")[0],

    item: payload.itemName || payload.itemSku || payload.item || "Industrial Ball Bearing 6205-2RS",

    item_code: payload.itemSku || payload.item_code || "BRG-6205-2RS",

    warehouse: payload.warehouse_name || payload.warehouse || "Main Central Fulfillment Hub",

    location: payload.location_name || payload.location || "Aisle 3 - Rack B",

    destination_warehouse: payload.destination_warehouse_name || payload.destination_warehouse || "",

    destination_location: payload.destination_location_name || payload.destination_location || "",

    quantity: txType === "ISSUE" ? -Math.abs(qty) : Math.abs(qty),

    unit: payload.unit || "EA",

    unit_cost: Number(payload.unitCost || payload.unit_cost) || 14.85,

    supplier: payload.supplier || "",

    reference_number: payload.reference_number || "",

    issue_type: payload.issue_type || "",

    issued_to: payload.issued_to || "",

    party_name: payload.party_name || "",

    return_type: payload.return_type || "",

    product_condition: payload.product_condition || "",

    return_disposition: payload.return_disposition || "",

    adjustment_type: payload.adjustment_type || "",

    reason: payload.reason || "",

    system_quantity: Number(payload.system_quantity || 0),

    actual_quantity: Number(payload.actual_quantity || 0),

    difference_quantity: Number(payload.difference_quantity || 0),

    batch_number: payload.batchNumber || payload.batch_number || "",

    expiry_date: payload.expiryDate || payload.expiry_date || "",

    serial_number: payload.serialNumber || payload.serial_number || "",

    remarks: payload.remarks || payload.notes || "",

    notes: payload.remarks || payload.notes || "",

    status: (created && created.status) || targetStatus,

  });



  saveLocalEntity("movements", mergedTx, "document_number");



  // Also update stock level in local product storage if posted

  if (mergedTx.status === "POSTED") {

    const itemCode = mergedTx.item_code || mergedTx.item;

    if (itemCode) {

      const localProducts = getLocalEntities("products");

      let delta = 0;

      if (txType === "RECEIPT") delta = Math.abs(qty);

      else if (txType === "ISSUE") delta = -Math.abs(qty);

      else if (txType === "ADJUSTMENT") delta = Number(payload.difference_quantity || 0);

      else if (txType === "RETURN") delta = payload.return_type === "Supplier Return" ? -Math.abs(qty) : Math.abs(qty);



      const updated = localProducts.map((p) => {

        if (p.sku === itemCode || p.code === itemCode) {

          const nextOnHand = Math.max(0, (p.on_hand || 0) + delta);

          const nextAvail = Math.max(0, (p.available || 0) + delta);

          return {

            ...p,

            on_hand: nextOnHand,

            available: nextAvail,

            stock_status: nextOnHand <= 0 ? "OUT_OF_STOCK" : nextAvail <= (p.reorder_point || 50) ? "LOW_STOCK" : "IN_STOCK",

          };

        }

        return p;

      });

      localStorage.setItem("inv_products", JSON.stringify(updated));

    }

  }



  return mergedTx;

}



export async function updateStockTransactionStatus(id, action = "submit") {

  let updated = null;

  try {

    const res = await fetch(`${API_BASE}/inventory/movements/${id}/${action}/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

    });

    if (res.ok) {

      updateApiStatus(true);

      updated = await res.json();

    }

  } catch (e) {

    updateApiStatus(false);

  }



  const statusMap = {

    submit: "SUBMITTED",

    dispatch: "DISPATCHED",

    receive: "POSTED",

    approve: "APPROVED",

    inspect: "INSPECTED",

    post: "POSTED",

  };

  const nextStatus = (updated && updated.status) || statusMap[action] || "POSTED";



  const local = getLocalEntities("movements");

  const updatedLocal = local.map((m) => {

    if (String(m.id) === String(id) || m.document_number === id) {

      return {

        ...m,

        status: nextStatus,

      };

    }

    return m;

  });

  localStorage.setItem("inv_movements", JSON.stringify(updatedLocal));



  return updated || { id, status: nextStatus };

}



// ---------------------------------------------------------------------------

// Stock Balances API

// ---------------------------------------------------------------------------

export async function fetchStockBalances(params = {}) {

  let fetchedList = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/balances/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = data.results || data;

    }

  } catch (e) {}



  const base = fetchedList.length > 0 ? fetchedList : [

    { id: "bal-1", item_name: "Industrial Ball Bearing 6205-2RS", item_code: "BRG-6205-2RS", product_name: "Industrial Ball Bearing 6205-2RS", sku: "BRG-6205-2RS", warehouse_name: "Main Central Hub", location_name: "LOC-499 - Aisle 3", location_code: "A3-RB", bin_name: "BIN-A3-01", category_name: "Mechanical Components", on_hand_qty: 450, total_stock: 450, reserved_qty: 45, reserved_stock: 45, blocked_qty: 0, damaged_stock: 0, available_qty: 405, available_stock: 405, stock_status: "In Stock", unit: "EA" },

    { id: "bal-2", item_name: "Hydraulic Solenoid Valve 24V DC", item_code: "HYD-SV-24V", product_name: "Hydraulic Solenoid Valve 24V DC", sku: "HYD-SV-24V", warehouse_name: "Main Central Hub", location_name: "LOC-499 - Aisle 1", location_code: "A1-B4", bin_name: "BIN-A1-04", category_name: "Hydraulics & Pneumatics", on_hand_qty: 18, total_stock: 18, reserved_qty: 6, reserved_stock: 6, blocked_qty: 2, damaged_stock: 2, available_qty: 10, available_stock: 10, stock_status: "Low Stock", unit: "EA" },

    { id: "bal-3", item_name: "Polyurethane Timing Belt T10-1200", item_code: "BELT-T10-1200", product_name: "Polyurethane Timing Belt T10-1200", sku: "BELT-T10-1200", warehouse_name: "Main Central Hub", location_name: "LOC-499 - Aisle 2", location_code: "B2-BAY", bin_name: "BIN-B2-02", category_name: "Power Transmission", on_hand_qty: 280, total_stock: 280, reserved_qty: 20, reserved_stock: 20, blocked_qty: 4, damaged_stock: 4, available_qty: 256, available_stock: 256, stock_status: "In Stock", unit: "EA" },

    { id: "bal-4", item_name: "Optical Rotary Encoder 1024 PPR", item_code: "ENC-OPT-1024", product_name: "Optical Rotary Encoder 1024 PPR", sku: "ENC-OPT-1024", warehouse_name: "Main Central Hub", location_name: "LOC-499 - Aisle 1", location_code: "A1-B4", bin_name: "BIN-A1-02", category_name: "Sensors & Automation", on_hand_qty: 0, total_stock: 0, reserved_qty: 0, reserved_stock: 0, blocked_qty: 0, damaged_stock: 0, available_qty: 0, available_stock: 0, stock_status: "Out of Stock", unit: "EA" },

    { id: "bal-5", item_name: "Synthetic Compressor Lubricant ISO VG 46", item_code: "LUB-SYN-VG46", product_name: "Synthetic Compressor Lubricant ISO VG 46", sku: "LUB-SYN-VG46", warehouse_name: "Main Central Hub", location_name: "VAULT-CHEM", location_code: "VAULT-CHEM", bin_name: "BIN-V-01", category_name: "Chemicals & Fluids", on_hand_qty: 1250, total_stock: 1250, reserved_qty: 100, reserved_stock: 100, blocked_qty: 15, damaged_stock: 15, available_qty: 1135, available_stock: 1135, stock_status: "In Stock", unit: "LTR" },

  ];



  const local = getLocalEntities("balances");

  const seen = new Set();

  const merged = [];



  for (const raw of [...local, ...base]) {

    const key = (raw.item_code || raw.sku || raw.item_name || raw.id).toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      const totalStock = Number(raw.total_stock !== undefined ? raw.total_stock : (raw.on_hand_qty || 0));

      const reservedStock = Number(raw.reserved_stock !== undefined ? raw.reserved_stock : (raw.reserved_qty || 0));

      const damagedStock = Number(raw.damaged_stock !== undefined ? raw.damaged_stock : (raw.blocked_qty || 0));

      const availableStock = Number(raw.available_stock !== undefined ? raw.available_stock : (raw.available_qty !== undefined ? raw.available_qty : Math.max(0, totalStock - reservedStock - damagedStock)));

      const status = raw.stock_status || (availableStock <= 0 ? "Out of Stock" : availableStock <= 20 ? "Low Stock" : "In Stock");



      merged.push({

        ...raw,

        product_name: raw.product_name || raw.item_name || raw.item || "Industrial Item",

        sku: raw.sku || raw.item_code || raw.code || "SKU-000",

        warehouse_name: raw.warehouse_name || (typeof raw.warehouse === "string" ? raw.warehouse : "Main Central Hub"),

        location_name: raw.location_name || raw.location_code || (typeof raw.location === "string" ? raw.location : "General Storage"),

        bin_name: raw.bin_name || raw.bin_code || (typeof raw.bin === "string" ? raw.bin : "Default Bin"),

        category_name: raw.category_name || (typeof raw.category === "string" ? raw.category : "Mechanical Components"),

        total_stock: totalStock,

        reserved_stock: reservedStock,

        damaged_stock: damagedStock,

        available_stock: availableStock,

        stock_status: status,

        unit: raw.unit || "EA",

      });

    }

  }



  return { results: merged, count: merged.length };

}



// ---------------------------------------------------------------------------

// Stock Ledger API & In/Out History

// ---------------------------------------------------------------------------

export async function fetchStockLedger(params = {}) {

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/ledger/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}



  const local = getLocalEntities("movements");

  const fallback = [

    { id: "led-100", created_at: "2026-10-01T08:00:00Z", transaction_date: "2026-10-01", transaction_number: "OPN-2026-0001", transaction_ref: "OPN-2026-0001", movement_type: "OPENING", transaction_type: "OPENING", product_name: "Industrial Ball Bearing 6205-2RS", item_code: "BRG-6205-2RS", sku: "BRG-6205-2RS", warehouse_name: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "LOC-499 - Aisle 3", quantity_in: 500.0, quantity_out: 0.0, quantity_delta: 500.0, balance_quantity: 500.0, balance_after: 500.0, unit_cost: 14.85, batch_number: "LOT-2026-BRG-01", reference_number: "FY2026-INIT", actor: "system" },

    { id: "led-101", created_at: "2026-10-26T08:18:46Z", transaction_date: "2026-10-26", transaction_number: "GRN-2026-0001", transaction_ref: "GRN-2026-0001", movement_type: "RECEIPT", transaction_type: "RECEIPT", product_name: "Industrial Ball Bearing 6205-2RS", item_code: "BRG-6205-2RS", sku: "BRG-6205-2RS", warehouse_name: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "LOC-499 - Aisle 3", quantity_in: 36.0, quantity_out: 0.0, quantity_delta: 36.0, balance_quantity: 536.0, balance_after: 536.0, unit_cost: 14.85, batch_number: "BATCH-2026-01", reference_number: "PO-89912", actor: "system" },

    { id: "led-102", created_at: "2026-10-25T14:22:10Z", transaction_date: "2026-10-25", transaction_number: "ISS-2026-0001", transaction_ref: "ISS-2026-0001", movement_type: "ISSUE", transaction_type: "ISSUE", product_name: "Hydraulic Solenoid Valve 24V DC", item_code: "HYD-SV-24V", sku: "HYD-SV-24V", warehouse_name: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "LOC-499 - Aisle 1", quantity_in: 0.0, quantity_out: 2.0, quantity_delta: -2.0, balance_quantity: 248.0, balance_after: 248.0, unit_cost: 128.50, batch_number: "LOT-2026-11", reference_number: "SO-77412", actor: "dispatch_lead" },

    { id: "led-103", created_at: "2026-10-24T11:05:32Z", transaction_date: "2026-10-24", transaction_number: "GRN-2026-0004", transaction_ref: "GRN-2026-0004", movement_type: "RECEIPT", transaction_type: "RECEIPT", product_name: "Polyurethane Timing Belt T10-1200", item_code: "BELT-T10-1200", sku: "BELT-T10-1200", warehouse_name: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "LOC-499 - Aisle 2", quantity_in: 50.0, quantity_out: 0.0, quantity_delta: 50.0, balance_quantity: 280.0, balance_after: 280.0, unit_cost: 32.40, batch_number: "LOT-2026-09", reference_number: "PO-89850", actor: "receiving_clerk" },

    { id: "led-104", created_at: "2026-10-23T16:40:18Z", transaction_date: "2026-10-23", transaction_number: "ADJ-2026-0001", transaction_ref: "ADJ-2026-0001", movement_type: "ADJUSTMENT", transaction_type: "ADJUSTMENT", product_name: "Synthetic Compressor Lubricant ISO VG 46", item_code: "LUB-SYN-VG46", sku: "LUB-SYN-VG46", warehouse_name: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "VAULT-CHEM", quantity_in: 0.0, quantity_out: 12.0, quantity_delta: -12.0, balance_quantity: 1238.0, balance_after: 1238.0, unit_cost: 18.20, batch_number: "LOT-2025-LUB-12", reference_number: "ADJ-COUNT-401", actor: "qa_inspector" },

    { id: "led-105", created_at: "2026-10-28T10:00:00Z", transaction_date: "2026-10-28", transaction_number: "TRF-2026-0001", transaction_ref: "TRF-2026-0001", movement_type: "TRANSFER", transaction_type: "TRANSFER", product_name: "Polyurethane Timing Belt T10-1200", item_code: "BELT-T10-1200", sku: "BELT-T10-1200", warehouse_name: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "LOC-499 - Aisle 2", quantity_in: 0.0, quantity_out: 25.0, quantity_delta: -25.0, balance_quantity: 255.0, balance_after: 255.0, unit_cost: 32.40, batch_number: "LOT-2026-09", reference_number: "TRF-2026-0001", actor: "dispatch_lead" },

    { id: "led-106", created_at: "2026-10-29T11:20:00Z", transaction_date: "2026-10-29", transaction_number: "TRF-LOC-2026-0001", transaction_ref: "TRF-LOC-2026-0001", movement_type: "TRANSFER", transaction_type: "TRANSFER", product_name: "Industrial Ball Bearing 6205-2RS", item_code: "BRG-6205-2RS", sku: "BRG-6205-2RS", warehouse_name: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "VAULT-CHEM", quantity_in: 15.0, quantity_out: 0.0, quantity_delta: 15.0, balance_quantity: 15.0, balance_after: 15.0, unit_cost: 14.85, batch_number: "LOT-2026-BRG-01", reference_number: "TRF-LOC-2026-0001", actor: "system" },

    { id: "led-107", created_at: "2026-10-30T09:45:00Z", transaction_date: "2026-10-30", transaction_number: "ISS-2026-0002", transaction_ref: "ISS-2026-0002", movement_type: "ISSUE", transaction_type: "ISSUE", product_name: "Industrial Ball Bearing 6205-2RS", item_code: "BRG-6205-2RS", sku: "BRG-6205-2RS", warehouse_name: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "LOC-499 - Aisle 3", quantity_in: 0.0, quantity_out: 40.0, quantity_delta: -40.0, balance_quantity: 496.0, balance_after: 496.0, unit_cost: 14.85, batch_number: "LOT-2026-BRG-01", reference_number: "SO-2026-8812", actor: "dispatch_lead" },

    { id: "led-108", created_at: "2026-10-22T09:30:00Z", transaction_date: "2026-10-22", transaction_number: "RET-2026-0001", transaction_ref: "RET-2026-0001", movement_type: "RETURN", transaction_type: "RETURN", product_name: "Industrial Ball Bearing 6205-2RS", item_code: "BRG-6205-2RS", sku: "BRG-6205-2RS", warehouse_name: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "LOC-499 - Aisle 3", quantity_in: 8.0, quantity_out: 0.0, quantity_delta: 8.0, balance_quantity: 504.0, balance_after: 504.0, unit_cost: 14.85, batch_number: "LOT-2026-BRG-01", reference_number: "RMA-2026-4421", actor: "qa_inspector" },

  ];



  let filtered = [...fallback];

  if (params.direction === "in") {

    filtered = filtered.filter((e) => (Number(e.quantity_delta) || Number(e.quantity_in)) > 0);

  } else if (params.direction === "out") {

    filtered = filtered.filter((e) => (Number(e.quantity_delta) || 0) < 0 || Number(e.quantity_out) > 0);

  }



  return { results: filtered, count: filtered.length };

}



export async function fetchStockInHistory(params = {}) {

  return fetchStockLedger({ ...params, direction: "in" });

}



export async function fetchStockOutHistory(params = {}) {

  return fetchStockLedger({ ...params, direction: "out" });

}



// ---------------------------------------------------------------------------

// Stock Reservations API with Live Persistence

// ---------------------------------------------------------------------------

export async function fetchReservations(params = {}) {

  let fetchedList = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/reservations/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = data.results || data;

    }

  } catch (e) {}



  const base = fetchedList.length > 0 ? fetchedList : [

    { id: "res-001", reservation_number: "RES-2026-8812", reservation_date: "2026-10-28", reservation_type: "Sales", reference_number: "SO-2026-8812", reference_doc: "SO-2026-8812", product_name: "Industrial Ball Bearing 6205-2RS", item: "Industrial Ball Bearing 6205-2RS", item_code: "BRG-6205-2RS", sku: "BRG-6205-2RS", warehouse_name: "Main Central Fulfillment Hub", warehouse: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "LOC-499 - Aisle 3", available_quantity: 405, quantity: 45, reservation_quantity: 45, released_quantity: 0, remaining_quantity: 45, priority: "HIGH", reserved_by: "Alex Morgan", required_date: "2026-11-08", batch_number: "LOT-2026-BRG-01", remarks: "Hold for Assembly Line 1", status: "RESERVED" },

    { id: "res-002", reservation_number: "RES-2026-8815", reservation_date: "2026-10-29", reservation_type: "Production", reference_number: "WO-2026-4412", reference_doc: "WO-2026-4412", product_name: "Hydraulic Solenoid Valve 24V DC", item: "Hydraulic Solenoid Valve 24V DC", item_code: "HYD-SV-24V", sku: "HYD-SV-24V", warehouse_name: "Main Central Fulfillment Hub", warehouse: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "LOC-499 - Aisle 1", available_quantity: 12, quantity: 6, reservation_quantity: 6, released_quantity: 0, remaining_quantity: 6, priority: "MEDIUM", reserved_by: "Marcus Vance", required_date: "2026-11-05", batch_number: "", remarks: "Hydraulic lift maintenance", status: "RESERVED" },

    { id: "res-003", reservation_number: "RES-2026-3041", reservation_date: "2026-10-20", reservation_type: "Internal Use", reference_number: "WO-2026-3041", reference_doc: "WO-2026-3041", product_name: "Polyurethane Timing Belt T10-1200", item: "Polyurethane Timing Belt T10-1200", item_code: "BELT-T10-1200", sku: "BELT-T10-1200", warehouse_name: "Main Central Fulfillment Hub", warehouse: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "LOC-499 - Aisle 2", available_quantity: 260, quantity: 20, reservation_quantity: 20, released_quantity: 20, remaining_quantity: 0, priority: "LOW", reserved_by: "Conveyor Lead", required_date: "2026-10-30", batch_number: "", remarks: "Factory conveyor overhaul", status: "FULFILLED" },

    { id: "res-004", reservation_number: "RES-2026-8799", reservation_date: "2026-10-25", reservation_type: "Sales", reference_number: "SO-2026-8799", reference_doc: "SO-2026-8799", product_name: "Synthetic Compressor Lubricant ISO VG 46", item: "Synthetic Compressor Lubricant ISO VG 46", item_code: "LUB-SYN-VG46", sku: "LUB-SYN-VG46", warehouse_name: "Main Central Fulfillment Hub", warehouse: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "VAULT-CHEM", available_quantity: 1150, quantity: 100, reservation_quantity: 100, released_quantity: 100, remaining_quantity: 0, priority: "HIGH", reserved_by: "Sarah Jenkins", required_date: "2026-11-12", batch_number: "LOT-2026-LUB-88", remarks: "Customer reserve", status: "RELEASED" },

    { id: "res-005", reservation_number: "RES-2026-0001", reservation_date: "2026-11-01", reservation_type: "Sales", reference_number: "SO-2026-9001", reference_doc: "SO-2026-9001", product_name: "Industrial Ball Bearing 6205-2RS", item: "Industrial Ball Bearing 6205-2RS", item_code: "BRG-6205-2RS", sku: "BRG-6205-2RS", warehouse_name: "Main Central Fulfillment Hub", warehouse: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "LOC-499 - Aisle 3", available_quantity: 405, quantity: 40, reservation_quantity: 40, released_quantity: 40, remaining_quantity: 0, priority: "URGENT", reserved_by: "Elena Rostova", required_date: "2026-11-04", batch_number: "LOT-2026-BRG-01", remarks: "Full release for client dispatch", status: "RELEASED" },

    { id: "res-006", reservation_number: "RES-2026-0002", reservation_date: "2026-11-02", reservation_type: "Production", reference_number: "WO-2026-9002", reference_doc: "WO-2026-9002", product_name: "Industrial Ball Bearing 6205-2RS", item: "Industrial Ball Bearing 6205-2RS", item_code: "BRG-6205-2RS", sku: "BRG-6205-2RS", warehouse_name: "Main Central Fulfillment Hub", warehouse: "Main Central Fulfillment Hub", warehouse_code: "WH-MAIN", location_name: "LOC-499 - Aisle 3", available_quantity: 405, quantity: 60, reservation_quantity: 60, released_quantity: 20, remaining_quantity: 40, priority: "HIGH", reserved_by: "David Kim", required_date: "2026-11-10", batch_number: "LOT-2026-BRG-01", remarks: "Partially released 20 units for line test; 40 units remaining", status: "PARTIALLY_RELEASED" },

  ];



  const local = getLocalEntities("reservations");

  const seen = new Set();

  const merged = [];



  for (const item of [...local, ...base]) {

    const key = (item.reservation_number || item.reference_doc || item.id).toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push({

        ...item,

        status: item.status === "PENDING" ? "RESERVED" : item.status,

      });

    }

  }



  return { results: merged, count: merged.length };

}



export const fetchStockReservations = fetchReservations;



export async function createReservation(payload) {

  const resNum = payload.reservation_number || `RES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const qty = Number(payload.reservation_quantity || payload.quantity || 10);

  let created = null;



  try {

    const res = await fetch(`${API_BASE}/inventory/reservations/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        reservation_number: resNum,

        reservation_date: payload.reservation_date || new Date().toISOString().split("T")[0],

        reservation_type: payload.reservation_type || "Sales",

        reference_number: payload.reference_number || "",

        reference_doc: payload.reference_number || resNum,

        item: payload.item_id || payload.item || 1,

        warehouse: payload.warehouse_id || payload.warehouse || 1,

        location: payload.location_id || payload.location || null,

        quantity: qty,

        required_date: payload.required_date || null,

        batch_number: payload.batch_number || "",

        remarks: payload.remarks || "",

        status: "RESERVED",

      }),

    });

    if (res.ok) {

      updateApiStatus(true);

      created = await res.json();

    }

  } catch (e) {}



  if (!created) {

    created = {

      id: `res-${Date.now()}`,

      reservation_number: resNum,

      reservation_date: payload.reservation_date || new Date().toISOString().split("T")[0],

      reservation_type: payload.reservation_type || "Sales",

      reference_number: payload.reference_number || "",

      reference_doc: payload.reference_number || resNum,

      product_name: payload.product_name || payload.item_name || "Industrial Ball Bearing 6205-2RS",

      item: payload.product_name || payload.item_name || "Industrial Ball Bearing 6205-2RS",

      item_code: payload.sku || payload.item_sku || payload.item_code || "BRG-6205-2RS",

      sku: payload.sku || payload.item_sku || payload.item_code || "BRG-6205-2RS",

      warehouse_name: payload.warehouse_name || "Main Central Hub",

      warehouse: payload.warehouse_name || "Main Central Hub",

      location_name: payload.location_name || "LOC-499 - Aisle 3",

      available_quantity: Number(payload.available_quantity || 100),

      quantity: qty,

      reservation_quantity: qty,

      required_date: payload.required_date || "",

      batch_number: payload.batch_number || "",

      remarks: payload.remarks || "",

      status: "RESERVED",

    };

  }



  saveLocalEntity("reservations", created, "reservation_number");

  return created;

}



export const createStockReservation = createReservation;



export async function fulfillReservation(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/reservations/${id}/fulfill/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}



  updateLocalEntity("reservations", id, { status: "FULFILLED" });

  return { id, status: "FULFILLED" };

}



export const fulfillStockReservation = fulfillReservation;



export async function releaseReservation(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/reservations/${id}/release/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}



  updateLocalEntity("reservations", id, { status: "RELEASED" });

  return { id, status: "RELEASED" };

}



export const releaseStockReservation = releaseReservation;



// ---------------------------------------------------------------------------

// Reconciliation / Stock Count API with Live Persistence

// ---------------------------------------------------------------------------

export async function fetchReconciliations(params = {}) {

  let fetchedList = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/reconciliation/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = data.results || data;

    }

  } catch (e) {}



  const base = fetchedList.length > 0 ? fetchedList : [

    {

      id: "cnt-1",

      reconciliation_number: "REC-2026-0001",

      count_number: "REC-2026-0001",

      reconciliation_date: "2026-10-25",

      warehouse_name: "Main Central Hub",

      warehouse_code: "WH-MAIN",

      location_name: "LOC-499 - Aisle 3",

      product_name: "Industrial Ball Bearing 6205-2RS",

      sku: "BRG-6205-2RS",

      system_quantity: 450,

      physical_quantity: 448,

      difference_quantity: -2,

      reason: "Physical Count Difference",

      remarks: "Variance during quarterly shelf audit",

      status: "APPROVED",

      adjustment_document_number: "ADJ-2026-7278",

    },

    {

      id: "cnt-2",

      reconciliation_number: "REC-2026-0002",

      count_number: "REC-2026-0002",

      reconciliation_date: "2026-10-28",

      warehouse_name: "East Coast Terminal",

      warehouse_code: "WH-EAST",

      location_name: "LOC-499 - Aisle 1",

      product_name: "Hydraulic Solenoid Valve 24V DC",

      sku: "HYD-SV-24V",

      system_quantity: 15,

      physical_quantity: 18,

      difference_quantity: 3,

      reason: "Found Stock",

      remarks: "Unpacked pallet discovered in receiving buffer",

      status: "DRAFT",

      adjustment_document_number: "",

    },

  ];



  const local = getLocalEntities("reconciliation");

  const seen = new Set();

  const merged = [];



  for (const item of [...local, ...base]) {

    const key = (item.reconciliation_number || item.count_number || item.id).toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push(item);

    }

  }



  return { results: merged, count: merged.length };

}



export const fetchReconciliationCounts = fetchReconciliations;



export async function createReconciliation(payload) {

  const recNum = payload.reconciliation_number || `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const sysQty = Number(payload.system_quantity || 0);

  const phyQty = Number(payload.physical_quantity || 0);

  const diffQty = phyQty - sysQty;

  let created = null;



  try {

    const res = await fetch(`${API_BASE}/inventory/reconciliation/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        reconciliation_number: recNum,

        count_number: recNum,

        reconciliation_date: payload.reconciliation_date || new Date().toISOString().split("T")[0],

        warehouse: payload.warehouse_id || payload.warehouse || 1,

        location: payload.location_id || payload.location || null,

        item: payload.item_id || payload.item || 1,

        system_quantity: sysQty,

        physical_quantity: phyQty,

        difference_quantity: diffQty,

        reason: payload.reason || "Physical Count Difference",

        remarks: payload.remarks || "",

        status: payload.status || "DRAFT",

      }),

    });

    if (res.ok) {

      updateApiStatus(true);

      created = await res.json();

    }

  } catch (e) {}



  if (!created) {

    created = {

      id: `cnt-${Date.now()}`,

      reconciliation_number: recNum,

      count_number: recNum,

      reconciliation_date: payload.reconciliation_date || new Date().toISOString().split("T")[0],

      warehouse_name: payload.warehouse_name || "Main Central Hub",

      warehouse_code: payload.warehouse_code || "WH-MAIN",

      location_name: payload.location_name || "",

      product_name: payload.product_name || "Industrial Component",

      sku: payload.sku || "SKU-001",

      system_quantity: sysQty,

      physical_quantity: phyQty,

      difference_quantity: diffQty,

      reason: payload.reason || "Physical Count Difference",

      remarks: payload.remarks || "",

      status: payload.status || "DRAFT",

      adjustment_document_number: "",

    };

  }



  saveLocalEntity("reconciliation", created, "reconciliation_number");

  return created;

}



// export const createStockCount = createReconciliation; // Superseded by Phase 7 createStockCount



export async function submitReconciliation(countId) {

  try {

    const res = await fetch(`${API_BASE}/inventory/reconciliation/${countId}/submit/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}



  updateLocalEntity("reconciliation", countId, { status: "SUBMITTED" });

  return { id: countId, status: "SUBMITTED" };

}



export async function approveReconciliation(countId) {

  try {

    const res = await fetch(`${API_BASE}/inventory/reconciliation/${countId}/approve/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}



  updateLocalEntity("reconciliation", countId, { status: "APPROVED" });

  return { id: countId, status: "APPROVED" };

}



export async function generateReconciliationAdjustment(countId) {

  try {

    const res = await fetch(`${API_BASE}/inventory/reconciliation/${countId}/generate_adjustment/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}



  const adjDoc = `ADJ-REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  updateLocalEntity("reconciliation", countId, { status: "ADJUSTED", adjustment_document_number: adjDoc });

  return { id: countId, status: "ADJUSTED", adjustment_document_number: adjDoc };

}



export const reconcileStockCount = generateReconciliationAdjustment;



// ---------------------------------------------------------------------------

// Damaged Stock API with Live Persistence

// ---------------------------------------------------------------------------

export async function fetchDamagedStock(params = {}) {

  let fetchedList = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/damaged-stock/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = data.results || data;

    }

  } catch (e) {}



  const base = fetchedList.length > 0 ? fetchedList : [

    {

      id: "dmg-1",

      product_name: "Hydraulic Solenoid Valve 24V DC",

      sku: "HYD-SV-24V",

      warehouse_name: "Main Central Hub",

      warehouse_code: "WH-MAIN",

      location_name: "LOC-499 - Aisle 1",

      batch_number: "LOT-2025-DEC-09",

      damaged_qty: 2,

      damage_reason: "Crushed housing in forklift impact",

      damage_date: "2026-10-27",

      status: "QUARANTINED",

      remarks: "Moved to isolation rack pending scrap clearance",

    },

    {

      id: "dmg-2",

      product_name: "Synthetic Compressor Lubricant ISO VG 46",

      sku: "LUB-SYN-VG46",

      warehouse_name: "Main Central Hub",

      warehouse_code: "WH-MAIN",

      location_name: "VAULT-CHEM",

      batch_number: "LOT-2025-NOV-01",

      damaged_qty: 15,

      damage_reason: "Punctured drum barrel leakage",

      damage_date: "2026-10-24",

      status: "WRITTEN_OFF",

      remarks: "Incident report filed with health & safety",

    },

    {

      id: "dmg-3",

      product_name: "Polyurethane Timing Belt T10-1200",

      sku: "BELT-T10-1200",

      warehouse_name: "East Coast Terminal",

      warehouse_code: "WH-EAST",

      location_name: "LOC-499 - Aisle 2",

      batch_number: "",

      damaged_qty: 4,

      damage_reason: "Torn teeth during conveyor test run",

      damage_date: "2026-10-29",

      status: "PENDING",

      remarks: "Awaiting supervisor inspection",

    },

  ];



  const local = getLocalEntities("damaged_stock");

  const seen = new Set();

  const merged = [];



  for (const item of [...local, ...base]) {

    const key = String(item.id).toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push(item);

    }

  }



  return { results: merged, count: merged.length };

}



export async function createDamagedStock(payload) {

  let created = null;

  try {

    const res = await fetch(`${API_BASE}/inventory/damaged-stock/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        item: payload.item_id || payload.item || 1,

        warehouse: payload.warehouse_id || payload.warehouse || 1,

        location: payload.location_id || payload.location || null,

        batch_number: payload.batch_number || "",

        damaged_qty: Number(payload.damaged_qty || 1),

        damage_reason: payload.damage_reason || "",

        damage_date: payload.damage_date || new Date().toISOString().split("T")[0],

        status: payload.status || "PENDING",

        remarks: payload.remarks || "",

      }),

    });

    if (res.ok) {

      updateApiStatus(true);

      created = await res.json();

    }

  } catch (e) {}



  if (!created) {

    created = {

      id: `dmg-${Date.now()}`,

      product_name: payload.product_name || "Industrial Component",

      sku: payload.sku || "SKU-001",

      warehouse_name: payload.warehouse_name || "Main Central Hub",

      warehouse_code: payload.warehouse_code || "WH-MAIN",

      location_name: payload.location_name || "",

      batch_number: payload.batch_number || "",

      damaged_qty: Number(payload.damaged_qty || 1),

      damage_reason: payload.damage_reason || "Handling damage",

      damage_date: payload.damage_date || new Date().toISOString().split("T")[0],

      status: payload.status || "PENDING",

      remarks: payload.remarks || "",

    };

  }



  saveLocalEntity("damaged_stock", created, "id");

  return created;

}



export async function quarantineDamagedStock(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/damaged-stock/${id}/quarantine/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}



  updateLocalEntity("damaged_stock", id, { status: "QUARANTINED" });

  return { id, status: "QUARANTINED" };

}



export async function approveWriteOffDamagedStock(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/damaged-stock/${id}/approve_write_off/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}



  updateLocalEntity("damaged_stock", id, { status: "WRITTEN_OFF" });

  return { id, status: "WRITTEN_OFF" };

}



export async function disposeDamagedStock(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/damaged-stock/${id}/dispose/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}



  updateLocalEntity("damaged_stock", id, { status: "DISPOSED" });

  return { id, status: "DISPOSED" };

}



// ---------------------------------------------------------------------------

// Stock In Transit API

// ---------------------------------------------------------------------------

export async function fetchStockInTransit(params = {}) {

  let fetchedList = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/transit/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = data.results || data;

    }

  } catch (e) {}



  const base = fetchedList.length > 0 ? fetchedList : [

    {

      id: "trf-101",

      transfer_number: "TRF-2026-4410",

      document_number: "TRF-2026-4410",

      transfer_date: "2026-10-30",

      source_warehouse: "Main Central Hub",

      source_warehouse_code: "WH-MAIN",

      destination_warehouse: "East Coast Terminal",

      destination_warehouse_name: "East Coast Terminal",

      destination_warehouse_code: "WH-EAST",

      product: "Optical Rotary Encoder 1024 PPR",

      product_name: "Optical Rotary Encoder 1024 PPR",

      sku: "ENC-OPT-1024",

      dispatched_quantity: 40,

      received_quantity: 0,

      pending_quantity: 40,

      status: "In Transit",

      transit_status: "In Transit",

    },

    {

      id: "trf-102",

      transfer_number: "TRF-2026-4415",

      document_number: "TRF-2026-4415",

      transfer_date: "2026-10-28",

      source_warehouse: "Main Central Hub",

      source_warehouse_code: "WH-MAIN",

      destination_warehouse: "Cold Storage Facility",

      destination_warehouse_name: "Cold Storage Facility",

      destination_warehouse_code: "WH-COLD",

      product: "Synthetic Compressor Lubricant ISO VG 46",

      product_name: "Synthetic Compressor Lubricant ISO VG 46",

      sku: "LUB-SYN-VG46",

      dispatched_quantity: 120,

      received_quantity: 60,

      pending_quantity: 60,

      status: "Partially Received",

      transit_status: "Partially Received",

    },

    {

      id: "trf-103",

      transfer_number: "TRF-2026-4390",

      document_number: "TRF-2026-4390",

      transfer_date: "2026-10-25",

      source_warehouse: "East Coast Terminal",

      source_warehouse_code: "WH-EAST",

      destination_warehouse: "Main Central Hub",

      destination_warehouse_name: "Main Central Hub",

      destination_warehouse_code: "WH-MAIN",

      product: "Industrial Ball Bearing 6205-2RS",

      product_name: "Industrial Ball Bearing 6205-2RS",

      sku: "BRG-6205-2RS",

      dispatched_quantity: 100,

      received_quantity: 100,

      pending_quantity: 0,

      status: "Received",

      transit_status: "Received",

    },

  ];



  return { results: base, count: base.length };

}



// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

// Batch Tracking & Lifecycle API with Live Persistence

// ---------------------------------------------------------------------------

export async function fetchBatches(params = {}) {

  let fetchedList = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/batches/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = (data.results || data).map((b) => {

        const remainingDays = b.days_remaining !== undefined ? b.days_remaining : (b.days_to_expiry !== undefined ? b.days_to_expiry : 365);

        let expStatus = b.expiry_status;

        if (!expStatus) {

          if (!b.expiry_date) expStatus = "Healthy";

          else if (remainingDays <= 0) expStatus = "Expired";

          else if (remainingDays <= 30) expStatus = "Expiring Soon";

          else expStatus = "Healthy";

        }

        return {

          ...b,

          sku: b.sku || b.item_code || "SKU-000",

          product: b.product_name || b.item_name || "Industrial Component",

          product_name: b.product_name || b.item_name || "Industrial Component",

          initial_quantity: Number(b.initial_quantity || b.quantity || 100),

          remaining_quantity: Number(b.remaining_quantity !== undefined ? b.remaining_quantity : (b.quantity || 100)),

          quarantined_quantity: Number(b.quarantined_quantity || 0),

          batch_status: b.batch_status || (b.status === "QUARANTINED" ? "Quarantined" : (b.status === "HEALTHY" ? "Released" : b.status || "Released")),

          days_to_expiry: remainingDays,

          expiry_status: expStatus,

        };

      });

    }

  } catch (e) {}



  const base = fetchedList.length > 0 ? fetchedList : [

    {

      id: "bt-1",

      batch_number: "LOT-2026-BRG-01",

      item: 1,

      item_code: "BRG-6205-2RS",

      sku: "BRG-6205-2RS",

      item_name: "Industrial Ball Bearing 6205-2RS",

      product: "Industrial Ball Bearing 6205-2RS",

      product_name: "Industrial Ball Bearing 6205-2RS",

      warehouse: "Main Central Fulfillment Hub",

      warehouse_name: "Main Central Fulfillment Hub",

      location: "LOC-STO-A1 - Aisle 1",

      location_name: "LOC-STO-A1 - Aisle 1",

      initial_quantity: 450,

      remaining_quantity: 450,

      quarantined_quantity: 0,

      manufacturing_date: "2026-04-10",

      received_date: "2026-04-15",

      expiry_date: "2029-04-10",

      batch_status: "Released",

      status: "Released",

      days_to_expiry: 888,

      expiry_status: "Healthy",

      supplier: "Apex Precision Components",

    },

    {

      id: "bt-2",

      batch_number: "LOT-2026-LUB-88",

      item: 5,

      item_code: "LUB-SYN-VG46",

      sku: "LUB-SYN-VG46",

      item_name: "Synthetic Compressor Lubricant ISO VG 46",

      product: "Synthetic Compressor Lubricant ISO VG 46",

      product_name: "Synthetic Compressor Lubricant ISO VG 46",

      warehouse: "Main Central Fulfillment Hub",

      warehouse_name: "Main Central Fulfillment Hub",

      location: "LOC-STO-A1 - Aisle 1",

      location_name: "LOC-STO-A1 - Aisle 1",

      initial_quantity: 1200,

      remaining_quantity: 1200,

      quarantined_quantity: 0,

      manufacturing_date: "2026-06-15",

      received_date: "2026-06-20",

      expiry_date: "2027-06-15",

      batch_status: "Released",

      status: "Released",

      days_to_expiry: 224,

      expiry_status: "Healthy",

      supplier: "PetroSynth Chemical Corp",

    },

    {

      id: "bt-3",

      batch_number: "LOT-2025-LUB-12",

      item: 5,

      item_code: "LUB-SYN-VG46",

      sku: "LUB-SYN-VG46",

      item_name: "Synthetic Compressor Lubricant ISO VG 46",

      product: "Synthetic Compressor Lubricant ISO VG 46",

      product_name: "Synthetic Compressor Lubricant ISO VG 46",

      warehouse: "Main Central Fulfillment Hub",

      warehouse_name: "Main Central Fulfillment Hub",

      location: "LOC-STO-A1 - Aisle 1",

      location_name: "LOC-STO-A1 - Aisle 1",

      initial_quantity: 500,

      remaining_quantity: 450,

      quarantined_quantity: 0,

      manufacturing_date: "2025-11-20",

      received_date: "2025-11-25",

      expiry_date: "2026-11-20",

      batch_status: "Released",

      status: "Released",

      days_to_expiry: 17,

      expiry_status: "Expiring Soon",

      supplier: "PetroSynth Chemical Corp",

    },

    {

      id: "bt-4",

      batch_number: "LOT-2024-VALVE-09",

      item: 2,

      item_code: "HYD-SV-24V",

      sku: "HYD-SV-24V",

      item_name: "Hydraulic Solenoid Valve 24V DC",

      product: "Hydraulic Solenoid Valve 24V DC",

      product_name: "Hydraulic Solenoid Valve 24V DC",

      warehouse: "Main Central Fulfillment Hub",

      warehouse_name: "Main Central Fulfillment Hub",

      location: "LOC-QAR-01 - Quarantine Vault 1",

      location_name: "LOC-QAR-01 - Quarantine Vault 1",

      initial_quantity: 25,

      remaining_quantity: 25,

      quarantined_quantity: 25,

      manufacturing_date: "2024-08-10",

      received_date: "2024-08-15",

      expiry_date: "2026-08-10",

      batch_status: "Quarantined",

      status: "Quarantined",

      days_to_expiry: -85,

      expiry_status: "Expired",

      supplier: "HydroMotion Dynamics",

    },

  ];



  const local = getLocalEntities("batches");

  const seen = new Set();

  const merged = [];



  for (const item of [...local, ...base]) {

    const key = (item.batch_number || item.id).toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push(item);

    }

  }



  return { results: merged, count: merged.length };

}



export async function createBatch(payload) {

  const initQty = Number(payload.initial_quantity || payload.quantity || 100);

  let created = null;



  try {

    const res = await fetch(`${API_BASE}/inventory/batches/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        batch_number: payload.batch_number,

        item: payload.item_id || payload.item || 1,

        warehouse: payload.warehouse_id || payload.warehouse || 1,

        location: payload.location_id || payload.location || null,

        supplier: payload.supplier || "",

        manufacturing_date: payload.manufacturing_date || payload.manufacture_date || null,

        expiry_date: payload.expiry_date || null,

        received_date: payload.received_date || new Date().toISOString().split("T")[0],

        initial_quantity: initQty,

        remaining_quantity: initQty,

        batch_status: payload.batch_status || "Pending Inspection",

        status: payload.batch_status === "Quarantined" ? "QUARANTINED" : "HEALTHY",

      }),

    });

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      created = {

        ...data,

        sku: data.sku || data.item_code,

        product_name: data.product_name || data.item_name,

      };

    }

  } catch (e) {}



  if (!created) {

    created = {

      id: `bt-${Date.now()}`,

      batch_number: payload.batch_number,

      sku: payload.sku || payload.item_code || "BRG-6205-2RS",

      item_code: payload.sku || payload.item_code || "BRG-6205-2RS",

      product: payload.product_name || payload.item_name || "Industrial Ball Bearing 6205-2RS",

      product_name: payload.product_name || payload.item_name || "Industrial Ball Bearing 6205-2RS",

      warehouse: payload.warehouse || "Main Central Fulfillment Hub",

      warehouse_name: payload.warehouse || "Main Central Fulfillment Hub",

      location: payload.storage_location || payload.location || "Aisle 1 High Rack Storage",

      location_name: payload.storage_location || payload.location || "Aisle 1 High Rack Storage",

      initial_quantity: initQty,

      remaining_quantity: initQty,

      quarantined_quantity: 0,

      supplier: payload.supplier || "Standard Supplier",

      manufacturing_date: payload.manufacturing_date || new Date().toISOString().split("T")[0],

      received_date: payload.received_date || new Date().toISOString().split("T")[0],

      expiry_date: payload.expiry_date || "2028-12-31",

      batch_status: payload.batch_status || "Pending Inspection",

      status: payload.batch_status || "Pending Inspection",

      days_to_expiry: 365,

      expiry_status: "Healthy",

    };

  }



  saveLocalEntity("batches", created, "batch_number");

  return created;

}



export async function quarantineBatch(batchId, payload) {

  let result = null;

  const qty = Number(payload.quarantine_quantity || 1);

  try {

    const res = await fetch(`${API_BASE}/inventory/batches/${batchId}/quarantine/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) {

      updateApiStatus(true);

      result = await res.json();

    }

  } catch (e) {}



  const localRecord = {

    id: `qar-${Date.now()}`,

    quarantine_number: `QAR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,

    batch_number: payload.batch_number || `LOT-${batchId}`,

    product_name: payload.product_name || "Industrial Component",

    sku: payload.sku || "SKU-000",

    warehouse: payload.warehouse || "Main Central Hub",

    location: payload.storage_location || payload.location || "Quarantine Vault",

    quarantine_quantity: qty,

    quarantine_reason: payload.quarantine_reason || "Quality Issue",

    remarks: payload.remarks || "",

    quarantine_date: payload.quarantine_date || new Date().toISOString().split("T")[0],

    is_released: false,

    status: "Quarantined",

  };

  saveLocalEntity("batch_quarantines", localRecord, "quarantine_number");



  updateLocalEntity("batches", batchId, {

    batch_status: "Quarantined",

    status: "Quarantined",

    quarantined_quantity: qty,

  });



  return result || localRecord;

}



export async function releaseBatch(batchId, payload) {

  let result = null;

  const releaseQty = Number(payload.release_quantity || 1);

  try {

    const res = await fetch(`${API_BASE}/inventory/batches/${batchId}/release/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) {

      updateApiStatus(true);

      result = await res.json();

    }

  } catch (e) {}



  const releaseRecord = {

    id: `rel-${Date.now()}`,

    batch_number: payload.batch_number || `LOT-${batchId}`,

    product_name: payload.product_name || "Industrial Component",

    release_quantity: releaseQty,

    inspection_result: payload.inspection_result || "Passed",

    release_reason: payload.release_reason || "Passed authorized QA re-inspection",

    released_by: payload.released_by || "QA Lead Inspector",

    release_date: payload.release_date || new Date().toISOString().split("T")[0],

  };

  saveLocalEntity("batch_releases", releaseRecord, "id");



  if (payload.inspection_result === "Passed" || payload.inspection_result === "Partially Passed") {

    updateLocalEntity("batches", batchId, {

      batch_status: "Released",

      status: "Released",

      quarantined_quantity: 0,

    });

  }



  return result || releaseRecord;

}



export async function fetchBatchQuarantines(params = {}) {

  let fetchedList = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/batch-quarantines/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = data.results || data;

    }

  } catch (e) {}



  const base = fetchedList.length > 0 ? fetchedList : [

    {

      id: "qar-101",

      quarantine_number: "QAR-2026-1001",

      batch_number: "LOT-2024-VALVE-09",

      product_name: "Hydraulic Solenoid Valve 24V DC",

      sku: "HYD-SV-24V",

      warehouse_name: "Main Central Fulfillment Hub",

      warehouse: "Main Central Fulfillment Hub",

      location_name: "LOC-QAR-01 - Quarantine Vault 1",

      location: "LOC-QAR-01 - Quarantine Vault 1",

      quarantine_quantity: 25,

      quarantine_reason: "Expiry Concern",

      remarks: "Batch passed shelf life threshold; isolated from active dispatch",

      quarantine_date: "2026-10-15",

      is_released: false,

      status: "Quarantined",

    },

    {

      id: "qar-102",

      quarantine_number: "QAR-2026-0988",

      batch_number: "LOT-2026-BRG-Q",

      product_name: "Industrial Ball Bearing 6205-2RS",

      sku: "BRG-6205-2RS",

      warehouse_name: "Main Central Fulfillment Hub",

      warehouse: "Main Central Fulfillment Hub",

      location_name: "LOC-QAR-01 - Quarantine Vault 1",

      location: "LOC-QAR-01 - Quarantine Vault 1",

      quarantine_quantity: 15,

      quarantine_reason: "Inspection Failure",

      remarks: "Sample bearing seal misalignment during in-bound staging",

      quarantine_date: "2026-10-22",

      is_released: true,

      released_quantity: 15,

      inspection_result: "Passed",

      release_reason: "Full lot re-measured with calibrated gauge. Passed 100%.",

      released_by: "QA Inspector Marcus",

      release_date: "2026-10-25",

      status: "Released",

    },

  ];



  const local = getLocalEntities("batch_quarantines");

  const seen = new Set();

  const merged = [];

  for (const item of [...local, ...base]) {

    const key = (item.quarantine_number || item.id).toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push(item);

    }

  }

  return { results: merged, count: merged.length };

}



export async function fetchBatchMovements(params = {}) {

  let fetchedList = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/batch-movements/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = data.results || data;

    }

  } catch (e) {}



  if (fetchedList.length > 0) {

    return { results: fetchedList, count: fetchedList.length };

  }



  // Fallback to stock ledger entries that have a batch_number

  const ledger = await fetchStockLedger();

  const batchOnly = (ledger.results || []).filter((e) => Boolean(e.batch_number && e.batch_number !== "—"));



  const fallback = [

    {

      id: "bm-1",

      batch_number: "LOT-2026-BRG-01",

      product: "Industrial Ball Bearing 6205-2RS",

      transaction_number: "GRN-2026-0001",

      transaction_type: "Receipt",

      from_warehouse: "Supplier Apex",

      to_warehouse: "Main Central Hub",

      quantity: 450,

      transaction_date: "2026-10-26",

    },

    {

      id: "bm-2",

      batch_number: "LOT-2026-LUB-88",

      product: "Synthetic Compressor Lubricant ISO VG 46",

      transaction_number: "TRF-2026-4415",

      transaction_type: "Transfer",

      from_warehouse: "Main Central Hub",

      to_warehouse: "Cold Storage Facility",

      quantity: 120,

      transaction_date: "2026-10-28",

    },

    {

      id: "bm-3",

      batch_number: "LOT-2026-BRG-01",

      product: "Industrial Ball Bearing 6205-2RS",

      transaction_number: "ISS-2026-0104",

      transaction_type: "Issue",

      from_warehouse: "Main Central Hub",

      to_warehouse: "Assembly Line 4",

      quantity: 36,

      transaction_date: "2026-10-29",

    },

  ];



  const pool = [...batchOnly, ...fallback];

  const seen = new Set();

  const merged = [];

  for (const item of pool) {

    const key = `${item.transaction_number || item.transaction_ref}-${item.batch_number}`.toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push({

        id: item.id || key,

        batch_number: item.batch_number,

        product: item.product_name || item.product || item.item_name || "Industrial Component",

        transaction_number: item.transaction_number || item.transaction_ref || "TX-001",

        transaction_type: item.transaction_type || item.movement_type || "Receipt",

        from_warehouse: item.from_warehouse || (item.quantity_delta < 0 ? (item.warehouse_name || item.warehouse) : "Origin"),

        to_warehouse: item.to_warehouse || (item.destination_warehouse_name || item.warehouse_name || item.warehouse),

        quantity: Number(item.quantity !== undefined ? item.quantity : Math.abs(item.quantity_delta || 10)),

        transaction_date: item.transaction_date || (item.created_at ? item.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),

      });

    }

  }



  return { results: merged, count: merged.length };

}



// ---------------------------------------------------------------------------

// Serial Tracking API with Live Persistence

// ---------------------------------------------------------------------------

export async function fetchSerialNumbers(params = {}) {

  let fetchedList = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/serials/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = (data.results || data).map((s) => ({

        ...s,

        sku: s.sku || s.item_code,

        product: s.product_name || s.item_name || "Industrial Component",

        product_name: s.product_name || s.item_name || "Industrial Component",

      }));

    }

  } catch (e) {}



  const base = fetchedList.length > 0 ? fetchedList : [

    { id: "sn-1", serial_number: "SN-HYD-24V-00109", sku: "HYD-SV-24V", item_code: "HYD-SV-24V", product: "Hydraulic Solenoid Valve 24V DC", product_name: "Hydraulic Solenoid Valve 24V DC", batch_number: "LOT-2026-VALVE-01", warehouse: "Main Central Fulfillment Hub", warehouse_name: "Main Central Fulfillment Hub", location: "LOC-STO-A1 - Aisle 1", location_name: "LOC-STO-A1 - Aisle 1", received_date: "2026-10-18", status: "Available", warranty_until: "2028-10-20" },

    { id: "sn-2", serial_number: "SN-HYD-24V-00110", sku: "HYD-SV-24V", item_code: "HYD-SV-24V", product: "Hydraulic Solenoid Valve 24V DC", product_name: "Hydraulic Solenoid Valve 24V DC", batch_number: "LOT-2026-VALVE-01", warehouse: "Main Central Fulfillment Hub", warehouse_name: "Main Central Fulfillment Hub", location: "LOC-STO-A1 - Aisle 1", location_name: "LOC-STO-A1 - Aisle 1", received_date: "2026-10-18", status: "Available", warranty_until: "2028-10-20" },

    { id: "sn-3", serial_number: "SN-ENC-1024-99812", sku: "ENC-OPT-1024", item_code: "ENC-OPT-1024", product: "Optical Rotary Encoder 1024 PPR", product_name: "Optical Rotary Encoder 1024 PPR", batch_number: "", warehouse: "Main Central Fulfillment Hub", warehouse_name: "Main Central Fulfillment Hub", location: "LOC-STO-A1 - Aisle 1", location_name: "LOC-STO-A1 - Aisle 1", received_date: "2026-10-20", status: "In Transit", warranty_until: "2027-05-15" },

    { id: "sn-4", serial_number: "SN-ENC-1024-99815", sku: "ENC-OPT-1024", item_code: "ENC-OPT-1024", product: "Optical Rotary Encoder 1024 PPR", product_name: "Optical Rotary Encoder 1024 PPR", batch_number: "", warehouse: "East Coast Terminal", warehouse_name: "East Coast Terminal", location: "LOC-STO-E1", location_name: "LOC-STO-E1", received_date: "2026-10-22", status: "Reserved", warranty_until: "2027-05-15" },

    { id: "sn-5", serial_number: "SN-HYD-24V-00080", sku: "HYD-SV-24V", item_code: "HYD-SV-24V", product: "Hydraulic Solenoid Valve 24V DC", product_name: "Hydraulic Solenoid Valve 24V DC", batch_number: "LOT-2024-VALVE-09", warehouse: "Main Central Fulfillment Hub", warehouse_name: "Main Central Fulfillment Hub", location: "LOC-QAR-01", location_name: "LOC-QAR-01", received_date: "2024-08-15", status: "Quarantined", warranty_until: "2026-08-15" },

  ];



  const local = getLocalEntities("serials");

  const seen = new Set();

  const merged = [];



  for (const item of [...local, ...base]) {

    const key = (item.serial_number || item.id).toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push(item);

    }

  }



  return { results: merged, count: merged.length };

}



export async function createSerialNumber(payload) {

  let created = null;

  try {

    const res = await fetch(`${API_BASE}/inventory/serials/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        serial_number: payload.serial_number,

        item: payload.item_id || payload.item || 2,

        warehouse: payload.warehouse_id || payload.warehouse || 1,

        location: payload.location_id || payload.location || null,

        batch: payload.batch_id || payload.batch || null,

        received_date: payload.received_date || new Date().toISOString().split("T")[0],

        status: payload.status || "Available",

        notes: payload.notes || "",

      }),

    });

    if (res.ok) {

      updateApiStatus(true);

      created = await res.json();

    }

  } catch (e) {}



  if (!created) {

    created = {

      id: `sn-${Date.now()}`,

      serial_number: payload.serial_number,

      sku: payload.sku || payload.item_code || "HYD-SV-24V",

      item_code: payload.sku || payload.item_code || "HYD-SV-24V",

      product: payload.product_name || payload.item_name || "Hydraulic Solenoid Valve 24V DC",

      product_name: payload.product_name || payload.item_name || "Hydraulic Solenoid Valve 24V DC",

      batch_number: payload.batch_number || "",

      warehouse: payload.warehouse || "Main Central Fulfillment Hub",

      warehouse_name: payload.warehouse || "Main Central Fulfillment Hub",

      location: payload.storage_location || payload.location || "Aisle 1 - Buffer",

      location_name: payload.storage_location || payload.location || "Aisle 1 - Buffer",

      received_date: payload.received_date || new Date().toISOString().split("T")[0],

      status: payload.status || "Available",

      notes: payload.notes || "",

    };

  }



  saveLocalEntity("serials", created, "serial_number");

  return created;

}



export async function updateSerialNumberStatus(id, newStatus) {

  try {

    const res = await fetch(`${API_BASE}/inventory/serials/${id}/`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ status: newStatus }),

    });

    if (res.ok) {

      updateApiStatus(true);

    }

  } catch (e) {}



  updateLocalEntity("serials", id, { status: newStatus });

  return { id, status: newStatus };

}



export async function fetchSerialMovements(params = {}) {

  let fetchedList = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/serial-movements/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      fetchedList = data.results || data;

    }

  } catch (e) {}



  if (fetchedList.length > 0) {

    return { results: fetchedList, count: fetchedList.length };

  }



  // Fallback to stock ledger entries that have a serial_number

  const ledger = await fetchStockLedger();

  const serialOnly = (ledger.results || []).filter((e) => Boolean(e.serial_number && e.serial_number !== "—"));



  const fallback = [

    {

      id: "sm-1",

      serial_number: "SN-HYD-24V-00109",

      product: "Hydraulic Solenoid Valve 24V DC",

      transaction_number: "GRN-2026-0002",

      transaction_type: "Receipt",

      from_warehouse: "Supplier HydroMotion",

      to_warehouse: "Main Central Hub",

      transaction_date: "2026-10-18",

      serial_status: "Available",

    },

    {

      id: "sm-2",

      serial_number: "SN-ENC-1024-99812",

      product: "Optical Rotary Encoder 1024 PPR",

      transaction_number: "TRF-2026-4410",

      transaction_type: "Transfer",

      from_warehouse: "Main Central Hub",

      to_warehouse: "East Coast Terminal",

      transaction_date: "2026-10-30",

      serial_status: "In Transit",

    },

    {

      id: "sm-3",

      serial_number: "SN-HYD-24V-00080",

      product: "Hydraulic Solenoid Valve 24V DC",

      transaction_number: "RET-2026-0033",

      transaction_type: "Return",

      from_warehouse: "Client Automotive Plant",

      to_warehouse: "Main Central Hub (Quarantine Vault)",

      transaction_date: "2026-10-25",

      serial_status: "Quarantined",

    },

  ];



  const pool = [...serialOnly, ...fallback];

  const seen = new Set();

  const merged = [];

  for (const item of pool) {

    const key = `${item.transaction_number || item.transaction_ref}-${item.serial_number}`.toLowerCase();

    if (!seen.has(key)) {

      seen.add(key);

      merged.push({

        id: item.id || key,

        serial_number: item.serial_number,

        product: item.product_name || item.product || item.item_name || "Industrial Component",

        transaction_number: item.transaction_number || item.transaction_ref || "TX-001",

        transaction_type: item.transaction_type || item.movement_type || "Receipt",

        from_warehouse: item.from_warehouse || (item.quantity_delta < 0 ? (item.warehouse_name || item.warehouse) : "Origin"),

        to_warehouse: item.to_warehouse || (item.destination_warehouse_name || item.warehouse_name || item.warehouse),

        transaction_date: item.transaction_date || (item.created_at ? item.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),

        serial_status: item.serial_status || (item.movement_type === "RECEIPT" ? "Available" : (item.movement_type === "ISSUE" ? "Issued" : "In Transit")),

      });

    }

  }



  return { results: merged, count: merged.length };

}



// ---------------------------------------------------------------------------

// Valuation API

// ---------------------------------------------------------------------------

export async function fetchValuation() {

  try {

    const res = await fetch(`${API_BASE}/inventory/valuation/`);

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}

  return {

    results: [

      { id: "val-1", item_code: "BRG-6205-2RS", item_name: "Industrial Ball Bearing 6205-2RS", warehouse_code: "WH-MAIN", on_hand_qty: 450, weighted_average_cost: 14.85, total_value: 6682.50 },

      { id: "val-2", item_code: "HYD-SV-24V", item_name: "Hydraulic Solenoid Valve 24V DC", warehouse_code: "WH-MAIN", on_hand_qty: 18, weighted_average_cost: 128.50, total_value: 2313.00 },

      { id: "val-3", item_code: "BELT-T10-1200", item_name: "Polyurethane Timing Belt T10-1200", warehouse_code: "WH-MAIN", on_hand_qty: 280, weighted_average_cost: 32.40, total_value: 9072.00 },

      { id: "val-4", item_code: "LUB-SYN-VG46", item_name: "Synthetic Compressor Lubricant ISO VG 46", warehouse_code: "WH-MAIN", on_hand_qty: 1250, weighted_average_cost: 18.20, total_value: 22750.00 },

    ],

    total_inventory_value: 40817.50,

  };

}



// ---------------------------------------------------------------------------

// Universal File Storage API integrations

// ---------------------------------------------------------------------------

export async function fetchAttachments(ownerType, ownerId) {
  const res = await fetch(
    `${API_BASE}/storage/files/?owner_type=${encodeURIComponent(ownerType)}&owner_id=${encodeURIComponent(ownerId)}`
  );
  if (!res.ok) throw new Error("Failed to load product attachments.");
  updateApiStatus(true);
  const data = await res.json();
  return data.results || data;
}



export async function uploadAttachment(file, ownerType, ownerId) {

  const formData = new FormData();

  formData.append("file", file);

  formData.append("owner_type", ownerType);

  formData.append("owner_id", ownerId);

  formData.append("is_public", "false");



  const res = await fetch(`${API_BASE}/storage/files/`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to upload attachment.");
  }
  updateApiStatus(true);
  return await res.json();
}



export async function deleteAttachment(fileId) {
  const res = await fetch(`${API_BASE}/storage/files/${fileId}/`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete attachment.");
  return true;
}





// ==========================================

// PHASE 6: PLANNING & REPLENISHMENT SERVICES

// ==========================================



const DEMO_REORDER_RULES = [

  { id: "rr-1", product: 1, product_name: "Deep Groove Ball Bearing 6205-2RS", sku: "BRG-6205-2RS", warehouse: 1, warehouse_name: "Main Central Hub", reorder_point: 20, reorder_quantity: 100, lead_time_days: 7, status: "Active" },

  { id: "rr-2", product: 2, product_name: "Hydraulic Solenoid Valve 24V DC", sku: "HYD-SV-24V", warehouse: 1, warehouse_name: "Main Central Hub", reorder_point: 10, reorder_quantity: 50, lead_time_days: 14, status: "Active" },

  { id: "rr-3", product: 3, product_name: "Polyurethane Timing Belt T10-1200", sku: "BELT-T10-1200", warehouse: 2, warehouse_name: "Regional Distribution Hub", reorder_point: 15, reorder_quantity: 60, lead_time_days: 5, status: "Active" },

  { id: "rr-4", product: 4, product_name: "Industrial Optical Proximity Sensor", sku: "SNR-OPT-PROX", warehouse: 1, warehouse_name: "Main Central Hub", reorder_point: 8, reorder_quantity: 40, lead_time_days: 10, status: "Inactive" },

];



export async function fetchReorderRules(params = {}) {

  let list = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/planning/reorder-rules/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      list = data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  const local = getLocalEntities("reorder_rules");

  const merged = [...local, ...list];

  if (merged.length === 0) {

    return { results: DEMO_REORDER_RULES, count: DEMO_REORDER_RULES.length };

  }

  return { results: merged, count: merged.length };

}



export async function createReorderRule(payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/reorder-rules/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {

    updateApiStatus(false);

  }

  const item = {

    id: `rr-${Date.now()}`,

    ...payload,

    created_at: new Date().toISOString(),

  };

  saveLocalEntity("reorder_rules", item);

  return item;

}



export async function updateReorderRule(id, payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/reorder-rules/${id}/`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}

  return { id, ...payload };

}



export async function deleteReorderRule(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/reorder-rules/${id}/`, {

      method: "DELETE",

    });

    return res.ok;

  } catch (e) {

    return true;

  }

}



const DEMO_STOCK_LEVELS = [

  { id: "sl-1", product: 1, product_name: "Deep Groove Ball Bearing 6205-2RS", sku: "BRG-6205-2RS", warehouse: 1, warehouse_name: "Main Central Hub", min_stock: 15, max_stock: 150, safety_stock: 10 },

  { id: "sl-2", product: 2, product_name: "Hydraulic Solenoid Valve 24V DC", sku: "HYD-SV-24V", warehouse: 1, warehouse_name: "Main Central Hub", min_stock: 10, max_stock: 80, safety_stock: 5 },

  { id: "sl-3", product: 3, product_name: "Polyurethane Timing Belt T10-1200", sku: "BELT-T10-1200", warehouse: 2, warehouse_name: "Regional Distribution Hub", min_stock: 20, max_stock: 120, safety_stock: 8 },

  { id: "sl-4", product: 4, product_name: "Industrial Optical Proximity Sensor", sku: "SNR-OPT-PROX", warehouse: 1, warehouse_name: "Main Central Hub", min_stock: 5, max_stock: 50, safety_stock: 2 },

];



export async function fetchStockLevels(params = {}) {

  let list = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/planning/stock-levels/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      list = data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  const local = getLocalEntities("stock_levels");

  const merged = [...local, ...list];

  if (merged.length === 0) {

    return { results: DEMO_STOCK_LEVELS, count: DEMO_STOCK_LEVELS.length };

  }

  return { results: merged, count: merged.length };

}



export async function createStockLevel(payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/stock-levels/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {

    updateApiStatus(false);

  }

  const item = {

    id: `sl-${Date.now()}`,

    ...payload,

    created_at: new Date().toISOString(),

  };

  saveLocalEntity("stock_levels", item);

  return item;

}



export async function updateStockLevel(id, payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/stock-levels/${id}/`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) return await res.json();

  } catch (e) {}

  return { id, ...payload };

}



export async function deleteStockLevel(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/stock-levels/${id}/`, {

      method: "DELETE",

    });

    return res.ok;

  } catch (e) {

    return true;

  }

}



const DEMO_REPLENISHMENT_PLANS = [

  { id: "pln-1", plan_number: "PLN-2026-1041", product: 1, product_name: "Deep Groove Ball Bearing 6205-2RS", sku: "BRG-6205-2RS", warehouse: 1, warehouse_name: "Main Central Hub", current_stock: 12, reserved_stock: 4, available_stock: 8, minimum_stock: 15, required_quantity: 142, status: "Pending" },

  { id: "pln-2", plan_number: "PLN-2026-1042", product: 2, product_name: "Hydraulic Solenoid Valve 24V DC", sku: "HYD-SV-24V", warehouse: 1, warehouse_name: "Main Central Hub", current_stock: 8, reserved_stock: 2, available_stock: 6, minimum_stock: 10, required_quantity: 74, status: "Planned" },

  { id: "pln-3", plan_number: "PLN-2026-1043", product: 3, product_name: "Polyurethane Timing Belt T10-1200", sku: "BELT-T10-1200", warehouse: 2, warehouse_name: "Regional Distribution Hub", current_stock: 14, reserved_stock: 0, available_stock: 14, minimum_stock: 20, required_quantity: 106, status: "Completed" },

];



export async function fetchReplenishmentPlans(params = {}) {

  let list = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/planning/replenishment-plans/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      list = data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  const local = getLocalEntities("replenishment_plans");

  const merged = [...local, ...list];

  if (merged.length === 0) {

    return { results: DEMO_REPLENISHMENT_PLANS, count: DEMO_REPLENISHMENT_PLANS.length };

  }

  return { results: merged, count: merged.length };

}



export async function createReplenishmentPlan(payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/replenishment-plans/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {

    updateApiStatus(false);

  }

  const item = {

    id: `pln-${Date.now()}`,

    plan_number: `PLN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,

    ...payload,

    status: payload.status || "Pending",

    created_at: new Date().toISOString(),

  };

  saveLocalEntity("replenishment_plans", item);

  return item;

}



export async function updateReplenishmentPlan(id, payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/replenishment-plans/${id}/`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) return await res.json();

  } catch (e) {}

  return { id, ...payload };

}



export async function approveReplenishmentPlan(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/replenishment-plans/${id}/approve/`, {

      method: "POST",

    });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}

  return { message: "Plan approved", status: "Planned" };

}



export async function generateReplenishmentPlans() {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/replenishment-plans/generate/`, {

      method: "POST",

    });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}

  return { message: "Scanned stock balances and generated replenishment plans." };

}



const DEMO_PURCHASE_SUGGESTIONS = [

  { id: "sug-1", suggestion_number: "SUG-2026-3011", suggestion_date: "2026-11-03", product: 1, product_name: "Deep Groove Ball Bearing 6205-2RS", sku: "BRG-6205-2RS", warehouse: 1, warehouse_name: "Main Central Hub", available_stock: 8, reorder_point: 20, suggested_quantity: 100, supplier: "SKF Precision Supplies", status: "Pending" },

  { id: "sug-2", suggestion_number: "SUG-2026-3012", suggestion_date: "2026-11-02", product: 2, product_name: "Hydraulic Solenoid Valve 24V DC", sku: "HYD-SV-24V", warehouse: 1, warehouse_name: "Main Central Hub", available_stock: 6, reorder_point: 10, suggested_quantity: 50, supplier: "Bosch Fluid Control", status: "Approved" },

  { id: "sug-3", suggestion_number: "SUG-2026-3013", suggestion_date: "2026-11-01", product: 3, product_name: "Polyurethane Timing Belt T10-1200", sku: "BELT-T10-1200", warehouse: 2, warehouse_name: "Regional Distribution Hub", available_stock: 14, reorder_point: 15, suggested_quantity: 60, supplier: "Continental Drive Components", status: "Converted" },

];



export async function fetchPurchaseSuggestions(params = {}) {

  let list = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/planning/purchase-suggestions/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      list = data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  const local = getLocalEntities("purchase_suggestions");

  const merged = [...local, ...list];

  if (merged.length === 0) {

    return { results: DEMO_PURCHASE_SUGGESTIONS, count: DEMO_PURCHASE_SUGGESTIONS.length };

  }

  return { results: merged, count: merged.length };

}



export async function approvePurchaseSuggestion(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/purchase-suggestions/${id}/approve/`, {

      method: "POST",

    });

    if (res.ok) return await res.json();

  } catch (e) {}

  return { status: "Approved" };

}



export async function rejectPurchaseSuggestion(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/purchase-suggestions/${id}/reject/`, {

      method: "POST",

    });

    if (res.ok) return await res.json();

  } catch (e) {}

  return { status: "Rejected" };

}



export async function convertPurchaseSuggestion(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/purchase-suggestions/${id}/convert/`, {

      method: "POST",

    });

    if (res.ok) return await res.json();

  } catch (e) {}

  return { status: "Converted", purchase_request_id: `PR-2026-${Math.floor(1000 + Math.random() * 9000)}` };

}



export async function generatePurchaseSuggestions() {

  try {

    const res = await fetch(`${API_BASE}/inventory/planning/purchase-suggestions/generate/`, {

      method: "POST",

    });

    if (res.ok) return await res.json();

  } catch (e) {}

  return { message: "Calculated purchase suggestions based on available stock and reorder points." };

}



export async function fetchStockForecast(params = {}) {

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/planning/stock-forecast/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {

    updateApiStatus(false);

  }

  // Fallback dynamic calculation for demo

  const period = params.forecast_period || "30 Days";

  const days = period === "7 Days" ? 7 : (period === "60 Days" ? 60 : (period === "90 Days" ? 90 : 30));

  return {

    results: [

      { product: 1, product_name: "Deep Groove Ball Bearing 6205-2RS", sku: "BRG-6205-2RS", warehouse: 1, warehouse_name: "Main Central Hub", forecast_period: period, historical_demand: 120, average_daily_demand: 4.0, current_available_stock: 48, expected_demand: 4.0 * days, projected_stock: 48 - (4.0 * days), stockout_risk: (48 - (4.0 * days)) <= 0 ? "High" : "Low" },

      { product: 2, product_name: "Hydraulic Solenoid Valve 24V DC", sku: "HYD-SV-24V", warehouse: 1, warehouse_name: "Main Central Hub", forecast_period: period, historical_demand: 45, average_daily_demand: 1.5, current_available_stock: 12, expected_demand: 1.5 * days, projected_stock: 12 - (1.5 * days), stockout_risk: (12 - (1.5 * days)) <= 0 ? "High" : "Medium" },

      { product: 3, product_name: "Polyurethane Timing Belt T10-1200", sku: "BELT-T10-1200", warehouse: 2, warehouse_name: "Regional Distribution Hub", forecast_period: period, historical_demand: 90, average_daily_demand: 3.0, current_available_stock: 65, expected_demand: 3.0 * days, projected_stock: 65 - (3.0 * days), stockout_risk: "Low" },

      { product: 4, product_name: "Industrial Optical Proximity Sensor", sku: "SNR-OPT-PROX", warehouse: 1, warehouse_name: "Main Central Hub", forecast_period: period, historical_demand: 30, average_daily_demand: 1.0, current_available_stock: 6, expected_demand: 1.0 * days, projected_stock: 6 - (1.0 * days), stockout_risk: (6 - (1.0 * days)) <= 0 ? "High" : "Medium" },

    ],

    count: 4,

  };

}





// ==========================================

// PHASE 7: PHYSICAL INVENTORY & AUDIT SERVICES

// ==========================================



const DEMO_STOCK_COUNTS = [

  {

    id: 1,

    count_number: "CNT-2026-1042",

    count_date: "2026-11-03",

    warehouse: 1,

    warehouse_name: "Main Central Hub",

    warehouse_code: "WH-MAIN",

    location: 1,

    location_name: "Aisle 1 - High Bay Storage",

    product: 1,

    item: 1,

    product_name: "Deep Groove Ball Bearing 6205-2RS",

    sku: "BRG-6205-2RS",

    system_quantity: 100,

    physical_quantity: 105,

    difference_quantity: 5,

    variance_reason: "Excess Stock",

    remarks: "Found extra box during aisle count",

    status: "APPROVED",

    assigned_to: "Sarah Jenkins",

    counted_by: "Sarah Jenkins",

    verified_by: "David Chen",

  },

  {

    id: 2,

    count_number: "CNT-2026-1043",

    count_date: "2026-11-03",

    warehouse: 1,

    warehouse_name: "Main Central Hub",

    warehouse_code: "WH-MAIN",

    location: 2,

    location_name: "Aisle 2 - Picking Zone",

    product: 2,

    item: 2,

    product_name: "Hydraulic Solenoid Valve 24V DC",

    sku: "HYD-SV-24V",

    system_quantity: 25,

    physical_quantity: 22,

    difference_quantity: -3,

    variance_reason: "Missing Stock",

    remarks: "Discrepancy observed on bin shelf B-04",

    status: "SUBMITTED",

    assigned_to: "Marcus Vance",

    counted_by: "Marcus Vance",

    verified_by: "David Chen",

  },

  {

    id: 3,

    count_number: "CNT-2026-1044",

    count_date: "2026-11-02",

    warehouse: 2,

    warehouse_name: "Regional Distribution Hub",

    warehouse_code: "WH-REG",

    location: 3,

    location_name: "Bin C-12 - Bulk Rack",

    product: 3,

    item: 3,

    product_name: "Polyurethane Timing Belt T10-1200",

    sku: "BELT-T10-1200",

    system_quantity: 50,

    physical_quantity: 48,

    difference_quantity: -2,

    variance_reason: "Damage",

    remarks: "Damaged belts quarantined from count",

    status: "ADJUSTED",

    assigned_to: "Elena Rostova",

    counted_by: "Elena Rostova",

    verified_by: "Alex Thompson",

    adjustment_document_number: "ADJ-CNT-2026-1044-884",

  },

];



const DEMO_CYCLE_COUNTS = [

  {

    id: 1,

    count_number: "CYC-2026-001",

    count_date: "2026-11-03",

    warehouse: 1,

    warehouse_name: "Main Central Hub",

    storage_location: 1,

    location_name: "Aisle 1 - High Bay Storage",

    product: 1,

    product_name: "Deep Groove Ball Bearing 6205-2RS",

    sku: "BRG-6205-2RS",

    count_frequency: "Weekly",

    assigned_to: "Sarah Jenkins",

    status: "In Progress",

    notes: "High velocity critical bearings cycle inspection",

  },

  {

    id: 2,

    count_number: "CYC-2026-002",

    count_date: "2026-11-01",

    warehouse: 1,

    warehouse_name: "Main Central Hub",

    storage_location: null,

    location_name: "All Locations",

    product: 2,

    product_name: "Hydraulic Solenoid Valve 24V DC",

    sku: "HYD-SV-24V",

    count_frequency: "Monthly",

    assigned_to: "Marcus Vance",

    status: "Completed",

    notes: "Monthly precision valve cycle audit",

  },

];



const DEMO_FULL_COUNTS = [

  {

    id: 1,

    count_number: "FSC-2026-001",

    count_date: "2026-11-01",

    warehouse: 1,

    warehouse_name: "Main Central Hub",

    include_all_locations: true,

    storage_locations: [],

    assigned_to: "David Chen (Audit Lead)",

    status: "Counting",

    notes: "Q4 Comprehensive Warehouse Physical Audit",

  },

];



const DEMO_AUDIT_HISTORY = [

  {

    id: 1,

    audit_number: "AUD-2026-0091",

    count_number: "CNT-2026-1044",

    warehouse: 2,

    warehouse_name: "Regional Distribution Hub",

    count_date: "2026-11-02",

    counted_by: "Elena Rostova",

    verified_by: "Alex Thompson",

    total_products_counted: 15,

    variance_count: 2,

    status: "Approved",

    notes: "Timing belt variance reconciled and adjusted to ledger.",

  },

  {

    id: 2,

    audit_number: "AUD-2026-0090",

    count_number: "CYC-2026-002",

    warehouse: 1,

    warehouse_name: "Main Central Hub",

    count_date: "2026-11-01",

    counted_by: "Marcus Vance",

    verified_by: "David Chen",

    total_products_counted: 8,

    variance_count: 0,

    status: "Closed",

    notes: "Zero variance recorded across all hydraulic valve bins.",

  },

];



export async function fetchStockCounts(params = {}) {

  let list = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/audit/stock-counts/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      list = data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  if (!list.length) {

    list = getStored("inv_physical_counts", DEMO_STOCK_COUNTS);

  }

  return list;

}



export async function createStockCount(payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/stock-counts/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      const current = getStored("inv_physical_counts", DEMO_STOCK_COUNTS);

      setStored("inv_physical_counts", [data, ...current]);

      return data;

    }

  } catch (e) {

    updateApiStatus(false);

  }

  // Local fallback

  const diff = Number(payload.physical_quantity || 0) - Number(payload.system_quantity || 0);

  const newCount = {

    id: `cnt-${Date.now()}`,

    count_number: `CNT-2026-${Math.floor(1000 + Math.random() * 9000)}`,

    count_date: payload.count_date || new Date().toISOString().split("T")[0],

    warehouse: payload.warehouse,

    warehouse_name: payload.warehouse_name || "Main Central Hub",

    location: payload.storage_location || null,

    location_name: payload.location_name || "Main Area",

    product: payload.product,

    item: payload.product,

    product_name: payload.product_name || "Selected Product",

    sku: payload.sku || "PROD-SKU",

    system_quantity: Number(payload.system_quantity || 0),

    physical_quantity: Number(payload.physical_quantity || 0),

    difference_quantity: diff,

    variance_reason: payload.variance_reason || (diff < 0 ? "Missing Stock" : (diff > 0 ? "Excess Stock" : "")),

    remarks: payload.remarks || "",

    status: payload.status || "DRAFT",

    assigned_to: "Staff Counter",

    counted_by: "Staff Counter",

    verified_by: "Inventory Lead",

  };

  const current = getStored("inv_physical_counts", DEMO_STOCK_COUNTS);

  setStored("inv_physical_counts", [newCount, ...current]);

  return newCount;

}



export async function submitStockCount(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/stock-counts/${id}/submit/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}

  const current = getStored("inv_physical_counts", DEMO_STOCK_COUNTS);

  const updated = current.map((c) => (c.id === id ? { ...c, status: "SUBMITTED" } : c));

  setStored("inv_physical_counts", updated);

  return { id, status: "SUBMITTED" };

}



export async function approveStockCount(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/stock-counts/${id}/approve/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}

  const current = getStored("inv_physical_counts", DEMO_STOCK_COUNTS);

  const updated = current.map((c) => (c.id === id ? { ...c, status: "APPROVED" } : c));

  setStored("inv_physical_counts", updated);

  return { id, status: "APPROVED" };

}



export async function rejectStockCount(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/stock-counts/${id}/reject/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}

  const current = getStored("inv_physical_counts", DEMO_STOCK_COUNTS);

  const updated = current.map((c) => (c.id === id ? { ...c, status: "REJECTED" } : c));

  setStored("inv_physical_counts", updated);

  return { id, status: "REJECTED" };

}



export async function reviewStockCount(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/stock-counts/${id}/review/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}

  const current = getStored("inv_physical_counts", DEMO_STOCK_COUNTS);

  const updated = current.map((c) => (c.id === id ? { ...c, status: "PENDING" } : c));

  setStored("inv_physical_counts", updated);

  return { id, status: "PENDING" };

}



export async function generateStockCountAdjustment(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/stock-counts/${id}/generate_adjustment/`, { method: "POST" });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}

  const current = getStored("inv_physical_counts", DEMO_STOCK_COUNTS);

  const docNum = `ADJ-CNT-${Math.floor(1000 + Math.random() * 9000)}`;

  const updated = current.map((c) => (c.id === id ? { ...c, status: "ADJUSTED", adjustment_document_number: docNum } : c));

  setStored("inv_physical_counts", updated);

  return { id, status: "ADJUSTED", adjustment_document_number: docNum };

}



export async function fetchCycleCounts(params = {}) {

  let list = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/audit/cycle-counts/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      list = data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  if (!list.length) {

    list = getStored("inv_cycle_counts", DEMO_CYCLE_COUNTS);

  }

  return list;

}



export async function createCycleCount(payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/cycle-counts/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      const current = getStored("inv_cycle_counts", DEMO_CYCLE_COUNTS);

      setStored("inv_cycle_counts", [data, ...current]);

      return data;

    }

  } catch (e) {

    updateApiStatus(false);

  }

  const newCycle = {

    id: `cyc-${Date.now()}`,

    count_number: `CYC-2026-${Math.floor(1000 + Math.random() * 9000)}`,

    count_date: payload.count_date || new Date().toISOString().split("T")[0],

    warehouse: payload.warehouse,

    warehouse_name: payload.warehouse_name || "Main Central Hub",

    storage_location: payload.storage_location || null,

    location_name: payload.location_name || "All Locations",

    product: payload.product || null,

    product_name: payload.product_name || "All Products",

    sku: payload.sku || "",

    count_frequency: payload.count_frequency || "Monthly",

    assigned_to: payload.assigned_to || "Staff Auditor",

    status: payload.status || "Scheduled",

    notes: payload.notes || "",

  };

  const current = getStored("inv_cycle_counts", DEMO_CYCLE_COUNTS);

  setStored("inv_cycle_counts", [newCycle, ...current]);

  return newCycle;

}



export async function generateCycleCountEntries(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/cycle-counts/${id}/generate_count_entries/`, { method: "POST" });

    if (res.ok) return await res.json();

  } catch (e) {}

  return { message: "Generated count entries for cycle count scope." };

}



export async function completeCycleCount(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/cycle-counts/${id}/complete/`, { method: "POST" });

    if (res.ok) return await res.json();

  } catch (e) {}

  const current = getStored("inv_cycle_counts", DEMO_CYCLE_COUNTS);

  const updated = current.map((c) => (c.id === id ? { ...c, status: "Completed" } : c));

  setStored("inv_cycle_counts", updated);

  return { id, status: "Completed" };

}



export async function fetchFullStockCounts(params = {}) {

  let list = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/audit/full-counts/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      list = data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  if (!list.length) {

    list = getStored("inv_full_counts", DEMO_FULL_COUNTS);

  }

  return list;

}



export async function createFullStockCount(payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/full-counts/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      const current = getStored("inv_full_counts", DEMO_FULL_COUNTS);

      setStored("inv_full_counts", [data, ...current]);

      return data;

    }

  } catch (e) {

    updateApiStatus(false);

  }

  const newFull = {

    id: `fsc-${Date.now()}`,

    count_number: `FSC-2026-${Math.floor(1000 + Math.random() * 9000)}`,

    count_date: payload.count_date || new Date().toISOString().split("T")[0],

    warehouse: payload.warehouse,

    warehouse_name: payload.warehouse_name || "Main Central Hub",

    include_all_locations: payload.include_all_locations !== false,

    storage_locations: payload.storage_locations || [],

    assigned_to: payload.assigned_to || "Lead Auditor",

    status: "Initiated",

    notes: payload.notes || "",

  };

  const current = getStored("inv_full_counts", DEMO_FULL_COUNTS);

  setStored("inv_full_counts", [newFull, ...current]);

  return newFull;

}



export async function generateFullStockCountEntries(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/full-counts/${id}/generate_count_entries/`, { method: "POST" });

    if (res.ok) return await res.json();

  } catch (e) {}

  return { message: "Count entries generated across warehouse inventory scope." };

}



export async function completeFullStockCount(id) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/full-counts/${id}/complete/`, { method: "POST" });

    if (res.ok) return await res.json();

  } catch (e) {}

  const current = getStored("inv_full_counts", DEMO_FULL_COUNTS);

  const updated = current.map((c) => (c.id === id ? { ...c, status: "Completed" } : c));

  setStored("inv_full_counts", updated);

  return { id, status: "Completed" };

}



export async function fetchAuditHistory(params = {}) {

  let list = [];

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/audit/history/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      list = data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  if (!list.length) {

    list = getStored("inv_audit_history", DEMO_AUDIT_HISTORY);

  }

  return list;

}



export async function createAuditHistory(payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/audit/history/`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {}

  const newAudit = {

    id: `aud-${Date.now()}`,

    audit_number: `AUD-2026-${Math.floor(1000 + Math.random() * 9000)}`,

    count_number: payload.count_number,

    warehouse: payload.warehouse,

    warehouse_name: payload.warehouse_name || "Main Central Hub",

    count_date: payload.count_date || new Date().toISOString().split("T")[0],

    counted_by: payload.counted_by || "Staff Counter",

    verified_by: payload.verified_by || "Lead Auditor",

    total_products_counted: Number(payload.total_products_counted || 1),

    variance_count: Number(payload.variance_count || 0),

    status: payload.status || "Completed",

    notes: payload.notes || "",

  };

  const current = getStored("inv_audit_history", DEMO_AUDIT_HISTORY);

  setStored("inv_audit_history", [newAudit, ...current]);

  return newAudit;

}





// ---------------------------------------------------------------------------

// Phase 8: Reports & Analytics API (Read-Only)

// ---------------------------------------------------------------------------



export const DEMO_STOCK_SUMMARY_REPORT = [

  { id: 1, product_name: "Industrial Ball Bearing 6205-2RS", sku: "BRG-6205", category: "Mechanical Components", warehouse: "Main Central Hub", total_stock: 1420, reserved_stock: 120, available_stock: 1280, damaged_stock: 20, stock_status: "In Stock" },

  { id: 2, product_name: "Hydraulic Solenoid Valve 24V", sku: "HYD-SV-24V", category: "Hydraulics", warehouse: "Main Central Hub", total_stock: 28, reserved_stock: 10, available_stock: 18, damaged_stock: 0, stock_status: "Low Stock" },

  { id: 3, product_name: "Timing Belt T10-1200 Steel Cord", sku: "BELT-T10", category: "Drive Belts", warehouse: "East Coast Terminal", total_stock: 350, reserved_stock: 45, available_stock: 305, damaged_stock: 0, stock_status: "In Stock" },

  { id: 4, product_name: "Optical Rotary Encoder 1024 PPR", sku: "ENC-OPT", category: "Sensors & Encoders", warehouse: "West Coast Depot", total_stock: 0, reserved_stock: 0, available_stock: 0, damaged_stock: 0, stock_status: "Out of Stock" },

  { id: 5, product_name: "Synthetic Compressor Lubricant ISO VG 46", sku: "LUB-VG46", category: "Lubricants", warehouse: "Main Central Hub", total_stock: 840, reserved_stock: 60, available_stock: 780, damaged_stock: 0, stock_status: "In Stock" },

  { id: 6, product_name: "Brushless Servomotor 400W 3000RPM", sku: "MTR-BL400", category: "Motors & Actuators", warehouse: "Main Central Hub", total_stock: 42, reserved_stock: 5, available_stock: 37, damaged_stock: 0, stock_status: "In Stock" },

];



export const DEMO_STOCK_MOVEMENT_REPORT = [

  { id: 1, transaction_date: "2026-11-03 09:15", transaction_number: "GRN-2026-0891", product: "Industrial Ball Bearing 6205-2RS", sku: "BRG-6205", warehouse: "Main Central Hub", transaction_type: "Receipt", quantity_in: 500, quantity_out: 0, reference_number: "PO-2026-4401" },

  { id: 2, transaction_date: "2026-11-03 10:20", transaction_number: "ISS-2026-0142", product: "Industrial Ball Bearing 6205-2RS", sku: "BRG-6205", warehouse: "Main Central Hub", transaction_type: "Issue", quantity_in: 0, quantity_out: 50, reference_number: "WO-9901" },

  { id: 3, transaction_date: "2026-11-02 14:30", transaction_number: "TRF-2026-0331", product: "Timing Belt T10-1200 Steel Cord", sku: "BELT-T10", warehouse: "East Coast Terminal", transaction_type: "Transfer", quantity_in: 80, quantity_out: 0, reference_number: "TR-ORD-02" },

  { id: 4, transaction_date: "2026-11-02 16:45", transaction_number: "ADJ-2026-0089", product: "Hydraulic Solenoid Valve 24V", sku: "HYD-SV-24V", warehouse: "Main Central Hub", transaction_type: "Adjustment", quantity_in: 0, quantity_out: 2, reference_number: "VAR-0012" },

  { id: 5, transaction_date: "2026-11-01 11:00", transaction_number: "RET-2026-0045", product: "Synthetic Compressor Lubricant ISO VG 46", sku: "LUB-VG46", warehouse: "Main Central Hub", transaction_type: "Return", quantity_in: 20, quantity_out: 0, reference_number: "RMA-2026-01" },

];



export const DEMO_STOCK_LEDGER_REPORT = [

  { id: 1, transaction_date: "2026-11-03 09:15", transaction_number: "GRN-2026-0891", product: "Industrial Ball Bearing 6205-2RS", warehouse: "Main Central Hub", transaction_type: "Receipt", quantity_in: 500, quantity_out: 0, running_balance: 1470 },

  { id: 2, transaction_date: "2026-11-03 10:20", transaction_number: "ISS-2026-0142", product: "Industrial Ball Bearing 6205-2RS", warehouse: "Main Central Hub", transaction_type: "Issue", quantity_in: 0, quantity_out: 50, running_balance: 1420 },

  { id: 3, transaction_date: "2026-11-02 14:00", transaction_number: "GRN-2026-0880", product: "Timing Belt T10-1200 Steel Cord", warehouse: "East Coast Terminal", transaction_type: "Receipt", quantity_in: 350, quantity_out: 0, running_balance: 350 },

  { id: 4, transaction_date: "2026-11-01 16:20", transaction_number: "ADJ-2026-0085", product: "Hydraulic Solenoid Valve 24V", warehouse: "Main Central Hub", transaction_type: "Adjustment", quantity_in: 30, quantity_out: 0, running_balance: 30 },

  { id: 5, transaction_date: "2026-11-02 16:45", transaction_number: "ISS-2026-0130", product: "Hydraulic Solenoid Valve 24V", warehouse: "Main Central Hub", transaction_type: "Issue", quantity_in: 0, quantity_out: 2, running_balance: 28 },

];



export const DEMO_STOCK_VALUATION_REPORT = [

  { id: 1, product: "Industrial Ball Bearing 6205-2RS", sku: "BRG-6205", warehouse: "Main Central Hub", stock_quantity: 1420, unit_cost: 14.85, total_stock_value: 21087.00, valuation_method: "Weighted Average Cost" },

  { id: 2, product: "Hydraulic Solenoid Valve 24V", sku: "HYD-SV-24V", warehouse: "Main Central Hub", stock_quantity: 28, unit_cost: 142.00, total_stock_value: 3976.00, valuation_method: "Weighted Average Cost" },

  { id: 3, product: "Timing Belt T10-1200 Steel Cord", sku: "BELT-T10", warehouse: "East Coast Terminal", stock_quantity: 350, unit_cost: 32.50, total_stock_value: 11375.00, valuation_method: "Weighted Average Cost" },

  { id: 4, product: "Optical Rotary Encoder 1024 PPR", sku: "ENC-OPT", warehouse: "West Coast Depot", stock_quantity: 0, unit_cost: 89.00, total_stock_value: 0.00, valuation_method: "Weighted Average Cost" },

  { id: 5, product: "Synthetic Compressor Lubricant ISO VG 46", sku: "LUB-VG46", warehouse: "Main Central Hub", stock_quantity: 840, unit_cost: 24.00, total_stock_value: 20160.00, valuation_method: "Weighted Average Cost" },

  { id: 6, product: "Brushless Servomotor 400W 3000RPM", sku: "MTR-BL400", warehouse: "Main Central Hub", stock_quantity: 42, unit_cost: 260.00, total_stock_value: 10920.00, valuation_method: "Weighted Average Cost" },

];



export const DEMO_LOW_STOCK_REPORT = [

  { id: 1, product: "Hydraulic Solenoid Valve 24V", sku: "HYD-SV-24V", warehouse: "Main Central Hub", available_stock: 18, reorder_level: 25, required_quantity: 15, stock_status: "Low Stock" },

  { id: 2, product: "Optical Rotary Encoder 1024 PPR", sku: "ENC-OPT", warehouse: "West Coast Depot", available_stock: 0, reorder_level: 15, required_quantity: 20, stock_status: "Out of Stock" },

  { id: 3, product: "Miniature Linear Guide Rail MGN12", sku: "RAIL-MGN12", warehouse: "Main Central Hub", available_stock: 4, reorder_level: 20, required_quantity: 16, stock_status: "Low Stock" },

];



export const DEMO_STOCK_AGEING_REPORT = [

  { id: 1, product: "Industrial Ball Bearing 6205-2RS", sku: "BRG-6205", warehouse: "Main Central Hub", batch_number: "BAT-BRG-2026-01", received_date: "2026-10-18", current_quantity: 600, age_in_days: 16, ageing_bucket: "0–30 days" },

  { id: 2, product: "Timing Belt T10-1200 Steel Cord", sku: "BELT-T10", warehouse: "East Coast Terminal", batch_number: "BAT-BELT-2026-08", received_date: "2026-09-20", current_quantity: 200, age_in_days: 44, ageing_bucket: "31–60 days" },

  { id: 3, product: "Hydraulic Solenoid Valve 24V", sku: "HYD-SV-24V", warehouse: "Main Central Hub", batch_number: "BAT-HYD-2026-03", received_date: "2026-08-15", current_quantity: 18, age_in_days: 80, ageing_bucket: "61–90 days" },

  { id: 4, product: "Compressor Gasket Seal Nitrile", sku: "GSK-NITR-40", warehouse: "West Coast Depot", batch_number: "BAT-GSK-2026-00", received_date: "2026-06-10", current_quantity: 150, age_in_days: 146, ageing_bucket: "90+ days" },

];



export const DEMO_EXPIRY_REPORT = [

  { id: 1, product: "Synthetic Compressor Lubricant ISO VG 46", sku: "LUB-VG46", batch_number: "BAT-LUB-2026-04", warehouse: "Main Central Hub", expiry_date: "2026-11-20", remaining_quantity: 80, days_to_expiry: 17, expiry_status: "Expiring Soon" },

  { id: 2, product: "Silicone Thermal Paste HeatSink 50g", sku: "PST-THRM-50", batch_number: "BAT-PST-2025-11", warehouse: "West Coast Depot", expiry_date: "2026-10-30", remaining_quantity: 25, days_to_expiry: -4, expiry_status: "Expired" },

  { id: 3, product: "Anaerobic Threadlocker Blue 242", sku: "CHEM-LK-242", batch_number: "BAT-CHEM-2026-01", warehouse: "Main Central Hub", expiry_date: "2026-11-28", remaining_quantity: 110, days_to_expiry: 25, expiry_status: "Expiring Soon" },

];



export const DEMO_WAREHOUSE_REPORT = [

  { id: 1, warehouse: "Main Central Hub", total_products: 42, total_stock: 4580, available_stock: 4190, reserved_stock: 350, damaged_stock: 40, stock_value: 124850.00 },

  { id: 2, warehouse: "East Coast Terminal", total_products: 28, total_stock: 1980, available_stock: 1860, reserved_stock: 120, damaged_stock: 0, stock_value: 62400.00 },

  { id: 3, warehouse: "West Coast Depot", total_products: 19, total_stock: 1140, available_stock: 1080, reserved_stock: 60, damaged_stock: 0, stock_value: 38950.00 },

];



export async function fetchStockSummaryReport(params = {}) {

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/reports/stock-summary/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      return data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return DEMO_STOCK_SUMMARY_REPORT;

}



export async function fetchStockMovementReport(params = {}) {

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/reports/stock-movement/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      return data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return DEMO_STOCK_MOVEMENT_REPORT;

}



export async function fetchStockLedgerReport(params = {}) {

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/reports/stock-ledger/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      return data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return DEMO_STOCK_LEDGER_REPORT;

}



export async function fetchStockValuationReport(params = {}) {

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/reports/valuation/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      return data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return DEMO_STOCK_VALUATION_REPORT;

}



export async function fetchLowStockReport(params = {}) {

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/reports/low-stock/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      return data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return DEMO_LOW_STOCK_REPORT;

}



export async function fetchStockAgeingReport(params = {}) {

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/reports/ageing/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      return data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return DEMO_STOCK_AGEING_REPORT;

}



export async function fetchExpiryReport(params = {}) {

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/reports/expiry/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      return data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return DEMO_EXPIRY_REPORT;

}



export async function fetchWarehouseReport(params = {}) {

  try {

    const query = new URLSearchParams(params).toString();

    const res = await fetch(`${API_BASE}/inventory/reports/warehouse/?${query}`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      return data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return DEMO_WAREHOUSE_REPORT;

}





// ---------------------------------------------------------------------------

// Phase 9: Inventory Configuration API

// ---------------------------------------------------------------------------



export const DEFAULT_GLOBAL_CONFIG = {

  // 1. General Settings

  inventory_module_name: "Enterprise Inventory Management",

  base_currency: "USD",

  default_warehouse: null,

  default_uom: "EA",

  enable_multiple_warehouses: true,



  // 2. Stock Settings

  allow_negative_stock: false,

  enable_stock_reservation: true,

  enable_stock_transfer: true,

  require_warehouse_selection: true,

  require_storage_location: true,

  require_bin_selection: false,

  default_low_stock_threshold: 20,



  // 3. Product Tracking Settings

  enable_batch_tracking: true,

  enable_serial_tracking: true,

  enable_expiry_tracking: true,

  enable_barcode_tracking: true,



  // 4. Valuation Settings

  valuation_method: "Weighted Average",

  cost_precision: 2,

  include_additional_costs: false,



  // 6. Approval Settings

  goods_receipt_approval: false,

  stock_issue_approval: true,

  stock_transfer_approval: true,

  stock_adjustment_approval: true,

  stock_return_approval: true,

  stock_reconciliation_approval: true,

  batch_release_approval: true,

};



export const DEFAULT_NUMBERING_RULES = [

  { id: 1, document_type: "Warehouse", prefix: "WH", starting_number: 1, current_number: 1, number_length: 4, reset_frequency: "Never", example_number: "WH-0001" },

  { id: 2, document_type: "Storage Location", prefix: "LOC", starting_number: 1, current_number: 1, number_length: 4, reset_frequency: "Never", example_number: "LOC-0001" },

  { id: 3, document_type: "Rack", prefix: "RACK", starting_number: 1, current_number: 1, number_length: 4, reset_frequency: "Never", example_number: "RACK-0001" },

  { id: 4, document_type: "Bin", prefix: "BIN", starting_number: 1, current_number: 1, number_length: 4, reset_frequency: "Never", example_number: "BIN-0001" },

  { id: 5, document_type: "Goods Receipt", prefix: "GRN", starting_number: 1, current_number: 1, number_length: 5, reset_frequency: "Never", example_number: "GRN-00001" },

  { id: 6, document_type: "Stock Issue", prefix: "ISS", starting_number: 1, current_number: 1, number_length: 5, reset_frequency: "Never", example_number: "ISS-00001" },

  { id: 7, document_type: "Stock Transfer", prefix: "TRF", starting_number: 1, current_number: 1, number_length: 5, reset_frequency: "Never", example_number: "TRF-00001" },

  { id: 8, document_type: "Stock Adjustment", prefix: "ADJ", starting_number: 1, current_number: 1, number_length: 5, reset_frequency: "Never", example_number: "ADJ-00001" },

  { id: 9, document_type: "Stock Return", prefix: "RET", starting_number: 1, current_number: 1, number_length: 5, reset_frequency: "Never", example_number: "RET-00001" },

  { id: 10, document_type: "Stock Reservation", prefix: "RES", starting_number: 1, current_number: 1, number_length: 5, reset_frequency: "Never", example_number: "RES-00001" },

  { id: 11, document_type: "Stock Reconciliation", prefix: "REC", starting_number: 1, current_number: 1, number_length: 5, reset_frequency: "Never", example_number: "REC-00001" },

];



export async function fetchGlobalConfig() {

  try {

    const res = await fetch(`${API_BASE}/inventory/configuration/global/`);

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return getStored("inv_global_config", DEFAULT_GLOBAL_CONFIG);

}



export async function updateGlobalConfig(payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/configuration/global/`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {

    updateApiStatus(false);

  }

  const current = getStored("inv_global_config", DEFAULT_GLOBAL_CONFIG);

  const updated = { ...current, ...payload };

  setStored("inv_global_config", updated);

  return updated;

}



export async function fetchDocumentNumberingRules() {

  try {

    const res = await fetch(`${API_BASE}/inventory/configuration/document-numbering/`);

    if (res.ok) {

      updateApiStatus(true);

      const data = await res.json();

      return data.results || data || [];

    }

  } catch (e) {

    updateApiStatus(false);

  }

  return getStored("inv_numbering_rules", DEFAULT_NUMBERING_RULES);

}



export async function updateDocumentNumberingRule(id, payload) {

  try {

    const res = await fetch(`${API_BASE}/inventory/configuration/document-numbering/${id}/`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload),

    });

    if (res.ok) {

      updateApiStatus(true);

      return await res.json();

    }

  } catch (e) {

    updateApiStatus(false);

  }

  const list = getStored("inv_numbering_rules", DEFAULT_NUMBERING_RULES);

  const updatedList = list.map((item) => (item.id === id || item.document_type === payload.document_type ? { ...item, ...payload } : item));

  setStored("inv_numbering_rules", updatedList);

  return payload;

}



export async function generateDocumentNumber(docType) {

  try {

    const res = await fetch(`${API_BASE}/inventory/configuration/document-numbering/generate-next/?document_type=${encodeURIComponent(docType)}`);

    if (res.ok) {

      const data = await res.json();

      return data.generated_number;

    }

  } catch (e) {}

  const list = getStored("inv_numbering_rules", DEFAULT_NUMBERING_RULES);

  const rule = list.find((r) => r.document_type === docType) || { prefix: "DOC", current_number: 1, number_length: 5 };

  const num = rule.current_number || 1;

  rule.current_number = num + 1;

  setStored("inv_numbering_rules", list);

  return `${rule.prefix}-${String(num).padStart(rule.number_length, "0")}`;

}



export async function fetchConfigAuditLogs() {

  try {

    const res = await fetch(`${API_BASE}/inventory/configuration/audit-log/`);

    if (res.ok) {

      const data = await res.json();

      return data.results || data || [];

    }

  } catch (e) {}

  return [];

}




// ---------------------------------------------------------------------------
// Enterprise Product Master API Extensions
// ---------------------------------------------------------------------------

export async function fetchCategoryTree() {
  try {
    const res = await fetch(`${API_BASE}/inventory/categories/tree/`);
    if (res.ok) {
      updateApiStatus(true);
      return await res.json();
    }
  } catch (e) {
    updateApiStatus(false);
  }
  return [];
}

async function setProductActive(id, active) {
  const action = active ? "activate" : "deactivate";
  const fallback = active
    ? { status: "ACTIVE", is_active: true }
    : { status: "DISCONTINUED", is_active: false };

  let res = null;
  if (isRecordId(id)) {
    try {
      res = await fetch(`${API_BASE}/inventory/items/${id}/${action}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      updateApiStatus(false);
    }
  }

  if (res && !res.ok && res.status !== 404) {
    throw new Error(await readApiError(res, `Failed to ${action} product`));
  }
  if (res && res.ok) {
    updateApiStatus(true);
    await res.json().catch(() => null);
  } else {
    // Offline or local-only product: keep the change on the local copy.
    updateLocalEntity("products", id, fallback);
  }
  return fallback;
}

export async function activateProduct(id) {
  return setProductActive(id, true);
}

export async function deactivateProduct(id) {
  return setProductActive(id, false);
}

export async function barcodeLookupOnline(query) {
  if (!query) return null;
  const clean = encodeURIComponent(String(query).trim());
  const res = await fetch(`${API_BASE}/inventory/items/barcode-lookup/?query=${clean}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Barcode lookup failed.");
  }
  updateApiStatus(true);
  return await res.json();
}

export async function generateProductVariants(itemId, payload) {
  const res = await fetch(`${API_BASE}/inventory/items/${itemId}/generate-variants/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to generate variants.");
  }
  updateApiStatus(true);
  return await res.json();
}

export async function fetchAttributes() {
  try {
    const data = await fetchAllPages(`${API_BASE}/inventory/attributes/`);
    updateApiStatus(true);
    return data;
  } catch (e) {
    updateApiStatus(false);
  }
  return [];
}

export async function createAttribute(payload) {
  const res = await fetch(`${API_BASE}/inventory/attributes/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create attribute.");
  return await res.json();
}

export async function addAttributeValue(attrId, value) {
  const res = await fetch(`${API_BASE}/inventory/attributes/${attrId}/add_value/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error("Failed to add attribute value.");
  return await res.json();
}

export async function fetchProductBarcodes(itemId) {
  try {
    return await fetchAllPages(`${API_BASE}/inventory/product-barcodes/?item=${itemId}`);
  } catch (e) {}
  return [];
}

export async function createProductBarcode(payload) {
  const res = await fetch(`${API_BASE}/inventory/product-barcodes/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.barcode_value?.[0] || err.error || "Failed to save barcode.");
  }
  return await res.json();
}

export async function deleteProductBarcode(id) {
  const res = await fetch(`${API_BASE}/inventory/product-barcodes/${id}/`, {
    method: "DELETE",
  });
  return res.ok;
}

export async function fetchUOMConversions(itemId) {
  try {
    return await fetchAllPages(`${API_BASE}/inventory/product-uom-conversions/?item=${itemId}`);
  } catch (e) {}
  return [];
}

export async function createUOMConversion(payload) {
  const res = await fetch(`${API_BASE}/inventory/product-uom-conversions/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to save UOM conversion.");
  }
  return await res.json();
}

export async function deleteUOMConversion(id) {
  const res = await fetch(`${API_BASE}/inventory/product-uom-conversions/${id}/`, {
    method: "DELETE",
  });
  return res.ok;
}

export function downloadImportTemplate(format = "csv") {
  window.open(`${API_BASE}/inventory/items/import-template/?format=${format}`, "_blank");
}

export async function previewProductImport(formData) {
  const res = await fetch(`${API_BASE}/inventory/items/import-preview/`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Import preview failed.");
  }
  return await res.json();
}

export async function commitProductImport(payloadOrFormData) {
  const isFormData = payloadOrFormData instanceof FormData;
  const options = {
    method: "POST",
    body: isFormData ? payloadOrFormData : JSON.stringify(payloadOrFormData),
  };
  if (!isFormData) {
    options.headers = { "Content-Type": "application/json" };
  }
  const res = await fetch(`${API_BASE}/inventory/items/import-commit/`, options);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Import commit failed.");
  }
  return await res.json();
}

export function exportProductCatalog(params = {}, format = "csv") {
  const q = new URLSearchParams({ ...params, format }).toString();
  window.open(`${API_BASE}/inventory/items/export/?${q}`, "_blank");
}


export async function fetchVariants(params = {}) {
  const q = new URLSearchParams(params).toString();
  const data = await fetchAllPages(`${API_BASE}/inventory/variants/${q ? "?" + q : ""}`);
  return { results: data, count: data.length };
}

export async function toggleVariantActive(id) {
  const res = await fetch(`${API_BASE}/inventory/variants/${id}/toggle_active/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to toggle variant status.");
  return await res.json();
}

export async function fetchImportHistory(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/inventory/import-history/${q ? "?" + q : ""}`);
  if (!res.ok) throw new Error("Failed to fetch import history.");
  return await res.json();
}

export async function fetchImportHistoryDetail(id) {
  const res = await fetch(`${API_BASE}/inventory/import-history/${id}/`);
  if (!res.ok) throw new Error("Failed to fetch import history detail.");
  return await res.json();
}

// ---------------------------------------------------------------------------
// Enterprise Warehouse & Location Management APIs
// ---------------------------------------------------------------------------

export async function fetchWarehouseZones(params = {}) {
  const q = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${API_BASE}/inventory/zones/${q ? "?" + q : ""}`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      return data.results || data;
    }
  } catch (e) {
    updateApiStatus(false);
  }
  return [
    { id: "zn-1", code: "ZN-AMBIENT-01", name: "Ambient Storage Zone", zone_type: "STANDARD", warehouse: 1, warehouse_name: "Central Regional Distribution Center", is_active: true },
    { id: "zn-2", code: "ZN-COLD-01", name: "Cold Storage Room", zone_type: "REFRIGERATED", warehouse: 1, warehouse_name: "Central Regional Distribution Center", is_active: true },
    { id: "zn-3", code: "ZN-HAZ-01", name: "Flammables & Chemicals", zone_type: "HAZMAT", warehouse: 1, warehouse_name: "Central Regional Distribution Center", is_active: true },
    { id: "zn-4", code: "ZN-SEC-01", name: "High-Value Vault", zone_type: "HIGH_SECURITY", warehouse: 1, warehouse_name: "Central Regional Distribution Center", is_active: true },
  ];
}

export async function createWarehouseZone(payload) {
  const res = await fetch(`${API_BASE}/inventory/zones/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return await res.json();
}

export async function updateWarehouseZone(id, payload) {
  const res = await fetch(`${API_BASE}/inventory/zones/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return await res.json();
}

export async function deleteWarehouseZone(id) {
  const res = await fetch(`${API_BASE}/inventory/zones/${id}/`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete zone.");
  }
  return true;
}

export async function fetchWarehouseMappings(params = {}) {
  const q = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${API_BASE}/inventory/warehouse-mappings/${q ? "?" + q : ""}`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      return data.results || data;
    }
  } catch (e) {
    updateApiStatus(false);
  }
  return [
    { id: "map-1", warehouse: 1, warehouse_name: "Central Regional Distribution Center", mapping_type: "USER", entity_id: "usr-101", entity_name: "Sarah Jenkins (Lead Supervisor)", is_default: true, is_receiving_default: true, status: "Active" },
    { id: "map-2", warehouse: 1, warehouse_name: "Central Regional Distribution Center", mapping_type: "PRODUCT", entity_id: "prod-201", entity_name: "High-Performance Structural Steels", is_default: false, is_receiving_default: true, status: "Active" },
    { id: "map-3", warehouse: 1, warehouse_name: "Central Regional Distribution Center", mapping_type: "BUSINESS_UNIT", entity_id: "bu-east", entity_name: "North American Wholesale Operations", is_default: true, is_receiving_default: false, status: "Active" },
  ];
}

export async function createWarehouseMapping(payload) {
  const res = await fetch(`${API_BASE}/inventory/warehouse-mappings/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return await res.json();
}

export async function deleteWarehouseMapping(id) {
  const res = await fetch(`${API_BASE}/inventory/warehouse-mappings/${id}/`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete warehouse mapping.");
  }
  return true;
}

export async function fetchWarehouseCapacity(whId) {
  try {
    const res = await fetch(`${API_BASE}/inventory/warehouses/${whId}/capacity/`);
    if (res.ok) {
      updateApiStatus(true);
      return await res.json();
    }
  } catch (e) {
    updateApiStatus(false);
  }
  return {
    warehouse_id: whId,
    warehouse_code: "WH-DEMO",
    warehouse_name: "Regional Warehouse Facility",
    total_units_on_hand: 1420.0,
    weight: { used_kg: 18450.0, max_kg: 50000.0, available_kg: 31550.0, utilization_pct: 36.9 },
    volume: { used_m3: 385.5, max_m3: 1200.0, available_m3: 814.5, utilization_pct: 32.1 },
    pallet_positions: { occupied: 148, total: 400, available: 252, utilization_pct: 37.0 },
    capacity_status: "OPTIMAL",
  };
}

export async function fetchLocationUtilization(whId) {
  try {
    const res = await fetch(`${API_BASE}/inventory/warehouses/${whId}/location_utilization/`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      return Array.isArray(data) ? data : data.results || [];
    }
  } catch (e) {
    updateApiStatus(false);
  }
  return [
    { location_id: 1, code: "LOC-REC-01", name: "Inbound Receiving Dock A", location_type: "RECEIVING", status: "Active", sku_count: 4, total_quantity: 120, weight_used: 1250.0, weight_max: 5000.0, weight_pct: 25.0, volume_used: 12.5, volume_max: 50.0, volume_pct: 25.0, allow_receiving: true, allow_picking: false, allow_putaway: false },
    { location_id: 2, code: "LOC-BULK-01", name: "High-Bay Bulk Storage Bay 1", location_type: "STORAGE", status: "Active", sku_count: 18, total_quantity: 840, weight_used: 8400.0, weight_max: 15000.0, weight_pct: 56.0, volume_used: 180.0, volume_max: 300.0, volume_pct: 60.0, allow_receiving: false, allow_picking: true, allow_putaway: true },
    { location_id: 3, code: "LOC-PICK-01", name: "Fast-Mover Forward Pick Shelf A", location_type: "PICKING", status: "Active", sku_count: 24, total_quantity: 460, weight_used: 920.0, weight_max: 2000.0, weight_pct: 46.0, volume_used: 28.0, volume_max: 60.0, volume_pct: 46.7, allow_receiving: false, allow_picking: true, allow_putaway: true },
  ];
}

export async function fetchWarehouseOperationalConfig(whId) {
  try {
    const res = await fetch(`${API_BASE}/inventory/warehouse-operational-config/?warehouse=${whId}`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      const list = data.results || data;
      if (list && list.length > 0) return list[0];
    }
  } catch (e) {
    updateApiStatus(false);
  }
  return {
    warehouse: whId,
    receiving_strategy: "PO_DIRECT",
    putaway_strategy: "FIXED_LOCATION",
    picking_strategy: "FIFO",
    dispatch_strategy: "WAVE",
    returns_routing: "INSPECTION_FIRST",
    capacity_enforcement: "SOFT_WARNING",
    allow_cross_docking: false,
    auto_generate_bins: false,
  };
}

export async function updateWarehouseOperationalConfig(whId, payload) {
  // Try finding existing config
  let existingId = payload.id;
  if (!existingId) {
    const current = await fetchWarehouseOperationalConfig(whId);
    if (current && current.id) existingId = current.id;
  }
  const method = existingId ? "PATCH" : "POST";
  const url = existingId
    ? `${API_BASE}/inventory/warehouse-operational-config/${existingId}/`
    : `${API_BASE}/inventory/warehouse-operational-config/`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, warehouse: whId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return await res.json();
}

export async function lookupBinBarcode(code) {
  const res = await fetch(`${API_BASE}/inventory/bins/lookup/?code=${encodeURIComponent(code)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Bin not found.");
  }
  return await res.json();
}

export async function activateWarehouse(id) {
  const res = await fetch(`${API_BASE}/inventory/warehouses/${id}/activate/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to activate warehouse.");
  return await res.json();
}

export async function deactivateWarehouse(id) {
  const res = await fetch(`${API_BASE}/inventory/warehouses/${id}/deactivate/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to deactivate warehouse.");
  return await res.json();
}


// ---------------------------------------------------------------------------
// Stock Operations Configuration API (Independently Scoped Submodule Settings)
// ---------------------------------------------------------------------------

export async function fetchStockOperationsSettings(submodule = "") {
  try {
    const url = submodule
      ? `${API_BASE}/inventory/operations/settings/${submodule}/`
      : `${API_BASE}/inventory/operations/settings/`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch stock operations settings.");
    return await res.json();
  } catch (e) {
    console.error("fetchStockOperationsSettings error:", e);
    return {};
  }
}

export async function updateStockOperationsSettings(submodule, settings, changeReason = "") {
  const res = await fetch(`${API_BASE}/inventory/operations/settings/${submodule}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings, change_reason: changeReason }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to update settings.");
  }
  return await res.json();
}

export async function resetStockOperationsSettings(submodule) {
  const res = await fetch(`${API_BASE}/inventory/operations/settings/${submodule}/reset/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to reset settings.");
  return await res.json();
}

export async function fetchStockOperationsSettingsHistory(submodule) {
  const res = await fetch(`${API_BASE}/inventory/operations/settings/${submodule}/history/`);
  if (!res.ok) throw new Error("Failed to fetch settings history.");
  return await res.json();
}

// ===========================================================================
// GOODS RECEIPT & INSPECTION DEMO DATA & CLIENT SERVICE LAYER
// ===========================================================================

export const DEMO_GRN_CONTEXT = {
  username: "admin",
  roles: ["platform.admin", "inventory.admin"],
  permissions: [
    "inventory.grn.view",
    "inventory.grn.create",
    "inventory.grn.edit",
    "inventory.grn.delete",
    "inventory.grn.submit",
    "inventory.grn.cancel",
    "inventory.grn.inspect",
    "inventory.grn.inspect_quality",
    "inventory.grn.putaway",
    "inventory.grn.post",
    "inventory.grn.reverse",
    "inventory.grn.discrepancy",
    "inventory.grn.configure",
  ],
  settings: {
    register: { enabled: true, required_permission: "inventory.grn.view", page_size: 25 },
    create: {
      enabled: true,
      required_permission: "inventory.grn.create",
      receipt_types: [
        { code: "PURCHASE", label: "Purchase Receipt" },
        { code: "TRANSFER", label: "Transfer Receipt" },
        { code: "RETURN", label: "Customer Return" },
        { code: "PRODUCTION", label: "Production Receipt" },
      ],
      default_receipt_type: "PURCHASE",
      require_supplier: true,
      require_po_for_purchase: false,
      allow_manual_number: false,
    },
    inspection: { enabled: true, required_permission: "inventory.grn.inspect", inspection_mode: "OPTIONAL", quality_lead_role: "qa.inspector" },
    quality: { enabled: true, required_permission: "inventory.grn.inspect_quality", auto_assign: true },
    accepted: { enabled: true, required_permission: "inventory.grn.view", default_sort: "-transaction_date" },
    rejected: { enabled: true, required_permission: "inventory.grn.view", require_rejection_reason: true },
    partial: { enabled: true, required_permission: "inventory.grn.view" },
    putaway: { enabled: true, required_permission: "inventory.grn.putaway", allow_partial_putaway: true },
    discrepancy: { enabled: true, required_permission: "inventory.grn.discrepancy" },
    history: { enabled: true, required_permission: "inventory.grn.view", page_size: 25 },
  },
};

export const DEMO_RECEIPTS = [
  {
    id: 1,
    document_number: "GRN-2026-0001",
    receipt_type: "PURCHASE",
    receipt_type_label: "Purchase Receipt",
    transaction_date: "2026-11-04",
    status: "DRAFT",
    status_label: "Draft",
    external_reference: "",
    supplier: "Acme Industrial Fasteners",
    supplier_reference: "DN-ACME-4091",
    purchase_order_reference: "PO-2026-0850",
    warehouse: 2,
    warehouse_code: "WH-MAIN",
    warehouse_name: "Main Central Fulfillment Hub",
    receiving_location: 3,
    receiving_location_code: "REC-01",
    receiving_location_name: "Receiving Dock 1",
    expected_date: "2026-11-06",
    received_by: "Marcus Vance",
    remarks: "Express shipment of replacement timing belts. Inspected outer boxes upon carrier unloading.",
    inspection_required: false,
    reason: "",
    created_by: "Marcus Vance",
    created_at: "2026-11-04T10:14:00Z",
    submitted_by: "",
    submitted_at: null,
    approved_by: "",
    approved_at: null,
    posted_by: "",
    posted_at: null,
    updated_at: "2026-11-04T10:14:00Z",
    totals: { lines: 1, received: "50.0000", accepted: "0.0000", rejected: "0.0000", pending: "0.0000", putaway: "0.0000" },
    putaway_progress: "NOT_APPLICABLE",
    posted: false,
    reversal_document: "",
    available_actions: ["edit", "delete", "submit", "cancel"],
    lines: [
      {
        id: 101,
        receipt_id: 1,
        receipt_number: "GRN-2026-0001",
        receipt_status: "DRAFT",
        receipt_date: "2026-11-04",
        warehouse: 2,
        warehouse_code: "WH-MAIN",
        supplier: "Acme Industrial Fasteners",
        item: 3,
        item_code: "BELT-T10-1200",
        item_name: "Polyurethane Timing Belt T10-1200",
        variant: null,
        variant_sku: "",
        variant_name: "",
        sku: "BELT-T10-1200",
        barcode: "8901234000034",
        description: "Standard industrial polyurethane timing belt",
        uom: "EA",
        conversion_factor_at_txn: "1.0000",
        quantity_base_uom: "50.0000",
        expected_quantity: "50.0000",
        received_quantity: "50.0000",
        accepted_quantity: "0.0000",
        rejected_quantity: "0.0000",
        pending_inspection_quantity: "0.0000",
        inspection_status: "NOT_REQUIRED",
        rejection_reason: "",
        inspection_remarks: "",
        inspected_by: "",
        inspected_at: null,
        putaway_quantity: "0.0000",
        pending_putaway_quantity: "0.0000",
        putaway_status: "PENDING",
        putaway_location: null,
        putaway_location_code: "",
        location: 3,
        location_code: "REC-01",
        unit_cost: "32.4000",
        line_value: "1620.00",
        batch_number: "LOT-2026-BELT-04",
        serial_numbers: [],
        rejected_serial_numbers: [],
        manufacturing_date: "2026-09-15",
        expiry_date: "2028-09-15",
        tracking: "BATCH",
      },
    ],
  },
  {
    id: 2,
    document_number: "GRN-2026-0002",
    receipt_type: "PURCHASE",
    receipt_type_label: "Purchase Receipt",
    transaction_date: "2026-11-03",
    status: "SUBMITTED",
    status_label: "Submitted",
    external_reference: "",
    supplier: "Bosch Rexroth Corp",
    supplier_reference: "DN-REX-7721",
    purchase_order_reference: "PO-2026-0842",
    warehouse: 2,
    warehouse_code: "WH-MAIN",
    warehouse_name: "Main Central Fulfillment Hub",
    receiving_location: 3,
    receiving_location_code: "REC-01",
    receiving_location_name: "Receiving Dock 1",
    expected_date: "2026-11-03",
    received_by: "Elena Rostova",
    remarks: "Hydraulic solenoid valves received at receiving dock. Staged for technical serialization inspection.",
    inspection_required: true,
    reason: "",
    created_by: "Elena Rostova",
    created_at: "2026-11-03T14:10:00Z",
    submitted_by: "Elena Rostova",
    submitted_at: "2026-11-03T14:25:00Z",
    approved_by: "",
    approved_at: null,
    posted_by: "",
    posted_at: null,
    updated_at: "2026-11-03T14:25:00Z",
    totals: { lines: 1, received: "10.0000", accepted: "0.0000", rejected: "0.0000", pending: "10.0000", putaway: "0.0000" },
    putaway_progress: "NOT_APPLICABLE",
    posted: false,
    reversal_document: "",
    available_actions: ["return_to_draft", "cancel", "inspect", "quality", "putaway", "post", "discrepancy"],
    lines: [
      {
        id: 102,
        receipt_id: 2,
        receipt_number: "GRN-2026-0002",
        receipt_status: "SUBMITTED",
        receipt_date: "2026-11-03",
        warehouse: 2,
        warehouse_code: "WH-MAIN",
        supplier: "Bosch Rexroth Corp",
        item: 2,
        item_code: "HYD-SV-24V",
        item_name: "Hydraulic Solenoid Valve 24V DC",
        variant: null,
        variant_sku: "",
        variant_name: "",
        sku: "HYD-SV-24V",
        barcode: "8901234000027",
        description: "Heavy duty hydraulic directional solenoid valve",
        uom: "EA",
        conversion_factor_at_txn: "1.0000",
        quantity_base_uom: "10.0000",
        expected_quantity: "10.0000",
        received_quantity: "10.0000",
        accepted_quantity: "0.0000",
        rejected_quantity: "0.0000",
        pending_inspection_quantity: "10.0000",
        inspection_status: "PENDING",
        rejection_reason: "",
        inspection_remarks: "",
        inspected_by: "",
        inspected_at: null,
        putaway_quantity: "0.0000",
        pending_putaway_quantity: "0.0000",
        putaway_status: "PENDING",
        putaway_location: null,
        putaway_location_code: "",
        location: 3,
        location_code: "REC-01",
        unit_cost: "128.5000",
        line_value: "1285.00",
        batch_number: "",
        serial_numbers: ["SN-HYD-9001", "SN-HYD-9002", "SN-HYD-9003", "SN-HYD-9004", "SN-HYD-9005", "SN-HYD-9006", "SN-HYD-9007", "SN-HYD-9008", "SN-HYD-9009", "SN-HYD-9010"],
        rejected_serial_numbers: [],
        manufacturing_date: "2026-10-01",
        expiry_date: null,
        tracking: "SERIAL",
      },
    ],
  },
  {
    id: 3,
    document_number: "GRN-2026-0003",
    receipt_type: "PURCHASE",
    receipt_type_label: "Purchase Receipt",
    transaction_date: "2026-11-02",
    status: "PARTIALLY_ACCEPTED",
    status_label: "Partially Accepted",
    external_reference: "",
    supplier: "SKF Precision Bearings Ltd",
    supplier_reference: "DN-SKF-8812",
    purchase_order_reference: "PO-2026-0799",
    warehouse: 2,
    warehouse_code: "WH-MAIN",
    warehouse_name: "Main Central Fulfillment Hub",
    receiving_location: 3,
    receiving_location_code: "REC-01",
    receiving_location_name: "Receiving Dock 1",
    expected_date: "2026-11-02",
    received_by: "David Kim",
    remarks: "100 units received. 15 units rejected due to carton drop damage. 85 units approved for putaway.",
    inspection_required: true,
    reason: "",
    created_by: "David Kim",
    created_at: "2026-11-02T09:00:00Z",
    submitted_by: "David Kim",
    submitted_at: "2026-11-02T09:15:00Z",
    approved_by: "",
    approved_at: null,
    posted_by: "",
    posted_at: null,
    updated_at: "2026-11-02T11:30:00Z",
    totals: { lines: 1, received: "100.0000", accepted: "85.0000", rejected: "15.0000", pending: "0.0000", putaway: "0.0000" },
    putaway_progress: "PENDING",
    posted: false,
    reversal_document: "",
    available_actions: ["putaway", "post", "discrepancy"],
    lines: [
      {
        id: 103,
        receipt_id: 3,
        receipt_number: "GRN-2026-0003",
        receipt_status: "PARTIALLY_ACCEPTED",
        receipt_date: "2026-11-02",
        warehouse: 2,
        warehouse_code: "WH-MAIN",
        supplier: "SKF Precision Bearings Ltd",
        item: 1,
        item_code: "BRG-6205-2RS",
        item_name: "Industrial Ball Bearing 6205-2RS",
        variant: null,
        variant_sku: "",
        variant_name: "",
        sku: "BRG-6205-2RS",
        barcode: "8901234000010",
        description: "Deep groove ball bearing with dual rubber seals",
        uom: "EA",
        conversion_factor_at_txn: "1.0000",
        quantity_base_uom: "100.0000",
        expected_quantity: "100.0000",
        received_quantity: "100.0000",
        accepted_quantity: "85.0000",
        rejected_quantity: "15.0000",
        pending_inspection_quantity: "0.0000",
        inspection_status: "PARTIAL",
        rejection_reason: "Damaged packaging / moisture ingress",
        inspection_remarks: "15 bearings rejected; quarantine cage bin QC-01 allocated.",
        inspected_by: "David Kim",
        inspected_at: "2026-11-02T11:20:00Z",
        putaway_quantity: "0.0000",
        pending_putaway_quantity: "85.0000",
        putaway_status: "PENDING",
        putaway_location: null,
        putaway_location_code: "",
        location: 3,
        location_code: "REC-01",
        unit_cost: "14.8500",
        line_value: "1485.00",
        batch_number: "LOT-2026-BRG-88",
        serial_numbers: [],
        rejected_serial_numbers: [],
        manufacturing_date: "2026-08-10",
        expiry_date: null,
        tracking: "BATCH",
      },
    ],
  },
  {
    id: 4,
    document_number: "GRN-2026-0004",
    receipt_type: "PURCHASE",
    receipt_type_label: "Purchase Receipt",
    transaction_date: "2026-11-01",
    status: "PUTAWAY_PENDING",
    status_label: "Putaway Pending",
    external_reference: "",
    supplier: "Mobil Rarus Lubricants",
    supplier_reference: "DN-MOB-5501",
    purchase_order_reference: "PO-2026-0760",
    warehouse: 2,
    warehouse_code: "WH-MAIN",
    warehouse_name: "Main Central Fulfillment Hub",
    receiving_location: 3,
    receiving_location_code: "REC-01",
    receiving_location_name: "Receiving Dock 1",
    expected_date: "2026-11-01",
    received_by: "Sarah Jenkins",
    remarks: "Bulk synthetic compressor oil delivery. Storing drums into chemical storage bay.",
    inspection_required: false,
    reason: "",
    created_by: "Sarah Jenkins",
    created_at: "2026-11-01T08:30:00Z",
    submitted_by: "Sarah Jenkins",
    submitted_at: "2026-11-01T08:45:00Z",
    approved_by: "",
    approved_at: null,
    posted_by: "",
    posted_at: null,
    updated_at: "2026-11-01T10:15:00Z",
    totals: { lines: 1, received: "200.0000", accepted: "200.0000", rejected: "0.0000", pending: "0.0000", putaway: "120.0000" },
    putaway_progress: "PARTIAL",
    posted: false,
    reversal_document: "",
    available_actions: ["putaway", "post", "discrepancy"],
    lines: [
      {
        id: 104,
        receipt_id: 4,
        receipt_number: "GRN-2026-0004",
        receipt_status: "PUTAWAY_PENDING",
        receipt_date: "2026-11-01",
        warehouse: 2,
        warehouse_code: "WH-MAIN",
        supplier: "Mobil Rarus Lubricants",
        item: 4,
        item_code: "LUB-SYN-VG46",
        item_name: "Synthetic Compressor Lubricant ISO VG 46",
        variant: null,
        variant_sku: "",
        variant_name: "",
        sku: "LUB-SYN-VG46",
        barcode: "8901234000041",
        description: "Premium synthetic air compressor lubricant oil",
        uom: "LTR",
        conversion_factor_at_txn: "1.0000",
        quantity_base_uom: "200.0000",
        expected_quantity: "200.0000",
        received_quantity: "200.0000",
        accepted_quantity: "200.0000",
        rejected_quantity: "0.0000",
        pending_inspection_quantity: "0.0000",
        inspection_status: "PASSED",
        rejection_reason: "",
        inspection_remarks: "",
        inspected_by: "Sarah Jenkins",
        inspected_at: "2026-11-01T09:00:00Z",
        putaway_quantity: "120.0000",
        pending_putaway_quantity: "80.0000",
        putaway_status: "PARTIAL",
        putaway_location: 6,
        putaway_location_code: "VAULT-CHEM",
        location: 3,
        location_code: "REC-01",
        unit_cost: "18.2000",
        line_value: "3640.00",
        batch_number: "LOT-2026-LUB-55",
        serial_numbers: [],
        rejected_serial_numbers: [],
        manufacturing_date: "2026-09-01",
        expiry_date: "2028-09-01",
        tracking: "BATCH",
      },
    ],
  },
  {
    id: 5,
    document_number: "GRN-2026-0005",
    receipt_type: "PURCHASE",
    receipt_type_label: "Purchase Receipt",
    transaction_date: "2026-11-02",
    status: "READY_TO_POST",
    status_label: "Ready to Post",
    external_reference: "",
    supplier: "Gates Industrial Power",
    supplier_reference: "DN-GAT-9011",
    purchase_order_reference: "PO-2026-0810",
    warehouse: 2,
    warehouse_code: "WH-MAIN",
    warehouse_name: "Main Central Fulfillment Hub",
    receiving_location: 3,
    receiving_location_code: "REC-01",
    receiving_location_name: "Receiving Dock 1",
    expected_date: "2026-11-02",
    received_by: "Marcus Vance",
    remarks: "Urgent belts for production assembly. Fully inspected and placed into forward picking shelf.",
    inspection_required: true,
    reason: "",
    created_by: "Marcus Vance",
    created_at: "2026-11-02T13:00:00Z",
    submitted_by: "Marcus Vance",
    submitted_at: "2026-11-02T13:10:00Z",
    approved_by: "",
    approved_at: null,
    posted_by: "",
    posted_at: null,
    updated_at: "2026-11-02T15:00:00Z",
    totals: { lines: 1, received: "60.0000", accepted: "60.0000", rejected: "0.0000", pending: "0.0000", putaway: "60.0000" },
    putaway_progress: "COMPLETED",
    posted: false,
    reversal_document: "",
    available_actions: ["putaway", "post", "discrepancy"],
    lines: [
      {
        id: 105,
        receipt_id: 5,
        receipt_number: "GRN-2026-0005",
        receipt_status: "READY_TO_POST",
        receipt_date: "2026-11-02",
        warehouse: 2,
        warehouse_code: "WH-MAIN",
        supplier: "Gates Industrial Power",
        item: 3,
        item_code: "BELT-T10-1200",
        item_name: "Polyurethane Timing Belt T10-1200",
        variant: null,
        variant_sku: "",
        variant_name: "",
        sku: "BELT-T10-1200",
        barcode: "8901234000034",
        description: "Standard industrial polyurethane timing belt",
        uom: "EA",
        conversion_factor_at_txn: "1.0000",
        quantity_base_uom: "60.0000",
        expected_quantity: "60.0000",
        received_quantity: "60.0000",
        accepted_quantity: "60.0000",
        rejected_quantity: "0.0000",
        pending_inspection_quantity: "0.0000",
        inspection_status: "PASSED",
        rejection_reason: "",
        inspection_remarks: "All 60 units verified and tensile tested.",
        inspected_by: "Marcus Vance",
        inspected_at: "2026-11-02T14:15:00Z",
        putaway_quantity: "60.0000",
        pending_putaway_quantity: "0.0000",
        putaway_status: "COMPLETED",
        putaway_location: 5,
        putaway_location_code: "STG-01",
        location: 3,
        location_code: "REC-01",
        unit_cost: "32.4000",
        line_value: "1944.00",
        batch_number: "LOT-2026-GAT-90",
        serial_numbers: [],
        rejected_serial_numbers: [],
        manufacturing_date: "2026-10-12",
        expiry_date: "2028-10-12",
        tracking: "BATCH",
      },
    ],
  },
  {
    id: 6,
    document_number: "GRN-2026-0006",
    receipt_type: "PURCHASE",
    receipt_type_label: "Purchase Receipt",
    transaction_date: "2026-10-30",
    status: "POSTED",
    status_label: "Posted",
    external_reference: "",
    supplier: "Omron Automation Global",
    supplier_reference: "DN-OMR-3320",
    purchase_order_reference: "PO-2026-0705",
    warehouse: 2,
    warehouse_code: "WH-MAIN",
    warehouse_name: "Main Central Fulfillment Hub",
    receiving_location: 3,
    receiving_location_code: "REC-01",
    receiving_location_name: "Receiving Dock 1",
    expected_date: "2026-10-30",
    received_by: "Elena Rostova",
    remarks: "High-precision rotary encoders. Posted to active stock ledger.",
    inspection_required: false,
    reason: "",
    created_by: "Elena Rostova",
    created_at: "2026-10-30T11:00:00Z",
    submitted_by: "Elena Rostova",
    submitted_at: "2026-10-30T11:15:00Z",
    approved_by: "Alex Morgan",
    approved_at: "2026-10-30T11:30:00Z",
    posted_by: "Elena Rostova",
    posted_at: "2026-10-30T11:45:00Z",
    updated_at: "2026-10-30T11:45:00Z",
    totals: { lines: 1, received: "5.0000", accepted: "5.0000", rejected: "0.0000", pending: "0.0000", putaway: "5.0000" },
    putaway_progress: "COMPLETED",
    posted: true,
    reversal_document: "",
    available_actions: ["reverse", "discrepancy"],
    lines: [
      {
        id: 106,
        receipt_id: 6,
        receipt_number: "GRN-2026-0006",
        receipt_status: "POSTED",
        receipt_date: "2026-10-30",
        warehouse: 2,
        warehouse_code: "WH-MAIN",
        supplier: "Omron Automation Global",
        item: 5,
        item_code: "ENC-OPT-1024",
        item_name: "Optical Rotary Encoder 1024 PPR",
        variant: null,
        variant_sku: "",
        variant_name: "",
        sku: "ENC-OPT-1024",
        barcode: "8901234000058",
        description: "Industrial optical incremental encoder",
        uom: "EA",
        conversion_factor_at_txn: "1.0000",
        quantity_base_uom: "5.0000",
        expected_quantity: "5.0000",
        received_quantity: "5.0000",
        accepted_quantity: "5.0000",
        rejected_quantity: "0.0000",
        pending_inspection_quantity: "0.0000",
        inspection_status: "PASSED",
        rejection_reason: "",
        inspection_remarks: "",
        inspected_by: "Elena Rostova",
        inspected_at: "2026-10-30T11:10:00Z",
        putaway_quantity: "5.0000",
        pending_putaway_quantity: "0.0000",
        putaway_status: "COMPLETED",
        putaway_location: 5,
        putaway_location_code: "STG-01",
        location: 3,
        location_code: "REC-01",
        unit_cost: "215.0000",
        line_value: "1075.00",
        batch_number: "",
        serial_numbers: ["ENC-2026-001", "ENC-2026-002", "ENC-2026-003", "ENC-2026-004", "ENC-2026-005"],
        rejected_serial_numbers: [],
        manufacturing_date: "2026-10-01",
        expiry_date: null,
        tracking: "SERIAL",
      },
    ],
  },
];

export const DEMO_INSPECTIONS = [
  {
    id: 1,
    receipt: 3,
    receipt_number: "GRN-2026-0003",
    receipt_status: "PARTIALLY_ACCEPTED",
    line: 103,
    item: 1,
    item_code: "BRG-6205-2RS",
    item_name: "Industrial Ball Bearing 6205-2RS",
    received_quantity: "100.0000",
    accepted_quantity: "85.0000",
    rejected_quantity: "15.0000",
    status: "PARTIAL",
    rejection_reason: "Damaged packaging / moisture ingress",
    rejection_disposition: "RETURN_TO_VENDOR",
    remarks: "15 bearings rejected; quarantine cage bin QC-01 allocated.",
    inspector: "David Kim",
    inspected_at: "2026-11-02T11:20:00Z",
  },
  {
    id: 2,
    receipt: 5,
    receipt_number: "GRN-2026-0005",
    receipt_status: "READY_TO_POST",
    line: 105,
    item: 3,
    item_code: "BELT-T10-1200",
    item_name: "Polyurethane Timing Belt T10-1200",
    received_quantity: "60.0000",
    accepted_quantity: "60.0000",
    rejected_quantity: "0.0000",
    status: "PASSED",
    rejection_reason: "",
    rejection_disposition: "",
    remarks: "All 60 units verified and tensile tested.",
    inspector: "Marcus Vance",
    inspected_at: "2026-11-02T14:15:00Z",
  },
];

export const DEMO_PUTAWAYS = [
  {
    id: 1,
    receipt: 4,
    receipt_number: "GRN-2026-0004",
    line: 104,
    item: 4,
    item_code: "LUB-SYN-VG46",
    item_name: "Synthetic Compressor Lubricant ISO VG 46",
    quantity: "120.0000",
    location: 6,
    location_code: "VAULT-CHEM",
    location_name: "Chemical Vault Bay 1",
    status: "COMPLETED",
    putaway_by: "Sarah Jenkins",
    putaway_at: "2026-11-01T10:00:00Z",
    remarks: "Drums loaded via forklift into chemical containment zone.",
  },
  {
    id: 2,
    receipt: 5,
    receipt_number: "GRN-2026-0005",
    line: 105,
    item: 3,
    item_code: "BELT-T10-1200",
    item_name: "Polyurethane Timing Belt T10-1200",
    quantity: "60.0000",
    location: 5,
    location_code: "STG-01",
    location_name: "Primary Storage Aisle 1",
    status: "COMPLETED",
    putaway_by: "Marcus Vance",
    putaway_at: "2026-11-02T14:50:00Z",
    remarks: "Placed onto shelf Bin A-12.",
  },
  {
    id: 3,
    receipt: 6,
    receipt_number: "GRN-2026-0006",
    line: 106,
    item: 5,
    item_code: "ENC-OPT-1024",
    item_name: "Optical Rotary Encoder 1024 PPR",
    quantity: "5.0000",
    location: 5,
    location_code: "STG-01",
    location_name: "Primary Storage Aisle 1",
    status: "COMPLETED",
    putaway_by: "Elena Rostova",
    putaway_at: "2026-10-30T11:40:00Z",
    remarks: "High-value secure bin placement.",
  },
];

export const DEMO_DISCREPANCIES = [
  {
    id: 1,
    receipt: 3,
    receipt_number: "GRN-2026-0003",
    line: 103,
    item: 1,
    item_code: "BRG-6205-2RS",
    item_name: "Industrial Ball Bearing 6205-2RS",
    discrepancy_type: "DAMAGE",
    expected_quantity: "100.0000",
    actual_quantity: "85.0000",
    discrepancy_quantity: "15.0000",
    resolution_action: "RETURN_TO_VENDOR",
    status: "OPEN",
    remarks: "Water damage noted on bottom layer carton.",
    reported_by: "David Kim",
    created_at: "2026-11-02T11:25:00Z",
  },
];

// Helper to filter demo receipts in offline/fallback mode
export function filterDemoReceipts(receipts, params = {}) {
  let list = [...receipts];
  if (params.search) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(
      (r) =>
        (r.document_number && r.document_number.toLowerCase().includes(q)) ||
        (r.supplier && r.supplier.toLowerCase().includes(q)) ||
        (r.purchase_order_reference && r.purchase_order_reference.toLowerCase().includes(q)) ||
        (r.external_reference && r.external_reference.toLowerCase().includes(q)) ||
        (r.lines && r.lines.some((l) => (l.item_name && l.item_name.toLowerCase().includes(q)) || (l.item_code && l.item_code.toLowerCase().includes(q))))
    );
  }
  if (params.status && params.status !== "ALL") {
    list = list.filter((r) => r.status === params.status);
  }
  if (params.receipt_type && params.receipt_type !== "ALL") {
    list = list.filter((r) => r.receipt_type === params.receipt_type);
  }
  if (params.warehouse && params.warehouse !== "ALL") {
    list = list.filter((r) => String(r.warehouse) === String(params.warehouse) || r.warehouse_code === params.warehouse);
  }
  if (params.posted === "true") {
    list = list.filter((r) => r.posted === true || r.status === "POSTED" || r.status === "REVERSED");
  } else if (params.posted === "false") {
    list = list.filter((r) => !r.posted && r.status !== "POSTED" && r.status !== "REVERSED");
  }
  if (params.putaway) {
    list = list.filter((r) => r.putaway_progress === params.putaway);
  }
  if (params.date_from) {
    list = list.filter((r) => r.transaction_date >= params.date_from);
  }
  if (params.date_to) {
    list = list.filter((r) => r.transaction_date <= params.date_to);
  }
  if (params.view === "history") {
    const historyStatuses = ["POSTED", "REVERSED", "REJECTED", "CANCELLED"];
    list = list.filter((r) => historyStatuses.includes(r.status));
  }
  return list;
}

// Full Goods Receipt Client Implementation with Backend-First + Fallback
export async function fetchReceipts(params = {}) {
  try {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") query.set(k, v);
    });
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/receipts/?${query.toString()}`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      if (data && (data.count > 0 || (Array.isArray(data.results) && data.results.length > 0))) {
        return data;
      }
    }
  } catch (e) {
    updateApiStatus(false);
  }

  // Fallback to local stored + demo receipts
  const local = getLocalEntities("goods_receipts");
  const pool = [...local, ...DEMO_RECEIPTS];
  const seen = new Set();
  const deduped = [];
  for (const r of pool) {
    const key = (r.document_number || String(r.id)).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }

  const filtered = filterDemoReceipts(deduped, params);
  const page = Number(params.page || 1);
  const pageSize = Number(params.page_size || 25);
  const offset = (page - 1) * pageSize;
  const paginated = filtered.slice(offset, offset + pageSize);

  return {
    count: filtered.length,
    next: offset + pageSize < filtered.length ? `?page=${page + 1}` : null,
    previous: page > 1 ? `?page=${page - 1}` : null,
    results: paginated,
  };
}

export async function fetchReceipt(id) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/receipts/${id}/`);
    if (res.ok) {
      updateApiStatus(true);
      return await res.json();
    }
  } catch (e) {
    updateApiStatus(false);
  }
  const local = getLocalEntities("goods_receipts");
  const all = [...local, ...DEMO_RECEIPTS];
  const found = all.find((r) => String(r.id) === String(id) || r.document_number === id);
  if (found) return found;
  throw new Error(`Receipt #${id} not found.`);
}

export async function fetchReceiptTimeline(id) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/receipts/${id}/timeline/`);
    if (res.ok) return await res.json();
  } catch (e) {}
  return [
    { title: "Receipt Created", actor: "Marcus Vance", timestamp: "2026-11-04T10:14:00Z", note: "Initial document created in Draft" },
    { title: "Submitted for Processing", actor: "Elena Rostova", timestamp: "2026-11-04T10:30:00Z", note: "Vendor delivery confirmed" },
  ];
}

export async function createReceipt(payload, idempotencyKey) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/receipts/`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      updateApiStatus(true);
      return await res.json();
    }
  } catch (e) {
    updateApiStatus(false);
  }
  const newId = Date.now();
  const docNum = payload.document_number || `GRN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const created = {
    ...payload,
    id: newId,
    document_number: docNum,
    status: "DRAFT",
    status_label: "Draft",
    created_at: new Date().toISOString(),
    totals: { lines: (payload.lines || []).length, received: String((payload.lines || []).reduce((s, l) => s + Number(l.received_quantity || 0), 0)), accepted: "0.0000", rejected: "0.0000", pending: "0.0000", putaway: "0.0000" },
    putaway_progress: "NOT_APPLICABLE",
    posted: false,
    available_actions: ["edit", "delete", "submit", "cancel"],
  };
  saveLocalEntity("goods_receipts", created);
  return created;
}

export async function updateReceipt(id, payload) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/receipts/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  updateLocalEntity("goods_receipts", id, payload);
  return { id, ...payload };
}

export async function deleteReceipt(id) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/receipts/${id}/`, { method: "DELETE" });
    if (res.ok) return true;
  } catch (e) {}
  deleteLocalEntity("goods_receipts", id);
  return true;
}

export async function receiptAction(id, action, body = {}) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/receipts/${id}/${action.replace(/_/g, "-")}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { success: true, message: `Action ${action} executed.` };
}

export async function fetchReceiptLines(outcome, params = {}) {
  try {
    const query = new URLSearchParams({ outcome, ...params }).toString();
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/lines/?${query}`);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.count > 0 || (Array.isArray(data.results) && data.results.length > 0))) return data;
    }
  } catch (e) {}

  const allLines = DEMO_RECEIPTS.flatMap((r) => r.lines || []);
  let filtered = [...allLines];
  if (outcome === "accepted") {
    filtered = filtered.filter((l) => Number(l.accepted_quantity) > 0);
  } else if (outcome === "rejected") {
    filtered = filtered.filter((l) => Number(l.rejected_quantity) > 0);
  } else if (outcome === "partial") {
    filtered = filtered.filter((l) => Number(l.accepted_quantity) > 0 && Number(l.rejected_quantity) > 0);
  } else if (outcome === "pending_inspection") {
    filtered = filtered.filter((l) => Number(l.pending_inspection_quantity) > 0);
  } else if (outcome === "pending_putaway") {
    filtered = filtered.filter((l) => Number(l.pending_putaway_quantity) > 0);
  } else if (outcome === "putaway") {
    filtered = filtered.filter((l) => Number(l.putaway_quantity) > 0);
  }

  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter((l) => (l.item_name && l.item_name.toLowerCase().includes(q)) || (l.item_code && l.item_code.toLowerCase().includes(q)) || (l.receipt_number && l.receipt_number.toLowerCase().includes(q)));
  }

  const page = Number(params.page || 1);
  const pageSize = Number(params.page_size || 25);
  const offset = (page - 1) * pageSize;

  return {
    count: filtered.length,
    next: offset + pageSize < filtered.length ? `?page=${page + 1}` : null,
    previous: page > 1 ? `?page=${page - 1}` : null,
    results: filtered.slice(offset, offset + pageSize),
  };
}

export async function fetchInspections(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/inspections/?${query}`);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.count > 0 || (Array.isArray(data.results) && data.results.length > 0))) return data;
    }
  } catch (e) {}
  return { count: DEMO_INSPECTIONS.length, next: null, previous: null, results: DEMO_INSPECTIONS };
}

export async function recordInspection(payload) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/inspections/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  const created = { id: Date.now(), ...payload, status: "COMPLETED", inspected_at: new Date().toISOString() };
  return created;
}

export async function setRejectionDisposition(id, disposition) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/inspections/${id}/disposition/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejection_disposition: disposition }),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { id, rejection_disposition: disposition };
}

export async function fetchQualityInspections(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/quality-inspections/?${query}`);
    if (res.ok) return await res.json();
  } catch (e) {}
  return { count: DEMO_INSPECTIONS.length, results: DEMO_INSPECTIONS };
}

export async function recordQualityInspection(payload) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/quality-inspections/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { id: Date.now(), ...payload, status: "PASSED" };
}

export async function fetchPutaways(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/putaways/?${query}`);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.count > 0 || (Array.isArray(data.results) && data.results.length > 0))) return data;
    }
  } catch (e) {}
  return { count: DEMO_PUTAWAYS.length, next: null, previous: null, results: DEMO_PUTAWAYS };
}

export async function recordPutaway(payload) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/putaways/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { id: Date.now(), ...payload, status: "COMPLETED", putaway_at: new Date().toISOString() };
}

export async function cancelPutaway(id) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/putaways/${id}/cancel/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { success: true };
}

export async function fetchDiscrepancies(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/discrepancies/?${query}`);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.count > 0 || (Array.isArray(data.results) && data.results.length > 0))) return data;
    }
  } catch (e) {}
  return { count: DEMO_DISCREPANCIES.length, next: null, previous: null, results: DEMO_DISCREPANCIES };
}

export async function createDiscrepancy(payload) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/discrepancies/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { id: Date.now(), ...payload, status: "OPEN", created_at: new Date().toISOString() };
}

export async function updateDiscrepancy(id, payload) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/discrepancies/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { id, ...payload };
}

export async function fetchGrnContext() {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/lookups/context/`);
    if (res.ok) {
      updateApiStatus(true);
      return await res.json();
    }
  } catch (e) {
    updateApiStatus(false);
  }
  return DEMO_GRN_CONTEXT;
}

export async function fetchGrnSettings() {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/settings/`);
    if (res.ok) return await res.json();
  } catch (e) {}
  return DEMO_GRN_CONTEXT.settings;
}

export async function saveGrnSettings(submodule, settings, effectiveFrom, reason) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/settings/${submodule}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings, effective_from: effectiveFrom, reason }),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { submodule, settings };
}

export async function resetGrnSettings(submodule) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/settings/${submodule}/reset/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { success: true };
}

export async function fetchGrnSettingsHistory(submodule) {
  try {
    const res = await fetch(`${API_BASE}/inventory/goods-receipt/settings/${submodule}/history/`);
    if (res.ok) return await res.json();
  } catch (e) {}
  return [];
}
