import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@shared/shell-app/ThemeProvider.jsx";
import { WorkspaceProvider } from "@shared/shell-app/ContextSelector.jsx";
import { AppShell } from "@shared/shell-app/AppShell.jsx";

import { DashboardPage } from "../pages/DashboardPage.jsx";
import { ProductsPage } from "../pages/ProductsPage.jsx";
import { StockMovementsPage } from "../pages/StockMovementsPage.jsx";
import { StockLedgerPage } from "../pages/StockLedgerPage.jsx";
import { WarehousesPage } from "../pages/WarehousesPage.jsx";
import { ValuationPage } from "../pages/ValuationPage.jsx";
import { SettingsPage } from "../pages/SettingsPage.jsx";
import { ReconciliationPage } from "../pages/ReconciliationPage.jsx";
import { BatchTrackingPage } from "../pages/BatchTrackingPage.jsx";
import { SerialTrackingPage } from "../pages/SerialTrackingPage.jsx";
import { StockReservationsPage } from "../pages/StockReservationsPage.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <WorkspaceProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<Navigate to="/inventory" replace />} />
              <Route path="/inventory" element={<DashboardPage />} />
              
              {/* Catalog */}
              <Route path="/inventory/products" element={<ProductsPage />} />
              <Route path="/inventory/categories" element={<ProductsPage />} />
              <Route path="/inventory/brands" element={<ProductsPage />} />
              <Route path="/inventory/variants" element={<ProductsPage />} />
              <Route path="/inventory/units" element={<ProductsPage />} />
              <Route path="/inventory/barcodes" element={<ProductsPage />} />
              
              {/* Warehouses */}
              <Route path="/inventory/warehouses" element={<WarehousesPage />} />
              <Route path="/inventory/warehouses/overview" element={<WarehousesPage />} />
              <Route path="/inventory/locations" element={<WarehousesPage />} />

              {/* Stock Operations */}
              <Route path="/inventory/operations/stock-in" element={<StockMovementsPage />} />
              <Route path="/inventory/operations/stock-out" element={<StockMovementsPage />} />
              <Route path="/inventory/operations/transfers" element={<StockMovementsPage />} />
              <Route path="/inventory/operations/adjustments" element={<StockMovementsPage />} />
              <Route path="/inventory/operations/reservations" element={<StockReservationsPage />} />
              <Route path="/inventory/operations/reconciliation" element={<ReconciliationPage />} />

              {/* Stock Control */}
              <Route path="/inventory/control/ledger" element={<StockLedgerPage />} />
              <Route path="/inventory/control/balances" element={<ProductsPage />} />
              <Route path="/inventory/control/batches" element={<BatchTrackingPage />} />
              <Route path="/inventory/control/serials" element={<SerialTrackingPage />} />
              <Route path="/inventory/control/expiry" element={<BatchTrackingPage />} />

              {/* Planning & Analytics */}
              <Route path="/inventory/planning/replenishment" element={<DashboardPage />} />
              <Route path="/inventory/planning/low-stock" element={<DashboardPage />} />
              <Route path="/inventory/analytics/reports" element={<ValuationPage />} />
              <Route path="/inventory/analytics/valuation" element={<ValuationPage />} />
              <Route path="/inventory/analytics/movement" element={<DashboardPage />} />

              {/* Settings */}
              <Route path="/inventory/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/inventory" replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
