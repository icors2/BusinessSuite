-- CreateEnum
CREATE TYPE "MigrationBatchStatus" AS ENUM ('EXTRACTED', 'LOADED', 'RECONCILED', 'PROMOTED', 'ROLLED_BACK', 'FAILED');

-- CreateEnum
CREATE TYPE "StagingRecordStatus" AS ENUM ('PENDING', 'VALID', 'CONFLICT', 'PROMOTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MigrationEntityType" AS ENUM ('CUSTOMER', 'VENDOR', 'PRODUCT', 'QUOTE');

-- CreateTable
CREATE TABLE "MigrationBatch" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "status" "MigrationBatchStatus" NOT NULL DEFAULT 'EXTRACTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagingCustomer" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "StagingRecordStatus" NOT NULL DEFAULT 'PENDING',
    "conflictReason" TEXT,
    "promotedId" TEXT,
    "raw" JSONB NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "billingAddress" JSONB,
    "shippingAddress" JSONB,
    "creditTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StagingCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagingVendor" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "StagingRecordStatus" NOT NULL DEFAULT 'PENDING',
    "conflictReason" TEXT,
    "promotedId" TEXT,
    "raw" JSONB NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" JSONB,
    "paymentTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StagingVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagingProduct" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "StagingRecordStatus" NOT NULL DEFAULT 'PENDING',
    "conflictReason" TEXT,
    "promotedId" TEXT,
    "raw" JSONB NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "unitOfMeasure" TEXT,
    "category" TEXT,
    "inventoryOnHand" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StagingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagingQuote" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "StagingRecordStatus" NOT NULL DEFAULT 'PENDING',
    "conflictReason" TEXT,
    "promotedId" TEXT,
    "raw" JSONB NOT NULL,
    "customerSourceId" TEXT,
    "quoteNumber" TEXT,
    "status_legacy" TEXT,
    "totalAmount" DOUBLE PRECISION,
    "currency" TEXT,
    "quotedAt" TIMESTAMP(3),
    "lineItems" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StagingQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MigrationBatch_status_idx" ON "MigrationBatch"("status");

-- CreateIndex
CREATE INDEX "StagingCustomer_batchId_idx" ON "StagingCustomer"("batchId");

-- CreateIndex
CREATE INDEX "StagingCustomer_status_idx" ON "StagingCustomer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StagingCustomer_sourceSystem_sourceId_key" ON "StagingCustomer"("sourceSystem", "sourceId");

-- CreateIndex
CREATE INDEX "StagingVendor_batchId_idx" ON "StagingVendor"("batchId");

-- CreateIndex
CREATE INDEX "StagingVendor_status_idx" ON "StagingVendor"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StagingVendor_sourceSystem_sourceId_key" ON "StagingVendor"("sourceSystem", "sourceId");

-- CreateIndex
CREATE INDEX "StagingProduct_batchId_idx" ON "StagingProduct"("batchId");

-- CreateIndex
CREATE INDEX "StagingProduct_status_idx" ON "StagingProduct"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StagingProduct_sourceSystem_sourceId_key" ON "StagingProduct"("sourceSystem", "sourceId");

-- CreateIndex
CREATE INDEX "StagingQuote_batchId_idx" ON "StagingQuote"("batchId");

-- CreateIndex
CREATE INDEX "StagingQuote_status_idx" ON "StagingQuote"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StagingQuote_sourceSystem_sourceId_key" ON "StagingQuote"("sourceSystem", "sourceId");

-- AddForeignKey
ALTER TABLE "StagingCustomer" ADD CONSTRAINT "StagingCustomer_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MigrationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagingVendor" ADD CONSTRAINT "StagingVendor_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MigrationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagingProduct" ADD CONSTRAINT "StagingProduct_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MigrationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagingQuote" ADD CONSTRAINT "StagingQuote_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MigrationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
