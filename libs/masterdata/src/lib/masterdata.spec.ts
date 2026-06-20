import { ConflictException } from '@nestjs/common';
import { ProductService } from './product.service';
import { CustomerService, normalizeAddress } from './customer.service';

describe('normalizeAddress', () => {
  it('normalizes address fields for comparison', () => {
    expect(
      normalizeAddress({
        line1: ' 100 Main St ',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'US',
      }),
    ).toBe(
      normalizeAddress({
        line1: '100 main st',
        city: 'chicago',
        state: 'il',
        postalCode: '60601',
        country: 'US',
      }),
    );
  });

  it('returns empty string for missing address', () => {
    expect(normalizeAddress(undefined)).toBe('');
    expect(normalizeAddress(null)).toBe('');
  });
});

describe('ProductService validation', () => {
  const prisma = {
    product: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { record: jest.fn() };
  const eventBus = { publish: jest.fn() };

  const service = new ProductService(
    prisma as never,
    audit as never,
    eventBus as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects duplicate SKU on create', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'existing', sku: 'SKU-001' });

    await expect(
      service.create({
        sku: 'SKU-001',
        description: 'Test',
        unitOfMeasure: 'EA',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('allows unique SKU on create', async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue({
      id: 'new-id',
      sku: 'SKU-NEW',
      description: 'Test',
      unitOfMeasure: 'EA',
    });

    const result = await service.create({
      sku: 'SKU-NEW',
      description: 'Test',
      unitOfMeasure: 'EA',
    });

    expect(result.sku).toBe('SKU-NEW');
    expect(eventBus.publish).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();
  });
});

describe('CustomerService validation', () => {
  const prisma = {
    customer: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { record: jest.fn() };
  const eventBus = { publish: jest.fn() };

  const service = new CustomerService(
    prisma as never,
    audit as never,
    eventBus as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects duplicate customer by name and billing address', async () => {
    prisma.customer.findMany.mockResolvedValue([
      {
        id: 'existing',
        name: 'Acme Corp',
        billingAddress: {
          line1: '100 Main',
          city: 'Chicago',
          state: 'IL',
          postalCode: '60601',
          country: 'US',
        },
      },
    ]);

    await expect(
      service.create({
        name: 'Acme Corp',
        billingAddress: {
          line1: '100 Main',
          city: 'Chicago',
          state: 'IL',
          postalCode: '60601',
          country: 'US',
        },
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('allows same name with different billing address', async () => {
    prisma.customer.findMany.mockResolvedValue([
      {
        id: 'existing',
        name: 'Acme Corp',
        billingAddress: {
          line1: '100 Main',
          city: 'Chicago',
          state: 'IL',
          postalCode: '60601',
          country: 'US',
        },
      },
    ]);
    prisma.customer.create.mockResolvedValue({
      id: 'new-id',
      name: 'Acme Corp',
    });

    const result = await service.create({
      name: 'Acme Corp',
      billingAddress: {
        line1: '200 Oak',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60602',
        country: 'US',
      },
    });

    expect(result.name).toBe('Acme Corp');
  });
});
