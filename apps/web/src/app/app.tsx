import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/layout/app-layout';
import { getSession } from '../lib/auth';
import { CustomersPage } from '../pages/customers';
import { LoginPage } from '../pages/login';
import { ProductsPage } from '../pages/products';
import { VendorsPage } from '../pages/vendors';
import { AccountsPage } from '../pages/finance/accounts';
import { InvoicesPage } from '../pages/finance/invoices';
import { BillsPage } from '../pages/finance/bills';
import { ReportsPage } from '../pages/finance/reports';
import { DocumentsPage } from '../pages/plm/documents';
import { WmsReceivePage } from '../pages/wms/receive';
import { WmsMovePage } from '../pages/wms/move';
import { WmsPickPage } from '../pages/wms/pick';
import { WmsInventoryPage } from '../pages/wms/inventory';
import { CpqQuotesPage } from '../pages/cpq/quotes';
import { CpqQuoteEditorPage } from '../pages/cpq/quote-editor';
import { CpqCatalogPage } from '../pages/cpq/catalog';
import { SalesOrdersPage } from '../pages/sales/orders';
import { SalesOrderDetailPage } from '../pages/sales/order-detail';
import { MpsDashboardPage } from '../pages/mps/dashboard';
import { MrpProcurementPage } from '../pages/mrp/procurement';
import { PurchaseOrdersPage } from '../pages/procurement/purchase-orders';
import { VendorScorecardPage } from '../pages/procurement/scorecard';
import { MesOperatorConsolePage } from '../pages/mes/operator-console';
import { MesSupervisorPage } from '../pages/mes/supervisor';
import { MesSchedulingPage } from '../pages/mes/scheduling';
import { MesPlacardPage } from '../pages/mes/placard';
import { QmsChecklistBuilderPage } from '../pages/qms/checklist-builder';
import { QmsInspectionPage } from '../pages/qms/inspection';
import { QmsNonConformancePage } from '../pages/qms/non-conformance';
import { WorkforceSchedulePage } from '../pages/workforce/schedule';
import { TimeClockPage } from '../pages/workforce/time-clock';
import { LaborCostPage } from '../pages/workforce/labor-cost';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/products" replace />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="finance/accounts" element={<AccountsPage />} />
        <Route path="finance/invoices" element={<InvoicesPage />} />
        <Route path="finance/bills" element={<BillsPage />} />
        <Route path="finance/reports" element={<ReportsPage />} />
        <Route path="plm/documents" element={<DocumentsPage />} />
        <Route path="wms/receive" element={<WmsReceivePage />} />
        <Route path="wms/move" element={<WmsMovePage />} />
        <Route path="wms/pick" element={<WmsPickPage />} />
        <Route path="wms/inventory" element={<WmsInventoryPage />} />
        <Route path="cpq/quotes" element={<CpqQuotesPage />} />
        <Route path="cpq/quotes/:id" element={<CpqQuoteEditorPage />} />
        <Route path="cpq/catalog" element={<CpqCatalogPage />} />
        <Route path="sales/orders" element={<SalesOrdersPage />} />
        <Route path="sales/orders/:id" element={<SalesOrderDetailPage />} />
        <Route path="mps/dashboard" element={<MpsDashboardPage />} />
        <Route path="mrp/procurement" element={<MrpProcurementPage />} />
        <Route path="procurement/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="procurement/scorecard" element={<VendorScorecardPage />} />
        <Route path="workforce/schedule" element={<WorkforceSchedulePage />} />
        <Route path="workforce/time-clock" element={<TimeClockPage />} />
        <Route path="workforce/labor-cost" element={<LaborCostPage />} />
        <Route path="mes/operator-console" element={<MesOperatorConsolePage />} />
        <Route path="mes/supervisor" element={<MesSupervisorPage />} />
        <Route path="mes/scheduling" element={<MesSchedulingPage />} />
        <Route path="mes/placard" element={<MesPlacardPage />} />
        <Route path="qms/inspection" element={<QmsInspectionPage />} />
        <Route path="qms/checklist-builder" element={<QmsChecklistBuilderPage />} />
        <Route path="qms/non-conformance" element={<QmsNonConformancePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/products" replace />} />
    </Routes>
  );
}

export default App;
