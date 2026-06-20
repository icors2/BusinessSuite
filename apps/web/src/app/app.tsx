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
      </Route>
      <Route path="*" element={<Navigate to="/products" replace />} />
    </Routes>
  );
}

export default App;
