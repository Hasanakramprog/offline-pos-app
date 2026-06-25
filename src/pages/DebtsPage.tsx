import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, X, Users, Phone, ArrowUpCircle, ArrowDownCircle,
  ChevronRight, Wallet, UserPlus, CheckCircle2,
  Search, ChevronLeft, ChevronDown, Calendar, Filter,
} from 'lucide-react';
import {
  createDebtCustomer, getDebtCustomersWithBalance,
  addDebtEntry, getCustomerDebtHistory, deleteDebtCustomer, deleteDebtEntry,
} from '../services/debts';
import { useAuthStore } from '../store/authStore';
import { useLang } from '../i18n/LangContext';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from '../store/toastStore';
import { formatLBP, formatUSD, lbpToUsd } from '../utils/formatters';
import { Modal } from '../components/Common/Modal';
import { Button } from '../components/Common/Button';
import type { DebtCustomerWithBalance, DebtEntry } from '../types';

// ─────────────────────────────────────────────────────────────────────────────

export const DebtsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const rate = settings.usd_to_lbp_rate;
  const { t } = useLang();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [customers, setCustomers] = useState<DebtCustomerWithBalance[]>([]);
  const [selected, setSelected] = useState<DebtCustomerWithBalance | null>(null);
  const [history, setHistory] = useState<DebtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(false);

  // Modals
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [entryType, setEntryType] = useState<'debt' | 'payment'>('debt');

  // Forms
  const [custForm, setCustForm] = useState({ name: '', phone: '', notes: '' });
  const [entryForm, setEntryForm] = useState({ amount: '', note: '' });
  const [amountDisplay, setAmountDisplay] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Customer list filters & pagination ───────────────────────────────────
  const [custSearch,  setCustSearch]  = useState('');
  const [custStatus,  setCustStatus]  = useState<'all'|'pending'|'partial'|'paid'>('all');
  const CUST_PAGE = 8;
  const [custPage,    setCustPage]    = useState(1);

  // ── History filters & pagination ─────────────────────────────────────────
  const [histType,    setHistType]    = useState<'all'|'debt'|'payment'>('all');
  const [histFrom,    setHistFrom]    = useState('');
  const [histTo,      setHistTo]      = useState('');
  const [histSearch,  setHistSearch]  = useState('');
  const HIST_PAGE = 8;
  const [histPage,    setHistPage]    = useState(1);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try { setCustomers(await getDebtCustomersWithBalance()); }
    finally { setLoading(false); }
  }, []);

  const loadHistory = useCallback(async (customerId: string) => {
    setHistLoading(true);
    try { setHistory(await getCustomerDebtHistory(customerId)); }
    finally { setHistLoading(false); }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const selectCustomer = (c: DebtCustomerWithBalance) => {
    setSelected(c);
    loadHistory(c.id);
    // reset history filters when switching customers
    setHistType('all'); setHistFrom(''); setHistTo(''); setHistSearch(''); setHistPage(1);
  };

  // Refresh selected customer balance after mutations
  const refreshSelected = async (customerId: string) => {
    const all = await getDebtCustomersWithBalance();
    setCustomers(all);
    const updated = all.find(c => c.id === customerId) ?? null;
    setSelected(updated);
    if (customerId) await loadHistory(customerId);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddCustomer = async () => {
    if (!custForm.name.trim()) { toast.error(t('customer_name_req')); return; }
    setSaving(true);
    try {
      await createDebtCustomer({
        id: crypto.randomUUID(),
        name: custForm.name.trim(),
        phone: custForm.phone.trim() || undefined,
        notes: custForm.notes.trim() || undefined,
      });
      toast.success(t('customer_added'));
      setAddCustomerOpen(false);
      setCustForm({ name: '', phone: '', notes: '' });
      await loadCustomers();
    } catch { toast.error(t('failed_to_add_cust')); }
    finally { setSaving(false); }
  };

  const handleAddEntry = async () => {
    if (!selected) return;
    const amount = parseFloat(entryForm.amount.replace(/,/g, ''));
    if (!amount || amount <= 0) { toast.error(t('enter_valid_amount')); return; }
    setSaving(true);
    try {
      await addDebtEntry({
        id: crypto.randomUUID(),
        customer_id: selected.id,
        type: entryType,
        amount_lbp: amount,
        note: entryForm.note.trim() || undefined,
        user_id: user!.id,
      });
      toast.success(entryType === 'debt' ? t('debt_recorded') : t('payment_recorded'));
      setAddEntryOpen(false);
      setEntryForm({ amount: '', note: '' });
      setAmountDisplay('');
      await refreshSelected(selected.id);
    } catch { toast.error(t('failed_to_save')); }
    finally { setSaving(false); }
  };

  const handleDeleteCustomer = async (c: DebtCustomerWithBalance) => {
    if (!window.confirm(`${t('delete_cust_confirm')}`)) return;
    try {
      await deleteDebtCustomer(c.id);
      toast.success(t('customer_deleted'));
      if (selected?.id === c.id) setSelected(null);
      await loadCustomers();
    } catch { toast.error(t('failed_to_delete')); }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!selected) return;
    if (!window.confirm(t('delete_entry_confirm'))) return;
    try {
      await deleteDebtEntry(entryId);
      toast.success(t('entry_deleted'));
      await refreshSelected(selected.id);
    } catch { toast.error(t('failed_to_delete')); }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const statusBadge = (c: DebtCustomerWithBalance) => {
    if (c.balance_lbp <= 0)
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pos-success/15 text-pos-success border border-pos-success/30"><CheckCircle2 size={10} /> Paid</span>;
    if (c.total_paid_lbp > 0)
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pos-warning/15 text-pos-warning border border-pos-warning/30">{t('status_partial')}</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pos-danger/15 text-pos-danger border border-pos-danger/30">{t('status_pending')}</span>;
  };

  const totalOwed = customers.reduce((s, c) => s + Math.max(0, c.balance_lbp), 0);

  // ── Derived: filtered + paginated customers ───────────────────────────────
  const filteredCustomers = customers.filter(c => {
    if (custSearch) {
      const q = custSearch.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !(c.phone ?? '').toLowerCase().includes(q)) return false;
    }
    if (custStatus === 'paid'    && c.balance_lbp > 0)                   return false;
    if (custStatus === 'pending' && (c.balance_lbp <= 0 || c.total_paid_lbp > 0)) return false;
    if (custStatus === 'partial' && !(c.balance_lbp > 0 && c.total_paid_lbp > 0)) return false;
    return true;
  });
  const custTotalPages = Math.max(1, Math.ceil(filteredCustomers.length / CUST_PAGE));
  const custSafePage   = Math.min(custPage, custTotalPages);
  const paginatedCusts = filteredCustomers.slice((custSafePage - 1) * CUST_PAGE, custSafePage * CUST_PAGE);

  // ── Derived: filtered + paginated history ─────────────────────────────────
  const filteredHistory = history.filter(e => {
    if (histType !== 'all' && e.type !== histType) return false;
    if (histSearch && !e.note?.toLowerCase().includes(histSearch.toLowerCase())) return false;
    if (histFrom) { const d = new Date(e.created_at).toISOString().slice(0,10); if (d < histFrom) return false; }
    if (histTo)   { const d = new Date(e.created_at).toISOString().slice(0,10); if (d > histTo)   return false; }
    return true;
  });
  const histTotalPages = Math.max(1, Math.ceil(filteredHistory.length / HIST_PAGE));
  const histSafePage   = Math.min(histPage, histTotalPages);
  const paginatedHist  = filteredHistory.slice((histSafePage - 1) * HIST_PAGE, histSafePage * HIST_PAGE);
  const hasHistFilter  = histType !== 'all' || histFrom || histTo || histSearch;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full">
      {/* ── Left: Customer List ─────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-e border-pos-border flex flex-col bg-pos-surface">
        {/* Header */}
        <div className="px-4 py-3 border-b border-pos-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-pos-warning/15 flex items-center justify-center">
                <Wallet size={16} className="text-pos-warning" />
              </div>
              <h1 className="font-bold">{t('debts_title')}</h1>
            </div>
            {canEdit && (
              <button
                onClick={() => setAddCustomerOpen(true)}
                title="Add customer"
                className="w-7 h-7 rounded-lg bg-pos-primary flex items-center justify-center hover:brightness-110 transition-all"
              >
                <Plus size={14} className="text-white" />
              </button>
            )}
          </div>
          {/* Total owed summary */}
          <div className="bg-pos-danger/10 border border-pos-danger/20 rounded-lg px-3 py-2 mb-3">
            <p className="text-xs text-pos-muted">{t('total_outstanding')}</p>
            <p className="font-bold text-pos-danger">{formatLBP(totalOwed)}</p>
            <p className="text-xs text-pos-muted">{formatUSD(lbpToUsd(totalOwed, rate))}</p>
          </div>
          {/* Customer search */}
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-muted" />
            <input
              className="input py-1.5 text-xs pl-7"
              placeholder={t('search_cust_ph')}
              value={custSearch}
              onChange={e => { setCustSearch(e.target.value); setCustPage(1); }}
            />
            {custSearch && (
              <button onClick={() => { setCustSearch(''); setCustPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pos-muted hover:text-pos-text">
                <X size={12} />
              </button>
            )}
          </div>
          {/* Status filter */}
          <div className="flex gap-1">
            {(['all','pending','partial','paid'] as const).map(s => (
              <button key={s}
                onClick={() => { setCustStatus(s); setCustPage(1); }}
                className={`flex-1 py-1 rounded-lg text-[10px] font-medium border capitalize transition-all
                  ${custStatus === s ? 'bg-pos-primary text-white border-pos-primary' : 'border-pos-border text-pos-muted hover:bg-pos-border/40'}`}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-pos-muted text-sm">{t('loading')}</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-pos-muted">
              <Users size={40} strokeWidth={1.2} />
              <p className="text-sm text-center">{customers.length === 0 ? t('no_customers_yet') : t('no_results')}</p>
            </div>
          ) : (
            <>
              {paginatedCusts.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectCustomer(c)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-center gap-3
                    ${selected?.id === c.id
                      ? 'bg-pos-primary/15 border border-pos-primary/40'
                      : 'hover:bg-pos-border/40 border border-transparent'}`}
                >
                  <div className="w-9 h-9 rounded-full bg-pos-border flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {c.phone && <p className="text-xs text-pos-muted truncate">{c.phone}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      {statusBadge(c)}
                      {c.balance_lbp > 0 && (
                        <span className="text-xs font-bold text-pos-danger">{formatLBP(c.balance_lbp)}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-pos-muted flex-shrink-0" />
                </button>
              ))}
              {/* Customer pagination */}
              {custTotalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-2 pb-1">
                  <button onClick={() => setCustPage(p => Math.max(1, p-1))} disabled={custSafePage===1}
                    className="w-6 h-6 flex items-center justify-center rounded-lg border border-pos-border text-pos-muted hover:bg-pos-border/40 disabled:opacity-40 transition-all">
                    <ChevronLeft size={12} />
                  </button>
                  <span className="text-xs text-pos-muted px-1">{custSafePage} / {custTotalPages}</span>
                  <button onClick={() => setCustPage(p => Math.min(custTotalPages, p+1))} disabled={custSafePage===custTotalPages}
                    className="w-6 h-6 flex items-center justify-center rounded-lg border border-pos-border text-pos-muted hover:bg-pos-border/40 disabled:opacity-40 transition-all">
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right: Detail Panel ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-pos-muted gap-3">
            <Users size={56} strokeWidth={1} />
            <p className="text-base">{t('select_cust_view_debt')}</p>
          </div>
        ) : (
          <>
            {/* Customer header */}
            <div className="px-6 py-4 border-b border-pos-border bg-pos-surface flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-pos-primary/20 flex items-center justify-center text-lg font-bold text-pos-primary">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-lg">{selected.name}</h2>
                {selected.phone && (
                  <p className="text-sm text-pos-muted flex items-center gap-1">
                    <Phone size={12} /> {selected.phone}
                  </p>
                )}
              </div>
              {/* Balance summary */}
              <div className="text-right">
                <p className="text-xs text-pos-muted">{t('total_outstanding')}</p>
                <p className={`text-xl font-bold ${selected.balance_lbp > 0 ? 'text-pos-danger' : 'text-pos-success'}`}>
                  {formatLBP(Math.max(0, selected.balance_lbp))}
                </p>
                <p className="text-xs text-pos-muted">{formatUSD(lbpToUsd(Math.max(0, selected.balance_lbp), rate))}</p>
              </div>
              {canEdit && (
                <div className="flex flex-col gap-2 ms-4">
                  <button
                    onClick={() => { setEntryType('debt'); setAddEntryOpen(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pos-danger/15 text-pos-danger border border-pos-danger/30 text-xs font-medium hover:bg-pos-danger/25 transition-all"
                  >
                    <ArrowUpCircle size={13} /> {t('add_debt')}
                  </button>
                  <button
                    onClick={() => { setEntryType('payment'); setAddEntryOpen(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pos-success/15 text-pos-success border border-pos-success/30 text-xs font-medium hover:bg-pos-success/25 transition-all"
                  >
                    <ArrowDownCircle size={13} /> {t('add_payment')}
                  </button>
                </div>
              )}
              {canEdit && (
                <button
                  onClick={() => handleDeleteCustomer(selected)}
                  className="p-2 rounded-lg text-pos-danger hover:bg-pos-danger/10 transition-colors ms-2"
                  title="Delete customer"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {/* Debt/Payment stats */}
            <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-pos-border bg-pos-bg">
              <div className="bg-pos-surface rounded-xl p-3 border border-pos-border">
                <p className="text-xs text-pos-muted">{t('total_debt')}</p>
                <p className="font-bold text-pos-danger">{formatLBP(selected.total_debt_lbp)}</p>
              </div>
              <div className="bg-pos-surface rounded-xl p-3 border border-pos-border">
                <p className="text-xs text-pos-muted">{t('total_paid')}</p>
                <p className="font-bold text-pos-success">{formatLBP(selected.total_paid_lbp)}</p>
              </div>
              <div className="bg-pos-surface rounded-xl p-3 border border-pos-border">
                <p className="text-xs text-pos-muted">{t('balance')}</p>
                <p className={`font-bold ${selected.balance_lbp > 0 ? 'text-pos-danger' : 'text-pos-success'}`}>
                  {formatLBP(Math.max(0, selected.balance_lbp))}
                </p>
              </div>
            </div>

            {/* History */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* History filter bar */}
              <div className="px-6 py-3 border-b border-pos-border bg-pos-bg/30 space-y-2 flex-shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Type toggle */}
                  <div className="flex rounded-lg overflow-hidden border border-pos-border text-xs">
                    {(['all','debt','payment'] as const).map(t => (
                      <button key={t}
                        onClick={() => { setHistType(t); setHistPage(1); }}
                        className={`px-2.5 py-1.5 font-medium capitalize transition-colors
                          ${histType === t ? 'bg-pos-primary text-white' : 'text-pos-muted hover:bg-pos-border/40'}`}
                      >{t}</button>
                    ))}
                  </div>
                  {/* Date range */}
                  <div className="flex items-center gap-1">
                    <Calendar size={11} className="text-pos-muted" />
                    <input type="date" className="input py-1 text-xs w-32"
                      value={histFrom} onChange={e => { setHistFrom(e.target.value); setHistPage(1); }} />
                    <span className="text-pos-muted text-xs">–</span>
                    <input type="date" className="input py-1 text-xs w-32"
                      value={histTo} onChange={e => { setHistTo(e.target.value); setHistPage(1); }} />
                  </div>
                  {/* Note search */}
                  <div className="relative flex-1 min-w-28">
                    <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-pos-muted" />
                    <input className="input py-1 text-xs pl-6" placeholder="Search note…"
                      value={histSearch} onChange={e => { setHistSearch(e.target.value); setHistPage(1); }} />
                    {histSearch && (
                      <button onClick={() => { setHistSearch(''); setHistPage(1); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-pos-muted hover:text-pos-text">
                        <X size={10} />
                      </button>
                    )}
                  </div>
                  {hasHistFilter && (
                    <button onClick={() => { setHistType('all'); setHistFrom(''); setHistTo(''); setHistSearch(''); setHistPage(1); }}
                      className="text-xs text-pos-danger flex items-center gap-1 hover:brightness-110">
                      <X size={10} /> Clear
                    </button>
                  )}
                </div>
                {hasHistFilter && filteredHistory.length > 0 && (
                  <p className="text-xs text-pos-muted">
                    {filteredHistory.length} result{filteredHistory.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* History list */}
              <div className="flex-1 overflow-y-auto p-6">
                {histLoading ? (
                  <div className="flex items-center justify-center h-40 text-pos-muted text-sm">{t('loading')}</div>
                ) : filteredHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-pos-muted">
                    <Wallet size={40} strokeWidth={1.2} />
                    <p className="text-sm">{history.length === 0 ? t('no_transactions_yet') : t('no_expenses_match')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-pos-muted uppercase tracking-wide">{t('transaction_history')}</h3>
                      <span className="text-xs text-pos-muted">{filteredHistory.length} record{filteredHistory.length!==1?'s':''}</span>
                    </div>
                    {paginatedHist.map(entry => (
                      <div key={entry.id}
                        className="flex items-center gap-4 bg-pos-surface border border-pos-border rounded-xl px-4 py-3 group">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                          ${entry.type === 'debt' ? 'bg-pos-danger/15' : 'bg-pos-success/15'}`}>
                          {entry.type === 'debt'
                            ? <ArrowUpCircle size={16} className="text-pos-danger" />
                            : <ArrowDownCircle size={16} className="text-pos-success" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium capitalize">{entry.type}</p>
                          {entry.note && <p className="text-xs text-pos-muted truncate">{entry.note}</p>}
                          <p className="text-xs text-pos-muted/60">
                            {new Date(entry.created_at).toLocaleString()} · {entry.user_name ?? '—'}
                          </p>
                        </div>
                        <p className={`font-bold flex-shrink-0 ${entry.type === 'debt' ? 'text-pos-danger' : 'text-pos-success'}`}>
                          {entry.type === 'debt' ? '+' : '-'}{formatLBP(entry.amount_lbp)}
                        </p>
                        {canEdit && (
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-pos-danger hover:bg-pos-danger/10 transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* History pagination */}
                    {histTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-1 pt-3">
                        <button onClick={() => setHistPage(p => Math.max(1, p-1))} disabled={histSafePage===1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-pos-border text-pos-muted hover:bg-pos-border/40 disabled:opacity-40 transition-all">
                          <ChevronLeft size={13} />
                        </button>
                        <span className="text-xs text-pos-muted px-2">{histSafePage} of {histTotalPages}</span>
                        <button onClick={() => setHistPage(p => Math.min(histTotalPages, p+1))} disabled={histSafePage===histTotalPages}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-pos-border text-pos-muted hover:bg-pos-border/40 disabled:opacity-40 transition-all">
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Add Customer Modal ─────────────────────────────────────── */}
      <Modal open={addCustomerOpen} onClose={() => setAddCustomerOpen(false)} title="Add Customer" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('full_name_star')}</label>
            <input
              className="input" autoFocus placeholder="e.g. Ahmad Khalil"
              value={custForm.name}
              onChange={e => setCustForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleAddCustomer(); }}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('phone_optional')}</label>
            <input
              className="input" placeholder="+961 xx xxx xxx"
              value={custForm.phone}
              onChange={e => setCustForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('notes_optional')}</label>
            <input
              className="input" placeholder="Any notes about this customer…"
              value={custForm.notes}
              onChange={e => setCustForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setAddCustomerOpen(false)}>{t('cancel_btn')}</Button>
            <Button className="flex-1" loading={saving} onClick={handleAddCustomer} icon={<UserPlus size={16} />}>
              Add Customer
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Debt / Payment Modal ───────────────────────────────── */}
      <Modal
        open={addEntryOpen}
        onClose={() => setAddEntryOpen(false)}
        title={entryType === 'debt' ? `${t('add_debt')} — ${selected?.name}` : `${t('add_payment')} — ${selected?.name}`}
        size="sm"
      >
        <div className="space-y-4">
          {/* Type toggle */}
          <div className="flex rounded-xl overflow-hidden border border-pos-border">
            <button
              onClick={() => setEntryType('debt')}
              className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5
                ${entryType === 'debt' ? 'bg-pos-danger text-white' : 'hover:bg-pos-border/40 text-pos-muted'}`}
            >
              <ArrowUpCircle size={14} /> {t('type_debt')}
            </button>
            <button
              onClick={() => setEntryType('payment')}
              className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5
                ${entryType === 'payment' ? 'bg-pos-success text-white' : 'hover:bg-pos-border/40 text-pos-muted'}`}
            >
              <ArrowDownCircle size={14} /> {t('type_payment')}
            </button>
          </div>

          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('amount_star')}</label>
            <input
              className="input font-mono text-lg text-center" autoFocus
              type="text" inputMode="numeric" placeholder="0"
              value={amountDisplay}
              onChange={e => {
                const stripped = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                setEntryForm(f => ({ ...f, amount: stripped }));
                setAmountDisplay(stripped === '' ? '' : Number(stripped).toLocaleString('en-US'));
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleAddEntry(); }}
            />
            {entryForm.amount && (
              <p className="text-xs text-pos-muted mt-1 text-center">= {formatUSD(lbpToUsd(parseFloat(entryForm.amount) || 0, rate))}</p>
            )}
          </div>

          {selected && selected.balance_lbp > 0 && entryType === 'payment' && (
            <button
              onClick={() => {
                const raw = String(Math.round(selected.balance_lbp));
                setEntryForm(f => ({ ...f, amount: raw }));
                setAmountDisplay(Number(raw).toLocaleString('en-US'));
              }}
              className="text-xs text-pos-primary hover:brightness-110 transition-colors"
            > {t('pay_full_balance')} ({formatLBP(selected.balance_lbp)})
            </button>
          )}

          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('notes_optional')}</label>
            <input
              className="input" placeholder={entryType === 'debt' ? 'e.g. Grocery items…' : 'e.g. Cash payment…'}
              value={entryForm.note}
              onChange={e => setEntryForm(f => ({ ...f, note: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setAddEntryOpen(false)}>{t('cancel_btn')}</Button>
            <Button
              className="flex-1"
              loading={saving}
              onClick={handleAddEntry}
              icon={entryType === 'debt' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
            >
              {t('save_btn')} {entryType === 'debt' ? t('type_debt') : t('type_payment')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
