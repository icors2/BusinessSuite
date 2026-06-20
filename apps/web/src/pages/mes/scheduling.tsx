import { useCallback, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { trpc } from '../../lib/trpc';
import { useMesSocket, MesLiveEvent } from '../../lib/use-mes-socket';

export function MesSchedulingPage() {
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const dashboardQuery = trpc.mes.getDashboard.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const onEvent = useCallback(() => {
    setLastUpdate(new Date().toLocaleTimeString());
    dashboardQuery.refetch();
  }, [dashboardQuery]);

  const { connected } = useMesSocket(onEvent as (e: MesLiveEvent) => void);

  const pending = dashboardQuery.data?.pending ?? [];
  const inProgress = dashboardQuery.data?.inProgress ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">MES Scheduling Board</h2>
        <p className="text-sm text-muted-foreground">
          Operations by workstation · live {connected ? 'on' : 'off'}
          {lastUpdate ? ` · updated ${lastUpdate}` : ''}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">WO</th>
                  <th className="py-2">Op</th>
                  <th className="py-2">WS</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((op) => (
                  <tr key={op.id} className="border-b">
                    <td className="py-2">{op.workOrder.woNumber}</td>
                    <td className="py-2">{op.name}</td>
                    <td className="py-2">{op.workstation?.code ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>In progress ({inProgress.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">WO</th>
                  <th className="py-2">Op</th>
                  <th className="py-2">WS</th>
                </tr>
              </thead>
              <tbody>
                {inProgress.map((op) => (
                  <tr key={op.id} className="border-b">
                    <td className="py-2">{op.workOrder.woNumber}</td>
                    <td className="py-2">{op.name}</td>
                    <td className="py-2">{op.workstation?.code ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
