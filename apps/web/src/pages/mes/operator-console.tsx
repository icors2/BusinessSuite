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
import { canOperate } from '../../lib/utils';

export function MesOperatorConsolePage() {
  const editable = canOperate(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');
  const [workstationId, setWorkstationId] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [qty, setQty] = useState('1');
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);

  const workstationsQuery = trpc.mes.listWorkstations.useQuery({
    status: 'ACTIVE',
  });
  const operationsQuery = trpc.mes.listOperations.useQuery({
    workstationId: workstationId || undefined,
    take: 50,
  });
  const openEntriesQuery = trpc.workforce.listOpenTimeEntries.useQuery();
  const openCyclesQuery = trpc.mes.listOpenCycles.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const startMutation = trpc.mes.startOperation.useMutation({
    onSuccess: (result) => {
      operationsQuery.refetch();
      openCyclesQuery.refetch();
      setActiveCycleId(result.cycle.id);
      setMessage('Operation started');
    },
  });

  const stopMutation = trpc.mes.stopOperation.useMutation({
    onSuccess: () => {
      operationsQuery.refetch();
      openCyclesQuery.refetch();
      setActiveCycleId(null);
      setMessage('Operation stopped');
    },
  });

  const workstations = workstationsQuery.data?.items ?? [];
  const operations = operationsQuery.data?.items ?? [];
  const clockedIn = openEntriesQuery.data?.items ?? [];
  const openCycles = openCyclesQuery.data?.items ?? [];

  function handleStart(operationId: string) {
    if (!selectedEmployee) return;
    startMutation.mutate({ operationId, employeeId: selectedEmployee });
  }

  function handleStop(cycleId: string) {
    const quantityCompleted = Number(qty);
    if (!quantityCompleted || quantityCompleted <= 0) return;
    stopMutation.mutate({ cycleId, quantityCompleted });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold" data-tour="mes-operator-header">Operator Console</h2>
        <p className="text-muted-foreground">
          Start and stop operations at your workstation.
        </p>
      </div>

      {message && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-center text-green-800">
          {message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Workstation</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full rounded-md border px-3 py-2 text-lg"
            value={workstationId}
            onChange={(e) => setWorkstationId(e.target.value)}
          >
            <option value="">All workstations</option>
            {workstations.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.code} — {ws.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {editable && (
        <Card>
          <CardHeader>
            <CardTitle>Clocked-in operator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {clockedIn.length === 0 ? (
              <p className="text-muted-foreground">
                No operators clocked in. Use Time Clock first.
              </p>
            ) : (
              <div className="grid gap-2">
                {clockedIn.map((entry) => (
                  <Button
                    key={entry.id}
                    variant={
                      selectedEmployee === entry.employeeId
                        ? 'default'
                        : 'outline'
                    }
                    className="h-14 justify-start text-lg"
                    onClick={() => setSelectedEmployee(entry.employeeId)}
                  >
                    {entry.employee.firstName} {entry.employee.lastName}
                  </Button>
                ))}
              </div>
            )}
            <div>
              <Label htmlFor="qty">Qty completed (stop)</Label>
              <Input
                id="qty"
                type="number"
                className="text-lg"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Operations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {operations.map((op) => {
            const openCycle = openCycles.find((c) => c.operationId === op.id);
            return (
              <div
                key={op.id}
                className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">
                    #{op.sequence} {op.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {op.workOrder.woNumber} · {op.status}
                  </p>
                </div>
                {editable && (
                  <div className="flex gap-2">
                    {op.status === 'PENDING' && !openCycle && (
                      <Button
                        className="h-12 px-6"
                        disabled={!selectedEmployee || startMutation.isPending}
                        onClick={() => handleStart(op.id)}
                      >
                        Start
                      </Button>
                    )}
                    {openCycle && (
                      <Button
                        className="h-12 px-6"
                        variant="secondary"
                        disabled={stopMutation.isPending}
                        onClick={() => handleStop(openCycle.id)}
                      >
                        Stop
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {activeCycleId && (
        <p className="text-center text-sm text-muted-foreground">
          Active cycle: {activeCycleId.slice(0, 8)}…
        </p>
      )}
    </div>
  );
}
