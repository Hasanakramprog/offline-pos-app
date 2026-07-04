'use server';
/**
 * lib/queries.ts
 * All data-fetching functions for the web admin portal.
 * Uses Server Actions and the Admin client to securely bypass RLS
 * while keeping the service_role key hidden from the browser.
 */
import { supabaseAdmin as supabase } from './supabase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────────
export interface Sale {
  id: string;
  transaction_number: string;
  user_id: string;
  subtotal_lbp: number;
  discount_lbp: number;
  total_lbp: number;
  usd_to_lbp_rate: number;
  payment_method: string;
  cash_received_lbp: number;
  change_lbp: number;
  notes: string | null;
  created_at: string;
  user_name?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_lbp: number;
  discount_lbp: number;
  line_total_lbp: number;
}

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  category_id: string | null;
  price_lbp: number;
  is_active: number;
  created_at: string;
  category_name?: string;
}

export interface Expense {
  id: string;
  category: string;
  amount_lbp: number;
  note: string | null;
  user_id: string | null;
  created_at: string;
  user_name?: string;
}

export interface DebtCustomer {
  id: string;
  name: string;
  phone: string | null;
  balance_lbp: number;
}

export interface DailySummary {
  date: string;
  revenue: number;
  count: number;
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export async function getTodaySummary() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: sales } = await supabase
    .from('sales')
    .select('total_lbp, discount_lbp, payment_method')
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`);

  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount_lbp')
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`);

  const revenue = (sales ?? [])
    .filter(s => s.payment_method !== 'debt')
    .reduce((a, s) => a + Number(s.total_lbp), 0);

  const discounts = (sales ?? []).reduce((a, s) => a + Number(s.discount_lbp), 0);
  const expenseTotal = (expenses ?? []).reduce((a, e) => a + Number(e.amount_lbp), 0);
  const settings = await getSettings();
  const rate = Number(settings.usd_to_lbp_rate ?? 89500);

  return {
    revenue_lbp:    revenue,
    revenue_usd:    revenue / rate,
    transactions:   (sales ?? []).length,
    discounts_lbp:  discounts,
    expenses_lbp:   expenseTotal,
    net_revenue_lbp: revenue - expenseTotal,
    usd_rate:       rate,
  };
}

export async function getDailySummaries(days = 30): Promise<DailySummary[]> {
  const from = format(subDays(new Date(), days), 'yyyy-MM-dd');
  const { data } = await supabase
    .from('sales')
    .select('total_lbp, payment_method, created_at')
    .gte('created_at', from)
    .order('created_at', { ascending: true });

  // Group by date
  const map = new Map<string, { revenue: number; count: number }>();
  for (const s of data ?? []) {
    const d = format(new Date(s.created_at), 'yyyy-MM-dd');
    const cur = map.get(d) ?? { revenue: 0, count: 0 };
    if (s.payment_method !== 'debt') cur.revenue += Number(s.total_lbp);
    cur.count++;
    map.set(d, cur);
  }

  return Array.from(map.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTopProducts(days = 30) {
  const from = format(subDays(new Date(), days), 'yyyy-MM-dd');
  const { data: sales } = await supabase
    .from('sales')
    .select('id')
    .gte('created_at', from);

  if (!sales?.length) return [];

  const saleIds = sales.map(s => s.id);
  const { data: items } = await supabase
    .from('sale_items')
    .select('product_id, product_name, quantity, line_total_lbp')
    .in('sale_id', saleIds);

  const map = new Map<string, { product_name: string; units: number; revenue: number }>();
  for (const item of items ?? []) {
    const cur = map.get(item.product_id) ?? { product_name: item.product_name, units: 0, revenue: 0 };
    cur.units   += Number(item.quantity);
    cur.revenue += Number(item.line_total_lbp);
    map.set(item.product_id, cur);
  }

  return Array.from(map.values())
    .sort((a, b) => b.units - a.units)
    .slice(0, 10);
}

// ── Sales / Reports ────────────────────────────────────────────────────────
export async function getSalesByRange(from: string, to: string): Promise<Sale[]> {
  const { data } = await supabase
    .from('sales')
    .select(`*, users(full_name)`)
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`)
    .order('created_at', { ascending: false });

  return (data ?? []).map(s => ({
    ...s,
    user_name: (s.users as any)?.full_name ?? '—',
  }));
}

export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
  const { data } = await supabase
    .from('sale_items')
    .select('*')
    .eq('sale_id', saleId);
  return data ?? [];
}

// ── Products ───────────────────────────────────────────────────────────────
export async function getProducts(): Promise<Product[]> {
  const { data } = await supabase
    .from('products')
    .select(`*, categories(name)`)
    .order('name');
  return (data ?? []).map(p => ({ ...p, category_name: (p.categories as any)?.name }));
}

// ── Expenses ───────────────────────────────────────────────────────────────
export async function getExpenses(from: string, to: string): Promise<Expense[]> {
  const { data } = await supabase
    .from('expenses')
    .select(`*, users(full_name)`)
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`)
    .order('created_at', { ascending: false });

  return (data ?? []).map(e => ({ ...e, user_name: (e.users as any)?.full_name }));
}

// ── Debts ──────────────────────────────────────────────────────────────────
export async function getDebtCustomers(): Promise<DebtCustomer[]> {
  const { data: customers } = await supabase.from('debt_customers').select('*');
  const { data: entries }   = await supabase.from('debt_entries').select('customer_id, type, amount_lbp');

  return (customers ?? []).map(c => {
    const ces = (entries ?? []).filter(e => e.customer_id === c.id);
    const debt = ces.filter(e => e.type === 'debt').reduce((a, e) => a + Number(e.amount_lbp), 0);
    const paid = ces.filter(e => e.type === 'payment').reduce((a, e) => a + Number(e.amount_lbp), 0);
    return { ...c, balance_lbp: debt - paid };
  }).sort((a, b) => b.balance_lbp - a.balance_lbp);
}

// ── Settings ───────────────────────────────────────────────────────────────
export async function getSettings(): Promise<Record<string, string>> {
  const { data } = await supabase.from('settings').select('key, value');
  return Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
}
