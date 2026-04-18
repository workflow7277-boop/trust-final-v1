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
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [profitMargin, setProfitMargin] = useState('0');
  const [platformApiKey, setPlatformApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setStoreName(profile.store_name);
      setStoreLogoUrl(profile.store_logo_url);
      setCurrencySymbol(profile.currency_symbol);
      setProfitMargin(profile.profit_margin.toString());
      setPlatformApiKey(profile.platform_api_key);
      setWebhookUrl(profile.webhook_url);
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
      <Header title="Store Settings" subtitle="Configure your store and integrations" userEmail={userEmail} />

      <div className="flex-1 p-6">
        <form onSubmit={handleSave} className="max-w-3xl space-y-6">
          <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                <Store className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Store Identity</h2>
                <p className="text-xs text-slate-500">Your store's public-facing information</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Store Name</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  placeholder="My Awesome Store"
                  className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><Upload className="w-3 h-3" /> Store Logo URL</span>
                </label>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={storeLogoUrl}
                    onChange={(e) => setStoreLogoUrl(e.target.value)}
                    placeholder="https://your-cdn.com/logo.png"
                    className="flex-1 bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all text-sm"
                  />
                  {storeLogoUrl && (
                    <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl overflow-hidden flex-shrink-0">
                      <img
                        src={storeLogoUrl}
                        alt="logo preview"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><DollarSign className="w-3 h-3" /> Currency Symbol</span>
                </label>
                <div className="flex gap-3">
                  <select
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    className="flex-1 bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all text-sm appearance-none"
                  >
                    <option value="$">$ (US Dollar)</option>
                    <option value="€">€ (Euro)</option>
                    <option value="£">£ (British Pound)</option>
                    <option value="¥">¥ (Japanese Yen)</option>
                    <option value="₹">₹ (Indian Rupee)</option>
                    <option value="₽">₽ (Russian Ruble)</option>
                    <option value="₩">₩ (South Korean Won)</option>
                    <option value="¢">¢ (Cent)</option>
                    <option value="CHF">CHF (Swiss Franc)</option>
                    <option value="AUD">AUD (Australian Dollar)</option>
                    <option value="CAD">CAD (Canadian Dollar)</option>
                    <option value="SGD">SGD (Singapore Dollar)</option>
                    <option value="HKD">HKD (Hong Kong Dollar)</option>
                    <option value="NZD">NZD (New Zealand Dollar)</option>
                    <option value="SEK">SEK (Swedish Krona)</option>
                    <option value="NOK">NOK (Norwegian Krone)</option>
                    <option value="DKK">DKK (Danish Krone)</option>
                    <option value="PLN">PLN (Polish Zloty)</option>
                  </select>
                  <div className="w-12 h-12 bg-[#0a0f1e] border border-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-semibold text-white">{currencySymbol}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                <Percent className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Profit Margin Engine</h2>
                <p className="text-xs text-slate-500">Automatically adjusts all product prices</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Margin Percentage (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={profitMargin}
                    onChange={(e) => setProfitMargin(e.target.value)}
                    min="0"
                    max="1000"
                    step="0.5"
                    placeholder="20"
                    className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">%</span>
                </div>
              </div>

              <div className="bg-[#0a0f1e] border border-emerald-500/20 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wider">Live Preview</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-slate-600 mb-1">Original Price</p>
                    <p className="text-lg font-bold text-slate-400">{currencySymbol}{exampleOriginal.toFixed(2)}</p>
                  </div>
                  <div className="text-slate-600">→</div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-600 mb-1">After Margin ({marginPreview}%)</p>
                    <p className="text-lg font-bold text-emerald-400">{currencySymbol}{exampleAdjusted.toFixed(2)}</p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                    <p className="text-xs text-emerald-400 font-semibold">+{currencySymbol}{(exampleAdjusted - exampleOriginal).toFixed(2)} profit</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">n8n Webhook Integration</h2>
                <p className="text-xs text-slate-500">Connect your dashboard to your n8n workflow on Railway</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><Key className="w-3 h-3" /> Target Platform API Key</span>
                </label>
                <input
                  type="password"
                  value={platformApiKey}
                  onChange={(e) => setPlatformApiKey(e.target.value)}
                  placeholder="sk_live_••••••••••••••••"
                  className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all text-sm font-mono"
                />
                <p className="text-xs text-slate-600 mt-1.5">Your API key for the target e-commerce platform</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> n8n Webhook URL</span>
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-n8n.railway.app/webhook/..."
                  className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all text-sm font-mono"
                />
                <p className="text-xs text-slate-600 mt-1.5">All customer orders will be POSTed to this endpoint</p>
              </div>

              {webhookUrl && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Zap className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-300">Webhook Active</p>
                      <p className="text-xs text-slate-500 mt-1 font-mono break-all">{webhookUrl}</p>
                      <p className="text-xs text-slate-600 mt-2">Order payload: customer_name, phone, address, product, quantity, total_price, subscriber_id</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>

            {saved && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Settings saved successfully
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
