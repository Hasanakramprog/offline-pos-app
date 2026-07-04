-- ================================================================
-- MiniMarket POS — Supabase (PostgreSQL) Mirror Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ================================================================

-- Enable UUID extension (already enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
  password_hash TEXT NOT NULL,
  is_active     INTEGER DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- ── Categories ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id         TEXT PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Products ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  barcode     TEXT UNIQUE,
  sku         TEXT UNIQUE,
  category_id TEXT REFERENCES public.categories(id),
  price_lbp   NUMERIC NOT NULL DEFAULT 0,
  image_url   TEXT,
  is_active   INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name    ON public.products(name);

-- ── Sales ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales (
  id                 TEXT PRIMARY KEY,
  transaction_number TEXT UNIQUE NOT NULL,
  user_id            TEXT REFERENCES public.users(id),
  subtotal_lbp       NUMERIC NOT NULL DEFAULT 0,
  discount_lbp       NUMERIC NOT NULL DEFAULT 0,
  total_lbp          NUMERIC NOT NULL DEFAULT 0,
  usd_to_lbp_rate    NUMERIC NOT NULL DEFAULT 89500,
  payment_method     TEXT NOT NULL DEFAULT 'cash',
  cash_received_lbp  NUMERIC DEFAULT 0,
  change_lbp         NUMERIC DEFAULT 0,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_user       ON public.sales(user_id);

-- ── Sale Items ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sale_items (
  id             TEXT PRIMARY KEY,
  sale_id        TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id     TEXT NOT NULL REFERENCES public.products(id),
  product_name   TEXT NOT NULL,
  quantity       INTEGER NOT NULL DEFAULT 1,
  unit_price_lbp NUMERIC NOT NULL,
  discount_lbp   NUMERIC NOT NULL DEFAULT 0,
  line_total_lbp NUMERIC NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);

-- ── Discounts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discounts (
  id             TEXT PRIMARY KEY,
  code           TEXT UNIQUE,
  description    TEXT,
  discount_type  TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  is_active      INTEGER DEFAULT 1,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Expenses ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expenses (
  id         TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  amount_lbp NUMERIC NOT NULL,
  note       TEXT,
  user_id    TEXT REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON public.expenses(created_at);

-- ── Debt Customers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debt_customers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Debt Entries ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debt_entries (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES public.debt_customers(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('debt', 'payment')),
  amount_lbp  NUMERIC NOT NULL,
  note        TEXT,
  sale_id     TEXT,
  user_id     TEXT REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debt_entries_customer ON public.debt_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_debt_entries_created  ON public.debt_entries(created_at);

-- ── Settings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- Enable Supabase Realtime on key tables
-- (go to Supabase Dashboard → Database → Replication and enable
--  these tables, OR run the statements below)
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
