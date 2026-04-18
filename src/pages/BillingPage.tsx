import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, CreditCard, Loader2, RefreshCw, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import Header from '../components/dashboard/Header';
import {
  cancelTenantSubscription,
  changeSubscriptionPlan,
  confirmSubscriptionCheckout,
  createSubscriptionCheckout,
  formatPaymentState,
  formatPlanPrice,
  loadRecentPayments,
  loadSubscriptionPlans,
  resumeTenantSubscription,
} from '../lib/subscriptions';
import { getHoursUntil, getSubscriptionStatusLabel, getUsageLimitState } from '../lib/subscriptionGuards';
import type {
  CheckoutPayload,
  SubscriptionPayment,
  SubscriptionPlan,
  SubscriptionSummary,
} from '../lib/types';

interface BillingPageProps {
  tenantId: string | null;
  userEmail: string;
  summary: SubscriptionSummary | null;
  onSummaryChange: (summary: SubscriptionSummary | null) => void;
}

function toneClasses(isCurrent: boolean) {
  return isCurrent
    ? 'border-blue-500/40 bg-blue-500/10 shadow-lg shadow-blue-600/10'
    : 'border-white/5 bg-[#111827] hover:border-white/10';
}

export default function BillingPage({ tenantId, userEmail, summary, onSummaryChange }: BillingPageProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [checkout, setCheckout] = useState<CheckoutPayload | null>(null);

  const currentPlanCode = summary?.subscription?.plan_code ?? null;
  const trialHoursLeft = getHoursUntil(summary?.subscription?.trial_ends_at);

  const usageCards = useMemo(() => {
    const productState = getUsageLimitState(summary?.usage.products_count ?? 0, summary?.plan?.product_limit ?? null);
    const orderState = getUsageLimitState(summary?.usage.orders_this_month ?? 0, summary?.plan?.monthly_order_limit ?? null);
    const memberState = getUsageLimitState(summary?.usage.members_count ?? 0, summary?.plan?.member_limit ?? null);

    return [
      { label: 'Products', state: productState },
      { label: 'Orders This Month', state: orderState },
      { label: 'Members', state: memberState },
    ];
  }, [summary]);

  const loadPageData = async () => {
    if (!tenantId) {
      setPlans([]);
      setPayments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [planRows, paymentRows] = await Promise.all([
        loadSubscriptionPlans(),
        loadRecentPayments(tenantId),
      ]);

      setPlans(planRows);
      setPayments(paymentRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData();
  }, [tenantId]);

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (!tenantId || plan.plan_code === 'trial_24h') {
      return;
    }

    setActionLoading(plan.plan_code);
    setError('');

    try {
      const payload = currentPlanCode && currentPlanCode !== 'trial_24h'
        ? await changeSubscriptionPlan(plan.plan_code, tenantId)
        : await createSubscriptionCheckout(plan.plan_code, tenantId);

      setCheckout(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the sandbox checkout session.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmSandboxPayment = async () => {
    if (!checkout) {
      return;
    }

    setActionLoading(checkout.checkout_session_id);
    setError('');

    try {
      const nextSummary = await confirmSubscriptionCheckout(checkout.checkout_session_id, 'sandbox_card');
      onSummaryChange(nextSummary);
      setCheckout(null);
      await loadPageData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sandbox payment confirmation failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!tenantId) {
      return;
    }

    setActionLoading('cancel');
    setError('');

    try {
      const nextSummary = await cancelTenantSubscription(tenantId, false);
      onSummaryChange(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel the current subscription.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    if (!tenantId) {
      return;
    }

    setActionLoading('resume');
    setError('');

    try {
      const nextSummary = await resumeTenantSubscription(tenantId);
      onSummaryChange(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume the current subscription.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Billing & Subscriptions"
        subtitle="Manage your sandbox subscription lifecycle, plan limits, and payment history."
        userEmail={userEmail}
      />

      <div className="flex-1 p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 bg-[#111827] border border-white/5 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Current Subscription</p>
                    <h2 className="text-2xl font-semibold text-white mt-2">
                      {summary?.plan?.plan_name ?? 'No active plan'}
                    </h2>
                    <p className="text-sm text-slate-400 mt-2">
                      Status: <span className="text-white">{getSubscriptionStatusLabel(summary)}</span>
                    </p>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
                    {summary?.plan ? formatPlanPrice({
                      ...summary.plan,
                      feature_flags: summary.plan.feature_flags,
                      is_active: true,
                      is_public: true,
                      created_at: '',
                    } as SubscriptionPlan) : 'No billing'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                  {usageCards.map(({ label, state }) => (
                    <div key={label} className="bg-[#0a0f1e] border border-white/5 rounded-xl p-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
                      <p className="text-lg font-semibold text-white mt-2">
                        {state.used}
                        {state.limit == null ? <span className="text-slate-500"> / Unlimited</span> : <span className="text-slate-500"> / {state.limit}</span>}
                      </p>
                      <p className={`text-xs mt-2 ${state.reached ? 'text-red-400' : 'text-slate-500'}`}>
                        {state.limit == null ? 'No cap on this plan.' : `${state.remaining} remaining before the limit is reached.`}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {summary?.subscription?.cancel_at_period_end ? (
                    <button
                      onClick={handleResume}
                      disabled={actionLoading === 'resume'}
                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
                    >
                      {actionLoading === 'resume' && <Loader2 className="w-4 h-4 animate-spin" />}
                      Resume Auto-Renew
                    </button>
                  ) : (
                    <button
                      onClick={handleCancel}
                      disabled={actionLoading === 'cancel' || !summary?.subscription}
                      className="inline-flex items-center gap-2 bg-red-600/15 hover:bg-red-600/25 disabled:opacity-60 text-red-300 px-4 py-2.5 rounded-xl text-sm font-semibold border border-red-500/20"
                    >
                      {actionLoading === 'cancel' && <Loader2 className="w-4 h-4 animate-spin" />}
                      Cancel At Period End
                    </button>
                  )}

                  <button
                    onClick={() => void loadPageData()}
                    className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Billing
                  </button>
                </div>

                {summary?.subscription?.status === 'trialing' && trialHoursLeft !== null && (
                  <div className="mt-5 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <Clock3 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-300">Trial expires soon</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {trialHoursLeft} hours remain on the 24-hour trial. Choose a paid plan before it expires to keep the storefront live.
                      </p>
                    </div>
                  </div>
                )}

                {summary?.subscription?.cancel_at_period_end && (
                  <div className="mt-5 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-300">Cancellation scheduled</p>
                      <p className="text-xs text-slate-400 mt-1">
                        The subscription remains active until the end of the current billing period, then storefront access and order intake will stop automatically.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-[#111827] border border-white/5 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sandbox Flow</p>
                <h3 className="text-lg font-semibold text-white mt-2">Local Payment Verification</h3>
                <p className="text-sm text-slate-400 mt-2">
                  This environment uses a sandbox-only processor. Paid plan changes create a checkout session and are activated once the sandbox payment is confirmed.
                </p>

                {checkout ? (
                  <div className="mt-5 bg-[#0a0f1e] border border-blue-500/20 rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-sm font-semibold text-white">{checkout.plan_code}</p>
                        <p className="text-xs text-slate-500">Sandbox checkout session is ready.</p>
                      </div>
                    </div>
                    <div className="text-sm text-slate-300">
                      <p>Amount: <span className="text-white">{checkout.amount_egp.toFixed(0)} {checkout.currency}</span></p>
                      <p>Expires: <span className="text-white">{new Date(checkout.expires_at).toLocaleString()}</span></p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-slate-300">
                      Use the built-in sandbox card flow. No external gateway credentials are required in local development.
                    </div>
                    <button
                      onClick={handleConfirmSandboxPayment}
                      disabled={actionLoading === checkout.checkout_session_id}
                      className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-3 rounded-xl text-sm font-semibold"
                    >
                      {actionLoading === checkout.checkout_session_id && <Loader2 className="w-4 h-4 animate-spin" />}
                      Confirm Sandbox Payment
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 bg-[#0a0f1e] border border-white/5 rounded-xl p-4">
                    <p className="text-sm text-slate-400">
                      Select a paid plan below to open a sandbox checkout session, then confirm the payment here.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrent = currentPlanCode === plan.plan_code;
                const isTrial = plan.plan_code === 'trial_24h';
                const features = Object.entries(plan.feature_flags)
                  .filter(([, enabled]) => enabled)
                  .slice(0, 5);

                return (
                  <div key={plan.plan_code} className={`border rounded-2xl p-5 transition-all ${toneClasses(isCurrent)}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tier {plan.tier_level}</p>
                        <h3 className="text-xl font-semibold text-white mt-2">{plan.plan_name}</h3>
                        <p className="text-sm text-slate-400 mt-2">{plan.description}</p>
                      </div>
                      {isCurrent && (
                        <div className="inline-flex items-center gap-1.5 text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Current
                        </div>
                      )}
                    </div>

                    <div className="mt-5">
                      <p className="text-3xl font-bold text-white">{plan.price_egp === 0 ? 'Free' : `${plan.price_egp.toFixed(0)} EGP`}</p>
                      <p className="text-sm text-slate-500 mt-1">{plan.billing_interval === 'trial' ? '24-hour trial' : 'Billed monthly'}</p>
                    </div>

                    <div className="mt-5 space-y-2 text-sm text-slate-300">
                      <p>Products: {plan.product_limit == null ? 'Unlimited' : plan.product_limit}</p>
                      <p>Orders / month: {plan.monthly_order_limit == null ? 'Unlimited' : plan.monthly_order_limit}</p>
                      <p>Members: {plan.member_limit == null ? 'Unlimited' : plan.member_limit}</p>
                    </div>

                    <div className="mt-5 space-y-2">
                      {features.map(([featureKey]) => (
                        <div key={featureKey} className="inline-flex items-center gap-2 mr-2 mb-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          {featureKey.replace(/_/g, ' ')}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => void handleSelectPlan(plan)}
                      disabled={isCurrent || isTrial || actionLoading === plan.plan_code}
                      className="w-full mt-6 inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-sm font-semibold border border-white/10"
                    >
                      {actionLoading === plan.plan_code && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isTrial ? 'Auto-assigned on signup' : isCurrent ? 'Current Plan' : currentPlanCode ? 'Upgrade / Downgrade' : 'Start Subscription'}
                    </button>
                  </div>
                );
              })}
            </section>

            <section className="bg-[#111827] border border-white/5 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h3 className="text-base font-semibold text-white">Recent Payments</h3>
                <p className="text-xs text-slate-500 mt-1">Latest sandbox and admin-issued payment records for this tenant.</p>
              </div>

              {payments.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No payment records yet.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {payments.map((payment) => (
                    <div key={payment.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{payment.plan_code}</p>
                        <p className="text-xs text-slate-500">{new Date(payment.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-300">{payment.amount_egp.toFixed(0)} {payment.currency}</span>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                          {formatPaymentState(payment.status)}
                        </span>
                        {payment.status === 'paid' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : payment.status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <Clock3 className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-300">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
