import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { CreateBinInput, CreateLocationInput } from './schemas';

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createLocation(input: CreateLocationInput, actorId?: string) {
    const code = input.code.trim().toUpperCase();
    await this.assertLocationCodeUnique(code);

    const location = await this.prisma.location.create({
      data: {
        code,
        name: input.name.trim(),
        type: input.type?.trim() || null,
      },
    });

    await this.audit.record({
      actorId,
      action: 'create',
      entityType: 'Location',
      entityId: location.id,
      metadata: { code: location.code },
    });

    return location;
  }

  async listLocations(options: {
    search?: string;
    includeInactive?: boolean;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.LocationWhereInput = {
      ...(options.includeInactive ? {} : { active: true }),
    };

    if (options.search?.trim()) {
      const search = options.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.location.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: options.skip ?? 0,
        take: options.take ?? 50,
        include: { _count: { select: { bins: true } } },
      }),
      this.prisma.location.count({ where }),
    ]);

    return { items, total };
  }

  async createBin(input: CreateBinInput, actorId?: string) {
    const location = await this.prisma.location.findFirst({
      where: { id: input.locationId, active: true },
    });
    if (!location) {
      throw new NotFoundException(`Location ${input.locationId} not found`);
    }

    const code = input.code.trim().toUpperCase();
    await this.assertBinCodeUnique(code);

    const bin = await this.prisma.bin.create({
      data: {
        locationId: input.locationId,
        code,
        description: input.description?.trim() || null,
      },
      include: { location: true },
    });

    await this.audit.record({
      actorId,
      action: 'create',
      entityType: 'Bin',
      entityId: bin.id,
      metadata: { code: bin.code, locationId: bin.locationId },
    });

    return bin;
  }

  async listBins(options: {
    locationId?: string;
    search?: string;
    includeInactive?: boolean;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.BinWhereInput = {
      ...(options.locationId ? { locationId: options.locationId } : {}),
      ...(options.includeInactive ? {} : { active: true }),
    };

    if (options.search?.trim()) {
      const search = options.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.bin.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: options.skip ?? 0,
        take: options.take ?? 50,
        include: { location: true },
      }),
      this.prisma.bin.count({ where }),
    ]);

    return { items, total };
  }

  async getBinByCode(code: string) {
    const bin = await this.prisma.bin.findFirst({
      where: { code: code.trim().toUpperCase(), active: true },
      include: { location: true },
    });
    if (!bin) {
      throw new NotFoundException(`Bin ${code} not found`);
    }
    return bin;
  }

  async getLocationByCode(code: string) {
    const location = await this.prisma.location.findFirst({
      where: { code: code.trim().toUpperCase(), active: true },
    });
    if (!location) {
      throw new NotFoundException(`Location ${code} not found`);
    }
    return location;
  }

  private async assertLocationCodeUnique(code: string): Promise<void> {
    const existing = await this.prisma.location.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(`Location code "${code}" already exists`);
    }
  }

  private async assertBinCodeUnique(code: string): Promise<void> {
    const existing = await this.prisma.bin.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(`Bin code "${code}" already exists`);
    }
  }
}
