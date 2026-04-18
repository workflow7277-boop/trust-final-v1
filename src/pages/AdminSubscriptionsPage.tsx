import { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import Header from '../components/dashboard/Header';
import { adminUpdateTenantSubscription, loadAdminTenantSubscriptions, loadSubscriptionPlans } from '../lib/subscriptions';
import type { AdminTenantSubscriptionRow, SubscriptionPlan, SubscriptionStatus } from '../lib/types';

interface AdminSubscriptionsPageProps {
  userEmail: string;
  enabled: boolean;
}

const editableStatuses: SubscriptionStatus[] = ['trialing', 'active', 'past_due', 'canceled', 'expired'];

export default function AdminSubscriptionsPage({ userEmail, enabled }: AdminSubscriptionsPageProps) {
  const [rows, setRows] = useState<AdminTenantSubscriptionRow[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTenantId, setSavingTenantId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [edits, setEdits] = useState<Record<string, { planCode: string; status: SubscriptionStatus }>>({});

  const loadData = async () => {
    if (!enabled) {
      setRows([]);
      setPlans([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [tenantRows, planRows] = await Promise.all([
        loadAdminTenantSubscriptions(),
        loadSubscriptionPlans(),
      ]);

      setRows(tenantRows);
      setPlans(planRows);
      setEdits(
        Object.fromEntries(
          tenantRows.map((row) => [
            row.tenant_id,
            {
              planCode: row.plan_code ?? planRows[0]?.plan_code ?? 'trial_24h',
              status: (row.subscription_status as SubscriptionStatus) || 'active',
            },
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin subscription data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [enabled]);

  const totalActive = useMemo(
    () => rows.filter((row) => row.subscription_status === 'active' || row.subscription_status === 'trialing').length,
    [rows]
  );

  const handleSave = async (tenantId: string) => {
    const draft = edits[tenantId];
    if (!draft) {
      return;
    }

    setSavingTenantId(tenantId);
    setError('');

    try {
      await adminUpdateTenantSubscription(tenantId, draft.planCode, draft.status, null, 'Updated via admin dashboard');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply the admin subscription override.');
    } finally {
      setSavingTenantId(null);
    }
  };

  if (!enabled) {
    return (
      <div className="flex flex-col min-h-full">
        <Header
          title="Admin Subscriptions"
          subtitle="Platform admin access is required to view tenant billing controls."
          userEmail={userEmail}
        />

        <div className="flex-1 p-6">
          <div className="bg-[#111827] border border-red-500/20 rounded-2xl p-6 flex items-start gap-4">
            <ShieldAlert className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-300">Access denied</p>
              <p className="text-sm text-slate-400 mt-1">
                Add your auth user to `public.platform_admins` or set `app_metadata.platform_role = "admin"` to enable platform-wide subscription management.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Admin Subscriptions"
        subtitle="Manage plan assignments, status overrides, and tenant billing health."
        userEmail={userEmail}
      />

      <div className="flex-1 p-6 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#111827] border border-white/5 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tenants</p>
            <p className="text-2xl font-semibold text-white mt-2">{rows.length}</p>
          </div>
          <div className="bg-[#111827] border border-white/5 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Live Subscriptions</p>
            <p className="text-2xl font-semibold text-white mt-2">{totalActive}</p>
          </div>
          <div className="bg-[#111827] border border-white/5 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Plans</p>
            <p className="text-2xl font-semibold text-white mt-2">{plans.length}</p>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : (
          <section className="bg-[#111827] border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Tenant Billing Matrix</h2>
                <p className="text-xs text-slate-500 mt-1">Each save creates a server-side admin override event in Supabase.</p>
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin mode
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500">Tenant</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500">Current Plan</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500">Usage</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500">Override</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500">Status</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((row) => {
                    const draft = edits[row.tenant_id];

                    return (
                      <tr key={row.tenant_id} className="align-top">
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-white">{row.tenant_name}</p>
                          <p className="text-xs text-slate-500 mt-1">{row.tenant_slug}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-white">{row.plan_name ?? 'No plan'}</p>
                          <p className="text-xs text-slate-500 mt-1">{row.subscription_status}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-300">
                          <p>Products: {row.products_count}</p>
                          <p>Orders: {row.orders_this_month}</p>
                          <p>Members: {row.members_count}</p>
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={draft?.planCode ?? row.plan_code ?? ''}
                            onChange={(event) =>
                              setEdits((prev) => ({
                                ...prev,
                                [row.tenant_id]: {
                                  planCode: event.target.value,
                                  status: prev[row.tenant_id]?.status ?? 'active',
                                },
                              }))
                            }
                            className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                          >
                            {plans.map((plan) => (
                              <option key={plan.plan_code} value={plan.plan_code}>
                                {plan.plan_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={draft?.status ?? 'active'}
                            onChange={(event) =>
                              setEdits((prev) => ({
                                ...prev,
                                [row.tenant_id]: {
                                  planCode: prev[row.tenant_id]?.planCode ?? row.plan_code ?? plans[0]?.plan_code ?? 'trial_24h',
                                  status: event.target.value as SubscriptionStatus,
                                },
                              }))
                            }
                            className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                          >
                            {editableStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => void handleSave(row.tenant_id)}
                            disabled={savingTenantId === row.tenant_id}
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
                          >
                            {savingTenantId === row.tenant_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Apply
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
