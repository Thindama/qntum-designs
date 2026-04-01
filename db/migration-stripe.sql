-- Migration: Add Stripe fields to profiles
-- Run this in Supabase SQL Editor if you already have the profiles table

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
