import { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { trpc } from '../../lib/trpc';

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function money(n: number): string {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
  });
}

export function LaborCostPage() {
  const today = useMemo(() => new Date(), []);

  const [from, setFrom] = useState(() => {
    const d = new Date(today);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return toDateInput(d);
  });
  const [to, setTo] = useState(toDateInput(today));

  const reportQuery = trpc.workforce.getLaborCostReport.useQuery({
    from: new Date(`${from}T00:00:00.000Z`),
    to: new Date(`${to}T23:59:59.999Z`),
  });

  const report = reportQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold" data-tour="workforce-labor-header">Labor Cost Roll-up</h2>
        <p className="text-sm text-muted-foreground">
          Labor cost by work order and department for closed time entries.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date range</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div>
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {reportQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Loading report…</p>
      )}

      {report && (
        <>
          <p className="text-sm text-muted-foreground">
            {report.entryCount} time entries in range
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By work order</CardTitle>
              </CardHeader>
              <CardContent>
                {report.byWorkOrder.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2">Work order</th>
                        <th className="py-2 text-right">Minutes</th>
                        <th className="py-2 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byWorkOrder.map((row) => (
                        <tr key={row.workOrderId} className="border-b">
                          <td className="py-2 font-mono text-xs">
                            {row.workOrderId.slice(0, 8)}…
                          </td>
                          <td className="py-2 text-right">{row.totalMinutes}</td>
                          <td className="py-2 text-right">
                            {money(row.totalCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By department</CardTitle>
              </CardHeader>
              <CardContent>
                {report.byDepartment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2">Department</th>
                        <th className="py-2 text-right">Minutes</th>
                        <th className="py-2 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byDepartment.map((row) => (
                        <tr key={row.department} className="border-b">
                          <td className="py-2">{row.department}</td>
                          <td className="py-2 text-right">{row.totalMinutes}</td>
                          <td className="py-2 text-right">
                            {money(row.totalCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
