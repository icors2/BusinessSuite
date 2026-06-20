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
import { canEdit, canMaintain } from '../../lib/utils';

export function CmmsWorkOrdersPage() {
  const editable = canEdit(getSession()?.roles ?? []);
  const maintainable = canMaintain(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');
  const [dueSoonOnly, setDueSoonOnly] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [description, setDescription] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [selectedMwoId, setSelectedMwoId] = useState('');

  const assetsQuery = trpc.cmms.listAssets.useQuery({});
  const mwoQuery = trpc.cmms.listMaintenanceWorkOrders.useQuery({
    dueSoonOnly,
    take: 50,
  });

  const createMutation = trpc.cmms.createMaintenanceWorkOrder.useMutation({
    onSuccess: () => {
      mwoQuery.refetch();
      setMessage('Corrective work order created');
      setDescription('');
    },
  });

  const startMutation = trpc.cmms.startMaintenanceWorkOrder.useMutation({
    onSuccess: () => {
      mwoQuery.refetch();
      setMessage('Work order started');
    },
  });

  const completeMutation = trpc.cmms.completeMaintenanceWorkOrder.useMutation({
    onSuccess: () => {
      mwoQuery.refetch();
      setMessage('Work order completed');
      setSelectedMwoId('');
      setCompleteNotes('');
    },
  });

  const openMwos =
    mwoQuery.data?.items.filter(
      (m) => m.status === 'OPEN' || m.status === 'IN_PROGRESS',
    ) ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Maintenance Work Orders</h2>
      {message && <p className="text-sm text-green-700">{message}</p>}

      <div className="flex items-center gap-2">
        <input
          id="due-soon-filter"
          type="checkbox"
          checked={dueSoonOnly}
          onChange={(e) => setDueSoonOnly(e.target.checked)}
        />
        <Label htmlFor="due-soon-filter">Due soon / overdue only</Label>
      </div>

      <div className="grid gap-4">
        {mwoQuery.data?.items.map((mwo) => (
          <Card key={mwo.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {mwo.mwoNumber}
                <span className="rounded bg-slate-100 px-2 py-0.5 text-sm font-medium">
                  {mwo.type}
                </span>
                <span className="rounded bg-blue-100 px-2 py-0.5 text-sm font-medium text-blue-900">
                  {mwo.status}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{mwo.description}</p>
              <p>
                Asset: {mwo.asset.code} — {mwo.asset.name}
              </p>
              {mwo.scheduledDate && (
                <p>Scheduled: {new Date(mwo.scheduledDate).toLocaleDateString()}</p>
              )}
              {maintainable && mwo.status === 'OPEN' && (
                <Button
                  size="sm"
                  onClick={() => startMutation.mutate({ id: mwo.id })}
                >
                  Start
                </Button>
              )}
              {maintainable &&
                (mwo.status === 'OPEN' || mwo.status === 'IN_PROGRESS') && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedMwoId(mwo.id);
                    }}
                  >
                    Mark for Complete
                  </Button>
                )}
            </CardContent>
          </Card>
        ))}
      </div>

      {editable && (
        <Card>
          <CardHeader>
            <CardTitle>Create Corrective Work Order</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Asset</Label>
              <select
                className="w-full rounded border px-3 py-2"
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
              >
                <option value="">Select asset</option>
                {assetsQuery.data?.items.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button
              className="md:col-span-2"
              onClick={() =>
                createMutation.mutate({
                  assetId: selectedAssetId,
                  description,
                })
              }
              disabled={!selectedAssetId || !description}
            >
              Create Work Order
            </Button>
          </CardContent>
        </Card>
      )}

      {maintainable && selectedMwoId && (
        <Card>
          <CardHeader>
            <CardTitle>Complete Work Order</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Work Order</Label>
              <select
                className="w-full rounded border px-3 py-2"
                value={selectedMwoId}
                onChange={(e) => setSelectedMwoId(e.target.value)}
              >
                <option value="">Select MWO</option>
                {openMwos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.mwoNumber} — {m.asset.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
              />
            </div>
            <Button
              className="md:col-span-2"
              onClick={() =>
                completeMutation.mutate({
                  id: selectedMwoId,
                  notes: completeNotes || undefined,
                })
              }
              disabled={!selectedMwoId}
            >
              Complete
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
