import { useState } from 'react';
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
  ISSUED: 'bg-blue-100 text-blue-800',
  ACKNOWLEDGED: 'bg-indigo-100 text-indigo-800',
  PARTIALLY_RECEIVED: 'bg-amber-100 text-amber-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function PurchaseOrdersPage() {
  const editable = canEdit(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');
  const [selectedReqs, setSelectedReqs] = useState<Set<string>>(new Set());
  const [receiveLineId, setReceiveLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [receiveBinId, setReceiveBinId] = useState('');

  const approvedReqsQuery = trpc.mrp.listRequisitions.useQuery({
    status: 'APPROVED',
    take: 100,
  });
  const poQuery = trpc.procurement.listPurchaseOrders.useQuery({ take: 100 });
  const binsQuery = trpc.inventory.listBins.useQuery({});

  const createPoMutation = trpc.procurement.createPurchaseOrders.useMutation({
    onSuccess: (result) => {
      approvedReqsQuery.refetch();
      poQuery.refetch();
      setSelectedReqs(new Set());
      setMessage(`Created ${result.created.length} purchase order(s)`);
    },
  });

  const issueMutation = trpc.procurement.issuePurchaseOrder.useMutation({
    onSuccess: () => {
      poQuery.refetch();
      setMessage('Purchase order issued');
    },
  });

  const ackMutation = trpc.procurement.acknowledgePurchaseOrder.useMutation({
    onSuccess: () => {
      poQuery.refetch();
      setMessage('Vendor acknowledgment recorded');
    },
  });

  const asnMutation = trpc.procurement.submitAsn.useMutation({
    onSuccess: () => {
      poQuery.refetch();
      setMessage('ASN submitted');
    },
  });

  const receiveMutation = trpc.procurement.receiveAgainstPo.useMutation({
    onSuccess: () => {
      poQuery.refetch();
      setReceiveLineId(null);
      setMessage('Receipt recorded against PO');
    },
  });

  const approvedReqs = approvedReqsQuery.data?.items ?? [];
  const purchaseOrders = poQuery.data?.items ?? [];
  const bins = binsQuery.data?.items ?? [];

  function toggleReq(id: string) {
    setSelectedReqs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCreatePo() {
    if (selectedReqs.size === 0) return;
    createPoMutation.mutate({ requisitionIds: [...selectedReqs] });
  }

  function handleReceive() {
    if (!receiveLineId || !receiveBinId) return;
    const qty = Number(receiveQty);
    if (!qty || qty <= 0) return;
    receiveMutation.mutate({
      poLineId: receiveLineId,
      quantity: qty,
      binId: receiveBinId,
    });
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Purchase Orders</h1>
        <p className="text-sm text-muted-foreground">
          Convert approved requisitions into POs and manage vendor intake
        </p>
      </div>

      {message && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{message}</p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Approved requisitions</CardTitle>
          {editable && (
            <Button
              onClick={handleCreatePo}
              disabled={
                selectedReqs.size === 0 || createPoMutation.isPending
              }
            >
              Create PO from selected
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {approvedReqs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No approved requisitions ready for conversion.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    {editable && <th className="py-2 pr-4">Select</th>}
                    <th className="py-2 pr-4">Req #</th>
                    <th className="py-2 pr-4">Component</th>
                    <th className="py-2 pr-4">Qty</th>
                    <th className="py-2 pr-4">Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedReqs.map((req) => (
                    <tr key={req.id} className="border-b">
                      {editable && (
                        <td className="py-2 pr-4">
                          <input
                            type="checkbox"
                            checked={selectedReqs.has(req.id)}
                            onChange={() => toggleReq(req.id)}
                          />
                        </td>
                      )}
                      <td className="py-2 pr-4 font-mono text-xs">
                        {req.reqNumber}
                      </td>
                      <td className="py-2 pr-4">
                        {req.component?.sku ?? req.componentProductId}
                      </td>
                      <td className="py-2 pr-4">{req.quantity.toFixed(2)}</td>
                      <td className="py-2 pr-4">
                        {req.preferredVendor?.name ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchase orders</CardTitle>
        </CardHeader>
        <CardContent>
          {purchaseOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
          ) : (
            <div className="space-y-4">
              {purchaseOrders.map((po) => (
                <div key={po.id} className="rounded-md border p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-sm">{po.poNumber}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {po.vendor?.name}
                      </span>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        statusClass[po.status] ?? 'bg-slate-100'
                      }`}
                    >
                      {po.status}
                    </span>
                  </div>
                  <table className="mb-3 w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-1 pr-4">SKU</th>
                        <th className="py-1 pr-4">Ordered</th>
                        <th className="py-1 pr-4">Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.lines.map((line) => (
                        <tr key={line.id} className="border-b">
                          <td className="py-1 pr-4">
                            {line.product?.sku ?? line.productId}
                          </td>
                          <td className="py-1 pr-4">{line.quantity.toFixed(2)}</td>
                          <td className="py-1 pr-4">
                            {line.qtyReceived.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {editable && (
                    <div className="flex flex-wrap gap-2">
                      {po.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            issueMutation.mutate({ purchaseOrderId: po.id })
                          }
                        >
                          Issue
                        </Button>
                      )}
                      {(po.status === 'ISSUED' ||
                        po.status === 'ACKNOWLEDGED') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            ackMutation.mutate({ purchaseOrderId: po.id })
                          }
                        >
                          Acknowledge
                        </Button>
                      )}
                      {po.status !== 'DRAFT' && po.status !== 'CANCELLED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            asnMutation.mutate({
                              purchaseOrderId: po.id,
                              lines: po.lines.map((line) => ({
                                productId: line.productId,
                                quantity: line.quantity - line.qtyReceived,
                              })).filter((l) => l.quantity > 0),
                            })
                          }
                        >
                          Submit ASN
                        </Button>
                      )}
                      {po.lines.some(
                        (l) => l.qtyReceived < l.quantity,
                      ) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const openLine = po.lines.find(
                              (l) => l.qtyReceived < l.quantity,
                            );
                            if (openLine) {
                              setReceiveLineId(openLine.id);
                              setReceiveQty(
                                String(openLine.quantity - openLine.qtyReceived),
                              );
                            }
                          }}
                        >
                          Receive
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editable && receiveLineId && (
        <Card>
          <CardHeader>
            <CardTitle>Receive against PO line</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="recv-qty">Quantity</Label>
              <Input
                id="recv-qty"
                type="number"
                min="0.0001"
                step="0.01"
                value={receiveQty}
                onChange={(e) => setReceiveQty(e.target.value)}
                className="w-32"
              />
            </div>
            <div>
              <Label htmlFor="recv-bin">Bin</Label>
              <select
                id="recv-bin"
                className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={receiveBinId}
                onChange={(e) => setReceiveBinId(e.target.value)}
              >
                <option value="">Select bin</option>
                {bins.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.code}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleReceive}>Record receipt</Button>
            <Button variant="ghost" onClick={() => setReceiveLineId(null)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
