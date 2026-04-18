/*
  # Multi-tenant SaaS subscriptions

  ## Summary
  - Adds explicit tenant and membership tables for tenant isolation
  - Adds subscription plans, subscriptions, sandbox checkout sessions, payments, and audit events
  - Replaces the signup trigger so every new auth user gets a tenant, owner membership, profile, and 24-hour trial
  - Exposes RPC-style Postgres functions for create/update/cancel/upgrade/downgrade/admin flows
  - Enforces plan limits for products, storefront access, webhook settings, and order volume
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE membership_role AS ENUM ('owner', 'admin', 'billing_manager', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'pending_payment', 'past_due', 'canceled', 'expired', 'replaced');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE checkout_status AS ENUM ('pending', 'completed', 'expired', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.app_slugify(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM regexp_replace(lower(COALESCE(input_text, 'tenant')), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Store',
  slug text NOT NULL UNIQUE,
  status tenant_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role membership_role NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  plan_code text PRIMARY KEY,
  plan_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  tier_level integer NOT NULL,
  price_egp numeric(10,2) NOT NULL DEFAULT 0,
  billing_interval text NOT NULL CHECK (billing_interval IN ('trial', 'month')),
  trial_duration_hours integer NOT NULL DEFAULT 0,
  product_limit integer,
  monthly_order_limit integer,
  member_limit integer,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.subscription_plans(plan_code),
  status subscription_status NOT NULL,
  payment_provider text NOT NULL DEFAULT 'sandbox',
  provider_subscription_ref text,
  provider_customer_ref text,
  started_at timestamptz NOT NULL DEFAULT now(),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  ended_at timestamptz,
  replaced_by_subscription_id uuid REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.subscription_plans(plan_code),
  initiated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'sandbox',
  amount_egp numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EGP',
  status checkout_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL,
  checkout_session_id uuid REFERENCES public.subscription_checkout_sessions(id) ON DELETE SET NULL,
  plan_code text NOT NULL REFERENCES public.subscription_plans(plan_code),
  amount_egp numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EGP',
  provider text NOT NULL DEFAULT 'sandbox',
  payment_method text NOT NULL DEFAULT 'sandbox_card',
  status payment_status NOT NULL DEFAULT 'pending',
  provider_payment_ref text,
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user ON public.tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status ON public.tenant_subscriptions(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_tenant_status ON public.subscription_checkout_sessions(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_tenant_created ON public.subscription_payments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_tenant_created ON public.subscription_events(tenant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_live_subscription_per_tenant
  ON public.tenant_subscriptions(tenant_id)
  WHERE status IN ('trialing', 'active', 'past_due', 'pending_payment');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriber_profiles' AND column_name = 'currency_symbol'
  ) THEN
    ALTER TABLE public.subscriber_profiles ADD COLUMN currency_symbol text NOT NULL DEFAULT 'EGP';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriber_profiles' AND column_name = 'shipping_fee'
  ) THEN
    ALTER TABLE public.subscriber_profiles ADD COLUMN shipping_fee numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriber_profiles' AND column_name = 'free_shipping_threshold'
  ) THEN
    ALTER TABLE public.subscriber_profiles ADD COLUMN free_shipping_threshold numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriber_profiles' AND column_name = 'whatsapp_number'
  ) THEN
    ALTER TABLE public.subscriber_profiles ADD COLUMN whatsapp_number text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriber_profiles' AND column_name = 'brand_color'
  ) THEN
    ALTER TABLE public.subscriber_profiles ADD COLUMN brand_color text NOT NULL DEFAULT '#2563eb';
  END IF;
END $$;

INSERT INTO public.subscription_plans (
  plan_code,
  plan_name,
  description,
  tier_level,
  price_egp,
  billing_interval,
  trial_duration_hours,
  product_limit,
  monthly_order_limit,
  member_limit,
  feature_flags,
  is_public,
  is_active
)
VALUES
  (
    'trial_24h',
    '24-Hour Free Trial',
    'Full system trial for one day with strict usage limits.',
    0,
    0,
    'trial',
    24,
    5,
    25,
    1,
    '{"storefront": true, "product_management": true, "orders": true, "billing": true, "webhook_integration": false, "advanced_branding": false, "advanced_analytics": false, "priority_support": false, "multi_user": false}'::jsonb,
    true,
    true
  ),
  (
    'starter_250',
    'Starter 250 EGP',
    'Entry paid plan for growing storefronts.',
    1,
    250,
    'month',
    0,
    100,
    500,
    2,
    '{"storefront": true, "product_management": true, "orders": true, "billing": true, "webhook_integration": true, "advanced_branding": true, "advanced_analytics": false, "priority_support": false, "multi_user": false}'::jsonb,
    true,
    true
  ),
  (
    'scale_1000',
    'Scale 1000 EGP',
    'High-volume plan with broader operational access.',
    2,
    1000,
    'month',
    0,
    NULL,
    NULL,
    10,
    '{"storefront": true, "product_management": true, "orders": true, "billing": true, "webhook_integration": true, "advanced_branding": true, "advanced_analytics": true, "priority_support": true, "multi_user": true}'::jsonb,
    true,
    true
  )
ON CONFLICT (plan_code) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  description = EXCLUDED.description,
  tier_level = EXCLUDED.tier_level,
  price_egp = EXCLUDED.price_egp,
  billing_interval = EXCLUDED.billing_interval,
  trial_duration_hours = EXCLUDED.trial_duration_hours,
  product_limit = EXCLUDED.product_limit,
  monthly_order_limit = EXCLUDED.monthly_order_limit,
  member_limit = EXCLUDED.member_limit,
  feature_flags = EXCLUDED.feature_flags,
  is_public = EXCLUDED.is_public,
  is_active = EXCLUDED.is_active;

INSERT INTO public.tenants (id, owner_user_id, name, slug)
SELECT
  sp.id,
  sp.id,
  COALESCE(NULLIF(sp.store_name, ''), 'My Store'),
  CONCAT(public.app_slugify(COALESCE(NULLIF(sp.store_name, ''), 'my-store')), '-', left(sp.id::text, 6))
FROM public.subscriber_profiles sp
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
SELECT t.id, t.owner_user_id, 'owner'::membership_role, 'active'
FROM public.tenants t
ON CONFLICT (tenant_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
  ) OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'platform_role', '') = 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant_role(p_tenant_id uuid, p_roles membership_role[] DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    WHERE tm.tenant_id = p_tenant_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND (p_roles IS NULL OR tm.role = ANY (p_roles))
  ) OR public.is_platform_admin();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tm.tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = auth.uid()
    AND tm.status = 'active'
  ORDER BY CASE tm.role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'billing_manager' THEN 3
    ELSE 4
  END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_live_subscription_record(p_tenant_id uuid)
RETURNS public.tenant_subscriptions
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ts.*
  FROM public.tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id
    AND ts.status IN ('trialing', 'active', 'past_due', 'pending_payment')
  ORDER BY ts.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.tenant_storefront_is_available(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_subscriptions ts
    WHERE ts.tenant_id = p_tenant_id
      AND (
        (ts.status = 'trialing' AND COALESCE(ts.trial_ends_at, ts.current_period_end) > now())
        OR
        (ts.status = 'active' AND COALESCE(ts.current_period_end, now() + interval '1 second') > now())
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_subscription_summary(p_tenant_id uuid DEFAULT public.get_current_tenant_id())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription public.tenant_subscriptions;
  v_plan public.subscription_plans;
  v_products integer := 0;
  v_orders integer := 0;
  v_members integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT * INTO v_subscription
  FROM public.get_live_subscription_record(p_tenant_id);

  IF v_subscription.id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE plan_code = v_subscription.plan_code;
  END IF;

  SELECT count(*) INTO v_products
  FROM public.products
  WHERE subscriber_id = p_tenant_id;

  SELECT count(*) INTO v_orders
  FROM public.orders
  WHERE subscriber_id = p_tenant_id
    AND created_at >= date_trunc('month', now());

  SELECT count(*) INTO v_members
  FROM public.tenant_memberships
  WHERE tenant_id = p_tenant_id
    AND status = 'active';

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'subscription', CASE
      WHEN v_subscription.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', v_subscription.id,
        'plan_code', v_subscription.plan_code,
        'status', v_subscription.status,
        'payment_provider', v_subscription.payment_provider,
        'trial_ends_at', v_subscription.trial_ends_at,
        'current_period_start', v_subscription.current_period_start,
        'current_period_end', v_subscription.current_period_end,
        'cancel_at_period_end', v_subscription.cancel_at_period_end,
        'canceled_at', v_subscription.canceled_at
      )
    END,
    'plan', CASE
      WHEN v_plan.plan_code IS NULL THEN NULL
      ELSE jsonb_build_object(
        'plan_code', v_plan.plan_code,
        'plan_name', v_plan.plan_name,
        'description', v_plan.description,
        'price_egp', v_plan.price_egp,
        'billing_interval', v_plan.billing_interval,
        'tier_level', v_plan.tier_level,
        'product_limit', v_plan.product_limit,
        'monthly_order_limit', v_plan.monthly_order_limit,
        'member_limit', v_plan.member_limit,
        'feature_flags', v_plan.feature_flags
      )
    END,
    'usage', jsonb_build_object(
      'products_count', v_products,
      'orders_this_month', v_orders,
      'members_count', v_members
    ),
    'storefront_available', public.tenant_storefront_is_available(p_tenant_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_has_feature(p_tenant_id uuid, p_feature_key text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((sp.feature_flags ->> p_feature_key)::boolean, false)
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON sp.plan_code = ts.plan_code
  WHERE ts.tenant_id = p_tenant_id
    AND ts.status IN ('trialing', 'active', 'past_due', 'pending_payment')
  ORDER BY ts.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.create_trial_subscription_for_tenant(
  p_tenant_id uuid,
  p_created_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_live uuid;
  v_existing_trial uuid;
  v_new_subscription public.tenant_subscriptions;
BEGIN
  SELECT id INTO v_existing_live
  FROM public.tenant_subscriptions
  WHERE tenant_id = p_tenant_id
    AND status IN ('trialing', 'active', 'past_due', 'pending_payment')
  LIMIT 1;

  IF v_existing_live IS NOT NULL THEN
    RAISE EXCEPTION 'A live subscription already exists for this tenant.';
  END IF;

  SELECT id INTO v_existing_trial
  FROM public.tenant_subscriptions
  WHERE tenant_id = p_tenant_id
    AND plan_code = 'trial_24h'
  LIMIT 1;

  IF v_existing_trial IS NOT NULL THEN
    RAISE EXCEPTION 'This tenant has already used the trial plan.';
  END IF;

  INSERT INTO public.tenant_subscriptions (
    tenant_id,
    plan_code,
    status,
    payment_provider,
    started_at,
    trial_started_at,
    trial_ends_at,
    current_period_start,
    current_period_end,
    created_by
  )
  VALUES (
    p_tenant_id,
    'trial_24h',
    'trialing',
    'sandbox',
    now(),
    now(),
    now() + interval '24 hours',
    now(),
    now() + interval '24 hours',
    p_created_by
  )
  RETURNING * INTO v_new_subscription;

  INSERT INTO public.subscription_events (tenant_id, subscription_id, actor_user_id, event_type, event_payload)
  VALUES (
    p_tenant_id,
    v_new_subscription.id,
    p_created_by,
    'trial_started',
    jsonb_build_object('plan_code', 'trial_24h')
  );

  RETURN public.get_tenant_subscription_summary(p_tenant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_tenant_subscription_statuses(p_tenant_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE public.tenant_subscriptions ts
  SET
    status = 'expired',
    ended_at = COALESCE(ts.ended_at, now()),
    updated_at = now()
  WHERE (p_tenant_id IS NULL OR ts.tenant_id = p_tenant_id)
    AND ts.status = 'trialing'
    AND COALESCE(ts.trial_ends_at, ts.current_period_end) <= now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE public.tenant_subscriptions ts
  SET
    status = CASE
      WHEN ts.cancel_at_period_end THEN 'canceled'
      ELSE 'expired'
    END,
    canceled_at = CASE
      WHEN ts.cancel_at_period_end THEN COALESCE(ts.canceled_at, now())
      ELSE ts.canceled_at
    END,
    ended_at = COALESCE(ts.ended_at, now()),
    updated_at = now()
  WHERE (p_tenant_id IS NULL OR ts.tenant_id = p_tenant_id)
    AND ts.status IN ('active', 'past_due')
    AND ts.current_period_end IS NOT NULL
    AND ts.current_period_end <= now();

  RETURN jsonb_build_object(
    'updated', v_updated,
    'tenant_id', COALESCE(p_tenant_id, public.get_current_tenant_id())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_subscription_checkout(
  p_plan_code text,
  p_tenant_id uuid DEFAULT public.get_current_tenant_id()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans;
  v_session public.subscription_checkout_sessions;
  v_current public.tenant_subscriptions;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant is available for this user.';
  END IF;

  IF NOT public.user_has_tenant_role(p_tenant_id, ARRAY['owner', 'admin', 'billing_manager']::membership_role[]) THEN
    RAISE EXCEPTION 'You do not have permission to manage billing for this tenant.';
  END IF;

  PERFORM public.sync_tenant_subscription_statuses(p_tenant_id);

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE plan_code = p_plan_code
    AND is_active = true
    AND is_public = true;

  IF v_plan.plan_code IS NULL THEN
    RAISE EXCEPTION 'Plan % was not found or is not active.', p_plan_code;
  END IF;

  IF v_plan.billing_interval <> 'month' THEN
    RAISE EXCEPTION 'Checkout is only available for paid monthly plans.';
  END IF;

  SELECT * INTO v_current
  FROM public.get_live_subscription_record(p_tenant_id);

  IF v_current.id IS NOT NULL
     AND v_current.plan_code = v_plan.plan_code
     AND v_current.status = 'active'
     AND COALESCE(v_current.current_period_end, now() + interval '1 minute') > now() THEN
    RAISE EXCEPTION 'This tenant is already subscribed to plan %.', p_plan_code;
  END IF;

  INSERT INTO public.subscription_checkout_sessions (
    tenant_id,
    plan_code,
    initiated_by,
    provider,
    amount_egp,
    metadata
  )
  VALUES (
    p_tenant_id,
    v_plan.plan_code,
    auth.uid(),
    'sandbox',
    v_plan.price_egp,
    jsonb_build_object('kind', CASE WHEN v_current.id IS NULL THEN 'create' ELSE 'change' END)
  )
  RETURNING * INTO v_session;

  INSERT INTO public.subscription_events (tenant_id, actor_user_id, event_type, event_payload)
  VALUES (
    p_tenant_id,
    auth.uid(),
    'checkout_created',
    jsonb_build_object(
      'checkout_session_id', v_session.id,
      'plan_code', v_plan.plan_code,
      'amount_egp', v_session.amount_egp
    )
  );

  RETURN jsonb_build_object(
    'checkout_session_id', v_session.id,
    'status', v_session.status,
    'provider', v_session.provider,
    'amount_egp', v_session.amount_egp,
    'currency', v_session.currency,
    'expires_at', v_session.expires_at,
    'plan_code', v_session.plan_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.change_subscription_plan(
  p_plan_code text,
  p_tenant_id uuid DEFAULT public.get_current_tenant_id()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.create_subscription_checkout(p_plan_code, p_tenant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_subscription_checkout(
  p_checkout_session_id uuid,
  p_payment_method text DEFAULT 'sandbox_card'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.subscription_checkout_sessions;
  v_plan public.subscription_plans;
  v_previous public.tenant_subscriptions;
  v_new_subscription public.tenant_subscriptions;
  v_payment public.subscription_payments;
BEGIN
  SELECT * INTO v_session
  FROM public.subscription_checkout_sessions
  WHERE id = p_checkout_session_id;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Checkout session not found.';
  END IF;

  IF NOT public.user_has_tenant_role(v_session.tenant_id, ARRAY['owner', 'admin', 'billing_manager']::membership_role[]) THEN
    RAISE EXCEPTION 'You do not have permission to confirm this payment.';
  END IF;

  IF v_session.status <> 'pending' THEN
    RAISE EXCEPTION 'Checkout session is no longer pending.';
  END IF;

  IF v_session.expires_at <= now() THEN
    UPDATE public.subscription_checkout_sessions
    SET status = 'expired'
    WHERE id = v_session.id;
    RAISE EXCEPTION 'Checkout session has expired.';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE plan_code = v_session.plan_code;

  SELECT * INTO v_previous
  FROM public.get_live_subscription_record(v_session.tenant_id);

  IF v_previous.id IS NOT NULL THEN
    UPDATE public.tenant_subscriptions
    SET
      status = 'replaced',
      ended_at = now(),
      replaced_by_subscription_id = NULL,
      updated_at = now()
    WHERE id = v_previous.id;
  END IF;

  INSERT INTO public.tenant_subscriptions (
    tenant_id,
    plan_code,
    status,
    payment_provider,
    started_at,
    current_period_start,
    current_period_end,
    created_by,
    metadata
  )
  VALUES (
    v_session.tenant_id,
    v_plan.plan_code,
    'active',
    v_session.provider,
    now(),
    now(),
    now() + interval '1 month',
    auth.uid(),
    jsonb_build_object('checkout_session_id', v_session.id, 'payment_method', p_payment_method)
  )
  RETURNING * INTO v_new_subscription;

  IF v_previous.id IS NOT NULL THEN
    UPDATE public.tenant_subscriptions
    SET replaced_by_subscription_id = v_new_subscription.id
    WHERE id = v_previous.id;
  END IF;

  UPDATE public.subscription_checkout_sessions
  SET
    status = 'completed',
    completed_at = now()
  WHERE id = v_session.id;

  INSERT INTO public.subscription_payments (
    tenant_id,
    subscription_id,
    checkout_session_id,
    plan_code,
    amount_egp,
    provider,
    payment_method,
    status,
    provider_payment_ref,
    paid_at,
    metadata
  )
  VALUES (
    v_session.tenant_id,
    v_new_subscription.id,
    v_session.id,
    v_plan.plan_code,
    v_session.amount_egp,
    v_session.provider,
    p_payment_method,
    'paid',
    CONCAT('sandbox_', replace(v_session.id::text, '-', '')),
    now(),
    jsonb_build_object('sandbox', true)
  )
  RETURNING * INTO v_payment;

  INSERT INTO public.subscription_events (tenant_id, subscription_id, actor_user_id, event_type, event_payload)
  VALUES (
    v_session.tenant_id,
    v_new_subscription.id,
    auth.uid(),
    'subscription_activated',
    jsonb_build_object(
      'checkout_session_id', v_session.id,
      'payment_id', v_payment.id,
      'plan_code', v_plan.plan_code,
      'amount_egp', v_payment.amount_egp
    )
  );

  RETURN public.get_tenant_subscription_summary(v_session.tenant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_tenant_subscription(
  p_tenant_id uuid DEFAULT public.get_current_tenant_id(),
  p_immediately boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription public.tenant_subscriptions;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant is available for this user.';
  END IF;

  IF NOT public.user_has_tenant_role(p_tenant_id, ARRAY['owner', 'admin', 'billing_manager']::membership_role[]) THEN
    RAISE EXCEPTION 'You do not have permission to cancel this subscription.';
  END IF;

  SELECT * INTO v_subscription
  FROM public.get_live_subscription_record(p_tenant_id);

  IF v_subscription.id IS NULL THEN
    RAISE EXCEPTION 'No live subscription exists for this tenant.';
  END IF;

  UPDATE public.tenant_subscriptions
  SET
    status = CASE
      WHEN p_immediately THEN 'canceled'
      ELSE status
    END,
    cancel_at_period_end = CASE
      WHEN p_immediately THEN false
      ELSE true
    END,
    canceled_at = now(),
    ended_at = CASE
      WHEN p_immediately THEN now()
      ELSE ended_at
    END,
    updated_at = now()
  WHERE id = v_subscription.id;

  INSERT INTO public.subscription_events (tenant_id, subscription_id, actor_user_id, event_type, event_payload)
  VALUES (
    p_tenant_id,
    v_subscription.id,
    auth.uid(),
    'subscription_canceled',
    jsonb_build_object('immediate', p_immediately)
  );

  RETURN public.get_tenant_subscription_summary(p_tenant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_tenant_subscription(
  p_tenant_id uuid DEFAULT public.get_current_tenant_id()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription public.tenant_subscriptions;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant is available for this user.';
  END IF;

  IF NOT public.user_has_tenant_role(p_tenant_id, ARRAY['owner', 'admin', 'billing_manager']::membership_role[]) THEN
    RAISE EXCEPTION 'You do not have permission to resume this subscription.';
  END IF;

  SELECT * INTO v_subscription
  FROM public.get_live_subscription_record(p_tenant_id);

  IF v_subscription.id IS NULL THEN
    RAISE EXCEPTION 'No live subscription exists for this tenant.';
  END IF;

  UPDATE public.tenant_subscriptions
  SET
    cancel_at_period_end = false,
    canceled_at = NULL,
    updated_at = now()
  WHERE id = v_subscription.id;

  INSERT INTO public.subscription_events (tenant_id, subscription_id, actor_user_id, event_type, event_payload)
  VALUES (
    p_tenant_id,
    v_subscription.id,
    auth.uid(),
    'subscription_resumed',
    '{}'::jsonb
  );

  RETURN public.get_tenant_subscription_summary(p_tenant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_tenant_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_membership public.tenant_memberships;
  v_tenant public.tenants;
  v_profile public.subscriber_profiles;
BEGIN
  v_tenant_id := public.get_current_tenant_id();

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'tenant_id', NULL,
      'membership_role', NULL,
      'is_platform_admin', public.is_platform_admin(),
      'tenant', NULL,
      'profile', NULL,
      'subscription_summary', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_membership
  FROM public.tenant_memberships
  WHERE tenant_id = v_tenant_id
    AND user_id = auth.uid()
  LIMIT 1;

  SELECT * INTO v_tenant
  FROM public.tenants
  WHERE id = v_tenant_id;

  SELECT * INTO v_profile
  FROM public.subscriber_profiles
  WHERE id = v_tenant_id;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'membership_role', v_membership.role,
    'is_platform_admin', public.is_platform_admin(),
    'tenant', to_jsonb(v_tenant),
    'profile', to_jsonb(v_profile),
    'subscription_summary', public.get_tenant_subscription_summary(v_tenant_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_tenant_subscriptions()
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  owner_user_id uuid,
  subscription_status text,
  plan_code text,
  plan_name text,
  price_egp numeric,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean,
  products_count bigint,
  orders_this_month bigint,
  members_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin access is required.';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    t.owner_user_id,
    COALESCE(ts.status::text, 'none'),
    ts.plan_code,
    sp.plan_name,
    sp.price_egp,
    ts.current_period_end,
    ts.trial_ends_at,
    COALESCE(ts.cancel_at_period_end, false),
    COALESCE(product_counts.products_count, 0),
    COALESCE(order_counts.orders_this_month, 0),
    COALESCE(member_counts.members_count, 0)
  FROM public.tenants t
  LEFT JOIN LATERAL (
    SELECT sub.*
    FROM public.tenant_subscriptions sub
    WHERE sub.tenant_id = t.id
    ORDER BY sub.created_at DESC
    LIMIT 1
  ) ts ON true
  LEFT JOIN public.subscription_plans sp ON sp.plan_code = ts.plan_code
  LEFT JOIN LATERAL (
    SELECT count(*) AS products_count
    FROM public.products p
    WHERE p.subscriber_id = t.id
  ) product_counts ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS orders_this_month
    FROM public.orders o
    WHERE o.subscriber_id = t.id
      AND o.created_at >= date_trunc('month', now())
  ) order_counts ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS members_count
    FROM public.tenant_memberships tm
    WHERE tm.tenant_id = t.id
      AND tm.status = 'active'
  ) member_counts ON true
  ORDER BY t.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_tenant_subscription(
  p_tenant_id uuid,
  p_plan_code text,
  p_status subscription_status,
  p_period_end timestamptz DEFAULT NULL,
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans;
  v_previous public.tenant_subscriptions;
  v_new public.tenant_subscriptions;
  v_period_end timestamptz;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin access is required.';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE plan_code = p_plan_code;

  IF v_plan.plan_code IS NULL THEN
    RAISE EXCEPTION 'Plan % does not exist.', p_plan_code;
  END IF;

  SELECT * INTO v_previous
  FROM public.get_live_subscription_record(p_tenant_id);

  IF v_previous.id IS NOT NULL THEN
    UPDATE public.tenant_subscriptions
    SET
      status = 'replaced',
      ended_at = now(),
      updated_at = now()
    WHERE id = v_previous.id;
  END IF;

  v_period_end := COALESCE(
    p_period_end,
    CASE
      WHEN v_plan.billing_interval = 'trial' THEN now() + make_interval(hours => v_plan.trial_duration_hours)
      ELSE now() + interval '1 month'
    END
  );

  INSERT INTO public.tenant_subscriptions (
    tenant_id,
    plan_code,
    status,
    payment_provider,
    started_at,
    trial_started_at,
    trial_ends_at,
    current_period_start,
    current_period_end,
    created_by,
    metadata
  )
  VALUES (
    p_tenant_id,
    v_plan.plan_code,
    p_status,
    'admin_override',
    now(),
    CASE WHEN p_status = 'trialing' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'trialing' THEN v_period_end ELSE NULL END,
    now(),
    CASE WHEN p_status IN ('trialing', 'active', 'past_due') THEN v_period_end ELSE now() END,
    auth.uid(),
    jsonb_build_object('notes', p_notes)
  )
  RETURNING * INTO v_new;

  INSERT INTO public.subscription_events (tenant_id, subscription_id, actor_user_id, event_type, event_payload)
  VALUES (
    p_tenant_id,
    v_new.id,
    auth.uid(),
    'admin_subscription_override',
    jsonb_build_object('notes', p_notes, 'plan_code', p_plan_code, 'status', p_status)
  );

  RETURN public.get_tenant_subscription_summary(p_tenant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_product_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  SELECT sp.product_limit INTO v_limit
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON sp.plan_code = ts.plan_code
  WHERE ts.tenant_id = NEW.subscriber_id
    AND ts.status IN ('trialing', 'active', 'past_due', 'pending_payment')
  ORDER BY ts.created_at DESC
  LIMIT 1;

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.products p
  WHERE p.subscriber_id = NEW.subscriber_id
    AND (TG_OP = 'INSERT' OR p.id <> NEW.id);

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Product limit reached for the current subscription plan.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_order_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF NOT public.tenant_storefront_is_available(NEW.subscriber_id) THEN
    RAISE EXCEPTION 'This storefront is not accepting orders because the subscription is inactive or expired.';
  END IF;

  SELECT sp.monthly_order_limit INTO v_limit
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON sp.plan_code = ts.plan_code
  WHERE ts.tenant_id = NEW.subscriber_id
    AND ts.status IN ('trialing', 'active', 'past_due', 'pending_payment')
  ORDER BY ts.created_at DESC
  LIMIT 1;

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.orders o
  WHERE o.subscriber_id = NEW.subscriber_id
    AND o.created_at >= date_trunc('month', now());

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Monthly order limit reached for the current subscription plan.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_profile_feature_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (COALESCE(NEW.webhook_url, '') <> '' OR COALESCE(NEW.platform_api_key, '') <> '')
     AND NOT COALESCE(public.tenant_has_feature(NEW.id, 'webhook_integration'), false) THEN
    RAISE EXCEPTION 'Webhook and API key settings require a paid plan.';
  END IF;

  IF (COALESCE(NEW.store_logo_url, '') <> '' OR COALESCE(NEW.brand_color, '#2563eb') <> '#2563eb')
     AND NOT COALESCE(public.tenant_has_feature(NEW.id, 'advanced_branding'), false) THEN
    RAISE EXCEPTION 'Advanced branding requires a paid plan.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  SELECT sp.member_limit INTO v_limit
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON sp.plan_code = ts.plan_code
  WHERE ts.tenant_id = NEW.tenant_id
    AND ts.status IN ('trialing', 'active', 'past_due', 'pending_payment')
  ORDER BY ts.created_at DESC
  LIMIT 1;

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.tenant_memberships tm
  WHERE tm.tenant_id = NEW.tenant_id
    AND tm.status = 'active'
    AND (TG_OP = 'INSERT' OR tm.user_id <> NEW.user_id);

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Member limit reached for the current subscription plan.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_memberships_updated_at ON public.tenant_memberships;
CREATE TRIGGER trg_tenant_memberships_updated_at
  BEFORE UPDATE ON public.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_subscriptions_updated_at ON public.tenant_subscriptions;
CREATE TRIGGER trg_tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_products_plan_limits ON public.products;
CREATE TRIGGER trg_products_plan_limits
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_plan_limits();

DROP TRIGGER IF EXISTS trg_orders_plan_limits ON public.orders;
CREATE TRIGGER trg_orders_plan_limits
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_plan_limits();

DROP TRIGGER IF EXISTS trg_profiles_feature_access ON public.subscriber_profiles;
CREATE TRIGGER trg_profiles_feature_access
  BEFORE INSERT OR UPDATE ON public.subscriber_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_feature_access();

DROP TRIGGER IF EXISTS trg_membership_member_limit ON public.tenant_memberships;
CREATE TRIGGER trg_membership_member_limit
  BEFORE INSERT ON public.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_limit();

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view tenants" ON public.tenants;
CREATE POLICY "Tenant members can view tenants"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_role(id, NULL));

DROP POLICY IF EXISTS "Tenant owners and admins can update tenants" ON public.tenants;
CREATE POLICY "Tenant owners and admins can update tenants"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (public.user_has_tenant_role(id, ARRAY['owner', 'admin']::membership_role[]))
  WITH CHECK (public.user_has_tenant_role(id, ARRAY['owner', 'admin']::membership_role[]));

DROP POLICY IF EXISTS "Users can view own memberships" ON public.tenant_memberships;
CREATE POLICY "Users can view own memberships"
  ON public.tenant_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Tenant owners can manage memberships" ON public.tenant_memberships;
CREATE POLICY "Tenant owners can manage memberships"
  ON public.tenant_memberships FOR ALL
  TO authenticated
  USING (public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin']::membership_role[]))
  WITH CHECK (public.user_has_tenant_role(tenant_id, ARRAY['owner', 'admin']::membership_role[]));

DROP POLICY IF EXISTS "Users can view own platform admin row" ON public.platform_admins;
CREATE POLICY "Users can view own platform admin row"
  ON public.platform_admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can view public plans" ON public.subscription_plans;
CREATE POLICY "Authenticated users can view public plans"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Anonymous users can view public plans" ON public.subscription_plans;
CREATE POLICY "Anonymous users can view public plans"
  ON public.subscription_plans FOR SELECT
  TO anon
  USING (is_public = true AND is_active = true);

DROP POLICY IF EXISTS "Tenant members can view subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Tenant members can view subscriptions"
  ON public.tenant_subscriptions FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_role(tenant_id, NULL));

DROP POLICY IF EXISTS "Tenant members can view checkout sessions" ON public.subscription_checkout_sessions;
CREATE POLICY "Tenant members can view checkout sessions"
  ON public.subscription_checkout_sessions FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_role(tenant_id, NULL));

DROP POLICY IF EXISTS "Tenant members can view payments" ON public.subscription_payments;
CREATE POLICY "Tenant members can view payments"
  ON public.subscription_payments FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_role(tenant_id, NULL));

DROP POLICY IF EXISTS "Tenant members can view events" ON public.subscription_events;
CREATE POLICY "Tenant members can view events"
  ON public.subscription_events FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_role(tenant_id, NULL));

DROP POLICY IF EXISTS "Subscribers can view own profile" ON public.subscriber_profiles;
DROP POLICY IF EXISTS "Subscribers can insert own profile" ON public.subscriber_profiles;
DROP POLICY IF EXISTS "Subscribers can update own profile" ON public.subscriber_profiles;
DROP POLICY IF EXISTS "Public can read store profiles" ON public.subscriber_profiles;

CREATE POLICY "Tenant members can view tenant profile"
  ON public.subscriber_profiles FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_role(id, NULL));

CREATE POLICY "Tenant owners and admins can insert tenant profile"
  ON public.subscriber_profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_tenant_role(id, ARRAY['owner', 'admin']::membership_role[]));

CREATE POLICY "Tenant owners and admins can update tenant profile"
  ON public.subscriber_profiles FOR UPDATE
  TO authenticated
  USING (public.user_has_tenant_role(id, ARRAY['owner', 'admin']::membership_role[]))
  WITH CHECK (public.user_has_tenant_role(id, ARRAY['owner', 'admin']::membership_role[]));

CREATE POLICY "Public can read live storefront profiles"
  ON public.subscriber_profiles FOR SELECT
  TO anon
  USING (public.tenant_storefront_is_available(id));

DROP POLICY IF EXISTS "Subscribers can view own products" ON public.products;
DROP POLICY IF EXISTS "Subscribers can insert own products" ON public.products;
DROP POLICY IF EXISTS "Subscribers can update own products" ON public.products;
DROP POLICY IF EXISTS "Subscribers can delete own products" ON public.products;
DROP POLICY IF EXISTS "Public can read active products" ON public.products;

CREATE POLICY "Tenant members can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_role(subscriber_id, NULL));

CREATE POLICY "Tenant operators can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_tenant_role(subscriber_id, ARRAY['owner', 'admin', 'member']::membership_role[]));

CREATE POLICY "Tenant operators can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.user_has_tenant_role(subscriber_id, ARRAY['owner', 'admin', 'member']::membership_role[]))
  WITH CHECK (public.user_has_tenant_role(subscriber_id, ARRAY['owner', 'admin', 'member']::membership_role[]));

CREATE POLICY "Tenant operators can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.user_has_tenant_role(subscriber_id, ARRAY['owner', 'admin', 'member']::membership_role[]));

CREATE POLICY "Public can read active products for live storefronts"
  ON public.products FOR SELECT
  TO anon
  USING (is_active = true AND public.tenant_storefront_is_available(subscriber_id));

DROP POLICY IF EXISTS "Subscribers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Subscribers can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated can insert orders" ON public.orders;

CREATE POLICY "Tenant members can view orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_role(subscriber_id, NULL));

CREATE POLICY "Tenant operators can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.user_has_tenant_role(subscriber_id, ARRAY['owner', 'admin', 'member']::membership_role[]))
  WITH CHECK (public.user_has_tenant_role(subscriber_id, ARRAY['owner', 'admin', 'member']::membership_role[]));

CREATE POLICY "Public can insert orders for live storefronts"
  ON public.orders FOR INSERT
  TO anon
  WITH CHECK (public.tenant_storefront_is_available(subscriber_id));

CREATE POLICY "Authenticated can insert orders for live storefronts"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (public.tenant_storefront_is_available(subscriber_id));

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_name text := COALESCE(new.raw_user_meta_data ->> 'store_name', 'My Store');
BEGIN
  INSERT INTO public.tenants (id, owner_user_id, name, slug)
  VALUES (
    new.id,
    new.id,
    v_store_name,
    CONCAT(public.app_slugify(v_store_name), '-', left(new.id::text, 6))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES (new.id, new.id, 'owner', 'active')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO public.subscriber_profiles (id, store_name)
  VALUES (new.id, v_store_name)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant_subscriptions ts
    WHERE ts.tenant_id = new.id
  ) THEN
    PERFORM public.create_trial_subscription_for_tenant(new.id, new.id);
  END IF;

  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$
DECLARE
  v_tenant record;
BEGIN
  FOR v_tenant IN
    SELECT t.id
    FROM public.tenants t
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.tenant_subscriptions ts
      WHERE ts.tenant_id = t.id
    )
  LOOP
    PERFORM public.create_trial_subscription_for_tenant(v_tenant.id, v_tenant.id);
  END LOOP;
END $$;
