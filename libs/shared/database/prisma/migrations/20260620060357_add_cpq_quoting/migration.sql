-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QuoteLineKind" AS ENUM ('PRODUCT', 'FABRICATED');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "priceTier" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "listPrice" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdById" TEXT,
    "sentAt" TIMESTAMP(3),
    "pricingSnapshot" JSONB,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "kind" "QuoteLineKind" NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "manualUnitPrice" DECIMAL(18,4),
    "overrideReason" TEXT,
    "lineTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fabInput" JSONB,
    "costBreakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpqMaterial" (
    "id" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "standardCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "uom" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "uomProcess" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "cutSpeedInMin" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pierceTimeSecs" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpqMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpqCatalogPart" (
    "id" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "itemType" TEXT,
    "source" TEXT NOT NULL,
    "standardCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpqCatalogPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpqSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpqSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");

-- CreateIndex
CREATE INDEX "Quote_createdAt_idx" ON "Quote"("createdAt");

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_idx" ON "QuoteLine"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteLine_productId_idx" ON "QuoteLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteLine_quoteId_lineNumber_key" ON "QuoteLine"("quoteId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CpqMaterial_itemNumber_key" ON "CpqMaterial"("itemNumber");

-- CreateIndex
CREATE INDEX "CpqMaterial_active_idx" ON "CpqMaterial"("active");

-- CreateIndex
CREATE UNIQUE INDEX "CpqCatalogPart_itemNumber_key" ON "CpqCatalogPart"("itemNumber");

-- CreateIndex
CREATE INDEX "CpqCatalogPart_active_idx" ON "CpqCatalogPart"("active");

-- CreateIndex
CREATE INDEX "CpqCatalogPart_source_idx" ON "CpqCatalogPart"("source");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
