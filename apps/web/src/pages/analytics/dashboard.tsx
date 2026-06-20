import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
import { trpc } from '../../lib/trpc';

export function AnalyticsDashboardPage() {
  const volumeQuery = trpc.analytics.getEventVolume.useQuery({});
  const scrapQuery = trpc.analytics.getScrapRate.useQuery({});
  const ingestionQuery = trpc.analytics.getIngestionStatus.useQuery({});

  const volumeData = volumeQuery.data?.byDay ?? [];
  const missing = ingestionQuery.data?.missingTopics.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-tour="analytics-dashboard-header">Analytics Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Cross-module metrics from ingested events and operational data
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Events ingested</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {ingestionQuery.data?.totalEvents ?? '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              Real-time via Event Bus subscriber
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scrap rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {scrapQuery.data ? `${scrapQuery.data.scrapRatePct}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              Near-real-time from MES cycle records
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Topic coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {ingestionQuery.data
                ? `${ingestionQuery.data.topics.filter((t) => t.ingested).length}/${ingestionQuery.data.topics.length}`
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {missing === 0 ? 'All topics seen' : `${missing} topics pending`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event volume (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {volumeQuery.isLoading && <p>Loading…</p>}
          {volumeData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563eb" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {scrapQuery.data?.byProduct && scrapQuery.data.byProduct.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scrap rate by product</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scrapQuery.data.byProduct}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sku" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="scrapRatePct" fill="#dc2626" name="Scrap %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
