/*
  # Add Currency Symbol to Subscriber Profiles

  1. Changes
    - Add `currency_symbol` column to `subscriber_profiles` table with default value '$'
  2. Security
    - No new security changes, existing RLS policies apply
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriber_profiles' AND column_name = 'currency_symbol'
  ) THEN
    ALTER TABLE subscriber_profiles ADD COLUMN currency_symbol text NOT NULL DEFAULT '$';
  END IF;
END $$;
