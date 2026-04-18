import { useState, useEffect } from 'react';
import { ShoppingBag, Star, Shield, Truck, Package, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, SubscriberProfile } from '../lib/types';
import QuickBuyModal from '../components/storefront/QuickBuyModal';

interface StorefrontPageProps {
  subscriberId: string;
}

export default function StorefrontPage({ subscriberId }: StorefrontPageProps) {
  const [profile, setProfile] = useState<SubscriberProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    const load = async () => {
      const [{ data: profileData }, { data: productsData }] = await Promise.all([
        supabase.from('subscriber_profiles').select('*').eq('id', subscriberId).maybeSingle(),
        supabase.from('products').select('*').eq('subscriber_id', subscriberId).eq('is_active', true).order('created_at', { ascending: false }),
      ]);
      setProfile(profileData);
      setProducts(productsData ?? []);
      setLoading(false);
    };
    load();
  }, [subscriberId]);

  const profitMargin = profile?.profit_margin ?? 0;
  const currencySymbol = profile?.currency_symbol ?? '$';

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const getAdjustedPrice = (originalPrice: number) => originalPrice * (1 + profitMargin / 100);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-gray-200 rounded-xl mx-auto mb-4" />
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center p-8">
        <div>
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Store not found</h2>
          <p className="text-gray-500">This store doesn't exist or has been deactivated.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            {profile.store_logo_url ? (
              <img
                src={profile.store_logo_url}
                alt={profile.store_name}
                className="h-8 w-auto object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="text-base font-bold text-gray-900">{profile.store_name}</span>
          </div>

          <div className="relative flex-1 max-w-md hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-all bg-gray-50"
            />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Shield className="w-3.5 h-3.5" />
              Secure
            </div>
          </div>
        </div>
      </header>

      <section className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-4 py-1.5 text-xs font-medium text-gray-300 mb-6">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              Premium Quality Products
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-4">
              Welcome to<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                {profile.store_name}
              </span>
            </h1>
            <p className="text-gray-400 text-lg mb-8 leading-relaxed">
              Discover our curated collection. Order in seconds with our Quick Buy feature.
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                Fast Delivery
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                Secure Orders
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                Quality Guaranteed
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Our Products</h2>
            <p className="text-sm text-gray-500 mt-0.5">{filteredProducts.length} items available</p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all flex-shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-gray-900 text-white shadow-lg'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:hidden mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-all bg-white"
            />
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProducts.map((product) => {
              const adjustedPrice = getAdjustedPrice(product.original_price);
              return (
                <div
                  key={product.id}
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="relative h-52 bg-gray-100 overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <span className="bg-white/90 backdrop-blur text-gray-600 text-xs px-2.5 py-1 rounded-full font-medium">
                        {product.category}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-sm mb-1 leading-tight">{product.name}</h3>
                    {product.description && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xl font-extrabold text-gray-900">{currencySymbol}{adjustedPrice.toFixed(2)}</p>
                      </div>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-bold py-3 rounded-xl transition-all group-hover:bg-gray-800 active:scale-95"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Quick Buy
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="bg-gray-900 text-gray-500 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gray-600" />
            <span className="text-xs">{profile.store_name} — Powered by Trust</span>
          </div>
          <p className="text-xs">All rights reserved © {new Date().getFullYear()}</p>
        </div>
      </footer>

      {selectedProduct && profile && (
        <QuickBuyModal
          product={selectedProduct}
          profile={profile}
          adjustedPrice={getAdjustedPrice(selectedProduct.original_price)}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
