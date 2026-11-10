/**
 * Universal Intelligent Purchase Recommendation System API Client
 * Enterprise-grade DRF client for all 9 core pillars:
 * 1. Dashboard Metrics & Summary
 * 2. Recommendations Central Management (Approve, Reject, Modify, Switch Supplier, Convert to PR)
 * 3. Demand Analysis (Daily/Weekly/Monthly, Sales Velocity, Growth, Variability)
 * 4. Demand Forecasting (Horizon projections, Confidence, Accuracy MAPE/MAD)
 * 5. Replenishment Planning (ROP, Safety Stock, Available, Reserved, Suggested Qty, Transfers)
 * 6. Market Intelligence (External trends, Search indices, Discovered opportunities, Provider health)
 * 7. Supplier Intelligence (MCDM evaluation, Risk flags, Side-by-side comparison)
 * 8. Recommendation History (Audit trail, User action logs, Approvals)
 * 9. Settings & Configurations (Industry profiles, Replenishment policies, Weights, Providers)
 */

import { API_BASE as GLOBAL_API_BASE } from "./api.js";
const API_BASE = GLOBAL_API_BASE || "/api/v1";

// ==========================================
// 1. RECOMMENDATIONS CORE CRUD & ACTIONS
// ==========================================

export async function fetchPurchaseRecommendations(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/?${query}`);
    if (res.ok) {
      const data = await res.json();
      return data.results || data || [];
    }
  } catch (e) {
    console.error("fetchPurchaseRecommendations error", e);
  }
  return [];
}

export async function fetchPurchaseRecommendationDetail(id) {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/${id}/`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("fetchPurchaseRecommendationDetail error", e);
  }
  return null;
}

export async function generatePurchaseRecommendations(warehouseId = null) {
  try {
    const body = warehouseId && warehouseId !== "ALL" ? { warehouse_id: warehouseId } : {};
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/generate/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return await res.json();
    const err = await res.json();
    return { error: err.error || "Generation failed" };
  } catch (e) {
    console.error("generatePurchaseRecommendations error", e);
    return { error: e.message };
  }
}

export async function approvePurchaseRecommendation(id) {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/${id}/approve/`, {
      method: "POST",
    });
    if (res.ok) return await res.json();
    const err = await res.json();
    return { error: err.error || "Approval failed" };
  } catch (e) {
    console.error("approvePurchaseRecommendation error", e);
    return { error: e.message };
  }
}

export async function rejectPurchaseRecommendation(id, reason = "") {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/${id}/reject/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) return await res.json();
    const err = await res.json();
    return { error: err.error || "Rejection failed" };
  } catch (e) {
    console.error("rejectPurchaseRecommendation error", e);
    return { error: e.message };
  }
}

export async function convertRecommendationToPR(id) {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/${id}/convert-to-pr/`, {
      method: "POST",
    });
    if (res.ok) return await res.json();
    const err = await res.json();
    return { error: err.error || "Conversion failed" };
  } catch (e) {
    console.error("convertRecommendationToPR error", e);
    return { error: e.message };
  }
}

export async function modifyRecommendationItemQuantity(itemId, quantity, notes = "") {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/modify-item-quantity/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, quantity, notes }),
    });
    if (res.ok) return await res.json();
    const err = await res.json();
    return { error: err.error || "Failed to update item quantity" };
  } catch (e) {
    console.error("modifyRecommendationItemQuantity error", e);
    return { error: e.message };
  }
}

export async function changeRecommendationSupplier(payload) {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/change-item-supplier/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
    const err = await res.json();
    return { error: err.error || "Failed to change supplier" };
  } catch (e) {
    console.error("changeRecommendationSupplier error", e);
    return { error: e.message };
  }
}

export async function simulateRecommendationItem(itemId, payload = {}) {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/simulate-item/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, ...payload }),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("simulateRecommendationItem error", e);
  }
  return null;
}

// ==========================================
// 2. DASHBOARD KPI & SUMMARY
// ==========================================

export async function fetchRecommendationDashboardMetrics(tenantId = "default") {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/dashboard-metrics/?tenant_id=${tenantId}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("fetchRecommendationDashboardMetrics error", e);
  }
  return null;
}

export async function fetchRecommendationDashboardSummary(tenantId = "default") {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/dashboard-summary/?tenant_id=${tenantId}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("fetchRecommendationDashboardSummary error", e);
  }
  return null;
}

// ==========================================
// 3. DEMAND ANALYSIS & FORECASTING
// ==========================================

export async function fetchDemandAnalysis(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/demand-analysis/?${query}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("fetchDemandAnalysis error", e);
  }
  return null;
}

export async function fetchDemandForecast(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/demand-forecast/?${query}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("fetchDemandForecast error", e);
  }
  return null;
}

// ==========================================
// 4. REPLENISHMENT PLANNING
// ==========================================

export async function fetchReplenishmentPlanning(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/replenishment-planning/?${query}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("fetchReplenishmentPlanning error", e);
  }
  return null;
}

// ==========================================
// 5. MARKET & SUPPLIER INTELLIGENCE
// ==========================================

export async function fetchMarketIntelligence(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/market-intelligence/?${query}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("fetchMarketIntelligence error", e);
  }
  return null;
}

export async function fetchSupplierIntelligence(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/supplier-intelligence/?${query}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("fetchSupplierIntelligence error", e);
  }
  return null;
}

export async function compareSuppliersForItem(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/compare-suppliers/?${query}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("compareSuppliersForItem error", e);
  }
  return null;
}

// ==========================================
// 6. RECOMMENDATION HISTORY & AUDIT LOGS
// ==========================================

export async function fetchRecommendationHistory(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/planning/purchase-recommendations/history/?${query}`);
    if (res.ok) {
      const data = await res.json();
      return data.history || [];
    }
  } catch (e) {
    console.error("fetchRecommendationHistory error", e);
  }
  return [];
}

// ==========================================
// 7. SETTINGS, PROFILES & PROVIDERS
// ==========================================

export async function fetchIndustryProfiles() {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/industry-profiles/`);
    if (res.ok) {
      const data = await res.json();
      return data.results || data || [];
    }
  } catch (e) {
    console.error("fetchIndustryProfiles error", e);
  }
  return [];
}

export async function fetchMarketProviders() {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/market-providers/`);
    if (res.ok) {
      const data = await res.json();
      return data.results || data || [];
    }
  } catch (e) {
    console.error("fetchMarketProviders error", e);
  }
  return [];
}

export async function checkMarketProviderHealth(providerId) {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/market-providers/${providerId}/check-health/`, {
      method: "POST",
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("checkMarketProviderHealth error", e);
  }
  return null;
}

export async function fetchReplenishmentPolicies(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/planning/replenishment-policies/?${query}`);
    if (res.ok) {
      const data = await res.json();
      return data.results || data || [];
    }
  } catch (e) {
    console.error("fetchReplenishmentPolicies error", e);
  }
  return [];
}

export async function fetchSupplierProfiles(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inventory/planning/supplier-profiles/?${query}`);
    if (res.ok) {
      const data = await res.json();
      return data.results || data || [];
    }
  } catch (e) {
    console.error("fetchSupplierProfiles error", e);
  }
  return [];
}

export async function fetchRecommendationConfigs(tenantId = "default") {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/recommendation-configs/?tenant_id=${tenantId}`);
    if (res.ok) {
      const data = await res.json();
      return data.results || data || [];
    }
  } catch (e) {
    console.error("fetchRecommendationConfigs error", e);
  }
  return [];
}

export async function updateRecommendationConfig(id, data) {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/recommendation-configs/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("updateRecommendationConfig error", e);
  }
  return null;
}

export async function fetchAnalysisHistory() {
  try {
    const res = await fetch(`${API_BASE}/inventory/planning/analysis-history/`);
    if (res.ok) {
      const data = await res.json();
      return data.results || data || [];
    }
  } catch (e) {
    console.error("fetchAnalysisHistory error", e);
  }
  return [];
}
