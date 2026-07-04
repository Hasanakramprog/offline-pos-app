const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function exportSeed() {
  const dbPath = path.join(process.env.APPDATA, 'offline-pos-app', 'pos.db');
  if (!fs.existsSync(dbPath)) {
    console.error('Local DB not found at:', dbPath);
    return;
  }

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const tables = [
    { name: 'users', query: 'SELECT * FROM users' },
    { name: 'categories', query: 'SELECT * FROM categories' },
    { name: 'products', query: 'SELECT p.* FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id IS NULL OR c.id IS NOT NULL' },
    { name: 'settings', query: 'SELECT * FROM settings' },
    { name: 'expenses', query: 'SELECT * FROM expenses' },
    { name: 'debt_customers', query: 'SELECT * FROM debt_customers' },
    { name: 'debt_entries', query: 'SELECT e.* FROM debt_entries e INNER JOIN debt_customers c ON e.customer_id = c.id' },
    { name: 'sales', query: 'SELECT * FROM sales' },
    { name: 'sale_items', query: 'SELECT i.* FROM sale_items i INNER JOIN sales s ON i.sale_id = s.id INNER JOIN products p ON i.product_id = p.id' }
  ];

  let sqlDump = '-- Supabase Seed File\n-- Run this in the Supabase SQL Editor to populate initial data\n\n';

  for (const table of tables) {
    const stmt = db.prepare(table.query);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const cols = Object.keys(row).join(', ');
      
      const values = Object.values(row).map(val => {
        if (val === null) return 'NULL';
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        return val;
      }).join(', ');
      
      sqlDump += `INSERT INTO public.${table.name} (${cols}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
    }
    stmt.free();
    sqlDump += '\n';
  }

  const outPath = path.join(__dirname, 'supabase', 'seed.sql');
  fs.writeFileSync(outPath, sqlDump, 'utf8');
  console.log('Seed file generated at:', outPath);
}

exportSeed().catch(console.error);
