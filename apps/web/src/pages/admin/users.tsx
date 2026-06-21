import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { RequireAdmin } from '../../components/auth/require-admin';
import { trpc } from '../../lib/trpc';

export function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    roleNames: ['Manager'] as string[],
  });
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const utils = trpc.useUtils();
  const rolesQuery = trpc.admin.listRoles.useQuery();
  const usersQuery = trpc.admin.listUsers.useQuery({
    search: search || undefined,
    take: 100,
  });

  const createMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      setShowForm(false);
      setForm({ email: '', password: '', roleNames: ['Manager'] });
    },
  });

  const updateRolesMutation = trpc.admin.updateUserRoles.useMutation({
    onSuccess: () => utils.admin.listUsers.invalidate(),
  });

  const deactivateMutation = trpc.admin.deactivateUser.useMutation({
    onSuccess: () => utils.admin.listUsers.invalidate(),
  });

  const resetMutation = trpc.admin.resetPassword.useMutation({
    onSuccess: () => {
      setResetUserId(null);
      setResetPassword('');
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate(form);
  }

  function toggleRole(roleName: string) {
    setForm((prev) => ({
      ...prev,
      roleNames: prev.roleNames.includes(roleName)
        ? prev.roleNames.filter((r) => r !== roleName)
        : [...prev.roleNames, roleName],
    }));
  }

  const roles = rolesQuery.data ?? [];
  const users = usersQuery.data?.items ?? [];
  const error =
    createMutation.error?.message ??
    updateRolesMutation.error?.message ??
    resetMutation.error?.message ??
    '';

  return (
    <RequireAdmin>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold" data-tour="admin-users-header">
              Users
            </h2>
            <p className="text-sm text-muted-foreground">
              Create accounts and manage role assignments
            </p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'New user'}
          </Button>
        </div>

        <Input
          placeholder="Search by email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        {showForm ? (
          <Card>
            <CardHeader>
              <CardTitle>Create user</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="grid max-w-md gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Roles</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {roles.map((role) => (
                      <Button
                        key={role.id}
                        type="button"
                        size="sm"
                        variant={
                          form.roleNames.includes(role.name)
                            ? 'default'
                            : 'outline'
                        }
                        onClick={() => toggleRole(role.name)}
                      >
                        {role.name}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button type="submit" disabled={createMutation.isPending}>
                  Create user
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Accounts ({usersQuery.data?.total ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 border-b pb-4 last:border-0 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">{user.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {user.roles.join(', ')}
                    {user.deactivated ? ' · Deactivated' : ''}
                    {user.employee
                      ? ` · ${user.employee.employeeNumber} ${user.employee.firstName} ${user.employee.lastName}`
                      : ''}
                  </p>
                </div>
                {!user.deactivated ? (
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => {
                      const active = user.roles.includes(role.name);
                      return (
                        <Button
                          key={role.id}
                          size="sm"
                          variant={active ? 'default' : 'outline'}
                          onClick={() => {
                            const next = active
                              ? user.roles.filter((r) => r !== role.name)
                              : [...user.roles, role.name];
                            if (next.length === 0) return;
                            updateRolesMutation.mutate({
                              userId: user.id,
                              roleNames: next,
                            });
                          }}
                        >
                          {role.name}
                        </Button>
                      );
                    })}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setResetUserId(user.id)}
                    >
                      Reset password
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        deactivateMutation.mutate({ userId: user.id })
                      }
                    >
                      Deactivate
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        {resetUserId ? (
          <Card>
            <CardHeader>
              <CardTitle>Reset password</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex max-w-md flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  resetMutation.mutate({
                    userId: resetUserId,
                    password: resetPassword,
                  });
                }}
              >
                <Input
                  type="password"
                  minLength={8}
                  required
                  placeholder="New password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={resetMutation.isPending}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setResetUserId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </RequireAdmin>
  );
}
