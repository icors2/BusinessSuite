import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import { MASTERDATA_EVENTS } from './events';
import {
  CreateProductInput,
  UpdateProductInput,
} from './schemas';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(input: CreateProductInput, actorId?: string) {
    const sku = input.sku.trim();
    await this.assertSkuUnique(sku);

    const product = await this.prisma.product.create({
      data: {
        sku,
        description: input.description.trim(),
        unitOfMeasure: input.unitOfMeasure.trim(),
        category: input.category?.trim() || null,
      },
    });

    await this.audit.record({
      actorId,
      action: 'create',
      entityType: 'Product',
      entityId: product.id,
      metadata: { sku: product.sku },
    });

    await this.eventBus.publish(MASTERDATA_EVENTS.product.created, {
      entityId: product.id,
      actorId,
      payload: { sku: product.sku, description: product.description },
    });

    return product;
  }

  async getById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async list(options: {
    search?: string;
    includeInactive?: boolean;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(options.includeInactive ? {} : { active: true }),
    };

    if (options.search?.trim()) {
      const search = options.search.trim();
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { sku: 'asc' },
        skip: options.skip ?? 0,
        take: options.take ?? 50,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, input: UpdateProductInput, actorId?: string) {
    const existing = await this.getById(id);

    if (input.sku !== undefined) {
      const sku = input.sku.trim();
      if (sku !== existing.sku) {
        await this.assertSkuUnique(sku, id);
      }
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(input.sku !== undefined ? { sku: input.sku.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() }
          : {}),
        ...(input.unitOfMeasure !== undefined
          ? { unitOfMeasure: input.unitOfMeasure.trim() }
          : {}),
        ...(input.category !== undefined
          ? { category: input.category?.trim() || null }
          : {}),
      },
    });

    await this.audit.record({
      actorId,
      action: 'update',
      entityType: 'Product',
      entityId: product.id,
      metadata: { sku: product.sku },
    });

    await this.eventBus.publish(MASTERDATA_EVENTS.product.updated, {
      entityId: product.id,
      actorId,
      payload: { sku: product.sku },
    });

    return product;
  }

  async deactivate(id: string, actorId?: string) {
    const existing = await this.getById(id);
    if (!existing.active) {
      return existing;
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });

    await this.audit.record({
      actorId,
      action: 'deactivate',
      entityType: 'Product',
      entityId: product.id,
      metadata: { sku: product.sku },
    });

    await this.eventBus.publish(MASTERDATA_EVENTS.product.deactivated, {
      entityId: product.id,
      actorId,
      payload: { sku: product.sku },
    });

    return product;
  }

  async assertSkuUnique(sku: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.product.findFirst({
      where: {
        sku: { equals: sku, mode: 'insensitive' },
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(`Product SKU "${sku}" already exists`);
    }
  }
}
