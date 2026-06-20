import { Link } from 'react-router-dom';
import { FormEvent, useMemo, useState } from 'react';
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
import { canSupport } from '../../lib/utils';

const statusClass: Record<string, string> = {
  REQUESTED: 'bg-amber-100 text-amber-900',
  APPROVED: 'bg-blue-100 text-blue-900',
  RECEIVED: 'bg-indigo-100 text-indigo-900',
  RESOLVED: 'bg-emerald-100 text-emerald-900',
  REJECTED: 'bg-red-100 text-red-900',
};

type ReasonCode =
  | 'DEFECTIVE'
  | 'WRONG_ITEM'
  | 'DAMAGED_IN_TRANSIT'
  | 'NOT_AS_DESCRIBED'
  | 'OTHER';

export function ReturnsQueuePage() {
  const allowed = canSupport(getSession()?.roles ?? []);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [message, setMessage] = useState('');
  const [lineId, setLineId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reasonCode, setReasonCode] = useState<ReasonCode>('DEFECTIVE');
  const [qualityRelated, setQualityRelated] = useState(false);
  const [notes, setNotes] = useState('');

  const listQuery = trpc.returns.listRmas.useQuery({
    take: 50,
    status: statusFilter
      ? (statusFilter as
          | 'REQUESTED'
          | 'APPROVED'
          | 'RECEIVED'
          | 'RESOLVED'
          | 'REJECTED')
      : undefined,
  });

  const shippedOrdersQuery = trpc.salesOrder.list.useQuery(
    { take: 50, status: 'SHIPPED' },
    { enabled: allowed },
  );
  const partialOrdersQuery = trpc.salesOrder.list.useQuery(
    { take: 50, status: 'PARTIALLY_SHIPPED' },
    { enabled: allowed },
  );

  const shippedLineOptions = useMemo(() => {
    const orders = [
      ...(shippedOrdersQuery.data?.items ?? []),
      ...(partialOrdersQuery.data?.items ?? []),
    ];
    return orders.flatMap((order) =>
      order.lines
        .filter((line) => Number(line.qtyShipped) > 0)
        .map((line) => ({
          id: line.id,
          label: `${order.orderNumber} · line ${line.lineNumber} — ${line.description} (shipped ${line.qtyShipped})`,
        })),
    );
  }, [shippedOrdersQuery.data, partialOrdersQuery.data]);

  const requestMutation = trpc.returns.requestRma.useMutation({
    onSuccess: (rma) => {
      listQuery.refetch();
      setMessage(`RMA ${rma.rmaNumber} requested`);
      setLineId('');
      setQuantity('1');
      setNotes('');
    },
    onError: (err) => setMessage(err.message),
  });

  function handleRequest(e: FormEvent) {
    e.preventDefault();
    if (!lineId) return;
    requestMutation.mutate({
      salesOrderLineId: lineId,
      reasonCode,
      quantity: Number(quantity),
      qualityRelated: qualityRelated || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-tour="returns-queue-header">Returns & RMA</h2>
        <p className="text-sm text-muted-foreground">
          Request, approve, receive, and resolve customer returns
        </p>
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}

      {allowed && (
        <Card>
          <CardHeader>
            <CardTitle>Request RMA</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={handleRequest}
            >
              <div className="md:col-span-2">
                <Label>Shipped order line</Label>
                <select
                  className="w-full rounded border px-3 py-2"
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                  required
                >
                  <option value="">Select a shipped line</option>
                  {shippedLineOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={0.0001}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Reason</Label>
                <select
                  className="w-full rounded border px-3 py-2"
                  value={reasonCode}
                  onChange={(e) =>
                    setReasonCode(e.target.value as ReasonCode)
                  }
                >
                  <option value="DEFECTIVE">Defective</option>
                  <option value="WRONG_ITEM">Wrong item</option>
                  <option value="DAMAGED_IN_TRANSIT">Damaged in transit</option>
                  <option value="NOT_AS_DESCRIBED">Not as described</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={qualityRelated}
                    onChange={(e) => setQualityRelated(e.target.checked)}
                  />
                  Quality-related (creates QMS non-conformance on receive)
                </label>
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <textarea
                  className="w-full rounded border px-3 py-2"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={!lineId}>
                Submit RMA request
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>RMA queue</CardTitle>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="REQUESTED">Requested</option>
            <option value="APPROVED">Approved</option>
            <option value="RECEIVED">Received</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading && <p>Loading…</p>}
          {listQuery.data && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">RMA #</th>
                    <th className="py-2 pr-4">Order</th>
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Qty</th>
                    <th className="py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.data.items.map((rma) => (
                    <tr key={rma.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 pr-4">
                        <Link
                          to={`/returns/${rma.id}`}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {rma.rmaNumber}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        {rma.salesOrder?.orderNumber}
                      </td>
                      <td className="py-2 pr-4">{rma.customer?.name}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass[rma.status] ?? ''}`}
                        >
                          {rma.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{String(rma.quantity)}</td>
                      <td className="py-2">{rma.reasonCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {listQuery.data.items.length === 0 && (
                <p className="py-4 text-muted-foreground">No RMAs found.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
