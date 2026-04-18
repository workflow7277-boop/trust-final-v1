import { useState, useEffect, useCallback } from 'react';
import { Plus, Package, Loader2, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, SubscriberProfile } from '../lib/types';
import Header from '../components/dashboard/Header';
import ProductCard from '../components/products/ProductCard';
import ProductModal from '../components/products/ProductModal';

interface ProductsPageProps {
  profile: SubscriberProfile | null;
  userId: string;
  userEmail: string;
}

export default function ProductsPage({ profile, userId, userEmail }: ProductsPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'hidden'>('all');

  const profitMargin = profile?.profit_margin ?? 0;

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('subscriber_id', userId)
      .order('created_at', { ascending: false });
    setProducts(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleSave = async (data: Partial<Product>) => {
    if (editingProduct) {
      const { error } = await supabase.from('products').update(data).eq('id', editingProduct.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('products').insert({ ...data, subscriber_id: userId } as Product);
      if (error) throw error;
    }
    await loadProducts();
    setEditingProduct(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    await supabase.from('products').delete().eq('id', id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await supabase.from('products').update({ is_active: active }).eq('id', id);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: active } : p)));
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filterActive === 'all' ||
      (filterActive === 'active' && p.is_active) ||
      (filterActive === 'hidden' && !p.is_active);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Products" subtitle={`${products.length} products · ${profitMargin}% margin applied`} userEmail={userEmail} />

      <div className="flex-1 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-[#111827] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-all"
              />
            </div>
            <div className="flex items-center gap-1 bg-[#111827] border border-white/10 rounded-xl p-1">
              {(['all', 'active', 'hidden'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterActive(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
                    filterActive === f
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-slate-700" />
            </div>
            <p className="text-slate-400 font-medium mb-1">
              {search ? 'No products match your search' : 'No products yet'}
            </p>
            <p className="text-slate-600 text-sm mb-6">
              {search ? 'Try a different search term' : 'Add your first product to start selling'}
            </p>
            {!search && (
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
              >
                <Plus className="w-4 h-4" />
                Add First Product
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-xs text-slate-600">{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  profitMargin={profitMargin}
                  currencySymbol={profile?.currency_symbol ?? '$'}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <ProductModal
          product={editingProduct}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingProduct(null); }}
        />
      )}
    </div>
  );
}
