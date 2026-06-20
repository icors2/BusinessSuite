-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('OPERATIONAL', 'DOWN', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PmTriggerType" AS ENUM ('CYCLE_COUNT', 'CALENDAR');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workstationId" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "cumulativeCycles" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PmTriggerRule" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "PmTriggerType" NOT NULL,
    "thresholdCycles" INTEGER,
    "intervalDays" INTEGER,
    "lastTriggeredCycles" INTEGER NOT NULL DEFAULT 0,
    "lastTriggeredAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmTriggerRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceWorkOrder" (
    "id" TEXT NOT NULL,
    "mwoNumber" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "triggerRuleId" TEXT,
    "type" "MaintenanceType" NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_code_key" ON "Asset"("code");

-- CreateIndex
CREATE INDEX "Asset_workstationId_idx" ON "Asset"("workstationId");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "PmTriggerRule_assetId_idx" ON "PmTriggerRule"("assetId");

-- CreateIndex
CREATE INDEX "PmTriggerRule_active_idx" ON "PmTriggerRule"("active");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWorkOrder_mwoNumber_key" ON "MaintenanceWorkOrder"("mwoNumber");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_assetId_idx" ON "MaintenanceWorkOrder"("assetId");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_status_idx" ON "MaintenanceWorkOrder"("status");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_triggerRuleId_idx" ON "MaintenanceWorkOrder"("triggerRuleId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmTriggerRule" ADD CONSTRAINT "PmTriggerRule_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_triggerRuleId_fkey" FOREIGN KEY ("triggerRuleId") REFERENCES "PmTriggerRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
