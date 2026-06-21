import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { RequireAdmin } from '../../components/auth/require-admin';
import { trpc } from '../../lib/trpc';

export function AdminEmployeesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    department: '',
    badgeCode: '',
    laborRate: '',
  });

  const utils = trpc.useUtils();
  const employeesQuery = trpc.admin.listEmployees.useQuery({ take: 100 });

  const createMutation = trpc.admin.createEmployee.useMutation({
    onSuccess: () => {
      utils.admin.listEmployees.invalidate();
      resetForm();
    },
  });

  const updateMutation = trpc.admin.updateEmployee.useMutation({
    onSuccess: () => {
      utils.admin.listEmployees.invalidate();
      resetForm();
    },
  });

  function resetForm() {
    setForm({
      firstName: '',
      lastName: '',
      department: '',
      badgeCode: '',
      laborRate: '',
    });
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(employee: {
    id: string;
    firstName: string;
    lastName: string;
    department: string | null;
    badgeCode: string | null;
    laborRate: number;
  }) {
    setEditingId(employee.id);
    setForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      department: employee.department ?? '',
      badgeCode: employee.badgeCode ?? '',
      laborRate: String(employee.laborRate),
    });
    setShowForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const laborRate = form.laborRate ? Number(form.laborRate) : 0;
    if (editingId) {
      updateMutation.mutate({
        employeeId: editingId,
        firstName: form.firstName,
        lastName: form.lastName,
        department: form.department || null,
        badgeCode: form.badgeCode || null,
        laborRate,
      });
    } else {
      createMutation.mutate({
        firstName: form.firstName,
        lastName: form.lastName,
        department: form.department || undefined,
        badgeCode: form.badgeCode || undefined,
        laborRate,
      });
    }
  }

  const employees = employeesQuery.data?.items ?? [];
  const error =
    createMutation.error?.message ?? updateMutation.error?.message ?? '';

  return (
    <RequireAdmin>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold" data-tour="admin-employees-header">
              Employees
            </h2>
            <p className="text-sm text-muted-foreground">
              Workforce records for scheduling, time clock, and labor cost
            </p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            New employee
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {showForm ? (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? 'Edit employee' : 'New employee'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid max-w-md gap-4">
                <div>
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    required
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    required
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={form.department}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, department: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="badgeCode">Badge code</Label>
                  <Input
                    id="badgeCode"
                    value={form.badgeCode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, badgeCode: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="laborRate">Labor rate ($/hr)</Label>
                  <Input
                    id="laborRate"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.laborRate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, laborRate: e.target.value }))
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">
                    {editingId ? 'Save changes' : 'Create employee'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Employees ({employeesQuery.data?.total ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="flex flex-col gap-2 border-b pb-3 last:border-0 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {employee.employeeNumber} — {employee.firstName}{' '}
                    {employee.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {employee.department ?? 'No department'} ·{' '}
                    {employee.status} · ${employee.laborRate}/hr
                    {employee.user?.email ? ` · ${employee.user.email}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => startEdit(employee)}>
                  Edit
                </Button>
              </div>
            ))}
            {employees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </RequireAdmin>
  );
}
