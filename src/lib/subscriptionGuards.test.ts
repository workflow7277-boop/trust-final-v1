import { describe, expect, it } from 'vitest';
import {
  SubscriptionGuardError,
  assertFeatureAccess,
  assertProductCreationAllowed,
  getHoursUntil,
  getSubscriptionStatusLabel,
  getUsageLimitState,
  hasFeatureAccess,
} from './subscriptionGuards';
import type { SubscriptionSummary } from './types';

const starterSummary: SubscriptionSummary = {
  tenant_id: 'tenant-1',
  subscription: {
    id: 'sub-1',
    plan_code: 'starter_250',
    status: 'active',
    payment_provider: 'sandbox',
    trial_ends_at: null,
    current_period_start: '2026-04-01T00:00:00.000Z',
    current_period_end: '2026-05-01T00:00:00.000Z',
    cancel_at_period_end: false,
    canceled_at: null,
  },
  plan: {
    plan_code: 'starter_250',
    plan_name: 'Starter 250 EGP',
    description: 'Starter plan',
    price_egp: 250,
    billing_interval: 'month',
    tier_level: 1,
    product_limit: 100,
    monthly_order_limit: 500,
    member_limit: 2,
    feature_flags: {
      storefront: true,
      product_management: true,
      orders: true,
      billing: true,
      webhook_integration: true,
      advanced_branding: true,
      advanced_analytics: false,
      priority_support: false,
      multi_user: false,
    },
  },
  usage: {
    products_count: 3,
    orders_this_month: 10,
    members_count: 1,
  },
  storefront_available: true,
};

describe('subscriptionGuards', () => {
  it('detects enabled feature flags', () => {
    expect(hasFeatureAccess(starterSummary, 'webhook_integration')).toBe(true);
    expect(hasFeatureAccess(starterSummary, 'advanced_analytics')).toBe(false);
  });

  it('computes bounded usage limits', () => {
    expect(getUsageLimitState(3, 5)).toEqual({
      used: 3,
      limit: 5,
      remaining: 2,
      reached: false,
    });

    expect(getUsageLimitState(5, 5)).toEqual({
      used: 5,
      limit: 5,
      remaining: 0,
      reached: true,
    });
  });

  it('throws when a feature is unavailable', () => {
    expect(() => assertFeatureAccess(starterSummary, 'advanced_analytics', 'Advanced analytics')).toThrow(
      SubscriptionGuardError
    );
  });

  it('throws when the product limit has been reached', () => {
    const limitedSummary: SubscriptionSummary = {
      ...starterSummary,
      plan: {
        ...starterSummary.plan!,
        product_limit: 3,
      },
      usage: {
        ...starterSummary.usage,
        products_count: 3,
      },
    };

    expect(() => assertProductCreationAllowed(limitedSummary)).toThrow(SubscriptionGuardError);
  });

  it('formats subscription status labels and countdowns', () => {
    const trialSummary: SubscriptionSummary = {
      ...starterSummary,
      subscription: {
        ...starterSummary.subscription!,
        status: 'trialing',
        trial_ends_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      },
    };

    expect(getSubscriptionStatusLabel(trialSummary)).toBe('Trial');
    expect(getHoursUntil(trialSummary.subscription?.trial_ends_at)).toBeGreaterThanOrEqual(2);
  });
});
