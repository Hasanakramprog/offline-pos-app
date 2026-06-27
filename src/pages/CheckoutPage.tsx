import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, X, Printer, Image, PackagePlus, Check, PauseCircle, History, Clock, RotateCcw, ListChecks, Pencil, ShoppingCart } from 'lucide-react';
import { searchProducts, getProductByBarcode } from '../services/products';
import { createSale } from '../services/sales';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from '../store/toastStore';
import { formatLBP, formatUSD, lbpToUsd, usdToLbp, generateTxNumber } from '../utils/formatters';
import { Modal } from '../components/Common/Modal';
import { Button } from '../components/Common/Button';
import { ImageLightbox } from '../components/Common/ImageLightbox';
import { useLang } from '../i18n/LangContext';
import type { Product, SaleWithItems } from '../types';

export const CheckoutPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  // Cash received: supports both LBP and USD entry
  const [cashMode, setCashMode] = useState<'LBP' | 'USD'>('LBP');
  const [cashInput, setCashInput] = useState('');
  const [cashDisplay, setCashDisplay] = useState('');
  const [lastSale, setLastSale] = useState<SaleWithItems | null>(null);
  const [processing, setProcessing] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [lightboxImg, setLightboxImg] = useState<{ src: string; alt: string } | null>(null);

  // ── Custom item ────────────────────────────────────────────────────────
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customPriceDisplay, setCustomPriceDisplay] = useState('');
  const customNameRef = useRef<HTMLInputElement>(null);

  // ── Predefined items (no barcode) ──────────────────────────────────────
  type PredefItem = { id: string; name: string; price_lbp: number };
  const STORAGE_KEY = 'pos_predefined_items';
  const loadPredefined = (): PredefItem[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  };
  const [showPredefined, setShowPredefined] = useState(false);
  const [predefinedItems, setPredefinedItems] = useState<PredefItem[]>(loadPredefined);
  const [predSearch, setPredSearch] = useState('');
  // New-item form inside dialog
  const [predNewName, setPredNewName] = useState('');
  const [predNewPrice, setPredNewPrice] = useState('');
  const [predNewPriceDisplay, setPredNewPriceDisplay] = useState('');
  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editPriceDisplay, setEditPriceDisplay] = useState('');

  const savePredefined = (items: PredefItem[]) => {
    setPredefinedItems(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const addPredefinedItem = () => {
    const name = predNewName.trim();
    const price = Number(predNewPrice);
    if (!name) { toast.error(t('predef_item_name_req')); return; }
    if (!price || price <= 0) { toast.error(t('predef_price_req')); return; }
    const newItem: PredefItem = { id: crypto.randomUUID(), name, price_lbp: price };
    savePredefined([...predefinedItems, newItem]);
    setPredNewName('');
    setPredNewPrice('');
    setPredNewPriceDisplay('');
    toast.success(`"${name}" ${t('predef_saved')}`);
  };

  const deletePredefinedItem = (id: string) => {
    savePredefined(predefinedItems.filter(i => i.id !== id));
  };

  const startEdit = (item: PredefItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(String(item.price_lbp));
    setEditPriceDisplay(item.price_lbp.toLocaleString('en-US'));
  };

  const commitEdit = () => {
    const name = editName.trim();
    const price = Number(editPrice);
    if (!name || !price || price <= 0) { toast.error(t('predef_edit_req')); return; }
    savePredefined(predefinedItems.map(i => i.id === editingId ? { ...i, name, price_lbp: price } : i));
    setEditingId(null);
  };

  const addPredefinedToCart = (item: PredefItem) => {
    addItem({
      product_id: `custom-${crypto.randomUUID()}`,
      product_name: item.name,
      unit_price_lbp: item.price_lbp,
      quantity: 1,
      discount_lbp: 0,
    });
    toast.success(`"${item.name}" ${t('predef_added_to_cart')}`);
  };

  const filteredPredefined = predefinedItems.filter(i =>
    i.name.toLowerCase().includes(predSearch.toLowerCase())
  );

  const searchRef = useRef<HTMLInputElement>(null);
  const focusSearch = () => setTimeout(() => searchRef.current?.focus(), 80);
  const {
    items, addItem, removeItem, updateQty, setOrderDiscount,
    orderDiscount, subtotal, total, clearCart,
    heldOrders, parkOrder, resumeOrder, discardHeld,
  } = useCartStore();
  const [heldDrawerOpen, setHeldDrawerOpen] = useState(false);
  const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const rate = settings.usd_to_lbp_rate;
  const { t, lang } = useLang();

  // ── Print receipt in a clean isolated popup window ──────────────
  const printReceipt = () => {
    if (!lastSale) return;
    const isAr = lang === 'ar';
    const dir = isAr ? 'rtl' : 'ltr';

    const discountRows = lastSale.discount_lbp > 0 ? `
      <div class="row">
        <span>${isAr ? 'المجموع الفرعي' : 'Subtotal'}</span>
        <span>${formatLBP(lastSale.subtotal_lbp)}</span>
      </div>
      <div class="row" style="color:#b45309">
        <span>${isAr ? 'الخصم' : 'Discount'}</span>
        <span>−${formatLBP(lastSale.discount_lbp)}</span>
      </div>` : '';

    const footerHtml = settings.receipt_footer
      ? `<hr class="divider"/><p class="center small">${settings.receipt_footer}</p>`
      : '';

    const itemRows = lastSale.items.map(item => `
      <div class="row">
        <span class="item-name">${item.product_name}</span>
        <span class="item-qty">×${item.quantity}</span>
        <span class="item-price">${formatLBP(item.line_total_lbp)}</span>
      </div>`).join('');

    const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>Receipt</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    * { box-sizing: border-box; }
    body {
      width: 100%;
      max-width: 80mm;
      font-family: 'Courier New', Courier, monospace;
      font-size: 9pt;
      font-weight: 700;
      line-height: 1.4;
      direction: ${dir};
    }
    .wrap { width: 100%; box-sizing: border-box; padding: 2mm 14mm 2mm 2mm; }
    .center { text-align: center; }
    .store-name { font-size: 13pt; font-weight: 700; text-align: center; letter-spacing: 0.5px; margin-bottom: 1mm; text-transform: uppercase; }
    .small { font-size: 7.5pt; color: #333; text-align: center; }
    .divider { border: none; border-top: 1px dashed #000; margin: 2mm 0; width: 100%; display: block; }
    .row { display: flex; justify-content: space-between; width: 100%; font-size: 8.5pt; line-height: 1.45; gap: 1mm; }
    .row.header { color: #555; margin-bottom: 1mm; }
    .row.bold { font-weight: 700; }
    .row.grand { font-size: 11pt; font-weight: 700; margin-top: 1mm; }
    .row.muted { font-size: 7.5pt; color: #555; }
    .item-name { flex: 1; word-break: break-word; white-space: normal; text-align: ${isAr ? 'right' : 'left'}; }
    .item-qty  { flex-shrink: 0; white-space: nowrap; padding: 0 1mm; text-align: center; }
    .item-price{ flex-shrink: 0; white-space: nowrap; min-width: 14mm; text-align: ${isAr ? 'left' : 'right'}; }
  </style>
</head>
<body><div class="wrap">
  <p class="store-name">${settings.store_name}</p>
  <p class="small">${isAr ? 'رقم المعاملة' : 'TX'}: ${lastSale.transaction_number}</p>
  <p class="small">${new Date(lastSale.created_at).toLocaleString()}</p>
  <p class="small">${isAr ? 'الكاشير' : 'Cashier'}: ${lastSale.user_name}</p>
  <hr class="divider"/>
  <div class="row header">
    <span class="item-name">${isAr ? 'الصنف' : 'Item'}</span>
    <span class="item-qty">${isAr ? 'كمية' : 'Qty'}</span>
    <span class="item-price">${isAr ? 'المجموع' : 'Total'}</span>
  </div>
  ${itemRows}
  <hr class="divider"/>
  ${discountRows}
  <div class="row grand">
    <span>${isAr ? 'المجموع' : 'Total'}</span>
    <span>${formatLBP(lastSale.total_lbp)}</span>
  </div>
  <div class="row muted">
    <span></span>
    <span>≈ ${formatUSD(lbpToUsd(lastSale.total_lbp, rate))}</span>
  </div>
  <div class="row" style="margin-top:1mm">
    <span>${isAr ? 'نقد' : 'Cash'}</span>
    <span>${formatLBP(lastSale.cash_received_lbp)}</span>
  </div>
  <div class="row bold" style="color:#16a34a">
    <span>${isAr ? 'الباقي' : 'Change'}</span>
    <span>${formatLBP(lastSale.change_lbp)}</span>
  </div>
  ${footerHtml}
</div></body>
</html>`;

    // Use Electron's silent print via IPC (no dialog, no external window)
    const api = (window as any).electronAPI?.print;
    if (api?.receipt) {
      // Log available printers to help identify the correct thermal printer name
      api.getPrinters?.().then((printers: any[]) => {
        console.log('[CHECKOUT] Available printers:', printers);
      });
      // Pass printer_share_name from settings if configured
      const printerName = settings.printer_share_name || undefined;
      api.receipt(html, printerName).then((result: any) => {
        if (!result?.success) {
          console.error('Print failed:', result?.error);
          toast.error('Print failed: ' + (result?.error ?? 'unknown'));
        }
      });
    } else {
      // Fallback for browser dev mode
      const w = window.open('', '_blank', 'width=320,height=600');
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); w.close(); }, 300);
    }
  };

  // Auto-search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchProducts(query);
        setResults(r);
      } finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Barcode: Enter key triggers barcode lookup
  // Empty query + Enter → open payment modal (if cart has items)
  const handleSearchKey = useCallback(async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (!query.trim()) {
      if (items.length > 0) setPaymentOpen(true);
      return;
    }
    if (query.trim().length >= 3) {
      const p = await getProductByBarcode(query.trim());
      if (p) { addToCart(p); setQuery(''); setResults([]); }
    }
  }, [query, items]);

  // Global Enter key → open payment (when no modal is open, search is empty, cart has items)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (paymentOpen || receiptOpen || showCustom || showPredefined) return;
      // Don't hijack Enter inside inputs other than the search bar
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (items.length > 0) setPaymentOpen(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, paymentOpen, receiptOpen, showCustom]);

  const addToCart = (p: Product) => {
    addItem({ product_id: p.id, product_name: p.name, unit_price_lbp: p.price_lbp, quantity: 1, discount_lbp: 0, image_url: p.image_url });
    setQuery('');
    setResults([]);
    searchRef.current?.focus();
  };

  const handleCustomPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
    setCustomPrice(stripped);
    setCustomPriceDisplay(stripped === '' ? '' : Number(stripped).toLocaleString('en-US'));
  };

  const addCustomItem = () => {
    const name = customName.trim();
    const price = Number(customPrice);
    if (!name) { toast.error('Item name is required'); return; }
    if (!price || price <= 0) { toast.error('Enter a valid price'); return; }
    addItem({
      product_id: `custom-${crypto.randomUUID()}`,
      product_name: name,
      unit_price_lbp: price,
      quantity: 1,
      discount_lbp: 0,
    });
    setCustomName('');
    setCustomPrice('');
    setCustomPriceDisplay('');
    setShowCustom(false);
    toast.success(`"${name}" added to cart`);
    searchRef.current?.focus();
  };

  const handleOrderDiscount = (v: string) => {
    setDiscountInput(v);
    const d = parseFloat(v) || 0;
    setOrderDiscount(Math.min(d, subtotal()));
  };

  const handleParkOrder = () => {
    const id = parkOrder();
    if (id) {
      setDiscountInput('');
      toast.success(`Order parked — cart cleared for next customer`);
    }
  };

  const handleResumeOrder = (id: string) => {
    resumeOrder(id);
    setHeldDrawerOpen(false);
    setConfirmDiscardId(null);
    setDiscountInput('');
    toast.success('Order resumed');
    focusSearch();
  };

  const handleDiscardHeld = (id: string) => {
    discardHeld(id);
    setConfirmDiscardId(null);
    // If no more held orders, close the drawer and restore focus
    const remaining = heldOrders.filter(h => h.id !== id);
    if (remaining.length === 0) {
      setHeldDrawerOpen(false);
      focusSearch();
    }
  };

  const cartTotal = total();
  const cartSubtotal = subtotal();

  // Compute cash received in LBP regardless of which mode cashier entered
  const cashInputNum = parseFloat(cashInput.replace(/,/g, '')) || 0;
  const cashReceivedLbp = cashMode === 'LBP' ? cashInputNum : usdToLbp(cashInputNum, rate);
  const changeLbp = Math.max(0, cashReceivedLbp - cartTotal);

  const handleCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (cashMode === 'LBP') {
      const stripped = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
      setCashInput(stripped);
      setCashDisplay(stripped === '' ? '' : Number(stripped).toLocaleString('en-US'));
    } else {
      // USD: allow decimals, no comma formatting
      const val = e.target.value.replace(/[^0-9.]/g, '');
      setCashInput(val);
      setCashDisplay(val);
    }
  };

  const handleCompleteSale = async () => {
    if (items.length === 0) { toast.warning('Cart is empty'); return; }
    if (cashReceivedLbp < cartTotal) { toast.error('Cash received is less than total'); return; }
    setProcessing(true);
    try {
      const saleId = crypto.randomUUID();
      const txNumber = generateTxNumber();
      await createSale(
        {
          id: saleId,
          transaction_number: txNumber,
          user_id: user!.id,
          subtotal_lbp: cartSubtotal,
          discount_lbp: orderDiscount,
          total_lbp: cartTotal,
          usd_to_lbp_rate: rate,
          payment_method: 'cash',
          cash_received_lbp: cashReceivedLbp,
          change_lbp: changeLbp,
        },
        items
      );
      setLastSale({
        id: saleId, transaction_number: txNumber, user_id: user!.id,
        user_name: user!.full_name,
        subtotal_lbp: cartSubtotal, discount_lbp: orderDiscount, total_lbp: cartTotal,
        usd_to_lbp_rate: rate, payment_method: 'cash',
        cash_received_lbp: cashReceivedLbp, change_lbp: changeLbp,
        created_at: new Date().toISOString(), items: items.map((i, idx) => ({
          id: `${saleId}-${idx}`, sale_id: saleId, product_id: i.product_id,
          product_name: i.product_name, quantity: i.quantity,
          unit_price_lbp: i.unit_price_lbp, discount_lbp: i.discount_lbp,
          line_total_lbp: i.line_total_lbp,
        })),
      });
      clearCart();
      setPaymentOpen(false);
      setCashInput('');
      setCashDisplay('');
      setDiscountInput('');
      setReceiptOpen(true);
      toast.success('Sale completed!');
      
      // Auto-open cash drawer if printer is configured
      if (settings.printer_share_name) {
        window.electronAPI.hardware.openDrawer(settings.printer_share_name).catch(console.error);
      }
    } catch (err) {
      toast.error('Failed to complete sale');
      console.error(err);
    } finally { setProcessing(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top: Search & Product Lookup */}
      <div className="flex-shrink-0 px-6 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Checkout</h1>
          {/* Held Orders badge button */}
          <button
            id="held-orders-btn"
            onClick={() => setHeldDrawerOpen(true)}
            title="View held orders"
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-pos-border text-pos-muted hover:text-pos-text hover:bg-pos-border/40 transition-all text-xs font-medium"
          >
            <History size={14} />
            <span>Held</span>
            {heldOrders.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-pos-warning text-white text-[10px] font-bold flex items-center justify-center shadow">
                {heldOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Search bar + Custom Item button */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-pos-muted" />
            <input
              ref={searchRef}
              className="input pl-10"
              placeholder="Search by name, SKU or scan barcode…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleSearchKey}
              autoFocus
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-pos-muted hover:text-pos-text">
                <X size={16} />
              </button>
            )}
          </div>
          {/* Custom item toggle */}
          <button
            onClick={() => {
              setShowCustom(v => !v);
              if (!showCustom) setTimeout(() => customNameRef.current?.focus(), 60);
            }}
            title="Add custom item"
            className={`flex items-center gap-1.5 px-3 rounded-lg border text-sm font-medium transition-all flex-shrink-0
              ${showCustom
                ? 'bg-pos-primary text-white border-pos-primary shadow-sm'
                : 'border-pos-border text-pos-muted hover:text-pos-text hover:bg-pos-border/40'}`}>
            <PackagePlus size={16} />
            <span className="hidden sm:inline">{t('custom_item')}</span>
          </button>
          {/* Predefined items button */}
          <button
            id="predefined-items-btn"
            onClick={() => setShowPredefined(true)}
            title={t('predef_title')}
            className="flex items-center gap-1.5 px-3 rounded-lg border border-pos-border text-sm font-medium transition-all flex-shrink-0 text-pos-muted hover:text-pos-text hover:bg-pos-border/40"
          >
            <ListChecks size={16} />
            <span className="hidden sm:inline">{t('predef_btn')}</span>
          </button>
        </div>

        {/* Custom item panel */}
        {showCustom && (
          <div className="bg-pos-surface border border-pos-primary/40 rounded-xl p-4 space-y-3 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <PackagePlus size={15} className="text-pos-primary" />
              <p className="text-sm font-semibold text-pos-primary">Custom Item</p>
              <p className="text-xs text-pos-muted ml-auto">Not in inventory</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="text-xs text-pos-muted block mb-1">Item Name *</label>
                <input
                  ref={customNameRef}
                  className="input"
                  placeholder="e.g. Water bottle, Service fee…"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCustomItem(); if (e.key === 'Escape') setShowCustom(false); }}
                />
              </div>
              <div>
                <label className="text-xs text-pos-muted block mb-1">Price (LL) *</label>
                <input
                  className="input font-mono"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={customPriceDisplay}
                  onChange={handleCustomPriceChange}
                  onKeyDown={e => { if (e.key === 'Enter') addCustomItem(); if (e.key === 'Escape') setShowCustom(false); }}
                />
                {customPrice && (
                  <p className="text-xs text-pos-muted mt-1">{formatUSD(lbpToUsd(Number(customPrice), rate))}</p>
                )}
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={addCustomItem}
                  disabled={!customName.trim() || !customPrice}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-pos-primary text-white text-sm font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  <Check size={15} /> Add to Cart
                </button>
                <button
                  onClick={() => { setShowCustom(false); setCustomName(''); setCustomPrice(''); setCustomPriceDisplay(''); }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-pos-border text-pos-muted hover:text-pos-text transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results dropdown */}
        {results.length > 0 && (
          <div className="bg-pos-surface border border-pos-border rounded-xl overflow-hidden shadow-xl">
            {results.map(p => (
              <button key={p.id} onClick={() => addToCart(p)}
                className="flex items-center justify-between w-full px-4 py-3
                           hover:bg-pos-border/40 transition-colors text-left border-b border-pos-border/50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.barcode && <p className="text-xs text-pos-muted">{p.barcode}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-pos-success">{formatLBP(p.price_lbp)}</p>
                  <p className="text-xs text-pos-muted">{formatUSD(lbpToUsd(p.price_lbp, rate))}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {searching && <p className="text-pos-muted text-sm text-center">Searching…</p>}
        {!searching && query && results.length === 0 && (
          <div className="text-center py-4">
            <p className="text-pos-muted text-sm">No products found</p>
            <button
              onClick={() => { setShowCustom(true); setCustomName(query); setQuery(''); setResults([]); setTimeout(() => customNameRef.current?.focus(), 60); }}
              className="mt-2 text-xs text-pos-primary hover:brightness-110 transition-colors flex items-center gap-1 mx-auto">
              <PackagePlus size={12} /> Add "{query}" as custom item
            </button>
          </div>
        )}
      </div>

      {/* Center: Cart — takes the remaining space */}
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-4 pt-2">
        <div className="flex-1 flex flex-col min-h-0 bg-pos-surface border border-pos-border rounded-2xl overflow-hidden shadow-sm">
          {/* Cart header */}
          <div className="px-5 py-3 border-b border-pos-border flex items-center justify-between gap-2 flex-shrink-0">
            <h2 className="font-semibold">Cart ({items.length} items)</h2>
            {items.length > 0 && (
              <Button variant="ghost" className="text-xs !py-1 !px-2" onClick={() => { clearCart(); setDiscountInput(''); }}>
                Clear Cart
              </Button>
            )}
          </div>

          {/* Cart body — items grid + totals side by side */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0">
            {/* Items area — scrollable, multi-column grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-pos-muted gap-2">
                  <ShoppingCartIcon />
                  <p className="text-sm">Cart is empty</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {items.map(item => (
                    <div key={item.product_id} className="bg-pos-bg rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        {/* Thumbnail / custom badge */}
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            onClick={() => setLightboxImg({ src: item.image_url!, alt: item.product_name })}
                            className="w-10 h-10 rounded-lg object-cover border border-pos-border flex-shrink-0 cursor-zoom-in hover:ring-2 hover:ring-pos-primary transition-all"
                          />
                        ) : item.product_id.startsWith('custom-') ? (
                          <div className="w-10 h-10 rounded-lg bg-pos-primary/15 border border-pos-primary/30 flex items-center justify-center flex-shrink-0">
                            <PackagePlus size={14} className="text-pos-primary" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-pos-border/40 flex items-center justify-center flex-shrink-0">
                            <Image size={14} className="text-pos-muted" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.product_name}</p>
                              <p className="text-xs text-pos-muted">{formatLBP(item.unit_price_lbp)} each</p>
                              <p className="text-xs text-pos-muted/70">{formatUSD(lbpToUsd(item.unit_price_lbp, rate))} each</p>
                            </div>
                            <button onClick={() => removeItem(item.product_id)} className="text-pos-danger hover:brightness-125 flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQty(item.product_id, item.quantity - 1)}
                                className="w-7 h-7 rounded-lg bg-pos-border flex items-center justify-center hover:bg-pos-muted/30">
                                <Minus size={12} />
                              </button>
                              <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQty(item.product_id, item.quantity + 1)}
                                className="w-7 h-7 rounded-lg bg-pos-border flex items-center justify-center hover:bg-pos-muted/30">
                                <Plus size={12} />
                              </button>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-pos-success">{formatLBP(item.line_total_lbp)}</p>
                              <p className="text-xs text-pos-muted">{formatUSD(lbpToUsd(item.line_total_lbp, rate))}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals & Actions — right side on large screens, bottom on small */}
            <div className="lg:w-72 xl:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-s border-pos-border p-4 space-y-3 flex flex-col justify-end">
              {/* Order discount */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-pos-muted flex-1">Order Discount (LL)</label>
                <input
                  className="input w-32 text-sm text-right"
                  type="number" min="0" step="1000"
                  placeholder="0"
                  value={discountInput}
                  onChange={e => handleOrderDiscount(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-pos-muted">
                  <span>Subtotal</span>
                  <div className="text-right">
                    <p>{formatLBP(cartSubtotal)}</p>
                    <p className="text-xs opacity-60">{formatUSD(lbpToUsd(cartSubtotal, rate))}</p>
                  </div>
                </div>
                {orderDiscount > 0 && (
                  <div className="flex justify-between text-pos-warning">
                    <span>Discount</span><span>−{formatLBP(orderDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-pos-border pt-2">
                  <span>TOTAL</span>
                  <div className="text-right">
                    <p className="text-pos-success text-lg">{formatLBP(cartTotal)}</p>
                    <p className="text-xs text-pos-muted font-normal">{formatUSD(lbpToUsd(cartTotal, rate))}</p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full py-3"
                icon={<CreditCard size={18} />}
                disabled={items.length === 0}
                onClick={() => setPaymentOpen(true)}
              >
                Process Payment
              </Button>
              {items.length > 0 && (
                <button
                  id="park-order-btn"
                  onClick={handleParkOrder}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-pos-warning/60 text-pos-warning text-sm font-medium hover:bg-pos-warning/10 transition-all"
                >
                  <PauseCircle size={16} />
                  Park Order
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal open={paymentOpen} onClose={() => { setPaymentOpen(false); focusSearch(); }} title="Cash Payment" size="sm">
        <div className="space-y-4">
          <div className="bg-pos-bg rounded-xl p-4 text-center">
            <p className="text-pos-muted text-sm">Total Due</p>
            <p className="text-3xl font-bold text-pos-success mt-1">{formatLBP(cartTotal)}</p>
            <p className="text-sm text-pos-muted mt-0.5">{formatUSD(lbpToUsd(cartTotal, rate))}</p>
          </div>

          {/* Cash currency toggle */}
          <div className="flex rounded-xl overflow-hidden border border-pos-border">
            <button
              onClick={() => { setCashMode('LBP'); setCashInput(''); setCashDisplay(''); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${cashMode === 'LBP' ? 'bg-pos-primary text-white' : 'hover:bg-pos-border/40 text-pos-muted'}`}
            >
              Pay in LL
            </button>
            <button
              onClick={() => { setCashMode('USD'); setCashInput(''); setCashDisplay(''); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${cashMode === 'USD' ? 'bg-pos-primary text-white' : 'hover:bg-pos-border/40 text-pos-muted'}`}
            >
              Pay in USD
            </button>
          </div>

          <div>
            <label className="text-sm font-medium text-pos-muted block mb-1">
              Cash Received ({cashMode === 'LBP' ? 'LL' : '$'})
            </label>
            <input
              className="input text-xl font-bold text-center font-mono"
              type="text"
              inputMode={cashMode === 'LBP' ? 'numeric' : 'decimal'}
              placeholder={cashMode === 'LBP' ? '0' : '0.00'}
              value={cashDisplay}
              onChange={handleCashChange}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (cashReceivedLbp >= cartTotal) handleCompleteSale();
                  else toast.error('Cash received is less than total');
                }
              }}
              autoFocus
            />
            {cashMode === 'USD' && cashInputNum > 0 && (
              <p className="text-xs text-pos-muted mt-1 text-center">
                = {formatLBP(usdToLbp(cashInputNum, rate))}
              </p>
            )}
          </div>

          {cashInputNum > 0 && (
            <div className={`flex justify-between items-center p-3 rounded-xl ${changeLbp >= 0 ? 'bg-pos-success/10' : 'bg-pos-danger/10'}`}>
              <span className="text-sm font-medium">Change</span>
              <div className="text-right">
                <p className={`font-bold ${changeLbp >= 0 ? 'text-pos-success' : 'text-pos-danger'}`}>
                  {formatLBP(changeLbp)}
                </p>
                <p className="text-xs text-pos-muted">{formatUSD(lbpToUsd(changeLbp, rate))}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <Button variant="secondary" onClick={() => { setPaymentOpen(false); focusSearch(); }} className="flex-1">Cancel</Button>
          <Button
            className="flex-1"
            loading={processing}
            disabled={cashReceivedLbp < cartTotal}
            onClick={handleCompleteSale}
          >
            Complete Sale
          </Button>
        </div>
      </Modal>

      {/* Receipt Modal */}
      {lastSale && (
        <Modal open={receiptOpen} onClose={() => { setReceiptOpen(false); focusSearch(); }} title={t('receipt_title')} size="sm">
          {/* ── Receipt Content (targeted by @media print) ── */}
          <div id="receipt-content" className="font-mono text-xs text-center">

            {/* Store name */}
            <p className="receipt-store-name text-sm font-bold uppercase tracking-wide">
              {settings.store_name}
            </p>

            {/* Transaction meta */}
            <p className="receipt-meta text-pos-muted mt-1">
              {t('col_tx')}: {lastSale.transaction_number}
            </p>
            <p className="receipt-meta text-pos-muted">
              {new Date(lastSale.created_at).toLocaleString()}
            </p>
            <p className="receipt-cashier text-pos-muted">
              {t('cashier') ?? 'Cashier'}: {lastSale.user_name}
            </p>

            {/* ── Divider ── */}
            <hr className="receipt-divider border-dashed border-pos-border my-2" />

            {/* Column header */}
            <div className="receipt-item text-pos-muted mb-1 flex justify-between text-left">
              <span className="receipt-item-name">Item</span>
              <span className="receipt-item-qty text-center">Qty</span>
              <span className="receipt-item-price text-right">Total</span>
            </div>

            {/* Items */}
            {lastSale.items.map((item, i) => (
              <div key={i} className="receipt-item flex justify-between text-left mb-0.5">
                <span className="receipt-item-name flex-1 text-left">{item.product_name}</span>
                <span className="receipt-item-qty text-center px-2">×{item.quantity}</span>
                <span className="receipt-item-price text-right">{formatLBP(item.line_total_lbp)}</span>
              </div>
            ))}

            {/* ── Divider ── */}
            <hr className="receipt-divider border-dashed border-pos-border my-2" />

            {/* Subtotal (only if discount exists) */}
            {lastSale.discount_lbp > 0 && (
              <>
                <div className="receipt-total-row flex justify-between text-pos-muted">
                  <span>Subtotal</span>
                  <span>{formatLBP(lastSale.subtotal_lbp)}</span>
                </div>
                <div className="receipt-total-row flex justify-between text-amber-600">
                  <span>Discount</span>
                  <span>−{formatLBP(lastSale.discount_lbp)}</span>
                </div>
              </>
            )}

            {/* Grand total */}
            <div className="receipt-total-row grand-total flex justify-between font-bold">
              <span>{t('total')}</span>
              <span>{formatLBP(lastSale.total_lbp)}</span>
            </div>
            <div className="receipt-total-row usd-line flex justify-between text-pos-muted">
              <span></span>
              <span>≈ {formatUSD(lbpToUsd(lastSale.total_lbp, rate))}</span>
            </div>

            {/* Cash & change */}
            <div className="receipt-total-row flex justify-between mt-1">
              <span>{t('cash')}</span>
              <span>{formatLBP(lastSale.cash_received_lbp)}</span>
            </div>
            <div className="receipt-total-row flex justify-between font-bold text-pos-success">
              <span>{t('change')}</span>
              <span>{formatLBP(lastSale.change_lbp)}</span>
            </div>

            {/* ── Divider ── */}
            <hr className="receipt-divider border-dashed border-pos-border my-2" />

            {/* Footer */}
            {settings.receipt_footer && (
              <p className="receipt-footer text-pos-muted leading-snug">
                {settings.receipt_footer}
              </p>
            )}
          </div>

          {/* Action buttons — hidden when printing */}
          <div className="flex gap-3 mt-4 no-print">
            <Button variant="secondary" className="flex-1" onClick={() => { setReceiptOpen(false); focusSearch(); }}>
              {t('close')}
            </Button>
            <Button className="flex-1" icon={<Printer size={16} />} onClick={printReceipt}>
              {t('print')}
            </Button>
          </div>
        </Modal>
      )}
      {/* Image Lightbox */}
      {lightboxImg && (
        <ImageLightbox
          src={lightboxImg.src}
          alt={lightboxImg.alt}
          onClose={() => setLightboxImg(null)}
        />
      )}

      {/* ── Held Orders Drawer ─────────────────────────────────────────── */}
      {heldDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => { setHeldDrawerOpen(false); setConfirmDiscardId(null); focusSearch(); }}
          />
          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-80 bg-pos-surface border-s border-pos-border flex flex-col shadow-2xl animate-slide-in-right">
            {/* Header */}
            <div className="px-4 py-3 border-b border-pos-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={18} className="text-pos-primary" />
                <h3 className="font-semibold">Held Orders</h3>
              </div>
              <button
                onClick={() => { setHeldDrawerOpen(false); setConfirmDiscardId(null); focusSearch(); }}
                className="p-1.5 rounded-lg hover:bg-pos-border/40 text-pos-muted hover:text-pos-text transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {heldOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-pos-muted">
                  <PauseCircle size={40} strokeWidth={1.2} />
                  <p className="text-sm text-center">No held orders.<br/>Park an order to see it here.</p>
                </div>
              ) : (
                heldOrders.map((held) => {
                  const heldTotal = held.items.reduce((s, i) => s + i.line_total_lbp, 0) - held.orderDiscount;
                  const parkedTime = new Date(held.parkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div
                      key={held.id}
                      className="bg-pos-bg border border-pos-border rounded-xl p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-pos-primary">{held.label}</span>
                        <div className="flex items-center gap-1 text-xs text-pos-muted">
                          <Clock size={11} />
                          <span>{parkedTime}</span>
                        </div>
                      </div>
                      <div className="text-xs text-pos-muted space-y-0.5">
                        <p>{held.items.length} item{held.items.length !== 1 ? 's' : ''}</p>
                        {held.items.slice(0, 2).map((it, i) => (
                          <p key={i} className="truncate opacity-75">• {it.product_name} ×{it.quantity}</p>
                        ))}
                        {held.items.length > 2 && (
                          <p className="opacity-60">+{held.items.length - 2} more…</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-pos-border/60">
                        <span className="text-sm font-bold text-pos-success">{formatLBP(Math.max(0, heldTotal))}</span>
                        <div className="flex gap-2">
                          {confirmDiscardId === held.id ? (
                            <>
                              <button
                                onClick={() => setConfirmDiscardId(null)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-pos-border text-pos-muted text-xs hover:bg-pos-border/40 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDiscardHeld(held.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-pos-danger text-white text-xs hover:brightness-110 transition-all"
                              >
                                <Trash2 size={11} />
                                Confirm
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setConfirmDiscardId(held.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-pos-danger/40 text-pos-danger text-xs hover:bg-pos-danger/10 transition-colors"
                              >
                                <Trash2 size={11} />
                                Discard
                              </button>
                              <button
                                id={`resume-order-${held.id}`}
                                onClick={() => handleResumeOrder(held.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-pos-primary text-white text-xs hover:brightness-110 transition-all"
                              >
                                <RotateCcw size={11} />
                                Resume
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Predefined Items Dialog ─────────────────────────────────────── */}
      <Modal
        open={showPredefined}
        onClose={() => { setShowPredefined(false); setEditingId(null); setPredSearch(''); focusSearch(); }}
        title={t('predef_title')}
        size="xl"
      >
        <div className="space-y-4">
          {/* Description */}
          <p className="text-xs text-pos-muted">
            {t('predef_subtitle')}
          </p>

          {/* Search within predefined */}
          <div className="relative">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-pos-muted" />
            <input
              className="input ps-9 text-sm"
              placeholder={t('predef_filter_ph')}
              value={predSearch}
              onChange={e => setPredSearch(e.target.value)}
            />
            {predSearch && (
              <button
                onClick={() => setPredSearch('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-pos-muted hover:text-pos-text"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Items grid */}
          <div className="max-h-[340px] overflow-y-auto pr-1 space-y-2">
            {filteredPredefined.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-pos-muted">
                <ListChecks size={38} strokeWidth={1.2} />
                <p className="text-sm text-center">
                  {predefinedItems.length === 0
                    ? t('predef_empty')
                    : t('predef_no_match')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredPredefined.map(item => (
                  <div
                    key={item.id}
                    className="group bg-pos-bg border border-pos-border rounded-xl p-3 flex items-center gap-3 hover:border-pos-primary/40 transition-all"
                  >
                    {editingId === item.id ? (
                      /* ── Inline edit form ── */
                      <div className="flex-1 space-y-2">
                        <input
                          className="input text-sm w-full"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                          autoFocus
                          placeholder={t('predef_item_name_edit_ph')}
                        />
                        <div className="flex gap-2 items-center">
                          <input
                            className="input text-sm font-mono flex-1"
                            type="text"
                            inputMode="numeric"
                            value={editPriceDisplay}
                            onChange={e => {
                              const s = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                              setEditPrice(s);
                              setEditPriceDisplay(s === '' ? '' : Number(s).toLocaleString('en-US'));
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                            placeholder={t('predef_price_edit_ph')}
                          />
                          <button
                            onClick={commitEdit}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-pos-primary text-white hover:brightness-110 transition-all"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-pos-border text-pos-muted hover:text-pos-text transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Normal row ── */
                      <>
                        <button
                          onClick={() => addPredefinedToCart(item)}
                          className="flex-1 text-start min-w-0"
                        >
                          <p className="text-sm font-medium truncate group-hover:text-pos-primary transition-colors">{item.name}</p>
                          <p className="text-xs font-mono text-pos-success">{formatLBP(item.price_lbp)}</p>
                          <p className="text-xs text-pos-muted/70">{formatUSD(lbpToUsd(item.price_lbp, rate))}</p>
                        </button>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => addPredefinedToCart(item)}
                            title="Add to cart"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-pos-primary/15 text-pos-primary hover:bg-pos-primary hover:text-white transition-all"
                          >
                            <ShoppingCart size={13} />
                          </button>
                          <button
                            onClick={() => startEdit(item)}
                            title="Edit"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-pos-border/60 text-pos-muted hover:bg-pos-border hover:text-pos-text transition-all"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`${t('predef_delete_confirm')} "${item.name}"?`)) deletePredefinedItem(item.id);
                            }}
                            title="Delete"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-pos-danger/10 text-pos-danger hover:bg-pos-danger hover:text-white transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Add new predefined item ── */}
          <div className="border-t border-pos-border pt-4">
            <p className="text-xs font-semibold text-pos-muted uppercase tracking-wide mb-3">{t('predef_add_section')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div>
                <label className="text-xs text-pos-muted block mb-1">{t('predef_item_name_label')}</label>
                <input
                  className="input text-sm"
                  placeholder={t('predef_name_ph')}
                  value={predNewName}
                  onChange={e => setPredNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addPredefinedItem(); }}
                />
              </div>
              <div>
                <label className="text-xs text-pos-muted block mb-1">{t('predef_price_label')}</label>
                <input
                  className="input text-sm font-mono w-36"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={predNewPriceDisplay}
                  onChange={e => {
                    const s = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                    setPredNewPrice(s);
                    setPredNewPriceDisplay(s === '' ? '' : Number(s).toLocaleString('en-US'));
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') addPredefinedItem(); }}
                />
              </div>
              <button
                onClick={addPredefinedItem}
                disabled={!predNewName.trim() || !predNewPrice}
                className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-pos-primary text-white text-sm font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Plus size={15} /> {t('predef_add_btn')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <Button variant="secondary" onClick={() => { setShowPredefined(false); setEditingId(null); setPredSearch(''); focusSearch(); }}>
            {t('close')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

const ShoppingCartIcon = () => (
  <svg width="48" height="48" fill="none" stroke="#94a3b8" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 01-8 0" />
  </svg>
);
