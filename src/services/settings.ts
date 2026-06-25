import { db } from './db';
import type { AppSettings } from '../types';

export async function loadSettings(): Promise<AppSettings> {
  const rows = await db.query<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map: Record<string, string> = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return {
    store_name:      map.store_name      ?? 'minimarket',
    currency:        map.currency        ?? 'LBP',
    usd_to_lbp_rate: Number(map.usd_to_lbp_rate ?? 89500),
    tax_rate:        Number(map.tax_rate        ?? 0),
    receipt_footer:  map.receipt_footer  ?? 'Thank you!',
    theme:           map.theme           ?? 'dark',
    printer_share_name: map.printer_share_name ?? '',
  };
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await saveSetting(key, String(value));
  }
}
