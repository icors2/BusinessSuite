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
  CreateCustomerInput,
  UpdateCustomerInput,
} from './schemas';

type AddressInput = CreateCustomerInput['billingAddress'];

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(input: CreateCustomerInput, actorId?: string) {
    const name = input.name.trim();
    await this.assertNotDuplicate(name, input.billingAddress);

    const customer = await this.prisma.customer.create({
      data: {
        name,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        billingAddress: input.billingAddress as Prisma.InputJsonValue,
        shippingAddress: input.shippingAddress as Prisma.InputJsonValue,
        creditTerms: input.creditTerms?.trim() || null,
      },
    });

    await this.audit.record({
      actorId,
      action: 'create',
      entityType: 'Customer',
      entityId: customer.id,
      metadata: { name: customer.name },
    });

    await this.eventBus.publish(MASTERDATA_EVENTS.customer.created, {
      entityId: customer.id,
      actorId,
      payload: { name: customer.name },
    });

    return customer;
  }

  async getById(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  async list(options: {
    search?: string;
    includeInactive?: boolean;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.CustomerWhereInput = {
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
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: options.skip ?? 0,
        take: options.take ?? 50,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, input: UpdateCustomerInput, actorId?: string) {
    const existing = await this.getById(id);
    const name = input.name?.trim() ?? existing.name;
    const billingAddress =
      input.billingAddress !== undefined
        ? input.billingAddress
        : (existing.billingAddress as AddressInput);

    if (input.name !== undefined || input.billingAddress !== undefined) {
      await this.assertNotDuplicate(name, billingAddress, id);
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.email !== undefined
          ? { email: input.email?.trim() || null }
          : {}),
        ...(input.phone !== undefined
          ? { phone: input.phone?.trim() || null }
          : {}),
        ...(input.billingAddress !== undefined
          ? { billingAddress: input.billingAddress as Prisma.InputJsonValue }
          : {}),
        ...(input.shippingAddress !== undefined
          ? { shippingAddress: input.shippingAddress as Prisma.InputJsonValue }
          : {}),
        ...(input.creditTerms !== undefined
          ? { creditTerms: input.creditTerms?.trim() || null }
          : {}),
      },
    });

    await this.audit.record({
      actorId,
      action: 'update',
      entityType: 'Customer',
      entityId: customer.id,
      metadata: { name: customer.name },
    });

    await this.eventBus.publish(MASTERDATA_EVENTS.customer.updated, {
      entityId: customer.id,
      actorId,
      payload: { name: customer.name },
    });

    return customer;
  }

  async deactivate(id: string, actorId?: string) {
    const existing = await this.getById(id);
    if (!existing.active) {
      return existing;
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });

    await this.audit.record({
      actorId,
      action: 'deactivate',
      entityType: 'Customer',
      entityId: customer.id,
      metadata: { name: customer.name },
    });

    await this.eventBus.publish(MASTERDATA_EVENTS.customer.deactivated, {
      entityId: customer.id,
      actorId,
      payload: { name: customer.name },
    });

    return customer;
  }

  async assertNotDuplicate(
    name: string,
    billingAddress?: AddressInput,
    excludeId?: string,
  ): Promise<void> {
    const normalizedName = name.trim().toLowerCase();
    const addressKey = normalizeAddress(billingAddress);

    const candidates = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    const duplicate = candidates.find(
      (c) =>
        c.name.trim().toLowerCase() === normalizedName &&
        normalizeAddress(c.billingAddress as AddressInput) === addressKey,
    );

    if (duplicate) {
      throw new ConflictException(
        `Customer "${name}" with the same billing address already exists`,
      );
    }
  }
}

export function normalizeAddress(address?: AddressInput | null): string {
  if (!address) {
    return '';
  }
  return JSON.stringify({
    line1: address.line1?.trim().toLowerCase() ?? '',
    line2: address.line2?.trim().toLowerCase() ?? '',
    city: address.city?.trim().toLowerCase() ?? '',
    state: address.state?.trim().toLowerCase() ?? '',
    postalCode: address.postalCode?.trim().toLowerCase() ?? '',
    country: (address.country ?? 'US').trim().toLowerCase(),
  });
}
