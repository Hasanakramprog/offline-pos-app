// ── Global types exposed by Electron preload ──────────────────────────────
export interface ElectronAPI {
  database: {
    query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
    run:   (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number }>;
    exec:  (sql: string) => Promise<boolean>;
  };
  file: { backup: () => Promise<string | null> };
  system: {
    getAppVersion: () => Promise<string>;
    getUserData:   () => Promise<string>;
    minimize: () => void;
    maximize: () => void;
    close:    () => void;
  };
  hardware: {
    openDrawer: (printerName: string) => Promise<{ success: boolean; error?: string }>;
  };
}

declare global {
  interface Window { electronAPI: ElectronAPI; }
}

// ── Domain types ──────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'manager' | 'cashier';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  password_hash: string;
  is_active: number;
  created_at: string;
  last_login?: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  barcode?: string;
  sku?: string;
  category_id?: string;
  category?: Category;
  price_lbp: number;   // primary currency — Lebanese Lira
  image_url?: string;  // Base64 data URL
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  unit_price_lbp: number;   // primary: LBP
  quantity: number;
  discount_lbp: number;
  line_total_lbp: number;
  image_url?: string;       // product thumbnail (Base64 data URL)
}

export interface Sale {
  id: string;
  transaction_number: string;
  user_id: string;
  user_name?: string;
  subtotal_lbp: number;
  discount_lbp: number;
  total_lbp: number;
  usd_to_lbp_rate: number;
  payment_method: 'cash';
  cash_received_lbp: number;
  change_lbp: number;
  notes?: string;
  created_at: string;
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

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface AppSettings {
  store_name: string;
  currency: string;
  usd_to_lbp_rate: number;
  tax_rate: number;
  receipt_footer: string;
  theme: string;
  printer_share_name?: string;
}

export interface DailySummary {
  date: string;
  transaction_count: number;
  total_revenue_lbp: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  units_sold: number;
  revenue_lbp: number;
}

export type Toast = { id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string };

// ── Expenses ──────────────────────────────────────────────────────────────
export interface Expense {
  id: string;
  category: string;
  amount_lbp: number;
  note?: string;
  user_id?: string;
  user_name?: string;
  created_at: string;
}

// ── Debts ─────────────────────────────────────────────────────────────────
export interface DebtCustomer {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  created_at: string;
}

export interface DebtEntry {
  id: string;
  customer_id: string;
  type: 'debt' | 'payment';
  amount_lbp: number;
  note?: string;
  sale_id?: string;
  user_id?: string;
  user_name?: string;
  created_at: string;
}

export interface DebtCustomerWithBalance extends DebtCustomer {
  total_debt_lbp: number;
  total_paid_lbp: number;
  balance_lbp: number;
}
