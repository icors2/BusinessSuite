import { useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { getSession } from '../../lib/auth';
import { trpc } from '../../lib/trpc';
import { canDisposition } from '../../lib/utils';

export function QmsNonConformancePage() {
  const allowed = canDisposition(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [disposition, setDisposition] = useState<
    'USE_AS_IS' | 'REWORK' | 'SCRAP' | 'RETURN_TO_VENDOR'
  >('REWORK');
  const [notes, setNotes] = useState('');

  const ncQuery = trpc.qms.listNonConformances.useQuery({
    status: 'OPEN',
    take: 50,
  });

  const dispositionMutation = trpc.qms.disposition.useMutation({
    onSuccess: () => {
      ncQuery.refetch();
      setMessage('Non-conformance resolved and hold cleared');
      setSelectedId('');
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Non-Conformance Records</h2>
      {message && <p className="text-sm text-green-700">{message}</p>}

      <div className="grid gap-4">
        {ncQuery.data?.items.map((nc) => (
          <Card key={nc.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {nc.ncNumber}
                {nc.holdActive && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-sm font-medium text-red-800">
                    HOLD
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{nc.description}</p>
              <p>
                Severity: {nc.severity} · Source: {nc.source} · Status:{' '}
                {nc.status}
              </p>
              {nc.workOrder && (
                <p>Work Order: {nc.workOrder.woNumber}</p>
              )}
              {nc.bin && <p>Bin: {nc.bin.code}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {allowed && (
        <Card>
          <CardHeader>
            <CardTitle>Disposition</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Non-Conformance</Label>
              <select
                className="w-full rounded border px-3 py-2"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">Select NC</option>
                {ncQuery.data?.items.map((nc) => (
                  <option key={nc.id} value={nc.id}>
                    {nc.ncNumber} — {nc.severity}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Disposition</Label>
              <select
                className="w-full rounded border px-3 py-2"
                value={disposition}
                onChange={(e) =>
                  setDisposition(
                    e.target.value as
                      | 'USE_AS_IS'
                      | 'REWORK'
                      | 'SCRAP'
                      | 'RETURN_TO_VENDOR',
                  )
                }
              >
                <option value="USE_AS_IS">Use As-Is</option>
                <option value="REWORK">Rework</option>
                <option value="SCRAP">Scrap</option>
                <option value="RETURN_TO_VENDOR">Return to Vendor</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Notes</Label>
              <textarea
                className="w-full rounded border px-3 py-2"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button
              className="md:col-span-2"
              onClick={() =>
                dispositionMutation.mutate({
                  nonConformanceId: selectedId,
                  disposition,
                  notes: notes || undefined,
                })
              }
              disabled={!selectedId}
            >
              Resolve & Clear Hold
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
