import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { trpc } from '../../lib/trpc';

export function ReportsPage() {
  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [runPl, setRunPl] = useState(false);
  const [runBs, setRunBs] = useState(false);

  const plQuery = trpc.report.profitAndLoss.useQuery(
    { from: new Date(from), to: new Date(to) },
    { enabled: runPl },
  );
  const bsQuery = trpc.report.balanceSheet.useQuery(
    { asOf: new Date(asOf) },
    { enabled: runBs },
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Financial Reports</h2>
        <p className="text-sm text-muted-foreground">
          Profit &amp; Loss and Balance Sheet from posted journal entries
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profit &amp; Loss</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={() => setRunPl(true)}>Run P&amp;L</Button>
            {plQuery.data && (
              <div className="space-y-2 text-sm">
                <p className="font-medium">Revenue</p>
                {plQuery.data.revenue.map((r) => (
                  <div key={r.code} className="flex justify-between pl-2">
                    <span>
                      {r.code} {r.name}
                    </span>
                    <span>${r.amount.toFixed(2)}</span>
                  </div>
                ))}
                <p className="flex justify-between font-medium">
                  <span>Total Revenue</span>
                  <span>${plQuery.data.totalRevenue.toFixed(2)}</span>
                </p>
                <p className="font-medium pt-2">Expenses</p>
                {plQuery.data.expenses.map((e) => (
                  <div key={e.code} className="flex justify-between pl-2">
                    <span>
                      {e.code} {e.name}
                    </span>
                    <span>${e.amount.toFixed(2)}</span>
                  </div>
                ))}
                <p className="flex justify-between font-medium">
                  <span>Total Expenses</span>
                  <span>${plQuery.data.totalExpenses.toFixed(2)}</span>
                </p>
                <p className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>Net Income</span>
                  <span>${plQuery.data.netIncome.toFixed(2)}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance Sheet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>As of</Label>
              <Input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
              />
            </div>
            <Button onClick={() => setRunBs(true)}>Run Balance Sheet</Button>
            {bsQuery.data && (
              <div className="space-y-2 text-sm">
                <p className="font-medium">Assets</p>
                {bsQuery.data.assets.map((a) => (
                  <div key={a.code} className="flex justify-between pl-2">
                    <span>
                      {a.code} {a.name}
                    </span>
                    <span>${a.balance.toFixed(2)}</span>
                  </div>
                ))}
                <p className="flex justify-between font-medium">
                  <span>Total Assets</span>
                  <span>${bsQuery.data.totalAssets.toFixed(2)}</span>
                </p>
                <p className="font-medium pt-2">Liabilities</p>
                {bsQuery.data.liabilities.map((l) => (
                  <div key={l.code} className="flex justify-between pl-2">
                    <span>
                      {l.code} {l.name}
                    </span>
                    <span>${l.balance.toFixed(2)}</span>
                  </div>
                ))}
                <p className="font-medium pt-2">Equity</p>
                {bsQuery.data.equity.map((e) => (
                  <div key={e.code} className="flex justify-between pl-2">
                    <span>{e.name}</span>
                    <span>${e.balance.toFixed(2)}</span>
                  </div>
                ))}
                <p className="flex justify-between border-t pt-2 font-bold">
                  <span>Total L + E</span>
                  <span>
                    ${bsQuery.data.totalLiabilitiesAndEquity.toFixed(2)}
                    {bsQuery.data.balanced ? ' ✓' : ' (unbalanced)'}
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
