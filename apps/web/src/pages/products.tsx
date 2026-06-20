import { FormEvent, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { getSession } from '../lib/auth';
import { trpc } from '../lib/trpc';
import { canEdit } from '../lib/utils';

export function ProductsPage() {
  const session = getSession();
  const editable = canEdit(session?.roles ?? []);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    sku: '',
    description: '',
    unitOfMeasure: 'EA',
    category: '',
  });

  const utils = trpc.useUtils();
  const listQuery = trpc.product.list.useQuery({ search: search || undefined });
  const createMutation = trpc.product.create.useMutation({
    onSuccess: () => {
      utils.product.list.invalidate();
      resetForm();
    },
  });
  const updateMutation = trpc.product.update.useMutation({
    onSuccess: () => {
      utils.product.list.invalidate();
      resetForm();
    },
  });
  const deactivateMutation = trpc.product.deactivate.useMutation({
    onSuccess: () => utils.product.list.invalidate(),
  });

  function resetForm() {
    setForm({ sku: '', description: '', unitOfMeasure: 'EA', category: '' });
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(product: {
    id: string;
    sku: string;
    description: string;
    unitOfMeasure: string;
    category: string | null;
  }) {
    setEditingId(product.id);
    setForm({
      sku: product.sku,
      description: product.description,
      unitOfMeasure: product.unitOfMeasure,
      category: product.category ?? '',
    });
    setShowForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        sku: form.sku,
        description: form.description,
        unitOfMeasure: form.unitOfMeasure,
        category: form.category || undefined,
      });
    } else {
      createMutation.mutate({
        sku: form.sku,
        description: form.description,
        unitOfMeasure: form.unitOfMeasure,
        category: form.category || undefined,
      });
    }
  }

  const error =
    createMutation.error?.message ?? updateMutation.error?.message ?? '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Products</h2>
          <p className="text-sm text-muted-foreground">
            Manage product master data
          </p>
        </div>
        {editable && (
          <Button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            New Product
          </Button>
        )}
      </div>

      <Input
        placeholder="Search by SKU, description, or category…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {showForm && editable && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Product' : 'New Product'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Unit of Measure</Label>
                <Input
                  value={form.unitOfMeasure}
                  onChange={(e) =>
                    setForm({ ...form, unitOfMeasure: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </div>
              {error && (
                <p className="text-sm text-destructive md:col-span-2">{error}</p>
              )}
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit">
                  {editingId ? 'Save Changes' : 'Create Product'}
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
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">UOM</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                {editable && (
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {listQuery.data?.items.map((product) => (
                <tr key={product.id} className="border-b">
                  <td className="px-4 py-3 font-mono">{product.sku}</td>
                  <td className="px-4 py-3">{product.description}</td>
                  <td className="px-4 py-3">{product.unitOfMeasure}</td>
                  <td className="px-4 py-3">{product.category ?? '—'}</td>
                  <td className="px-4 py-3">
                    {product.active ? 'Active' : 'Inactive'}
                  </td>
                  {editable && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(product)}
                        >
                          Edit
                        </Button>
                        {product.active && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              deactivateMutation.mutate({ id: product.id })
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
                    {listQuery.isLoading ? 'Loading…' : 'No products found'}
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
