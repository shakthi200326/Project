const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

// Demo Catalog Data (Pre-seeded enterprise inventory data)
export const DEMO_PRODUCTS = [
  {
    id: "prod-001",
    name: "Industrial Ball Bearing 6205-2RS",
    sku: "BRG-6205-2RS",
    category: "Mechanical Components",
    brand: "SKF Precision",
    unit: "EA",
    variants_count: 3,
    status: "ACTIVE",
    stock_status: "IN_STOCK",
    on_hand: 450,
    reserved: 45,
    available: 405,
    reorder_point: 100,
    unit_cost: 14.85,
    currency: "USD",
  },
  {
    id: "prod-002",
    name: "Hydraulic Solenoid Valve 24V DC",
    sku: "HYD-SV-24V",
    category: "Hydraulics & Pneumatics",
    brand: "Bosch Rexroth",
    unit: "EA",
    variants_count: 2,
    status: "ACTIVE",
    stock_status: "LOW_STOCK",
    on_hand: 18,
    reserved: 6,
    available: 12,
    reorder_point: 25,
    unit_cost: 128.50,
    currency: "USD",
  },
  {
    id: "prod-003",
    name: "Polyurethane Timing Belt T10-1200",
    sku: "BELT-T10-1200",
    category: "Power Transmission",
    brand: "Gates PowerGrip",
    unit: "EA",
    variants_count: 4,
    status: "ACTIVE",
    stock_status: "IN_STOCK",
    on_hand: 280,
    reserved: 20,
    available: 260,
    reorder_point: 50,
    unit_cost: 32.40,
    currency: "USD",
  },
  {
    id: "prod-004",
    name: "Optical Rotary Encoder 1024 PPR",
    sku: "ENC-OPT-1024",
    category: "Sensors & Automation",
    brand: "Omron Industrial",
    unit: "EA",
    variants_count: 1,
    status: "ACTIVE",
    stock_status: "OUT_OF_STOCK",
    on_hand: 0,
    reserved: 0,
    available: 0,
    reorder_point: 15,
    unit_cost: 95.00,
    currency: "USD",
  },
  {
    id: "prod-005",
    name: "Synthetic Compressor Lubricant ISO VG 46",
    sku: "LUB-SYN-VG46",
    category: "Chemicals & Fluids",
    brand: "Mobil Rarus",
    unit: "LTR",
    variants_count: 2,
    status: "ACTIVE",
    stock_status: "IN_STOCK",
    on_hand: 1250,
    reserved: 100,
    available: 1150,
    reorder_point: 300,
    unit_cost: 18.20,
    currency: "USD",
  },
];

export const DEMO_TRANSACTIONS = [
  {
    id: "tx-1001",
    document_number: "DEMO-INV-0006",
    type: "RECEIPT",
    created_at: "2026-10-26T08:18:46Z",
    item: "Industrial Ball Bearing 6205-2RS",
    warehouse: "Main Central Warehouse",
    location: "Aisle 3 - Rack B",
    quantity: 36.0,
    unit: "EA",
    unit_cost: 14.85,
    status: "POSTED",
  },
  {
    id: "tx-1002",
    document_number: "DEMO-INV-0005",
    type: "ISSUE",
    created_at: "2026-10-25T14:22:10Z",
    item: "Hydraulic Solenoid Valve 24V DC",
    warehouse: "Main Central Warehouse",
    location: "Aisle 1 - Bin 4",
    quantity: -5.0,
    unit: "EA",
    unit_cost: 128.50,
    status: "POSTED",
  },
  {
    id: "tx-1003",
    document_number: "DEMO-INV-0004",
    type: "TRANSFER",
    created_at: "2026-10-24T11:05:32Z",
    item: "Polyurethane Timing Belt T10-1200",
    warehouse: "Main Central Warehouse",
    location: "Bay 2",
    quantity: 25.0,
    unit: "EA",
    unit_cost: 32.40,
    status: "POSTED",
  },
  {
    id: "tx-1004",
    document_number: "DEMO-INV-0003",
    type: "ADJUSTMENT",
    created_at: "2026-10-23T16:40:18Z",
    item: "Synthetic Compressor Lubricant ISO VG 46",
    warehouse: "Main Central Warehouse",
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

export async function fetchInventoryKPIs() {
  try {
    const res = await fetch(`${API_BASE}/inventory/dashboard/kpis/`);
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback to pre-seeded demo
  }
  return DEMO_KPIS;
}

export async function fetchProducts(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/items/?${query}`);
    if (res.ok) return await res.json();
  } catch (e) {}
  return { results: DEMO_PRODUCTS, count: DEMO_PRODUCTS.length };
}

export async function fetchStockMovements(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/movements/?${query}`);
    if (res.ok) return await res.json();
  } catch (e) {}
  return { results: DEMO_TRANSACTIONS, count: DEMO_TRANSACTIONS.length };
}

// Universal File Storage API integrations
export async function fetchAttachments(ownerType, ownerId) {
  try {
    const res = await fetch(`${API_BASE}/storage/files/?owner_type=${encodeURIComponent(ownerType)}&owner_id=${encodeURIComponent(ownerId)}`);
    if (res.ok) {
      const data = await res.json();
      return data.results || data;
    }
  } catch (e) {}
  // Default mock fallback for demo mode
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
      return await res.json();
    }
  } catch (e) {}

  // Fallback return for mock demo environments
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

