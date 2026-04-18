
/*
  # Trust SaaS E-commerce Platform - Initial Schema

  ## Overview
  Creates the full database schema for the Trust multi-tenant SaaS e-commerce platform.

  ## New Tables

  ### 1. `subscriber_profiles`
  Extends auth.users with store-specific settings for each subscriber.
  - `id` - References auth.users, primary key
  - `store_name` - The name of the subscriber's store
  - `store_logo_url` - URL for the store logo
  - `profit_margin` - Percentage markup applied to product prices (default 0)
  - `platform_api_key` - API key for target platform integration
  - `webhook_url` - n8n webhook URL for order processing
  - `created_at` - Timestamp

  ### 2. `products`
  Products managed by each subscriber's store.
  - `id` - UUID primary key
  - `subscriber_id` - FK to subscriber_profiles
  - `name` - Product name
  - `description` - Product description
  - `image_url` - Product image URL
  - `original_price` - Base price before margin
  - `category` - Product category
  - `is_active` - Whether the product is visible in the storefront
  - `created_at` - Timestamp

  ### 3. `orders`
  Customer orders placed through storefronts.
  - `id` - UUID primary key
  - `subscriber_id` - FK to subscriber_profiles
  - `product_id` - FK to products
  - `product_name` - Snapshot of product name at order time
  - `customer_name` - Customer full name
  - `customer_phone` - Customer phone number
  - `customer_address` - Customer delivery address
  - `quantity` - Number of items ordered
  - `unit_price` - Price per unit at order time (with margin applied)
  - `total_price` - Total order value
  - `status` - Order status: pending, processing, success, failed
  - `webhook_sent` - Whether the order was sent to the n8n webhook
  - `created_at` - Timestamp

  ## Security
  - RLS enabled on all tables
  - Subscribers can only read/write their own data
  - Public storefront can insert orders (anonymous)
  - Public can read active products by subscriber
*/

-- Subscriber Profiles Table
CREATE TABLE IF NOT EXISTS subscriber_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name text NOT NULL DEFAULT 'My Store',
  store_logo_url text DEFAULT '',
  profit_margin numeric(5,2) NOT NULL DEFAULT 0,
  platform_api_key text DEFAULT '',
  webhook_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscriber_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscribers can view own profile"
  ON subscriber_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Subscribers can insert own profile"
  ON subscriber_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Subscribers can update own profile"
  ON subscriber_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Public can read store info for storefronts
CREATE POLICY "Public can read store profiles"
  ON subscriber_profiles FOR SELECT
  TO anon
  USING (true);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES subscriber_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  original_price numeric(10,2) NOT NULL DEFAULT 0,
  category text DEFAULT 'General',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscribers can view own products"
  ON products FOR SELECT
  TO authenticated
  USING (auth.uid() = subscriber_id);

CREATE POLICY "Subscribers can insert own products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "Subscribers can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING (auth.uid() = subscriber_id)
  WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "Subscribers can delete own products"
  ON products FOR DELETE
  TO authenticated
  USING (auth.uid() = subscriber_id);

-- Public can read active products for storefronts
CREATE POLICY "Public can read active products"
  ON products FOR SELECT
  TO anon
  USING (is_active = true);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES subscriber_profiles(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  webhook_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscribers can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = subscriber_id);

CREATE POLICY "Subscribers can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = subscriber_id)
  WITH CHECK (auth.uid() = subscriber_id);

-- Public (storefront customers) can insert orders
CREATE POLICY "Public can insert orders"
  ON orders FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated can also insert (for testing)
CREATE POLICY "Authenticated can insert orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_subscriber_id ON products(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_orders_subscriber_id ON orders(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Function to auto-create subscriber profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.subscriber_profiles (id, store_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'store_name', 'My Store'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Seed some sample products for demo (will be associated with first user who signs up)
-- Note: These are just structure examples; actual data will be created per subscriber
