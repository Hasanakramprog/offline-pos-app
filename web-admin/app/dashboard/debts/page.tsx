'use client';
import { useEffect, useState } from 'react';
import { getDebtCustomers } from '@/lib/queries';
import type { DebtCustomer } from '@/lib/queries';
import { AlertCircle } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function DebtsPage() {
  const [customers, setCustomers] = useState<DebtCustomer[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    getDebtCustomers().then(data => { setCustomers(data); setLoading(false); });
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search)
  );

  const totalOutstanding = filtered
    .filter(c => c.balance_lbp > 0)
    .reduce((a, c) => a + c.balance_lbp, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Customer Debts</h1>
        <p className="text-sm text-gray-400 mt-0.5">Outstanding balances overview</p>
      </div>

      {/* Outstanding total */}
      <div className="bg-yellow-500/10 border border-yellow-500/25 rounded-2xl p-4 flex items-center gap-3">
        <AlertCircle size={20} className="text-yellow-400 flex-shrink-0" />
        <div>
          <p className="text-xs text-yellow-300/70">Total Outstanding</p>
          <p className="text-xl font-bold text-yellow-300">{fmt(totalOutstanding)} LL</p>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search name or phone…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400 animate-pulse">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-500">No customers found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-800">
                <tr className="text-xs text-gray-400 uppercase tracking-wide whitespace-nowrap">
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-right px-4 py-3">Balance</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/40 whitespace-nowrap">
                  <td className="px-4 py-3 text-sm text-white font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{c.phone ?? '—'}</td>
                  <td className={`px-4 py-3 text-right font-medium ${c.balance_lbp > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                    {fmt(c.balance_lbp)} LL
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.balance_lbp <= 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-yellow-500/15 text-yellow-400'
                    }`}>
                      {c.balance_lbp <= 0 ? 'Settled' : 'Pending'}
                    </span>
                  </td>
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
