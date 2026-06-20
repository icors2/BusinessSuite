import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProcurementType,
  RequisitionStatus,
  WorkOrderStatus,
} from '@prisma/client';
import { AuditService } from 'audit';
import { PrismaService } from 'database';
import { EVENT_BUS, EventBus } from 'event-bus';
import { InventoryService } from 'wms';
import {
  aggregateRequirements,
  explodeBom,
  ProductInput,
} from './explosion';
import { calculateNetDemand } from './net-demand';
import { MRP_EVENTS } from './events';
import { computeNeedByDate, toDateOnly } from './requisitions';
import {
  ListRequisitionsInput,
  ListRequirementsInput,
  ReviewRequisitionInput,
  UpsertBomInput,
} from './schemas';

const bomInclude = {
  product: true,
  lines: {
    include: { component: true },
    orderBy: { createdAt: 'asc' as const },
  },
};

const requisitionInclude = {
  component: true,
  preferredVendor: true,
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  return value.toNumber();
}

@Injectable()
export class MrpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventoryService: InventoryService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async runMrp(actorId?: string) {
    const workOrders = await this.fetchOpenWorkOrders();
    const { bomMap, productMap } = await this.loadBomContext();

    const exploded = explodeBom(workOrders, bomMap, productMap);
    const aggregated = aggregateRequirements(exploded, computeNeedByDate);

    const productIds = [...new Set(aggregated.map((r) => r.productId))];
    const inventoryByProduct = await this.loadInventoryMap(productIds);
    const pendingByKey = await this.loadPendingRequisitionsMap();
    const openPoByProduct = new Map<string, number>(); // Phase 10: open PO netting

    const netRequirements = calculateNetDemand(
      aggregated,
      inventoryByProduct,
      pendingByKey,
      openPoByProduct,
    );

    let created = 0;
    let updated = 0;

    for (const req of netRequirements) {
      if (req.netQty <= 0) {
        continue;
      }

      const needByDate = toDateOnly(req.needByDate);
      const existing = await this.prisma.purchaseRequisition.findUnique({
        where: {
          componentProductId_needByDate: {
            componentProductId: req.productId,
            needByDate,
          },
        },
      });

      if (existing) {
        if (existing.status !== RequisitionStatus.PENDING) {
          continue;
        }
        await this.prisma.purchaseRequisition.update({
          where: { id: existing.id },
          data: {
            quantity: req.netQty,
            demandRefs: req.workOrderIds,
            preferredVendorId: req.preferredVendorId,
          },
        });
        updated += 1;
      } else {
        const reqNumber = await this.nextReqNumber();
        const requisition = await this.prisma.purchaseRequisition.create({
          data: {
            reqNumber,
            componentProductId: req.productId,
            quantity: req.netQty,
            needByDate,
            status: RequisitionStatus.PENDING,
            preferredVendorId: req.preferredVendorId,
            demandRefs: req.workOrderIds,
          },
        });
        created += 1;

        await this.eventBus.publish(MRP_EVENTS.requisition.created, {
          entityId: requisition.id,
          actorId,
          payload: {
            requisitionId: requisition.id,
            reqNumber: requisition.reqNumber,
            componentProductId: requisition.componentProductId,
            quantity: toNumber(requisition.quantity),
            needByDate: requisition.needByDate,
          },
        });
      }
    }

    await this.eventBus.publish(MRP_EVENTS.run.completed, {
      entityId: `mrp-run-${Date.now()}`,
      actorId,
      payload: {
        workOrdersProcessed: workOrders.length,
        requisitionsCreated: created,
        requisitionsUpdated: updated,
      },
    });

    await this.audit.record({
      actorId,
      action: 'mrp.run.completed',
      entityType: 'MrpRun',
      entityId: `mrp-run-${Date.now()}`,
      metadata: {
        workOrdersProcessed: workOrders.length,
        requisitionsCreated: created,
        requisitionsUpdated: updated,
      },
    });

    return {
      workOrdersProcessed: workOrders.length,
      grossRequirements: aggregated.length,
      netRequirements,
      requisitionsCreated: created,
      requisitionsUpdated: updated,
    };
  }

  async getRequirements(input: ListRequirementsInput = {}) {
    const workOrders = await this.fetchOpenWorkOrders();
    const filtered = input.workOrderId
      ? workOrders.filter((wo) => wo.id === input.workOrderId)
      : workOrders;

    const { bomMap, productMap } = await this.loadBomContext();
    const exploded = explodeBom(filtered, bomMap, productMap);
    const aggregated = aggregateRequirements(exploded, computeNeedByDate);

    const productIds = [...new Set(aggregated.map((r) => r.productId))];
    const inventoryByProduct = await this.loadInventoryMap(productIds);
    const pendingByKey = await this.loadPendingRequisitionsMap();
    const openPoByProduct = new Map<string, number>();

    const netRequirements = calculateNetDemand(
      aggregated,
      inventoryByProduct,
      pendingByKey,
      openPoByProduct,
    );

    return {
      exploded,
      aggregated,
      netRequirements,
    };
  }

  async listRequisitions(input: ListRequisitionsInput) {
    const where: Prisma.PurchaseRequisitionWhereInput = {};
    if (input.status) {
      where.status = input.status;
    }
    if (input.componentProductId) {
      where.componentProductId = input.componentProductId;
    }

    const [items, total] = await Promise.all([
      this.prisma.purchaseRequisition.findMany({
        where,
        include: requisitionInclude,
        orderBy: { needByDate: 'asc' },
        skip: input.skip ?? 0,
        take: input.take ?? 50,
      }),
      this.prisma.purchaseRequisition.count({ where }),
    ]);

    return {
      items: items.map((r) => this.mapRequisition(r)),
      total,
    };
  }

  async reviewRequisition(input: ReviewRequisitionInput, actorId?: string) {
    const req = await this.prisma.purchaseRequisition.findUnique({
      where: { id: input.requisitionId },
      include: requisitionInclude,
    });
    if (!req) {
      throw new NotFoundException(
        `Requisition ${input.requisitionId} not found`,
      );
    }
    if (req.status !== RequisitionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot review requisition in status ${req.status}`,
      );
    }

    let data: Prisma.PurchaseRequisitionUpdateInput;
    if (input.action === 'APPROVE') {
      data = { status: RequisitionStatus.APPROVED };
    } else if (input.action === 'REJECT') {
      data = { status: RequisitionStatus.REJECTED };
    } else {
      if (input.quantity == null) {
        throw new BadRequestException('quantity required for ADJUST action');
      }
      data = { quantity: input.quantity };
    }

    const updated = await this.prisma.purchaseRequisition.update({
      where: { id: req.id },
      data,
      include: requisitionInclude,
    });

    await this.audit.record({
      actorId,
      action: `mrp.requisition.${input.action.toLowerCase()}`,
      entityType: 'PurchaseRequisition',
      entityId: updated.id,
      metadata: { reqNumber: updated.reqNumber, action: input.action },
    });

    return this.mapRequisition(updated);
  }

  async upsertBom(input: UpsertBomInput, actorId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${input.productId} not found`);
    }

    const existing = await this.prisma.billOfMaterials.findUnique({
      where: { productId: input.productId },
    });

    const bom = existing
      ? await this.prisma.billOfMaterials.update({
          where: { id: existing.id },
          data: {
            active: input.active ?? true,
            version: { increment: 1 },
            lines: {
              deleteMany: {},
              create: input.lines.map((line) => ({
                componentProductId: line.componentProductId,
                quantityPer: line.quantityPer,
                scrapFactor: line.scrapFactor ?? 0,
              })),
            },
          },
          include: bomInclude,
        })
      : await this.prisma.billOfMaterials.create({
          data: {
            productId: input.productId,
            active: input.active ?? true,
            lines: {
              create: input.lines.map((line) => ({
                componentProductId: line.componentProductId,
                quantityPer: line.quantityPer,
                scrapFactor: line.scrapFactor ?? 0,
              })),
            },
          },
          include: bomInclude,
        });

    await this.audit.record({
      actorId,
      action: existing ? 'mrp.bom.updated' : 'mrp.bom.created',
      entityType: 'BillOfMaterials',
      entityId: bom.id,
      metadata: { productId: input.productId, lineCount: input.lines.length },
    });

    return this.mapBom(bom);
  }

  async getBom(productId: string) {
    const bom = await this.prisma.billOfMaterials.findUnique({
      where: { productId },
      include: bomInclude,
    });
    if (!bom) {
      throw new NotFoundException(`BOM for product ${productId} not found`);
    }
    return this.mapBom(bom);
  }

  private async fetchOpenWorkOrders() {
    const orders = await this.prisma.workOrder.findMany({
      where: {
        status: {
          notIn: [WorkOrderStatus.CANCELLED, WorkOrderStatus.COMPLETED],
        },
      },
      include: { product: true },
      orderBy: { scheduledStart: 'asc' },
    });

    return orders.map((wo) => ({
      id: wo.id,
      productId: wo.productId,
      quantity: toNumber(wo.quantity),
      scheduledStart: wo.scheduledStart,
    }));
  }

  private async loadBomContext() {
    const [boms, products] = await Promise.all([
      this.prisma.billOfMaterials.findMany({
        where: { active: true },
        include: { lines: true },
      }),
      this.prisma.product.findMany({
        where: { active: true, deletedAt: null },
        include: { preferredVendor: true },
      }),
    ]);

    const bomMap = new Map<
      string,
      { componentProductId: string; quantityPer: number; scrapFactor: number }[]
    >();
    for (const bom of boms) {
      bomMap.set(
        bom.productId,
        bom.lines.map((line) => ({
          componentProductId: line.componentProductId,
          quantityPer: toNumber(line.quantityPer),
          scrapFactor: toNumber(line.scrapFactor),
        })),
      );
    }

    const productMap = new Map<string, ProductInput>();
    for (const p of products) {
      productMap.set(p.id, {
        id: p.id,
        sku: p.sku,
        procurementType: p.procurementType,
        leadTimeDays: p.leadTimeDays,
        preferredVendorId: p.preferredVendorId,
        vendorLeadTimeDays: p.preferredVendor?.leadTimeDays ?? 0,
      });
    }

    return { bomMap, productMap };
  }

  private async loadInventoryMap(
    productIds: string[],
  ): Promise<Map<string, number>> {
    const unique = [...new Set(productIds)];
    const map = new Map<string, number>();
    for (const productId of unique) {
      try {
        const lookup = await this.inventoryService.lookupByProduct({
          productId,
        });
        map.set(productId, lookup.totals.onHand);
      } catch {
        map.set(productId, 0);
      }
    }
    return map;
  }

  private async loadPendingRequisitionsMap(): Promise<Map<string, number>> {
    const pending = await this.prisma.purchaseRequisition.findMany({
      where: { status: RequisitionStatus.PENDING },
      select: { componentProductId: true, needByDate: true, quantity: true },
    });
    const map = new Map<string, number>();
    for (const req of pending) {
      const key = `${req.componentProductId}:${req.needByDate.toISOString().slice(0, 10)}`;
      map.set(key, (map.get(key) ?? 0) + toNumber(req.quantity));
    }
    return map;
  }

  private async nextReqNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PR-${year}-`;
    const existing = await this.prisma.purchaseRequisition.findMany({
      where: { reqNumber: { startsWith: prefix } },
      select: { reqNumber: true },
    });
    let maxSeq = 0;
    for (const row of existing) {
      const suffix = row.reqNumber.slice(prefix.length);
      const seq = Number(suffix);
      if (Number.isFinite(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  private mapRequisition(
    r: Prisma.PurchaseRequisitionGetPayload<{
      include: typeof requisitionInclude;
    }>,
  ) {
    return {
      id: r.id,
      reqNumber: r.reqNumber,
      componentProductId: r.componentProductId,
      component: r.component
        ? {
            id: r.component.id,
            sku: r.component.sku,
            description: r.component.description,
          }
        : null,
      quantity: toNumber(r.quantity),
      needByDate: r.needByDate,
      status: r.status,
      preferredVendorId: r.preferredVendorId,
      preferredVendor: r.preferredVendor
        ? { id: r.preferredVendor.id, name: r.preferredVendor.name }
        : null,
      demandRefs: r.demandRefs,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private mapBom(
    bom: Prisma.BillOfMaterialsGetPayload<{ include: typeof bomInclude }>,
  ) {
    return {
      id: bom.id,
      productId: bom.productId,
      product: bom.product
        ? { id: bom.product.id, sku: bom.product.sku }
        : null,
      active: bom.active,
      version: bom.version,
      lines: bom.lines.map((line) => ({
        id: line.id,
        componentProductId: line.componentProductId,
        component: line.component
          ? {
              id: line.component.id,
              sku: line.component.sku,
              description: line.component.description,
            }
          : null,
        quantityPer: toNumber(line.quantityPer),
        scrapFactor: toNumber(line.scrapFactor),
      })),
    };
  }
}
