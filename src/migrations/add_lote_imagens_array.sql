-- Migration: Add imagens array field to lotes table
-- Execute this in Supabase SQL Editor

-- Add imagens column to store array of image URLs
ALTER TABLE lotes 
ADD COLUMN IF NOT EXISTS imagens TEXT[];

-- Comment
COMMENT ON COLUMN lotes.imagens IS 'Array of all image URLs for this lote (supports multiple images per lote)';

-- Migrate existing data: convert single imagem_url to array
UPDATE lotes 
SET imagens = ARRAY[imagem_url]
WHERE imagens IS NULL AND imagem_url IS NOT NULL;
