import type { SubscriptionSummary } from './types';

export class SubscriptionGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionGuardError';
  }
}

export function hasFeatureAccess(summary: SubscriptionSummary | null, featureKey: string): boolean {
  return Boolean(summary?.plan?.feature_flags?.[featureKey]);
}

export function getUsageLimitState(
  used: number,
  limit: number | null | undefined
): { used: number; limit: number | null; remaining: number | null; reached: boolean } {
  if (limit == null) {
    return {
      used,
      limit: null,
      remaining: null,
      reached: false,
    };
  }

  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    reached: used >= limit,
  };
}

export function assertFeatureAccess(summary: SubscriptionSummary | null, featureKey: string, label: string): void {
  if (!hasFeatureAccess(summary, featureKey)) {
    throw new SubscriptionGuardError(`${label} is not available on your current subscription tier.`);
  }
}

export function assertProductCreationAllowed(summary: SubscriptionSummary | null): void {
  const usage = summary?.usage.products_count ?? 0;
  const limit = summary?.plan?.product_limit ?? null;
  const state = getUsageLimitState(usage, limit);

  if (state.reached) {
    throw new SubscriptionGuardError('Your tenant has reached the product limit for the current subscription plan.');
  }
}

export function assertStorefrontAvailable(summary: SubscriptionSummary | null): void {
  if (!summary?.storefront_available) {
    throw new SubscriptionGuardError('The storefront is unavailable because the tenant subscription is inactive or expired.');
  }
}

export function getSubscriptionBadgeTone(summary: SubscriptionSummary | null): 'emerald' | 'amber' | 'red' | 'slate' {
  const status = summary?.subscription?.status;

  if (status === 'active') {
    return 'emerald';
  }

  if (status === 'trialing' || status === 'pending_payment') {
    return 'amber';
  }

  if (status === 'canceled' || status === 'expired' || status === 'past_due') {
    return 'red';
  }

  return 'slate';
}

export function getSubscriptionStatusLabel(summary: SubscriptionSummary | null): string {
  const status = summary?.subscription?.status;

  switch (status) {
    case 'trialing':
      return 'Trial';
    case 'active':
      return 'Active';
    case 'pending_payment':
      return 'Pending Payment';
    case 'past_due':
      return 'Past Due';
    case 'canceled':
      return 'Canceled';
    case 'expired':
      return 'Expired';
    case 'replaced':
      return 'Replaced';
    default:
      return 'No Subscription';
  }
}

export function getHoursUntil(dateValue: string | null | undefined): number | null {
  if (!dateValue) {
    return null;
  }

  const diffMs = new Date(dateValue).getTime() - Date.now();
  return Math.max(Math.ceil(diffMs / (1000 * 60 * 60)), 0);
}
