import { useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { getSession } from '../../lib/auth';
import { trpc } from '../../lib/trpc';
import { canEdit } from '../../lib/utils';

const statusClass: Record<string, string> = {
  PROPOSED: 'bg-slate-200 text-slate-800',
  FIRM: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const strategyLabel: Record<string, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  BUILD_TO_ORDER: 'Build-to-Order',
};

export function MpsDashboardPage() {
  const editable = canEdit(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const previewQuery = trpc.mps.previewDemand.useQuery({});
  const workOrdersQuery = trpc.mps.listWorkOrders.useQuery({ take: 100 });
  const linesQuery = trpc.mps.listLines.useQuery();

  const generateMutation = trpc.mps.generateSchedule.useMutation({
    onSuccess: (result) => {
      previewQuery.refetch();
      workOrdersQuery.refetch();
      setMessage(
        `Generated ${result.created.length} work order(s)${
          result.overloads.length > 0
            ? ` — ${result.overloads.length} overload warning(s)`
            : ''
        }`,
      );
    },
  });

  const rescheduleMutation = trpc.mps.rescheduleWorkOrder.useMutation({
    onSuccess: () => {
      workOrdersQuery.refetch();
      setRescheduleId(null);
      setMessage('Work order rescheduled');
    },
  });

  const workOrders = workOrdersQuery.data?.items ?? [];
  const overloadCount =
    previewQuery.data?.netBuckets.filter((b) => b.netQty > 0).length ?? 0;

  const byPeriod = workOrders.reduce<
    Record<string, typeof workOrders>
  >((acc, wo) => {
    const key = wo.periodKey;
    acc[key] = acc[key] ?? [];
    acc[key].push(wo);
    return acc;
  }, {});

  function handleReschedule(woId: string) {
    if (!newStart || !newEnd) return;
    rescheduleMutation.mutate({
      workOrderId: woId,
      scheduledStart: new Date(newStart),
      scheduledEnd: new Date(newEnd),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Master Production Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Demand aggregation, capacity planning, and work order scheduling
          </p>
        </div>
        {editable && (
          <Button
            onClick={() =>
              generateMutation.mutate({ replaceExisting: true })
            }
            disabled={generateMutation.isPending}
          >
            Generate schedule
          </Button>
        )}
      </div>

      {message && (
        <p className="rounded bg-slate-100 px-3 py-2 text-sm">{message}</p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Demand preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {previewQuery.isLoading && <p>Loading…</p>}
            {previewQuery.data && (
              <>
                <p>
                  Gross buckets:{' '}
                  <span className="font-medium">
                    {previewQuery.data.summary.grossLines}
                  </span>
                </p>
                <p>
                  Net work orders needed:{' '}
                  <span className="font-medium">{overloadCount}</span>
                </p>
                <p>
                  Skipped lines:{' '}
                  <span className="font-medium">
                    {previewQuery.data.summary.skippedCount}
                  </span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production lines</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {linesQuery.isLoading && <p>Loading…</p>}
            {linesQuery.data?.map((line) => (
              <div key={line.id} className="mb-2 flex justify-between">
                <span>{line.code}</span>
                <span className="text-muted-foreground">
                  {line.capacityPerDay}/day
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              Work orders:{' '}
              <span className="font-medium">{workOrders.length}</span>
            </p>
            <p>
              Periods:{' '}
              <span className="font-medium">
                {Object.keys(byPeriod).length}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {previewQuery.data?.netBuckets.some((b) => b.netQty > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Net demand by period</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Strategy</th>
                  <th className="py-2 pr-4">Gross</th>
                  <th className="py-2 pr-4">Inventory</th>
                  <th className="py-2 pr-4">Scheduled</th>
                  <th className="py-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {previewQuery.data.netBuckets
                  .filter((b) => b.netQty > 0)
                  .map((b) => (
                    <tr key={`${b.productId}-${b.periodKey}`} className="border-b">
                      <td className="py-2 pr-4">{b.productSku}</td>
                      <td className="py-2 pr-4">{b.periodKey}</td>
                      <td className="py-2 pr-4">
                        {strategyLabel[b.strategy] ?? b.strategy}
                      </td>
                      <td className="py-2 pr-4">{b.grossQty}</td>
                      <td className="py-2 pr-4">{b.inventoryApplied}</td>
                      <td className="py-2 pr-4">{b.alreadyScheduled}</td>
                      <td className="py-2 font-medium">{b.netQty}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Scheduled work orders</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {workOrdersQuery.isLoading && <p>Loading…</p>}
          {!workOrdersQuery.isLoading && workOrders.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No work orders yet. Generate a schedule to plan production.
            </p>
          )}
          {Object.entries(byPeriod).map(([periodKey, orders]) => (
            <div key={periodKey} className="mb-6">
              <h3 className="mb-2 font-medium">{periodKey}</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">WO #</th>
                    <th className="py-2 pr-4">Product</th>
                    <th className="py-2 pr-4">Line</th>
                    <th className="py-2 pr-4">Qty</th>
                    <th className="py-2 pr-4">Start</th>
                    <th className="py-2 pr-4">End</th>
                    <th className="py-2 pr-4">Status</th>
                    {editable && <th className="py-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((wo) => (
                    <tr key={wo.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 pr-4 font-medium">{wo.woNumber}</td>
                      <td className="py-2 pr-4">{wo.product?.sku ?? '—'}</td>
                      <td className="py-2 pr-4">{wo.line?.code ?? '—'}</td>
                      <td className="py-2 pr-4">{wo.quantity}</td>
                      <td className="py-2 pr-4">
                        {new Date(wo.scheduledStart).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4">
                        {new Date(wo.scheduledEnd).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass[wo.status] ?? ''}`}
                        >
                          {wo.status}
                        </span>
                      </td>
                      {editable && (
                        <td className="py-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRescheduleId(wo.id);
                              setNewStart(
                                new Date(wo.scheduledStart)
                                  .toISOString()
                                  .slice(0, 10),
                              );
                              setNewEnd(
                                new Date(wo.scheduledEnd)
                                  .toISOString()
                                  .slice(0, 10),
                              );
                            }}
                          >
                            Reschedule
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </CardContent>
      </Card>

      {rescheduleId && editable && (
        <Card>
          <CardHeader>
            <CardTitle>Reschedule work order</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div>
              <Label htmlFor="newStart">Start</Label>
              <Input
                id="newStart"
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="newEnd">End</Label>
              <Input
                id="newEnd"
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
              />
            </div>
            <Button onClick={() => handleReschedule(rescheduleId)}>
              Save
            </Button>
            <Button variant="outline" onClick={() => setRescheduleId(null)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
