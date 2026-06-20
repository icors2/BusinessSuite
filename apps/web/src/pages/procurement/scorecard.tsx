import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { trpc } from '../../lib/trpc';

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function VendorScorecardPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const scorecardQuery = trpc.procurement.getVendorScorecard.useQuery({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  const vendors = scorecardQuery.data?.vendors ?? [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold" data-tour="procurement-scorecard-header">Vendor Scorecard</h1>
        <p className="text-sm text-muted-foreground">
          On-time delivery and quantity accuracy by vendor
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date range</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div>
            <Label htmlFor="from-date">From</Label>
            <Input
              id="from-date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div>
            <Label htmlFor="to-date">To</Label>
            <Input
              id="to-date"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-44"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance metrics</CardTitle>
        </CardHeader>
        <CardContent>
          {scorecardQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No receipt data for the selected range.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">Vendor</th>
                    <th className="py-2 pr-4">Receipts</th>
                    <th className="py-2 pr-4">On-time</th>
                    <th className="py-2 pr-4">Qty accuracy</th>
                    <th className="py-2 pr-4">Lines received</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.vendorId} className="border-b">
                      <td className="py-2 pr-4 font-medium">{v.vendorName}</td>
                      <td className="py-2 pr-4">
                        {v.metrics.onTimeReceipts}/{v.metrics.totalReceipts}
                      </td>
                      <td className="py-2 pr-4">{pct(v.metrics.onTimeRate)}</td>
                      <td className="py-2 pr-4">
                        {pct(v.metrics.quantityAccuracyRate)}
                      </td>
                      <td className="py-2 pr-4">{v.metrics.receivedLines}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
