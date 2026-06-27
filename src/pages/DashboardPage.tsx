
import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, ShoppingBag, Activity, DollarSign, Receipt } from 'lucide-react';
import { getTodaySummary, getDailySummary, getTopProducts } from '../services/sales';
import { getExpenseSummary } from '../services/expenses';
import { useSettingsStore } from '../store/settingsStore';
import { useLang } from '../i18n/LangContext';
import { formatLBP, formatUSD, lbpToUsd, formatDate } from '../utils/formatters';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const { settings } = useSettingsStore();
  const rate = settings.usd_to_lbp_rate;
  const { t, lang } = useLang();
  const [today, setToday] = useState({ transaction_count: 0, total_revenue_lbp: 0, total_discount_lbp: 0 });
  const [expenses, setExpenses] = useState({ today_lbp: 0, month_lbp: 0 });
  const [chartData, setChartData] = useState<{ date: string; revenue: number; transactions: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ product_name: string; units_sold: number; revenue_lbp: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [t, daily, top, exp] = await Promise.all([
        getTodaySummary(),
        getDailySummary(30),
        getTopProducts(30),
        getExpenseSummary(),
      ]);
      setToday(t);
      setExpenses(exp);
      setChartData(
        (daily as { date: string; transaction_count: number; total_revenue_lbp: number }[])
          .slice().reverse()
          .map(d => ({ date: d.date, revenue: d.total_revenue_lbp, transactions: d.transaction_count }))
      );
      setTopProducts(top as { product_name: string; units_sold: number; revenue_lbp: number }[]);
    })();
  }, []);

  const netProfit = today.total_revenue_lbp - expenses.today_lbp;

  const stat = (label: string, value: string, sub: string, icon: React.ReactNode, color: string) => (
    <div className="card flex items-center gap-4 hover-lift animate-fade-in">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-pos-muted text-sm">{label}</p>
        <p className="text-xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-pos-muted">{sub}</p>}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard_title')}</h1>
        <p className="text-pos-muted text-sm mt-1">
          {t('dashboard_today')} — {new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
        {stat(t('stat_revenue'), formatLBP(today.total_revenue_lbp), formatUSD(lbpToUsd(today.total_revenue_lbp, rate)),
          <span className="text-pos-success font-bold text-lg">LL</span>, 'bg-pos-success/10')}
          
        {stat(t('stat_expenses'), formatLBP(expenses.today_lbp), formatUSD(lbpToUsd(expenses.today_lbp, rate)),
          <TrendingDown size={22} className="text-pos-danger" />, 'bg-pos-danger/10')}
          
        {stat(t('stat_net_revenue'), formatLBP(netProfit), formatUSD(lbpToUsd(netProfit, rate)),
          <DollarSign size={22} className={netProfit >= 0 ? "text-pos-primary" : "text-pos-danger"} />, 
          netProfit >= 0 ? 'bg-pos-primary/10' : 'bg-pos-danger/10')}

        {stat(t('stat_transactions'), String(today.transaction_count), t('sales_today'),
          <ShoppingBag size={22} className="text-pos-text" />, 'bg-pos-surface border border-pos-border')}
          
        {stat(t('stat_discounts'), formatLBP(today.total_discount_lbp), formatUSD(lbpToUsd(today.total_discount_lbp, rate)),
          <Receipt size={22} className="text-pos-warning" />, 'bg-pos-warning/10')}
          
        {stat(t('stat_exchange'), `1$ = ${Number(rate).toLocaleString()} LL`, t('usd_lbp_rate'),
          <Activity size={22} className="text-pos-secondary" />, 'bg-pos-secondary/10')}
      </div>

      {/* Chart */}
      <div className="card">
        <h2 className="text-base font-semibold mb-4">{t('revenue_chart')}</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => v.slice(5)} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,.08)' }}
              labelStyle={{ color: '#1e293b' }}
              formatter={(v: number) => [formatLBP(v), t('stat_revenue')]}
            />
            <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#rev)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top products */}
      <div className="card">
        <h2 className="text-base font-semibold mb-4">{t('top_products')}</h2>
        {topProducts.length === 0 ? (
          <p className="text-pos-muted text-sm text-center py-8">{t('no_sales_data')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-pos-muted border-b border-pos-border">
                <th className="text-left pb-2">#</th>
                <th className="text-left pb-2">{t('col_product')}</th>
                <th className="text-right pb-2">{t('col_units_sold')}</th>
                <th className="text-right pb-2">{t('col_revenue_ll')}</th>
                <th className="text-right pb-2">{t('col_revenue_usd')}</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={i} className="border-b border-pos-border/50">
                  <td className="py-2 text-pos-muted">{i + 1}</td>
                  <td className="py-2 font-medium">{p.product_name}</td>
                  <td className="py-2 text-right">{p.units_sold}</td>
                  <td className="py-2 text-right text-pos-success font-semibold">{formatLBP(p.revenue_lbp)}</td>
                  <td className="py-2 text-right text-pos-muted text-xs">{formatUSD(lbpToUsd(p.revenue_lbp, rate))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
