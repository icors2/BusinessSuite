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

export function WmsReceivePage() {
  const editable = canEdit(getSession()?.roles ?? []);
  const [binCode, setBinCode] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const skuRef = useRef<ScanInputHandle>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const receiveMutation = trpc.inventory.receive.useMutation({
    onSuccess: (row) => {
      setMessage(`Received ${row.onHand} on-hand in ${row.bin?.code ?? 'bin'}`);
      setBinCode('');
      setSku('');
      setQuantity('1');
      setError('');
    },
    onError: (err) => setError(err.message),
  });

  function handleBinScan(code: string) {
    setBinCode(code.toUpperCase());
    skuRef.current?.focus();
  }

  function handleSkuScan(code: string) {
    setSku(code.toUpperCase());
    qtyRef.current?.focus();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editable) return;
    receiveMutation.mutate({
      binCode,
      sku,
      quantity: Number(quantity),
    });
  }

  if (!editable) {
    return (
      <p className="text-muted-foreground">
        Receive requires Admin or Manager role.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Receive</h2>
        <p className="text-muted-foreground">Scan bin, SKU, enter quantity</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan-to-receive</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <ScanInput
              id="bin"
              label="Bin barcode"
              value={binCode}
              onChange={setBinCode}
              onScan={handleBinScan}
              placeholder="Scan bin label"
              autoFocus
            />
            <ScanInput
              ref={skuRef}
              id="sku"
              label="Product SKU"
              value={sku}
              onChange={setSku}
              onScan={handleSkuScan}
              placeholder="Scan product label"
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
            <Button type="submit" size="lg" className="h-14 w-full text-lg">
              Receive stock
            </Button>
          </form>
          {message && <p className="mt-4 text-green-700">{message}</p>}
          {error && <p className="mt-4 text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
