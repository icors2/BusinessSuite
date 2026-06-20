import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { getSession } from '../../lib/auth';
import { trpc } from '../../lib/trpc';
import { canSupport } from '../../lib/utils';

type ResolutionType = 'REFUND' | 'REPLACE' | 'REPAIR' | 'REJECT';

export function ReturnsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const allowed = canSupport(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');
  const [resolutionType, setResolutionType] =
    useState<ResolutionType>('REFUND');
  const [binCode, setBinCode] = useState('RET-01');
  const [notes, setNotes] = useState('');

  const rmaQuery = trpc.returns.getRma.useQuery(
    { id: id! },
    { enabled: !!id },
  );

  const refetch = () => {
    rmaQuery.refetch();
  };

  const approveMutation = trpc.returns.approveRma.useMutation({
    onSuccess: () => {
      refetch();
      setMessage('RMA approved');
    },
    onError: (err) => setMessage(err.message),
  });

  const rejectMutation = trpc.returns.rejectRma.useMutation({
    onSuccess: () => {
      refetch();
      setMessage('RMA rejected');
    },
    onError: (err) => setMessage(err.message),
  });

  const receiveMutation = trpc.returns.receiveRma.useMutation({
    onSuccess: () => {
      refetch();
      setMessage('Return received into WMS');
    },
    onError: (err) => setMessage(err.message),
  });

  const resolveMutation = trpc.returns.resolveRma.useMutation({
    onSuccess: () => {
      refetch();
      setMessage('RMA resolved');
    },
    onError: (err) => setMessage(err.message),
  });

  const rma = rmaQuery.data;

  if (rmaQuery.isLoading) {
    return <p>Loading…</p>;
  }

  if (!rma) {
    return (
      <div className="space-y-4">
        <p>RMA not found.</p>
        <Link to="/returns/queue" className="text-primary underline">
          Back to queue
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{rma.rmaNumber}</h2>
          <p className="text-sm text-muted-foreground">
            Status: {rma.status} · Reason: {rma.reasonCode}
          </p>
        </div>
        <Link to="/returns/queue" className="text-sm text-primary underline">
          Back to queue
        </Link>
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Order:{' '}
              <Link
                to={`/sales/orders/${rma.salesOrderId}`}
                className="text-primary underline"
              >
                {rma.salesOrder?.orderNumber}
              </Link>
            </p>
            <p>
              Line {rma.salesOrderLine?.lineNumber}:{' '}
              {rma.salesOrderLine?.description}
            </p>
            <p>Quantity: {String(rma.quantity)}</p>
            {rma.qualityRelated && (
              <p className="font-medium text-amber-800">Quality-related return</p>
            )}
            {rma.notes && <p>Notes: {rma.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{rma.customer?.name}</p>
            {rma.customer?.email && <p>{rma.customer.email}</p>}
          </CardContent>
        </Card>

        {rma.nonConformance && (
          <Card>
            <CardHeader>
              <CardTitle>Non-conformance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{rma.nonConformance.ncNumber}</p>
              <p>
                {rma.nonConformance.severity} · {rma.nonConformance.status}
              </p>
              <Link
                to="/qms/non-conformance"
                className="text-primary underline"
              >
                View NC queue
              </Link>
            </CardContent>
          </Card>
        )}

        {rma.returnedBin && (
          <Card>
            <CardHeader>
              <CardTitle>Received into</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              Bin {rma.returnedBin.code}
            </CardContent>
          </Card>
        )}

        {rma.creditMemo && (
          <Card>
            <CardHeader>
              <CardTitle>Credit memo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{rma.creditMemo.creditMemoNumber}</p>
              <p>
                {rma.creditMemo.status} · {String(rma.creditMemo.total)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {allowed && rma.status === 'REQUESTED' && (
        <Card>
          <CardHeader>
            <CardTitle>Review request</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              onClick={() => approveMutation.mutate({ id: rma.id })}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                rejectMutation.mutate({
                  id: rma.id,
                  notes: notes || undefined,
                })
              }
            >
              Reject
            </Button>
          </CardContent>
        </Card>
      )}

      {allowed && rma.status === 'APPROVED' && (
        <Card>
          <CardHeader>
            <CardTitle>Receive return</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Bin code</Label>
              <input
                className="w-full rounded border px-3 py-2"
                value={binCode}
                onChange={(e) => setBinCode(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() =>
                  receiveMutation.mutate({
                    id: rma.id,
                    binCode: binCode || 'RET-01',
                  })
                }
              >
                Receive into WMS
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {allowed && rma.status === 'RECEIVED' && (
        <Card>
          <CardHeader>
            <CardTitle>Resolve RMA</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Resolution</Label>
              <select
                className="w-full rounded border px-3 py-2"
                value={resolutionType}
                onChange={(e) =>
                  setResolutionType(e.target.value as ResolutionType)
                }
              >
                <option value="REFUND">Refund (credit memo)</option>
                <option value="REPLACE">Replace</option>
                <option value="REPAIR">Repair</option>
                <option value="REJECT">Reject return</option>
              </select>
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                className="w-full rounded border px-3 py-2"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button
              className="md:col-span-2"
              onClick={() =>
                resolveMutation.mutate({
                  id: rma.id,
                  resolutionType,
                  notes: notes || undefined,
                })
              }
            >
              Resolve
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
