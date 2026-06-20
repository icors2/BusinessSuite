-- CreateEnum
CREATE TYPE "InspectionCriterionType" AS ENUM ('PASS_FAIL', 'MEASUREMENT');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "NonConformanceSource" AS ENUM ('INSPECTION', 'SCRAP');

-- CreateEnum
CREATE TYPE "NonConformanceSeverity" AS ENUM ('MINOR', 'MAJOR', 'HOLD');

-- CreateEnum
CREATE TYPE "NonConformanceStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "Disposition" AS ENUM ('USE_AS_IS', 'REWORK', 'SCRAP', 'RETURN_TO_VENDOR');

-- AlterTable
ALTER TABLE "Bin" ADD COLUMN     "onHold" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "onHold" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InspectionTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "productId" TEXT,
    "operationName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionCriterion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "type" "InspectionCriterionType" NOT NULL,
    "expectedMin" DECIMAL(18,4),
    "expectedMax" DECIMAL(18,4),
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionRecord" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "operationId" TEXT,
    "inspectorUserId" TEXT NOT NULL,
    "inspectorEmployeeId" TEXT,
    "result" "InspectionResult" NOT NULL,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionCriterionResult" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "passed" BOOLEAN,
    "measuredValue" DECIMAL(18,4),
    "photoObjectKey" TEXT,
    "photoFileName" TEXT,
    "notes" TEXT,

    CONSTRAINT "InspectionCriterionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NonConformanceRecord" (
    "id" TEXT NOT NULL,
    "ncNumber" TEXT NOT NULL,
    "source" "NonConformanceSource" NOT NULL,
    "inspectionId" TEXT,
    "workOrderId" TEXT,
    "binId" TEXT,
    "productId" TEXT,
    "severity" "NonConformanceSeverity" NOT NULL,
    "status" "NonConformanceStatus" NOT NULL DEFAULT 'OPEN',
    "holdActive" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "quantityScrapped" DECIMAL(18,4),
    "disposition" "Disposition",
    "dispositionNotes" TEXT,
    "raisedByUserId" TEXT NOT NULL,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NonConformanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InspectionTemplate_code_key" ON "InspectionTemplate"("code");

-- CreateIndex
CREATE INDEX "InspectionTemplate_productId_idx" ON "InspectionTemplate"("productId");

-- CreateIndex
CREATE INDEX "InspectionTemplate_active_idx" ON "InspectionTemplate"("active");

-- CreateIndex
CREATE INDEX "InspectionCriterion_templateId_idx" ON "InspectionCriterion"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionCriterion_templateId_sequence_key" ON "InspectionCriterion"("templateId", "sequence");

-- CreateIndex
CREATE INDEX "InspectionRecord_templateId_idx" ON "InspectionRecord"("templateId");

-- CreateIndex
CREATE INDEX "InspectionRecord_workOrderId_idx" ON "InspectionRecord"("workOrderId");

-- CreateIndex
CREATE INDEX "InspectionRecord_operationId_idx" ON "InspectionRecord"("operationId");

-- CreateIndex
CREATE INDEX "InspectionRecord_inspectorUserId_idx" ON "InspectionRecord"("inspectorUserId");

-- CreateIndex
CREATE INDEX "InspectionCriterionResult_inspectionId_idx" ON "InspectionCriterionResult"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionCriterionResult_inspectionId_criterionId_key" ON "InspectionCriterionResult"("inspectionId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "NonConformanceRecord_ncNumber_key" ON "NonConformanceRecord"("ncNumber");

-- CreateIndex
CREATE INDEX "NonConformanceRecord_status_idx" ON "NonConformanceRecord"("status");

-- CreateIndex
CREATE INDEX "NonConformanceRecord_workOrderId_idx" ON "NonConformanceRecord"("workOrderId");

-- CreateIndex
CREATE INDEX "NonConformanceRecord_binId_idx" ON "NonConformanceRecord"("binId");

-- CreateIndex
CREATE INDEX "NonConformanceRecord_holdActive_idx" ON "NonConformanceRecord"("holdActive");

-- CreateIndex
CREATE INDEX "Bin_onHold_idx" ON "Bin"("onHold");

-- CreateIndex
CREATE INDEX "WorkOrder_onHold_idx" ON "WorkOrder"("onHold");

-- AddForeignKey
ALTER TABLE "InspectionTemplate" ADD CONSTRAINT "InspectionTemplate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionCriterion" ADD CONSTRAINT "InspectionCriterion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRecord" ADD CONSTRAINT "InspectionRecord_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRecord" ADD CONSTRAINT "InspectionRecord_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRecord" ADD CONSTRAINT "InspectionRecord_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "WorkOrderOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionCriterionResult" ADD CONSTRAINT "InspectionCriterionResult_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "InspectionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionCriterionResult" ADD CONSTRAINT "InspectionCriterionResult_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "InspectionCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformanceRecord" ADD CONSTRAINT "NonConformanceRecord_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "InspectionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformanceRecord" ADD CONSTRAINT "NonConformanceRecord_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformanceRecord" ADD CONSTRAINT "NonConformanceRecord_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformanceRecord" ADD CONSTRAINT "NonConformanceRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
