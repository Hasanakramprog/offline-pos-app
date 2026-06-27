import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus, Search, Edit2, Trash2, X, ImagePlus, Image, Check,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, SlidersHorizontal,
} from 'lucide-react';
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories, createCategory } from '../services/products';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from '../store/toastStore';
import { formatLBP, formatUSD, lbpToUsd } from '../utils/formatters';
import { Button } from '../components/Common/Button';
import { Modal } from '../components/Common/Modal';
import { ImageLightbox } from '../components/Common/ImageLightbox';
import { useLang } from '../i18n/LangContext';
import type { Product, Category } from '../types';

const emptyForm = { name:'', description:'', barcode:'', sku:'', category_id:'', price_lbp:'', image_url:'', is_active: 1 };
const PAGE_SIZES = [10, 25, 50];

type SortKey = 'name' | 'price_lbp' | 'category_name' | 'is_active';
type SortDir = 'asc' | 'desc';

export const InventoryPage: React.FC = () => {
  // ── Data ────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { t } = useLang();
  const { settings } = useSettingsStore();
  const rate = settings?.usd_to_lbp_rate || 89500;

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ── Sort ─────────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Pagination ───────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Modal / form ─────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [priceLbpDisplay, setPriceLbpDisplay] = useState('');
  const [priceUsdDisplay, setPriceUsdDisplay] = useState('');
  const [imageDragging, setImageDragging] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<{ src: string; alt: string } | null>(null);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newCatInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const formatPrice = (raw: string) =>
    raw === '' ? '' : Number(raw).toLocaleString('en-US');

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
    setPriceLbpDisplay(stripped === '' ? '' : Number(stripped).toLocaleString('en-US'));
    f('price_lbp', stripped);
    const lbpVal = Number(stripped) || 0;
    setPriceUsdDisplay(stripped === '' ? '' : (lbpVal / rate).toFixed(2));
  };

  const handlePriceUsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = e.target.value.replace(/[^0-9.]/g, '');
    setPriceUsdDisplay(stripped);
    const usdVal = parseFloat(stripped) || 0;
    const lbpVal = Math.round(usdVal * rate);
    setPriceLbpDisplay(stripped === '' ? '' : lbpVal.toLocaleString('en-US'));
    f('price_lbp', stripped === '' ? '' : lbpVal);
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be smaller than 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = (e) => f('image_url', e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setImageDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  const f = (k: string, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const [p, c] = await Promise.all([getProducts(false), getCategories()]);
    setProducts(p); setCategories(c);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── New category ──────────────────────────────────────────────────────────
  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    setSavingCat(true);
    try {
      const id = crypto.randomUUID();
      await createCategory(id, name);
      const updated = await getCategories();
      setCategories(updated);
      f('category_id', id);
      setNewCatName(''); setAddingCat(false);
      toast.success(`Category "${name}" created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create category');
    } finally { setSavingCat(false); }
  };

  // ── Filtering + Sorting + Pagination ─────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...products] as (Product & { category_name?: string })[];

    // text search: name, barcode, sku, description
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.category_name ?? '').toLowerCase().includes(q)
      );
    }
    // category filter
    if (filterCategory) list = list.filter(p => p.category_id === filterCategory);
    // status filter
    if (filterStatus === 'active')   list = list.filter(p => p.is_active);
    if (filterStatus === 'inactive') list = list.filter(p => !p.is_active);
    // price range
    const pMin = Number(filterPriceMin) || 0;
    const pMax = Number(filterPriceMax) || Infinity;
    if (filterPriceMin || filterPriceMax)
      list = list.filter(p => p.price_lbp >= pMin && p.price_lbp <= pMax);

    // sort
    list.sort((a, b) => {
      let va: string | number = '', vb: string | number = '';
      if (sortKey === 'name')          { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      if (sortKey === 'price_lbp')     { va = a.price_lbp; vb = b.price_lbp; }
      if (sortKey === 'category_name') { va = (a.category_name ?? '').toLowerCase(); vb = (b.category_name ?? '').toLowerCase(); }
      if (sortKey === 'is_active')     { va = a.is_active; vb = b.is_active; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

    return list;
  }, [products, search, filterCategory, filterStatus, filterPriceMin, filterPriceMax, sortKey, sortDir]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [search, filterCategory, filterStatus, filterPriceMin, filterPriceMax]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * pageSize;
  const pageRows   = filtered.slice(pageStart, pageStart + pageSize);

  // ── Sort helper ───────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? (sortDir === 'asc' ? <ChevronUp size={13} className="inline ml-0.5 text-pos-primary" /> : <ChevronDown size={13} className="inline ml-0.5 text-pos-primary" />)
      : <ChevronUp size={13} className="inline ml-0.5 opacity-20" />;

  // ── Active filter count ────────────────────────────────────────────────────
  const activeFilters = [filterCategory, filterStatus !== 'all' ? filterStatus : '', filterPriceMin, filterPriceMax]
    .filter(Boolean).length;

  const clearFilters = () => {
    setSearch(''); setFilterCategory(''); setFilterStatus('all');
    setFilterPriceMin(''); setFilterPriceMax('');
  };

  // ── Modal openers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null); setForm(emptyForm); setPriceLbpDisplay(''); setPriceUsdDisplay('');
    setAddingCat(false); setNewCatName(''); setModalOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? '', barcode: p.barcode ?? '',
              sku: p.sku ?? '', category_id: p.category_id ?? '',
              price_lbp: String(p.price_lbp), image_url: p.image_url ?? '', is_active: p.is_active });
    setPriceLbpDisplay(formatPrice(String(Math.round(p.price_lbp))));
    setPriceUsdDisplay((p.price_lbp / rate).toFixed(2));
    setAddingCat(false); setNewCatName(''); setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.price_lbp || isNaN(Number(form.price_lbp))) { toast.error('Valid price required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateProduct(editing.id, {
          name: form.name, description: form.description || undefined,
          barcode: form.barcode || undefined, sku: form.sku || undefined,
          category_id: form.category_id || undefined, price_lbp: Number(form.price_lbp),
          image_url: form.image_url || undefined, is_active: form.is_active,
        });
        toast.success('Product updated');
      } else {
        await createProduct({
          id: crypto.randomUUID(), name: form.name, description: form.description || undefined,
          barcode: form.barcode || undefined, sku: form.sku || undefined,
          category_id: form.category_id || undefined, price_lbp: Number(form.price_lbp),
          image_url: form.image_url || undefined, is_active: 1,
        });
        toast.success('Product created');
      }
      setModalOpen(false); load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const confirmDeleteProduct = async () => {
    if (!confirmDelete) return;
    await deleteProduct(confirmDelete.id);
    toast.success('Product deleted');
    setConfirmDelete(null); load();
  };

  // ── Pagination buttons ────────────────────────────────────────────────────
  const pageButtons = (): (number | '…')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '…')[] = [1];
    if (safePage > 3) pages.push('…');
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="p-6 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('inventory_title')}</h1>
          <p className="text-pos-muted text-sm mt-1">
            {filtered.length} {t('of')} {products.length} {t('total_products')}
            {activeFilters > 0 && <span className="ms-1 text-pos-primary font-medium">({t('filtered')})</span>}
          </p>
        </div>
        <Button icon={<Plus size={18} />} onClick={openAdd}>{t('add_product')}</Button>
      </div>

      {/* ── Search + Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-pos-muted" />
          <input
            className="input pl-9 pr-8"
            placeholder={t('search_products_ph')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-pos-muted hover:text-pos-text">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category quick-filter */}
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="input w-44 text-sm"
        >
          <option value="">{t('all_categories')}</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Status toggle pills */}
        <div className="flex rounded-lg overflow-hidden border border-pos-border text-xs font-medium">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 capitalize transition-colors ${filterStatus === s
                ? 'bg-pos-primary text-white'
                : 'text-pos-muted hover:bg-pos-border/40'}`}>
              {t(s === 'all' ? 'status_all' : s === 'active' ? 'status_active' : 'status_inactive')}
            </button>
          ))}
        </div>

        {/* Advanced filters toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors
            ${showFilters || filterPriceMin || filterPriceMax
              ? 'border-pos-primary text-pos-primary bg-pos-primary/10'
              : 'border-pos-border text-pos-muted hover:bg-pos-border/30'}`}>
          <SlidersHorizontal size={14} />
          {t('price_filter')}
          {(filterPriceMin || filterPriceMax) && (
            <span className="ml-0.5 w-4 h-4 rounded-full bg-pos-primary text-white text-[10px] flex items-center justify-center">!</span>
          )}
        </button>

        {/* Clear all */}
        {(activeFilters > 0 || search) && (
          <button onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-pos-danger hover:brightness-110 transition-colors px-2 py-2">
            <X size={12} /> {t('clear_all')}
          </button>
        )}
      </div>

      {/* ── Price range (collapsible) ── */}
      {showFilters && (
        <div className="flex items-center gap-3 bg-pos-surface border border-pos-border rounded-xl px-4 py-3">
          <span className="text-xs font-medium text-pos-muted whitespace-nowrap">{t('price_ll')}</span>
          <input
            type="number" min="0" placeholder="Min"
            value={filterPriceMin}
            onChange={e => setFilterPriceMin(e.target.value)}
            className="input w-32 text-sm"
          />
          <span className="text-pos-muted text-sm">—</span>
          <input
            type="number" min="0" placeholder="Max"
            value={filterPriceMax}
            onChange={e => setFilterPriceMax(e.target.value)}
            className="input w-32 text-sm"
          />
          {(filterPriceMin || filterPriceMax) && (
            <button onClick={() => { setFilterPriceMin(''); setFilterPriceMax(''); }}
              className="text-pos-muted hover:text-pos-danger transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* ── Active filter chips ── */}
      {activeFilters > 0 && (
        <div className="flex flex-wrap gap-2">
          {filterCategory && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-pos-primary/15 text-pos-primary text-xs font-medium">
              {categories.find(c => c.id === filterCategory)?.name}
              <button onClick={() => setFilterCategory('')}><X size={11} /></button>
            </span>
          )}
          {filterStatus !== 'all' && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-pos-primary/15 text-pos-primary text-xs font-medium capitalize">
              {t(filterStatus === 'active' ? 'status_active' : 'status_inactive')}
              <button onClick={() => setFilterStatus('all')}><X size={11} /></button>
            </span>
          )}
          {(filterPriceMin || filterPriceMax) && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-pos-primary/15 text-pos-primary text-xs font-medium">
              LL {filterPriceMin || '0'} – {filterPriceMax || '∞'}
              <button onClick={() => { setFilterPriceMin(''); setFilterPriceMax(''); }}><X size={11} /></button>
            </span>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pos-border text-pos-muted text-left bg-pos-bg/50">
              <th className="pl-4 py-3 w-10" />
              {/* Sortable: Name */}
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-pos-text transition-colors"
                  onClick={() => handleSort('name')}>
                {t('col_name')} <SortIcon col="name" />
              </th>
              <th className="px-4 py-3 font-medium">{t('col_barcode_sku')}</th>
              {/* Sortable: Category */}
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-pos-text transition-colors"
                  onClick={() => handleSort('category_name')}>
                {t('col_category')} <SortIcon col="category_name" />
              </th>
              {/* Sortable: Price */}
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-pos-text transition-colors"
                  onClick={() => handleSort('price_lbp')}>
                {t('price_ll')} <SortIcon col="price_lbp" />
              </th>
              {/* Sortable: Status */}
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-pos-text transition-colors"
                  onClick={() => handleSort('is_active')}>
                {t('col_status')} <SortIcon col="is_active" />
              </th>
              <th className="px-4 py-3 font-medium">{t('col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-pos-muted">
                  <div className="flex flex-col items-center gap-2">
                    <Search size={32} className="opacity-20" />
                    <p className="text-sm">{t('no_products_match')}</p>
                    {(activeFilters > 0 || search) && (
                      <button onClick={clearFilters}
                        className="text-xs text-pos-primary hover:brightness-110 mt-1 transition-colors">
                        {t('clear_filters')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : pageRows.map(p => (
              <tr key={p.id}
                  className="border-b border-pos-border/50 hover:bg-pos-border/20 transition-colors">
                {/* Thumbnail */}
                <td className="pl-4 py-2 w-10">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name}
                      onClick={() => setLightboxImg({ src: p.image_url!, alt: p.name })}
                      className="w-9 h-9 rounded-lg object-cover border border-pos-border cursor-zoom-in hover:ring-2 hover:ring-pos-primary transition-all" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-pos-border/40 flex items-center justify-center text-pos-muted">
                      <Image size={14} />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium max-w-[200px]">
                  <p className="truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-pos-muted truncate mt-0.5">{p.description}</p>}
                </td>
                <td className="px-4 py-3 text-pos-muted font-mono text-xs">
                  {p.barcode && <span className="block">{p.barcode}</span>}
                  {p.sku    && <span className="block opacity-70">{p.sku}</span>}
                  {!p.barcode && !p.sku && '—'}
                </td>
                <td className="px-4 py-3 text-pos-muted">
                  {(p as Product & { category_name?: string }).category_name || '—'}
                </td>
                <td className="px-4 py-3 font-semibold text-pos-success">{formatLBP(p.price_lbp)}</td>
                <td className="px-4 py-3">
                  <span className={p.is_active ? 'badge-green' : 'badge-red'}>
                    {p.is_active ? t('badge_active') : t('badge_inactive')}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => openEdit(p)}
                    className="p-1.5 rounded-lg hover:bg-pos-border text-pos-muted hover:text-pos-text transition-colors">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => setConfirmDelete(p)}
                    className="p-1.5 rounded-lg hover:bg-pos-danger/10 text-pos-muted hover:text-pos-danger transition-colors">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Pagination bar ── */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-pos-border bg-pos-bg/30 flex-wrap gap-2">
            {/* Row count info */}
            <p className="text-xs text-pos-muted">
              {t('showing')} <span className="font-semibold text-pos-text">{pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)}</span>{' '}
              {t('of')} <span className="font-semibold text-pos-text">{filtered.length}</span> {t('total_products')}
            </p>

            {/* Page buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-pos-border text-pos-muted hover:bg-pos-border/40 disabled:opacity-30 transition-colors">
                <ChevronLeft size={14} />
              </button>

              {pageButtons().map((pg, i) =>
                pg === '…' ? (
                  <span key={`ellipsis-${i}`} className="w-8 text-center text-pos-muted text-sm">…</span>
                ) : (
                  <button
                    key={pg}
                    onClick={() => setPage(pg as number)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors
                      ${safePage === pg
                        ? 'bg-pos-primary text-white shadow-sm'
                        : 'border border-pos-border text-pos-muted hover:bg-pos-border/40'}`}>
                    {pg}
                  </button>
                )
              )}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-pos-border text-pos-muted hover:bg-pos-border/40 disabled:opacity-30 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Page size selector */}
            <div className="flex items-center gap-2 text-xs text-pos-muted">
              <span>{t('rows')}</span>
              <div className="flex rounded-lg overflow-hidden border border-pos-border">
                {PAGE_SIZES.map(s => (
                  <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
                    className={`px-2.5 py-1.5 transition-colors ${pageSize === s
                      ? 'bg-pos-primary text-white font-medium'
                      : 'hover:bg-pos-border/40'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Product Form Modal ── */}
      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? t('edit_product') : t('add_product_modal')} size="md"
        closeOnBackdrop={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('cancel_btn')}</Button>
            <Button loading={saving} onClick={handleSave}>{editing ? t('save_changes') : t('create_product')}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* Image upload */}
          <div>
            <label className="text-sm text-pos-muted block mb-1">{t('product_image')}</label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
            {form.image_url ? (
              <div className="relative w-full h-36 rounded-xl overflow-hidden border border-pos-border group">
                <img src={form.image_url} alt="Product preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-colors">
                    {t('change_img')}
                  </button>
                  <button type="button" onClick={() => f('image_url', '')}
                    className="px-3 py-1.5 text-xs font-medium bg-pos-danger/80 text-white rounded-lg hover:bg-pos-danger transition-colors">
                    {t('remove_img')}
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setImageDragging(true); }}
                onDragLeave={() => setImageDragging(false)}
                onDrop={handleDrop}
                className={`w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all
                  ${imageDragging ? 'border-blue-500 bg-blue-500/10' : 'border-pos-border hover:border-pos-muted hover:bg-pos-border/20'}`}>
                <ImagePlus size={22} className="text-pos-muted" />
                <span className="text-xs text-pos-muted">{t('upload_hint')}</span>
                <span className="text-xs text-pos-muted/60">{t('upload_types')}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-sm text-pos-muted block mb-1">{t('field_name')}</label>
              <input className="input" placeholder={t('product_name_ph')} value={form.name} onChange={e => f('name', e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-pos-muted block mb-1">{t('field_price')} (LL)</label>
              <input className="input font-mono" type="text" inputMode="numeric"
                placeholder="e.g. 250,000" value={priceLbpDisplay} onChange={handlePriceChange} />
            </div>
            <div>
              <label className="text-sm text-pos-muted block mb-1">Price (USD)</label>
              <input className="input font-mono" type="text" inputMode="decimal"
                placeholder="e.g. 2.50" value={priceUsdDisplay} onChange={handlePriceUsdChange} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              {/* Category + inline add */}
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-pos-muted">{t('field_category')}</label>
                {!addingCat && (
                  <button type="button"
                    onClick={() => { setAddingCat(true); setTimeout(() => newCatInputRef.current?.focus(), 50); }}
                    className="flex items-center gap-1 text-xs text-pos-primary hover:brightness-110 transition-colors">
                    <Plus size={12} /> {t('new_category')}
                  </button>
                )}
              </div>
              {addingCat ? (
                <div className="flex gap-1.5">
                  <input ref={newCatInputRef} className="input flex-1 text-sm" placeholder={t('category_name_ph')}
                    value={newCatName} onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); }
                      if (e.key === 'Escape') { setAddingCat(false); setNewCatName(''); }
                    }}
                    disabled={savingCat} />
                  <button type="button" onClick={handleAddCategory}
                    disabled={savingCat || !newCatName.trim()}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-pos-success text-white hover:brightness-110 disabled:opacity-50 transition-all flex-shrink-0">
                    <Check size={15} />
                  </button>
                  <button type="button" onClick={() => { setAddingCat(false); setNewCatName(''); }}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-pos-border text-pos-muted hover:text-pos-text transition-all flex-shrink-0">
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <select className="input" value={form.category_id} onChange={e => f('category_id', e.target.value)}>
                  <option value="">{t('no_category')}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="text-sm text-pos-muted block mb-1">{t('field_barcode')}</label>
              <input className="input font-mono" placeholder="EAN / QR" value={form.barcode} onChange={e => f('barcode', e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-sm text-pos-muted block mb-1">{t('field_sku')}</label>
              <input className="input font-mono" placeholder="SKU" value={form.sku} onChange={e => f('sku', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-pos-muted block mb-1">{t('field_description')}</label>
              <textarea className="input resize-none" rows={2} placeholder={t('desc_ph')}
                value={form.description} onChange={e => f('description', e.target.value)} />
            </div>
            {editing && (
              <div className="col-span-2 flex items-center gap-3">
                <label className="text-sm text-pos-muted">{t('field_status')}</label>
                <button onClick={() => f('is_active', form.is_active ? 0 : 1)}
                  className={`w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-pos-success' : 'bg-pos-border'}`}>
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${form.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm">{form.is_active ? t('badge_active') : t('badge_inactive')}</span>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Image Lightbox */}
      {lightboxImg && (
        <ImageLightbox src={lightboxImg.src} alt={lightboxImg.alt} onClose={() => setLightboxImg(null)} />
      )}

      {/* Delete Confirmation Modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={t('delete_product')} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>{t('cancel_btn')}</Button>
            <Button onClick={confirmDeleteProduct} className="bg-pos-danger hover:brightness-110">{t('delete_btn')}</Button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-sm text-pos-muted">
            {t('delete_confirm')}{' '}
            <span className="font-semibold text-pos-text">"{confirmDelete?.name}"</span>?
          </p>
          <p className="text-xs text-pos-warning bg-pos-warning/10 border border-pos-warning/20 rounded-lg px-3 py-2">
            {t('delete_warning')}
          </p>
        </div>
      </Modal>
    </div>
  );
};
