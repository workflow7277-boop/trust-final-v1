import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Globe, ArrowRight, CreditCard, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Order, SubscriberProfile, AppPage, SubscriptionSummary } from '../lib/types';
import Header from '../components/dashboard/Header';
import MetricsCards from '../components/dashboard/MetricsCards';
import RecentActivity from '../components/dashboard/RecentActivity';
import { getHoursUntil, getSubscriptionStatusLabel } from '../lib/subscriptionGuards';

interface DashboardPageProps {
  profile: SubscriberProfile | null;
  tenantId: string | null;
  userEmail: string;
  onNavigate: (page: AppPage) => void;
  subscriptionSummary: SubscriptionSummary | null;
  loading: boolean;
}

export default function DashboardPage({
  profile,
  tenantId,
  userEmail,
  onNavigate,
  subscriptionSummary,
  loading: contextLoading,
}: DashboardPageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const trialHoursLeft = getHoursUntil(subscriptionSummary?.subscription?.trial_ends_at);

  const loadOrders = useCallback(async () => {
    if (!tenantId) {
      setOrders([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('subscriber_id', tenantId)
      .order('created_at', { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [tenantId]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Dashboard"
        subtitle={`Welcome back to ${profile?.store_name ?? 'your store'}`}
        userEmail={userEmail}
      />

      <div className="flex-1 p-6 space-y-6">
        {loading || contextLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Overview</h2>
                <p className="text-xs text-slate-500 mt-0.5">Real-time performance metrics</p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <MetricsCards orders={orders} currencySymbol={profile?.currency_symbol ?? 'EGP'} />

            <div className="bg-[#111827] border border-white/5 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="w-11 h-11 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">
                  {subscriptionSummary?.plan?.plan_name ?? 'No active plan'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Status: {getSubscriptionStatusLabel(subscriptionSummary)}
                  {subscriptionSummary?.subscription?.current_period_end ? ` · Period ends ${new Date(subscriptionSummary.subscription.current_period_end).toLocaleString()}` : ''}
                </p>
              </div>
              <button
                onClick={() => onNavigate('billing')}
                className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10"
              >
                Open Billing
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {subscriptionSummary?.subscription?.status === 'trialing' && trialHoursLeft !== null && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-300">Trial countdown active</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {trialHoursLeft} hours remain on the free trial. Upgrade to a paid plan to keep the storefront and order intake active.
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('billing')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0"
                >
                  Upgrade
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {profile && !profile.webhook_url && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-300">Connect your n8n Webhook</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Your store isn't connected to an n8n workflow yet. Add your webhook URL to start automating order processing.
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('settings')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0"
                >
                  Configure
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {profile && profile.webhook_url && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-300">n8n Webhook Active</p>
                  <p className="text-xs text-slate-500 mt-1 font-mono truncate">{profile.webhook_url}</p>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 flex-shrink-0">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  Connected
                </span>
              </div>
            )}

            <RecentActivity orders={orders} loading={refreshing} currencySymbol={profile?.currency_symbol ?? 'EGP'} />
          </>
        )}
      </div>
    </div>
  );
}
