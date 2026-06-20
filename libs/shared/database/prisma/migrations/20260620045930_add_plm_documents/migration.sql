-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'RELEASED', 'OBSOLETE');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "docType" TEXT,
    "currentRevisionId" TEXT,
    "releasedRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRevision" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_currentRevisionId_key" ON "Document"("currentRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_releasedRevisionId_key" ON "Document"("releasedRevisionId");

-- CreateIndex
CREATE INDEX "Document_productId_idx" ON "Document"("productId");

-- CreateIndex
CREATE INDEX "Document_name_idx" ON "Document"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRevision_objectKey_key" ON "DocumentRevision"("objectKey");

-- CreateIndex
CREATE INDEX "DocumentRevision_documentId_idx" ON "DocumentRevision"("documentId");

-- CreateIndex
CREATE INDEX "DocumentRevision_status_idx" ON "DocumentRevision"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRevision_documentId_revisionNumber_key" ON "DocumentRevision"("documentId", "revisionNumber");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "DocumentRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_releasedRevisionId_fkey" FOREIGN KEY ("releasedRevisionId") REFERENCES "DocumentRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRevision" ADD CONSTRAINT "DocumentRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
