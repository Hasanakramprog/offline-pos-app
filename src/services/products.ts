import { db } from './db';
import type { Product, Category } from '../types';

export async function getProducts(activeOnly = true): Promise<Product[]> {
  const sql = activeOnly
    ? `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = 1 ORDER BY p.name`
    : `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.name`;
  return db.query<Product>(sql);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const q = `%${query}%`;
  return db.query<Product>(
    `SELECT p.*, c.name as category_name FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.is_active = 1 AND (p.name LIKE ? OR p.barcode = ? OR p.sku LIKE ?)
     ORDER BY p.name LIMIT 20`,
    [q, query, q]
  );
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const rows = await db.query<Product>(
    'SELECT * FROM products WHERE barcode = ? AND is_active = 1',
    [barcode]
  );
  return rows[0] ?? null;
}

export async function createProduct(p: Omit<Product, 'created_at' | 'updated_at'>): Promise<void> {
  await db.run(
    `INSERT INTO products (id, name, description, barcode, sku, category_id, price_lbp, image_url, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.id, p.name, p.description ?? null, p.barcode ?? null, p.sku ?? null,
     p.category_id ?? null, p.price_lbp, p.image_url ?? null, p.is_active]
  );
}

export async function updateProduct(id: string, fields: Partial<Product>): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  const allowed = ['name','description','barcode','sku','category_id','price_lbp','image_url','is_active'];
  for (const k of allowed) {
    if (k in fields) { sets.push(`${k} = ?`); vals.push((fields as Record<string,unknown>)[k] ?? null); }
  }
  sets.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(id);
  await db.run(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteProduct(id: string): Promise<void> {
  await db.run('DELETE FROM products WHERE id = ?', [id]);
}

export async function getCategories(): Promise<Category[]> {
  return db.query<Category>('SELECT * FROM categories ORDER BY name');
}

export async function createCategory(id: string, name: string): Promise<void> {
  await db.run('INSERT INTO categories (id, name) VALUES (?, ?)', [id, name]);
}
