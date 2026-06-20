-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey" TEXT NOT NULL,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryForecast" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "avgDailyDemand" DECIMAL(18,4) NOT NULL,
    "onHand" DECIMAL(18,4) NOT NULL,
    "projectedDepletionDate" DATE,
    "recommendedReorderDate" DATE,
    "leadTimeDays" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryForecast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsEvent_dedupeKey_key" ON "AnalyticsEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_topic_idx" ON "AnalyticsEvent"("topic");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_module_idx" ON "AnalyticsEvent"("module");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "InventoryForecast_productId_idx" ON "InventoryForecast"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryForecast_productId_asOfDate_key" ON "InventoryForecast"("productId", "asOfDate");

-- AddForeignKey
ALTER TABLE "InventoryForecast" ADD CONSTRAINT "InventoryForecast_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
