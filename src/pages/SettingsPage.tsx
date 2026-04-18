import { useState, useEffect } from 'react';
import { Settings, Save, Loader2, CheckCircle, Upload, Zap, Key, Globe, Percent, Store, DollarSign } from 'lucide-react';
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
  const [storeName, setStoreName] = useState('');
  const [storeLogoUrl, setStoreLogoUrl] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('EGP');
  const [profitMargin, setProfitMargin] = useState('0');
  const [platformApiKey, setPlatformApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
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
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const marginPreview = parseFloat(profitMargin) || 0;
  const exampleOriginal = 100;
  const exampleAdjusted = exampleOriginal * (1 + marginPreview / 100);

  return (
    <div className="flex flex-col min-h-full">
      <Header title="إعدادات المتجر" subtitle="قم بتخصيص هوية متجرك وأدوات الأتمتة" userEmail={userEmail} />

      <div className="flex-1 p-6">
        <form onSubmit={handleSave} className="max-w-3xl space-y-6">
          {/* Store Identity Section */}
          <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                <Store className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">هوية المتجر</h2>
                <p className="text-xs text-slate-500">المعلومات التي ستظهر لعملائك</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">اسم المتجر (Brand Name)</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  placeholder="مثال: Trust Store"
                  className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">العملة الافتراضية</label>
                <div className="flex gap-3">
                  <select
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    className="flex-1 bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all text-sm appearance-none"
                  >
                    <option value="EGP">EGP (جنيه مصري)</option>
                    <option value="SAR">SAR (ريال سعودي)</option>
                    <option value="AED">AED (درهم إماراتي)</option>
                    <option value="$">$ (دولار أمريكي)</option>
                    <option value="€">€ (يورو)</option>
                  </select>
                  <div className="w-12 h-12 bg-[#0a0f1e] border border-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-white">{currencySymbol}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Profit Engine */}
          <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                <Percent className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">محرك تسعير الأرباح</h2>
                <p className="text-xs text-slate-500">زيادة تلقائية على أسعار المنتجات الأصلية</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">نسبة الربح (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={profitMargin}
                    onChange={(e) => setProfitMargin(e.target.value)}
                    min="0"
                    placeholder="20"
                    className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">%</span>
                </div>
              </div>

              <div className="bg-[#0a0f1e] border border-emerald-500/20 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wider">معاينة حية للسعر</p>
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-600 mb-1">السعر الأصلي</p>
                    <p className="text-lg font-bold text-slate-400">{exampleOriginal.toFixed(2)} {currencySymbol}</p>
                  </div>
                  <div className="text-slate-600">→</div>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-600 mb-1">سعر البيع للعميل</p>
                    <p className="text-lg font-bold text-emerald-400">{exampleAdjusted.toFixed(2)} {currencySymbol}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Automation Section */}
          <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">مركز الأتمتة (n8n + Webhooks)</h2>
                <p className="text-xs text-slate-500">ربط المتجر بنظام الدروب شيبينغ الآلي</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">n8n Webhook URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-n8n-instance.com/webhook/..."
                  className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات بنجاح'}
            </button>

            {saved && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium animate-bounce">
                <CheckCircle className="w-4 h-4" /> تم الحفظ!
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
