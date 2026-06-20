import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  DRAFT: 'bg-slate-200 text-slate-800',
  ALLOCATED: 'bg-green-100 text-green-800',
  BACKORDERED: 'bg-amber-100 text-amber-800',
  PARTIALLY_SHIPPED: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const editable = canEdit(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');
  const [showShip, setShowShip] = useState(false);
  const [shipQtys, setShipQtys] = useState<Record<string, string>>({});

  const orderQuery = trpc.salesOrder.get.useQuery(
    { orderId: id! },
    { enabled: !!id },
  );

  const allocateMutation = trpc.salesOrder.allocate.useMutation({
    onSuccess: () => {
      orderQuery.refetch();
      setMessage('Allocation updated');
    },
  });

  const shipMutation = trpc.salesOrder.confirmShipment.useMutation({
    onSuccess: () => {
      orderQuery.refetch();
      setShowShip(false);
      setMessage('Shipment confirmed and invoice created');
    },
  });

  const cancelMutation = trpc.salesOrder.cancel.useMutation({
    onSuccess: () => {
      orderQuery.refetch();
      setMessage('Order cancelled');
    },
  });

  const order = orderQuery.data;
  const canShip =
    order &&
    order.status !== 'SHIPPED' &&
    order.status !== 'CANCELLED';

  function handleShip(e: FormEvent) {
    e.preventDefault();
    if (!order || !editable) return;

    const lines = order.lines
      .map((line) => {
        const qty = Number(shipQtys[line.id] ?? 0);
        if (qty <= 0) return null;
        const details = line.allocationDetails as
          | Array<{ binId: string }>
          | null;
        const binId =
          line.kind === 'PRODUCT' && !line.toProduce
            ? details?.[0]?.binId
            : undefined;
        return { lineId: line.id, quantity: qty, binId };
      })
      .filter(Boolean) as Array<{
      lineId: string;
      quantity: number;
      binId?: string;
    }>;

    if (lines.length === 0) {
      setMessage('Enter quantity to ship for at least one line');
      return;
    }

    shipMutation.mutate({ orderId: order.id, lines });
  }

  if (orderQuery.isLoading) return <p>Loading order…</p>;
  if (!order) return <p>Order not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/sales/orders"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Orders
          </Link>
          <h2 className="text-2xl font-bold">{order.orderNumber}</h2>
          <p className="text-sm text-muted-foreground">
            {order.customer?.name}
            {order.quote && (
              <>
                {' · Quote '}
                <Link
                  to={`/cpq/quotes/${order.quote.id}`}
                  className="text-primary hover:underline"
                >
                  {order.quote.quoteNumber}
                </Link>
              </>
            )}
          </p>
        </div>
        <span
          className={`rounded px-3 py-1 text-sm font-medium ${statusClass[order.status] ?? ''}`}
        >
          {order.status}
        </span>
      </div>

      {message && (
        <p className="rounded bg-slate-100 px-3 py-2 text-sm">{message}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Order lines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Kind</th>
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2 pr-2">Ordered</th>
                  <th className="py-2 pr-2">Allocated</th>
                  <th className="py-2 pr-2">Shipped</th>
                  <th className="py-2 pr-2">Backorder</th>
                  <th className="py-2">Unit price</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.id} className="border-b">
                    <td className="py-2 pr-2">{line.lineNumber}</td>
                    <td className="py-2 pr-2">
                      {line.toProduce ? 'FAB (MTO)' : line.kind}
                    </td>
                    <td className="py-2 pr-2">{line.description}</td>
                    <td className="py-2 pr-2">{line.qtyOrdered}</td>
                    <td className="py-2 pr-2">{line.qtyAllocated}</td>
                    <td className="py-2 pr-2">{line.qtyShipped}</td>
                    <td className="py-2 pr-2">
                      {Number(line.qtyBackordered) > 0 ? (
                        <span className="font-medium text-amber-700">
                          {line.qtyBackordered}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="py-2">{line.unitPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-right font-semibold">
            Total: {order.currency} {String(order.total)}
          </div>
        </CardContent>
      </Card>

      {order.shipments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {order.shipments.map((s) => (
                <li key={s.id} className="rounded border p-3">
                  <span className="font-medium">{s.shipmentNumber}</span>
                  {' · '}
                  {new Date(s.shippedAt).toLocaleString()}
                  {s.invoiceId && (
                    <>
                      {' · Invoice '}
                      <Link
                        to="/finance/invoices"
                        className="text-primary hover:underline"
                      >
                        {s.invoiceId.slice(0, 8)}…
                      </Link>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {editable && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(order.status === 'BACKORDERED' ||
              order.status === 'DRAFT' ||
              order.status === 'ALLOCATED') && (
              <Button
                variant="outline"
                onClick={() => allocateMutation.mutate({ orderId: order.id })}
              >
                Re-allocate inventory
              </Button>
            )}
            {canShip && (
              <Button onClick={() => setShowShip(!showShip)}>
                Confirm shipment
              </Button>
            )}
            {order.status !== 'SHIPPED' &&
              order.status !== 'CANCELLED' &&
              order.status !== 'PARTIALLY_SHIPPED' && (
                <Button
                  variant="destructive"
                  onClick={() => cancelMutation.mutate({ orderId: order.id })}
                >
                  Cancel order
                </Button>
              )}
          </CardContent>
        </Card>
      )}

      {showShip && editable && (
        <Card>
          <CardHeader>
            <CardTitle>Ship lines</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleShip} className="space-y-4">
              {order.lines.map((line) => {
                const maxShip =
                  line.kind === 'FABRICATED' || line.toProduce
                    ? Number(line.qtyOrdered) - Number(line.qtyShipped)
                    : Number(line.qtyAllocated) - Number(line.qtyShipped);
                if (maxShip <= 0) return null;
                return (
                  <div key={line.id} className="flex flex-wrap items-end gap-4">
                    <div className="min-w-[200px] flex-1">
                      <Label>{line.description}</Label>
                      <p className="text-xs text-muted-foreground">
                        Max ship: {maxShip}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor={`ship-${line.id}`}>Qty to ship</Label>
                      <Input
                        id={`ship-${line.id}`}
                        type="number"
                        min={0}
                        max={maxShip}
                        step="any"
                        value={shipQtys[line.id] ?? ''}
                        onChange={(e) =>
                          setShipQtys((prev) => ({
                            ...prev,
                            [line.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
              <Button type="submit" disabled={shipMutation.isPending}>
                Ship &amp; invoice
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
