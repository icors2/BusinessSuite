import {
  AccountService,
  BillService,
  InvoiceService,
  JournalService,
  PaymentService,
  ReportService,
} from 'finance';
import { DocumentService } from 'plm';
import { createAccountRouter } from './routers/account.router';
import { createBillRouter } from './routers/bill.router';
import { createDocumentRouter } from './routers/document.router';
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
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
