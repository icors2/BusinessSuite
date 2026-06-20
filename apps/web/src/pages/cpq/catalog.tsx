import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export function CpqCatalogPage() {
  const navigate = useNavigate();
  const editable = canEdit(getSession()?.roles ?? []);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cartQuoteId, setCartQuoteId] = useState('');

  const customersQuery = trpc.customer.list.useQuery({});
  const productsQuery = trpc.cpqCatalog.searchProducts.useQuery({
    query: search,
    customerId: customerId || undefined,
    quantity: Number(quantity) || 1,
    limit: 50,
  });
  const draftsQuery = trpc.quote.list.useQuery({
    status: 'DRAFT',
    take: 20,
  });

  const addLineMutation = trpc.quote.addProductLine.useMutation({
    onSuccess: () => {
      if (cartQuoteId) navigate(`/cpq/quotes/${cartQuoteId}`);
    },
  });

  function addToQuote(productId: string) {
    if (!editable || !cartQuoteId) return;
    addLineMutation.mutate({
      quoteId: cartQuoteId,
      productId,
      quantity: Number(quantity) || 1,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-tour="cpq-catalog-header">Digital catalog</h2>
          <p className="text-sm text-muted-foreground">
            Browse products with live rule-based pricing
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/cpq/quotes">Quotes</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SKU or description"
            />
          </div>
          <div className="space-y-2">
            <Label>Customer (tier pricing)</Label>
            <select
              className="flex h-10 w-full rounded-md border px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">None</option>
              {customersQuery.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          {editable && (
            <div className="space-y-2">
              <Label>Add to draft quote</Label>
              <select
                className="flex h-10 w-full rounded-md border px-3 text-sm"
                value={cartQuoteId}
                onChange={(e) => setCartQuoteId(e.target.value)}
              >
                <option value="">Select draft</option>
                {draftsQuery.data?.items.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quoteNumber}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {productsQuery.data?.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-semibold">{p.sku}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.description}
                  </p>
                  <p className="mt-2 text-lg">
                    ${p.unitPrice.toFixed(2)}
                    {p.discountPct > 0 && (
                      <span className="ml-2 text-sm text-green-700">
                        ({p.discountPct}% off list ${p.listPrice})
                      </span>
                    )}
                  </p>
                </div>
                {editable && cartQuoteId && (
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() => addToQuote(p.id)}
                  >
                    Add to quote
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
