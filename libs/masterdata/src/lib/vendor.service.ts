import {
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
  CreateVendorInput,
  UpdateVendorInput,
} from './schemas';

@Injectable()
export class VendorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(input: CreateVendorInput, actorId?: string) {
    const vendor = await this.prisma.vendor.create({
      data: {
        name: input.name.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address as Prisma.InputJsonValue,
        paymentTerms: input.paymentTerms?.trim() || null,
      },
    });

    await this.audit.record({
      actorId,
      action: 'create',
      entityType: 'Vendor',
      entityId: vendor.id,
      metadata: { name: vendor.name },
    });

    await this.eventBus.publish(MASTERDATA_EVENTS.vendor.created, {
      entityId: vendor.id,
      actorId,
      payload: { name: vendor.name },
    });

    return vendor;
  }

  async getById(id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, deletedAt: null },
    });
    if (!vendor) {
      throw new NotFoundException(`Vendor ${id} not found`);
    }
    return vendor;
  }

  async list(options: {
    search?: string;
    includeInactive?: boolean;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.VendorWhereInput = {
      deletedAt: null,
      ...(options.includeInactive ? {} : { active: true }),
    };

    if (options.search?.trim()) {
      const search = options.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: options.skip ?? 0,
        take: options.take ?? 50,
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, input: UpdateVendorInput, actorId?: string) {
    await this.getById(id);

    const vendor = await this.prisma.vendor.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.email !== undefined
          ? { email: input.email?.trim() || null }
          : {}),
        ...(input.phone !== undefined
          ? { phone: input.phone?.trim() || null }
          : {}),
        ...(input.address !== undefined
          ? { address: input.address as Prisma.InputJsonValue }
          : {}),
        ...(input.paymentTerms !== undefined
          ? { paymentTerms: input.paymentTerms?.trim() || null }
          : {}),
      },
    });

    await this.audit.record({
      actorId,
      action: 'update',
      entityType: 'Vendor',
      entityId: vendor.id,
      metadata: { name: vendor.name },
    });

    await this.eventBus.publish(MASTERDATA_EVENTS.vendor.updated, {
      entityId: vendor.id,
      actorId,
      payload: { name: vendor.name },
    });

    return vendor;
  }

  async deactivate(id: string, actorId?: string) {
    const existing = await this.getById(id);
    if (!existing.active) {
      return existing;
    }

    const vendor = await this.prisma.vendor.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });

    await this.audit.record({
      actorId,
      action: 'deactivate',
      entityType: 'Vendor',
      entityId: vendor.id,
      metadata: { name: vendor.name },
    });

    await this.eventBus.publish(MASTERDATA_EVENTS.vendor.deactivated, {
      entityId: vendor.id,
      actorId,
      payload: { name: vendor.name },
    });

    return vendor;
  }
}
