import { Package, Pencil, Trash2, Eye, EyeOff, Tag } from 'lucide-react';
import type { Product } from '../../lib/types';

interface ProductCardProps {
  product: Product;
  profitMargin: number;
  currencySymbol: string;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}

export default function ProductCard({ product, profitMargin, currencySymbol, onEdit, onDelete, onToggleActive }: ProductCardProps) {
  const adjustedPrice = product.original_price * (1 + profitMargin / 100);
  const profit = adjustedPrice - product.original_price;

  return (
    <div className={`bg-[#111827] border rounded-2xl overflow-hidden group transition-all hover:border-white/15 ${
      product.is_active ? 'border-white/5' : 'border-white/5 opacity-60'
    }`}>
      <div className="relative h-44 bg-[#0a0f1e] overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 text-slate-700" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="bg-[#0a0f1e]/80 backdrop-blur border border-white/10 text-slate-400 text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {product.category}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            product.is_active
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-800 text-slate-500 border border-white/10'
          }`}>
            {product.is_active ? 'Active' : 'Hidden'}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-sm font-semibold text-white mb-1 truncate">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-slate-500 mb-3 line-clamp-2">{product.description}</p>
        )}

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-slate-600 line-through">{currencySymbol}{product.original_price.toFixed(2)}</p>
            <p className="text-lg font-bold text-emerald-400">{currencySymbol}{adjustedPrice.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-600">Profit</p>
            <p className="text-sm font-semibold text-blue-400">+{currencySymbol}{profit.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(product)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium py-2 rounded-xl transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={() => onToggleActive(product.id, !product.is_active)}
            className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-xl transition-all"
          >
            {product.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
