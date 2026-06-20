import { useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { trpc } from '../../lib/trpc';

export function MesPlacardPage() {
  const [workOrderId, setWorkOrderId] = useState('');

  const workOrdersQuery = trpc.mps.listWorkOrders.useQuery({ take: 50 });
  const placardQuery = trpc.mes.getPlacard.useQuery(
    { workOrderId },
    { enabled: !!workOrderId },
  );

  const workOrders = workOrdersQuery.data?.items ?? [];

  function handlePrint() {
    if (!placardQuery.data?.html) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(placardQuery.data.html);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold" data-tour="mes-placard-header">Work Order Placard</h2>
        <p className="text-sm text-muted-foreground">
          Printable traveler with scannable barcode.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select work order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="w-full rounded-md border px-3 py-2"
            value={workOrderId}
            onChange={(e) => setWorkOrderId(e.target.value)}
          >
            <option value="">Choose work order</option>
            {workOrders.map((wo) => (
              <option key={wo.id} value={wo.id}>
                {wo.woNumber}
              </option>
            ))}
          </select>
          {placardQuery.data && (
            <Button onClick={handlePrint}>Print placard</Button>
          )}
        </CardContent>
      </Card>

      {placardQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle>Preview — {placardQuery.data.woNumber}</CardTitle>
          </CardHeader>
          <CardContent>
            <iframe
              title="Placard preview"
              srcDoc={placardQuery.data.html}
              className="h-[480px] w-full rounded border bg-white"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
