import { create } from 'zustand';
import type { Toast } from '../types';

interface ToastStore {
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

// Convenience helpers
export const toast = {
  success: (msg: string) => useToastStore.getState().addToast('success', msg),
  error:   (msg: string) => useToastStore.getState().addToast('error',   msg),
  warning: (msg: string) => useToastStore.getState().addToast('warning', msg),
  info:    (msg: string) => useToastStore.getState().addToast('info',    msg),
};
