import { FormEvent, useState } from 'react';
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
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { trpc } from '../../lib/trpc';

const examples = [
  'What was our scrap rate last month?',
  'Where are the production bottlenecks?',
  'Show inventory forecast for SKU-001',
  'How many returns were requested last month?',
];

export function AnalyticsAskPage() {
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState('');

  const askQuery = trpc.analytics.ask.useQuery(
    { question: submitted },
    { enabled: submitted.length >= 3 },
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(question.trim());
  }

  const chart = askQuery.data?.chart;
  const series =
    chart?.series?.map((s) => ({
      label: s.label,
      value: Number(s.value),
    })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-tour="analytics-ask-header">Ask Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Deterministic natural-language queries over ingested data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your question</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-2" onSubmit={handleSubmit}>
            <input
              className="min-w-[280px] flex-1 rounded border px-3 py-2"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What was our scrap rate last month?"
            />
            <Button type="submit" disabled={question.trim().length < 3}>
              Ask
            </Button>
          </form>
          <ul className="mt-3 list-inside list-disc text-sm text-muted-foreground">
            {examples.map((ex) => (
              <li key={ex}>
                <button
                  type="button"
                  className="text-left underline-offset-2 hover:underline"
                  onClick={() => {
                    setQuestion(ex);
                    setSubmitted(ex);
                  }}
                >
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {askQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle>Answer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{askQuery.data.answer}</p>
            {askQuery.data.intent === 'unknown' &&
              askQuery.data.supportedQuestions && (
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {askQuery.data.supportedQuestions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              )}
            {series.length > 0 && chart?.type === 'line' && (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#2563eb" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {series.length > 0 && chart?.type === 'bar' && (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
