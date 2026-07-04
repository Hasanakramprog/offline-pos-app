'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getTodaySummary, getDailySummaries, getTopProducts, getSettings } from '@/lib/queries';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, ShoppingBag, DollarSign, Percent, Banknote, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-lg font-bold text-white leading-tight truncate">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const fmt  = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtU = (n: number) => `$${n.toFixed(2)}`;

export default function DashboardPage() {
  const [summary, setSummary]   = useState<Awaited<ReturnType<typeof getTodaySummary>> | null>(null);
  const [chart, setChart]       = useState<Awaited<ReturnType<typeof getDailySummaries>>>([]);
  const [topProducts, setTopProducts] = useState<Awaited<ReturnType<typeof getTopProducts>>>([]);
  const [storeName, setStoreName] = useState('MiniMarket');
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, c, tp, settings] = await Promise.all([
        getTodaySummary(),
        getDailySummaries(30),
        getTopProducts(30),
        getSettings(),
      ]);
      setSummary(s);
      setChart(c);
      setTopProducts(tp);
      setStoreName(settings.store_name ?? 'MiniMarket');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // ── Supabase Realtime — update dashboard when a new sale lands ──
    const channel = supabase
      .channel('dashboard-sales')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sales' },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 animate-pulse">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{storeName}</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Dashboard · {format(new Date(), 'EEEE, d MMMM yyyy')}
        </p>
      </div>

      {/* KPI Grid */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            label="Today's Revenue"
            value={`${fmt(summary.revenue_lbp)} LL`}
            sub={fmtU(summary.revenue_usd)}
            icon={TrendingUp}
            color="bg-indigo-500/20 text-indigo-400"
          />
          <KpiCard
            label="Transactions"
            value={String(summary.transactions)}
            sub="sales today"
            icon={ShoppingBag}
            color="bg-emerald-500/20 text-emerald-400"
          />
          <KpiCard
            label="Discounts Given"
            value={`${fmt(summary.discounts_lbp)} LL`}
            icon={Percent}
            color="bg-yellow-500/20 text-yellow-400"
          />
          <KpiCard
            label="Today's Expenses"
            value={`${fmt(summary.expenses_lbp)} LL`}
            icon={TrendingDown}
            color="bg-red-500/20 text-red-400"
          />
          <KpiCard
            label="Net Revenue"
            value={`${fmt(summary.net_revenue_lbp)} LL`}
            icon={Banknote}
            color="bg-sky-500/20 text-sky-400"
          />
          <KpiCard
            label="USD / LBP Rate"
            value={`${fmt(summary.usd_rate)} LL`}
            sub="1 USD ="
            icon={DollarSign}
            color="bg-purple-500/20 text-purple-400"
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Revenue (LL) — Last 30 Days</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickFormatter={d => format(new Date(d), 'MMM d')}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                formatter={(v) => [`${fmt(Number(v ?? 0))} LL`, 'Revenue']}
                labelFormatter={d => format(new Date(d), 'EEEE, MMM d')}
              />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Top Products — Last 30 Days</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center pt-8">No sales data yet</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.product_name} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-4 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{p.product_name}</p>
                    <p className="text-xs text-gray-500">{p.units} units · {fmt(p.revenue)} LL</p>
                  </div>
                  {/* Mini bar */}
                  <div className="w-20 bg-gray-800 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full"
                      style={{ width: `${(p.units / (topProducts[0]?.units ?? 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
