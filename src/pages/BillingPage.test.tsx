import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import BillingPage from './BillingPage';
import type { SubscriptionPayment, SubscriptionPlan, SubscriptionSummary } from '../lib/types';

const mocks = vi.hoisted(() => ({
  loadSubscriptionPlans: vi.fn(),
  loadRecentPayments: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
  changeSubscriptionPlan: vi.fn(),
  confirmSubscriptionCheckout: vi.fn(),
  cancelTenantSubscription: vi.fn(),
  resumeTenantSubscription: vi.fn(),
}));

vi.mock('../lib/subscriptions', () => ({
  loadSubscriptionPlans: mocks.loadSubscriptionPlans,
  loadRecentPayments: mocks.loadRecentPayments,
  createSubscriptionCheckout: mocks.createSubscriptionCheckout,
  changeSubscriptionPlan: mocks.changeSubscriptionPlan,
  confirmSubscriptionCheckout: mocks.confirmSubscriptionCheckout,
  cancelTenantSubscription: mocks.cancelTenantSubscription,
  resumeTenantSubscription: mocks.resumeTenantSubscription,
  formatPaymentState: (status: string) => status,
  formatPlanPrice: (plan: { price_egp: number }) => `${plan.price_egp} EGP / month`,
}));

const plans: SubscriptionPlan[] = [
  {
    plan_code: 'trial_24h',
    plan_name: '24-Hour Free Trial',
    description: 'Trial',
    tier_level: 0,
    price_egp: 0,
    billing_interval: 'trial',
    trial_duration_hours: 24,
    product_limit: 5,
    monthly_order_limit: 25,
    member_limit: 1,
    feature_flags: { storefront: true },
    is_public: true,
    is_active: true,
    created_at: '',
  },
  {
    plan_code: 'starter_250',
    plan_name: 'Starter 250 EGP',
    description: 'Paid starter plan',
    tier_level: 1,
    price_egp: 250,
    billing_interval: 'month',
    trial_duration_hours: 0,
    product_limit: 100,
    monthly_order_limit: 500,
    member_limit: 2,
    feature_flags: { storefront: true, webhook_integration: true },
    is_public: true,
    is_active: true,
    created_at: '',
  },
];

const summary: SubscriptionSummary = {
  tenant_id: 'tenant-1',
  subscription: {
    id: 'sub-1',
    plan_code: 'trial_24h',
    status: 'trialing',
    payment_provider: 'sandbox',
    trial_ends_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    cancel_at_period_end: false,
    canceled_at: null,
  },
  plan: {
    plan_code: 'trial_24h',
    plan_name: '24-Hour Free Trial',
    description: 'Trial',
    price_egp: 0,
    billing_interval: 'trial',
    tier_level: 0,
    product_limit: 5,
    monthly_order_limit: 25,
    member_limit: 1,
    feature_flags: { storefront: true },
  },
  usage: {
    products_count: 2,
    orders_this_month: 1,
    members_count: 1,
  },
  storefront_available: true,
};

const payments: SubscriptionPayment[] = [];

describe('BillingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadSubscriptionPlans.mockResolvedValue(plans);
    mocks.loadRecentPayments.mockResolvedValue(payments);
    mocks.createSubscriptionCheckout.mockResolvedValue({
      checkout_session_id: 'checkout-1',
      status: 'pending',
      provider: 'sandbox',
      amount_egp: 250,
      currency: 'EGP',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      plan_code: 'starter_250',
    });
    mocks.confirmSubscriptionCheckout.mockResolvedValue({
      ...summary,
      subscription: {
        ...summary.subscription!,
        plan_code: 'starter_250',
        status: 'active',
        trial_ends_at: null,
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      plan: {
        ...plans[1],
      },
    });
  });

  it('creates and confirms a sandbox checkout flow', async () => {
    const onSummaryChange = vi.fn();

    render(
      <BillingPage
        tenantId="tenant-1"
        userEmail="owner@example.com"
        summary={summary}
        onSummaryChange={onSummaryChange}
      />
    );

    await screen.findByText('Starter 250 EGP');

    fireEvent.click(screen.getByRole('button', { name: /upgrade \/ downgrade/i }));

    await waitFor(() => {
      expect(mocks.createSubscriptionCheckout).toHaveBeenCalledWith('starter_250', 'tenant-1');
    });

    expect(await screen.findByText(/sandbox checkout session is ready/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm sandbox payment/i }));

    await waitFor(() => {
      expect(mocks.confirmSubscriptionCheckout).toHaveBeenCalledWith('checkout-1', 'sandbox_card');
    });

    expect(onSummaryChange).toHaveBeenCalled();
  });
});
