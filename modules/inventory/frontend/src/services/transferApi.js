// Stock Transfer API client
import { API_BASE } from "./api.js";

const TRANSFERS_BASE = `${API_BASE}/inventory/transfers`;

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
    this.errors = data?.errors || data || null;
  }
}

async function request(path = "", { method = "GET", body, params } = {}) {
  const url = new URL(path.startsWith("http") ? path : `${TRANSFERS_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "" && value !== "ALL") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const token = localStorage.getItem("inventory_token") || localStorage.getItem("token");
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.detail ||
      payload?.message ||
      (typeof payload === "string" ? payload : "Request failed");
    throw new ApiError(message, response.status, payload);
  }
  return payload;
}

export const fetchTransfers = (params = {}) => request("/", { method: "GET", params });
export const fetchInterWarehouseTransfers = (params = {}) =>
  request("/inter-warehouse/", { method: "GET", params });
export const fetchTransfer = (id) => request(`/${id}/`, { method: "GET" });
export const createTransfer = (data) => request("/", { method: "POST", body: data });
export const updateTransfer = (id, data) => request(`/${id}/`, { method: "PUT", body: data });
export const submitTransfer = (id) => request(`/${id}/submit/`, { method: "POST" });
export const approveTransfer = (id) => request(`/${id}/approve/`, { method: "POST" });
export const rejectTransfer = (id, reason) =>
  request(`/${id}/reject/`, { method: "POST", body: { reason } });
export const dispatchTransfer = (id) => request(`/${id}/dispatch/`, { method: "POST" });
export const receiveTransfer = (id, linesPayload) =>
  request(`/${id}/receive/`, { method: "POST", body: { lines: linesPayload } });
export const completeTransfer = (id) => request(`/${id}/complete/`, { method: "POST" });
export const cancelTransfer = (id, reason) =>
  request(`/${id}/cancel/`, { method: "POST", body: { reason } });
export const fetchTransferHistory = (id) => request(`/${id}/history/`, { method: "GET" });
export const searchTransferItems = (search = "") =>
  request("/items/", { method: "GET", params: { search } });
export const fetchProductStock = (warehouseId, itemId, variantId = null) =>
  request("/product-stock/", {
    method: "GET",
    params: { warehouse: warehouseId, item: itemId, variant: variantId },
  });
