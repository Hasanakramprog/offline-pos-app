import { db } from './db';
import type { DebtCustomer, DebtEntry, DebtCustomerWithBalance } from '../types';

export async function createDebtCustomer(
  customer: Omit<DebtCustomer, 'created_at'>
): Promise<void> {
  await db.run(
    `INSERT INTO debt_customers (id, name, phone, notes) VALUES (?, ?, ?, ?)`,
    [customer.id, customer.name, customer.phone ?? null, customer.notes ?? null]
  );
}

export async function getDebtCustomersWithBalance(): Promise<DebtCustomerWithBalance[]> {
  return db.query<DebtCustomerWithBalance>(
    `SELECT dc.*,
       COALESCE(SUM(CASE WHEN de.type='debt'    THEN de.amount_lbp ELSE 0 END), 0) AS total_debt_lbp,
       COALESCE(SUM(CASE WHEN de.type='payment' THEN de.amount_lbp ELSE 0 END), 0) AS total_paid_lbp,
       COALESCE(SUM(CASE WHEN de.type='debt'    THEN de.amount_lbp ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN de.type='payment' THEN de.amount_lbp ELSE 0 END), 0) AS balance_lbp
     FROM debt_customers dc
     LEFT JOIN debt_entries de ON dc.id = de.customer_id
     GROUP BY dc.id
     ORDER BY dc.name ASC`
  );
}

export async function addDebtEntry(
  entry: Omit<DebtEntry, 'created_at' | 'user_name'>
): Promise<void> {
  await db.run(
    `INSERT INTO debt_entries (id, customer_id, type, amount_lbp, note, sale_id, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.customer_id, entry.type, entry.amount_lbp,
     entry.note ?? null, entry.sale_id ?? null, entry.user_id ?? null]
  );
}

export async function getCustomerDebtHistory(customerId: string): Promise<DebtEntry[]> {
  return db.query<DebtEntry>(
    `SELECT de.*, u.full_name as user_name
     FROM debt_entries de
     LEFT JOIN users u ON de.user_id = u.id
     WHERE de.customer_id = ?
     ORDER BY de.created_at DESC`,
    [customerId]
  );
}

export async function deleteDebtCustomer(id: string): Promise<void> {
  await db.run('DELETE FROM debt_customers WHERE id = ?', [id]);
}

export async function deleteDebtEntry(id: string): Promise<void> {
  await db.run('DELETE FROM debt_entries WHERE id = ?', [id]);
}
