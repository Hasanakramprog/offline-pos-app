import { create } from 'zustand';
import type { AppSettings } from '../types';
import { loadSettings, saveSettings } from '../services/settings';

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  load:  () => Promise<void>;
  save:  (s: Partial<AppSettings>) => Promise<void>;
}

const defaults: AppSettings = {
  store_name: 'minimarket',
  currency: 'USD',
  usd_to_lbp_rate: 89500,
  tax_rate: 0,
  receipt_footer: 'Thank you for shopping with us!',
  theme: 'dark',
  printer_share_name: '',
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaults,
  loaded: false,

  load: async () => {
    try {
      const s = await loadSettings();
      set({ settings: { ...defaults, ...s }, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  save: async (partial) => {
    const next = { ...get().settings, ...partial };
    set({ settings: next });
    await saveSettings(partial);
  },
}));
