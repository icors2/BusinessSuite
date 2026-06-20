import { Injectable } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { PrismaService } from 'database';
import { roundMoney, toNumber } from './utils';

export interface AccountBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  balance: number;
}

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async profitAndLoss(from: Date, to: Date) {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          status: 'POSTED',
          date: { gte: from, lte: to },
        },
        account: {
          type: { in: ['REVENUE', 'EXPENSE'] },
        },
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    const byAccount = new Map<
      string,
      { code: string; name: string; type: AccountType; amount: number }
    >();

    for (const line of lines) {
      const key = line.accountId;
      const existing = byAccount.get(key) ?? {
        code: line.account.code,
        name: line.account.name,
        type: line.account.type,
        amount: 0,
      };

      const debit = toNumber(line.debit);
      const credit = toNumber(line.credit);

      if (line.account.type === 'REVENUE') {
        existing.amount += credit - debit;
      } else {
        existing.amount += debit - credit;
      }

      byAccount.set(key, existing);
    }

    const revenue = [...byAccount.values()]
      .filter((a) => a.type === 'REVENUE')
      .map((a) => ({
        code: a.code,
        name: a.name,
        amount: roundMoney(a.amount),
      }));

    const expenses = [...byAccount.values()]
      .filter((a) => a.type === 'EXPENSE')
      .map((a) => ({
        code: a.code,
        name: a.name,
        amount: roundMoney(a.amount),
      }));

    const totalRevenue = roundMoney(
      revenue.reduce((s, r) => s + r.amount, 0),
    );
    const totalExpenses = roundMoney(
      expenses.reduce((s, e) => s + e.amount, 0),
    );
    const netIncome = roundMoney(totalRevenue - totalExpenses);

    return {
      from,
      to,
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome,
    };
  }

  async balanceSheet(asOf: Date) {
    const accounts = await this.prisma.account.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });

    const balances: AccountBalanceRow[] = [];

    for (const account of accounts) {
      const balance = await this.computeBalance(account.id, account.type, asOf);
      if (balance !== 0 || ['ASSET', 'LIABILITY', 'EQUITY'].includes(account.type)) {
        balances.push({
          accountId: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          balance,
        });
      }
    }

    const assets = balances.filter((b) => b.type === 'ASSET');
    const liabilities = balances.filter((b) => b.type === 'LIABILITY');
    const equityAccounts = balances.filter((b) => b.type === 'EQUITY');

    const netIncome = await this.computeNetIncomeAllTime(asOf);

    const totalAssets = roundMoney(
      assets.reduce((s, a) => s + a.balance, 0),
    );
    const totalLiabilities = roundMoney(
      liabilities.reduce((s, l) => s + l.balance, 0),
    );
    const equityFromAccounts = roundMoney(
      equityAccounts.reduce((s, e) => s + e.balance, 0),
    );
    const retainedEarnings = netIncome;
    const totalEquity = roundMoney(equityFromAccounts + retainedEarnings);
    const totalLiabilitiesAndEquity = roundMoney(
      totalLiabilities + totalEquity,
    );

    return {
      asOf,
      assets,
      liabilities,
      equity: [
        ...equityAccounts.map((e) => ({
          code: e.code,
          name: e.name,
          balance: e.balance,
        })),
        {
          code: 'RE',
          name: 'Retained Earnings (Net Income)',
          balance: retainedEarnings,
        },
      ],
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      balanced: totalAssets === totalLiabilitiesAndEquity,
    };
  }

  private async computeBalance(
    accountId: string,
    type: AccountType,
    asOf: Date,
  ): Promise<number> {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          status: 'POSTED',
          date: { lte: asOf },
        },
      },
    });

    let balance = 0;
    for (const line of lines) {
      const debit = toNumber(line.debit);
      const credit = toNumber(line.credit);
      if (type === 'ASSET' || type === 'EXPENSE') {
        balance += debit - credit;
      } else {
        balance += credit - debit;
      }
    }
    return roundMoney(balance);
  }

  private async computeNetIncomeAllTime(asOf: Date): Promise<number> {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          status: 'POSTED',
          date: { lte: asOf },
        },
        account: {
          type: { in: ['REVENUE', 'EXPENSE'] },
        },
      },
      include: { account: { select: { type: true } } },
    });

    let revenue = 0;
    let expense = 0;
    for (const line of lines) {
      const debit = toNumber(line.debit);
      const credit = toNumber(line.credit);
      if (line.account.type === 'REVENUE') {
        revenue += credit - debit;
      } else {
        expense += debit - credit;
      }
    }
    return roundMoney(revenue - expense);
  }
}
