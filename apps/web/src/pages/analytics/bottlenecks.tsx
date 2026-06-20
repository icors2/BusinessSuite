import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { getSession } from '../../lib/auth';
import { trpc } from '../../lib/trpc';
import { canEdit, canVerify } from '../../lib/utils';

export function AnalyticsBottlenecksPage() {
  const allowed = canVerify(getSession()?.roles ?? []) || canEdit(getSession()?.roles ?? []);
  const query = trpc.analytics.getBottlenecks.useQuery(undefined, {
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <p className="text-sm text-muted-foreground">
        Supervisor or Admin access required for bottleneck analysis.
      </p>
    );
  }

  const chartData =
    query.data?.stations.map((s) => ({
      code: s.workstationCode,
      wip: s.wip,
      avgCycle: s.avgCycleMinutes,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-tour="analytics-bottlenecks-header">Production Bottlenecks</h2>
        <p className="text-sm text-muted-foreground">
          WIP accumulation by workstation — near-real-time from MES operations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>WIP by workstation</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {query.isLoading && <p>Loading…</p>}
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="code" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="wip" fill="#f59e0b" name="WIP count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Flagged bottlenecks</CardTitle>
        </CardHeader>
        <CardContent>
          {query.data?.bottlenecks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No significant bottlenecks detected.
            </p>
          )}
          <ul className="space-y-2 text-sm">
            {query.data?.bottlenecks.map((b) => (
              <li key={b.workstationId} className="rounded border p-3">
                <strong>{b.workstationCode}</strong> — {b.workstationName}
                <br />
                WIP: {b.wip} · Avg cycle: {b.avgCycleMinutes} min · Score:{' '}
                {b.score.toFixed(2)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
