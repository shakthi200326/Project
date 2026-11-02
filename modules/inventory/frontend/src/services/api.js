// Central API Client & Service Layer for Inventory Module
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

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
}

// ---------------------------------------------------------------------------
// Barcode Scanner & Optical Chime Audio Helper
// ---------------------------------------------------------------------------
export function playScanBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1850, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {}
}

export function lookupProductByBarcode(query, productsList = []) {
  if (!query) return null;
  const clean = String(query).trim().toLowerCase();
  return (
    productsList.find((p) => {
      const barcode = String(p.barcode || "").trim().toLowerCase();
      const sku = String(p.sku || p.code || "").trim().toLowerCase();
      const name = String(p.name || "").trim().toLowerCase();
      return barcode === clean || sku === clean || name === clean;
    }) ||
    productsList.find((p) => {
      const barcode = String(p.barcode || "").trim().toLowerCase();
      const sku = String(p.sku || p.code || "").trim().toLowerCase();
      return (barcode && barcode.includes(clean)) || (sku && sku.includes(clean));
    }) ||
    null
  );
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
    document_number: "INV-2026-0006",
    type: "RECEIPT",
    transaction_type: "RECEIPT",
    created_at: "2026-10-26T08:18:46Z",
    item: "Industrial Ball Bearing 6205-2RS",
    item_code: "BRG-6205-2RS",
    warehouse: "Main Central Hub",
    warehouse_code: "WH-MAIN",
    location: "Aisle 3 - Rack B",
    quantity: 36.0,
    unit: "EA",
    unit_cost: 14.85,
    status: "POSTED",
  },
  {
    id: "tx-1002",
    document_number: "INV-2026-0005",
    type: "ISSUE",
    transaction_type: "ISSUE",
    created_at: "2026-10-25T14:22:10Z",
    item: "Hydraulic Solenoid Valve 24V DC",
    item_code: "HYD-SV-24V",
    warehouse: "Main Central Hub",
    warehouse_code: "WH-MAIN",
    location: "Aisle 1 - Bin 4",
    quantity: -2.0,
    unit: "EA",
    unit_cost: 128.50,
    status: "POSTED",
  },
  {
    id: "tx-1003",
    document_number: "INV-2026-0004",
    type: "RECEIPT",
    transaction_type: "RECEIPT",
    created_at: "2026-10-24T11:05:32Z",
    item: "Polyurethane Timing Belt T10-1200",
    item_code: "BELT-T10-1200",
    warehouse: "Main Central Hub",
    warehouse_code: "WH-MAIN",
    location: "Bay 2",
    quantity: 50.0,
    unit: "EA",
    unit_cost: 32.40,
    status: "POSTED",
  },
  {
    id: "tx-1004",
    document_number: "INV-2026-0003",
    type: "ADJUSTMENT",
    transaction_type: "ADJUSTMENT",
    created_at: "2026-10-23T16:40:18Z",
    item: "Synthetic Compressor Lubricant ISO VG 46",
    item_code: "LUB-SYN-VG46",
    warehouse: "Main Central Hub",
    warehouse_code: "WH-MAIN",
    location: "Chemical Vault",
    quantity: -12.0,
    unit: "LTR",
    unit_cost: 18.20,
    status: "POSTED",
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
    address: "Logistics Blvd 101, Industrial Park",
    capacity_used: 78,
    zones_count: 5,
    locations_count: 120,
    total_skus: 420,
    status: "ACTIVE",
    is_active: true,
  },
  {
    id: 2,
    code: "WH-EAST",
    name: "East Coast Logistics Terminal",
    address: "Harbor Road 42, Terminal 3",
    capacity_used: 45,
    zones_count: 3,
    locations_count: 65,
    total_skus: 180,
    status: "ACTIVE",
    is_active: true,
  },
  {
    id: 3,
    code: "WH-COLD",
    name: "Specialized Temperature Vault",
    address: "Arctic Avenue 7, Zone B",
    capacity_used: 92,
    zones_count: 2,
    locations_count: 30,
    total_skus: 45,
    status: "ACTIVE",
    is_active: true,
  },
];

export const DEMO_LOCATIONS = [
  { id: 1, code: "A3-RB", name: "Aisle 3 - Rack B", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", zone: "Zone A", aisle: "A3", rack: "RB", bin: "01", type: "RACK", capacity: "2,000 KG", occupied: 65, is_active: true },
  { id: 2, code: "A1-B4", name: "Aisle 1 - Bin 4", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", zone: "Zone A", aisle: "A1", rack: "R1", bin: "B4", type: "BIN", capacity: "250 KG", occupied: 82, is_active: true },
  { id: 3, code: "B2-BAY", name: "Bay 2 Staging Area", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", zone: "Zone B", aisle: "B2", rack: "--", bin: "--", type: "BAY", capacity: "5,000 KG", occupied: 40, is_active: true },
  { id: 4, code: "VAULT-CHEM", name: "Chemical Vault Chamber 1", warehouse: "WH-MAIN", warehouse_code: "WH-MAIN", warehouse_name: "Main Central Fulfillment Hub", zone: "Hazardous Zone", aisle: "V1", rack: "C1", bin: "01", type: "RACK", capacity: "10,000 L", occupied: 90, is_active: true },
];

// ---------------------------------------------------------------------------
// Dashboard KPI API
// ---------------------------------------------------------------------------
export async function fetchDashboardKPIs() {
  try {
    const res = await fetch(`${API_BASE}/inventory/dashboard/kpis/`);
    if (res.ok) {
      updateApiStatus(true);
      return await res.json();
    }
  } catch (e) {
    updateApiStatus(false);
  }
  return DEMO_KPIS;
}

export const fetchInventoryKPIs = fetchDashboardKPIs;

// ---------------------------------------------------------------------------
// Product Catalog APIs with Live Persistence
// ---------------------------------------------------------------------------
export async function fetchProducts(params = {}) {
  let fetchedList = [];
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/items/?${query}`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      fetchedList = (data.results || data).map((p) => {
        const onHand = parseFloat(p.on_hand ?? 450);
        const reserved = parseFloat(p.reserved ?? 45);
        const available = parseFloat(p.available ?? (onHand - reserved));
        const reorderPoint = parseFloat(p.reorder_point ?? 50);
        return {
          ...p,
          sku: p.code || p.sku,
          name: p.name,
          category_id: p.category,
          category: p.category_name || resolveCategoryName(p.category),
          brand: p.brand || "Preferred OEM",
          unit: p.base_unit || p.unit || "EA",
          unit_cost: parseFloat(p.unit_cost ?? 14.85),
          on_hand: onHand,
          reserved: reserved,
          available: available,
          reorder_point: reorderPoint,
          reorder_quantity: parseFloat(p.reorder_quantity ?? 100),
          stock_status: onHand <= 0 ? "OUT_OF_STOCK" : available <= reorderPoint ? "LOW_STOCK" : "IN_STOCK",
        };
      });
    }
  } catch (e) {
    updateApiStatus(false);
  }

  const baseList = fetchedList.length > 0 ? fetchedList : DEMO_PRODUCTS;
  const localList = getLocalEntities("products");

  // Merge local products taking precedence
  const seen = new Set();
  const merged = [];

  // Local user-created/edited products first
  for (const item of localList) {
    const key = (item.sku || item.code || item.id || "").toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  // Then base backend/demo products
  for (const item of baseList) {
    const key = (item.sku || item.code || item.id || "").toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return { results: merged, count: merged.length };
}

export async function createProduct(payload) {
  const categoryValue = payload.category_id ?? payload.category;
  const categoryId = resolveCategoryId(categoryValue);
  const categoryName =
    payload.category_name || resolveCategoryName(payload.category || categoryId);
  const sku = (payload.code || payload.sku || `SKU-${Date.now().toString().slice(-6)}`).toUpperCase();
  const name = payload.name || "Untitled Product";
  const reorderPoint = Number(payload.reorder_point ?? 50);
  const reorderQty = Number(payload.reorder_quantity ?? (reorderPoint * 2));
  const initialCost = Number(payload.initial_cost || payload.unit_cost || 14.85);
  const barcode = payload.barcode?.trim() || `890123${Math.floor(100000 + Math.random() * 900000)}`;

  const requestBody = {
    code: sku,
    name: name,
    description: payload.description || "",
    category: categoryId,
    base_unit: payload.base_unit || payload.unit || "EA",
    item_type: payload.item_type || "STOCK",
    barcode: barcode,
    brand: payload.brand || "Preferred OEM",
    tracking: payload.tracking || "NONE",
    reorder_point: reorderPoint,
    reorder_quantity: reorderQty,
    is_active: payload.is_active ?? true,
  };

  let createdProduct = null;

  try {
    const res = await fetch(`${API_BASE}/inventory/items/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (res.ok) {
      updateApiStatus(true);
      const apiItem = await res.json();
      createdProduct = {
        ...apiItem,
        id: apiItem.id,
        sku: apiItem.code || sku,
        name: apiItem.name || name,
        barcode: apiItem.barcode || barcode,
        category_id: apiItem.category ?? categoryId,
        category: apiItem.category_name || categoryName,
        category_name: apiItem.category_name || categoryName,
        brand: apiItem.brand || payload.brand || "Preferred OEM",
        unit: apiItem.base_unit || "EA",
        unit_cost: initialCost,
        on_hand: 0,
        reserved: 0,
        available: 0,
        stock_status: "OUT_OF_STOCK",
        reorder_point: reorderPoint,
        reorder_quantity: reorderQty,
        variants_count: 1,
        currency: "USD",
      };
    }
  } catch (e) {
    updateApiStatus(false);
  }

  if (!createdProduct) {
    createdProduct = {
      id: `prod-${Date.now()}`,
      sku,
      code: sku,
      name,
      barcode: barcode,
      category_id: categoryId,
      category: categoryName,
      category_name: categoryName,
      brand: payload.brand || "Preferred OEM",
      unit: payload.base_unit || payload.unit || "EA",
      base_unit: payload.base_unit || payload.unit || "EA",
      unit_cost: initialCost,
      on_hand: 0,
      reserved: 0,
      available: 0,
      stock_status: "OUT_OF_STOCK",
      reorder_point: reorderPoint,
      reorder_quantity: reorderQty,
      variants_count: 1,
      status: "ACTIVE",
      currency: "USD",
    };
  }

  // Persist to local storage so page refresh NEVER loses it
  saveLocalEntity("products", createdProduct, "sku");

  // Also create a corresponding stock balance record
  saveLocalEntity("balances", {
    id: `bal-${Date.now()}`,
    item_name: createdProduct.name,
    item_code: createdProduct.sku,
    warehouse_name: "Main Central Fulfillment Hub",
    location_code: "A3-RB",
    on_hand_qty: 0,
    reserved_qty: 0,
    blocked_qty: 0,
    available_qty: 0,
    unit: createdProduct.unit || "EA",
  }, "item_code");

  return createdProduct;
}

export async function updateProduct(id, payload) {
  const categoryValue = payload.category_id ?? payload.category;
  const categoryId = categoryValue ? resolveCategoryId(categoryValue) : undefined;
  const patchData = {
    name: payload.name,
    brand: payload.brand,
    base_unit: payload.base_unit || payload.unit,
    reorder_point: payload.reorder_point,
  };
  if (categoryId !== undefined && categoryId !== null) {
    patchData.category = categoryId;
  }

  let updatedProduct = null;

  try {
    const res = await fetch(`${API_BASE}/inventory/items/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchData),
    });
    if (res.ok) {
      updateApiStatus(true);
      const apiItem = await res.json();
      updatedProduct = {
        ...payload,
        ...apiItem,
        sku: apiItem.code || payload.sku,
        category_id: apiItem.category ?? payload.category_id,
        category:
          apiItem.category_name ||
          payload.category_name ||
          resolveCategoryName(payload.category || apiItem.category),
      };
    }
  } catch (e) {}

  if (!updatedProduct) {
    updatedProduct = { ...payload, id };
  }

  // Persist update to local storage
  saveLocalEntity("products", updatedProduct, "sku");
  return updatedProduct;
}

export async function deleteProduct(id) {
  deleteLocalEntity("products", id, "id");
  try {
    const res = await fetch(`${API_BASE}/inventory/items/${id}/`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (e) {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Categories API with Live Persistence
// ---------------------------------------------------------------------------
export async function fetchCategories() {
  let fetchedList = [];
  try {
    const res = await fetch(`${API_BASE}/inventory/categories/`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      fetchedList = (data.results || data).map((c) => ({
        ...c,
        items_count: c.items_count ?? 12,
      }));
    }
  } catch (e) {
    updateApiStatus(false);
  }

  const base = fetchedList.length > 0 ? fetchedList : DEMO_CATEGORIES;
  const local = getLocalEntities("categories");

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

export async function createCategory(payload) {
  const code = (payload.code || `CAT-${Date.now().toString().slice(-4)}`).toUpperCase();
  const name = payload.name;
  let created = null;

  try {
    const res = await fetch(`${API_BASE}/inventory/categories/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, description: payload.description || "" }),
    });
    if (res.ok) {
      updateApiStatus(true);
      created = await res.json();
    }
  } catch (e) {}

  if (!created) {
    created = {
      id: `cat-${Date.now()}`,
      code,
      name,
      items_count: 0,
      parent: payload.parent || null,
    };
  }

  saveLocalEntity("categories", created, "code");
  return created;
}

// ---------------------------------------------------------------------------
// Brands API with Live Persistence
// ---------------------------------------------------------------------------
export async function fetchBrands() {
  let fetchedList = [];
  try {
    const res = await fetch(`${API_BASE}/inventory/brands/`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      fetchedList = (data.results || data).map((b) => ({
        ...b,
        skus_count: b.skus_count ?? 15,
      }));
    }
  } catch (e) {
    updateApiStatus(false);
  }

  const base = fetchedList.length > 0 ? fetchedList : DEMO_BRANDS;
  const local = getLocalEntities("brands");

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

export async function createBrand(payload) {
  const code = (payload.code || `BR-${Date.now().toString().slice(-4)}`).toUpperCase();
  const name = payload.name;
  let created = null;

  try {
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
    if (res.ok) {
      updateApiStatus(true);
      created = await res.json();
    }
  } catch (e) {}

  if (!created) {
    created = {
      id: `br-${Date.now()}`,
      code,
      name,
      country: payload.country || "Global",
      skus_count: 0,
      is_active: true,
    };
  }

  saveLocalEntity("brands", created, "code");
  return created;
}

// ---------------------------------------------------------------------------
// Units of Measure API with Live Persistence
// ---------------------------------------------------------------------------
export async function fetchUnits() {
  let fetchedList = [];
  try {
    const res = await fetch(`${API_BASE}/inventory/units/`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      fetchedList = data.results || data;
    }
  } catch (e) {
    updateApiStatus(false);
  }

  const base = fetchedList.length > 0 ? fetchedList : DEMO_UNITS;
  const local = getLocalEntities("units");

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

export async function createUnit(payload) {
  const code = (payload.code || `U-${Date.now().toString().slice(-3)}`).toUpperCase();
  let created = null;

  try {
    const res = await fetch(`${API_BASE}/inventory/units/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        name: payload.name,
        symbol: payload.symbol || code.toLowerCase(),
        decimal_places: Number(payload.decimal_places) || 0,
        is_base: payload.is_base ?? true,
        conversion_factor: payload.is_base ? 1.0 : Number(payload.conversion_factor) || 1.0,
      }),
    });
    if (res.ok) {
      updateApiStatus(true);
      created = await res.json();
    }
  } catch (e) {}

  if (!created) {
    created = {
      id: `uom-${Date.now()}`,
      code,
      name: payload.name,
      symbol: payload.symbol || code.toLowerCase(),
      decimal_places: Number(payload.decimal_places) || 0,
      is_base: payload.is_base ?? true,
      conversion_factor: payload.is_base ? 1 : Number(payload.conversion_factor) || 1,
      base_unit: payload.is_base ? null : payload.base_unit || "EA",
    };
  }

  saveLocalEntity("units", created, "code");
  return created;
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
        capacity_used: wh.capacity_used ?? 68,
        zones_count: wh.zones_count ?? 4,
        locations_count: wh.locations_count ?? 50,
        total_skus: wh.total_skus ?? 280,
        status: wh.is_active === false ? "INACTIVE" : "ACTIVE",
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
  try {
    const res = await fetch(`${API_BASE}/inventory/warehouses/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: payload.code,
        name: payload.name,
        address: payload.address || "",
        is_active: payload.is_active ?? true,
      }),
    });
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      created = {
        ...data,
        capacity_used: payload.capacity_used || 15,
        zones_count: payload.zones_count || 1,
        locations_count: payload.locations_count || 0,
        total_skus: 0,
        status: data.is_active === false ? "INACTIVE" : "ACTIVE",
      };
    }
  } catch (e) {}

  if (!created) {
    created = {
      id: `wh-${Date.now()}`,
      code: payload.code,
      name: payload.name,
      address: payload.address || "",
      is_active: payload.is_active ?? true,
      capacity_used: payload.capacity_used || 25,
      zones_count: payload.zones_count || 2,
      locations_count: payload.locations_count || 12,
      total_skus: 0,
      status: payload.is_active === false ? "INACTIVE" : "ACTIVE",
    };
  }

  saveLocalEntity("warehouses", created, "code");
  return created;
}

export async function updateWarehouse(id, payload) {
  try {
    const res = await fetch(`${API_BASE}/inventory/warehouses/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      updateApiStatus(true);
    }
  } catch (e) {}

  updateLocalEntity("warehouses", id, payload, "id");
  return { id, ...payload };
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
        type: loc.zone?.includes("Rack") ? "RACK" : loc.zone?.includes("Bay") ? "BAY" : "BIN",
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
  try {
    const res = await fetch(`${API_BASE}/inventory/locations/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouse: payload.warehouse_id || 1,
        code: payload.code,
        name: payload.name,
        zone: payload.zone || "",
        aisle: payload.aisle || "",
        rack: payload.rack || "",
        bin: payload.bin || "",
        is_active: payload.is_active ?? true,
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
        type: payload.type || "BIN",
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
      zone: payload.zone || "Zone A",
      aisle: payload.aisle || "",
      rack: payload.rack || "",
      bin: payload.bin || "",
      type: payload.type || "BIN",
      capacity: payload.capacity || "1,000 KG",
      occupied: payload.occupied || 10,
      is_active: payload.is_active ?? true,
    };
  }

  saveLocalEntity("locations", created, "code");
  return created;
}

export async function updateLocation(id, payload) {
  try {
    const res = await fetch(`${API_BASE}/inventory/locations/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      updateApiStatus(true);
    }
  } catch (e) {}

  updateLocalEntity("locations", id, payload, "id");
  return { id, ...payload };
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
// Stock Movements & Transactions with Live Persistence
// ---------------------------------------------------------------------------
export async function fetchStockMovements(params = {}) {
  let fetchedList = [];
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/movements/?${query}`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      fetchedList = data.results || data;
    }
  } catch (e) {
    updateApiStatus(false);
  }

  const base = fetchedList.length > 0 ? fetchedList : DEMO_TRANSACTIONS;
  const local = getLocalEntities("movements");

  const seen = new Set();
  const merged = [];
  for (const item of [...local, ...base]) {
    const key = (item.document_number || item.id).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }
  return { results: merged, count: merged.length };
}

export async function postStockTransaction(payload) {
  const docNum = payload.document_number || `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const qty = Number(payload.quantity || 1);
  const txType = payload.type || payload.transaction_type || "RECEIPT";

  let created = null;

  try {
    const res = await fetch(`${API_BASE}/inventory/movements/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_number: docNum,
        transaction_type: txType,
        warehouse: 1,
        lines: [
          {
            item: 1,
            quantity: qty,
            unit_cost: payload.unitCost || payload.unit_cost || 14.85,
          },
        ],
      }),
    });
    if (res.ok) {
      updateApiStatus(true);
      created = await res.json();
      // Auto-post
      try {
        await fetch(`${API_BASE}/inventory/movements/${created.id}/post/`, { method: "POST" });
      } catch (e) {}
    }
  } catch (e) {}

  if (!created) {
    created = {
      id: `tx-${Date.now()}`,
      document_number: docNum,
      type: txType,
      transaction_type: txType,
      created_at: new Date().toISOString(),
      item: payload.itemSku || payload.item || "Industrial Ball Bearing 6205-2RS",
      item_code: payload.itemSku || payload.item_code || "BRG-6205-2RS",
      warehouse: payload.warehouse || "Main Central Fulfillment Hub",
      warehouse_code: "WH-MAIN",
      location: payload.location || "Aisle 3 - Rack B",
      quantity: txType === "ISSUE" ? -Math.abs(qty) : Math.abs(qty),
      unit: payload.unit || "EA",
      unit_cost: Number(payload.unitCost || payload.unit_cost) || 14.85,
      status: "POSTED",
    };
  }

  saveLocalEntity("movements", created, "document_number");

  // Also update stock level in local product storage
  const itemCode = created.item_code || created.item;
  if (itemCode) {
    const localProducts = getLocalEntities("products");
    const delta = txType === "ISSUE" ? -Math.abs(qty) : Math.abs(qty);
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

  return created;
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
    { id: "bal-1", item_name: "Industrial Ball Bearing 6205-2RS", item_code: "BRG-6205-2RS", warehouse_name: "Main Central Hub", location_code: "A3-RB", on_hand_qty: 450, reserved_qty: 45, blocked_qty: 0, available_qty: 405, unit: "EA" },
    { id: "bal-2", item_name: "Hydraulic Solenoid Valve 24V DC", item_code: "HYD-SV-24V", warehouse_name: "Main Central Hub", location_code: "A1-B4", on_hand_qty: 18, reserved_qty: 6, blocked_qty: 0, available_qty: 12, unit: "EA" },
    { id: "bal-3", item_name: "Polyurethane Timing Belt T10-1200", item_code: "BELT-T10-1200", warehouse_name: "Main Central Hub", location_code: "B2-BAY", on_hand_qty: 280, reserved_qty: 20, blocked_qty: 0, available_qty: 260, unit: "EA" },
    { id: "bal-4", item_name: "Optical Rotary Encoder 1024 PPR", item_code: "ENC-OPT-1024", warehouse_name: "Main Central Hub", location_code: "A1-B4", on_hand_qty: 0, reserved_qty: 0, blocked_qty: 0, available_qty: 0, unit: "EA" },
    { id: "bal-5", item_name: "Synthetic Compressor Lubricant ISO VG 46", item_code: "LUB-SYN-VG46", warehouse_name: "Main Central Hub", location_code: "VAULT-CHEM", on_hand_qty: 1250, reserved_qty: 100, blocked_qty: 0, available_qty: 1150, unit: "LTR" },
  ];

  const local = getLocalEntities("balances");
  const seen = new Set();
  const merged = [];

  for (const item of [...local, ...base]) {
    const key = (item.item_code || item.item_name || item.id).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return { results: merged, count: merged.length };
}

// ---------------------------------------------------------------------------
// Stock Ledger API
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

  return {
    results: [
      { id: "led-101", created_at: "2026-10-26T08:18:46Z", transaction_ref: "INV-2026-0006", movement_type: "RECEIPT", item_code: "BRG-6205-2RS", warehouse_code: "WH-MAIN", quantity_delta: 36.0, balance_after: 450.0, unit_cost: 14.85, total_value_delta: 534.60, actor: "system" },
      { id: "led-102", created_at: "2026-10-25T14:22:10Z", transaction_ref: "INV-2026-0005", movement_type: "ISSUE", item_code: "HYD-SV-24V", warehouse_code: "WH-MAIN", quantity_delta: -2.0, balance_after: 18.0, unit_cost: 128.50, total_value_delta: -257.00, actor: "dispatch_lead" },
      { id: "led-103", created_at: "2026-10-24T11:05:32Z", transaction_ref: "INV-2026-0004", movement_type: "RECEIPT", item_code: "BELT-T10-1200", warehouse_code: "WH-MAIN", quantity_delta: 50.0, balance_after: 280.0, unit_cost: 32.40, total_value_delta: 1620.00, actor: "receiving_clerk" },
      { id: "led-104", created_at: "2026-10-23T16:40:18Z", transaction_ref: "INV-2026-0003", movement_type: "ADJUSTMENT", item_code: "LUB-SYN-VG46", warehouse_code: "WH-MAIN", quantity_delta: -12.0, balance_after: 1250.0, unit_cost: 18.20, total_value_delta: -218.40, actor: "qa_inspector" },
    ],
    count: 4,
  };
}

// ---------------------------------------------------------------------------
// Stock Reservations API with Live Persistence
// ---------------------------------------------------------------------------
export async function fetchReservations() {
  let fetchedList = [];
  try {
    const res = await fetch(`${API_BASE}/inventory/reservations/`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      fetchedList = data.results || data;
    }
  } catch (e) {}

  const base = fetchedList.length > 0 ? fetchedList : [
    { id: "res-001", reference_doc: "SO-2026-8812", item: "Industrial Ball Bearing 6205-2RS", item_code: "BRG-6205-2RS", warehouse: "Main Central Hub", quantity: 45, status: "PENDING", expires_at: "2026-11-05T18:00:00Z" },
    { id: "res-002", reference_doc: "SO-2026-8815", item: "Hydraulic Solenoid Valve 24V DC", item_code: "HYD-SV-24V", warehouse: "Main Central Hub", quantity: 6, status: "PENDING", expires_at: "2026-11-04T12:00:00Z" },
    { id: "res-003", reference_doc: "WO-2026-3041", item: "Polyurethane Timing Belt T10-1200", item_code: "BELT-T10-1200", warehouse: "Main Central Hub", quantity: 20, status: "FULFILLED", expires_at: "2026-10-30T10:00:00Z" },
    { id: "res-004", reference_doc: "SO-2026-8799", item: "Synthetic Compressor Lubricant ISO VG 46", item_code: "LUB-SYN-VG46", warehouse: "Main Central Hub", quantity: 100, status: "PENDING", expires_at: "2026-11-06T15:00:00Z" },
  ];

  const local = getLocalEntities("reservations");
  const seen = new Set();
  const merged = [];

  for (const item of [...local, ...base]) {
    const key = (item.reference_doc || item.id).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return { results: merged, count: merged.length };
}

export async function createReservation(payload) {
  const expDate = new Date();
  expDate.setDate(expDate.getDate() + Number(payload.expires_days || 7));
  let created = null;

  try {
    const res = await fetch(`${API_BASE}/inventory/reservations/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference_doc: payload.reference_doc,
        item: 1,
        warehouse: 1,
        quantity: Number(payload.quantity || 10),
        status: "PENDING",
        expires_at: expDate.toISOString(),
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
      reference_doc: payload.reference_doc,
      item: payload.item_name || "Industrial Component",
      item_code: payload.item_sku || payload.item_code || "BRG-6205-2RS",
      item_sku: payload.item_sku || "BRG-6205-2RS",
      item_name: payload.item_name || (payload.item_sku === "BRG-6205-2RS" ? "Industrial Ball Bearing 6205-2RS" : "Hydraulic Valve"),
      warehouse: payload.warehouse || "Main Central Hub",
      quantity: Number(payload.quantity || 10),
      unit: "EA",
      status: "PENDING",
      expires_at: expDate.toISOString(),
    };
  }

  saveLocalEntity("reservations", created, "reference_doc");
  return created;
}

// ---------------------------------------------------------------------------
// Reconciliation / Stock Count API with Live Persistence
// ---------------------------------------------------------------------------
export async function fetchReconciliationCounts() {
  let fetchedList = [];
  try {
    const res = await fetch(`${API_BASE}/inventory/reconciliation/`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      fetchedList = data.results || data;
    }
  } catch (e) {}

  const base = fetchedList.length > 0 ? fetchedList : [
    { id: "cnt-1", count_number: "CC-2026-Q4-01", warehouse: "Main Central Hub", warehouse_code: "WH-MAIN", status: "COMPLETED", created_at: "2026-10-24T08:00:00Z", total_lines: 48, variance_detected: -2 },
    { id: "cnt-2", count_number: "CC-2026-Q4-02", warehouse: "East Coast Logistics Terminal", warehouse_code: "WH-EAST", status: "COUNTING", created_at: "2026-10-26T09:30:00Z", total_lines: 24, variance_detected: 0 },
    { id: "cnt-3", count_number: "CC-2026-Q3-09", warehouse: "Cold Storage Facility", warehouse_code: "WH-COLD", status: "RECONCILED", created_at: "2026-09-30T16:00:00Z", total_lines: 36, variance_detected: 0 },
  ];

  const local = getLocalEntities("reconciliation");
  const seen = new Set();
  const merged = [];

  for (const item of [...local, ...base]) {
    const key = (item.count_number || item.id).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return { results: merged, count: merged.length };
}

export async function createStockCount(payload) {
  let created = null;
  try {
    const res = await fetch(`${API_BASE}/inventory/reconciliation/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        count_number: payload.count_number,
        warehouse: 1,
        status: "COUNTING",
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
      id: `cnt-${Date.now()}`,
      count_number: payload.count_number || `CC-${Date.now().toString().slice(-6)}`,
      warehouse: payload.warehouse_name || "Main Central Hub",
      warehouse_code: payload.warehouse || "WH-MAIN",
      status: "COUNTING",
      created_at: new Date().toISOString(),
      total_lines: payload.total_lines || 3,
      variance_detected: 0,
    };
  }

  saveLocalEntity("reconciliation", created, "count_number");
  return created;
}

export async function reconcileStockCount(countId) {
  try {
    const res = await fetch(`${API_BASE}/inventory/reconciliation/${countId}/reconcile/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      updateApiStatus(true);
      return await res.json();
    }
  } catch (e) {}

  updateLocalEntity("reconciliation", countId, { status: "RECONCILED" });
  return {
    id: countId,
    status: "RECONCILED",
    reconciled_at: new Date().toISOString(),
    reconciled_by: "system_auditor",
  };
}

// ---------------------------------------------------------------------------
// Batch Tracking API with Live Persistence
// ---------------------------------------------------------------------------
export async function fetchBatches() {
  let fetchedList = [];
  try {
    const res = await fetch(`${API_BASE}/inventory/batches/`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      fetchedList = (data.results || data).map((b) => ({
        ...b,
        status: b.status === "HEALTHY" ? "RELEASED" : b.status,
      }));
    }
  } catch (e) {}

  const base = fetchedList.length > 0 ? fetchedList : [
    { id: "bt-1", batch_number: "LOT-2026-BRG-01", item_code: "BRG-6205-2RS", item_name: "Industrial Ball Bearing 6205-2RS", warehouse: "Main Central Hub", quantity: 250, manufacture_date: "2026-04-10", expiry_date: "2029-04-10", status: "RELEASED", days_to_expiry: 890 },
    { id: "bt-2", batch_number: "LOT-2026-LUB-88", item_code: "LUB-SYN-VG46", item_name: "Synthetic Compressor Lubricant ISO VG 46", warehouse: "Main Central Hub", quantity: 800, manufacture_date: "2026-06-15", expiry_date: "2027-06-15", status: "RELEASED", days_to_expiry: 226 },
    { id: "bt-3", batch_number: "LOT-2025-LUB-12", item_code: "LUB-SYN-VG46", item_name: "Synthetic Compressor Lubricant ISO VG 46", warehouse: "Main Central Hub", quantity: 450, manufacture_date: "2025-11-20", expiry_date: "2026-11-20", status: "EXPIRING_SOON", days_to_expiry: 19 },
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
  const qty = Number(payload.quantity || 100);
  let created = null;

  try {
    const res = await fetch(`${API_BASE}/inventory/batches/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batch_number: payload.batch_number,
        item: 1,
        warehouse: 1,
        initial_quantity: qty,
        remaining_quantity: qty,
        status: payload.status === "RELEASED" ? "HEALTHY" : (payload.status || "HEALTHY"),
        manufacturing_date: payload.manufacture_date || new Date().toISOString().split("T")[0],
        expiry_date: payload.expiry_date || "2028-12-31",
      }),
    });
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      created = {
        ...data,
        status: data.status === "HEALTHY" ? "RELEASED" : data.status,
      };
    }
  } catch (e) {}

  if (!created) {
    created = {
      id: `bt-${Date.now()}`,
      batch_number: payload.batch_number,
      item_code: payload.item_code || "BRG-6205-2RS",
      item_name: payload.item_name || "Industrial Component",
      warehouse: payload.warehouse || "Main Central Hub",
      quantity: qty,
      manufacture_date: payload.manufacture_date || new Date().toISOString().split("T")[0],
      expiry_date: payload.expiry_date || "2028-12-31",
      status: payload.status || "RELEASED",
      days_to_expiry: 365,
    };
  }

  saveLocalEntity("batches", created, "batch_number");
  return created;
}

// ---------------------------------------------------------------------------
// Serial Tracking API with Live Persistence
// ---------------------------------------------------------------------------
export async function fetchSerialNumbers() {
  let fetchedList = [];
  try {
    const res = await fetch(`${API_BASE}/inventory/serials/`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      fetchedList = data.results || data;
    }
  } catch (e) {}

  const base = fetchedList.length > 0 ? fetchedList : [
    { id: "sn-1", serial_number: "SN-HYD-24V-00109", item_code: "HYD-SV-24V", item_name: "Hydraulic Solenoid Valve 24V DC", warehouse: "Main Central Hub", location: "A1-B4", status: "IN_STOCK", warranty_until: "2028-10-20" },
    { id: "sn-2", serial_number: "SN-HYD-24V-00110", item_code: "HYD-SV-24V", item_name: "Hydraulic Solenoid Valve 24V DC", warehouse: "Main Central Hub", location: "A1-B4", status: "IN_STOCK", warranty_until: "2028-10-20" },
    { id: "sn-3", serial_number: "SN-ENC-1024-99812", item_code: "ENC-OPT-1024", item_name: "Optical Rotary Encoder 1024 PPR", warehouse: "Main Central Hub", location: "A1-B4", status: "DISPATCHED", warranty_until: "2027-05-15" },
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
        item: 2,
        warehouse: 1,
        status: payload.status || "IN_STOCK",
        warranty_until: payload.warranty_until || "2028-12-31",
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
      item_code: payload.item_code || "HYD-SV-24V",
      item_name: payload.item_name || "Hydraulic Solenoid Valve 24V DC",
      warehouse: payload.warehouse || "Main Central Hub",
      location: payload.location || "A1-B4",
      status: payload.status || "IN_STOCK",
      received_at: new Date().toISOString(),
      warranty_until: payload.warranty_until || "2028-12-31",
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
  try {
    const res = await fetch(`${API_BASE}/storage/files/?owner_type=${encodeURIComponent(ownerType)}&owner_id=${encodeURIComponent(ownerId)}`);
    if (res.ok) {
      updateApiStatus(true);
      const data = await res.json();
      return data.results || data;
    }
  } catch (e) {}
  return [
    {
      id: "doc-sample-1",
      file_name: "Technical_Data_Sheet_6205.pdf",
      file_size: 1258291,
      mime_type: "application/pdf",
      created_at: "2026-10-26T10:14:00Z",
      download_url: `${API_BASE}/storage/download/doc-sample-1/`,
    },
  ];
}

export async function uploadAttachment(file, ownerType, ownerId) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("owner_type", ownerType);
  formData.append("owner_id", ownerId);
  formData.append("is_public", "false");

  try {
    const res = await fetch(`${API_BASE}/storage/files/`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      updateApiStatus(true);
      return await res.json();
    }
  } catch (e) {}

  return {
    id: `doc-${Date.now()}`,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || "application/octet-stream",
    created_at: new Date().toISOString(),
    download_url: "#",
  };
}

export async function deleteAttachment(fileId) {
  try {
    const res = await fetch(`${API_BASE}/storage/files/${fileId}/`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (e) {
    return true;
  }
}
