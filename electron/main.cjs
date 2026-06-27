'use strict';
const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

// Register app:// as a privileged scheme BEFORE app is ready
// This lets ES module scripts load correctly (file:// blocks them via CORS)
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false }
}]);

// Check if running in dev mode: prefer NODE_ENV, fall back to dist folder absence
// isDev: only true when launched via `npm run dev` with NODE_ENV=development
const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;
let db = null;
let dbPath = '';

console.log('[CONFIG] NODE_ENV:', process.env.NODE_ENV);
console.log('[CONFIG] isDev:', isDev);
console.log('[CONFIG] __dirname:', __dirname);

// ─── sql.js bootstrap ──────────────────────────────────────────────────────
async function initDatabase() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
  dbPath = path.join(userDataPath, 'pos.db');

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Run schema
  let schemaPath = isDev
    ? path.join(__dirname, '../database/schema.sql')
    : path.join(process.resourcesPath, 'database/schema.sql');
  
  // Fallback for dev: if resourcesPath doesn't exist, check relative to __dirname
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.join(__dirname, '../database/schema.sql');
  }
  
  console.log('Schema path:', schemaPath, 'exists:', fs.existsSync(schemaPath));
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('Schema length:', schema.length, 'bytes');
    try {
      db.exec(schema);
      persistDB();
      console.log('✓ Schema initialized with seed data');
      // Verify tables exist
      const tables = dbQuery("SELECT name FROM sqlite_master WHERE type='table'");
      console.log('Tables created:', tables.map(t => t.name));
    } catch (err) {
      console.error('✗ Schema execution error:', err.message);
    }

    // ── Migrations (safe to re-run — errors are swallowed) ────────────────
    const migrations = [
      "ALTER TABLE products ADD COLUMN image_url TEXT",
      // ── New tables for Expenses & Debts features ──────────────────────
      `CREATE TABLE IF NOT EXISTS expenses (
         id TEXT PRIMARY KEY, category TEXT NOT NULL, amount_lbp REAL NOT NULL,
         note TEXT, user_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at)`,
      `CREATE TABLE IF NOT EXISTS debt_customers (
         id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, notes TEXT,
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS debt_entries (
         id TEXT PRIMARY KEY, customer_id TEXT NOT NULL,
         type TEXT NOT NULL CHECK(type IN ('debt','payment')),
         amount_lbp REAL NOT NULL, note TEXT, sale_id TEXT, user_id TEXT,
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
         FOREIGN KEY (customer_id) REFERENCES debt_customers(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_debt_entries_customer ON debt_entries(customer_id)`,
    ];
    for (const sql of migrations) {
      try { db.run(sql); persistDB(); } catch (_) { /* column already exists */ }
    }
  } else {
    console.warn('⚠ Schema file not found');
  }
  console.log('DB ready at:', dbPath);
}

function persistDB() {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) { console.error('persist error', err); }
}

// ─── Query helpers ─────────────────────────────────────────────────────────
function dbQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  persistDB();
  return { changes: db.getRowsModified(), lastInsertRowid: 0 };
}

function dbExec(sql) {
  db.run(sql);
  persistDB();
  return true;
}

// ─── Window ────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 600,
    backgroundColor: '#0f172a', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  });

  if (isDev) {
    console.log('[WINDOW] Loading dev server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Use custom app://localhost/ protocol — file:// blocks type=module scripts via CORS
    console.log('[WINDOW] Loading via app:// protocol');
    mainWindow.loadURL('app://localhost/dist/index.html');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[WINDOW] Finished loading content');
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[WINDOW] Failed to load:', errorCode, errorDescription);
  });
  
  mainWindow.on('closed', () => { persistDB(); mainWindow = null; });
}

// ─── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Register custom app:// protocol handler (must be after app is ready)
  if (!isDev) {
    const appRoot = path.join(__dirname, '..');
    const mime = {
      '.html': 'text/html',           '.js': 'application/javascript',
      '.css':  'text/css',            '.json': 'application/json',
      '.png':  'image/png',           '.jpg':  'image/jpeg',
      '.svg':  'image/svg+xml',       '.wasm': 'application/wasm',
      '.ttf':  'font/ttf',            '.woff2':'font/woff2',
    };
    protocol.handle('app', (request) => {
      // Strip scheme+host: app://localhost/dist/foo.js → dist/foo.js
      let relPath = request.url.replace(/^app:\/\/[^/]+\//, '');
      relPath = relPath.split('?')[0].split('#')[0];
      const fullPath = path.join(appRoot, relPath);
      try {
        const data = fs.readFileSync(fullPath);
        const contentType = mime[path.extname(fullPath).toLowerCase()] || 'application/octet-stream';
        return new Response(data, { headers: { 'Content-Type': contentType } });
      } catch (_) {
        // SPA fallback: non-asset routes serve index.html for React Router
        const data = fs.readFileSync(path.join(appRoot, 'dist', 'index.html'));
        return new Response(data, { headers: { 'Content-Type': 'text/html' } });
      }
    });
    console.log('[PROTOCOL] app:// registered, root:', appRoot);
  }

  try { await initDatabase(); } catch (err) { console.error('DB init error:', err); }
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { persistDB(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => persistDB());

// ─── IPC handlers ──────────────────────────────────────────────────────────
ipcMain.handle('db:query', (_e, sql, params = []) => {
  try { return dbQuery(sql, params); }
  catch (err) { console.error('db:query', err.message, '\nSQL:', sql); throw err; }
});

ipcMain.handle('db:run', (_e, sql, params = []) => {
  try { return dbRun(sql, params); }
  catch (err) { console.error('db:run', err.message, '\nSQL:', sql); throw err; }
});

ipcMain.handle('db:exec', (_e, sql) => {
  try { return dbExec(sql); }
  catch (err) { console.error('db:exec', err.message); throw err; }
});

ipcMain.handle('file:backup', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `minimarket-backup-${new Date().toISOString().split('T')[0]}.db`,
    filters: [{ name: 'Database', extensions: ['db'] }],
  });
  if (!result.canceled && result.filePath) {
    persistDB();
    fs.copyFileSync(dbPath, result.filePath);
    return result.filePath;
  }
  return null;
});

ipcMain.handle('system:version', () => app.getVersion());
ipcMain.handle('system:userData', () => app.getPath('userData'));
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('window:close', () => mainWindow?.close());

ipcMain.handle('hardware:open-drawer', async (_e, printerName) => {
  if (!printerName) return { success: false, error: 'No printer specified' };
  try {
    const { exec } = require('child_process');
    const os = require('os');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    // ESC p 0 25 250
    const kickCode = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);
    const tmpFilePath = path.join(os.tmpdir(), 'drawer_kick.bin');
    fs.writeFileSync(tmpFilePath, kickCode);
    
    // Command depends on OS. Since it's Windows:
    if (process.platform === 'win32') {
      const sharePath = `\\\\localhost\\${printerName}`;
      await execAsync(`copy /B "${tmpFilePath}" "${sharePath}"`);
      return { success: true };
    } else {
      // Basic linux fallback using lp
      await execAsync(`lp -d "${printerName}" -o raw "${tmpFilePath}"`);
      return { success: true };
    }
  } catch (err) {
    console.error('Drawer error:', err);
    return { success: false, error: err.message };
  }
});

// ── Silent receipt print ───────────────────────────────────────────
// Writes receipt HTML to a temp file, loads it in a hidden window, prints silently
ipcMain.handle('print:receipt', (_e, html, printerName) => {
  return new Promise((resolve) => {
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), `pos-receipt-${Date.now()}.html`);

    try {
      fs.writeFileSync(tmpFile, html, 'utf8');
    } catch (err) {
      console.error('[PRINT] Failed to write temp file:', err);
      return resolve({ success: false, error: err.message });
    }

    const printWin = new BrowserWindow({
      show: false,
      frame: false,
      // useContentSize: width/height = content viewport, not outer window frame
      useContentSize: true,
      width: 302,   // 80mm at 96 DPI
      height: 5000,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    console.log('[PRINT] Loading temp file:', tmpFile);
    printWin.loadFile(tmpFile);

    printWin.webContents.once('did-finish-load', () => {
      console.log('[PRINT] Page loaded, sending to printer...');

      // Force the Chromium viewport to exactly 302px (80mm at 96 DPI)
      // This overrides any OS scaling or window chrome that could skew the width
      printWin.webContents.enableDeviceEmulation({
        screenPosition: 'desktop',
        screenSize: { width: 302, height: 5000 },
        viewSize:   { width: 302, height: 5000 },
        viewPosition: { x: 0, y: 0 },
        deviceScaleFactor: 1,
        scale: 1,
      });


      // List all available printers for diagnostics
      printWin.webContents.getPrintersAsync().then((printers) => {
        console.log('[PRINT] Available printers:', printers.map(p => `"${p.name}"${p.isDefault ? ' (DEFAULT)' : ''}`).join(', '));

        const printOptions = {
          silent: true,
          printBackground: false,
          // 80mm wide × 500mm tall (in microns) — matches thermal roll paper
          pageSize: { width: 80000, height: 5000000 },
          // 'printableArea' = Chromium asks the XP-80C driver for its actual
          // printable bounds and keeps content within them.
          // 'none' sends content to the physical edge and hits hardware margins.
          margins: { marginType: 'printableArea' },
          scaleFactor: 100,
        };
        if (printerName) {
          printOptions.deviceName = printerName;
          console.log('[PRINT] Using printer:', printerName);
        } else {
          const def = printers.find(p => p.isDefault);
          console.log('[PRINT] No printer specified — using default:', def?.name ?? 'unknown');
        }

        setTimeout(() => {
          printWin.webContents.print(
            printOptions,
            (success, reason) => {
              console.log('[PRINT] Result:', success, reason);
              try { fs.unlinkSync(tmpFile); } catch (_) {}
              printWin.destroy();
              resolve({ success, error: reason });
            }
          );
        }, 800);
      });
    });

    printWin.webContents.once('did-fail-load', (_ev, code, desc) => {
      console.error('[PRINT] Failed to load page:', code, desc);
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      printWin.destroy();
      resolve({ success: false, error: desc });
    });
  });
});

// List available printers
ipcMain.handle('print:getPrinters', async (_e) => {
  // Create a temporary hidden window just to query printers
  const tmpWin = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  await tmpWin.loadURL('about:blank');
  const printers = await tmpWin.webContents.getPrintersAsync();
  tmpWin.destroy();
  return printers.map(p => ({ name: p.name, isDefault: p.isDefault }));
});
