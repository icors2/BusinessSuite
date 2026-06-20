-- CreateEnum
CREATE TYPE "WorkstationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkOrderStatus" ADD VALUE 'AWAITING_VERIFICATION';
ALTER TYPE "WorkOrderStatus" ADD VALUE 'VERIFIED';

-- CreateTable
CREATE TABLE "Workstation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkstationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workstation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderOperation" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workstationId" TEXT,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
    "standardMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleRecord" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "quantityCompleted" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "quantityScrapped" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderVerification" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "verifiedByUserId" TEXT NOT NULL,
    "verifiedByEmployeeId" TEXT,
    "notes" TEXT,
    "photoObjectKey" TEXT,
    "photoFileName" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workstation_code_key" ON "Workstation"("code");

-- CreateIndex
CREATE INDEX "Workstation_status_idx" ON "Workstation"("status");

-- CreateIndex
CREATE INDEX "WorkOrderOperation_workOrderId_idx" ON "WorkOrderOperation"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderOperation_workstationId_idx" ON "WorkOrderOperation"("workstationId");

-- CreateIndex
CREATE INDEX "WorkOrderOperation_status_idx" ON "WorkOrderOperation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderOperation_workOrderId_sequence_key" ON "WorkOrderOperation"("workOrderId", "sequence");

-- CreateIndex
CREATE INDEX "CycleRecord_operationId_idx" ON "CycleRecord"("operationId");

-- CreateIndex
CREATE INDEX "CycleRecord_employeeId_idx" ON "CycleRecord"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderVerification_workOrderId_key" ON "WorkOrderVerification"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderVerification_verifiedByUserId_idx" ON "WorkOrderVerification"("verifiedByUserId");

-- AddForeignKey
ALTER TABLE "WorkOrderOperation" ADD CONSTRAINT "WorkOrderOperation_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderOperation" ADD CONSTRAINT "WorkOrderOperation_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleRecord" ADD CONSTRAINT "CycleRecord_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "WorkOrderOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleRecord" ADD CONSTRAINT "CycleRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderVerification" ADD CONSTRAINT "WorkOrderVerification_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
