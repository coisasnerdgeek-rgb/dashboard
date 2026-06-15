-- ========================================================
-- SCRIPT PARA DESMARCAR PEDIDOS COMO ARQUIVADOS
-- Isto vai fazer os 128 pedidos aparecerem no dashboard
-- ========================================================

-- Atualizar todos os pedidos para archived_date = NULL
UPDATE public.saved_orders
SET archived_date = NULL
WHERE archived_date IS NOT NULL;

-- Verificar quantos foram atualizados
SELECT COUNT(*) as total_pedidos_ativos
FROM public.saved_orders
WHERE archived_date IS NULL;
