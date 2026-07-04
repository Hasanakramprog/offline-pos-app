'use client';
import { useState, useEffect } from 'react';
import { getSalesByRange, getSaleItems } from '@/lib/queries';
import type { Sale, SaleItem } from '@/lib/queries';
import { format, subDays } from 'date-fns';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

function SaleRow({ sale }: { sale: Sale }) {
  const [open, setOpen]     = useState(false);
  const [items, setItems]   = useState<SaleItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const toggle = async () => {
    if (!open && !loaded) {
      const data = await getSaleItems(sale.id);
      setItems(data);
      setLoaded(true);
    }
    setOpen(o => !o);
  };

  const badge = sale.payment_method === 'cash'
    ? 'bg-emerald-500/15 text-emerald-400'
    : sale.payment_method === 'debt'
    ? 'bg-yellow-500/15 text-yellow-400'
    : 'bg-blue-500/15 text-blue-400';

  return (
    <>
      <tr
        className="border-b border-gray-800 hover:bg-gray-800/40 cursor-pointer transition-colors whitespace-nowrap"
        onClick={toggle}
      >
        <td className="px-4 py-3 text-gray-400">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-gray-300">{sale.transaction_number}</td>
        <td className="px-4 py-3 text-xs text-gray-400">
          {format(new Date(sale.created_at), 'dd MMM yy, HH:mm')}
        </td>
        <td className="px-4 py-3 text-sm text-gray-300">{sale.user_name ?? '—'}</td>
        <td className="px-4 py-3 text-sm text-white font-medium">{fmt(sale.total_lbp)} LL</td>
        <td className="px-4 py-3">
          <span className={`text-xs px-2 py-0.5 rounded-full ${badge}`}>
            {sale.payment_method}
          </span>
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-900/60">
          <td colSpan={6} className="px-8 py-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left pb-1">Product</th>
                  <th className="text-right pb-1">Qty</th>
                  <th className="text-right pb-1">Unit Price</th>
                  <th className="text-right pb-1">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-t border-gray-800/50">
                    <td className="py-1 text-gray-300">{item.product_name}</td>
                    <td className="py-1 text-right text-gray-400">{item.quantity}</td>
                    <td className="py-1 text-right text-gray-400">{fmt(item.unit_price_lbp)} LL</td>
                    <td className="py-1 text-right text-white">{fmt(item.line_total_lbp)} LL</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ReportsPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [from, setFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [to, setTo]     = useState(today);
  const [sales, setSales]   = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await getSalesByRange(from, to);
    setSales(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const totalRevenue = sales.filter(s => s.payment_method !== 'debt').reduce((a, s) => a + Number(s.total_lbp), 0);
  const rate = sales[0]?.usd_to_lbp_rate ?? 89500;

  const exportCsv = () => {
    const rows = [
      ['TX#', 'Date', 'Cashier', 'Total LL', 'Payment'].join(','),
      ...sales.map(s => [
        s.transaction_number,
        format(new Date(s.created_at), 'yyyy-MM-dd HH:mm'),
        s.user_name ?? '',
        s.total_lbp,
        s.payment_method,
      ].join(',')),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' }));
    a.download = `sales-${from}-to-${to}.csv`;
    a.click();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">Sales analytics</p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm text-white rounded-xl transition-colors"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-gray-400">From</label>
          <input
            type="date" value={from} max={to}
            onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400">To</label>
          <input
            type="date" value={to} min={from} max={today}
            onChange={e => setTo(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm text-white rounded-xl transition-colors"
        >
          Apply
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Revenue (LL)', value: `${fmt(totalRevenue)} LL` },
          { label: 'Revenue (USD)', value: `$${(totalRevenue / rate).toFixed(2)}` },
          { label: 'Transactions', value: String(sales.length) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400 animate-pulse">Loading…</div>
        ) : sales.length === 0 ? (
          <div className="py-12 text-center text-gray-500">No sales in this date range</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-800">
                <tr className="text-xs text-gray-400 uppercase tracking-wide whitespace-nowrap">
                <th className="w-8" />
                <th className="text-left px-4 py-3">TX #</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Cashier</th>
                <th className="text-left px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Method</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(s => <SaleRow key={s.id} sale={s} />)}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
