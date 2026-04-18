export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

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
          // الخانات الجديدة اللي ضفناها
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
          status: 'pending' | 'processing' | 'success' | 'failed';
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
          status?: 'pending' | 'processing' | 'success' | 'failed';
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
          status?: 'pending' | 'processing' | 'success' | 'failed';
          webhook_sent?: boolean;
          created_at?: string;
        };
      };
    };
  };
}

export type SubscriberProfile = Database['public']['Tables']['subscriber_profiles']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];

export type AppPage = 'dashboard' | 'settings' | 'products' | 'storefront' | 'auth';
