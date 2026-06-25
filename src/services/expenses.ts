import { db } from './db';
import type { Expense } from '../types';

export const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Restocking',
  'Maintenance',
  'Salaries',
  'Transport',
  'Supplies',
  'Other',
] as const;

export async function createExpense(
  expense: Omit<Expense, 'created_at' | 'user_name'>
): Promise<void> {
  await db.run(
    `INSERT INTO expenses (id, category, amount_lbp, note, user_id)
     VALUES (?, ?, ?, ?, ?)`,
    [expense.id, expense.category, expense.amount_lbp,
     expense.note ?? null, expense.user_id ?? null]
  );
}

export async function getExpenses(limit = 200): Promise<Expense[]> {
  return db.query<Expense>(
    `SELECT e.*, u.full_name as user_name
     FROM expenses e
     LEFT JOIN users u ON e.user_id = u.id
     ORDER BY e.created_at DESC LIMIT ?`,
    [limit]
  );
}

export async function deleteExpense(id: string): Promise<void> {
  await db.run('DELETE FROM expenses WHERE id = ?', [id]);
}

export async function getExpenseSummary(): Promise<{ today_lbp: number; month_lbp: number }> {
  const rows = await db.query<{ today_lbp: number; month_lbp: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN DATE(created_at) = DATE('now') THEN amount_lbp ELSE 0 END), 0) AS today_lbp,
       COALESCE(SUM(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') THEN amount_lbp ELSE 0 END), 0) AS month_lbp
     FROM expenses`
  );
  return rows[0] ?? { today_lbp: 0, month_lbp: 0 };
}
