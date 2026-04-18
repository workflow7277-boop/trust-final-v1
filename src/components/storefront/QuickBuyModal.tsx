import { useState } from 'react';
import { X, ShoppingBag, Loader2, CheckCircle, User, Phone, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Product, SubscriberProfile } from '../../lib/types';

interface QuickBuyModalProps {
  product: Product;
  profile: SubscriberProfile;
  adjustedPrice: number;
  onClose: () => void;
}

export default function QuickBuyModal({ product, profile, adjustedPrice, onClose }: QuickBuyModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const currencySymbol = profile.currency_symbol;
  const totalPrice = adjustedPrice * quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const orderPayload = {
        subscriber_id: profile.id,
        product_id: product.id,
        product_name: product.name,
        customer_name: name,
        customer_phone: phone,
        customer_address: address,
        quantity,
        unit_price: adjustedPrice,
        total_price: totalPrice,
        status: 'pending' as const,
        webhook_sent: false,
      };

      const { data: order, error: dbError } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .maybeSingle();

      if (dbError) throw dbError;

      if (profile.webhook_url) {
        try {
          const webhookPayload = {
            event: 'new_order',
            order_id: order?.id,
            store_name: profile.store_name,
            subscriber_id: profile.id,
            customer: { name, phone, address },
            product: { id: product.id, name: product.name, category: product.category },
            quantity,
            unit_price: adjustedPrice,
            total_price: totalPrice,
            timestamp: new Date().toISOString(),
          };

          const webhookRes = await fetch(profile.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
          });

          if (order && webhookRes.ok) {
            await supabase.from('orders').update({ webhook_sent: true, status: 'processing' }).eq('id', order.id);
          }
        } catch {
          // Webhook failed, but order was saved
        }
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to place order');
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative bg-white rounded-2xl w-full max-w-md p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Order Placed!</h3>
          <p className="text-gray-500 text-sm mb-2">
            Thank you, <strong>{name}</strong>! Your order for <strong>{product.name}</strong> has been received.
          </p>
          <p className="text-gray-400 text-xs mb-6">We'll contact you at {phone} to confirm delivery details.</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{quantity}x {product.name}</span>
              <span className="font-bold text-emerald-600">{currencySymbol}{totalPrice.toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-gray-800 transition-all"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-gray-400" />
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Quick Buy</p>
              <h3 className="text-sm font-bold text-gray-900 truncate max-w-52">{product.name}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Full Name"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-all"
            />
          </div>

          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="Phone Number"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-all"
            />
          </div>

          <div className="relative">
            <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              rows={3}
              placeholder="Delivery Address"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-all resize-none"
            />
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-600 font-medium">Quantity</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-all font-bold">
                -
              </button>
              <span className="text-sm font-bold text-gray-900 w-6 text-center">{quantity}</span>
              <button type="button" onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-all font-bold">
                +
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{quantity} × {currencySymbol}{adjustedPrice.toFixed(2)}</span>
              <span className="text-xl font-bold text-gray-900">{currencySymbol}{totalPrice.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all text-sm"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
            {submitting ? 'Placing Order...' : `Place Order · ${currencySymbol}${totalPrice.toFixed(2)}`}
          </button>
        </form>
      </div>
    </div>
  );
}
