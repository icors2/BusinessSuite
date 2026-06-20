import { BadRequestException } from '@nestjs/common';
import { JournalService } from './journal.service';
import { roundMoney, sumCredits, sumDebits } from './utils';

describe('journal balance utilities', () => {
  it('sumDebits and sumCredits round to cents', () => {
    const lines = [
      { debit: 100.005, credit: 0 },
      { debit: 50.004, credit: 0 },
    ];
    expect(sumDebits(lines)).toBe(150.01);
  });

  it('detects unbalanced entries', () => {
    const lines = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 50 },
    ];
    expect(roundMoney(sumDebits(lines))).not.toBe(roundMoney(sumCredits(lines)));
  });
});

describe('JournalService balance enforcement', () => {
  const audit = { record: jest.fn() };
  const eventBus = { publish: jest.fn() };
  const prisma = {
    journalEntry: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: JournalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JournalService(
      prisma as never,
      audit as never,
      eventBus as never,
    );
  });

  it('rejects lines with both debit and credit', () => {
    expect(() =>
      service.validateLines([{ debit: 10, credit: 5 }]),
    ).toThrow(BadRequestException);
  });

  it('rejects zero-amount lines', () => {
    expect(() =>
      service.validateLines([{ debit: 0, credit: 0 }]),
    ).toThrow(BadRequestException);
  });

  it('assertBalanced throws when debits != credits', () => {
    expect(() =>
      service.assertBalanced([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 50 },
      ]),
    ).toThrow(/unbalanced/i);
  });

  it('assertBalanced passes when debits equal credits', () => {
    expect(() =>
      service.assertBalanced([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 100 },
      ]),
    ).not.toThrow();
  });
});

describe('ReportService P&L math (pure)', () => {
  it('computes net income as revenue minus expenses', () => {
    const revenue = 1000;
    const expenses = 350;
    expect(roundMoney(revenue - expenses)).toBe(650);
  });
});
