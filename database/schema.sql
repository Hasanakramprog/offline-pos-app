-- ============================================================
-- MiniMarket POS — SQLite Database Schema
-- Cash-only payments | No stock tracking | Tax = 0%
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('admin','manager','cashier')),
  password_hash TEXT NOT NULL,
  is_active     INTEGER DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login    DATETIME
);

-- ── Categories ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Products (no stock fields) ───────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  barcode     TEXT UNIQUE,
  sku         TEXT UNIQUE,
  category_id TEXT,
  price_lbp   REAL NOT NULL DEFAULT 0,
  image_url   TEXT,
  is_active   INTEGER DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name    ON products(name);

-- ── Sales ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id                 TEXT PRIMARY KEY,
  transaction_number TEXT UNIQUE NOT NULL,
  user_id            TEXT NOT NULL,
  subtotal_lbp       REAL NOT NULL DEFAULT 0,
  discount_lbp       REAL NOT NULL DEFAULT 0,
  total_lbp          REAL NOT NULL DEFAULT 0,
  usd_to_lbp_rate    REAL NOT NULL DEFAULT 89500,
  payment_method     TEXT NOT NULL DEFAULT 'cash',
  cash_received_lbp  REAL DEFAULT 0,
  change_lbp         REAL DEFAULT 0,
  notes              TEXT,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_user       ON sales(user_id);

-- ── Sale Items ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id          TEXT PRIMARY KEY,
  sale_id     TEXT NOT NULL,
  product_id  TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price_lbp REAL NOT NULL,
  discount_lbp   REAL NOT NULL DEFAULT 0,
  line_total_lbp REAL NOT NULL,
  FOREIGN KEY (sale_id)    REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- ── Discounts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discounts (
  id             TEXT PRIMARY KEY,
  code           TEXT UNIQUE,
  description    TEXT,
  discount_type  TEXT NOT NULL CHECK(discount_type IN ('percentage','fixed')),
  discount_value REAL NOT NULL,
  is_active      INTEGER DEFAULT 1,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Activity Log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  details     TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Settings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Expenses ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id          TEXT PRIMARY KEY,
  category    TEXT NOT NULL,
  amount_lbp  REAL NOT NULL,
  note        TEXT,
  user_id     TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);

-- ── Debt Customers ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debt_customers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT,
  notes      TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Debt Entries (debts + payments) ───────────────────────────
CREATE TABLE IF NOT EXISTS debt_entries (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('debt','payment')),
  amount_lbp  REAL NOT NULL,
  note        TEXT,
  sale_id     TEXT,
  user_id     TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES debt_customers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_debt_entries_customer ON debt_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_debt_entries_created  ON debt_entries(created_at);


-- ── Seed: Admin user (password: admin123) ────────────────────
INSERT OR IGNORE INTO users (id, username, full_name, role, password_hash)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'Administrator',
  'admin',
  '$2a$10$9TBrv0fx6SLXR4yfvSoxGOQIf/MG8k/PC6DdJNZnWRTWH5dBK3.aG'
);

-- ── Seed: Default settings ───────────────────────────────────
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('store_name',      'minimarket'),
  ('currency',        'LBP'),
  ('usd_to_lbp_rate', '89500'),
  ('tax_rate',        '0'),
  ('receipt_footer',  'Thank you for shopping with us!'),
  ('theme',           'dark');

-- ── Seed: Default categories ─────────────────────────────────
INSERT OR IGNORE INTO categories (id, name) VALUES
  ('cat-001', 'Food & Beverages'),
  ('cat-002', 'Dairy'),
  ('cat-003', 'Bakery'),
  ('cat-004', 'Snacks'),
  ('cat-005', 'Cleaning'),
  ('cat-006', 'Personal Care'),
  ('cat-007', 'Other');
-- ── Seed: Sample Products ────────────────────────────────────
-- Removed to start with an empty product catalog

-- ── Seed: Sample Discounts ──────────────────────────────────
INSERT OR IGNORE INTO discounts (id, code, description, discount_type, discount_value, is_active) VALUES
  ('disc-001', 'WELCOME10', 'Welcome Discount 10%', 'percentage', 10, 1),
  ('disc-002', 'SAVE5', 'Save $5 discount', 'fixed', 5, 1),
  ('disc-003', 'BULK20', 'Bulk Purchase 20%', 'percentage', 20, 1),
  ('disc-004', 'PROMO15', 'Special Promo 15%', 'percentage', 15, 1);

-- ── Seed: Sample Sales Transactions ──────────────────────────
-- Removed

-- ── Seed: Sample Sale Items ─────────────────────────────────
-- Removed

-- ── Seed: Activity Log ───────────────────────────────────────
INSERT OR IGNORE INTO activity_log (id, user_id, action, entity_type, entity_id, details, created_at) VALUES
  ('log-001', '00000000-0000-0000-0000-000000000001', 'login', 'user', '00000000-0000-0000-0000-000000000001', 'Admin logged in', datetime('now'));
