import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { getSession } from '../../lib/auth';
import { trpc } from '../../lib/trpc';
import { canEdit } from '../../lib/utils';

export function InvoicesPage() {
  const session = getSession();
  const editable = canEdit(session?.roles ?? []);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [form, setForm] = useState({
    customerId: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: '',
    quantity: '1',
    unitPrice: '',
  });

  const utils = trpc.useUtils();
  const listQuery = trpc.invoice.list.useQuery({});
  const customersQuery = trpc.customer.list.useQuery({});
  const detailQuery = trpc.invoice.get.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  const createMutation = trpc.invoice.create.useMutation({
    onSuccess: () => {
      utils.invoice.list.invalidate();
      setShowForm(false);
    },
  });
  const postMutation = trpc.invoice.post.useMutation({
    onSuccess: () => {
      utils.invoice.list.invalidate();
      if (selectedId) utils.invoice.get.invalidate({ id: selectedId });
    },
  });
  const payMutation = trpc.invoice.recordPayment.useMutation({
    onSuccess: () => {
      utils.invoice.list.invalidate();
      if (selectedId) utils.invoice.get.invalidate({ id: selectedId });
      setPayAmount('');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      customerId: form.customerId,
      issueDate: new Date(form.issueDate),
      dueDate: new Date(form.dueDate),
      lines: [
        {
          description: form.description,
          quantity: Number(form.quantity),
          unitPrice: Number(form.unitPrice),
        },
      ],
    });
  }

  const selected = detailQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Customer Invoices (AR)</h2>
          <p className="text-sm text-muted-foreground">
            Create, post, and record payments
          </p>
        </div>
        {editable && (
          <Button onClick={() => setShowForm(true)}>New Invoice</Button>
        )}
      </div>

      {showForm && editable && (
        <Card>
          <CardHeader>
            <CardTitle>New Invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Customer</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.customerId}
                  onChange={(e) =>
                    setForm({ ...form, customerId: e.target.value })
                  }
                  required
                >
                  <option value="">Select customer…</option>
                  {customersQuery.data?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) =>
                    setForm({ ...form, issueDate: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm({ ...form, dueDate: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Line Description</Label>
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
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">Number</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data?.items.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`cursor-pointer border-b hover:bg-muted/30 ${selectedId === inv.id ? 'bg-muted/50' : ''}`}
                    onClick={() => setSelectedId(inv.id)}
                  >
                    <td className="px-4 py-3 font-mono">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">{inv.customer?.name}</td>
                    <td className="px-4 py-3 text-right">
                      ${inv.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader>
              <CardTitle>{selected.invoiceNumber}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                <strong>Status:</strong> {selected.status}
              </p>
              <p>
                <strong>Total:</strong> ${selected.total.toFixed(2)}
              </p>
              <p>
                <strong>Paid:</strong> ${selected.amountPaid.toFixed(2)}
              </p>
              <p>
                <strong>Due:</strong> ${selected.amountDue.toFixed(2)}
              </p>
              <ul className="text-sm text-muted-foreground">
                {selected.lines?.map((line) => (
                  <li key={line.id}>
                    {line.description} — {line.quantity} × $
                    {line.unitPrice.toFixed(2)}
                  </li>
                ))}
              </ul>
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
                          invoiceId: selected.id,
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
