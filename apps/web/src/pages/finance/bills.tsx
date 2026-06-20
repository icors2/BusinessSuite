import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { getSession } from '../../lib/auth';
import { trpc } from '../../lib/trpc';
import { canEdit } from '../../lib/utils';

export function BillsPage() {
  const session = getSession();
  const editable = canEdit(session?.roles ?? []);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [form, setForm] = useState({
    vendorId: '',
    expenseAccountId: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: '',
    quantity: '1',
    unitPrice: '',
  });

  const utils = trpc.useUtils();
  const listQuery = trpc.bill.list.useQuery({});
  const vendorsQuery = trpc.vendor.list.useQuery({});
  const accountsQuery = trpc.account.list.useQuery({ type: 'EXPENSE' });
  const detailQuery = trpc.bill.get.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  const createMutation = trpc.bill.create.useMutation({
    onSuccess: () => {
      utils.bill.list.invalidate();
      setShowForm(false);
    },
  });
  const postMutation = trpc.bill.post.useMutation({
    onSuccess: () => {
      utils.bill.list.invalidate();
      if (selectedId) utils.bill.get.invalidate({ id: selectedId });
    },
  });
  const payMutation = trpc.bill.recordPayment.useMutation({
    onSuccess: () => {
      utils.bill.list.invalidate();
      if (selectedId) utils.bill.get.invalidate({ id: selectedId });
      setPayAmount('');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      vendorId: form.vendorId,
      issueDate: new Date(form.issueDate),
      dueDate: new Date(form.dueDate),
      lines: [
        {
          description: form.description,
          quantity: Number(form.quantity),
          unitPrice: Number(form.unitPrice),
          expenseAccountId: form.expenseAccountId,
        },
      ],
    });
  }

  const selected = detailQuery.data;
  const expenseAccounts = accountsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Vendor Bills (AP)</h2>
          <p className="text-sm text-muted-foreground">
            Record vendor bills and payments
          </p>
        </div>
        {editable && (
          <Button onClick={() => setShowForm(true)}>New Bill</Button>
        )}
      </div>

      {showForm && editable && (
        <Card>
          <CardHeader>
            <CardTitle>New Bill</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Vendor</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.vendorId}
                  onChange={(e) =>
                    setForm({ ...form, vendorId: e.target.value })
                  }
                  required
                >
                  <option value="">Select vendor…</option>
                  {vendorsQuery.data?.items.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Expense Account</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.expenseAccountId}
                  onChange={(e) =>
                    setForm({ ...form, expenseAccountId: e.target.value })
                  }
                  required
                >
                  <option value="">Select expense account…</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
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
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(e) =>
                    setForm({ ...form, unitPrice: e.target.value })
                  }
                  required
                />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit">Create Draft</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bills</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">Number</th>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data?.items.map((bill) => (
                  <tr
                    key={bill.id}
                    className={`cursor-pointer border-b hover:bg-muted/30 ${selectedId === bill.id ? 'bg-muted/50' : ''}`}
                    onClick={() => setSelectedId(bill.id)}
                  >
                    <td className="px-4 py-3 font-mono">{bill.billNumber}</td>
                    <td className="px-4 py-3">{bill.vendor?.name}</td>
                    <td className="px-4 py-3 text-right">
                      ${bill.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{bill.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader>
              <CardTitle>{selected.billNumber}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                <strong>Status:</strong> {selected.status}
              </p>
              <p>
                <strong>Total:</strong> ${selected.total.toFixed(2)}
              </p>
              <p>
                <strong>Due:</strong> ${selected.amountDue.toFixed(2)}
              </p>
              {editable && selected.status === 'DRAFT' && (
                <Button
                  onClick={() => postMutation.mutate({ id: selected.id })}
                >
                  Post to GL
                </Button>
              )}
              {editable &&
                (selected.status === 'OPEN' ||
                  selected.status === 'PARTIALLY_PAID') && (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Payment amount"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                    <Button
                      onClick={() =>
                        payMutation.mutate({
                          billId: selected.id,
                          amount: Number(payAmount),
                          date: new Date(),
                        })
                      }
                    >
                      Record Payment
                    </Button>
                  </div>
                )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
