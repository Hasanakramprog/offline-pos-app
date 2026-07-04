-- ================================================================
-- MiniMarket POS — Row Level Security Policies
-- Run AFTER 001_initial_schema.sql
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings       ENABLE ROW LEVEL SECURITY;

-- ── service_role bypass ──────────────────────────────────────────
-- The sync worker uses service_role key → bypasses RLS automatically.
-- No policy needed for service_role.

-- ── Authenticated users (web portal) — SELECT only ───────────────
-- Web portal users can read all data but cannot write.

CREATE POLICY "authenticated_select_users"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_select_categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_select_products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_select_sales"
  ON public.sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_select_sale_items"
  ON public.sale_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_select_discounts"
  ON public.discounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_select_expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_select_debt_customers"
  ON public.debt_customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_select_debt_entries"
  ON public.debt_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_select_settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (true);

-- ================================================================
-- Custom Auth Function
-- The web portal authenticates by verifying bcrypt password_hash
-- from the synced users table. After verification, a Supabase JWT
-- is issued via a custom RPC function (see 003_auth_function.sql).
-- ================================================================
