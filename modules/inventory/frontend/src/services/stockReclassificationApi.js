// Stock Reclassification API client.
// Backend-only on purpose: reclassification moves real stock between status
// buckets, so the form must never show demo stock or report a post that the
// server rejected. Errors carry the server field map in `err.errors`.

import { API_BASE } from "./api";

const INV = `${API_BASE}/inventory`;

export class ReclassApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.errors = data?.errors || null;
    this.data = data;
  }
}

async function request(path, { method = "GET", body, params, headers } = {}) {
  const url = new URL(path.startsWith("http") ? path : `${INV}${path}`);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ReclassApiError("Cannot reach the inventory server. Check your connection and retry.", 0, null);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ReclassApiError(data?.error || data?.detail || `Request failed (HTTP ${res.status}).`, res.status, data);
  return data;
}

async function fetchAll(path, params) {
  const records = [];
  let data = await request(path, { params });
  for (;;) {
    if (Array.isArray(data)) return records.concat(data);
    records.push(...(data.results || []));
    if (!data.next) return records;
    data = await request(data.next);
  }
}

export const fetchReclassifications = () => fetchAll("/movements/", { type: "RECLASSIFICATION" });
export const fetchStockItems = () =>
  fetchAll("/items/").then((items) => items.filter((i) => i.is_active && i.status === "ACTIVE" && i.track_inventory !== false));
export const fetchWarehousesStrict = () => fetchAll("/warehouses/").then((list) => list.filter((w) => w.is_active));
export const fetchLocationsStrict = (warehouseId) =>
  warehouseId ? fetchAll("/locations/", { warehouse: warehouseId }).then((list) => list.filter((l) => l.is_active)) : Promise.resolve([]);

/** Eligible quantity, UOM precision, tracking flags, permitted targets, batches and serials. */
export const fetchReclassEligibility = (params) => request("/operations/reclassification/eligibility/", { params });

export const createReclassification = (payload, idempotencyKey) =>
  request("/movements/", {
    method: "POST",
    body: { ...payload, transaction_type: "RECLASSIFICATION" },
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
  });

// action: submit | approve | reject | post
export const reclassAction = (id, action, body = {}) => request(`/movements/${id}/${action}/`, { method: "POST", body });
export const deleteReclassification = (id) => request(`/movements/${id}/`, { method: "DELETE" });

export const RECLASS_ATTACHMENT_OWNER = "inventory.stock_reclassification";
