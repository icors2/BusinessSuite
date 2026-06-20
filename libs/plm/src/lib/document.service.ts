import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DocumentStatus, Prisma } from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import { PLM_EVENTS } from './events';
import {
  AddRevisionMetaInput,
  CreateDocumentInput,
  DocumentStatusValue,
  ListDocumentsByProductInput,
} from './schemas';

const ALLOWED_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: [DocumentStatus.IN_REVIEW],
  IN_REVIEW: [DocumentStatus.RELEASED],
  RELEASED: [DocumentStatus.OBSOLETE],
  OBSOLETE: [],
};

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(input: CreateDocumentInput, actorId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException(`Product ${input.productId} not found`);
    }

    const document = await this.prisma.document.create({
      data: {
        productId: input.productId,
        name: input.name.trim(),
        docType: input.docType?.trim() || null,
      },
    });

    await this.audit.record({
      actorId,
      action: 'create',
      entityType: 'Document',
      entityId: document.id,
      metadata: { name: document.name, productId: document.productId },
    });

    return document;
  }

  async getById(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        revisions: { orderBy: { revisionNumber: 'desc' } },
        currentRevision: true,
        releasedRevision: true,
      },
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    return document;
  }

  async listByProduct(input: ListDocumentsByProductInput) {
    const where: Prisma.DocumentWhereInput = {
      productId: input.productId,
    };

    if (input.search?.trim()) {
      const search = input.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { docType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: input.skip ?? 0,
        take: input.take ?? 50,
        include: {
          currentRevision: true,
          releasedRevision: true,
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { items, total };
  }

  async getRevisions(documentId: string) {
    await this.assertDocumentExists(documentId);
    return this.prisma.documentRevision.findMany({
      where: { documentId },
      orderBy: { revisionNumber: 'desc' },
    });
  }

  async addRevision(
    documentId: string,
    input: AddRevisionMetaInput,
    actorId?: string,
  ) {
    const document = await this.assertDocumentExists(documentId);

    const latest = await this.prisma.documentRevision.findFirst({
      where: { documentId },
      orderBy: { revisionNumber: 'desc' },
      select: { revisionNumber: true },
    });

    const revisionNumber = (latest?.revisionNumber ?? 0) + 1;
    const isFirstRevision = revisionNumber === 1;
    const revisionId = input.revisionId ?? randomUUID();

    const revision = await this.prisma.$transaction(async (tx) => {
      const created = await tx.documentRevision.create({
        data: {
          id: revisionId,
          documentId,
          revisionNumber,
          status: DocumentStatus.DRAFT,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          objectKey: input.objectKey,
          notes: input.notes?.trim() || null,
          createdById: actorId ?? null,
        },
      });

      await tx.document.update({
        where: { id: documentId },
        data: { currentRevisionId: created.id },
      });

      return created;
    });

    await this.audit.record({
      actorId,
      action: isFirstRevision ? 'upload' : 'revise',
      entityType: 'DocumentRevision',
      entityId: revision.id,
      metadata: {
        documentId,
        revisionNumber,
        fileName: revision.fileName,
      },
    });

    const eventTopic = isFirstRevision
      ? PLM_EVENTS.document.uploaded
      : PLM_EVENTS.document.revised;

    await this.eventBus.publish(eventTopic, {
      entityId: document.id,
      actorId,
      payload: {
        documentId,
        revisionId: revision.id,
        revisionNumber,
        fileName: revision.fileName,
        productId: document.productId,
      },
    });

    return revision;
  }

  async transitionStatus(
    revisionId: string,
    targetStatus: DocumentStatusValue,
    actorId?: string,
  ) {
    const revision = await this.prisma.documentRevision.findUnique({
      where: { id: revisionId },
      include: { document: true },
    });

    if (!revision) {
      throw new NotFoundException(`Revision ${revisionId} not found`);
    }

    const currentStatus = revision.status;
    const target = targetStatus as DocumentStatus;

    if (currentStatus === target) {
      return revision;
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Cannot transition revision from ${currentStatus} to ${target}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (target === DocumentStatus.RELEASED) {
        await tx.documentRevision.updateMany({
          where: {
            documentId: revision.documentId,
            status: DocumentStatus.RELEASED,
            NOT: { id: revisionId },
          },
          data: { status: DocumentStatus.OBSOLETE },
        });
      }

      const result = await tx.documentRevision.update({
        where: { id: revisionId },
        data: { status: target },
      });

      if (target === DocumentStatus.RELEASED) {
        await tx.document.update({
          where: { id: revision.documentId },
          data: { releasedRevisionId: revisionId },
        });
      }

      return result;
    });

    await this.audit.record({
      actorId,
      action: 'transition',
      entityType: 'DocumentRevision',
      entityId: revisionId,
      metadata: {
        documentId: revision.documentId,
        from: currentStatus,
        to: target,
      },
    });

    if (target === DocumentStatus.RELEASED) {
      await this.eventBus.publish(PLM_EVENTS.document.released, {
        entityId: revision.documentId,
        actorId,
        payload: {
          documentId: revision.documentId,
          revisionId,
          revisionNumber: revision.revisionNumber,
          productId: revision.document.productId,
        },
      });
    }

    return updated;
  }

  async getRevisionForDownload(documentId: string, revisionId?: string) {
    if (revisionId) {
      const revision = await this.prisma.documentRevision.findFirst({
        where: { id: revisionId, documentId },
      });
      if (!revision) {
        throw new NotFoundException(
          `Revision ${revisionId} not found for document ${documentId}`,
        );
      }
      return revision;
    }

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { releasedRevision: true },
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    if (document.releasedRevision) {
      return document.releasedRevision;
    }

    const latestReleased = await this.prisma.documentRevision.findFirst({
      where: { documentId, status: DocumentStatus.RELEASED },
      orderBy: { revisionNumber: 'desc' },
    });

    if (!latestReleased) {
      throw new NotFoundException(
        `No released revision found for document ${documentId}`,
      );
    }

    return latestReleased;
  }

  async getRevisionById(revisionId: string) {
    const revision = await this.prisma.documentRevision.findUnique({
      where: { id: revisionId },
      include: { document: true },
    });

    if (!revision) {
      throw new NotFoundException(`Revision ${revisionId} not found`);
    }

    return revision;
  }

  private async assertDocumentExists(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    return document;
  }
}
