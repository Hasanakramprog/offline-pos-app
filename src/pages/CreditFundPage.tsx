import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wallet, Plus, ArrowUpCircle, ArrowDownCircle,
  ChevronLeft, ChevronRight, TrendingDown, RefreshCw,
  Printer, RotateCcw, Search, Calendar, Tag, X, Filter, Pencil, Trash2,
} from 'lucide-react';
import {
  getFunds, topUpFund, getFundTransactions,
  deductFromFund, resetFund, deleteTransaction, updateTransaction,
} from '../services/creditFund';
import { getExpenses, EXPENSE_CATEGORIES } from '../services/expenses';
import { createExpense } from '../services/expenses';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from '../store/toastStore';
import { formatLBP, formatUSD, lbpToUsd, usdToLbp } from '../utils/formatters';
import { Modal } from '../components/Common/Modal';
import { Button } from '../components/Common/Button';
import { useLang } from '../i18n/LangContext';
import type { CreditFund, CreditFundTransaction, Expense } from '../types';

const PAGE_SIZE = 12;

export const CreditFundPage: React.FC = () => {
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const rate = settings.usd_to_lbp_rate;
  const { t, lang } = useLang();

  const [funds, setFunds] = useState<CreditFund[]>([]);
  const [txns, setTxns] = useState<CreditFundTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState<'all'|'topup'|'deduction'>('all');
  const [filterFund, setFilterFund] = useState<'all'|'fund-lbp'|'fund-usd'>('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterNote, setFilterNote] = useState('');
  const [page, setPage] = useState(1);
  const resetPage = () => setPage(1);

  const [topupOpen, setTopupOpen] = useState(false);
  const [topupFundId, setTopupFundId] = useState<'fund-lbp'|'fund-usd'>('fund-lbp');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupDisplay, setTopupDisplay] = useState('');
  const [topupNote, setTopupNote] = useState('');
  const [topupSaving, setTopupSaving] = useState(false);

  const [expOpen, setExpOpen] = useState(false);
  const [expForm, setExpForm] = useState({ category: EXPENSE_CATEGORIES[0] as string, currency: 'LBP' as 'LBP'|'USD', amount: '', note: '' });
  const [expDisplay, setExpDisplay] = useState('');
  const [expSaving, setExpSaving] = useState(false);

  const [printOpen, setPrintOpen] = useState(false);
  const [printFrom, setPrintFrom] = useState('');
  const [printTo, setPrintTo] = useState('');
  const [printFund, setPrintFund] = useState<'all'|'fund-lbp'|'fund-usd'>('all');

  const [editOpen, setEditOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<CreditFundTransaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDisplay, setEditDisplay] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const confirmAction = useRef<(()=>void)|null>(null);
  const askConfirm = (msg: string, action: ()=>void) => { setConfirmMsg(msg); confirmAction.current = action; setConfirmOpen(true); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f,t,e] = await Promise.all([getFunds(), getFundTransactions(), getExpenses()]);
      setFunds(f); setTxns(t); setExpenses(e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const lbpFund = funds.find(f => f.id === 'fund-lbp');
  const usdFund = funds.find(f => f.id === 'fund-usd');

  // Only resets are hidden from history & print; topups are visible
  const isInternal = (t: CreditFundTransaction) =>
    (t.type === 'deduction' && !t.expense_id && t.note === 'Fund reset to zero');

  const hasActiveFilter = filterType !== 'all' || filterFund !== 'all' || filterFrom || filterTo || filterNote;

  const filtered = txns.filter(t => {
    if (isInternal(t)) return false;
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterFund !== 'all' && t.fund_id !== filterFund) return false;
    if (filterNote && !t.note?.toLowerCase().includes(filterNote.toLowerCase())) return false;
    if (filterFrom) { const utc = t.created_at.endsWith('Z')||t.created_at.includes('+')?t.created_at:t.created_at+'Z'; const d = new Date(utc).toLocaleDateString('en-CA'); if (d < filterFrom) return false; }
    if (filterTo)   { const utc = t.created_at.endsWith('Z')||t.created_at.includes('+')?t.created_at:t.created_at+'Z'; const d = new Date(utc).toLocaleDateString('en-CA'); if (d > filterTo)   return false; }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage-1)*PAGE_SIZE, safePage*PAGE_SIZE);

  const clearFilters = () => { setFilterType('all'); setFilterFund('all'); setFilterFrom(''); setFilterTo(''); setFilterNote(''); resetPage(); };

  const openTopup = (id: 'fund-lbp'|'fund-usd') => { setTopupFundId(id); setTopupAmount(''); setTopupDisplay(''); setTopupNote(''); setTopupOpen(true); };

  const handleTopup = async () => {
    const amount = parseFloat(topupAmount.replace(/,/g,''));
    if (!amount || amount <= 0) { toast.error(t('enter_valid_amount')); return; }
    setTopupSaving(true);
    try { await topUpFund(topupFundId, amount, topupNote.trim()||undefined, user?.id); toast.success(t('fund_topped_up')); setTopupOpen(false); await load(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setTopupSaving(false); }
  };

  const openExpense = () => { setExpForm({ category: EXPENSE_CATEGORIES[0], currency: 'LBP', amount: '', note: '' }); setExpDisplay(''); setExpOpen(true); };

  const handlePayExpense = async () => {
    const raw = parseFloat(expForm.amount.replace(/,/g,''));
    if (!raw || raw <= 0) { toast.error(t('enter_valid_amount')); return; }
    const fundId = expForm.currency === 'LBP' ? 'fund-lbp' : 'fund-usd';
    const fund = funds.find(f => f.id === fundId);
    if ((fund?.balance ?? 0) < raw) { toast.error(t('insufficient_balance').replace('{amount}', expForm.currency==='LBP'?formatLBP(fund?.balance??0):formatUSD(fund?.balance??0))); return; }
    const note = expForm.note.trim()||undefined;
    const msg = t('confirm_pay_expense').replace('{amount}', expForm.currency==='LBP'?formatLBP(raw):formatUSD(raw)).replace('{currency}', expForm.currency).replace('{category}', expForm.category);
    askConfirm(msg, async () => {
      setExpSaving(true);
      try {
        const expId = crypto.randomUUID();
        const amount_lbp = expForm.currency==='LBP' ? raw : usdToLbp(raw,rate);
        const amount_usd = expForm.currency==='USD' ? raw : undefined;
        await createExpense({ id:expId, category:expForm.category, amount_lbp, amount_usd, currency:expForm.currency, fund_paid:1, note, user_id:user?.id });
        await deductFromFund(fundId, raw, expId, user?.id, note);
        toast.success(t('expense_paid_from_fund')); setExpOpen(false); await load();
      } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
      finally { setExpSaving(false); }
    });
  };

  const handleReset = (fundId: 'fund-lbp'|'fund-usd') => {
    const fund = funds.find(f => f.id === fundId);
    if ((fund?.balance??0) === 0) { toast.error(t('fund_already_zero')); return; }
    const cur = fundId==='fund-lbp'?'LBP':'USD';
    const bal = fundId==='fund-lbp'?formatLBP(fund?.balance??0):formatUSD(fund?.balance??0);
    const msg = t('confirm_reset_fund').replace('{currency}', cur).replace('{amount}', bal);
    askConfirm(msg, async () => {
      try { await resetFund(fundId, user?.id); toast.success(t('fund_reset_success').replace('{currency}', cur)); await load(); }
      catch (err: unknown) { toast.error(err instanceof Error ? err.message : t('reset_failed')); }
    });
  };

  const openEditTxn = (txn: CreditFundTransaction) => {
    setEditTxn(txn);
    const isUsd = txn.fund_id === 'fund-usd';
    const display = isUsd ? txn.amount.toString() : Math.round(txn.amount).toLocaleString('en-US');
    setEditAmount(txn.amount.toString());
    setEditDisplay(display);
    setEditNote(txn.note ?? '');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editTxn) return;
    const amount = parseFloat(editAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) { toast.error(t('enter_valid_amount')); return; }
    setEditSaving(true);
    try {
      await updateTransaction(editTxn.id, amount, editNote.trim() || undefined);
      toast.success('Transaction updated');
      setEditOpen(false);
      await load();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setEditSaving(false); }
  };

  const handleDeleteTxn = (txn: CreditFundTransaction) => {
    const isUsd = txn.fund_id === 'fund-usd';
    const amt = isUsd ? formatUSD(txn.amount) : formatLBP(txn.amount);
    askConfirm(
      `Delete this transaction (${amt})? The fund balance will be restored.`,
      async () => {
        try { await deleteTransaction(txn.id); toast.success('Transaction deleted'); await load(); }
        catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
      }
    );
  };

  const getPrintTxns = () => txns.filter(t => {
    if (isInternal(t)) return false;
    if (printFund !== 'all' && t.fund_id !== printFund) return false;
    if (printFrom) { const utc = t.created_at.endsWith('Z')||t.created_at.includes('+')?t.created_at:t.created_at+'Z'; const d = new Date(utc).toLocaleDateString('en-CA'); if (d < printFrom) return false; }
    if (printTo)   { const utc = t.created_at.endsWith('Z')||t.created_at.includes('+')?t.created_at:t.created_at+'Z'; const d = new Date(utc).toLocaleDateString('en-CA'); if (d > printTo)   return false; }
    return true;
  });

  const handlePrint = () => {
    const printTxns = getPrintTxns();
    if (printTxns.length === 0) { toast.error(t('no_txns_in_range')); return; }
    const totalTopup    = printTxns.filter(t=>t.type==='topup').reduce((s,t)=>s+t.amount,0);
    const totalDeducted = printTxns.filter(t=>t.type==='deduction').reduce((s,t)=>s+t.amount,0);
    const periodLabel = printFrom||printTo ? `${printFrom||'…'} - ${printTo||'…'}` : (lang === 'ar' ? 'كل الوقت' : 'All Time');
    const fundLabel   = printFund==='all'?t('fund_all'):printFund==='fund-lbp'?t('fund_lbp'):t('fund_usd');
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const align = lang === 'ar' ? 'right' : 'left';
    
    const rows = [...printTxns].reverse().map(tItem => {
      const isDed = tItem.type==='deduction'; const isUsd = tItem.fund_id==='fund-usd';
      const amt   = isUsd ? formatUSD(tItem.amount) : formatLBP(tItem.amount);
      const _utcAt = tItem.created_at.endsWith('Z')||tItem.created_at.includes('+')?tItem.created_at:tItem.created_at+'Z';
      const ds    = new Date(_utcAt).toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'2-digit'});
      const exp   = tItem.expense_id ? expenses.find(e=>e.id===tItem.expense_id) : undefined;
      const noteT = exp ? exp.category+(tItem.note?` · ${tItem.note}`:'') : (tItem.note||'');
      const typeLabel = isDed ? t('type_deduction') : t('type_topup');
      return `<div class="er"><span class="dt">${ds}</span><span class="fd ${isUsd?'usd':'lbp'}">${isUsd?'USD':'LBP'}</span><span class="tp ${isDed?'dc':'tc'}">${typeLabel}</span><span class="nt">${noteT}</span><span class="am ${isDed?'dc':'tc'}">${isDed?'-':'+'}${amt}</span></div>`;
    }).join('');
    
    const html = `<!DOCTYPE html><html dir="${dir}" lang="${lang}"><head><meta charset="UTF-8"/><title>${t('print_statement')}</title><style>@page{size:80mm auto;margin:0}html,body{margin:0;padding:0;background:#fff;color:#000}*{box-sizing:border-box}body{width:100%;max-width:80mm;font-family:'Courier New',Courier,monospace;font-size:9pt;font-weight:700;line-height:1.4;direction:${dir}}.w{padding:2mm 14mm 2mm 2mm}.cn{text-align:center}.sn{font-size:13pt;font-weight:700;text-align:center;text-transform:uppercase;margin-bottom:1mm}.sm{font-size:7.5pt;color:#333;text-align:center}.dv{border:none;border-top:1px dashed #000;margin:2mm 0;display:block}.er{display:flex;width:100%;font-size:7.5pt;line-height:1.6;gap:1mm}.dt{flex-shrink:0;color:#444;min-width:14mm}.fd{flex-shrink:0;min-width:7mm;font-size:7pt}.tp{flex-shrink:0;min-width:7mm}.nt{flex:1;font-size:7pt;color:#555;overflow:hidden;white-space:nowrap;text-align:${align}}.am{flex-shrink:0;text-align:${lang==='ar'?'left':'right'};font-size:8pt;min-width:22mm}.dc{color:#dc2626}.tc{color:#16a34a}.lbp{color:#2563eb}.usd{color:#059669}.rw{display:flex;justify-content:space-between;font-size:8.5pt;line-height:1.5}</style></head><body><div class="w"><p class="sn">${settings.store_name}</p><p class="sm">${t('print_statement')}</p><p class="sm">${fundLabel} &middot; ${periodLabel}</p><p class="sm">${lang==='ar'?'تمت الطباعة':'Printed'}: ${new Date().toLocaleString('en-GB')}</p><hr class="dv"/>${rows}<hr class="dv"/><div class="rw"><span>${lang==='ar'?'إجمالي الشحن':'Total Topped Up'}</span><span style="color:#16a34a">${formatLBP(totalTopup)}</span></div><div class="rw"><span>${lang==='ar'?'إجمالي الخصم':'Total Deducted'}</span><span style="color:#dc2626">${formatLBP(totalDeducted)}</span></div><hr class="dv"/><div class="rw"><span>${t('lbp_credit')}</span><span>${formatLBP(lbpFund?.balance??0)}</span></div><div class="rw"><span>${t('usd_credit')}</span><span>${formatUSD(usdFund?.balance??0)}</span></div>${settings.receipt_footer?`<hr class="dv"/><p class="sm">${settings.receipt_footer}</p>`:''}</div></body></html>`;
    const api = (window as any).electronAPI?.print;
    if (api?.receipt) { api.receipt(html, settings.printer_share_name||undefined).then((r:any)=>{ if(!r?.success) toast.error('Print failed: '+(r?.error??'unknown')); }); }
    else { const w=window.open('','_blank','width=320,height=700'); if(!w)return; w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>{w.print();w.close();},300); }
    setPrintOpen(false);
  };

  const linkedExpense = (t: CreditFundTransaction) => t.expense_id ? expenses.find(e=>e.id===t.expense_id) : undefined;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pos-primary/15 flex items-center justify-center"><Wallet size={20} className="text-pos-primary" /></div>
          <div><h1 className="text-xl font-bold">{t('credit_fund_title')}</h1><p className="text-xs text-pos-muted">{t('credit_fund_desc')}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-pos-border text-pos-muted hover:text-pos-text hover:bg-pos-border/40 transition-all" title="Refresh"><RefreshCw size={15} /></button>
          <button onClick={() => { setPrintFrom(''); setPrintTo(''); setPrintFund('all'); setPrintOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-pos-border text-pos-muted hover:text-pos-text hover:bg-pos-border/40 text-sm font-medium transition-all">
            <Printer size={15} /> {t('print_btn')}
          </button>
          <Button icon={<TrendingDown size={15} />} variant="secondary" onClick={openExpense}>{t('pay_expense_btn')}</Button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* LBP */}
        <div className="bg-pos-surface border border-pos-border rounded-2xl p-5 space-y-3 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-pos-primary/5 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-pos-primary/15 flex items-center justify-center"><Wallet size={16} className="text-pos-primary" /></div><span className="text-sm font-semibold text-pos-muted">{t('lbp_credit')}</span></div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-pos-primary/10 text-pos-primary font-medium">{t('lebanese_lira')}</span>
          </div>
          {loading ? <div className="h-8 w-40 bg-pos-border/40 animate-pulse rounded-lg" /> : <><p className="text-3xl font-bold tracking-tight">{formatLBP(lbpFund?.balance??0)}</p><p className="text-xs text-pos-muted">≈ {formatUSD(lbpToUsd(lbpFund?.balance??0,rate))}</p></>}
          <div className="flex gap-2">
            <Button size="sm" icon={<Plus size={14}/>} onClick={()=>openTopup('fund-lbp')} className="flex-1 !justify-center">{t('top_up_btn')}</Button>
            <button onClick={()=>handleReset('fund-lbp')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-pos-danger/30 text-pos-danger bg-pos-danger/5 hover:bg-pos-danger/15 text-xs font-medium transition-all" title={t('reset_to_zero')}><RotateCcw size={12}/> {t('reset_btn')}</button>
          </div>
        </div>
        {/* USD */}
        <div className="bg-pos-surface border border-pos-border rounded-2xl p-5 space-y-3 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center"><Wallet size={16} className="text-emerald-400" /></div><span className="text-sm font-semibold text-pos-muted">{t('usd_credit')}</span></div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">{t('us_dollar')}</span>
          </div>
          {loading ? <div className="h-8 w-32 bg-pos-border/40 animate-pulse rounded-lg" /> : <><p className="text-3xl font-bold tracking-tight text-emerald-400">{formatUSD(usdFund?.balance??0)}</p><p className="text-xs text-pos-muted">≈ {formatLBP(usdToLbp(usdFund?.balance??0,rate))}</p></>}
          <div className="flex gap-2">
            <Button size="sm" icon={<Plus size={14}/>} onClick={()=>openTopup('fund-usd')} className="flex-1 !justify-center !bg-emerald-600 hover:!brightness-110">{t('top_up_btn')}</Button>
            <button onClick={()=>handleReset('fund-usd')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-pos-danger/30 text-pos-danger bg-pos-danger/5 hover:bg-pos-danger/15 text-xs font-medium transition-all" title={t('reset_to_zero')}><RotateCcw size={12}/> {t('reset_btn')}</button>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-pos-surface border border-pos-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-pos-border flex items-center justify-between">
          <p className="text-sm font-semibold">{t('transaction_history')}</p>
          <p className="text-xs text-pos-muted">{t('total_transactions').replace('{count}', txns.filter(t => !isInternal(t)).length.toString())}</p>
        </div>

        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-pos-border space-y-3 bg-pos-bg/30">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-pos-muted flex-shrink-0"><Filter size={12}/> {t('filter_type')}</div>
            <div className="flex rounded-lg overflow-hidden border border-pos-border text-xs">
              {(['all','topup','deduction'] as const).map(tp=>(
                <button key={tp} onClick={()=>{setFilterType(tp);resetPage();}} className={`px-2.5 py-1.5 font-medium capitalize transition-colors ${filterType===tp?'bg-pos-primary text-white':'text-pos-muted hover:bg-pos-border/40'}`}>
                  {tp==='topup'?t('type_topup'):tp==='deduction'?t('type_deduction'):t('type_all')}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-pos-muted flex-shrink-0 ml-2"><Tag size={12}/> {t('filter_fund')}</div>
            <div className="flex rounded-lg overflow-hidden border border-pos-border text-xs">
              {([['all',t('fund_all')],['fund-lbp',t('fund_lbp')],['fund-usd',t('fund_usd')]] as const).map(([val,label])=>(
                <button key={val} onClick={()=>{setFilterFund(val as typeof filterFund);resetPage();}} className={`px-2.5 py-1.5 font-medium transition-colors ${filterFund===val?'bg-pos-primary text-white':'text-pos-muted hover:bg-pos-border/40'}`}>{label}</button>
              ))}
            </div>
            {hasActiveFilter && <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-pos-danger hover:brightness-110 ml-auto"><X size={12}/> {t('clear_btn')}</button>}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-pos-muted flex-shrink-0"/>
              <input type="date" className="input py-1.5 text-xs w-36" value={filterFrom} onChange={e=>{setFilterFrom(e.target.value);resetPage();}} title={t('from_date')}/>
              <span className="text-pos-muted text-xs">–</span>
              <input type="date" className="input py-1.5 text-xs w-36" value={filterTo} onChange={e=>{setFilterTo(e.target.value);resetPage();}} title={t('to_date')}/>
            </div>
            <div className="relative flex-1 min-w-40">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-muted"/>
              <input className="input py-1.5 text-xs pl-7" placeholder={t('search_note_ph')} value={filterNote} onChange={e=>{setFilterNote(e.target.value);resetPage();}}/>
              {filterNote && <button onClick={()=>{setFilterNote('');resetPage();}} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pos-muted hover:text-pos-text"><X size={12}/></button>}
            </div>
          </div>
          {hasActiveFilter && <p className="text-xs text-pos-muted">{t('showing_transactions').replace('{count}', filtered.length.toString()).replace('{total}', txns.length.toString())}</p>}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-40 text-pos-muted text-sm">{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-pos-muted">
            <Wallet size={36} strokeWidth={1.2}/>
            <p className="text-sm">{txns.length===0?t('no_txns_yet'):t('no_txns_filter')}</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pos-border">
                  <th className="px-4 py-3 text-left text-xs text-pos-muted font-medium">{t('col_date')}</th>
                  <th className="px-4 py-3 text-left text-xs text-pos-muted font-medium">{t('col_type')}</th>
                  <th className="px-4 py-3 text-left text-xs text-pos-muted font-medium">{t('col_fund')}</th>
                  <th className="px-4 py-3 text-left text-xs text-pos-muted font-medium">{t('col_note_cat')}</th>
                  <th className="px-4 py-3 text-right text-xs text-pos-muted font-medium">{t('col_amount')}</th>
                  <th className="px-4 py-3 text-right text-xs text-pos-muted font-medium">{t('col_by')}</th>
                  <th className="px-4 py-3 text-right text-xs text-pos-muted font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((tItem,i) => {
                  const isMinus = tItem.type==='deduction'; const isUsd = tItem.fund_id==='fund-usd';
                  const exp = linkedExpense(tItem);
                  return (
                    <tr key={tItem.id} className={`border-b border-pos-border/50 last:border-0 transition-colors hover:bg-pos-border/20 ${i%2===0?'':'bg-pos-bg/30'}`}>
                      <td className="px-4 py-3 text-pos-muted whitespace-nowrap">{new Date(tItem.created_at.endsWith('Z')||tItem.created_at.includes('+')?tItem.created_at:tItem.created_at+'Z').toLocaleDateString()}<br/><span className="text-xs opacity-60">{new Date(tItem.created_at.endsWith('Z')||tItem.created_at.includes('+')?tItem.created_at:tItem.created_at+'Z').toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></td>
                      <td className="px-4 py-3">
                        {isMinus
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-pos-danger/10 text-pos-danger border-pos-danger/20"><ArrowDownCircle size={11}/> {t('type_deduction')}</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><ArrowUpCircle size={11}/> {t('type_topup')}</span>}
                      </td>
                      <td className="px-4 py-3"><span className={`text-xs font-bold ${isUsd?'text-emerald-400':'text-pos-primary'}`}>{isUsd?'USD':'LBP'}</span></td>
                      <td className="px-4 py-3 text-pos-muted max-w-xs">
                        {exp && <span className="text-pos-text font-medium">{exp.category}{tItem.note?' · ':''}</span>}
                        {tItem.note && <span className="text-xs">{tItem.note}</span>}
                        {!tItem.note && !exp && <span className="opacity-40">—</span>}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${isMinus?'text-pos-danger':'text-emerald-400'}`}>{isMinus?'−':'+'}{isUsd?formatUSD(tItem.amount):formatLBP(tItem.amount)}</td>
                      <td className="px-4 py-3 text-right text-xs text-pos-muted">{tItem.user_name??'—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditTxn(tItem)}
                            className="p-1.5 rounded-lg text-pos-muted hover:text-pos-primary hover:bg-pos-primary/10 transition-all"
                            title="Edit transaction"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteTxn(tItem)}
                            className="p-1.5 rounded-lg text-pos-muted hover:text-pos-danger hover:bg-pos-danger/10 transition-all"
                            title="Delete transaction"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-pos-border bg-pos-bg/30">
              <p className="text-xs text-pos-muted">{filtered.length} {t('result_s')}{totalPages>1&&<> · {t('page_lbl')} {safePage} {t('of')} {totalPages}</>}</p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={safePage===1} className="w-7 h-7 flex items-center justify-center rounded-lg border border-pos-border text-pos-muted hover:bg-pos-border/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"><ChevronLeft size={14}/></button>
                  {Array.from({length:totalPages},(_,i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-safePage)<=1).reduce<(number|'...')[]>((acc,p,idx,arr)=>{if(idx>0&&(p as number)-(arr[idx-1] as number)>1)acc.push('...');acc.push(p);return acc;},[]).map((p,i)=>p==='...'?<span key={`e${i}`} className="w-7 text-center text-xs text-pos-muted">…</span>:<button key={p} onClick={()=>setPage(p as number)} className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${safePage===p?'bg-pos-primary text-white':'border border-pos-border text-pos-muted hover:bg-pos-border/40'}`}>{p}</button>)}
                  <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={safePage===totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg border border-pos-border text-pos-muted hover:bg-pos-border/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"><ChevronRight size={14}/></button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Top-Up Modal */}
      <Modal open={topupOpen} onClose={()=>setTopupOpen(false)} title={topupFundId==='fund-lbp'?t('top_up_lbp_fund'):t('top_up_usd_fund')} size="sm">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-pos-bg border border-pos-border text-center">
            <p className="text-xs text-pos-muted mb-1">{t('current_balance')}</p>
            <p className="text-xl font-bold">{topupFundId==='fund-lbp'?formatLBP(lbpFund?.balance??0):formatUSD(usdFund?.balance??0)}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{topupFundId==='fund-lbp'?t('amount_ll'):t('amount_usd_lbl')}</label>
            <input className="input font-mono text-lg text-center" type="text" inputMode="decimal" placeholder="0" autoFocus value={topupDisplay}
              onChange={e=>{const raw=e.target.value.replace(/,/g,'');const clean=topupFundId==='fund-usd'?raw.replace(/[^0-9.]/g,''):raw.replace(/[^0-9]/g,'');setTopupAmount(clean);if(clean===''){setTopupDisplay('');return;}const num=parseFloat(clean);setTopupDisplay(topupFundId==='fund-usd'?clean:isNaN(num)?'':num.toLocaleString('en-US'));}}
              onKeyDown={e=>{if(e.key==='Enter')handleTopup();}}/>
          </div>
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('note_optional')}</label>
            <input className="input" placeholder="e.g. Weekly cash deposit" value={topupNote} onChange={e=>setTopupNote(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleTopup();}}/>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={()=>setTopupOpen(false)}>{t('cancel_btn')}</Button>
            <Button className={`flex-1 ${topupFundId==='fund-usd'?'!bg-emerald-600 hover:!brightness-110':''}`} loading={topupSaving} onClick={handleTopup} icon={<Plus size={15}/>}>{t('add_funds_btn')}</Button>
          </div>
        </div>
      </Modal>

      {/* Pay Expense Modal */}
      <Modal open={expOpen} onClose={()=>setExpOpen(false)} title={t('pay_expense_from_fund')} size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('pay_from')}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['LBP','USD'] as const).map(cur=>{const fund=cur==='LBP'?lbpFund:usdFund;const isSel=expForm.currency===cur;return(
                <button key={cur} onClick={()=>{setExpForm(f=>({...f,currency:cur,amount:''}));setExpDisplay('');}} className={`rounded-xl border p-3 text-left transition-all ${isSel?(cur==='USD'?'border-emerald-500 bg-emerald-500/10':'border-pos-primary bg-pos-primary/10'):'border-pos-border hover:border-pos-primary/50'}`}>
                  <p className={`text-xs font-semibold mb-0.5 ${isSel?(cur==='USD'?'text-emerald-400':'text-pos-primary'):'text-pos-muted'}`}>{cur==='LBP'?t('fund_lbp'):t('fund_usd')}</p>
                  <p className="text-sm font-bold">{cur==='LBP'?formatLBP(fund?.balance??0):formatUSD(fund?.balance??0)}</p>
                  <p className="text-xs text-pos-muted">{t('available')}</p>
                </button>
              );})}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('category_lbl')}</label>
            <select className="input appearance-none cursor-pointer" value={expForm.category} onChange={e=>setExpForm(f=>({...f,category:e.target.value}))}>
              {EXPENSE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{expForm.currency==='LBP'?t('amount_ll'):t('amount_usd_lbl')}</label>
            <input className="input font-mono text-lg text-center" type="text" inputMode="decimal" placeholder="0" autoFocus value={expDisplay}
              onChange={e=>{const raw=e.target.value.replace(/,/g,'');const clean=expForm.currency==='USD'?raw.replace(/[^0-9.]/g,''):raw.replace(/[^0-9]/g,'');setExpForm(f=>({...f,amount:clean}));if(clean===''){setExpDisplay('');return;}const num=parseFloat(clean);setExpDisplay(expForm.currency==='USD'?clean:isNaN(num)?'':num.toLocaleString('en-US'));}}
              onKeyDown={e=>{if(e.key==='Enter')handlePayExpense();}}/>
            {expForm.amount&&(()=>{const raw=parseFloat(expForm.amount);if(!raw)return null;return<p className="text-xs text-pos-muted mt-1 text-center">≈ {expForm.currency==='LBP'?formatUSD(lbpToUsd(raw,rate)):formatLBP(usdToLbp(raw,rate))}</p>;})()}
          </div>
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('note_optional')}</label>
            <input className="input" placeholder="e.g. Monthly electricity bill" value={expForm.note} onChange={e=>setExpForm(f=>({...f,note:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter')handlePayExpense();}}/>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={()=>setExpOpen(false)}>{t('cancel_btn')}</Button>
            <Button className="flex-1 !bg-pos-danger hover:!brightness-110" loading={expSaving} onClick={handlePayExpense} icon={<TrendingDown size={15}/>}>{t('pay_expense_btn')}</Button>
          </div>
        </div>
      </Modal>

      {/* Print Modal */}
      <Modal open={printOpen} onClose={()=>setPrintOpen(false)} title={t('print_statement')} size="sm">
        <div className="space-y-4">
          <p className="text-xs text-pos-muted">{t('print_desc')}</p>
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('filter_fund')}</label>
            <div className="flex rounded-lg overflow-hidden border border-pos-border text-xs">
              {([['all',t('fund_all')],['fund-lbp',t('fund_lbp')],['fund-usd',t('fund_usd')]] as const).map(([val,label])=>(
                <button key={val} onClick={()=>setPrintFund(val as typeof printFund)} className={`flex-1 py-2 font-medium transition-colors ${printFund===val?'bg-pos-primary text-white':'text-pos-muted hover:bg-pos-border/40'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1.5">{t('date_range')}</label>
            <div className="flex items-end gap-2">
              <div className="flex-1"><p className="text-xs text-pos-muted mb-1">{t('from_date')}</p><input type="date" className="input text-xs" value={printFrom} onChange={e=>setPrintFrom(e.target.value)}/></div>
              <span className="text-pos-muted text-sm mb-2.5">–</span>
              <div className="flex-1"><p className="text-xs text-pos-muted mb-1">{t('to_date')}</p><input type="date" className="input text-xs" value={printTo} onChange={e=>setPrintTo(e.target.value)}/></div>
            </div>
            {!printFrom&&!printTo&&<p className="text-xs text-pos-muted mt-1.5">{t('no_date_warning')}</p>}
          </div>
          <div className="p-3 rounded-xl bg-pos-bg border border-pos-border">
            <p className="text-xs text-pos-muted">{t('transactions_to_print')}</p>
            <p className="text-lg font-bold">{getPrintTxns().length}</p>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={()=>setPrintOpen(false)}>{t('cancel_btn')}</Button>
            <Button className="flex-1" onClick={handlePrint} icon={<Printer size={15}/>}>{t('print_btn')}</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Transaction" size="sm">
        {editTxn && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-pos-bg border border-pos-border flex items-center justify-between text-sm">
              <span className="text-pos-muted">Fund</span>
              <span className={`font-bold ${editTxn.fund_id === 'fund-usd' ? 'text-emerald-400' : 'text-pos-primary'}`}>
                {editTxn.fund_id === 'fund-usd' ? 'USD' : 'LBP'}
              </span>
            </div>
            <div>
              <label className="text-sm font-medium text-pos-muted block mb-1.5">
                Amount ({editTxn.fund_id === 'fund-usd' ? 'USD' : 'LBP'})
              </label>
              <input
                className="input font-mono text-lg text-center"
                type="text"
                inputMode="decimal"
                placeholder="0"
                autoFocus
                value={editDisplay}
                onChange={e => {
                  const raw = e.target.value.replace(/,/g, '');
                  const isUsd = editTxn.fund_id === 'fund-usd';
                  const clean = isUsd ? raw.replace(/[^0-9.]/g, '') : raw.replace(/[^0-9]/g, '');
                  setEditAmount(clean);
                  if (clean === '') { setEditDisplay(''); return; }
                  const num = parseFloat(clean);
                  setEditDisplay(isUsd ? clean : isNaN(num) ? '' : num.toLocaleString('en-US'));
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); }}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-pos-muted block mb-1.5">Note (optional)</label>
              <input
                className="input"
                placeholder="e.g. Monthly electricity bill"
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); }}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setEditOpen(false)}>{t('cancel_btn')}</Button>
              <Button className="flex-1" loading={editSaving} onClick={handleSaveEdit} icon={<Pencil size={15}/>}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Dialog */}
      <Modal open={confirmOpen} onClose={()=>setConfirmOpen(false)} title={t('confirm_title')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-pos-text">{confirmMsg}</p>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={()=>setConfirmOpen(false)}>{t('cancel_btn')}</Button>
            <Button className="flex-1 !bg-pos-danger hover:!brightness-110" onClick={()=>{setConfirmOpen(false);confirmAction.current?.();}}>{t('confirm_title')}</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
