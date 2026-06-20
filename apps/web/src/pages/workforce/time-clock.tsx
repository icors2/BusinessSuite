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

export function TimeClockPage() {
  const editable = canEdit(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');
  const [badgeCode, setBadgeCode] = useState('');

  const employeesQuery = trpc.workforce.listEmployees.useQuery({
    status: 'ACTIVE',
    take: 100,
  });
  const openQuery = trpc.workforce.listOpenTimeEntries.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const clockInMutation = trpc.workforce.clockIn.useMutation({
    onSuccess: () => {
      openQuery.refetch();
      setMessage('Clocked in');
      setBadgeCode('');
    },
  });

  const clockOutMutation = trpc.workforce.clockOut.useMutation({
    onSuccess: (entry) => {
      openQuery.refetch();
      setMessage(
        `Clocked out — ${entry.durationMinutes ?? 0} min (${entry.status})`,
      );
      setBadgeCode('');
    },
  });

  const employees = employeesQuery.data?.items ?? [];
  const openEntries = openQuery.data?.items ?? [];
  const openEmployeeIds = new Set(openEntries.map((e) => e.employeeId));

  function handleBadgeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!badgeCode.trim()) return;
    const employee = employees.find((emp) => emp.badgeCode === badgeCode.trim());
    if (!employee) {
      setMessage('Badge not found');
      return;
    }
    if (openEmployeeIds.has(employee.id)) {
      clockOutMutation.mutate({ badgeCode: badgeCode.trim() });
    } else {
      clockInMutation.mutate({ badgeCode: badgeCode.trim() });
    }
  }

  function handleTap(employeeId: string, isOpen: boolean) {
    if (!editable) return;
    if (isOpen) {
      clockOutMutation.mutate({ employeeId });
    } else {
      clockInMutation.mutate({ employeeId });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold" data-tour="workforce-clock-header">Time Clock</h2>
        <p className="text-muted-foreground">
          Tap your name or scan your badge to clock in or out.
        </p>
      </div>

      {message && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-center text-lg text-green-800">
          {message}
        </p>
      )}

      {editable && (
        <Card>
          <CardHeader>
            <CardTitle>Badge entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBadgeSubmit} className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="badge" className="sr-only">
                  Badge code
                </Label>
                <Input
                  id="badge"
                  className="h-14 text-xl"
                  placeholder="Enter badge code"
                  value={badgeCode}
                  onChange={(e) => setBadgeCode(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="h-14 px-8 text-lg"
                disabled={
                  clockInMutation.isPending || clockOutMutation.isPending
                }
              >
                Go
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Employee roster</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {employees.map((emp) => {
              const isOpen = openEmployeeIds.has(emp.id);
              return (
                <Button
                  key={emp.id}
                  variant={isOpen ? 'default' : 'outline'}
                  className="h-20 flex-col text-lg"
                  disabled={
                    !editable ||
                    clockInMutation.isPending ||
                    clockOutMutation.isPending
                  }
                  onClick={() => handleTap(emp.id, isOpen)}
                >
                  <span>
                    {emp.firstName} {emp.lastName}
                  </span>
                  <span className="text-sm font-normal opacity-80">
                    {isOpen ? 'Clock OUT' : 'Clock IN'}
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currently clocked in ({openEntries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {openEntries.length === 0 ? (
            <p className="text-muted-foreground">No one is clocked in.</p>
          ) : (
            <ul className="space-y-2 text-lg">
              {openEntries.map((entry) => (
                <li key={entry.id}>
                  {entry.employee.firstName} {entry.employee.lastName} — since{' '}
                  {new Date(entry.clockIn).toLocaleTimeString()}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
