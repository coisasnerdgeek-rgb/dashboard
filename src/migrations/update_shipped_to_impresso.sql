-- Migration: Update Estampas status based on Tiny ERP order progression
-- Date: 2026-01-21
-- Purpose: If an order in Tiny has status ENVIADO/A CAMINHO/ENTREGUE/etc,
--          it means it has already been printed, so update print_control to IMPRESSO

-- ============================================
-- STEP 1: PREVIEW - Execute this first to see what will change
-- ============================================
-- This shows exactly which orders will be updated and WHY
-- Run this BEFORE running the UPDATE to confirm it's safe

SELECT 
  pc.order_id,
  pc.status as current_estampas_status,
  so.data_json->>'status' as tiny_status,
  'Will change to IMPRESSO' as action
FROM print_control pc
INNER JOIN saved_orders so ON pc.order_id = so.id
WHERE pc.status != 'IMPRESSO'
  AND (
    so.data_json->>'status' = 'ENVIADO'
    OR so.data_json->>'status' = 'A CAMINHO'
    OR so.data_json->>'status' = 'ENTREGUE'
    OR so.data_json->>'status' = 'Enviado'
    OR so.data_json->>'status' = 'A caminho'
    OR so.data_json->>'status' = 'Entregue'
  )
ORDER BY pc.order_id DESC;

-- ============================================
-- STEP 2: UPDATE - Execute this only after confirming STEP 1 results
-- ============================================
-- This will actually change the data in print_control

-- UPDATE print_control pc
-- SET status = 'IMPRESSO'
-- FROM saved_orders so
-- WHERE pc.order_id = so.id
--   AND pc.status != 'IMPRESSO'
--   AND (
--     so.data_json->>'status' = 'ENVIADO'
--     OR so.data_json->>'status' = 'A CAMINHO'
--     OR so.data_json->>'status' = 'ENTREGUE'
--     OR so.data_json->>'status' = 'Enviado'
--     OR so.data_json->>'status' = 'A caminho'
--     OR so.data_json->>'status' = 'Entregue'
--   );

-- ============================================
-- GARANTIAS DE SEGURANÇA:
-- ============================================
-- ✅ Só muda pedidos que existem nas DUAS tabelas (INNER JOIN)
-- ✅ Só muda se o Tiny tem status ENVIADO/A CAMINHO/ENTREGUE
-- ✅ Não toca em pedidos que JÁ estão como IMPRESSO
-- ✅ Não afeta pedidos com outros status no Tiny (EM APROVAÇÃO, AGUARDANDO ARTE, etc)
-- ============================================
