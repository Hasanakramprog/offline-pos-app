import { db } from './db';
import type { CreditFund, CreditFundTransaction } from '../types';

/** Return both fund rows (LBP + USD). */
export async function getFunds(): Promise<CreditFund[]> {
  return db.query<CreditFund>(
    `SELECT * FROM credit_fund ORDER BY currency`
  );
}

/** Add money to a fund pot and log the transaction. */
export async function topUpFund(
  fundId: 'fund-lbp' | 'fund-usd',
  amount: number,
  note: string | undefined,
  userId: string | undefined,
): Promise<void> {
  if (amount <= 0) throw new Error('Amount must be positive');

  await db.run(
    `UPDATE credit_fund
        SET balance    = balance + ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [amount, fundId]
  );

  await db.run(
    `INSERT INTO credit_fund_transactions (id, fund_id, type, amount, note, user_id)
     VALUES (?, ?, 'topup', ?, ?, ?)`,
    [crypto.randomUUID(), fundId, amount, note ?? null, userId ?? null]
  );
}

/**
 * Deduct an expense payment from a fund pot.
 * Throws if the resulting balance would go negative (overdraft blocked).
 */
export async function deductFromFund(
  fundId: 'fund-lbp' | 'fund-usd',
  amount: number,
  expenseId: string,
  userId: string | undefined,
  note?: string,
): Promise<void> {
  if (amount <= 0) throw new Error('Amount must be positive');

  const rows = await db.query<CreditFund>(
    `SELECT balance FROM credit_fund WHERE id = ?`,
    [fundId]
  );
  const current = rows[0]?.balance ?? 0;
  if (current < amount) {
    const currency = fundId === 'fund-lbp' ? 'LBP' : 'USD';
    throw new Error(
      `Insufficient ${currency} fund balance. Available: ${current.toLocaleString()} — Required: ${amount.toLocaleString()}`
    );
  }

  await db.run(
    `UPDATE credit_fund
        SET balance    = balance - ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [amount, fundId]
  );

  await db.run(
    `INSERT INTO credit_fund_transactions (id, fund_id, type, amount, note, expense_id, user_id)
     VALUES (?, ?, 'deduction', ?, ?, ?, ?)`,
    [crypto.randomUUID(), fundId, amount, note ?? null, expenseId, userId ?? null]
  );
}

/** Full transaction log, most recent first. */
export async function getFundTransactions(limit = 500): Promise<CreditFundTransaction[]> {
  return db.query<CreditFundTransaction>(
    `SELECT t.*, u.full_name AS user_name
       FROM credit_fund_transactions t
       LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT ?`,
    [limit]
  );
}

/**
 * Delete a transaction and reverse its effect on the fund balance.
 * - For a deduction: adds the amount back to the fund.
 * - For a topup: subtracts the amount from the fund (won't go below 0).
 */
export async function deleteTransaction(txnId: string): Promise<void> {
  const rows = await db.query<CreditFundTransaction & { fund_id: string; type: string; amount: number }>(
    `SELECT * FROM credit_fund_transactions WHERE id = ?`,
    [txnId]
  );
  const txn = rows[0];
  if (!txn) throw new Error('Transaction not found');

  const delta = txn.type === 'deduction' ? txn.amount : -txn.amount;

  await db.run(
    `UPDATE credit_fund
        SET balance    = MAX(0, balance + ?),
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [delta, txn.fund_id]
  );

  await db.run(`DELETE FROM credit_fund_transactions WHERE id = ?`, [txnId]);
}

/**
 * Edit a transaction's note and/or amount.
 * Adjusts the fund balance by the difference between old and new amounts.
 * Throws if the new amount would make the fund go negative.
 */
export async function updateTransaction(
  txnId: string,
  newAmount: number,
  newNote: string | undefined,
): Promise<void> {
  if (newAmount <= 0) throw new Error('Amount must be positive');

  const rows = await db.query<CreditFundTransaction>(
    `SELECT * FROM credit_fund_transactions WHERE id = ?`,
    [txnId]
  );
  const txn = rows[0];
  if (!txn) throw new Error('Transaction not found');

  const diff = newAmount - txn.amount; // positive = amount increased

  if (diff !== 0) {
    // For a deduction: increasing the amount takes more money out (delta = -diff)
    // For a topup: increasing adds more in (delta = +diff)
    const balanceDelta = txn.type === 'deduction' ? -diff : diff;

    const fundRows = await db.query<CreditFund>(
      `SELECT balance FROM credit_fund WHERE id = ?`,
      [txn.fund_id]
    );
    const newBalance = (fundRows[0]?.balance ?? 0) + balanceDelta;
    if (newBalance < 0) {
      throw new Error('This change would make the fund balance go negative');
    }

    await db.run(
      `UPDATE credit_fund
          SET balance    = balance + ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [balanceDelta, txn.fund_id]
    );
  }

  await db.run(
    `UPDATE credit_fund_transactions
        SET amount = ?, note = ?
      WHERE id = ?`,
    [newAmount, newNote ?? null, txnId]
  );
}

/**
 * Reset a fund balance to zero.
 * If there is an existing positive balance, logs a deduction to zero.
 * If already zero, does nothing.
 */
export async function resetFund(
  fundId: 'fund-lbp' | 'fund-usd',
  userId: string | undefined,
): Promise<void> {
  const rows = await db.query<CreditFund>(
    `SELECT balance FROM credit_fund WHERE id = ?`,
    [fundId]
  );
  const current = rows[0]?.balance ?? 0;
  if (current === 0) return; // already zero, nothing to do

  await db.run(
    `UPDATE credit_fund
        SET balance    = 0,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [fundId]
  );

  // Log the reset as a deduction of the full remaining balance
  await db.run(
    `INSERT INTO credit_fund_transactions (id, fund_id, type, amount, note, user_id)
     VALUES (?, ?, 'deduction', ?, 'Fund reset to zero', ?)`,
    [crypto.randomUUID(), fundId, current, userId ?? null]
  );
}
