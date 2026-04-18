import { supabase } from './supabase';
import type {
  AdminTenantSubscriptionRow,
  CheckoutPayload,
  MembershipRole,
  PaymentStatus,
  SubscriberProfile,
  SubscriptionPayment,
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionSummary,
  Tenant,
  TenantContext,
} from './types';

async function callRpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, params);

  if (error) {
    throw error;
  }

  return data as T;
}

function normalizeSummary(value: unknown): SubscriptionSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as SubscriptionSummary;
}

function normalizeContext(value: unknown): TenantContext {
  const context = (value ?? {}) as Partial<TenantContext> & {
    subscription_summary?: SubscriptionSummary | null;
  };

  return {
    tenant_id: context.tenant_id ?? null,
    membership_role: (context.membership_role as MembershipRole | null) ?? null,
    is_platform_admin: Boolean(context.is_platform_admin),
    tenant: (context.tenant as Tenant | null) ?? null,
    profile: (context.profile as SubscriberProfile | null) ?? null,
    subscription_summary: normalizeSummary(context.subscription_summary ?? null),
  };
}

export async function loadTenantContext(): Promise<TenantContext> {
  const data = await callRpc<unknown>('get_current_tenant_context');
  return normalizeContext(data);
}

export async function syncSubscriptionStatuses(tenantId?: string | null): Promise<void> {
  await callRpc('sync_tenant_subscription_statuses', {
    p_tenant_id: tenantId ?? null,
  });
}

export async function loadSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('tier_level', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as SubscriptionPlan[];
}

export async function loadSubscriptionSummary(tenantId?: string | null): Promise<SubscriptionSummary | null> {
  const data = await callRpc<unknown>('get_tenant_subscription_summary', {
    p_tenant_id: tenantId ?? null,
  });
  return normalizeSummary(data);
}

export async function createSubscriptionCheckout(planCode: string, tenantId?: string | null): Promise<CheckoutPayload> {
  return callRpc<CheckoutPayload>('create_subscription_checkout', {
    p_plan_code: planCode,
    p_tenant_id: tenantId ?? null,
  });
}

export async function changeSubscriptionPlan(planCode: string, tenantId?: string | null): Promise<CheckoutPayload> {
  return callRpc<CheckoutPayload>('change_subscription_plan', {
    p_plan_code: planCode,
    p_tenant_id: tenantId ?? null,
  });
}

export async function confirmSubscriptionCheckout(checkoutSessionId: string, paymentMethod = 'sandbox_card'): Promise<SubscriptionSummary | null> {
  const data = await callRpc<unknown>('confirm_subscription_checkout', {
    p_checkout_session_id: checkoutSessionId,
    p_payment_method: paymentMethod,
  });

  return normalizeSummary(data);
}

export async function cancelTenantSubscription(tenantId?: string | null, immediate = false): Promise<SubscriptionSummary | null> {
  const data = await callRpc<unknown>('cancel_tenant_subscription', {
    p_tenant_id: tenantId ?? null,
    p_immediately: immediate,
  });

  return normalizeSummary(data);
}

export async function resumeTenantSubscription(tenantId?: string | null): Promise<SubscriptionSummary | null> {
  const data = await callRpc<unknown>('resume_tenant_subscription', {
    p_tenant_id: tenantId ?? null,
  });

  return normalizeSummary(data);
}

export async function loadRecentPayments(tenantId: string): Promise<SubscriptionPayment[]> {
  const { data, error } = await supabase
    .from('subscription_payments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return (data ?? []) as SubscriptionPayment[];
}

export async function loadAdminTenantSubscriptions(): Promise<AdminTenantSubscriptionRow[]> {
  const data = await callRpc<AdminTenantSubscriptionRow[]>('admin_list_tenant_subscriptions');
  return data ?? [];
}

export async function adminUpdateTenantSubscription(
  tenantId: string,
  planCode: string,
  status: SubscriptionStatus,
  periodEnd?: string | null,
  notes = ''
): Promise<SubscriptionSummary | null> {
  const data = await callRpc<unknown>('admin_update_tenant_subscription', {
    p_tenant_id: tenantId,
    p_plan_code: planCode,
    p_status: status,
    p_period_end: periodEnd ?? null,
    p_notes: notes,
  });

  return normalizeSummary(data);
}

export function formatPlanPrice(plan: SubscriptionPlan): string {
  if (plan.price_egp === 0) {
    return 'Free';
  }

  return `${plan.price_egp.toFixed(0)} EGP / month`;
}

export function formatPaymentState(status: PaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'failed':
      return 'Failed';
    case 'refunded':
      return 'Refunded';
    default:
      return 'Pending';
  }
}
