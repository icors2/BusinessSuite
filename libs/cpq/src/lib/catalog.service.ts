import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'database';
import { FormulaCatalog } from './formulas';
import {
  CPQ_SETTING_KEYS,
  PricingConfig,
  RateCard,
} from './rate-card';
import { priceProductLine } from './pricing';
import {
  CpqCatalogPartRecord,
  CpqMaterialRecord,
  InMemoryEngineCatalog,
} from './engine';

@Injectable()
export class CpqCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async loadRateCard(): Promise<RateCard> {
    const row = await this.prisma.cpqSetting.findUnique({
      where: { key: CPQ_SETTING_KEYS.rateCard },
    });
    return RateCard.fromDict(row?.value as Record<string, unknown>);
  }

  async loadPricingConfig(): Promise<PricingConfig> {
    const row = await this.prisma.cpqSetting.findUnique({
      where: { key: CPQ_SETTING_KEYS.pricingConfig },
    });
    return PricingConfig.fromDict(row?.value as Record<string, unknown>);
  }

  async loadFormulas(): Promise<FormulaCatalog> {
    const row = await this.prisma.cpqSetting.findUnique({
      where: { key: CPQ_SETTING_KEYS.formulaOverrides },
    });
    const raw = row?.value as { overrides?: Record<string, string> } | null;
    return new FormulaCatalog(raw?.overrides ?? {});
  }

  async getSettings() {
    const [rateCard, pricingConfig, formulas] = await Promise.all([
      this.loadRateCard(),
      this.loadPricingConfig(),
      this.loadFormulas(),
    ]);
    return {
      rateCard: rateCard.toDict(),
      pricingConfig: pricingConfig.toDict(),
      formulas: formulas.toAdminDict(),
    };
  }

  async updateRateCard(data: Record<string, unknown>) {
    const current = await this.loadRateCard();
    const merged = RateCard.fromDict({ ...current.toDict(), ...data });
    await this.prisma.cpqSetting.upsert({
      where: { key: CPQ_SETTING_KEYS.rateCard },
      create: {
        key: CPQ_SETTING_KEYS.rateCard,
        value: merged.toDict() as unknown as Prisma.InputJsonValue,
      },
      update: { value: merged.toDict() as unknown as Prisma.InputJsonValue },
    });
    return merged.toDict();
  }

  async updatePricingConfig(data: Record<string, unknown>) {
    const current = await this.loadPricingConfig();
    const merged = PricingConfig.fromDict({ ...current.toDict(), ...data });
    await this.prisma.cpqSetting.upsert({
      where: { key: CPQ_SETTING_KEYS.pricingConfig },
      create: {
        key: CPQ_SETTING_KEYS.pricingConfig,
        value: merged.toDict() as unknown as Prisma.InputJsonValue,
      },
      update: { value: merged.toDict() as unknown as Prisma.InputJsonValue },
    });
    return merged.toDict();
  }

  async updateFormulas(overrides: Record<string, string>) {
    const formulas = await this.loadFormulas();
    const merged = formulas.validateAll(overrides);
    await this.prisma.cpqSetting.upsert({
      where: { key: CPQ_SETTING_KEYS.formulaOverrides },
      create: {
        key: CPQ_SETTING_KEYS.formulaOverrides,
        value: { overrides: merged } as Prisma.InputJsonValue,
      },
      update: { value: { overrides: merged } as Prisma.InputJsonValue },
    });
    return new FormulaCatalog(merged).toAdminDict();
  }

  async buildEngineCatalog(
    itemNumbers: string[] = [],
  ): Promise<InMemoryEngineCatalog> {
    const catalog = new InMemoryEngineCatalog();
    const unique = [...new Set(itemNumbers.filter(Boolean))];
    if (unique.length) {
      const [materials, parts] = await Promise.all([
        this.prisma.cpqMaterial.findMany({
          where: { itemNumber: { in: unique }, active: true },
        }),
        this.prisma.cpqCatalogPart.findMany({
          where: { itemNumber: { in: unique }, active: true },
        }),
      ]);
      for (const m of materials) {
        catalog.addMaterial({
          itemNumber: m.itemNumber,
          description: m.description,
          standardCost: Number(m.standardCost),
          uom: Number(m.uom),
          uomProcess: Number(m.uomProcess),
          cutSpeedInMin: Number(m.cutSpeedInMin),
          pierceTimeSecs: Number(m.pierceTimeSecs),
        });
      }
      for (const p of parts) {
        catalog.addPart({
          itemNumber: p.itemNumber,
          description: p.description,
          itemType: p.itemType ?? '',
          standardCost: Number(p.standardCost),
        });
      }
    }
    return catalog;
  }

  /** Sync catalog wrapper for engine (material/part lookups are async in DB). */
  async materialRecord(itemNumber: string): Promise<CpqMaterialRecord | null> {
    const row = await this.prisma.cpqMaterial.findFirst({
      where: { itemNumber, active: true },
    });
    if (!row) return null;
    return {
      itemNumber: row.itemNumber,
      description: row.description,
      standardCost: Number(row.standardCost),
      uom: Number(row.uom),
      uomProcess: Number(row.uomProcess),
      cutSpeedInMin: Number(row.cutSpeedInMin),
      pierceTimeSecs: Number(row.pierceTimeSecs),
    };
  }

  async partRecord(itemNumber: string): Promise<CpqCatalogPartRecord | null> {
    const row = await this.prisma.cpqCatalogPart.findFirst({
      where: { itemNumber, active: true },
    });
    if (!row) return null;
    return {
      itemNumber: row.itemNumber,
      description: row.description,
      itemType: row.itemType ?? '',
      standardCost: Number(row.standardCost),
    };
  }

  private searchTokens(query: string): string[] {
    return (query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  async searchMaterials(query: string, limit = 25) {
    const terms = this.searchTokens(query);
    const rows = await this.prisma.cpqMaterial.findMany({
      where: { active: true },
      take: 200,
      orderBy: { itemNumber: 'asc' },
    });
    const filtered = rows
      .map((r) => {
        const hay = `${r.itemNumber} ${r.description}`.toLowerCase();
        if (terms.length && !terms.every((t) => hay.includes(t))) return null;
        const score = hay.startsWith(query.trim().toLowerCase()) ? 0 : 1;
        return { score, row: r };
      })
      .filter(Boolean) as Array<{ score: number; row: (typeof rows)[0] }>;
    filtered.sort((a, b) => a.score - b.score || a.row.itemNumber.localeCompare(b.row.itemNumber));
    return filtered.slice(0, limit).map(({ row }) => ({
      itemNumber: row.itemNumber,
      description: row.description,
      standardCost: Number(row.standardCost),
      uom: Number(row.uom),
      uomProcess: Number(row.uomProcess),
      cutSpeedInMin: Number(row.cutSpeedInMin),
      pierceTimeSecs: Number(row.pierceTimeSecs),
    }));
  }

  async searchParts(query: string, limit = 25) {
    const terms = this.searchTokens(query);
    const rows = await this.prisma.cpqCatalogPart.findMany({
      where: { active: true },
      take: 300,
      orderBy: { itemNumber: 'asc' },
    });
    const filtered = rows
      .map((r) => {
        const hay = `${r.itemNumber} ${r.description}`.toLowerCase();
        if (terms.length && !terms.every((t) => hay.includes(t))) return null;
        const score = hay.startsWith(query.trim().toLowerCase()) ? 0 : 1;
        return { score, row: r };
      })
      .filter(Boolean) as Array<{ score: number; row: (typeof rows)[0] }>;
    filtered.sort((a, b) => a.score - b.score || a.row.itemNumber.localeCompare(b.row.itemNumber));
    return filtered.slice(0, limit).map(({ row }) => ({
      itemNumber: row.itemNumber,
      description: row.description,
      itemType: row.itemType,
      source: row.source,
      standardCost: Number(row.standardCost),
    }));
  }

  async searchProducts(
    query: string,
    customerId: string | undefined,
    quantity: number,
    limit = 25,
  ) {
    const terms = this.searchTokens(query);
    const where: Prisma.ProductWhereInput = { deletedAt: null, active: true };
    if (terms.length) {
      where.OR = terms.map((t) => ({
        OR: [
          { sku: { contains: t, mode: 'insensitive' } },
          { description: { contains: t, mode: 'insensitive' } },
        ],
      }));
    }

    const [products, pricingConfig, customer] = await Promise.all([
      this.prisma.product.findMany({
        where,
        take: limit,
        orderBy: { sku: 'asc' },
      }),
      this.loadPricingConfig(),
      customerId
        ? this.prisma.customer.findUnique({ where: { id: customerId } })
        : Promise.resolve(null),
    ]);

    return products.map((p) => {
      const listPrice = p.listPrice != null ? Number(p.listPrice) : 0;
      const priced = priceProductLine(
        {
          listPrice,
          quantity,
          priceTier: customer?.priceTier,
        },
        pricingConfig,
      );
      return {
        id: p.id,
        sku: p.sku,
        description: p.description,
        unitOfMeasure: p.unitOfMeasure,
        category: p.category,
        listPrice,
        unitPrice: priced.unitPrice,
        discountPct: priced.discountPct,
      };
    });
  }
}
