-- CreateEnum
CREATE TYPE "RmaStatus" AS ENUM ('REQUESTED', 'APPROVED', 'RECEIVED', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RmaResolutionType" AS ENUM ('REFUND', 'REPLACE', 'REPAIR', 'REJECT');

-- CreateEnum
CREATE TYPE "RmaReasonCode" AS ENUM ('DEFECTIVE', 'WRONG_ITEM', 'DAMAGED_IN_TRANSIT', 'NOT_AS_DESCRIBED', 'OTHER');

-- CreateEnum
CREATE TYPE "CreditMemoStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- AlterEnum
ALTER TYPE "NonConformanceSource" ADD VALUE 'RETURN';

-- CreateTable
CREATE TABLE "Rma" (
    "id" TEXT NOT NULL,
    "rmaNumber" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "salesOrderLineId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reasonCode" "RmaReasonCode" NOT NULL,
    "status" "RmaStatus" NOT NULL DEFAULT 'REQUESTED',
    "resolutionType" "RmaResolutionType",
    "quantity" DECIMAL(18,4) NOT NULL,
    "qualityRelated" BOOLEAN NOT NULL DEFAULT false,
    "nonConformanceId" TEXT,
    "returnedBinId" TEXT,
    "creditMemoId" TEXT,
    "notes" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "receivedByUserId" TEXT,
    "resolvedByUserId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditMemo" (
    "id" TEXT NOT NULL,
    "creditMemoNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "status" "CreditMemoStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "journalEntryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditMemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditMemoLine" (
    "id" TEXT NOT NULL,
    "creditMemoId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CreditMemoLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rma_rmaNumber_key" ON "Rma"("rmaNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Rma_nonConformanceId_key" ON "Rma"("nonConformanceId");

-- CreateIndex
CREATE UNIQUE INDEX "Rma_creditMemoId_key" ON "Rma"("creditMemoId");

-- CreateIndex
CREATE INDEX "Rma_salesOrderId_idx" ON "Rma"("salesOrderId");

-- CreateIndex
CREATE INDEX "Rma_customerId_idx" ON "Rma"("customerId");

-- CreateIndex
CREATE INDEX "Rma_status_idx" ON "Rma"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditMemo_creditMemoNumber_key" ON "CreditMemo"("creditMemoNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CreditMemo_journalEntryId_key" ON "CreditMemo"("journalEntryId");

-- CreateIndex
CREATE INDEX "CreditMemo_customerId_idx" ON "CreditMemo"("customerId");

-- CreateIndex
CREATE INDEX "CreditMemo_status_idx" ON "CreditMemo"("status");

-- CreateIndex
CREATE INDEX "CreditMemoLine_creditMemoId_idx" ON "CreditMemoLine"("creditMemoId");

-- AddForeignKey
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_nonConformanceId_fkey" FOREIGN KEY ("nonConformanceId") REFERENCES "NonConformanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_returnedBinId_fkey" FOREIGN KEY ("returnedBinId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rma" ADD CONSTRAINT "Rma_creditMemoId_fkey" FOREIGN KEY ("creditMemoId") REFERENCES "CreditMemo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditMemo" ADD CONSTRAINT "CreditMemo_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditMemo" ADD CONSTRAINT "CreditMemo_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditMemo" ADD CONSTRAINT "CreditMemo_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditMemoLine" ADD CONSTRAINT "CreditMemoLine_creditMemoId_fkey" FOREIGN KEY ("creditMemoId") REFERENCES "CreditMemo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
