import React, { useEffect, useState, useMemo } from 'react';
import { getSalesByDateRange, getDailySummary, getTopProducts, getSaleWithItems } from '../services/sales';
import { formatLBP, formatUSD, formatDate, formatDateTime, lbpToUsd } from '../utils/formatters';
import { useSettingsStore } from '../store/settingsStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Search, Download, ChevronLeft, ChevronRight, X, Receipt } from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import type { SaleWithItems } from '../types';

interface Sale {
  id: string;
  transaction_number: string;
  user_name?: string;
  total_lbp: number;
  created_at: string;
}

export const ReportsPage: React.FC = () => {
  const { settings } = useSettingsStore();
  const rate = settings.usd_to_lbp_rate;
  const { t } = useLang();

  const today = new Date().toISOString().split('T')[0];
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [sales, setSales] = useState<Sale[]>([]);
  const [chart, setChart] = useState<{ date: string; revenue: number }[]>([]);
  const [top, setTop] = useState<{ product_name: string; units_sold: number; revenue_lbp: number }[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Transaction detail modal
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [loadingSale, setLoadingSale] = useState(false);

  const handleRowClick = async (saleId: string) => {
    setLoadingSale(true);
    setSelectedSale(null);
    try {
      const sale = await getSaleWithItems(saleId);
      setSelectedSale(sale);
    } finally {
      setLoadingSale(false);
    }
  };

  useEffect(() => {
    (async () => {
      const [s, d, topProducts] = await Promise.all([
        getSalesByDateRange(start, end),
        getDailySummary(30),
        getTopProducts(30),
      ]);
      setSales(s as Sale[]);
      setChart(
        (d as { date: string; total_revenue_lbp: number }[]).slice().reverse()
          .map(r => ({ date: r.date.slice(5), revenue: r.total_revenue_lbp }))
      );
      setTop(topProducts as typeof top);
      setCurrentPage(1); // Reset to page 1 when data changes
    })();
  }, [start, end]);

  // Filter and sort sales
  const filteredAndSortedSales = useMemo(() => {
    let result = [...sales];

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.transaction_number.toLowerCase().includes(q) ||
        (s.user_name && s.user_name.toLowerCase().includes(q))
      );
    }

    // Apply amount filters
    if (minAmount) {
      result = result.filter(s => s.total_lbp >= parseFloat(minAmount));
    }
    if (maxAmount) {
      result = result.filter(s => s.total_lbp <= parseFloat(maxAmount));
    }

    // Apply date range filter
    if (filterDateFrom) {
      result = result.filter(s => s.created_at.slice(0, 10) >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter(s => s.created_at.slice(0, 10) <= filterDateTo);
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'date-asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'amount-desc') return b.total_lbp - a.total_lbp;
      if (sortBy === 'amount-asc') return a.total_lbp - b.total_lbp;
      return 0;
    });

    return result;
  }, [sales, searchQuery, minAmount, maxAmount, filterDateFrom, filterDateTo, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedSales.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedSales = filteredAndSortedSales.slice(startIdx, endIdx);

  const totalRevenue = sales.reduce((s, r) => s + r.total_lbp, 0);
  const filteredRevenue = filteredAndSortedSales.reduce((s, r) => s + r.total_lbp, 0);
  const avgTransaction = filteredAndSortedSales.length > 0 ? filteredRevenue / filteredAndSortedSales.length : 0;

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Transaction #', 'Cashier', 'Date', 'Total LBP', 'Total USD'];
    const rows = filteredAndSortedSales.map(s => [
      s.transaction_number,
      s.user_name || 'N/A',
      formatDate(s.created_at),
      Math.round(s.total_lbp).toString(),
      formatUSD(lbpToUsd(s.total_lbp, rate)),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c}"`).join(',')),
      '',
      ['Summary'],
      ['Total Revenue', filteredRevenue.toFixed(2)],
      ['Transaction Count', filteredAndSortedSales.length],
      ['Average Transaction', avgTransaction.toFixed(2)],
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${start}-to-${end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('reports_title')}</h1>
        <button onClick={exportToCSV} className="btn-primary flex items-center gap-2">
          <Download size={16} /> {t('export_csv')}
        </button>
      </div>

      {/* Date Range & Summary Cards */}
      <div className="card space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="text-xs text-pos-muted block mb-1">{t('from_label')}</label>
            <input className="input" type="date" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-pos-muted block mb-1">{t('to_label')}</label>
            <input className="input" type="date" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="bg-pos-border/20 rounded-lg p-3">
            <p className="text-xs text-pos-muted mb-1">{t('stat_revenue')}</p>
            <p className="text-xl font-bold text-pos-success">{formatLBP(totalRevenue)}</p>
            <p className="text-xs text-pos-muted mt-1">{formatUSD(lbpToUsd(totalRevenue, rate))}</p>
          </div>
          <div className="bg-pos-border/20 rounded-lg p-3">
            <p className="text-xs text-pos-muted mb-1">{t('transactions')}</p>
            <p className="text-xl font-bold text-pos-primary">{sales.length}</p>
            <p className="text-xs text-pos-muted mt-1">{t('sales_today')}</p>
          </div>
          <div className="bg-pos-border/20 rounded-lg p-3">
            <p className="text-xs text-pos-muted mb-1">{t('filtered')}</p>
            <p className="text-xl font-bold text-pos-secondary">{filteredAndSortedSales.length}</p>
            <p className="text-xs text-pos-muted mt-1">{formatLBP(filteredRevenue)}</p>
          </div>
          <div className="bg-pos-border/20 rounded-lg p-3">
            <p className="text-xs text-pos-muted mb-1">{t('avg_order')}</p>
            <p className="text-xl font-bold text-cyan-400">{formatLBP(avgTransaction)}</p>
            <p className="text-xs text-pos-muted mt-1">{filteredAndSortedSales.length} {t('transactions')}</p>
          </div>
        </div>
      </div>

      {/* 30-day bar chart */}
      <div className="card">
        <h2 className="text-base font-semibold mb-4">{t('revenue_chart')}</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,.08)' }}
              formatter={(v: number) => [formatLBP(v), 'Revenue']}
            />
            <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transactions Table with Search & Pagination */}
        <div className="lg:col-span-2 card overflow-hidden p-0 flex flex-col h-full">
          <div className="px-4 py-3 border-b border-pos-border">
            <h2 className="font-semibold mb-3">{t('transactions')} ({filteredAndSortedSales.length})</h2>

            {/* Search and Filters */}
            <div className="space-y-3">
              {/* Search Box */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-pos-muted" />
                <input
                  type="text"
                  placeholder="Search by TX# or Cashier..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="input pl-9 text-sm"
                />
              </div>

              {/* Amount Range Filter */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-pos-muted block mb-1">Min Amount</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={minAmount}
                    onChange={e => {
                      setMinAmount(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="input text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-pos-muted block mb-1">Max Amount</label>
                  <input
                    type="number"
                    placeholder="999"
                    value={maxAmount}
                    onChange={e => {
                      setMaxAmount(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="input text-sm"
                  />
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-pos-muted block mb-1">From Date</label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
                    className="input text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-pos-muted block mb-1">To Date</label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
                    className="input text-sm"
                  />
                </div>
              </div>

              {/* Sort & Clear */}
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="input text-sm flex-1"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Highest Amount</option>
                  <option value="amount-asc">Lowest Amount</option>
                </select>
                {(searchQuery || minAmount || maxAmount || filterDateFrom || filterDateTo) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setMinAmount('');
                      setMaxAmount('');
                      setFilterDateFrom('');
                      setFilterDateTo('');
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 text-xs bg-pos-border hover:bg-pos-border/80 rounded transition text-pos-muted"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-pos-surface">
                <tr className="border-b border-pos-border text-pos-muted">
                  <th className="text-start px-4 py-2">{t('col_tx')}</th>
                  <th className="text-start px-4 py-2">{t('col_cashier')}</th>
                  <th className="text-start px-4 py-2">{t('col_date')}</th>
                  <th className="text-end px-4 py-2">{t('col_total')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-pos-muted">
                      {filteredAndSortedSales.length === 0 ? 'No matching transactions' : 'No transactions'}
                    </td>
                  </tr>
                ) : (
                  paginatedSales.map(s => (
                    <tr
                      key={s.id}
                      onClick={() => handleRowClick(s.id)}
                      className="border-b border-pos-border/50 hover:bg-pos-primary/10 cursor-pointer transition group"
                    >
                      <td className="px-4 py-2 font-mono text-xs text-pos-primary group-hover:text-pos-primary">{s.transaction_number}</td>
                      <td className="px-4 py-2 text-pos-muted">{s.user_name}</td>
                      <td className="px-4 py-2 text-pos-muted text-xs">
                        <p>{formatDate(s.created_at)}</p>
                        <p className="opacity-60">{new Date(s.created_at.endsWith('Z') || s.created_at.includes('+') ? s.created_at : s.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="px-4 py-2 text-end font-semibold">
                        <p className="text-pos-success">{formatLBP(s.total_lbp)}</p>
                        <p className="text-xs text-pos-muted">{formatUSD(lbpToUsd(s.total_lbp, rate))}</p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-pos-border flex items-center justify-between bg-pos-surface/50">
              <p className="text-xs text-pos-muted">
                {t('page')} {currentPage} {t('of')} {totalPages} | {filteredAndSortedSales.length} {t('results')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 hover:bg-pos-border disabled:opacity-50 rounded transition"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 hover:bg-pos-border disabled:opacity-50 rounded transition"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="card overflow-hidden p-0 flex flex-col h-full">
          <div className="px-4 py-3 border-b border-pos-border">
            <h2 className="font-semibold">{t('top_products_30')}</h2>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-pos-surface">
                <tr className="border-b border-pos-border text-pos-muted">
                  <th className="text-start px-4 py-2">#</th>
                  <th className="text-start px-4 py-2">{t('col_product')}</th>
                  <th className="text-end px-4 py-2">{t('col_units_sold')}</th>
                  <th className="text-end px-4 py-2">{t('col_revenue_ll')}</th>
                </tr>
              </thead>
              <tbody>
                {top.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-pos-muted">{t('no_data')}</td>
                  </tr>
                ) : (
                  top.map((p, i) => (
                    <tr key={i} className="border-b border-pos-border/50 hover:bg-pos-border/20 transition">
                      <td className="px-4 py-2 text-pos-muted font-semibold">{i + 1}</td>
                      <td className="px-4 py-2 text-sm">{p.product_name}</td>
                      <td className="px-4 py-2 text-end font-semibold text-pos-secondary">{p.units_sold}</td>
                      <td className="px-4 py-2 text-end text-pos-success">
                        <p className="font-semibold">{formatLBP(p.revenue_lbp)}</p>
                        <p className="text-xs text-pos-muted">{formatUSD(lbpToUsd(p.revenue_lbp, rate))}</p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Transaction Detail Modal ─────────────────────────────────── */}
      {(loadingSale || selectedSale) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => { setSelectedSale(null); setLoadingSale(false); }}
        >
          <div
            className="bg-pos-surface border border-pos-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-pos-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-pos-primary" />
                <h2 className="font-bold text-base">
                  {selectedSale ? selectedSale.transaction_number : 'Loading…'}
                </h2>
                {selectedSale && (
                  <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    selectedSale.payment_method === 'cash'
                      ? 'bg-pos-success/15 text-pos-success'
                      : selectedSale.payment_method === 'debt'
                      ? 'bg-amber-400/15 text-amber-400'
                      : 'bg-pos-primary/15 text-pos-primary'
                  }`}>
                    {selectedSale.payment_method === 'cash' ? 'Cash'
                      : selectedSale.payment_method === 'debt' ? 'Debt'
                      : 'Debt Payment'}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setSelectedSale(null); setLoadingSale(false); }}
                className="p-1.5 rounded-lg hover:bg-pos-border/60 text-pos-muted hover:text-pos-text transition"
              >
                <X size={16} />
              </button>
            </div>

            {loadingSale && !selectedSale ? (
              <div className="flex items-center justify-center py-16 text-pos-muted text-sm">
                <svg className="animate-spin w-5 h-5 mr-2 text-pos-primary" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Loading details…
              </div>
            ) : selectedSale && (
              <div className="overflow-y-auto flex-1">
                {/* Meta info */}
                <div className="px-5 py-3 border-b border-pos-border/50 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <p className="text-xs text-pos-muted mb-0.5">Cashier</p>
                    <p className="font-medium">{selectedSale.user_name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-pos-muted mb-0.5">Date</p>
                    <p className="font-medium">{formatDate(selectedSale.created_at)}</p>
                  </div>
                </div>

                {/* Items table */}
                <div className="px-5 pt-3 pb-2">
                  <p className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-2">Items</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-pos-muted text-xs border-b border-pos-border">
                        <th className="text-start pb-1.5">Product</th>
                        <th className="text-center pb-1.5">Qty</th>
                        <th className="text-end pb-1.5">Unit Price</th>
                        <th className="text-end pb-1.5">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSale.items.map(item => (
                        <tr key={item.id} className="border-b border-pos-border/40">
                          <td className="py-2 pr-2">{item.product_name}</td>
                          <td className="py-2 text-center text-pos-muted">×{item.quantity}</td>
                          <td className="py-2 text-end text-pos-muted font-mono text-xs">{formatLBP(item.unit_price_lbp)}</td>
                          <td className="py-2 text-end font-semibold font-mono text-xs">{formatLBP(item.line_total_lbp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="px-5 pt-2 pb-4 space-y-1.5 border-t border-pos-border/50 mt-1">
                  {selectedSale.discount_lbp > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-pos-muted">Subtotal</span>
                      <span className="font-mono">{formatLBP(selectedSale.subtotal_lbp)}</span>
                    </div>
                  )}
                  {selectedSale.discount_lbp > 0 && (
                    <div className="flex justify-between text-sm text-amber-400">
                      <span>Discount</span>
                      <span className="font-mono">−{formatLBP(selectedSale.discount_lbp)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>Total</span>
                    <div className="text-end">
                      <p className="text-pos-success font-mono">{formatLBP(selectedSale.total_lbp)}</p>
                      <p className="text-xs text-pos-muted font-normal font-mono">≈ {formatUSD(lbpToUsd(selectedSale.total_lbp, rate))}</p>
                    </div>
                  </div>
                  {selectedSale.payment_method === 'cash' && (
                    <>
                      <div className="flex justify-between text-sm text-pos-muted">
                        <span>Cash Received</span>
                        <span className="font-mono">{formatLBP(selectedSale.cash_received_lbp)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-pos-success">
                        <span>Change</span>
                        <span className="font-mono">{formatLBP(selectedSale.change_lbp)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
