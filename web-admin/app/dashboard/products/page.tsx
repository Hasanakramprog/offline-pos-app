'use client';
import { useEffect, useState } from 'react';
import { getProducts } from '@/lib/queries';
import type { Product } from '@/lib/queries';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    getProducts().then(data => { setProducts(data); setLoading(false); });
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode ?? '').includes(search) ||
    (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Products</h1>
        <p className="text-sm text-gray-400 mt-0.5">{products.length} products in catalog</p>
      </div>

      <input
        type="text"
        placeholder="Search name, barcode, SKU…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400 animate-pulse">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-500">No products found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-800">
                <tr className="text-xs text-gray-400 uppercase tracking-wide whitespace-nowrap">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Barcode / SKU</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-right px-4 py-3">Price (LL)</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/40 whitespace-nowrap">
                  <td className="px-4 py-3 text-sm text-white font-medium">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {p.barcode ?? p.sku ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{p.category_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-white">{fmt(p.price_lbp)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.is_active
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-gray-700 text-gray-500'
                    }`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
