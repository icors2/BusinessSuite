import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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

function quoteToCsv(quote: {
  quoteNumber: string;
  customer?: { name: string } | null;
  validUntil?: Date | string | null;
  status: string;
  subtotal: unknown;
  discountTotal: unknown;
  total: unknown;
  currency: string;
  lines: Array<{
    lineNumber: number;
    kind: string;
    description: string;
    quantity: unknown;
    unitPrice: unknown;
    discountPct: unknown;
    lineTotal: unknown;
    product?: { sku: string } | null;
  }>;
}): string {
  const rows: string[] = [];
  rows.push(`Quote,${quote.quoteNumber}`);
  rows.push(`Customer,${quote.customer?.name ?? ''}`);
  rows.push(`Status,${quote.status}`);
  if (quote.validUntil) {
    rows.push(
      `Valid Until,${new Date(quote.validUntil).toISOString().slice(0, 10)}`,
    );
  }
  rows.push('');
  rows.push('Line,SKU/Type,Description,Qty,Unit Price,Discount %,Line Total');
  for (const line of quote.lines) {
    rows.push(
      [
        line.lineNumber,
        line.product?.sku ?? line.kind,
        `"${line.description.replace(/"/g, '""')}"`,
        String(line.quantity),
        String(line.unitPrice),
        String(line.discountPct),
        String(line.lineTotal),
      ].join(','),
    );
  }
  rows.push('');
  rows.push(`Subtotal,${quote.subtotal}`);
  rows.push(`Discount,${quote.discountTotal}`);
  rows.push(`Total (${quote.currency}),${quote.total}`);
  return rows.join('\n');
}

export function CpqQuoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const editable = canEdit(getSession()?.roles ?? []);
  const utils = trpc.useUtils();

  const [customerId, setCustomerId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [productId, setProductId] = useState('');
  const [productQty, setProductQty] = useState('1');
  const [fabKind, setFabKind] = useState('plate');
  const [fabDesc, setFabDesc] = useState('');
  const [fabQty, setFabQty] = useState('1');
  const [fabMaterial, setFabMaterial] = useState('');
  const [fabLength, setFabLength] = useState('10');
  const [fabWidth, setFabWidth] = useState('6');
  const [fabDrill, setFabDrill] = useState('0');
  const [message, setMessage] = useState('');

  const customersQuery = trpc.customer.list.useQuery({});
  const productsQuery = trpc.cpqCatalog.searchProducts.useQuery(
    { query: '', customerId: customerId || undefined, quantity: 1, limit: 50 },
    { enabled: !!customerId || isNew },
  );

  const quoteQuery = trpc.quote.get.useQuery(
    { quoteId: id! },
    { enabled: !!id && !isNew },
  );

  const fabPreviewQuery = trpc.quote.pricePreview.useQuery(
    {
      fabInput: {
        kind: fabKind,
        name: fabDesc || 'Part',
        material: fabMaterial,
        length: Number(fabLength),
        width: Number(fabWidth),
        drillFeatures: Number(fabDrill),
      },
      quantity: Number(fabQty) || 1,
    },
    {
      enabled:
        editable &&
        fabMaterial.length > 0 &&
        (fabKind !== 'plate' || (Number(fabLength) > 0 && Number(fabWidth) > 0)),
    },
  );

  const materialsQuery = trpc.cpqCatalog.searchMaterials.useQuery(
    { query: fabMaterial, limit: 8 },
    { enabled: fabMaterial.length >= 2 },
  );

  const createMutation = trpc.quote.create.useMutation({
    onSuccess: (q) => {
      utils.quote.list.invalidate();
      navigate(`/cpq/quotes/${q.id}`, { replace: true });
    },
  });

  const addProductMutation = trpc.quote.addProductLine.useMutation({
    onSuccess: () => {
      quoteQuery.refetch();
      setMessage('Product line added');
    },
  });

  const addFabMutation = trpc.quote.addFabricatedLine.useMutation({
    onSuccess: () => {
      quoteQuery.refetch();
      setMessage('Fabricated line added');
    },
  });

  const recalcMutation = trpc.quote.recalc.useMutation({
    onSuccess: () => quoteQuery.refetch(),
  });

  const transitionMutation = trpc.quote.transition.useMutation({
    onSuccess: () => quoteQuery.refetch(),
  });

  const quote = quoteQuery.data;
  const isDraft = quote?.status === 'DRAFT';

  const csvExport = useMemo(() => {
    if (!quote) return '';
    return quoteToCsv({
      quoteNumber: quote.quoteNumber,
      customer: quote.customer,
      validUntil: quote.validUntil,
      status: quote.status,
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      total: quote.total,
      currency: quote.currency,
      lines: quote.lines,
    });
  }, [quote]);

  useEffect(() => {
    if (quote && !isNew) {
      setCustomerId(quote.customerId);
      setNotes(quote.notes ?? '');
      setValidUntil(
        quote.validUntil
          ? new Date(quote.validUntil).toISOString().slice(0, 10)
          : '',
      );
    }
  }, [quote, isNew]);

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!editable) return;
    createMutation.mutate({
      customerId,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      notes,
    });
  }

  function downloadCsv() {
    const blob = new Blob([csvExport], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quote?.quoteNumber ?? 'quote'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!isNew && quoteQuery.isLoading) {
    return <p>Loading quote…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            {isNew ? 'New quote' : quote?.quoteNumber}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isNew
              ? 'Select customer and add lines'
              : `${quote?.customer?.name} · ${quote?.status}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/cpq/quotes">Back</Link>
          </Button>
          {!isNew && quote && (
            <>
              <Button variant="outline" onClick={() => window.print()}>
                Print
              </Button>
              <Button variant="outline" onClick={downloadCsv}>
                CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {message && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      )}

      {isNew && editable && (
        <Card>
          <CardHeader>
            <CardTitle>Quote header</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Customer</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                >
                  <option value="">Select customer</option>
                  {customersQuery.data?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Valid until</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button type="submit" disabled={createMutation.isPending}>
                Create quote
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {!isNew && quote && (
        <>
          <Card className="print:border-0 print:shadow-none">
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Subtotal</p>
                <p className="text-xl font-semibold">
                  {quote.currency} {String(quote.subtotal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Discount</p>
                <p className="text-xl font-semibold">
                  {quote.currency} {String(quote.discountTotal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">
                  {quote.currency} {String(quote.total)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lines</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="mb-6 w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">#</th>
                    <th className="py-2">Kind</th>
                    <th className="py-2">Description</th>
                    <th className="py-2">Qty</th>
                    <th className="py-2">Unit</th>
                    <th className="py-2">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map((line) => (
                    <tr key={line.id} className="border-b">
                      <td className="py-2">{line.lineNumber}</td>
                      <td className="py-2">{line.kind}</td>
                      <td className="py-2">
                        {line.product?.sku
                          ? `${line.product.sku} — `
                          : ''}
                        {line.description}
                      </td>
                      <td className="py-2">{String(line.quantity)}</td>
                      <td className="py-2">{String(line.unitPrice)}</td>
                      <td className="py-2">{String(line.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {editable && isDraft && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-3 rounded-lg border p-4">
                    <h3 className="font-medium">Add product line</h3>
                    <select
                      className="flex h-10 w-full rounded-md border px-3 text-sm"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                    >
                      <option value="">Product</option>
                      {productsQuery.data?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.description} (${p.unitPrice})
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={0.0001}
                      step="any"
                      value={productQty}
                      onChange={(e) => setProductQty(e.target.value)}
                      placeholder="Qty"
                    />
                    <Button
                      type="button"
                      onClick={() =>
                        addProductMutation.mutate({
                          quoteId: quote.id,
                          productId,
                          quantity: Number(productQty),
                        })
                      }
                      disabled={!productId}
                    >
                      Add product
                    </Button>
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <h3 className="font-medium">Add fabricated line</h3>
                    <Input
                      value={fabDesc}
                      onChange={(e) => setFabDesc(e.target.value)}
                      placeholder="Description"
                    />
                    <select
                      className="flex h-10 w-full rounded-md border px-3 text-sm"
                      value={fabKind}
                      onChange={(e) => setFabKind(e.target.value)}
                    >
                      <option value="plate">Plate</option>
                      <option value="tube">Tube</option>
                      <option value="weldment">Weldment</option>
                      <option value="purchased">Purchased</option>
                    </select>
                    <Input
                      value={fabMaterial}
                      onChange={(e) => setFabMaterial(e.target.value)}
                      placeholder="Material item # (search)"
                    />
                    {materialsQuery.data && materialsQuery.data.length > 0 && (
                      <ul className="max-h-32 overflow-y-auto rounded border text-xs">
                        {materialsQuery.data.map((m) => (
                          <li key={m.itemNumber}>
                            <button
                              type="button"
                              className="w-full px-2 py-1 text-left hover:bg-slate-100"
                              onClick={() => setFabMaterial(m.itemNumber)}
                            >
                              {m.itemNumber} — {m.description}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {fabKind === 'plate' && (
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          value={fabLength}
                          onChange={(e) => setFabLength(e.target.value)}
                          placeholder="L"
                        />
                        <Input
                          value={fabWidth}
                          onChange={(e) => setFabWidth(e.target.value)}
                          placeholder="W"
                        />
                        <Input
                          value={fabDrill}
                          onChange={(e) => setFabDrill(e.target.value)}
                          placeholder="Drill #"
                        />
                      </div>
                    )}
                    <Input
                      type="number"
                      min={0.0001}
                      step="any"
                      value={fabQty}
                      onChange={(e) => setFabQty(e.target.value)}
                      placeholder="Qty"
                    />
                    {fabPreviewQuery.data && (
                      <p className="text-sm text-muted-foreground">
                        Live preview: ${fabPreviewQuery.data.unitPrice} / unit
                      </p>
                    )}
                    <Button
                      type="button"
                      onClick={() =>
                        addFabMutation.mutate({
                          quoteId: quote.id,
                          description: fabDesc || 'Fabricated part',
                          quantity: Number(fabQty),
                          fabInput: {
                            kind: fabKind,
                            name: fabDesc,
                            material: fabMaterial,
                            length: Number(fabLength),
                            width: Number(fabWidth),
                            drillFeatures: Number(fabDrill),
                          },
                        })
                      }
                      disabled={!fabMaterial}
                    >
                      Add fabricated
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {editable && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {isDraft && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => recalcMutation.mutate({ quoteId: quote.id })}
                    >
                      Recalculate
                    </Button>
                    <Button
                      onClick={() =>
                        transitionMutation.mutate({
                          quoteId: quote.id,
                          action: 'send',
                        })
                      }
                    >
                      Send quote
                    </Button>
                  </>
                )}
                {quote.status === 'SENT' && (
                  <>
                    <Button
                      onClick={() =>
                        transitionMutation.mutate({
                          quoteId: quote.id,
                          action: 'accept',
                        })
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        transitionMutation.mutate({
                          quoteId: quote.id,
                          action: 'reject',
                        })
                      }
                    >
                      Reject
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
