import { BadRequestException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { DocumentService } from './document.service';

describe('DocumentService', () => {
  const prisma = {
    product: { findFirst: jest.fn() },
    document: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    documentRevision: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const eventBus = { publish: jest.fn() };

  const service = new DocumentService(
    prisma as never,
    audit as never,
    eventBus as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
  });

  describe('addRevision', () => {
    it('increments revision number per document', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        productId: 'prod-1',
      });
      prisma.documentRevision.findFirst.mockResolvedValue({ revisionNumber: 2 });
      prisma.documentRevision.create.mockResolvedValue({
        id: 'rev-3',
        documentId: 'doc-1',
        revisionNumber: 3,
        status: DocumentStatus.DRAFT,
        fileName: 'spec.pdf',
      });
      prisma.document.update.mockResolvedValue({});

      const revision = await service.addRevision('doc-1', {
        fileName: 'spec.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        objectKey: 'documents/doc-1/rev-3-spec.pdf',
      });

      expect(revision.revisionNumber).toBe(3);
      expect(prisma.documentRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revisionNumber: 3 }),
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        'plm.document.revised',
        expect.any(Object),
      );
    });

    it('starts at revision 1 when no prior revisions exist', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        productId: 'prod-1',
      });
      prisma.documentRevision.findFirst.mockResolvedValue(null);
      prisma.documentRevision.create.mockResolvedValue({
        id: 'rev-1',
        revisionNumber: 1,
        status: DocumentStatus.DRAFT,
      });
      prisma.document.update.mockResolvedValue({});

      await service.addRevision('doc-1', {
        fileName: 'drawing.png',
        mimeType: 'image/png',
        sizeBytes: 512,
        objectKey: 'documents/doc-1/rev-1-drawing.png',
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        'plm.document.uploaded',
        expect.any(Object),
      );
    });
  });

  describe('transitionStatus', () => {
    it('rejects illegal transition from DRAFT to RELEASED', async () => {
      prisma.documentRevision.findUnique.mockResolvedValue({
        id: 'rev-1',
        documentId: 'doc-1',
        revisionNumber: 1,
        status: DocumentStatus.DRAFT,
        document: { id: 'doc-1', productId: 'prod-1' },
      });

      await expect(
        service.transitionStatus('rev-1', 'RELEASED'),
      ).rejects.toThrow(BadRequestException);
    });

    it('obsoletes prior RELEASED revision when releasing a new one', async () => {
      prisma.documentRevision.findUnique.mockResolvedValue({
        id: 'rev-2',
        documentId: 'doc-1',
        revisionNumber: 2,
        status: DocumentStatus.IN_REVIEW,
        document: { id: 'doc-1', productId: 'prod-1' },
      });
      prisma.documentRevision.updateMany.mockResolvedValue({ count: 1 });
      prisma.documentRevision.update.mockResolvedValue({
        id: 'rev-2',
        status: DocumentStatus.RELEASED,
      });
      prisma.document.update.mockResolvedValue({});

      await service.transitionStatus('rev-2', 'RELEASED');

      expect(prisma.documentRevision.updateMany).toHaveBeenCalledWith({
        where: {
          documentId: 'doc-1',
          status: DocumentStatus.RELEASED,
          NOT: { id: 'rev-2' },
        },
        data: { status: DocumentStatus.OBSOLETE },
      });
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { releasedRevisionId: 'rev-2' },
      });
      expect(eventBus.publish).toHaveBeenCalledWith(
        'plm.document.released',
        expect.any(Object),
      );
    });
  });
});
