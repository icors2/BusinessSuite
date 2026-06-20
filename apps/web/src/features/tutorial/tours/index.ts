export type TourStep = {
  element: string;
  title: string;
  description: string;
  route?: string;
};

export type ModuleTour = {
  id: string;
  title: string;
  description: string;
  suggestedLogin: string;
  startRoute: string;
  demoEntityHint?: string;
  steps: TourStep[];
};

export const TUTORIAL_MODULES: ModuleTour[] = [
  {
    id: 'erp-admin',
    title: 'ERP Admin',
    description: 'Products, customers, and vendors',
    suggestedLogin: 'manager@arcncode.local',
    startRoute: '/products',
    demoEntityHint: 'SKU-DEMO-001, SKU-DEMO-002, SKU-DEMO-003',
    steps: [
      {
        route: '/products',
        element: '[data-tour="products-header"]',
        title: 'Products',
        description:
          'Browse demo SKUs including SKU-DEMO-001 (make), SKU-DEMO-002 (buy), and SKU-DEMO-003 (finished good). Managers can create and edit products.',
      },
      {
        route: '/customers',
        element: '[data-tour="customers-header"]',
        title: 'Customers',
        description:
          'View Globex Corporation and Acme Manufacturing. Create or update customer records and payment terms.',
      },
      {
        route: '/vendors',
        element: '[data-tour="vendors-header"]',
        title: 'Vendors',
        description:
          'Precision Parts Ltd is the preferred vendor for SKU-DEMO-002. Maintain vendor contact and payment terms here.',
      },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    description: 'Accounts, AR/AP, and reports',
    suggestedLogin: 'manager@arcncode.local',
    startRoute: '/finance/accounts',
    demoEntityHint: 'INV-DEMO-001, BILL-DEMO-001',
    steps: [
      {
        route: '/finance/accounts',
        element: '[data-tour="finance-accounts-header"]',
        title: 'Chart of accounts',
        description: 'Review account codes 1000–5000 used for double-entry posting.',
      },
      {
        route: '/finance/invoices',
        element: '[data-tour="finance-invoices-header"]',
        title: 'Invoices',
        description:
          'Open INV-DEMO-001 from the shipped SO-DEMO-001. Post invoices and record customer payments.',
      },
      {
        route: '/finance/bills',
        element: '[data-tour="finance-bills-header"]',
        title: 'Bills',
        description: 'BILL-DEMO-001 is a posted vendor bill from demo procurement.',
      },
      {
        route: '/finance/reports',
        element: '[data-tour="finance-reports-header"]',
        title: 'Reports',
        description: 'Run Profit & Loss and Balance Sheet for a date range.',
      },
    ],
  },
  {
    id: 'plm',
    title: 'PLM',
    description: 'Document control and revisions',
    suggestedLogin: 'manager@arcncode.local',
    startRoute: '/plm/documents',
    demoEntityHint: 'Released drawing on SKU-DEMO-001',
    steps: [
      {
        element: '[data-tour="plm-documents-header"]',
        title: 'Documents',
        description:
          'Filter by SKU-DEMO-001 to see a RELEASED assembly drawing and an IN_REVIEW work instruction.',
      },
    ],
  },
  {
    id: 'wms',
    title: 'WMS',
    description: 'Inventory receive, move, pick, and lookup',
    suggestedLogin: 'manager@arcncode.local',
    startRoute: '/wms/inventory',
    demoEntityHint: 'Bin B-DEMO-01',
    steps: [
      {
        route: '/wms/inventory',
        element: '[data-tour="wms-inventory-header"]',
        title: 'Inventory lookup',
        description: 'Search SKU-DEMO-003 in bin B-DEMO-01. Available = onHand − allocated.',
      },
      {
        route: '/wms/receive',
        element: '[data-tour="wms-receive-header"]',
        title: 'Receive',
        description: 'Receive stock into a bin to increase on-hand quantity.',
      },
      {
        route: '/wms/move',
        element: '[data-tour="wms-move-header"]',
        title: 'Move',
        description: 'Transfer inventory between bins.',
      },
      {
        route: '/wms/pick',
        element: '[data-tour="wms-pick-header"]',
        title: 'Pick',
        description: 'Pick decrements source bin; respects QMS holds on bins.',
      },
    ],
  },
  {
    id: 'cpq',
    title: 'CPQ',
    description: 'Configure, price, and quote',
    suggestedLogin: 'manager@arcncode.local',
    startRoute: '/cpq/quotes',
    demoEntityHint: 'Q-DEMO-001 (Draft), Q-DEMO-002 (Sent), Q-DEMO-003 (Accepted)',
    steps: [
      {
        element: '[data-tour="cpq-quotes-header"]',
        title: 'Quotes',
        description:
          'Demo quotes show Draft, Sent, and Accepted statuses. Open Q-DEMO-003 to convert to a sales order.',
      },
      {
        route: '/cpq/catalog',
        element: '[data-tour="cpq-catalog-header"]',
        title: 'Catalog',
        description: 'Preview tier and volume pricing for catalog products.',
      },
    ],
  },
  {
    id: 'sales-order',
    title: 'Sales Orders',
    description: 'Allocate, ship, and invoice',
    suggestedLogin: 'manager@arcncode.local',
    startRoute: '/sales/orders',
    demoEntityHint: 'SO-DEMO-001 (Shipped), SO-DEMO-002 (Allocated)',
    steps: [
      {
        element: '[data-tour="sales-orders-header"]',
        title: 'Order list',
        description:
          'SO-DEMO-001 is fully shipped with INV-DEMO-001. SO-DEMO-002 is allocated and ready to ship in tutorials.',
      },
    ],
  },
  {
    id: 'mps-mrp',
    title: 'MPS & MRP',
    description: 'Production schedule and material planning',
    suggestedLogin: 'manager@arcncode.local',
    startRoute: '/mps/dashboard',
    demoEntityHint: 'WO-DEMO-001, PR-DEMO-PENDING',
    steps: [
      {
        route: '/mps/dashboard',
        element: '[data-tour="mps-dashboard-header"]',
        title: 'MPS dashboard',
        description: 'Review demand preview and WO-DEMO-001 on LINE-MAIN.',
      },
      {
        route: '/mrp/procurement',
        element: '[data-tour="mrp-procurement-header"]',
        title: 'MRP procurement',
        description:
          'PR-DEMO-PENDING and PR-DEMO-APPROVED requisitions are seeded. Run MRP and approve requisitions.',
      },
    ],
  },
  {
    id: 'procurement',
    title: 'Procurement',
    description: 'Purchase orders and vendor scorecard',
    suggestedLogin: 'manager@arcncode.local',
    startRoute: '/procurement/purchase-orders',
    demoEntityHint: 'PO-DEMO-001, PO-DEMO-002',
    steps: [
      {
        element: '[data-tour="procurement-po-header"]',
        title: 'Purchase orders',
        description:
          'PO-DEMO-001 is issued with partial receipt. PO-DEMO-002 awaits ASN and receive.',
      },
      {
        route: '/procurement/scorecard',
        element: '[data-tour="procurement-scorecard-header"]',
        title: 'Vendor scorecard',
        description: 'Review on-time delivery and quantity accuracy metrics.',
      },
    ],
  },
  {
    id: 'workforce',
    title: 'Workforce',
    description: 'Scheduling and time clock',
    suggestedLogin: 'operator@arcncode.local',
    startRoute: '/workforce/time-clock',
    demoEntityHint: 'EMP-DEMO-01 clocked in',
    steps: [
      {
        route: '/workforce/time-clock',
        element: '[data-tour="workforce-clock-header"]',
        title: 'Time clock',
        description:
          'EMP-DEMO-01 is clocked in for MES. Operators must clock in before starting shop floor cycles.',
      },
      {
        route: '/workforce/schedule',
        element: '[data-tour="workforce-schedule-header"]',
        title: 'Schedule',
        description: 'Assign employees to shifts and mark unavailability.',
      },
      {
        route: '/workforce/labor-cost',
        element: '[data-tour="workforce-labor-header"]',
        title: 'Labor cost',
        description: 'Roll up hours and cost by work order and department.',
      },
    ],
  },
  {
    id: 'mes',
    title: 'MES',
    description: 'Shop floor execution',
    suggestedLogin: 'operator@arcncode.local',
    startRoute: '/mes/operator-console',
    demoEntityHint: 'Open cycle on WO-DEMO-001 / WS-LASER',
    steps: [
      {
        element: '[data-tour="mes-operator-header"]',
        title: 'Operator console',
        description:
          'An open cycle runs on WO-DEMO-001. Start/stop operations and enter completed quantity.',
      },
      {
        route: '/mes/supervisor',
        element: '[data-tour="mes-supervisor-header"]',
        title: 'Supervisor dashboard',
        description: 'Live floor view and work order verification (Supervisor login).',
      },
      {
        route: '/mes/placard',
        element: '[data-tour="mes-placard-header"]',
        title: 'Placard',
        description: 'Print work-order traveler with barcode for the shop floor.',
      },
    ],
  },
  {
    id: 'qms',
    title: 'QMS',
    description: 'Inspections and non-conformance',
    suggestedLogin: 'inspector@arcncode.local',
    startRoute: '/qms/inspection',
    demoEntityHint: 'NC-DEMO-001 (HOLD)',
    steps: [
      {
        element: '[data-tour="qms-inspection-header"]',
        title: 'Inspection',
        description: 'Complete checklists using template TMPL-DEMO-001 against WO-DEMO-001.',
      },
      {
        route: '/qms/non-conformance',
        element: '[data-tour="qms-nc-header"]',
        title: 'Non-conformance',
        description:
          'NC-DEMO-001 is on HOLD — blocks MES and WMS until a supervisor dispositions it.',
      },
      {
        route: '/qms/checklist-builder',
        element: '[data-tour="qms-builder-header"]',
        title: 'Checklist builder',
        description: 'Configure pass/fail and measurement criteria (Manager/Admin).',
      },
    ],
  },
  {
    id: 'cmms',
    title: 'CMMS',
    description: 'Assets and maintenance work orders',
    suggestedLogin: 'technician@arcncode.local',
    startRoute: '/cmms/work-orders',
    demoEntityHint: 'MWO-DEMO-001',
    steps: [
      {
        element: '[data-tour="cmms-wo-header"]',
        title: 'Maintenance queue',
        description: 'MWO-DEMO-001 is open on ASSET-DEMO-001. Technicians start and complete here.',
      },
      {
        route: '/cmms/assets',
        element: '[data-tour="cmms-assets-header"]',
        title: 'Assets',
        description: 'ASSET-DEMO-001 is linked to WS-LASER with PM rules.',
      },
    ],
  },
  {
    id: 'returns',
    title: 'Returns & RMA',
    description: 'Return merchandise authorization',
    suggestedLogin: 'support@arcncode.local',
    startRoute: '/returns/queue',
    demoEntityHint: 'RMA-DEMO-001 through RMA-DEMO-004',
    steps: [
      {
        element: '[data-tour="returns-queue-header"]',
        title: 'Returns queue',
        description:
          'Four demo RMAs show REQUESTED, APPROVED, RECEIVED, and RESOLVED (with CM-DEMO-001).',
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    description: 'Dashboards, NLQ, bottlenecks, forecasts',
    suggestedLogin: 'manager@arcncode.local',
    startRoute: '/analytics/dashboard',
    demoEntityHint: '30-day demo events, WS-LASER bottleneck',
    steps: [
      {
        element: '[data-tour="analytics-dashboard-header"]',
        title: 'Dashboard',
        description: 'Event volume and scrap rate from 30 days of demo ingestion.',
      },
      {
        route: '/analytics/ask',
        element: '[data-tour="analytics-ask-header"]',
        title: 'Ask',
        description: 'Try: "scrap rate last month" or "event volume this week".',
      },
      {
        route: '/analytics/bottlenecks',
        element: '[data-tour="analytics-bottlenecks-header"]',
        title: 'Bottlenecks',
        description: 'WIP pileup by workstation — WS-LASER from seed data.',
      },
      {
        route: '/analytics/forecast',
        element: '[data-tour="analytics-forecast-header"]',
        title: 'Forecast',
        description: 'Inventory depletion projections for SKU-DEMO-001. Recompute as Manager.',
      },
    ],
  },
];

export function getTourById(id: string): ModuleTour | undefined {
  return TUTORIAL_MODULES.find((t) => t.id === id);
}
