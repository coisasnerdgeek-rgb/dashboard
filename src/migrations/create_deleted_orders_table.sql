-- Migration: Create deleted_orders table
-- Description: Stores permanently deleted order IDs to prevent them from reappearing
-- Date: 2026-01-16

-- Create deleted_orders table
CREATE TABLE IF NOT EXISTS public.deleted_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL UNIQUE,
    tiny_id TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_deleted_orders_order_id ON public.deleted_orders(order_id);

-- Add comment
COMMENT ON TABLE public.deleted_orders IS 'Stores IDs of orders that have been deleted to prevent them from reappearing';

-- Enable RLS (Row Level Security)
ALTER TABLE public.deleted_orders ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users"
    ON public.deleted_orders
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create policy to allow read for anon users (if needed)
CREATE POLICY "Allow read for anon users"
    ON public.deleted_orders
    FOR SELECT
    TO anon
    USING (true);
