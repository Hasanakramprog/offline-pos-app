// ── Currency formatters ───────────────────────────────────────────────────
export function formatLBP(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Math.round(amount)) + ' LL';
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(amount);
}

export function lbpToUsd(lbp: number, rate: number): number {
  return rate > 0 ? lbp / rate : 0;
}

export function usdToLbp(usd: number, rate: number): number {
  return usd * rate;
}

/** Primary: LBP, Secondary: USD */
export function formatDualCurrency(lbp: number, rate: number): string {
  return `${formatLBP(lbp)} / ${formatUSD(lbpToUsd(lbp, rate))}`;
}

// ── Date formatters ───────────────────────────────────────────────────────

/**
 * Ensures a date string from SQLite (stored as UTC without 'Z') is parsed
 * as UTC so JavaScript converts it correctly to local time.
 */
function toUtcDate(dateStr: string): Date {
  // If the string already has a timezone indicator, use it as-is
  if (dateStr.endsWith('Z') || dateStr.includes('+') || /\d{2}:\d{2}$/.test(dateStr.slice(-6))) {
    return new Date(dateStr);
  }
  // Append 'Z' to treat the timestamp as UTC
  return new Date(dateStr + 'Z');
}

export function formatDate(dateStr: string): string {
  return toUtcDate(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return toUtcDate(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Transaction number ────────────────────────────────────────────────────
export function generateTxNumber(): string {
  const now = new Date();
  const d = now.toISOString().slice(0,10).replace(/-/g,'');
  const t = String(Date.now()).slice(-6);
  return `TXN-${d}-${t}`;
}
