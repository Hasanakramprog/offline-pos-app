# 📦 MiniMarket POS — Project Reference

> **Version:** 1.0.0 | **Platform:** Desktop (Electron + React) | **Currency:** LBP + USD

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Directory Structure](#4-directory-structure)
5. [Database Schema](#5-database-schema)
6. [Roles & Permissions](#6-roles--permissions)
7. [Pages & Features](#7-pages--features)
8. [State Management (Stores)](#8-state-management-stores)
9. [Services Layer (IPC Bridge)](#9-services-layer-ipc-bridge)
10. [Internationalisation (i18n)](#10-internationalisation-i18n)
11. [Electron IPC API](#11-electron-ipc-api)
12. [Receipt & Printing](#12-receipt--printing)
13. [Default Credentials & Seed Data](#13-default-credentials--seed-data)
14. [Build & Run](#14-build--run)
15. [Roadmap — Going Online](#15-roadmap--going-online)
16. [Flutter Integration Guide](#16-flutter-integration-guide)

---

## 1. Project Overview

**MiniMarket POS** is a fully offline, desktop Point-of-Sale system built for small Lebanese minimarkets.

| Characteristic | Value |
|---|---|
| Connectivity | 100% offline (SQLite stored locally) |
| Primary Currency | Lebanese Lira (LBP) |
| Secondary Currency | USD (display only, calculated via exchange rate) |
| Payment Methods | Cash · Debt (آجل) |
| Tax | 0% (configurable field exists) |
| Languages | English / Arabic (RTL supported) |
| Target Platform | Windows 10/11 desktop |

---

## 2. Technology Stack

### Frontend

| Package | Version | Purpose |
|---|---|---|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool / dev server |
| TailwindCSS | 3.x | Utility-first styling |
| React Router DOM | 6.x | Client-side routing |
| Zustand | 4.x | Lightweight state management |
| Recharts | 2.x | Charts & analytics |
| Lucide React | 0.344 | Icon library |
| date-fns | 3.x | Date formatting |
| uuid | 9.x | Unique ID generation |

### Backend (Electron Main Process)

| Package | Version | Purpose |
|---|---|---|
| Electron | 29.x | Desktop shell |
| sql.js | 1.14 | SQLite via WebAssembly |
| better-sqlite3 | 9.x | Dev dependency |
| bcryptjs | 2.x | Password hashing |
| electron-builder | 24.x | App packaging (NSIS / portable) |

---

## 3. Architecture

```
+---------------------------------------------------+
|               Electron Shell                      |
|  +---------------+      +--------------------+    |
|  |  main.cjs     |      |  preload.cjs       |    |
|  | (Node.js)     |<---->| (Context Bridge)   |    |
|  |               |  IPC | (Whitelist)        |    |
|  |  sql.js DB    |      +--------------------+    |
|  +---------------+              |                  |
|                                 |                  |
|  +------------------------------v--------------+   |
|  |         Renderer Process (React)            |   |
|  |                                             |   |
|  |  App.tsx --> Pages --> Components           |   |
|  |  Stores (Zustand)                           |   |
|  |  Services (wrap window.electronAPI)         |   |
|  +---------------------------------------------+   |
+---------------------------------------------------+
         |
  pos.db (SQLite) -- persisted to userData
```

### Data Flow

1. **React component** calls a **Service function** (e.g., `products.getAll()`)
2. Service calls `window.electronAPI.database.query(sql, params)`
3. **Preload** forwards the call via `ipcRenderer.invoke` to **main.cjs**
4. Main process runs the query via `sql.js` and returns the result
5. Result flows back up; React updates via Zustand or local state

---

## 4. Directory Structure

```
offline-pos-app/
├── database/
│   └── schema.sql          # Full DB schema + seed data
├── electron/
│   ├── main.cjs            # Electron main process, IPC handlers, sql.js
│   └── preload.cjs         # Context bridge (whitelist of exposed APIs)
├── scripts/
│   └── electron-dev.cjs    # Dev launcher (waits for Vite, then Electron)
├── src/
│   ├── App.tsx             # Root router, protected routes
│   ├── main.tsx            # React entry point
│   ├── index.css           # Global styles
│   ├── components/
│   │   ├── Common/         # Shared UI (Modal, Toast, etc.)
│   │   ├── Inventory/      # Product form, table
│   │   ├── Layout/         # Sidebar, top bar
│   │   ├── POS/            # Cart, product grid, payment dialog, receipt
│   │   └── Reports/        # Chart components
│   ├── i18n/
│   │   ├── LangContext.tsx  # React context for language
│   │   └── translations.ts  # EN / AR key-value dictionary
│   ├── pages/
│   │   ├── CheckoutPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── DebtsPage.tsx
│   │   ├── ExpensesPage.tsx
│   │   ├── InventoryPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── UsersPage.tsx
│   ├── services/           # Thin wrappers around electronAPI
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   ├── debts.ts
│   │   ├── expenses.ts
│   │   ├── products.ts
│   │   ├── sales.ts
│   │   └── settings.ts
│   ├── store/              # Zustand stores
│   │   ├── authStore.ts
│   │   ├── cartStore.ts
│   │   ├── settingsStore.ts
│   │   └── toastStore.ts
│   ├── types/
│   │   └── index.ts        # All TypeScript interfaces
│   └── utils/              # Helpers (formatting, etc.)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 5. Database Schema

> Engine: **SQLite** (via sql.js)
> File location: `%APPDATA%\MiniMarket POS\pos.db`

### Table: `users`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| username | TEXT UNIQUE | Login identifier |
| full_name | TEXT | Display name |
| role | TEXT | `admin` \| `manager` \| `cashier` |
| password_hash | TEXT | bcrypt hash |
| is_active | INTEGER | 1 = active, 0 = disabled |
| created_at | DATETIME | Auto |
| last_login | DATETIME | Updated on each login |

### Table: `categories`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| name | TEXT UNIQUE | e.g. "Food & Beverages" |
| created_at | DATETIME | Auto |

### Table: `products`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| name | TEXT | Product label |
| description | TEXT | Optional |
| barcode | TEXT UNIQUE | EAN/UPC for scanner |
| sku | TEXT UNIQUE | Internal stock code |
| category_id | TEXT FK | -> `categories.id` |
| price_lbp | REAL | Price in Lebanese Lira |
| image_url | TEXT | Base64 data URL |
| is_active | INTEGER | Soft delete flag |
| created_at | DATETIME | Auto |
| updated_at | DATETIME | Auto |

> Indexes: `barcode`, `name`

### Table: `sales`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| transaction_number | TEXT UNIQUE | Auto-generated TX# |
| user_id | TEXT FK | -> `users.id` |
| subtotal_lbp | REAL | Before discount |
| discount_lbp | REAL | Order-level discount |
| total_lbp | REAL | Final amount |
| usd_to_lbp_rate | REAL | Rate at time of sale |
| payment_method | TEXT | `cash` \| `debt` \| `debt_payment` |
| cash_received_lbp | REAL | Amount tendered |
| change_lbp | REAL | Change returned |
| notes | TEXT | Optional |
| created_at | DATETIME | Auto |

> Indexes: `created_at`, `user_id`

### Table: `sale_items`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| sale_id | TEXT FK | -> `sales.id` CASCADE DELETE |
| product_id | TEXT FK | -> `products.id` |
| product_name | TEXT | Snapshot at time of sale |
| quantity | INTEGER | |
| unit_price_lbp | REAL | |
| discount_lbp | REAL | Per-item discount |
| line_total_lbp | REAL | `(unit_price - discount) * qty` |

### Table: `discounts`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| code | TEXT UNIQUE | Coupon code |
| description | TEXT | |
| discount_type | TEXT | `percentage` \| `fixed` |
| discount_value | REAL | |
| is_active | INTEGER | |

### Table: `expenses`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| category | TEXT | Free-text category |
| amount_lbp | REAL | |
| note | TEXT | Optional |
| user_id | TEXT FK | -> `users.id` |
| created_at | DATETIME | Auto |

### Table: `debt_customers`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| name | TEXT | |
| phone | TEXT | Optional |
| notes | TEXT | Optional |
| created_at | DATETIME | Auto |

### Table: `debt_entries`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| customer_id | TEXT FK | -> `debt_customers.id` CASCADE DELETE |
| type | TEXT | `debt` \| `payment` |
| amount_lbp | REAL | |
| note | TEXT | Optional |
| sale_id | TEXT | Links to originating sale (if any) |
| user_id | TEXT FK | -> `users.id` |
| created_at | DATETIME | Auto |

### Table: `settings`

| Key | Default Value |
|---|---|
| store_name | minimarket |
| currency | LBP |
| usd_to_lbp_rate | 89500 |
| tax_rate | 0 |
| receipt_footer | Thank you for shopping with us! |
| theme | dark |

### Table: `activity_log`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| user_id | TEXT | Who did it |
| action | TEXT | e.g. `login`, `create_product` |
| entity_type | TEXT | e.g. `user`, `product` |
| entity_id | TEXT | ID of affected record |
| details | TEXT | JSON or plain text |
| created_at | DATETIME | Auto |

---

## 6. Roles & Permissions

| Feature | Admin | Manager | Cashier |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ |
| Checkout / POS | ✅ | ✅ | ✅ |
| Inventory (Products) | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | ✅ |
| Expenses | ✅ | ✅ | ❌ |
| Debts | ✅ | ✅ | ❌ |
| Users Management | ✅ | ❌ | ❌ |
| Settings (write) | ✅ | ❌ | ❌ |
| DB Backup / Restore | ✅ | ❌ | ❌ |

---

## 7. Pages & Features

### 7.1 Login Page (`/login`)

- Username + password form
- bcrypt password verification
- Redirects to `/dashboard` on success
- Default admin: `admin` / `admin123`

### 7.2 Dashboard (`/dashboard`)

- **KPI cards:** Today's revenue, transaction count, discounts total, exchange rate, expenses, net revenue
- **Line chart:** Revenue (LL) — last 30 days
- **Table:** Top products by units sold (last 30 days)

### 7.3 Checkout / POS (`/checkout`)

- Product search by name, SKU, or barcode
- Barcode scanner support (keyboard wedge)
- Product image thumbnails (Base64)
- Cart with per-item quantity & discount editing
- Order-level discount field
- **Predefined items** — custom items without barcode, saved in settings, added instantly to cart
- Payment dialog:
  - **Cash** — enter amount received (LL or USD), calculates change
  - **Debt (آجل)** — link to existing or new debt customer
- Receipt generation (HTML template, silent thermal print)
- Cash drawer kick (ESC/POS over Windows shared printer)

### 7.4 Inventory / Products (`/inventory`)

- Product list with search, category filter, status filter, price filter
- Pagination with rows-per-page selector
- Add / Edit product modal (image upload Base64 max 2 MB, inline new category, barcode/SKU)
- Soft-delete (marks `is_active = 0`)

### 7.5 Reports (`/reports`)

- Date range picker
- Summary: Revenue LL, Revenue USD, Transaction count, Average order
- Paginated sales list with item drill-down
- CSV export

### 7.6 Users (`/users`) — Admin only

- List all users with role badges
- Add / Edit user (full name, username, role, password)
- Activate / Deactivate users

### 7.7 Settings (`/settings`) — Write access: Admin only

- Store name, receipt footer message
- USD to LBP exchange rate
- System info (read-only)
- Data backup: export `.db` / import & restore `.db`
- Language toggle: English / العربية
- Printer share name configuration

### 7.8 Expenses (`/expenses`) — Manager + Admin

- Add expense (category, amount LL, optional note)
- Filters: today / this month / date range + category + note search
- Delete expense
- Running total display

### 7.9 Debts (`/debts`) — Manager + Admin

- Customer list with outstanding balances
- Add customer (name, phone, notes)
- Per-customer panel: total debt, total paid, balance, full transaction history
- Add debt entry / Add payment entry
- Delete customer (cascades) or individual entry

---

## 8. State Management (Stores)

### `authStore`

```typescript
state: { user: User | null, isAuthenticated: boolean }
actions: login(user: User), logout()
```

### `cartStore`

```typescript
state: { items: CartItem[], discount_lbp: number }
actions: addItem, removeItem, updateQuantity, updateItemDiscount,
         setOrderDiscount, clearCart, getSubtotal, getTotal
```

### `settingsStore`

```typescript
state: { settings: AppSettings | null }
actions: load(), update(key: string, value: string)
// Reads/writes via services/settings.ts -> SQLite
```

### `toastStore`

```typescript
state: { toasts: Toast[] }
actions: addToast({ type, message }), removeToast(id)
// Toast types: 'success' | 'error' | 'warning' | 'info'
```

---

## 9. Services Layer (IPC Bridge)

All files in `src/services/` are thin wrappers around `window.electronAPI.database.*`.

| File | Key Functions |
|---|---|
| `auth.ts` | `loginUser(username, password)`, `updateLastLogin(userId)` |
| `products.ts` | `getAll()`, `search(query)`, `create(data)`, `update(id, data)`, `deactivate(id)` |
| `sales.ts` | `createSale(sale, items)`, `getSales(from, to)`, `getSaleWithItems(id)`, `getDailySummaries()`, `getTopProducts()` |
| `expenses.ts` | `getAll(from, to)`, `create(data)`, `delete(id)` |
| `debts.ts` | `getCustomers()`, `createCustomer(data)`, `deleteCustomer(id)`, `getEntries(customerId)`, `addEntry(data)`, `deleteEntry(id)` |
| `settings.ts` | `getSettings()`, `updateSetting(key, value)` |

---

## 10. Internationalisation (i18n)

- **Languages:** English (`en`) and Arabic (`ar`)
- **RTL support:** `dir="rtl"` applied to root HTML when Arabic is active
- **Dictionary:** `src/i18n/translations.ts` — `Record<key, { en: string, ar: string }>`
- **Context:** `LangContext.tsx` wraps the app, exposes `t(key: TranslationKey)` hook
- **Persistence:** Language preference stored in `localStorage`

---

## 11. Electron IPC API

The `preload.cjs` exposes `window.electronAPI` with the following namespaces:

### `database`

```typescript
query(sql: string, params?: unknown[]) => Promise<unknown[]>
run(sql: string, params?: unknown[])   => Promise<{ changes: number; lastInsertRowid: number }>
exec(sql: string)                      => Promise<boolean>
```

### `file`

```typescript
backup()  => Promise<string | null>
// Opens OS save dialog, copies pos.db to chosen location

restore() => Promise<{ success: boolean; cancelled?: boolean; error?: string }>
// Opens OS open dialog, replaces pos.db, re-initialises sql.js in memory
```

### `system`

```typescript
getAppVersion() => Promise<string>
getUserData()   => Promise<string>   // Path to userData directory
minimize()      => void
maximize()      => void
close()         => void
```

### `hardware`

```typescript
openDrawer(printerName: string) => Promise<{ success: boolean; error?: string }>
// Sends ESC/POS kick code [0x1B, 0x70, 0x00, 0x19, 0xFA] via Windows shared printer
```

### `print`

```typescript
printReceipt(html: string, printerName: string) => Promise<{ success: boolean; error?: string }>
// Renders HTML in a hidden BrowserWindow, prints silently to 80mm thermal
getPrinters() => Promise<{ name: string; isDefault: boolean }[]>
```

---

## 12. Receipt & Printing

- Receipt is an **HTML string** generated in React and passed to `print:receipt` IPC channel
- A hidden Electron `BrowserWindow` (302 px wide) renders the HTML
- `webContents.print()` is called silently with page size `{ width: 80000, height: 5000000 }` µm (80 mm thermal roll)
- Device emulation: 302 px width (80 mm @ 96 DPI), `deviceScaleFactor: 1`
- Cash drawer: separate `hardware:open-drawer` call with ESC/POS bytes via Windows `copy /B`

---

## 13. Default Credentials & Seed Data

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |
| Role | `admin` |

**Seed Categories:** Food & Beverages · Dairy · Bakery · Snacks · Cleaning · Personal Care · Other

**Seed Discounts:** WELCOME10 (10%) · SAVE5 (fixed 5) · BULK20 (20%) · PROMO15 (15%)

---

## 14. Build & Run

### Development

```bash
npm install
npm run dev        # Starts Vite dev server + Electron concurrently
```

### Production Build

```bash
npm run build      # vite build + electron-builder -> release/
```

Output: `release/` folder containing NSIS installer `.exe` and portable `.exe`

### Manual DB Reset

```bash
npm run db:init    # Runs scripts/init-db.cjs
```

### Environment Detection

| `NODE_ENV` | Behaviour |
|---|---|
| `development` | Electron loads `http://localhost:5173` |
| `production` | Electron loads `app://localhost/dist/index.html` via custom protocol |

---

## 15. Roadmap — Going Online

> The app is currently **100% offline**. Below are three recommended paths for bringing it online.

---

### Option A — Cloud Sync (Lowest Risk, Keep Electron App)

Keep the Electron app as-is and add a background sync engine.

```
Electron App (SQLite)  <-->  Sync Service  <-->  Cloud DB
```

**Steps:**

1. **Choose a backend-as-a-service:**
   - [Supabase](https://supabase.com) (PostgreSQL + REST + Realtime) — recommended
   - Firebase Firestore
   - Custom Node.js / Express API

2. **Add a sync queue table** to local SQLite:
   ```sql
   CREATE TABLE sync_queue (
     id TEXT PRIMARY KEY,
     table_name TEXT NOT NULL,
     operation TEXT NOT NULL,   -- INSERT | UPDATE | DELETE
     payload TEXT NOT NULL,     -- JSON blob
     synced_at DATETIME,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. **Add `updated_at` + `deleted_at`** columns for conflict resolution

4. **Background sync worker** in `main.cjs`:
   - On network available: push `sync_queue` rows to remote API
   - Pull remote changes since `last_sync_at`
   - Last-write-wins conflict strategy (or timestamp-based)

5. **Multi-branch:** add `branch_id` column to sales, expenses, and products

**Pros:** Works offline-first · minimal code changes · low risk  
**Cons:** Complex conflict resolution for concurrent writes

---

### Option B — Full Web Application (Rebuild)

Port the app to a browser-based stack.

```
Browser  <-->  Next.js / Vite SPA  <-->  REST API  <-->  PostgreSQL
```

**Steps:**

1. **Build REST API** (Node.js + Express or Next.js API routes):
   ```
   POST   /api/auth/login
   GET    /api/products
   POST   /api/products
   PUT    /api/products/:id
   GET    /api/sales?from=&to=
   POST   /api/sales
   GET    /api/expenses
   POST   /api/expenses
   GET    /api/debts/customers
   POST   /api/debts/customers
   GET    /api/settings
   PUT    /api/settings
   ```

2. **Replace `window.electronAPI`** in services with `fetch()`:
   ```typescript
   // Before (Electron)
   const rows = await window.electronAPI.database.query(sql, params);

   // After (Web)
   const rows = await fetch('/api/products').then(r => r.json());
   ```

3. **Database:** PostgreSQL on [Railway](https://railway.app), [Render](https://render.com), [Supabase](https://supabase.com), or [Neon](https://neon.tech)

4. **Hosting options:**

   | Platform | Cost | Notes |
   |---|---|---|
   | Render | Free tier | Full-stack hosting |
   | Railway | ~$5/mo | Simple deployment |
   | Vercel + Supabase | Free tier | Serverless |
   | VPS (Hetzner / DigitalOcean) | ~$6/mo | Full control |

5. **PWA:** Add `manifest.json` + service worker for offline-capable caching

**Pros:** Access from any device, no install required  
**Cons:** Requires internet · more complex auth flow

---

### Option C — Hybrid (Electron + Read-Only Web Portal)

Keep the cashier on the desktop app. Add a web **admin dashboard** for viewing reports remotely.

```
Electron (cashier) --> Sync --> Cloud API --> Web Portal (owner/reports)
```

**Recommended Migration Path:**

```
Phase 1: Add Supabase cloud sync to Electron app    (2-3 weeks)
Phase 2: Build read-only web dashboard              (1-2 weeks)
Phase 3: Migrate to full web app (optional)         (4-6 weeks)
```

---

## 16. Flutter Integration Guide

The local SQLite database can power a Flutter mobile companion app. Here are two integration approaches.

---

### 16.1 Option A — Direct SQLite (Same Device / LAN)

```yaml
# pubspec.yaml
dependencies:
  sqflite: ^2.3.0
  path: ^1.9.0
```

```dart
// Open the same database file
final dbPath = '${Platform.environment['APPDATA']}\\MiniMarket POS\\pos.db';
final db = await openDatabase(dbPath);
```

> **Note:** Only practical if the Flutter app runs on the same Windows machine.
> For Android/iOS, use the REST API approach below.

---

### 16.2 Option B — REST API (Recommended)

Build a lightweight Express server on top of the existing SQLite file, then connect Flutter via HTTP.

#### Minimal Express API Server

```javascript
// api-server.js (runs alongside or inside Electron)
const express = require('express');
const Database = require('better-sqlite3');
const app = express();

const db = new Database(dbPath); // same pos.db
app.use(express.json());

// Products
app.get('/api/products', (req, res) => {
  const rows = db.prepare("SELECT * FROM products WHERE is_active=1").all();
  res.json(rows);
});

// Create sale
app.post('/api/sales', (req, res) => {
  const { sale, items } = req.body;
  const insert = db.transaction(() => {
    db.prepare('INSERT INTO sales (...) VALUES (...)').run(sale);
    items.forEach(item => db.prepare('INSERT INTO sale_items (...) VALUES (...)').run(item));
  });
  insert();
  res.json({ success: true });
});

app.listen(3001, '0.0.0.0'); // Accessible on LAN
```

#### Flutter HTTP Client

```dart
// lib/services/api_service.dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class ApiService {
  final String baseUrl;

  ApiService({this.baseUrl = 'http://192.168.1.100:3001/api'});

  Future<List<dynamic>> getProducts() async {
    final res = await http.get(Uri.parse('$baseUrl/products'));
    return jsonDecode(res.body) as List<dynamic>;
  }

  Future<void> createSale(Map sale, List items) async {
    await http.post(
      Uri.parse('$baseUrl/sales'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'sale': sale, 'items': items}),
    );
  }
}
```

---

### 16.3 Flutter Data Models

```dart
// lib/models/product.dart
class Product {
  final String id;
  final String name;
  final double priceLbp;
  final String? barcode;
  final String? imageUrl; // Base64 data URL

  Product.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        name = j['name'],
        priceLbp = (j['price_lbp'] as num).toDouble(),
        barcode = j['barcode'],
        imageUrl = j['image_url'];

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'price_lbp': priceLbp,
    'barcode': barcode,
  };
}

// lib/models/sale.dart
class Sale {
  final String id;
  final String transactionNumber;
  final double totalLbp;
  final double usdToLbpRate;
  final String paymentMethod; // 'cash' | 'debt'
  final DateTime createdAt;

  Sale.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        transactionNumber = j['transaction_number'],
        totalLbp = (j['total_lbp'] as num).toDouble(),
        usdToLbpRate = (j['usd_to_lbp_rate'] as num).toDouble(),
        paymentMethod = j['payment_method'],
        createdAt = DateTime.parse(j['created_at']);
}

// lib/models/debt_customer.dart
class DebtCustomer {
  final String id;
  final String name;
  final String? phone;
  final double balanceLbp; // computed field from API

  DebtCustomer.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        name = j['name'],
        phone = j['phone'],
        balanceLbp = (j['balance_lbp'] as num?)?.toDouble() ?? 0.0;
}
```

---

### 16.4 Recommended Flutter Packages

```yaml
dependencies:
  http: ^1.2.0
  sqflite: ^2.3.0            # Local cache for offline support
  mobile_scanner: ^5.0.0     # Barcode/QR camera scanner
  fl_chart: ^0.67.0          # Dashboard charts
  riverpod: ^2.4.0           # State management
  intl: ^0.19.0              # Number/date formatting
  flutter_secure_storage: ^9.0.0  # JWT token storage
  cached_network_image: ^3.3.0    # Product image caching (if served as URLs)
  connectivity_plus: ^5.0.0  # Detect online/offline state
```

---

### 16.5 JWT Authentication Flow

```dart
// POST /api/auth/login -> returns { token, user }
Future<void> login(String username, String password) async {
  final res = await http.post(
    Uri.parse('$baseUrl/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'username': username, 'password': password}),
  );
  final data = jsonDecode(res.body);
  // Store token securely
  await secureStorage.write(key: 'jwt_token', value: data['token']);
}

// Add to every request
Future<Map<String, String>> get authHeaders async {
  final token = await secureStorage.read(key: 'jwt_token');
  return {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};
}
```

---

### 16.6 Currency Display Helper

```dart
// lib/utils/currency.dart
import 'package:intl/intl.dart';

class CurrencyHelper {
  static final _llFormat = NumberFormat('#,###', 'en_US');

  /// Format as Lebanese Lira: "1,500,000 ل.ل"
  static String formatLbp(double amount) {
    return '${_llFormat.format(amount.round())} ل.ل';
  }

  /// Format as USD: "$16.76"
  static String formatUsd(double amountLbp, double rate) {
    if (rate <= 0) return '\$0.00';
    return '\$${(amountLbp / rate).toStringAsFixed(2)}';
  }
}
```

---

### 16.7 Suggested Flutter App Features

| Feature | Notes |
|---|---|
| POS Cart | Local state (Riverpod) -> POST /api/sales |
| Barcode Scanner | `mobile_scanner` -> lookup product by barcode |
| Product Browser | Grid/list with search and category filter |
| Dashboard | Charts via `fl_chart` (revenue, top products) |
| Debt Customers | List, add debt, add payment |
| Expenses | Add expense form |
| Offline Support | `sqflite` local cache -> sync when connected |
| Receipt View | Flutter widget -> system share or Bluetooth printer |

---

*Generated: 2026-07-04 · MiniMarket POS v1.0.0*
