import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { trpc } from '../../lib/trpc';

const statusClass: Record<string, string> = {
  DRAFT: 'bg-slate-200 text-slate-800',
  ALLOCATED: 'bg-green-100 text-green-800',
  BACKORDERED: 'bg-amber-100 text-amber-800',
  PARTIALLY_SHIPPED: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function SalesOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [backorderOnly, setBackorderOnly] = useState(false);

  const listQuery = trpc.salesOrder.list.useQuery({
    take: 50,
    status: statusFilter
      ? (statusFilter as
          | 'DRAFT'
          | 'ALLOCATED'
          | 'BACKORDERED'
          | 'PARTIALLY_SHIPPED'
          | 'SHIPPED'
          | 'CANCELLED')
      : undefined,
    hasBackorder: backorderOnly || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sales Orders</h2>
          <p className="text-sm text-muted-foreground">
            Fulfillment, allocation, and shipment tracking
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>All orders</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded border px-2 py-1 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="ALLOCATED">Allocated</option>
              <option value="BACKORDERED">Backordered</option>
              <option value="PARTIALLY_SHIPPED">Partially shipped</option>
              <option value="SHIPPED">Shipped</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={backorderOnly}
                onChange={(e) => setBackorderOnly(e.target.checked)}
              />
              Backorders only
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading && <p>Loading…</p>}
          {listQuery.data && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">Order #</th>
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2">Quote</th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.data.items.map((o) => {
                    const hasBackorder = o.lines.some(
                      (l) => Number(l.qtyBackordered) > 0,
                    );
                    return (
                      <tr key={o.id} className="border-b hover:bg-slate-50">
                        <td className="py-2 pr-4">
                          <Link
                            to={`/sales/orders/${o.id}`}
                            className="font-medium text-primary underline-offset-2 hover:underline"
                          >
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">{o.customer?.name}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass[o.status] ?? ''}`}
                          >
                            {o.status}
                          </span>
                          {hasBackorder && (
                            <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
                              Backorder
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {o.currency} {String(o.total)}
                        </td>
                        <td className="py-2">
                          {o.quote ? (
                            <Link
                              to={`/cpq/quotes/${o.quote.id}`}
                              className="text-primary hover:underline"
                            >
                              {o.quote.quoteNumber}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {listQuery.data.items.length === 0 && (
                <p className="py-4 text-muted-foreground">No orders found.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
