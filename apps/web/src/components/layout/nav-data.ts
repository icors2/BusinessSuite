import {
  BarChart3,
  Boxes,
  CalendarRange,
  ClipboardList,
  DollarSign,
  Factory,
  FileText,
  GraduationCap,
  RotateCcw,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  title: string;
  url: string;
};

export type NavGroup = {
  title: string;
  url: string;
  icon: LucideIcon;
  items: NavItem[];
};

export type QuickLink = {
  name: string;
  url: string;
  icon: LucideIcon;
};

export const erpNavGroups: NavGroup[] = [
  {
    title: 'Core',
    url: '/products',
    icon: Boxes,
    items: [
      { title: 'Products', url: '/products' },
      { title: 'Customers', url: '/customers' },
      { title: 'Vendors', url: '/vendors' },
    ],
  },
  {
    title: 'Finance',
    url: '/finance/accounts',
    icon: DollarSign,
    items: [
      { title: 'Accounts', url: '/finance/accounts' },
      { title: 'Invoices', url: '/finance/invoices' },
      { title: 'Bills', url: '/finance/bills' },
      { title: 'Reports', url: '/finance/reports' },
    ],
  },
  {
    title: 'PLM',
    url: '/plm/documents',
    icon: FileText,
    items: [{ title: 'Documents', url: '/plm/documents' }],
  },
  {
    title: 'WMS',
    url: '/wms/inventory',
    icon: Warehouse,
    items: [
      { title: 'Inventory', url: '/wms/inventory' },
      { title: 'Receive', url: '/wms/receive' },
      { title: 'Move', url: '/wms/move' },
      { title: 'Pick', url: '/wms/pick' },
    ],
  },
  {
    title: 'Sales & CPQ',
    url: '/cpq/quotes',
    icon: ShoppingCart,
    items: [
      { title: 'Quotes', url: '/cpq/quotes' },
      { title: 'Catalog', url: '/cpq/catalog' },
      { title: 'Orders', url: '/sales/orders' },
    ],
  },
  {
    title: 'Planning',
    url: '/mps/dashboard',
    icon: CalendarRange,
    items: [
      { title: 'MPS', url: '/mps/dashboard' },
      { title: 'Procurement', url: '/mrp/procurement' },
    ],
  },
  {
    title: 'Procurement',
    url: '/procurement/purchase-orders',
    icon: ClipboardList,
    items: [
      { title: 'Purchase Orders', url: '/procurement/purchase-orders' },
      { title: 'Scorecard', url: '/procurement/scorecard' },
    ],
  },
  {
    title: 'Workforce',
    url: '/workforce/schedule',
    icon: Users,
    items: [
      { title: 'Schedule', url: '/workforce/schedule' },
      { title: 'Time Clock', url: '/workforce/time-clock' },
      { title: 'Labor Cost', url: '/workforce/labor-cost' },
    ],
  },
  {
    title: 'MES',
    url: '/mes/operator-console',
    icon: Factory,
    items: [
      { title: 'Operator', url: '/mes/operator-console' },
      { title: 'Floor', url: '/mes/supervisor' },
      { title: 'Scheduling', url: '/mes/scheduling' },
      { title: 'Placard', url: '/mes/placard' },
    ],
  },
  {
    title: 'QMS',
    url: '/qms/inspection',
    icon: ShieldCheck,
    items: [
      { title: 'Inspection', url: '/qms/inspection' },
      { title: 'Checklists', url: '/qms/checklist-builder' },
      { title: 'Non-Conformance', url: '/qms/non-conformance' },
    ],
  },
  {
    title: 'CMMS',
    url: '/cmms/assets',
    icon: Wrench,
    items: [
      { title: 'Assets', url: '/cmms/assets' },
      { title: 'Maintenance', url: '/cmms/work-orders' },
    ],
  },
  {
    title: 'Returns',
    url: '/returns/queue',
    icon: RotateCcw,
    items: [{ title: 'Queue', url: '/returns/queue' }],
  },
  {
    title: 'Analytics',
    url: '/analytics/dashboard',
    icon: BarChart3,
    items: [
      { title: 'Dashboard', url: '/analytics/dashboard' },
      { title: 'Ask', url: '/analytics/ask' },
      { title: 'Bottlenecks', url: '/analytics/bottlenecks' },
      { title: 'Forecast', url: '/analytics/forecast' },
    ],
  },
  {
    title: 'Admin',
    url: '/admin/users',
    icon: Shield,
    items: [
      { title: 'Users', url: '/admin/users' },
      { title: 'Employees', url: '/admin/employees' },
    ],
  },
];

export const quickLinks: QuickLink[] = [
  { name: 'Tutorials', url: '/tutorials', icon: GraduationCap },
];

export const routeLabels: Record<string, string> = {
  products: 'Products',
  customers: 'Customers',
  vendors: 'Vendors',
  finance: 'Finance',
  accounts: 'Accounts',
  invoices: 'Invoices',
  bills: 'Bills',
  reports: 'Reports',
  plm: 'PLM',
  documents: 'Documents',
  wms: 'WMS',
  inventory: 'Inventory',
  receive: 'Receive',
  move: 'Move',
  pick: 'Pick',
  cpq: 'CPQ',
  quotes: 'Quotes',
  catalog: 'Catalog',
  sales: 'Sales',
  orders: 'Orders',
  mps: 'MPS',
  dashboard: 'Dashboard',
  mrp: 'MRP',
  procurement: 'Procurement',
  'purchase-orders': 'Purchase Orders',
  scorecard: 'Scorecard',
  workforce: 'Workforce',
  schedule: 'Schedule',
  'time-clock': 'Time Clock',
  'labor-cost': 'Labor Cost',
  mes: 'MES',
  'operator-console': 'Operator Console',
  supervisor: 'Supervisor',
  scheduling: 'Scheduling',
  placard: 'Placard',
  qms: 'QMS',
  inspection: 'Inspection',
  'checklist-builder': 'Checklists',
  'non-conformance': 'Non-Conformance',
  cmms: 'CMMS',
  assets: 'Assets',
  'work-orders': 'Work Orders',
  returns: 'Returns',
  queue: 'Queue',
  analytics: 'Analytics',
  admin: 'Admin',
  users: 'Users',
  employees: 'Employees',
  ask: 'Ask',
  bottlenecks: 'Bottlenecks',
  forecast: 'Forecast',
  tutorials: 'Tutorials',
};

export function groupIsActive(pathname: string, group: NavGroup): boolean {
  return group.items.some(
    (item) => pathname === item.url || pathname.startsWith(`${item.url}/`),
  );
}

export function findActiveNavLabel(pathname: string): string {
  for (const group of erpNavGroups) {
    for (const item of group.items) {
      if (pathname === item.url || pathname.startsWith(`${item.url}/`)) {
        return item.title;
      }
    }
  }
  for (const link of quickLinks) {
    if (pathname === link.url || pathname.startsWith(`${link.url}/`)) {
      return link.name;
    }
  }
  const segment = pathname.split('/').filter(Boolean).pop();
  if (segment && routeLabels[segment]) {
    return routeLabels[segment];
  }
  return 'Home';
}
