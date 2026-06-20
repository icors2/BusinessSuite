import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { clearSession, getSession } from '../../lib/auth';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/products', label: 'Products' },
  { to: '/customers', label: 'Customers' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/finance/accounts', label: 'Accounts' },
  { to: '/finance/invoices', label: 'Invoices' },
  { to: '/finance/bills', label: 'Bills' },
  { to: '/finance/reports', label: 'Reports' },
  { to: '/plm/documents', label: 'Documents' },
  { to: '/wms/receive', label: 'Receive' },
  { to: '/wms/move', label: 'Move' },
  { to: '/wms/pick', label: 'Pick' },
  { to: '/wms/inventory', label: 'Inventory' },
  { to: '/cpq/quotes', label: 'Quotes' },
  { to: '/cpq/catalog', label: 'Catalog' },
  { to: '/sales/orders', label: 'Orders' },
  { to: '/mps/dashboard', label: 'MPS' },
  { to: '/mrp/procurement', label: 'Procurement' },
  { to: '/procurement/purchase-orders', label: 'Purchase Orders' },
  { to: '/procurement/scorecard', label: 'Scorecard' },
  { to: '/workforce/schedule', label: 'Schedule' },
  { to: '/workforce/time-clock', label: 'Time Clock' },
  { to: '/workforce/labor-cost', label: 'Labor Cost' },
  { to: '/mes/operator-console', label: 'Operator' },
  { to: '/mes/supervisor', label: 'Floor' },
  { to: '/mes/scheduling', label: 'Scheduling' },
  { to: '/mes/placard', label: 'Placard' },
  { to: '/qms/inspection', label: 'Inspect' },
  { to: '/qms/checklist-builder', label: 'Checklists' },
  { to: '/qms/non-conformance', label: 'Non-Conformance' },
  { to: '/cmms/assets', label: 'Assets' },
  { to: '/cmms/work-orders', label: 'Maintenance' },
  { to: '/returns/queue', label: 'Returns' },
  { to: '/analytics/dashboard', label: 'Analytics' },
  { to: '/analytics/ask', label: 'Ask' },
  { to: '/analytics/bottlenecks', label: 'Bottlenecks' },
  { to: '/analytics/forecast', label: 'Forecast' },
];

export function AppLayout() {
  const session = getSession();
  const navigate = useNavigate();

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">Arc N Code ERP</h1>
            <p className="text-sm text-muted-foreground">
              {session?.email} · {session?.roles.join(', ')}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-6 pb-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
