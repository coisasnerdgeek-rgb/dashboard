-- ========================================================
-- ATIVAR PEDIDOS PARA APARECEREM NO DASHBOARD
-- Execute no SQL Editor do BANCO NOVO (geabvcqcymaqsqxxfqyw)
-- ========================================================

-- Desmarcar os 10 pedidos mais recentes como ativos
-- para que apareçam no dashboard
UPDATE public.saved_orders
SET archived_date = NULL
WHERE id IN (
  SELECT id 
  FROM public.saved_orders 
  ORDER BY created_at DESC 
  LIMIT 10
);

-- Verificar quantos pedidos ativos temos agora
SELECT COUNT(*) as pedidos_ativos 
FROM public.saved_orders 
WHERE archived_date IS NULL;

-- Ver quais pedidos ficaram ativos
SELECT id, created_at, LEFT(data_json::text, 100) as preview
FROM public.saved_orders 
WHERE archived_date IS NULL
ORDER BY created_at DESC
LIMIT 10;
