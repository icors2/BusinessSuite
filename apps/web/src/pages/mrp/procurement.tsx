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
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CONVERTED: 'bg-blue-100 text-blue-800',
};

export function MrpProcurementPage() {
  const editable = canEdit(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState('');

  const requirementsQuery = trpc.mrp.getRequirements.useQuery({});
  const requisitionsQuery = trpc.mrp.listRequisitions.useQuery({
    take: 100,
  });

  const runMutation = trpc.mrp.runMrp.useMutation({
    onSuccess: (result) => {
      requirementsQuery.refetch();
      requisitionsQuery.refetch();
      setMessage(
        `MRP complete — ${result.requisitionsCreated} created, ${result.requisitionsUpdated} updated`,
      );
    },
  });

  const reviewMutation = trpc.mrp.reviewRequisition.useMutation({
    onSuccess: () => {
      requisitionsQuery.refetch();
      setAdjustId(null);
      setMessage('Requisition updated');
    },
  });

  const netRequirements = requirementsQuery.data?.netRequirements ?? [];
  const requisitions = requisitionsQuery.data?.items ?? [];
  const pendingCount = requisitions.filter((r) => r.status === 'PENDING').length;

  function handleAdjust(id: string) {
    const qty = Number(adjustQty);
    if (!qty || qty <= 0) return;
    reviewMutation.mutate({
      requisitionId: id,
      action: 'ADJUST',
      quantity: qty,
    });
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-tour="mrp-procurement-header">Procurement</h1>
          <p className="text-sm text-muted-foreground">
            Material requirements planning — exploded demand and purchase
            requisitions
          </p>
        </div>
        {editable && (
          <Button
            onClick={() => runMutation.mutate({})}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? 'Running MRP…' : 'Run MRP'}
          </Button>
        )}
      </div>

      {message && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{message}</p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open demand lines</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{netRequirements.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net procurement qty</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {netRequirements.reduce((sum, r) => sum + r.netQty, 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending requisitions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exploded requirements (net)</CardTitle>
        </CardHeader>
        <CardContent>
          {requirementsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : netRequirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No net procurement demand. Run MRP after open work orders exist.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">Component</th>
                    <th className="py-2 pr-4">Need by</th>
                    <th className="py-2 pr-4">Gross</th>
                    <th className="py-2 pr-4">On hand</th>
                    <th className="py-2 pr-4">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {netRequirements.map((req) => (
                    <tr key={`${req.productId}-${req.needByDate.toISOString()}`} className="border-b">
                      <td className="py-2 pr-4">{req.productSku}</td>
                      <td className="py-2 pr-4">
                        {new Date(req.needByDate).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4">{req.grossQty.toFixed(2)}</td>
                      <td className="py-2 pr-4">{req.onHand.toFixed(2)}</td>
                      <td className="py-2 pr-4 font-medium">
                        {req.netQty.toFixed(2)}
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
          <CardTitle>Suggested requisitions</CardTitle>
        </CardHeader>
        <CardContent>
          {requisitionsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : requisitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No requisitions yet. Run MRP to generate suggestions.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">Req #</th>
                    <th className="py-2 pr-4">Component</th>
                    <th className="py-2 pr-4">Qty</th>
                    <th className="py-2 pr-4">Need by</th>
                    <th className="py-2 pr-4">Vendor</th>
                    <th className="py-2 pr-4">Status</th>
                    {editable && <th className="py-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map((req) => (
                    <tr key={req.id} className="border-b">
                      <td className="py-2 pr-4 font-mono text-xs">{req.reqNumber}</td>
                      <td className="py-2 pr-4">
                        {req.component?.sku ?? req.componentProductId}
                      </td>
                      <td className="py-2 pr-4">{req.quantity.toFixed(2)}</td>
                      <td className="py-2 pr-4">
                        {new Date(req.needByDate).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4">
                        {req.preferredVendor?.name ?? '—'}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            statusClass[req.status] ?? 'bg-slate-100'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      {editable && (
                        <td className="py-2">
                          {req.status === 'PENDING' && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  reviewMutation.mutate({
                                    requisitionId: req.id,
                                    action: 'APPROVE',
                                  })
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  reviewMutation.mutate({
                                    requisitionId: req.id,
                                    action: 'REJECT',
                                  })
                                }
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAdjustId(req.id);
                                  setAdjustQty(String(req.quantity));
                                }}
                              >
                                Adjust
                              </Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {editable && adjustId && (
            <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border p-4">
              <div>
                <Label htmlFor="adjust-qty">New quantity</Label>
                <Input
                  id="adjust-qty"
                  type="number"
                  min="0.0001"
                  step="0.01"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button onClick={() => handleAdjust(adjustId)}>Save</Button>
              <Button variant="ghost" onClick={() => setAdjustId(null)}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
