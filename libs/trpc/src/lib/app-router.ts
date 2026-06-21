import {
  AccountService,
  BillService,
  InvoiceService,
  JournalService,
  PaymentService,
  ReportService,
} from 'finance';
import { DocumentService } from 'plm';
import { InventoryService, LocationService } from 'wms';
import { CpqCatalogService, QuoteService } from 'cpq';
import { SalesOrderService } from 'sales';
import { MpsService } from 'mps';
import { MrpService } from 'mrp';
import { ProcurementService } from 'procurement';
import { WorkforceService } from 'workforce';
import { MesService } from 'mes';
import { QmsService } from 'qms';
import { CmmsService } from 'cmms';
import { ReturnsService } from 'returns';
import { AnalyticsService } from 'analytics';
import { AdminService } from 'admin';
import { createAccountRouter } from './routers/account.router';
import { createBillRouter } from './routers/bill.router';
import { createDocumentRouter } from './routers/document.router';
import { createInventoryRouter } from './routers/inventory.router';
import { createCpqCatalogRouter, createQuoteRouter } from './routers/quote.router';
import { createSalesOrderRouter } from './routers/sales-order.router';
import { createMpsRouter } from './routers/mps.router';
import { createMrpRouter } from './routers/mrp.router';
import { createProcurementRouter } from './routers/procurement.router';
import { createWorkforceRouter } from './routers/workforce.router';
import { createMesRouter } from './routers/mes.router';
import { createQmsRouter } from './routers/qms.router';
import { createCmmsRouter } from './routers/cmms.router';
import { createReturnsRouter } from './routers/returns.router';
import { createAnalyticsRouter } from './routers/analytics.router';
import { createAdminRouter } from './routers/admin.router';
import { createInvoiceRouter } from './routers/invoice.router';
import { createJournalRouter } from './routers/journal.router';
import { createReportRouter } from './routers/report.router';
import { createProductRouter } from './routers/product.router';
import { createCustomerRouter } from './routers/customer.router';
import { createVendorRouter } from './routers/vendor.router';
import { router } from './trpc';
import {
  CustomerService,
  ProductService,
  VendorService,
} from 'masterdata';

export interface AppRouterDependencies {
  productService: ProductService;
  customerService: CustomerService;
  vendorService: VendorService;
  accountService: AccountService;
  journalService: JournalService;
  invoiceService: InvoiceService;
  billService: BillService;
  paymentService: PaymentService;
  reportService: ReportService;
  documentService: DocumentService;
  inventoryService: InventoryService;
  locationService: LocationService;
  quoteService: QuoteService;
  cpqCatalogService: CpqCatalogService;
  salesOrderService: SalesOrderService;
  mpsService: MpsService;
  mrpService: MrpService;
  procurementService: ProcurementService;
  workforceService: WorkforceService;
  mesService: MesService;
  qmsService: QmsService;
  cmmsService: CmmsService;
  returnsService: ReturnsService;
  analyticsService: AnalyticsService;
  adminService: AdminService;
}

export function createAppRouter(deps: AppRouterDependencies) {
  return router({
    product: createProductRouter(deps.productService),
    customer: createCustomerRouter(deps.customerService),
    vendor: createVendorRouter(deps.vendorService),
    account: createAccountRouter(deps.accountService),
    journal: createJournalRouter(deps.journalService),
    invoice: createInvoiceRouter(deps.invoiceService, deps.paymentService),
    bill: createBillRouter(deps.billService, deps.paymentService),
    report: createReportRouter(deps.reportService),
    document: createDocumentRouter(deps.documentService),
    inventory: createInventoryRouter(
      deps.inventoryService,
      deps.locationService,
    ),
    quote: createQuoteRouter(deps.quoteService),
    cpqCatalog: createCpqCatalogRouter(deps.cpqCatalogService),
    salesOrder: createSalesOrderRouter(deps.salesOrderService),
    mps: createMpsRouter(deps.mpsService),
    mrp: createMrpRouter(deps.mrpService),
    procurement: createProcurementRouter(deps.procurementService),
    workforce: createWorkforceRouter(deps.workforceService),
    mes: createMesRouter(deps.mesService),
    qms: createQmsRouter(deps.qmsService),
    cmms: createCmmsRouter(deps.cmmsService),
    returns: createReturnsRouter(deps.returnsService),
    analytics: createAnalyticsRouter(deps.analyticsService),
    admin: createAdminRouter(deps.adminService),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
