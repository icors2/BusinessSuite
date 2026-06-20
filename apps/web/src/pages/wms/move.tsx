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

export function WmsMovePage() {
  const editable = canEdit(getSession()?.roles ?? []);
  const [fromBinCode, setFromBinCode] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [toBinCode, setToBinCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const skuRef = useRef<ScanInputHandle>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const toBinRef = useRef<ScanInputHandle>(null);

  const moveMutation = trpc.inventory.move.useMutation({
    onSuccess: (row) => {
      setMessage(
        `Moved to ${row.bin?.code ?? 'bin'} — ${row.onHand} on-hand there`,
      );
      setFromBinCode('');
      setSku('');
      setQuantity('1');
      setToBinCode('');
      setError('');
    },
    onError: (err) => setError(err.message),
  });

  if (!editable) {
    return (
      <p className="text-muted-foreground">Move requires Admin or Manager role.</p>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Move / Put-away</h2>
        <p className="text-muted-foreground">
          Scan from-bin, SKU, qty, then to-bin
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan-to-move</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              moveMutation.mutate({
                fromBinCode,
                toBinCode,
                sku,
                quantity: Number(quantity),
              });
            }}
            className="space-y-6"
          >
            <ScanInput
              id="from-bin"
              label="From bin"
              value={fromBinCode}
              onChange={setFromBinCode}
              onScan={(code) => {
                setFromBinCode(code.toUpperCase());
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    toBinRef.current?.focus();
                  }
                }}
                className="mt-2 h-14 text-lg"
              />
            </div>
            <ScanInput
              ref={toBinRef}
              id="to-bin"
              label="To bin"
              value={toBinCode}
              onChange={setToBinCode}
              onScan={(code) => setToBinCode(code.toUpperCase())}
            />
            <Button type="submit" size="lg" className="h-14 w-full text-lg">
              Move stock
            </Button>
          </form>
          {message && <p className="mt-4 text-green-700">{message}</p>}
          {error && <p className="mt-4 text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
