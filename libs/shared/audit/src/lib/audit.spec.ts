import { AuditService } from './audit.service';
import { PrismaService } from 'database';

describe('AuditService', () => {
  it('records audit entries via prisma', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { auditLog: { create } } as unknown as PrismaService;
    const service = new AuditService(prisma);

    await service.record({
      actorId: 'user-1',
      action: 'test.action',
      entityType: 'Test',
      entityId: 'entity-1',
      metadata: { foo: 'bar' },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-1',
        action: 'test.action',
        entityType: 'Test',
        entityId: 'entity-1',
        metadata: { foo: 'bar' },
      },
    });
  });
});
