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

export function QmsChecklistBuilderPage() {
  const editable = canEdit(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [criterionLabel, setCriterionLabel] = useState('');
  const [criterionType, setCriterionType] = useState<'PASS_FAIL' | 'MEASUREMENT'>(
    'PASS_FAIL',
  );
  const [expectedMin, setExpectedMin] = useState('');
  const [expectedMax, setExpectedMax] = useState('');
  const [sequence, setSequence] = useState('1');

  const templatesQuery = trpc.qms.listTemplates.useQuery({ active: true });

  const upsertMutation = trpc.qms.upsertTemplate.useMutation({
    onSuccess: (t) => {
      templatesQuery.refetch();
      setSelectedTemplateId(t.id);
      setMessage(`Template ${t.code} saved`);
    },
  });

  const addCriterionMutation = trpc.qms.addCriterion.useMutation({
    onSuccess: () => {
      setMessage('Criterion added');
      setCriterionLabel('');
    },
  });

  if (!editable) {
    return (
      <p className="text-muted-foreground">
        Admin or Manager role required to build checklists.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold" data-tour="qms-builder-header">Inspection Checklist Builder</h2>
      {message && <p className="text-sm text-green-700">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>New / Update Template</CardTitle>
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
          <Button
            className="md:col-span-2"
            onClick={() =>
              upsertMutation.mutate({ code, name, active: true })
            }
            disabled={!code || !name}
          >
            Save Template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Criterion</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Template</Label>
            <select
              className="w-full rounded border px-3 py-2"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              <option value="">Select template</option>
              {templatesQuery.data?.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Sequence</Label>
            <Input
              type="number"
              value={sequence}
              onChange={(e) => setSequence(e.target.value)}
            />
          </div>
          <div>
            <Label>Label</Label>
            <Input
              value={criterionLabel}
              onChange={(e) => setCriterionLabel(e.target.value)}
            />
          </div>
          <div>
            <Label>Type</Label>
            <select
              className="w-full rounded border px-3 py-2"
              value={criterionType}
              onChange={(e) =>
                setCriterionType(e.target.value as 'PASS_FAIL' | 'MEASUREMENT')
              }
            >
              <option value="PASS_FAIL">Pass / Fail</option>
              <option value="MEASUREMENT">Measurement</option>
            </select>
          </div>
          {criterionType === 'MEASUREMENT' && (
            <>
              <div>
                <Label>Min</Label>
                <Input
                  type="number"
                  value={expectedMin}
                  onChange={(e) => setExpectedMin(e.target.value)}
                />
              </div>
              <div>
                <Label>Max</Label>
                <Input
                  type="number"
                  value={expectedMax}
                  onChange={(e) => setExpectedMax(e.target.value)}
                />
              </div>
            </>
          )}
          <Button
            className="md:col-span-2"
            onClick={() =>
              addCriterionMutation.mutate({
                templateId: selectedTemplateId,
                sequence: parseInt(sequence, 10),
                label: criterionLabel,
                type: criterionType,
                expectedMin: expectedMin ? parseFloat(expectedMin) : undefined,
                expectedMax: expectedMax ? parseFloat(expectedMax) : undefined,
              })
            }
            disabled={!selectedTemplateId || !criterionLabel}
          >
            Add Criterion
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
