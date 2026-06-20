-- CreateEnum
CREATE TYPE "MpsStrategy" AS ENUM ('WEEKLY', 'MONTHLY', 'BUILD_TO_ORDER');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PROPOSED', 'FIRM', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "mpsStrategy" "MpsStrategy";

-- CreateTable
CREATE TABLE "ProductionLine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "capacityPerDay" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryCalendarDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactoryCalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "woNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lineId" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PROPOSED',
    "strategy" "MpsStrategy" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "demandRefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MpsSetting" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "strategy" "MpsStrategy" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MpsSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionLine_code_key" ON "ProductionLine"("code");

-- CreateIndex
CREATE INDEX "ProductionLine_active_idx" ON "ProductionLine"("active");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryCalendarDay_date_key" ON "FactoryCalendarDay"("date");

-- CreateIndex
CREATE INDEX "FactoryCalendarDay_isWorkingDay_idx" ON "FactoryCalendarDay"("isWorkingDay");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_woNumber_key" ON "WorkOrder"("woNumber");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "WorkOrder_productId_idx" ON "WorkOrder"("productId");

-- CreateIndex
CREATE INDEX "WorkOrder_periodKey_idx" ON "WorkOrder"("periodKey");

-- CreateIndex
CREATE INDEX "WorkOrder_scheduledStart_idx" ON "WorkOrder"("scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "MpsSetting_scope_key" ON "MpsSetting"("scope");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
