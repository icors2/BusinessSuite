import { useCallback, useState } from 'react';
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
import { useMesSocket, MesLiveEvent } from '../../lib/use-mes-socket';
import { canVerify } from '../../lib/utils';

export function MesSupervisorPage() {
  const canSignOff = canVerify(getSession()?.roles ?? []);
  const [feed, setFeed] = useState<MesLiveEvent[]>([]);
  const [verifyWoId, setVerifyWoId] = useState('');
  const [notes, setNotes] = useState('');
  const [photoKey, setPhotoKey] = useState('');
  const [message, setMessage] = useState('');

  const dashboardQuery = trpc.mes.getDashboard.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const onEvent = useCallback((event: MesLiveEvent) => {
    setFeed((prev) => [event, ...prev].slice(0, 20));
    dashboardQuery.refetch();
  }, [dashboardQuery]);

  const { connected } = useMesSocket(onEvent);

  const verifyMutation = trpc.mes.verifyWorkOrder.useMutation({
    onSuccess: () => {
      dashboardQuery.refetch();
      setMessage('Work order verified');
      setVerifyWoId('');
      setNotes('');
      setPhotoKey('');
    },
  });

  const dashboard = dashboardQuery.data;
  const awaiting = dashboard?.awaitingVerification ?? [];

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !verifyWoId) return;
    const session = getSession();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/mes/verifications/${verifyWoId}/photo`, {
      method: 'POST',
      headers: session ? { Authorization: `Bearer ${session.accessToken}` } : {},
      body: form,
    });
    if (!res.ok) {
      setMessage('Photo upload failed');
      return;
    }
    const data = await res.json();
    setPhotoKey(data.photoObjectKey);
    setMessage('Photo uploaded');
  }

  function handleVerify() {
    if (!verifyWoId) return;
    verifyMutation.mutate({
      workOrderId: verifyWoId,
      notes: notes || undefined,
      photoObjectKey: photoKey || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Supervisor Floor Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Live MES feed {connected ? '(connected)' : '(connecting…)'}
        </p>
      </div>

      {message && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>In progress ({dashboard?.inProgress.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(dashboard?.inProgress ?? []).map((op) => (
              <div key={op.id} className="rounded border p-2">
                {op.workOrder.woNumber} — {op.name}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live events</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {feed.map((evt, i) => (
                <li key={`${evt.topic}-${i}`} className="font-mono text-xs">
                  {evt.topic}
                </li>
              ))}
              {feed.length === 0 && (
                <li className="text-muted-foreground">Waiting for floor activity…</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Awaiting verification ({awaiting.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {awaiting.map((wo) => (
            <div
              key={wo.id}
              className="flex items-center justify-between rounded border p-3"
            >
              <span>
                {wo.woNumber} — {wo.product.sku}
              </span>
              {canSignOff && (
                <Button
                  size="sm"
                  onClick={() => setVerifyWoId(wo.id)}
                >
                  Verify
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {canSignOff && verifyWoId && (
        <Card>
          <CardHeader>
            <CardTitle>Sign off work order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-mono">{verifyWoId}</p>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="photo">Photo evidence</Label>
              <Input id="photo" type="file" accept="image/*" onChange={handlePhotoUpload} />
            </div>
            <Button onClick={handleVerify} disabled={verifyMutation.isPending}>
              Confirm verification
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
