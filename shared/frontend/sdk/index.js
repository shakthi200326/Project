/**
 * Universal Business Modules Ecosystem - Frontend JavaScript SDK
 * Clean, lightweight client abstractions for modules plugging into the platform.
 */

export class PlatformContextSDK {
  static getContext() {
    return {
      tenantId: localStorage.getItem("x-tenant-id") || "default-tenant",
      orgId: localStorage.getItem("x-org-id") || "default-org",
      companyId: localStorage.getItem("x-company-id") || "default-company",
      facilityId: localStorage.getItem("x-facility-id") || "WH-MAIN",
      userId: localStorage.getItem("x-user-id") || "lead_operator",
    };
  }

  static getHeaders() {
    const ctx = this.getContext();
    return {
      "X-Tenant-Id": ctx.tenantId,
      "X-Org-Id": ctx.orgId,
      "X-Company-Id": ctx.companyId,
      "X-Facility-Id": ctx.facilityId,
      "X-User-Id": ctx.userId,
    };
  }
}

export class ModuleEventSDK {
  static emit(eventName, payload) {
    if (typeof window !== "undefined") {
      const event = new CustomEvent(`ecosystem:${eventName}`, { detail: payload });
      window.dispatchEvent(event);
    }
  }

  static subscribe(eventName, callback) {
    if (typeof window !== "undefined") {
      const handler = (e) => callback(e.detail);
      window.addEventListener(`ecosystem:${eventName}`, handler);
      return () => window.removeEventListener(`ecosystem:${eventName}`, handler);
    }
    return () => {};
  }
}

