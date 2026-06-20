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
import { canInspect } from '../../lib/utils';

export function QmsInspectionPage() {
  const allowed = canInspect(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [results, setResults] = useState<
    Record<string, { passed?: boolean; measuredValue?: string }>
  >({});

  const templatesQuery = trpc.qms.listTemplates.useQuery({ active: true });
  const templateQuery = trpc.qms.getTemplate.useQuery(
    { id: templateId },
    { enabled: !!templateId },
  );

  const completeMutation = trpc.qms.completeInspection.useMutation({
    onSuccess: (data) => {
      setMessage(
        `Inspection ${data.inspection.result}${
          data.nonConformance ? ` — NC ${data.nonConformance.ncNumber} raised` : ''
        }`,
      );
    },
  });

  if (!allowed) {
    return (
      <p className="text-muted-foreground">
        Inspector role or higher required.
      </p>
    );
  }

  const criteria = templateQuery.data?.criteria ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-3xl font-semibold" data-tour="qms-inspection-header">Quality Inspection</h2>
      {message && <p className="text-lg text-green-700">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Select Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Template</Label>
            <select
              className="w-full rounded border px-4 py-3 text-lg"
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setResults({});
              }}
            >
              <option value="">Choose template</option>
              {templatesQuery.data?.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Work Order ID (optional)</Label>
            <Input
              className="text-lg"
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
              placeholder="UUID"
            />
          </div>
        </CardContent>
      </Card>

      {criteria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Complete Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {criteria.map((c) => (
              <div key={c.id} className="rounded-lg border p-4">
                <p className="text-lg font-medium">
                  {c.sequence}. {c.label}{' '}
                  <span className="text-sm text-muted-foreground">
                    ({c.type})
                  </span>
                </p>
                {c.type === 'PASS_FAIL' ? (
                  <div className="mt-3 flex gap-3">
                    <Button
                      size="lg"
                      variant={
                        results[c.id]?.passed === true ? 'default' : 'outline'
                      }
                      onClick={() =>
                        setResults((r) => ({
                          ...r,
                          [c.id]: { ...r[c.id], passed: true },
                        }))
                      }
                    >
                      Pass
                    </Button>
                    <Button
                      size="lg"
                      variant={
                        results[c.id]?.passed === false ? 'destructive' : 'outline'
                      }
                      onClick={() =>
                        setResults((r) => ({
                          ...r,
                          [c.id]: { ...r[c.id], passed: false },
                        }))
                      }
                    >
                      Fail
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <Label>
                      Value ({c.expectedMin?.toString()}–{c.expectedMax?.toString()}{' '}
                      {c.unit ?? ''})
                    </Label>
                    <Input
                      type="number"
                      className="text-lg"
                      value={results[c.id]?.measuredValue ?? ''}
                      onChange={(e) =>
                        setResults((r) => ({
                          ...r,
                          [c.id]: { measuredValue: e.target.value },
                        }))
                      }
                    />
                  </div>
                )}
              </div>
            ))}

            <Button
              size="lg"
              className="w-full py-6 text-xl"
              onClick={() =>
                completeMutation.mutate({
                  templateId,
                  workOrderId: workOrderId || undefined,
                  results: criteria.map((c) => ({
                    criterionId: c.id,
                    passed: results[c.id]?.passed,
                    measuredValue: results[c.id]?.measuredValue
                      ? parseFloat(results[c.id]!.measuredValue!)
                      : undefined,
                  })),
                })
              }
              disabled={!templateId || completeMutation.isPending}
            >
              Submit Inspection
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
