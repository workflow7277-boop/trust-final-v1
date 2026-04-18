import { useState } from 'react';
import { X, ShoppingBag, Loader2, CheckCircle, User, Phone, MapPin, Navigation } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Database, Product, SubscriberProfile } from '../../lib/types';

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
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const currencySymbol = profile.currency_symbol || 'EGP';
  const totalPrice = adjustedPrice * quantity;

  // دالة تحديد الموقع عبر GPS
  const handleGetLocation = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ar`);
          const data = await res.json();
          setAddress(data.display_name || `Lat: ${latitude}, Lon: ${longitude}`);
        } catch (err) {
          setAddress(`موقع محدد: ${latitude}, ${longitude}`);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setError('تعذر الوصول لموقعك، يرجى تفعيل الـ GPS');
        setLocating(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const orderPayload: Database['public']['Tables']['orders']['Insert'] = {
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

      const { data: order, error: dbError } = await ((supabase
        .from('orders') as any)
        .insert(orderPayload)
        .select()
        .maybeSingle() as any);

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
            await ((supabase.from('orders') as any).update({ webhook_sent: true, status: 'processing' }).eq('id', order.id));
          }
        } catch {
          // Webhook failed, but order was saved
        }
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل إرسال الطلب');
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
          <h3 className="text-xl font-bold text-gray-900 mb-2">تم استلام طلبك!</h3>
          <p className="text-gray-500 text-sm mb-2">
            شكراً لك يا <strong>{name}</strong>! تم تسجيل طلبك لمنتج <strong>{product.name}</strong> بنجاح.
          </p>
          <p className="text-gray-400 text-xs mb-6">سنتواصل معك على رقم {phone} لتأكيد موعد التوصيل.</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-right">
            <div className="flex justify-between text-sm">
              <span className="font-bold text-emerald-600">{totalPrice.toFixed(2)} {currencySymbol}</span>
              <span className="text-gray-500">{quantity}x {product.name}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg"
          >
            متابعة التسوق
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl overflow-hidden flex-shrink-0">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-gray-400" />
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">شراء سريع</p>
              <h3 className="text-sm font-bold text-gray-900 truncate max-w-52">{product.name}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors bg-white p-1.5 rounded-full border border-gray-100">
            <X className="w-4 h-4" />
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
              placeholder="الاسم بالكامل"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="رقم الهاتف"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="relative">
            <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              rows={3}
              placeholder="عنوان التوصيل بالتفصيل"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-12 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
            />
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={locating}
              className="absolute right-3 top-3 p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
              title="تحديد موقعي التلقائي"
            >
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <span className="text-sm text-gray-600 font-medium">الكمية</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-gray-400 transition-all font-bold shadow-sm">
                -
              </button>
              <span className="text-sm font-bold text-gray-900 w-6 text-center">{quantity}</span>
              <button type="button" onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-gray-400 transition-all font-bold shadow-sm">
                +
              </button>
            </div>
          </div>

          <div className="bg-blue-600 rounded-xl p-4 shadow-lg shadow-blue-600/20">
            <div className="flex justify-between items-center text-white">
              <span className="text-xs opacity-80">{quantity} × {adjustedPrice.toFixed(2)} {currencySymbol}</span>
              <div className="text-right">
                <p className="text-[10px] opacity-70 uppercase font-bold tracking-tighter">الإجمالي</p>
                <p className="text-xl font-black">{totalPrice.toFixed(2)} {currencySymbol}</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-[10px]">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all text-sm shadow-xl"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
            {submitting ? 'جاري تأكيد الطلب...' : 'تأكيد الشراء الآن'}
          </button>
        </form>
      </div>
    </div>
  );
}
