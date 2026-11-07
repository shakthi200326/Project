// Security & Audit API client connecting to backend /api/v1/security endpoints
import { API_BASE } from "./api";

const SEC_BASE = `${API_BASE}/security`;

export async function request(path, options = {}) {
  const url = `${SEC_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch (_) {}
    const err = new Error(errorData.error || `Request failed with status ${response.status}`);
    err.status = response.status;
    err.errors = errorData.errors || null;
    err.data = errorData;
    throw err;
  }
  return response.json();
}

// 1. Dashboard Metrics
export async function fetchSecurityMetrics() {
  return request("/dashboard/metrics/");
}

// 2. User Access
export async function fetchUserAccess(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/users/${query ? `?${query}` : ""}`);
}

export async function createUserAccess(payload) {
  return request("/users/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function assignUserRoles(membershipId, roleIds) {
  return request(`/users/${membershipId}/assign_roles/`, {
    method: "POST",
    body: JSON.stringify({ role_ids: roleIds }),
  });
}

export async function toggleUserStatus(membershipId, status, reason = "") {
  return request(`/users/${membershipId}/toggle_status/`, {
    method: "POST",
    body: JSON.stringify({ status, reason }),
  });
}

// 3. Role Management
export async function fetchRoles(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/roles/${query ? `?${query}` : ""}`);
}

export async function createRole(payload) {
  return request("/roles/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRole(roleId, payload) {
  return request(`/roles/${roleId}/`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteRole(roleId) {
  return request(`/roles/${roleId}/`, {
    method: "DELETE",
  });
}

export async function cloneRole(roleId, payload) {
  return request(`/roles/${roleId}/clone/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 4. Permissions
export async function fetchPermissions(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/permissions/${query ? `?${query}` : ""}`);
}

export async function fetchPermissionCategories() {
  return request("/permissions/categories/");
}

export async function fetchEffectivePermissions(username = "") {
  return request(`/permissions/effective/${username ? `?username=${username}` : ""}`);
}

// 5. Warehouse Access
export async function fetchWarehouseAccess(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/warehouse-access/${query ? `?${query}` : ""}`);
}

export async function assignWarehouseAccess(payload) {
  return request("/warehouse-access/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteWarehouseAccess(id) {
  return request(`/warehouse-access/${id}/`, {
    method: "DELETE",
  });
}

// 6. Action Permissions
export async function fetchActionMatrix() {
  return request("/actions/matrix/");
}

// 7. Activity Logs
export async function fetchActivityLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/activity-logs/${query ? `?${query}` : ""}`);
}

export function getActivityLogsExportUrl(params = {}) {
  const query = new URLSearchParams(params).toString();
  return `${SEC_BASE}/activity-logs/export/${query ? `?${query}` : ""}`;
}

// 8. Document Audit Trail
export async function fetchDocumentAuditEvents(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/document-audit/${query ? `?${query}` : ""}`);
}

export async function fetchDocumentTimeline(documentNumber) {
  return request(`/document-audit/timeline/?document_number=${encodeURIComponent(documentNumber)}`);
}

// 9. Data Change History
export async function fetchDataChangeRecords(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/data-changes/${query ? `?${query}` : ""}`);
}

