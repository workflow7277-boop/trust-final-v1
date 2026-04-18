import { useState, useEffect } from 'react';
import { Settings, Save, Loader2, CheckCircle, Upload, Zap, Key, Globe, Percent, Store, DollarSign, Truck, MessageCircle, Palette } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SubscriberProfile } from '../lib/types';
import Header from '../components/dashboard/Header';

interface SettingsPageProps {
  profile: SubscriberProfile | null;
  userId: string;
  userEmail: string;
  onProfileUpdate: (profile: SubscriberProfile) => void;
}

export default function SettingsPage({ profile, userId, userEmail, onProfileUpdate }: SettingsPageProps) {
  // الحقول القديمة
  const [storeName, setStoreName] = useState('');
  const [storeLogoUrl, setStoreLogoUrl] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('EGP');
  const [profitMargin, setProfitMargin] = useState('0');
  const [platformApiKey, setPlatformApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  
  // الحقول الجديدة (تمت إضافتها بدقة)
  const [shippingFee, setShippingFee] = useState('0');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('0');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [brandColor, setBrandColor] = useState('#2563eb');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setStoreName(profile.store_name || '');
      setStoreLogoUrl(profile.store_logo_url || '');
      setCurrencySymbol(profile.currency_symbol || 'EGP');
      setProfitMargin(profile.profit_margin?.toString() || '0');
      setPlatformApiKey(profile.platform_api_key || '');
      setWebhookUrl(profile.webhook_url || '');
      // تحميل القيم الجديدة من البروفايل
      setShippingFee(profile.shipping_fee?.toString() || '0');
      setFreeShippingThreshold(profile.free_shipping_threshold?.toString() || '0');
      setWhatsappNumber(profile.whatsapp_number || '');
      setBrandColor(profile.brand_color || '#2563eb');
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const updates = {
        id: userId,
        store_name: storeName,
        store_logo_url: storeLogoUrl,
        currency_symbol: currencySymbol,
        profit_margin: parseFloat(profitMargin) || 0,
        platform_api_key: platformApiKey,
        webhook_url: webhookUrl,
        // حفظ الحقول الجديدة
        shipping_fee: parseFloat(shippingFee) || 0,
        free_shipping_threshold: parseFloat(freeShippingThreshold) || 0,
        whatsapp_number: whatsappNumber,
        brand_color: brandColor,
      };

      const { data, error: upsertError } = await supabase
        .from('subscriber_profiles')
        .upsert(updates)
        .select()
        .maybeSingle();

      if (upsertError) throw upsertError;
      if (data) onProfileUpdate(data);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const marginPreview = parseFloat(profitMargin) || 0;
  const exampleOriginal = 100;
  const exampleAdjusted = exampleOriginal * (1 + marginPreview / 100);

  return (
    <div className="flex flex-col min-h-full bg-[#030712]">
      <Header title="إعدادات المتجر" subtitle="تحكم كامل في هوية وعمليات متجرك" userEmail={userEmail} />

      <div className="flex-1 p-6">
        <form onSubmit={handleSave} className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
          
          {/* هوية المتجر والبراند */}
          <div className="bg-[#111827] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                <Palette className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-sm font-semibold text-white">الهوية البصرية</h2>
            </div>
            
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-2 uppercase tracking-wider">اسم المتجر</label>
              <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} required className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500/50 outline-none" />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-2 uppercase tracking-wider">لون المتجر الأساسي</label>
              <div className="flex gap-2">
                <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-11 w-16 bg-[#0a0f1e] border border-white/10 rounded-xl p-1 cursor-pointer" />
                <input type="text" value={brandColor} readOnly className="flex-1 bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono" />
              </div>
            </div>
          </div>

          {/* محرك الأرباح والعملة */}
          <div className="bg-[#111827] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                <Percent className="w-4 h-4 text-emerald-400" />
              </div>
              <h2 className="text-sm font-semibold text-white">التسعير والعملة</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-2 uppercase">العملة</label>
                <select value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none appearance-none">
                  <option value="EGP">EGP</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                  <option value="$">USD</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-2 uppercase">نسبة الربح %</label>
                <input type="number" value={profitMargin} onChange={(e) => setProfitMargin(e.target.value)} className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none" />
              </div>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
               <p className="text-[10px] text-emerald-400/70 mb-1 uppercase">مثال للسعر</p>
               <div className="flex justify-between items-center">
                 <span className="text-xs text-slate-400">100 {currencySymbol} أصلي</span>
                 <span className="text-sm font-bold text-emerald-400">← {exampleAdjusted.toFixed(2)} {currencySymbol}</span>
               </div>
            </div>
          </div>

          {/* الشحن والتوصيل */}
          <div className="bg-[#111827] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
                <Truck className="w-4 h-4 text-orange-400" />
              </div>
              <h2 className="text-sm font-semibold text-white">سياسة الشحن</h2>
            </div>
            
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-2 uppercase">رسوم الشحن</label>
              <input type="number" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-2 uppercase">شحن مجاني عند الطلب بـ أكثر من</label>
              <input type="number" value={freeShippingThreshold} onChange={(e) => setFreeShippingThreshold(e.target.value)} className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none" />
            </div>
          </div>

          {/* التواصل والأتمتة */}
          <div className="bg-[#111827] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-green-400" />
              </div>
              <h2 className="text-sm font-semibold text-white">التواصل والربط</h2>
            </div>
            
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-2 uppercase tracking-wider">رقم واتساب الطلبات</label>
              <input type="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="مثال: 2010650XXXXX" className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none font-mono" />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-3 h-3 text-amber-400" /> n8n Webhook URL
              </label>
              <input type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://..." className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white text-[10px] font-mono outline-none" />
            </div>
          </div>

          {/* زر الحفظ العائم أو السفلي */}
          <div className="md:col-span-2 flex items-center justify-between bg-blue-600/5 border border-blue-600/10 rounded-2xl p-4 mt-4">
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-10 py-4 rounded-xl transition-all shadow-xl shadow-blue-600/20 text-sm flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'جاري الحفظ...' : 'تأكيد وحفظ الإعدادات'}
              </button>

              {saved && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" /> تم التحديث بنجاح!
                </div>
              )}
            </div>
            {error && <p className="text-red-400 text-xs font-medium">{error}</p>}
          </div>
        </form>
      </div>
    </div>
  );
}
