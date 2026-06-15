-- Migration: Create Webhook Retry Queue Table
-- Execute this SQL in Supabase Dashboard: SQL Editor

-- Create table for webhook retry queue
CREATE TABLE IF NOT EXISTS webhook_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  cnpj TEXT,
  company TEXT,
  payload JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 10,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_error TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_retry_queue_status ON webhook_retry_queue(status);
CREATE INDEX IF NOT EXISTS idx_retry_queue_next_retry ON webhook_retry_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_retry_queue_order_id ON webhook_retry_queue(order_id);

-- Add comment
COMMENT ON TABLE webhook_retry_queue IS 'Queue for retrying webhook orders that were not immediately available in Tiny API';

-- Verify table was created
SELECT table_name FROM information_schema.tables WHERE table_name = 'webhook_retry_queue';
