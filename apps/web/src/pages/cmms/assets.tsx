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

export function CmmsAssetsPage() {
  const editable = canEdit(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [workstationId, setWorkstationId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [pmType, setPmType] = useState<'CYCLE_COUNT' | 'CALENDAR'>('CYCLE_COUNT');
  const [thresholdCycles, setThresholdCycles] = useState('100');
  const [intervalDays, setIntervalDays] = useState('30');

  const assetsQuery = trpc.cmms.listAssets.useQuery({});
  const dueSoonQuery = trpc.cmms.getDueSoon.useQuery({});
  const pmRulesQuery = trpc.cmms.listPmRules.useQuery(
    { assetId: selectedAssetId || undefined },
    { enabled: !!selectedAssetId },
  );

  const upsertAssetMutation = trpc.cmms.upsertAsset.useMutation({
    onSuccess: (asset) => {
      assetsQuery.refetch();
      dueSoonQuery.refetch();
      setSelectedAssetId(asset.id);
      setMessage(`Asset ${asset.code} saved`);
    },
  });

  const upsertPmRuleMutation = trpc.cmms.upsertPmRule.useMutation({
    onSuccess: () => {
      pmRulesQuery.refetch();
      dueSoonQuery.refetch();
      setMessage('PM rule saved');
    },
  });

  const evaluateCalendarMutation = trpc.cmms.evaluateCalendarTriggers.useMutation({
    onSuccess: (result) => {
      dueSoonQuery.refetch();
      setMessage(`Calendar evaluation created ${result.created} work order(s)`);
    },
  });

  const dueAssetIds = new Set([
    ...(dueSoonQuery.data?.cycleRules.map((r) => r.assetId) ?? []),
    ...(dueSoonQuery.data?.calendarRules.map((r) => r.assetId) ?? []),
    ...(dueSoonQuery.data?.maintenanceWorkOrders.map((m) => m.assetId) ?? []),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold" data-tour="cmms-assets-header">Maintenance Assets</h2>
      {message && <p className="text-sm text-green-700">{message}</p>}

      <div className="grid gap-4">
        {assetsQuery.data?.items.map((asset) => (
          <Card key={asset.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {asset.code} — {asset.name}
                {dueAssetIds.has(asset.id) && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-900">
                    Due / Overdue
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Status: {asset.status}</p>
              <p>Cumulative cycles: {asset.cumulativeCycles}</p>
              {asset.workstation && (
                <p>
                  Workstation: {asset.workstation.code} ({asset.workstation.name})
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAssetId(asset.id)}
              >
                Configure PM Rules
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {editable && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>New / Update Asset</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Workstation ID (optional)</Label>
                <Input
                  value={workstationId}
                  onChange={(e) => setWorkstationId(e.target.value)}
                  placeholder="UUID of linked workstation"
                />
              </div>
              <Button
                className="md:col-span-2"
                onClick={() =>
                  upsertAssetMutation.mutate({
                    code,
                    name,
                    workstationId: workstationId || undefined,
                  })
                }
                disabled={!code || !name}
              >
                Save Asset
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PM Trigger Rule</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
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
                <Label>Type</Label>
                <select
                  className="w-full rounded border px-3 py-2"
                  value={pmType}
                  onChange={(e) =>
                    setPmType(e.target.value as 'CYCLE_COUNT' | 'CALENDAR')
                  }
                >
                  <option value="CYCLE_COUNT">Cycle Count</option>
                  <option value="CALENDAR">Calendar</option>
                </select>
              </div>
              {pmType === 'CYCLE_COUNT' ? (
                <div>
                  <Label>Threshold Cycles</Label>
                  <Input
                    type="number"
                    value={thresholdCycles}
                    onChange={(e) => setThresholdCycles(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <Label>Interval Days</Label>
                  <Input
                    type="number"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)}
                  />
                </div>
              )}
              <Button
                className="md:col-span-2"
                onClick={() =>
                  upsertPmRuleMutation.mutate({
                    assetId: selectedAssetId,
                    type: pmType,
                    thresholdCycles:
                      pmType === 'CYCLE_COUNT'
                        ? parseInt(thresholdCycles, 10)
                        : undefined,
                    intervalDays:
                      pmType === 'CALENDAR'
                        ? parseInt(intervalDays, 10)
                        : undefined,
                  })
                }
                disabled={!selectedAssetId}
              >
                Save PM Rule
              </Button>
              <Button
                variant="secondary"
                className="md:col-span-2"
                onClick={() => evaluateCalendarMutation.mutate()}
              >
                Evaluate Calendar Triggers
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {selectedAssetId && pmRulesQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle>Active PM Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {pmRulesQuery.data.items.map((rule) => (
              <p key={rule.id}>
                {rule.type}
                {rule.thresholdCycles != null && ` — every ${rule.thresholdCycles} cycles`}
                {rule.intervalDays != null && ` — every ${rule.intervalDays} days`}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
