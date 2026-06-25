import { create } from 'zustand';
import type { CartItem } from '../types';

// ── Held order snapshot ───────────────────────────────────────────────────
export interface HeldOrder {
  id: string;
  label: string;        // "#1", "#2", …
  items: CartItem[];
  orderDiscount: number;
  parkedAt: string;     // ISO timestamp
}

interface CartStore {
  items: CartItem[];
  orderDiscount: number; // flat LBP discount on entire order

  // Held orders
  heldOrders: HeldOrder[];

  addItem:         (item: Omit<CartItem, 'line_total_lbp'>) => void;
  removeItem:      (productId: string) => void;
  updateQty:       (productId: string, qty: number) => void;
  setItemDiscount: (productId: string, discount: number) => void;
  setOrderDiscount:(discount: number) => void;
  clearCart:       () => void;
  subtotal:        () => number;
  total:           () => number;

  // Hold / resume
  parkOrder:   () => string | null;  // parks current cart, returns held id (or null if empty)
  resumeOrder: (id: string) => void; // auto-parks active cart (if non-empty) then restores held
  discardHeld: (id: string) => void; // removes held order without restoring
}

function calcLineTotal(item: Omit<CartItem, 'line_total_lbp'>): number {
  return Math.max(0, item.unit_price_lbp * item.quantity - item.discount_lbp);
}

let _heldCounter = 0;

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  orderDiscount: 0,
  heldOrders: [],

  addItem: (item) => set((s) => {
    const existing = s.items.find(i => i.product_id === item.product_id);
    if (existing) {
      return {
        items: s.items.map(i =>
          i.product_id === item.product_id
            ? { ...i, quantity: i.quantity + item.quantity,
                line_total_lbp: calcLineTotal({ ...i, quantity: i.quantity + item.quantity }) }
            : i
        ),
      };
    }
    return { items: [...s.items, { ...item, line_total_lbp: calcLineTotal(item) }] };
  }),

  removeItem: (id) => set((s) => ({ items: s.items.filter(i => i.product_id !== id) })),

  updateQty: (id, qty) => set((s) => ({
    items: s.items.map(i =>
      i.product_id === id
        ? { ...i, quantity: qty, line_total_lbp: calcLineTotal({ ...i, quantity: qty }) }
        : i
    ).filter(i => i.quantity > 0),
  })),

  setItemDiscount: (id, discount) => set((s) => ({
    items: s.items.map(i =>
      i.product_id === id
        ? { ...i, discount_lbp: discount, line_total_lbp: calcLineTotal({ ...i, discount_lbp: discount }) }
        : i
    ),
  })),

  setOrderDiscount: (discount) => set({ orderDiscount: discount }),
  clearCart: () => set({ items: [], orderDiscount: 0 }),
  subtotal: () => get().items.reduce((s, i) => s + i.line_total_lbp, 0),
  total:    () => Math.max(0, get().items.reduce((s, i) => s + i.line_total_lbp, 0) - get().orderDiscount),

  // ── Hold / resume ────────────────────────────────────────────────────────

  parkOrder: () => {
    const { items, orderDiscount, heldOrders } = get();
    if (items.length === 0) return null;
    _heldCounter += 1;
    const held: HeldOrder = {
      id: crypto.randomUUID(),
      label: `#${_heldCounter}`,
      items: [...items],
      orderDiscount,
      parkedAt: new Date().toISOString(),
    };
    set({ heldOrders: [...heldOrders, held], items: [], orderDiscount: 0 });
    return held.id;
  },

  resumeOrder: (id) => {
    const { items, orderDiscount, heldOrders } = get();
    const target = heldOrders.find(h => h.id === id);
    if (!target) return;

    // Auto-park the active cart first (if non-empty) so nothing is lost
    let newHeld = heldOrders.filter(h => h.id !== id);
    if (items.length > 0) {
      _heldCounter += 1;
      const autoParked: HeldOrder = {
        id: crypto.randomUUID(),
        label: `#${_heldCounter}`,
        items: [...items],
        orderDiscount,
        parkedAt: new Date().toISOString(),
      };
      newHeld = [...newHeld, autoParked];
    }

    set({
      items: [...target.items],
      orderDiscount: target.orderDiscount,
      heldOrders: newHeld,
    });
  },

  discardHeld: (id) =>
    set((s) => ({ heldOrders: s.heldOrders.filter(h => h.id !== id) })),
}));
