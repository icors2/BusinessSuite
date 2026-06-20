import { useMemo, useState } from 'react';
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

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function WorkforceSchedulePage() {
  const editable = canEdit(getSession()?.roles ?? []);
  const [message, setMessage] = useState('');

  const today = useMemo(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }, []);

  const [from, setFrom] = useState(toDateInput(today));
  const [to, setTo] = useState(() => {
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + 13);
    return toDateInput(end);
  });

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [assignDate, setAssignDate] = useState(toDateInput(today));
  const [unavailFrom, setUnavailFrom] = useState(toDateInput(today));
  const [unavailTo, setUnavailTo] = useState(toDateInput(today));
  const [unavailReason, setUnavailReason] = useState('PTO');

  const employeesQuery = trpc.workforce.listEmployees.useQuery({
    status: 'ACTIVE',
    take: 100,
  });
  const shiftsQuery = trpc.workforce.listShifts.useQuery({ activeOnly: true });
  const assignmentsQuery = trpc.workforce.listAssignments.useQuery({
    from: new Date(`${from}T00:00:00.000Z`),
    to: new Date(`${to}T23:59:59.999Z`),
  });

  const assignMutation = trpc.workforce.assignShift.useMutation({
    onSuccess: () => {
      assignmentsQuery.refetch();
      setMessage('Shift assigned');
    },
  });

  const unavailMutation = trpc.workforce.markUnavailable.useMutation({
    onSuccess: () => {
      setMessage('Unavailability recorded');
    },
  });

  const createEmployeeMutation = trpc.workforce.createEmployee.useMutation({
    onSuccess: () => {
      employeesQuery.refetch();
      setMessage('Employee created');
    },
  });

  const employees = employeesQuery.data?.items ?? [];
  const shifts = shiftsQuery.data?.items ?? [];
  const assignments = assignmentsQuery.data?.assignments ?? [];
  const coverageGaps = assignmentsQuery.data?.coverageGaps ?? [];

  function handleAssign() {
    if (!selectedEmployee || !selectedShift) return;
    assignMutation.mutate({
      employeeId: selectedEmployee,
      shiftId: selectedShift,
      date: new Date(`${assignDate}T00:00:00.000Z`),
    });
  }

  function handleMarkUnavailable() {
    if (!selectedEmployee) return;
    unavailMutation.mutate({
      employeeId: selectedEmployee,
      fromDate: new Date(`${unavailFrom}T00:00:00.000Z`),
      toDate: new Date(`${unavailTo}T00:00:00.000Z`),
      reason: unavailReason || undefined,
    });
  }

  function handleQuickAddEmployee() {
    createEmployeeMutation.mutate({
      firstName: 'New',
      lastName: 'Employee',
      department: 'Assembly',
      laborRate: 20,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold" data-tour="workforce-schedule-header">Workforce Schedule</h2>
        <p className="text-sm text-muted-foreground">
          Assign shifts, review coverage gaps, and mark employee unavailability.
        </p>
      </div>

      {message && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Date range</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div>
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {editable && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Assign shift</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Employee</Label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.employeeNumber} — {e.firstName} {e.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Shift</Label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value)}
                >
                  <option value="">Select shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} ({s.startTime}–{s.endTime})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="assignDate">Date</Label>
                <Input
                  id="assignDate"
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                />
              </div>
              <Button onClick={handleAssign} disabled={assignMutation.isPending}>
                Assign
              </Button>
              <Button
                variant="outline"
                onClick={handleQuickAddEmployee}
                disabled={createEmployeeMutation.isPending}
              >
                Quick add employee
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mark unavailable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Employee</Label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.employeeNumber} — {e.firstName} {e.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="unavailFrom">From</Label>
                  <Input
                    id="unavailFrom"
                    type="date"
                    value={unavailFrom}
                    onChange={(e) => setUnavailFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="unavailTo">To</Label>
                  <Input
                    id="unavailTo"
                    type="date"
                    value={unavailTo}
                    onChange={(e) => setUnavailTo(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Input
                  id="reason"
                  value={unavailReason}
                  onChange={(e) => setUnavailReason(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                onClick={handleMarkUnavailable}
                disabled={unavailMutation.isPending}
              >
                Mark unavailable
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assignments ({assignments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Shift</th>
                  <th className="py-2">Employee</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b">
                    <td className="py-2 pr-4">
                      {new Date(a.date).toISOString().slice(0, 10)}
                    </td>
                    <td className="py-2 pr-4">{a.shift.code}</td>
                    <td className="py-2">
                      {a.employee.firstName} {a.employee.lastName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coverage gaps ({coverageGaps.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {coverageGaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gaps in range.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {coverageGaps.slice(0, 20).map((g) => (
                <li key={`${g.shiftId}-${g.date}`}>
                  {g.date} — {g.shiftCode} unassigned
                </li>
              ))}
              {coverageGaps.length > 20 && (
                <li className="text-muted-foreground">
                  …and {coverageGaps.length - 20} more
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
