import { useState } from 'react';
import { ScanInput } from '../../components/wms/scan-input';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { trpc } from '../../lib/trpc';

function InventoryTable({
  items,
}: {
  items: Array<{
    product?: { sku: string; description: string };
    bin?: { code: string; location?: { code: string } };
    onHand: number;
    allocated: number;
    available: number;
  }>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No inventory rows.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4">SKU</th>
            <th className="py-2 pr-4">Bin</th>
            <th className="py-2 pr-4">On hand</th>
            <th className="py-2 pr-4">Allocated</th>
            <th className="py-2">Available</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, idx) => (
            <tr key={idx} className="border-b">
              <td className="py-2 pr-4">{row.product?.sku ?? '—'}</td>
              <td className="py-2 pr-4">
                {row.bin?.code ?? '—'}
                {row.bin?.location ? ` (${row.bin.location.code})` : ''}
              </td>
              <td className="py-2 pr-4">{row.onHand}</td>
              <td className="py-2 pr-4">{row.allocated}</td>
              <td className="py-2">{row.available}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WmsInventoryPage() {
  const [mode, setMode] = useState<'product' | 'bin' | 'location'>('product');
  const [scanValue, setScanValue] = useState('');
  const [lookupKey, setLookupKey] = useState<{
    mode: 'product' | 'bin' | 'location';
    value: string;
  } | null>(null);

  const byProduct = trpc.inventory.byProduct.useQuery(
    { sku: lookupKey?.mode === 'product' ? lookupKey.value : undefined },
    { enabled: lookupKey?.mode === 'product' && Boolean(lookupKey.value) },
  );
  const byBin = trpc.inventory.byBin.useQuery(
    { binCode: lookupKey?.mode === 'bin' ? lookupKey.value : undefined },
    { enabled: lookupKey?.mode === 'bin' && Boolean(lookupKey.value) },
  );
  const byLocation = trpc.inventory.byLocation.useQuery(
    {
      locationCode:
        lookupKey?.mode === 'location' ? lookupKey.value : undefined,
    },
    { enabled: lookupKey?.mode === 'location' && Boolean(lookupKey.value) },
  );

  const activeQuery =
    lookupKey?.mode === 'product'
      ? byProduct
      : lookupKey?.mode === 'bin'
        ? byBin
        : byLocation;

  const items =
    byProduct.data?.items ??
    byBin.data?.items ??
    byLocation.data?.items ??
    [];

  const totals =
    byProduct.data?.totals ??
    byBin.data?.totals ??
    byLocation.data?.totals;

  function runLookup() {
    const value = scanValue.trim().toUpperCase();
    if (!value) return;
    setLookupKey({ mode, value });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Inventory lookup</h2>
        <p className="text-muted-foreground">
          Search by product SKU, bin code, or location code
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['product', 'bin', 'location'] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant={mode === m ? 'default' : 'outline'}
                onClick={() => setMode(m)}
              >
                {m === 'product' ? 'SKU' : m === 'bin' ? 'Bin' : 'Location'}
              </Button>
            ))}
          </div>
          <ScanInput
            id="lookup"
            label={
              mode === 'product'
                ? 'Product SKU'
                : mode === 'bin'
                  ? 'Bin code'
                  : 'Location code'
            }
            value={scanValue}
            onChange={setScanValue}
            onScan={(v) => {
              setScanValue(v.toUpperCase());
              setLookupKey({ mode, value: v.toUpperCase() });
            }}
            autoFocus
          />
          <Button onClick={runLookup} size="lg" className="h-12">
            Search
          </Button>
        </CardContent>
      </Card>

      {lookupKey && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            {activeQuery.isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : activeQuery.error ? (
              <p className="text-red-600">{activeQuery.error.message}</p>
            ) : (
              <>
                {totals && (
                  <p className="mb-4 text-sm text-muted-foreground">
                    Totals — on hand: {totals.onHand}, allocated:{' '}
                    {totals.allocated}, available: {totals.available}
                  </p>
                )}
                <InventoryTable items={items} />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
