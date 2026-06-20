import { Link } from 'react-router-dom';
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
  SENT: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-amber-100 text-amber-800',
};

export function CpqQuotesPage() {
  const listQuery = trpc.quote.list.useQuery({ take: 50 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Quotes</h2>
          <p className="text-sm text-muted-foreground">
            Sales quotes with CPQ pricing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/cpq/catalog">Catalog</Link>
          </Button>
          <Button asChild>
            <Link to="/cpq/quotes/new">New quote</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All quotes</CardTitle>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading && <p>Loading…</p>}
          {listQuery.data && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">Number</th>
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2">Valid until</th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.data.items.map((q) => (
                    <tr key={q.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 pr-4">
                        <Link
                          to={`/cpq/quotes/${q.id}`}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {q.quoteNumber}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{q.customer?.name}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass[q.status] ?? ''}`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {q.currency} {String(q.total)}
                      </td>
                      <td className="py-2">
                        {q.validUntil
                          ? new Date(q.validUntil).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
