import { FormEvent, useRef, useState } from 'react';
import { ScanInput, ScanInputHandle } from '../../components/wms/scan-input';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { trpc } from '../../lib/trpc';
import { canEdit } from '../../lib/utils';
import { getSession } from '../../lib/auth';

export function WmsPickPage() {
  const editable = canEdit(getSession()?.roles ?? []);
  const [binCode, setBinCode] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const skuRef = useRef<ScanInputHandle>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const pickMutation = trpc.inventory.pick.useMutation({
    onSuccess: (row) => {
      setMessage(
        `Picked — ${row.onHand} on-hand, ${row.available} available remaining`,
      );
      setBinCode('');
      setSku('');
      setQuantity('1');
      setError('');
    },
    onError: (err) => setError(err.message),
  });

  const shipMutation = trpc.inventory.ship.useMutation({
    onSuccess: (row) => {
      setMessage(`Shipped — ${row.onHand} on-hand remaining`);
      setBinCode('');
      setSku('');
      setQuantity('1');
      setError('');
    },
    onError: (err) => setError(err.message),
  });

  if (!editable) {
    return (
      <p className="text-muted-foreground">Pick requires Admin or Manager role.</p>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Pick / Ship</h2>
        <p className="text-muted-foreground">
          Scan bin and SKU — pick respects available qty
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan-to-pick</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              pickMutation.mutate({
                binCode,
                sku,
                quantity: Number(quantity),
              });
            }}
            className="space-y-6"
          >
            <ScanInput
              id="bin"
              label="Bin barcode"
              value={binCode}
              onChange={setBinCode}
              onScan={(code) => {
                setBinCode(code.toUpperCase());
                skuRef.current?.focus();
              }}
              autoFocus
            />
            <ScanInput
              ref={skuRef}
              id="sku"
              label="Product SKU"
              value={sku}
              onChange={setSku}
              onScan={(code) => {
                setSku(code.toUpperCase());
                qtyRef.current?.focus();
              }}
            />
            <div>
              <Label htmlFor="qty" className="text-base">
                Quantity
              </Label>
              <Input
                id="qty"
                ref={qtyRef}
                type="number"
                min={0.0001}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-2 h-14 text-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="submit"
                size="lg"
                className="h-14 text-lg"
                disabled={pickMutation.isPending}
              >
                Pick
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="h-14 text-lg"
                disabled={shipMutation.isPending}
                onClick={() =>
                  shipMutation.mutate({
                    binCode,
                    sku,
                    quantity: Number(quantity),
                  })
                }
              >
                Ship
              </Button>
            </div>
          </form>
          {message && <p className="mt-4 text-green-700">{message}</p>}
          {error && <p className="mt-4 text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
