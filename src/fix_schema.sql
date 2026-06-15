-- Ensure backordered_items table has the correct schema
-- This script adds the is_resolved column if it doesn't exist
-- and ensuring the resolved_at column is present.

DO $$ 
BEGIN
    -- Check for is_resolved column
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'backordered_items' AND column_name = 'is_resolved'
    ) THEN
        ALTER TABLE backordered_items ADD COLUMN is_resolved BOOLEAN DEFAULT FALSE;
    END IF;

    -- Check for resolved_at column
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'backordered_items' AND column_name = 'resolved_at'
    ) THEN
        ALTER TABLE backordered_items ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Sync existing data if necessary (if 'resolved' was being used instead)
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'backordered_items' AND column_name = 'resolved'
    ) THEN
        UPDATE backordered_items SET is_resolved = resolved WHERE is_resolved IS NULL;
    END IF;
END $$;
