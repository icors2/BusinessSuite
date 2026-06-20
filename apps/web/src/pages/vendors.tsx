import { FormEvent, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { getSession } from '../lib/auth';
import { trpc } from '../lib/trpc';
import { canEdit } from '../lib/utils';

const emptyAddress = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
};

export function VendorsPage() {
  const session = getSession();
  const editable = canEdit(session?.roles ?? []);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    paymentTerms: '',
    address: { ...emptyAddress },
  });

  const utils = trpc.useUtils();
  const listQuery = trpc.vendor.list.useQuery({ search: search || undefined });
  const createMutation = trpc.vendor.create.useMutation({
    onSuccess: () => {
      utils.vendor.list.invalidate();
      resetForm();
    },
  });
  const updateMutation = trpc.vendor.update.useMutation({
    onSuccess: () => {
      utils.vendor.list.invalidate();
      resetForm();
    },
  });
  const deactivateMutation = trpc.vendor.deactivate.useMutation({
    onSuccess: () => utils.vendor.list.invalidate(),
  });

  function resetForm() {
    setForm({
      name: '',
      email: '',
      phone: '',
      paymentTerms: '',
      address: { ...emptyAddress },
    });
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(vendor: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    paymentTerms: string | null;
    address: unknown;
  }) {
    const addr = (vendor.address as typeof emptyAddress) ?? emptyAddress;
    setEditingId(vendor.id);
    setForm({
      name: vendor.name,
      email: vendor.email ?? '',
      phone: vendor.phone ?? '',
      paymentTerms: vendor.paymentTerms ?? '',
      address: { ...emptyAddress, ...addr },
    });
    setShowForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      paymentTerms: form.paymentTerms || undefined,
      address: form.address.line1 ? form.address : undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const error =
    createMutation.error?.message ?? updateMutation.error?.message ?? '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-tour="vendors-header">Vendors</h2>
          <p className="text-sm text-muted-foreground">
            Manage vendor master data
          </p>
        </div>
        {editable && (
          <Button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            New Vendor
          </Button>
        )}
      </div>

      <Input
        placeholder="Search by name, email, or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {showForm && editable && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Vendor' : 'New Vendor'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address Line 1</Label>
                <Input
                  value={form.address.line1}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address: { ...form.address, line1: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={form.address.city}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address: { ...form.address, city: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={form.address.state}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address: { ...form.address, state: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Postal Code</Label>
                <Input
                  value={form.address.postalCode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address: { ...form.address, postalCode: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input
                  value={form.paymentTerms}
                  onChange={(e) =>
                    setForm({ ...form, paymentTerms: e.target.value })
                  }
                />
              </div>
              {error && (
                <p className="text-sm text-destructive md:col-span-2">{error}</p>
              )}
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit">
                  {editingId ? 'Save Changes' : 'Create Vendor'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Phone</th>
                <th className="px-4 py-3 text-left font-medium">Payment Terms</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                {editable && (
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {listQuery.data?.items.map((vendor) => (
                <tr key={vendor.id} className="border-b">
                  <td className="px-4 py-3">{vendor.name}</td>
                  <td className="px-4 py-3">{vendor.email ?? '—'}</td>
                  <td className="px-4 py-3">{vendor.phone ?? '—'}</td>
                  <td className="px-4 py-3">{vendor.paymentTerms ?? '—'}</td>
                  <td className="px-4 py-3">
                    {vendor.active ? 'Active' : 'Inactive'}
                  </td>
                  {editable && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(vendor)}
                        >
                          Edit
                        </Button>
                        {vendor.active && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              deactivateMutation.mutate({ id: vendor.id })
                            }
                          >
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!listQuery.data?.items.length && (
                <tr>
                  <td
                    colSpan={editable ? 6 : 5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {listQuery.isLoading ? 'Loading…' : 'No vendors found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
