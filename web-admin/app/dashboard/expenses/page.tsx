'use client';
import { useEffect, useState } from 'react';
import { getExpenses } from '@/lib/queries';
import type { Expense } from '@/lib/queries';
import { format, subDays } from 'date-fns';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const CATS = ['All', 'Rent', 'Utilities', 'Restocking', 'Maintenance', 'Salaries', 'Transport', 'Supplies', 'Other'];

export default function ExpensesPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [from, setFrom]     = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo]         = useState(today);
  const [cat, setCat]       = useState('All');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading]   = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await getExpenses(from, to);
    setExpenses(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const filtered = cat === 'All' ? expenses : expenses.filter(e => e.category === cat);
  const total    = filtered.reduce((a, e) => a + Number(e.amount_lbp), 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Expenses</h1>
        <p className="text-sm text-gray-400 mt-0.5">Track money going out</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-gray-400">From</label>
          <input type="date" value={from} max={to}
            onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400">To</label>
          <input type="date" value={to} min={from} max={today}
            onChange={e => setTo(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select value={cat} onChange={e => setCat(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={load}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm text-white rounded-xl transition-colors"
        >
          Apply
        </button>
      </div>

      {/* Total */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-xs text-gray-400 mb-1">Total ({filtered.length} records)</p>
        <p className="text-2xl font-bold text-red-400">{fmt(total)} LL</p>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400 animate-pulse">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-500">No expenses found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-800">
                <tr className="text-xs text-gray-400 uppercase tracking-wide whitespace-nowrap">
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Note</th>
                <th className="text-left px-4 py-3">By</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-b border-gray-800 hover:bg-gray-800/40 whitespace-nowrap">
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full">{e.category}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{e.note ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{e.user_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {format(new Date(e.created_at), 'dd MMM yy, HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-red-400">{fmt(e.amount_lbp)} LL</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
