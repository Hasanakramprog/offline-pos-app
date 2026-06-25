import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, TrendingDown, Calendar, Tag,
  ChevronDown, Receipt, Search, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import {
  createExpense, getExpenses, deleteExpense,
  getExpenseSummary, EXPENSE_CATEGORIES,
} from '../services/expenses';
import { useAuthStore } from '../store/authStore';
import { useLang } from '../i18n/LangContext';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from '../store/toastStore';
import { formatLBP, formatUSD, lbpToUsd } from '../utils/formatters';
import { Modal } from '../components/Common/Modal';
import { Button } from '../components/Common/Button';
import type { Expense } from '../types';

// ─────────────────────────────────────────────────────────────────────────────

export const ExpensesPage: React.FC = () => {
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const rate = settings.usd_to_lbp_rate;
  const { t } = useLang();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState({ today_lbp: 0, month_lbp: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterNote, setFilterNote] = useState('');

  // Pagination
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  // Reset page whenever any filter changes
  const resetPage = () => setPage(1);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<{ category: string; amount: string; note: string }>({ category: EXPENSE_CATEGORIES[0], amount: '', note: '' });
  const [amountDisplay, setAmountDisplay] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([getExpenses(), getExpenseSummary()]);
      setExpenses(list);
      setSummary(sum);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = expenses.filter(e => {
    if (filterCategory && e.category !== filterCategory) return false;
    if (filterNote && !e.note?.toLowerCase().includes(filterNote.toLowerCase())) return false;
    if (filterDateFrom) {
      const d = new Date(e.created_at).toISOString().slice(0, 10);
      if (d < filterDateFrom) return false;
    }
    if (filterDateTo) {
      const d = new Date(e.created_at).toISOString().slice(0, 10);
      if (d > filterDateTo) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const filteredTotal = filtered.reduce((s, e) => s + e.amount_lbp, 0);

  const hasActiveFilter = filterCategory || filterDateFrom || filterDateTo || filterNote;

  const clearFilters = () => {
    setFilterCategory('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterNote('');
    setPage(1);
  };

  const handleAdd = async () => {
    const amount = parseFloat(form.amount.replace(/,/g, ''));
    if (!amount || amount <= 0) { toast.error(t('enter_valid_amount')); return; }
    setSaving(true);
    try {
      await createExpense({
        id: crypto.randomUUID(),
        category: form.category,
        amount_lbp: amount,
        note: form.note.trim() || undefined,
        user_id: user!.id,
      });
      toast.success(t('expense_recorded'));
      setAddOpen(false);
      setForm({ category: EXPENSE_CATEGORIES[0], amount: '', note: '' });
      setAmountDisplay('');
      await load();
    } catch {
      toast.error(t('failed_to_save_expense'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('delete_expense_confirm'))) return;
    try {
      await deleteExpense(id);
      toast.success(t('expense_deleted'));
      await load();
    } catch {
      toast.error(t('failed_to_delete'));
    }
  };

  const CATEGORY_COLORS: Record<string, string> = {
    Rent: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    Utilities: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    Restocking: 'bg-green-500/15 text-green-400 border-green-500/30',
    Maintenance: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    Salaries: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    Transport: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    Supplies: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    Other: 'bg-pos-border/50 text-pos-muted border-pos-border',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pos-danger/15 flex items-center justify-center">
            <TrendingDown size={20} className="text-pos-danger" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Expenses</h1>
            <p className="text-xs text-pos-muted">Track money going out</p>
          </div>
        </div>
        {canEdit && (
          <Button icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
            Add Expense
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-pos-surface border border-pos-border rounded-xl p-4">
          <p className="text-xs text-pos-muted flex items-center gap-1.5">
            <Calendar size={12} /> {t('today')}
          </p>
          <p className="text-2xl font-bold text-pos-danger mt-1">{formatLBP(summary.today_lbp)}</p>
          <p className="text-xs text-pos-muted">{formatUSD(lbpToUsd(summary.today_lbp, rate))}</p>
        </div>
        <div className="bg-pos-surface border border-pos-border rounded-xl p-4">
          <p className="text-xs text-pos-muted flex items-center gap-1.5">
            <Calendar size={12} /> {t('this_month')}
          </p>
          <p className="text-2xl font-bold text-pos-danger mt-1">{formatLBP(summary.month_lbp)}</p>
          <p className="text-xs text-pos-muted">{formatUSD(lbpToUsd(summary.month_lbp, rate))}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-pos-surface border border-pos-border rounded-xl p-4 space-y-3">
        {/* Row 1: category chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-pos-muted flex-shrink-0">
            <Tag size={12} /> Category:
          </div>
          <button
            onClick={() => { setFilterCategory(''); resetPage(); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all
              ${!filterCategory ? 'bg-pos-primary text-white border-pos-primary' : 'border-pos-border text-pos-muted hover:bg-pos-border/40'}`}
          >{t('category_all')}</button>
          {EXPENSE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { setFilterCategory(cat === filterCategory ? '' : cat); resetPage(); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all
                ${filterCategory === cat ? 'bg-pos-primary text-white border-pos-primary' : 'border-pos-border text-pos-muted hover:bg-pos-border/40'}`}
            >{cat}</button>
          ))}
        </div>

        {/* Row 2: date range + note search + clear */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar size={12} className="text-pos-muted flex-shrink-0" />
            <input
              type="date"
              className="input py-1.5 text-xs w-36"
              value={filterDateFrom}
              onChange={e => { setFilterDateFrom(e.target.value); resetPage(); }}
              title="From date"
            />
            <span className="text-pos-muted text-xs">–</span>
            <input
              type="date"
              className="input py-1.5 text-xs w-36"
              value={filterDateTo}
              onChange={e => { setFilterDateTo(e.target.value); resetPage(); }}
              title="To date"
            />
          </div>

          <div className="relative flex-1 min-w-40">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-muted" />
            <input
              className="input py-1.5 text-xs pl-7"
              placeholder={t('search_note_ph')}
              value={filterNote}
              onChange={e => { setFilterNote(e.target.value); resetPage(); }}
            />
            {filterNote && (
              <button
                onClick={() => { setFilterNote(''); resetPage(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pos-muted hover:text-pos-text"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-pos-danger hover:brightness-110 transition-colors flex-shrink-0"
            >
              <X size={12} /> Clear all
            </button>
          )}
        </div>

        {/* Filter result count */}
        {hasActiveFilter && (
          <p className="text-xs text-pos-muted">
            {t('showing_expenses')} <span className="font-semibold text-pos-text">{filtered.length}</span> {t('of')} {expenses.length} {t('of_expenses')}
            {filtered.length > 0 && (
              <> · {t('total_colon')} <span className="font-semibold text-pos-danger">{formatLBP(filteredTotal)}</span></>
            )}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-pos-surface border border-pos-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-pos-muted text-sm">{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-pos-muted">
            <Receipt size={40} strokeWidth={1.2} />
            <p className="text-sm">{hasActiveFilter ? t('no_expenses_match') : t('no_expenses_recorded')}</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pos-border">
                  <th className="px-4 py-3 text-left text-xs text-pos-muted font-medium">{t('col_date')}</th>
                  <th className="px-4 py-3 text-left text-xs text-pos-muted font-medium">{t('col_category')}</th>
                  <th className="px-4 py-3 text-left text-xs text-pos-muted font-medium">{t('col_note')}</th>
                  <th className="px-4 py-3 text-right text-xs text-pos-muted font-medium">{t('col_amount')}</th>
                  <th className="px-4 py-3 text-right text-xs text-pos-muted font-medium">{t('col_by')}</th>
                  {canEdit && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {paginated.map((e, i) => (
                  <tr key={e.id}
                    className={`border-b border-pos-border/50 last:border-0 transition-colors hover:bg-pos-border/20
                      ${i % 2 === 0 ? '' : 'bg-pos-bg/30'}`}>
                    <td className="px-4 py-3 text-pos-muted whitespace-nowrap">
                      {new Date(e.created_at).toLocaleDateString()} <br />
                      <span className="text-xs opacity-60">{new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CATEGORY_COLORS[e.category] ?? CATEGORY_COLORS.Other}`}>
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-pos-muted max-w-xs truncate">{e.note || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-bold text-pos-danger">{formatLBP(e.amount_lbp)}</p>
                      <p className="text-xs text-pos-muted">{formatUSD(lbpToUsd(e.amount_lbp, rate))}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-pos-muted">{e.user_name ?? '—'}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDelete(e.id)}
                          className="p-1.5 rounded-lg text-pos-danger hover:bg-pos-danger/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-pos-border bg-pos-bg/30">
              <p className="text-xs text-pos-muted">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                {totalPages > 1 && <> · Page {safePage} of {totalPages}</>}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-pos-border text-pos-muted hover:bg-pos-border/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === '...' ? (
                        <span key={`ellipsis-${i}`} className="w-7 text-center text-xs text-pos-muted">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-all
                            ${safePage === p ? 'bg-pos-primary text-white' : 'border border-pos-border text-pos-muted hover:bg-pos-border/40'}`}
                        >{p}</button>
                      )
                    )
                  }
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-pos-border text-pos-muted hover:bg-pos-border/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Expense Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Expense" size="sm">
        <div className="space-y-4">
          {/* Category */}
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('col_category')}</label>
            <div className="relative">
              <select
                className="input appearance-none pr-8 cursor-pointer"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-pos-muted pointer-events-none" />
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('amount_ll')}</label>
            <input
              className="input font-mono text-lg text-center"
              type="text"
              inputMode="numeric"
              placeholder="0"
              autoFocus
              value={amountDisplay}
              onChange={e => {
                const stripped = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                setForm(f => ({ ...f, amount: stripped }));
                setAmountDisplay(stripped === '' ? '' : Number(stripped).toLocaleString('en-US'));
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            {form.amount && (
              <p className="text-xs text-pos-muted mt-1 text-center">
                = {formatUSD(lbpToUsd(parseFloat(form.amount) || 0, rate))}
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('note_optional')}</label>
            <input
              className="input"
              placeholder="e.g. Monthly rent payment…"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={handleAdd}
              icon={<Plus size={16} />}> {t('save_expense')} </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
