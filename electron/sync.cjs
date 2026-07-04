'use strict';
/**
 * electron/sync.cjs
 *
 * Outbox-pattern sync engine.
 *
 * How it works:
 *  1. After every SQLite write, the caller enqueues a record via enqueueSync().
 *  2. A background interval (every 10 seconds) calls flushQueue().
 *  3. flushQueue() reads up to 50 pending rows from sync_queue, POSTs them
 *     to Supabase REST (upsert or delete), then marks them as synced.
 *  4. If Supabase is unreachable, rows stay in the queue (retry_count++).
 *     After 5 failures the row is skipped to avoid infinite loops.
 *  5. The sync engine also fires immediately when the network comes back online
 *     via Electron's net.online event.
 *
 * Offline safety: ALL data is first written to local SQLite.
 * The sync queue is also in SQLite, so it survives app crashes/restarts.
 *
 * Tables synced (upsert direction: local → cloud):
 *   users, categories, products, sales, sale_items,
 *   expenses, debt_customers, debt_entries, settings
 *
 * Tables NOT synced: activity_log, discounts (no business need)
 */

const fs   = require('fs');
const path = require('path');
const { app } = require('electron');

// ── Constants ────────────────────────────────────────────────────
const SYNC_INTERVAL_MS = 10_000;   // 10 seconds
const BATCH_SIZE       = 50;       // rows per flush
const MAX_RETRIES      = 5;

// Tables whose writes are forwarded to the cloud
const SYNCED_TABLES = new Set([
  'users', 'categories', 'products', 'sales', 'sale_items',
  'expenses', 'debt_customers', 'debt_entries', 'settings',
]);

// ── Module state ─────────────────────────────────────────────────
let _db           = null;  // sql.js Database instance (passed in by main.cjs)
let _persistDB    = null;  // persistDB() function from main.cjs
let _supabaseUrl  = '';
let _supabaseKey  = '';    // service_role key
let _configPath   = '';    // path to sync-config.json in userData
let _intervalId   = null;
let _lastSyncAt   = null;
let _lastError    = null;
 let _pendingCount = 0;
 let _syncing      = false; // guard against overlapping flush calls
 let _isOnline     = true;  // plain boolean — net.isOnline can't be cloned over IPC

// ── Initialise ───────────────────────────────────────────────────
/**
 * Call once from main.cjs after initDatabase() completes.
 * @param {object} db          sql.js Database instance
 * @param {Function} persistDB function that writes db to disk
 * @param {string} userDataPath path to Electron userData directory
 */
function initSync(db, persistDB, userDataPath) {
  _db        = db;
  _persistDB = persistDB;
  _configPath = path.join(userDataPath, 'sync-config.json');

  // Create the sync_queue table if it doesn't exist
  _db.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name  TEXT NOT NULL,
      operation   TEXT NOT NULL,
      record_id   TEXT NOT NULL,
      payload     TEXT NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced_at   DATETIME,
      retry_count INTEGER DEFAULT 0
    )
  `);
  _persistDB();

  // Load saved credentials
  _loadConfig();

  // Count pending items at startup
  _refreshPendingCount();

  // Start the 10-second background interval
  _intervalId = setInterval(() => {
    flushQueue().catch(err => console.error('[SYNC] Interval error:', err.message));
  }, SYNC_INTERVAL_MS);

  // Track online state as a plain boolean using app events
  // IMPORTANT: must convert to boolean primitive explicitly
  _isOnline = Boolean(require('electron').net.isOnline);
  app.on('online',  () => { _isOnline = true;  console.log('[SYNC] Network online — flushing queue'); flushQueue().catch(err => console.error('[SYNC] Online flush error:', err.message)); });
  app.on('offline', () => { _isOnline = false; console.log('[SYNC] Network offline'); });

  console.log('[SYNC] Sync engine initialised. Credentials loaded:', !!_supabaseUrl);
}

// ── Config (credentials) ─────────────────────────────────────────
function _loadConfig() {
  try {
    if (fs.existsSync(_configPath)) {
      const raw = JSON.parse(fs.readFileSync(_configPath, 'utf8'));
      _supabaseUrl = raw.url  || '';
      _supabaseKey = raw.key  || '';
    }
  } catch (err) {
    console.error('[SYNC] Failed to load config:', err.message);
  }
}

function configureSyncCredentials(url, key) {
  _supabaseUrl = (url || '').trim();
  _supabaseKey = (key || '').trim();
  try {
    fs.writeFileSync(_configPath, JSON.stringify({ url: _supabaseUrl, key: _supabaseKey }), 'utf8');
    console.log('[SYNC] Credentials saved.');
  } catch (err) {
    console.error('[SYNC] Failed to save config:', err.message);
  }
  // Attempt an immediate flush after configuring
  flushQueue().catch(() => {});
}

function getSyncStatus() {
  // Guard: return safe defaults if called before initSync completes
  if (!_db) {
    return {
      enabled:      false,
      connected:    true,
      lastSyncAt:   null,
      pendingCount: 0,
      lastError:    null,
    };
  }
  try {
    _refreshPendingCount();
  } catch (e) {
    console.error('[SYNC] _refreshPendingCount error:', e.message);
  }
  // Return ONLY plain JavaScript primitives - nothing from sql.js or Electron
  return {
    enabled:      Boolean(_supabaseUrl && _supabaseKey),
    connected:    Boolean(_isOnline),
    lastSyncAt:   _lastSyncAt ? String(_lastSyncAt) : null,
    pendingCount: Number(_pendingCount) || 0,
    lastError:    _lastError ? String(_lastError) : null,
  };
}

// ── Queue ────────────────────────────────────────────────────────
/**
 * Add a write operation to the outbox queue.
 * Called automatically by the intercepted dbRun() in main.cjs.
 *
 * @param {string} tableName  e.g. 'sales'
 * @param {'upsert'|'delete'} operation
 * @param {string} recordId   the primary key value of the record
 * @param {object} payload    the full record object (for upsert) or { id } (for delete)
 */
function enqueueSync(tableName, operation, recordId, payload) {
  if (!SYNCED_TABLES.has(tableName)) return;
  try {
    _db.run(
      `INSERT INTO sync_queue (table_name, operation, record_id, payload)
       VALUES (?, ?, ?, ?)`,
      [tableName, operation, recordId, JSON.stringify(payload)]
    );
    _persistDB();
    _pendingCount++;
  } catch (err) {
    console.error('[SYNC] enqueueSync error:', err.message);
  }
}

// ── Flush ────────────────────────────────────────────────────────
async function flushQueue() {
  if (_syncing)  return;  // already running
  if (!_supabaseUrl || !_supabaseKey) return;  // not configured
  if (!_isOnline) return;  // no internet

  _syncing = true;
  try {
    // Read up to BATCH_SIZE unsynced rows (retry_count < MAX_RETRIES)
    const stmt = _db.prepare(
      `SELECT * FROM sync_queue
       WHERE synced_at IS NULL AND retry_count < ?
       ORDER BY id ASC LIMIT ?`
    );
    stmt.bind([MAX_RETRIES, BATCH_SIZE]);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();

    if (rows.length === 0) {
      _syncing = false;
      return;
    }

    console.log(`[SYNC] Flushing ${rows.length} item(s)…`);

    for (const row of rows) {
      try {
        const payload = JSON.parse(row.payload);
        if (row.operation === 'upsert') {
          await _supabaseUpsert(row.table_name, payload);
        } else if (row.operation === 'delete') {
          await _supabaseDelete(row.table_name, row.record_id);
        }
        // Mark as synced
        _db.run(
          `UPDATE sync_queue SET synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [row.id]
        );
      } catch (err) {
        console.error(`[SYNC] Failed to sync row ${row.id} (${row.table_name}):`, err.message);
        _db.run(
          `UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?`,
          [row.id]
        );
        _lastError = err.message;
      }
    }

    _persistDB();
    _lastSyncAt = new Date().toISOString();
    _lastError  = null;
    _refreshPendingCount();
    console.log('[SYNC] Flush complete. Last sync:', _lastSyncAt);
  } catch (err) {
    _lastError = err.message;
    console.error('[SYNC] flushQueue error:', err.message);
  } finally {
    _syncing = false;
  }
}

// ── Supabase REST helpers ─────────────────────────────────────────
async function _supabaseUpsert(tableName, payload) {
  const url = `${_supabaseUrl}/rest/v1/${tableName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        _supabaseKey,
      'Authorization': `Bearer ${_supabaseKey}`,
      'Prefer':        'resolution=merge-duplicates',  // upsert on conflict
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase upsert ${tableName} ${res.status}: ${body}`);
  }
}

async function _supabaseDelete(tableName, recordId) {
  // For settings table, PK column is 'key'; for all others it's 'id'
  const pkCol = tableName === 'settings' ? 'key' : 'id';
  const url = `${_supabaseUrl}/rest/v1/${tableName}?${pkCol}=eq.${encodeURIComponent(recordId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey':        _supabaseKey,
      'Authorization': `Bearer ${_supabaseKey}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase delete ${tableName} ${res.status}: ${body}`);
  }
}

// ── Helpers ──────────────────────────────────────────────────────
function _refreshPendingCount() {
  try {
    const stmt = _db.prepare(
      `SELECT COUNT(*) as cnt FROM sync_queue WHERE synced_at IS NULL AND retry_count < ?`
    );
    stmt.bind([MAX_RETRIES]);
    let cnt = 0;
    if (stmt.step()) cnt = stmt.getAsObject().cnt;
    stmt.free();
    _pendingCount = cnt;
  } catch (_) {}
}

function stopSync() {
  if (_intervalId) clearInterval(_intervalId);
}

// ── Exports ──────────────────────────────────────────────────────
module.exports = {
  SYNCED_TABLES,
  initSync,
  enqueueSync,
  flushQueue,
  configureSyncCredentials,
  getSyncStatus,
  stopSync,
};
