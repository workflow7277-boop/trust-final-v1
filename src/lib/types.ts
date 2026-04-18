export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type OrderStatus = 'pending' | 'processing' | 'success' | 'failed';
export type MembershipRole = 'owner' | 'admin' | 'billing_manager' | 'member';
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'pending_payment'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'replaced';
export type CheckoutStatus = 'pending' | 'completed' | 'expired' | 'canceled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Database {
  public: {
    Tables: {
      subscriber_profiles: {
        Row: {
          id: string;
          store_name: string;
          store_logo_url: string;
          profit_margin: number;
          platform_api_key: string;
          webhook_url: string;
          currency_symbol: string;
          created_at: string;
          shipping_fee: number;
          free_shipping_threshold: number;
          whatsapp_number: string;
          brand_color: string;
        };
        Insert: {
          id: string;
          store_name?: string;
          store_logo_url?: string;
          profit_margin?: number;
          platform_api_key?: string;
          webhook_url?: string;
          currency_symbol?: string;
          created_at?: string;
          shipping_fee?: number;
          free_shipping_threshold?: number;
          whatsapp_number?: string;
          brand_color?: string;
        };
        Update: {
          id?: string;
          store_name?: string;
          store_logo_url?: string;
          profit_margin?: number;
          platform_api_key?: string;
          webhook_url?: string;
          currency_symbol?: string;
          created_at?: string;
          shipping_fee?: number;
          free_shipping_threshold?: number;
          whatsapp_number?: string;
          brand_color?: string;
        };
      };
      products: {
        Row: {
          id: string;
          subscriber_id: string;
          name: string;
          description: string;
          image_url: string;
          original_price: number;
          category: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscriber_id: string;
          name: string;
          description?: string;
          image_url?: string;
          original_price: number;
          category?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          subscriber_id?: string;
          name?: string;
          description?: string;
          image_url?: string;
          original_price?: number;
          category?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          subscriber_id: string;
          product_id: string | null;
          product_name: string;
          customer_name: string;
          customer_phone: string;
          customer_address: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          status: OrderStatus;
          webhook_sent: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscriber_id: string;
          product_id?: string | null;
          product_name: string;
          customer_name: string;
          customer_phone: string;
          customer_address: string;
          quantity?: number;
          unit_price: number;
          total_price: number;
          status?: OrderStatus;
          webhook_sent?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          subscriber_id?: string;
          product_id?: string | null;
          product_name?: string;
          customer_name?: string;
          customer_phone?: string;
          customer_address?: string;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          status?: OrderStatus;
          webhook_sent?: boolean;
          created_at?: string;
        };
      };
      tenants: {
        Row: {
          id: string;
          owner_user_id: string;
          name: string;
          slug: string;
          status: 'active' | 'suspended' | 'archived';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          owner_user_id: string;
          name?: string;
          slug: string;
          status?: 'active' | 'suspended' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          name?: string;
          slug?: string;
          status?: 'active' | 'suspended' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
      };
      tenant_memberships: {
        Row: {
          tenant_id: string;
          user_id: string;
          role: MembershipRole;
          status: 'active' | 'invited' | 'suspended';
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          user_id: string;
          role?: MembershipRole;
          status?: 'active' | 'invited' | 'suspended';
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          user_id?: string;
          role?: MembershipRole;
          status?: 'active' | 'invited' | 'suspended';
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscription_plans: {
        Row: {
          plan_code: string;
          plan_name: string;
          description: string;
          tier_level: number;
          price_egp: number;
          billing_interval: 'trial' | 'month';
          trial_duration_hours: number;
          product_limit: number | null;
          monthly_order_limit: number | null;
          member_limit: number | null;
          feature_flags: Record<string, boolean>;
          is_public: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          plan_code: string;
          plan_name: string;
          description?: string;
          tier_level: number;
          price_egp?: number;
          billing_interval: 'trial' | 'month';
          trial_duration_hours?: number;
          product_limit?: number | null;
          monthly_order_limit?: number | null;
          member_limit?: number | null;
          feature_flags?: Record<string, boolean>;
          is_public?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          plan_code?: string;
          plan_name?: string;
          description?: string;
          tier_level?: number;
          price_egp?: number;
          billing_interval?: 'trial' | 'month';
          trial_duration_hours?: number;
          product_limit?: number | null;
          monthly_order_limit?: number | null;
          member_limit?: number | null;
          feature_flags?: Record<string, boolean>;
          is_public?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
      };
      tenant_subscriptions: {
        Row: {
          id: string;
          tenant_id: string;
          plan_code: string;
          status: SubscriptionStatus;
          payment_provider: string;
          provider_subscription_ref: string | null;
          provider_customer_ref: string | null;
          started_at: string;
          trial_started_at: string | null;
          trial_ends_at: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          ended_at: string | null;
          replaced_by_subscription_id: string | null;
          created_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          plan_code: string;
          status: SubscriptionStatus;
          payment_provider?: string;
          provider_subscription_ref?: string | null;
          provider_customer_ref?: string | null;
          started_at?: string;
          trial_started_at?: string | null;
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          ended_at?: string | null;
          replaced_by_subscription_id?: string | null;
          created_by?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          plan_code?: string;
          status?: SubscriptionStatus;
          payment_provider?: string;
          provider_subscription_ref?: string | null;
          provider_customer_ref?: string | null;
          started_at?: string;
          trial_started_at?: string | null;
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          ended_at?: string | null;
          replaced_by_subscription_id?: string | null;
          created_by?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscription_checkout_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          plan_code: string;
          initiated_by: string | null;
          provider: string;
          amount_egp: number;
          currency: string;
          status: CheckoutStatus;
          expires_at: string;
          completed_at: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          plan_code: string;
          initiated_by?: string | null;
          provider?: string;
          amount_egp?: number;
          currency?: string;
          status?: CheckoutStatus;
          expires_at?: string;
          completed_at?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          plan_code?: string;
          initiated_by?: string | null;
          provider?: string;
          amount_egp?: number;
          currency?: string;
          status?: CheckoutStatus;
          expires_at?: string;
          completed_at?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      subscription_payments: {
        Row: {
          id: string;
          tenant_id: string;
          subscription_id: string | null;
          checkout_session_id: string | null;
          plan_code: string;
          amount_egp: number;
          currency: string;
          provider: string;
          payment_method: string;
          status: PaymentStatus;
          provider_payment_ref: string | null;
          paid_at: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          subscription_id?: string | null;
          checkout_session_id?: string | null;
          plan_code: string;
          amount_egp?: number;
          currency?: string;
          provider?: string;
          payment_method?: string;
          status?: PaymentStatus;
          provider_payment_ref?: string | null;
          paid_at?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          subscription_id?: string | null;
          checkout_session_id?: string | null;
          plan_code?: string;
          amount_egp?: number;
          currency?: string;
          provider?: string;
          payment_method?: string;
          status?: PaymentStatus;
          provider_payment_ref?: string | null;
          paid_at?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
    };
  };
}

export type SubscriberProfile = Database['public']['Tables']['subscriber_profiles']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type TenantMembership = Database['public']['Tables']['tenant_memberships']['Row'];
export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];
export type TenantSubscription = Database['public']['Tables']['tenant_subscriptions']['Row'];
export type SubscriptionCheckoutSession = Database['public']['Tables']['subscription_checkout_sessions']['Row'];
export type SubscriptionPayment = Database['public']['Tables']['subscription_payments']['Row'];

export interface SubscriptionSummary {
  tenant_id: string;
  subscription: {
    id: string;
    plan_code: string;
    status: SubscriptionStatus;
    payment_provider: string;
    trial_ends_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    canceled_at: string | null;
  } | null;
  plan: {
    plan_code: string;
    plan_name: string;
    description: string;
    price_egp: number;
    billing_interval: 'trial' | 'month';
    tier_level: number;
    product_limit: number | null;
    monthly_order_limit: number | null;
    member_limit: number | null;
    feature_flags: Record<string, boolean>;
  } | null;
  usage: {
    products_count: number;
    orders_this_month: number;
    members_count: number;
  };
  storefront_available: boolean;
}

export interface TenantContext {
  tenant_id: string | null;
  membership_role: MembershipRole | null;
  is_platform_admin: boolean;
  tenant: Tenant | null;
  profile: SubscriberProfile | null;
  subscription_summary: SubscriptionSummary | null;
}

export interface CheckoutPayload {
  checkout_session_id: string;
  status: CheckoutStatus;
  provider: string;
  amount_egp: number;
  currency: string;
  expires_at: string;
  plan_code: string;
}

export interface AdminTenantSubscriptionRow {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  owner_user_id: string;
  subscription_status: string;
  plan_code: string | null;
  plan_name: string | null;
  price_egp: number | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  products_count: number;
  orders_this_month: number;
  members_count: number;
}

export type AppPage = 'dashboard' | 'settings' | 'products' | 'storefront' | 'billing' | 'admin' | 'auth';
