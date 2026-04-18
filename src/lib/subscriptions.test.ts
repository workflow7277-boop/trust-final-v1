import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  const select = vi.fn();
  const eq = vi.fn();
  const order = vi.fn();
  const limit = vi.fn();
  const from = vi.fn(() => ({
    select,
    eq,
    order,
    limit,
  }));

  return { rpc, select, eq, order, limit, from };
});

vi.mock('./supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

import {
  confirmSubscriptionCheckout,
  createSubscriptionCheckout,
  formatPaymentState,
  formatPlanPrice,
  loadRecentPayments,
  loadSubscriptionSummary,
  loadTenantContext,
} from './subscriptions';

describe('subscriptions service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.limit.mockResolvedValue({ data: [], error: null });
    mocks.order.mockReturnValue({ limit: mocks.limit });
    mocks.eq.mockReturnValue({ order: mocks.order });
    mocks.select.mockReturnValue({ eq: mocks.eq, order: mocks.order, limit: mocks.limit });
  });

  it('normalizes the tenant context payload', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        tenant_id: 'tenant-1',
        membership_role: 'owner',
        is_platform_admin: true,
        tenant: { id: 'tenant-1', name: 'Acme' },
        profile: { id: 'tenant-1', store_name: 'Acme Store' },
        subscription_summary: {
          tenant_id: 'tenant-1',
          subscription: null,
          plan: null,
          usage: { products_count: 0, orders_this_month: 0, members_count: 1 },
          storefront_available: false,
        },
      },
      error: null,
    });

    const result = await loadTenantContext();

    expect(mocks.rpc).toHaveBeenCalledWith('get_current_tenant_context', undefined);
    expect(result.tenant_id).toBe('tenant-1');
    expect(result.membership_role).toBe('owner');
    expect(result.is_platform_admin).toBe(true);
    expect(result.subscription_summary?.usage.members_count).toBe(1);
  });

  it('calls the checkout RPC with the expected payload', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        checkout_session_id: 'checkout-1',
        status: 'pending',
        provider: 'sandbox',
        amount_egp: 250,
        currency: 'EGP',
        expires_at: '2026-04-18T12:00:00.000Z',
        plan_code: 'starter_250',
      },
      error: null,
    });

    const result = await createSubscriptionCheckout('starter_250', 'tenant-1');

    expect(mocks.rpc).toHaveBeenCalledWith('create_subscription_checkout', {
      p_plan_code: 'starter_250',
      p_tenant_id: 'tenant-1',
    });
    expect(result.checkout_session_id).toBe('checkout-1');
  });

  it('returns the updated subscription summary after confirming checkout', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        tenant_id: 'tenant-1',
        subscription: {
          id: 'sub-1',
          plan_code: 'starter_250',
          status: 'active',
          payment_provider: 'sandbox',
          trial_ends_at: null,
          current_period_start: '2026-04-18T00:00:00.000Z',
          current_period_end: '2026-05-18T00:00:00.000Z',
          cancel_at_period_end: false,
          canceled_at: null,
        },
        plan: {
          plan_code: 'starter_250',
          plan_name: 'Starter 250 EGP',
          description: 'Starter',
          price_egp: 250,
          billing_interval: 'month',
          tier_level: 1,
          product_limit: 100,
          monthly_order_limit: 500,
          member_limit: 2,
          feature_flags: { storefront: true },
        },
        usage: { products_count: 4, orders_this_month: 11, members_count: 1 },
        storefront_available: true,
      },
      error: null,
    });

    const result = await confirmSubscriptionCheckout('checkout-1');

    expect(mocks.rpc).toHaveBeenCalledWith('confirm_subscription_checkout', {
      p_checkout_session_id: 'checkout-1',
      p_payment_method: 'sandbox_card',
    });
    expect(result?.subscription?.status).toBe('active');
    expect(result?.plan?.plan_code).toBe('starter_250');
  });

  it('loads recent payment rows from the table API', async () => {
    mocks.limit.mockResolvedValueOnce({
      data: [{ id: 'payment-1', amount_egp: 250 }],
      error: null,
    });

    const result = await loadRecentPayments('tenant-1');

    expect(mocks.from).toHaveBeenCalledWith('subscription_payments');
    expect(mocks.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(mocks.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mocks.limit).toHaveBeenCalledWith(10);
    expect(result).toHaveLength(1);
  });

  it('formats plan and payment labels for the UI', () => {
    expect(
      formatPlanPrice({
        plan_code: 'starter_250',
        plan_name: 'Starter',
        description: '',
        tier_level: 1,
        price_egp: 250,
        billing_interval: 'month',
        trial_duration_hours: 0,
        product_limit: 100,
        monthly_order_limit: 500,
        member_limit: 2,
        feature_flags: {},
        is_public: true,
        is_active: true,
        created_at: '',
      })
    ).toBe('250 EGP / month');

    expect(formatPaymentState('paid')).toBe('Paid');
    expect(formatPaymentState('pending')).toBe('Pending');
  });

  it('normalizes a subscription summary RPC result', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        tenant_id: 'tenant-1',
        subscription: null,
        plan: null,
        usage: { products_count: 0, orders_this_month: 0, members_count: 1 },
        storefront_available: false,
      },
      error: null,
    });

    const result = await loadSubscriptionSummary('tenant-1');

    expect(mocks.rpc).toHaveBeenCalledWith('get_tenant_subscription_summary', {
      p_tenant_id: 'tenant-1',
    });
    expect(result?.tenant_id).toBe('tenant-1');
  });
});
