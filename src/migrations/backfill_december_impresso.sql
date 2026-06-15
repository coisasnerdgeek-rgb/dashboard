-- Migration: Backfill December 2025 orders to IMPRESSO
-- Purpose: Update print_control status for orders from December that are already shipped/delivered in Tiny

-- STEP 1: PREVIEW (Safe to run anytime)
-- This will show you which orders will be updated
SELECT 
  pc.order_id,
  pc.status as db_status,
  so.data_json->>'status' as tiny_status,
  so.created_at as imported_at
FROM print_control pc
INNER JOIN saved_orders so ON pc.order_id = so.id
WHERE (pc.status = 'FAZER ARTE' OR pc.status IS NULL)
  AND (
    so.data_json->>'status' ILIKE '%enviado%' 
    OR so.data_json->>'status' ILIKE '%entregue%' 
    OR so.data_json->>'status' ILIKE '%a caminho%'
  )
  -- Filtro para Dezembro de 2025 (considerando a data de importação no sistema)
  AND so.created_at >= '2025-12-01' 
  AND so.created_at < '2026-01-01'
ORDER BY so.created_at DESC;

-- STEP 2: UPDATE (Uncomment and run to apply changes)
/*
UPDATE print_control pc
SET status = 'IMPRESSO'
FROM saved_orders so
WHERE pc.order_id = so.id
  AND (pc.status = 'FAZER ARTE' OR pc.status IS NULL)
  AND (
    so.data_json->>'status' ILIKE '%enviado%' 
    OR so.data_json->>'status' ILIKE '%entregue%' 
    OR so.data_json->>'status' ILIKE '%a caminho%'
  )
  AND so.created_at >= '2025-12-01' 
  AND so.created_at < '2026-01-01';
*/
