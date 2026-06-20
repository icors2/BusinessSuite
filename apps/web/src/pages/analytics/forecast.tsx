import { useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { getSession } from '../../lib/auth';
import { trpc } from '../../lib/trpc';
import { canEdit } from '../../lib/utils';

export function AnalyticsForecastPage() {
  const editable = canEdit(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');

  const forecastQuery = trpc.analytics.getForecasts.useQuery({ take: 50 });

  const recomputeMutation = trpc.analytics.recomputeForecasts.useMutation({
    onSuccess: (result) => {
      forecastQuery.refetch();
      setMessage(`Recomputed ${result.count} forecast(s)`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Inventory Forecast</h2>
          <p className="text-sm text-muted-foreground">
            Batch-computed depletion and reorder projections (MRP linkage advisory)
          </p>
        </div>
        {editable && (
          <Button
            onClick={() => recomputeMutation.mutate()}
            disabled={recomputeMutation.isPending}
          >
            Recompute forecasts
          </Button>
        )}
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}

      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Data freshness: batch-computed on demand. Reorder recommendations are
        advisory; full MRP auto-consumption is planned.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Forecasts</CardTitle>
        </CardHeader>
        <CardContent>
          {forecastQuery.isLoading && <p>Loading…</p>}
          {forecastQuery.data && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">SKU</th>
                    <th className="py-2 pr-4">On hand</th>
                    <th className="py-2 pr-4">Avg daily demand</th>
                    <th className="py-2 pr-4">Depletion</th>
                    <th className="py-2">Reorder by</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastQuery.data.items.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="py-2 pr-4">{row.product.sku}</td>
                      <td className="py-2 pr-4">{String(row.onHand)}</td>
                      <td className="py-2 pr-4">
                        {Number(row.avgDailyDemand).toFixed(2)}
                      </td>
                      <td className="py-2 pr-4">
                        {row.projectedDepletionDate
                          ? row.projectedDepletionDate.toISOString().slice(0, 10)
                          : '—'}
                      </td>
                      <td className="py-2">
                        {row.recommendedReorderDate
                          ? row.recommendedReorderDate.toISOString().slice(0, 10)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {forecastQuery.data.items.length === 0 && (
                <p className="py-4 text-muted-foreground">
                  No forecasts yet. Recompute to generate.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
