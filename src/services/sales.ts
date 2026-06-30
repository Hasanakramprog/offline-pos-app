import { db } from './db';
import type { Sale, SaleItem, SaleWithItems, CartItem } from '../types';

export async function createSale(
  sale: Omit<Sale, 'created_at'>,
  items: CartItem[]
): Promise<string> {
  await db.run(
    `INSERT INTO sales
       (id, transaction_number, user_id, subtotal_lbp, discount_lbp, total_lbp,
        usd_to_lbp_rate, payment_method, cash_received_lbp, change_lbp, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sale.id, sale.transaction_number, sale.user_id, sale.subtotal_lbp,
     sale.discount_lbp, sale.total_lbp, sale.usd_to_lbp_rate, sale.payment_method,
     sale.cash_received_lbp, sale.change_lbp, sale.notes ?? null]
  );

  for (const item of items) {
    const itemId = crypto.randomUUID();
    await db.run(
      `INSERT INTO sale_items
         (id, sale_id, product_id, product_name, quantity, unit_price_lbp, discount_lbp, line_total_lbp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, sale.id, item.product_id, item.product_name,
       item.quantity, item.unit_price_lbp, item.discount_lbp, item.line_total_lbp]
    );
  }
  return sale.id;
}

export async function getSales(limit = 50): Promise<Sale[]> {
  return db.query<Sale>(
    `SELECT s.*, u.full_name as user_name
     FROM sales s
     LEFT JOIN users u ON s.user_id = u.id
     ORDER BY s.created_at DESC LIMIT ?`,
    [limit]
  );
}

export async function getSaleWithItems(saleId: string): Promise<SaleWithItems | null> {
  const sales = await db.query<Sale>(
    `SELECT s.*, u.full_name as user_name
     FROM sales s LEFT JOIN users u ON s.user_id = u.id
     WHERE s.id = ?`,
    [saleId]
  );
  if (!sales.length) return null;
  const items = await db.query<SaleItem>(
    'SELECT * FROM sale_items WHERE sale_id = ?', [saleId]
  );
  return { ...sales[0], items };
}

export async function getSalesByDateRange(start: string, end: string): Promise<Sale[]> {
  return db.query<Sale>(
    `SELECT s.*, u.full_name as user_name
     FROM sales s LEFT JOIN users u ON s.user_id = u.id
     WHERE DATE(s.created_at) BETWEEN ? AND ?
     ORDER BY s.created_at DESC`,
    [start, end]
  );
}

export async function getDailySummary(days = 30) {
  return db.query<{ date: string; transaction_count: number; total_revenue_lbp: number }>(
    `SELECT DATE(created_at) as date,
            COUNT(*) as transaction_count,
            COALESCE(SUM(CASE WHEN payment_method != 'debt' THEN total_lbp ELSE 0 END), 0) as total_revenue_lbp
     FROM sales
     WHERE created_at >= DATE('now', ? || ' days')
     GROUP BY DATE(created_at)
     ORDER BY date DESC`,
    [`-${days}`]
  );
}

export async function getTopProducts(days = 30) {
  return db.query<{ product_id: string; product_name: string; units_sold: number; revenue_lbp: number }>(
    `SELECT si.product_id, si.product_name,
            SUM(si.quantity) as units_sold,
            SUM(si.line_total_lbp) as revenue_lbp
     FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     WHERE s.created_at >= DATE('now', ? || ' days')
     GROUP BY si.product_id
     ORDER BY units_sold DESC LIMIT 10`,
    [`-${days}`]
  );
}

/** Records a debt repayment as cash revenue so it appears on the dashboard. */
export async function createDebtPaymentRevenue(
  id: string,
  userId: string,
  amountLbp: number,
  note: string,
  rate: number
): Promise<void> {
  await db.run(
    `INSERT INTO sales
       (id, transaction_number, user_id, subtotal_lbp, discount_lbp, total_lbp,
        usd_to_lbp_rate, payment_method, cash_received_lbp, change_lbp, notes)
     VALUES (?, ?, ?, ?, 0, ?, ?, 'debt_payment', ?, 0, ?)`,
    [id, `DPY-${Date.now()}`, userId, amountLbp, amountLbp, rate, amountLbp, note]
  );
}

export async function getTodaySummary() {
  const rows = await db.query<{
    transaction_count: number; total_revenue_lbp: number; total_discount_lbp: number;
  }>(
    `SELECT COUNT(*) as transaction_count,
            COALESCE(SUM(CASE WHEN payment_method != 'debt' THEN total_lbp ELSE 0 END), 0) as total_revenue_lbp,
            COALESCE(SUM(discount_lbp),0) as total_discount_lbp
     FROM sales WHERE DATE(created_at) = DATE('now')`
  );
  return rows[0];
}
