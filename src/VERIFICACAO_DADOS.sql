-- ========================================================
-- SCRIPT DE VERIFICAÇÃO DE DADOS E ESTRUTURA
-- Execute no SQL Editor do Supabase
-- ========================================================

-- 1. PRIMEIRO: Listar TODAS as tabelas que existem no schema public
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Contar registros em saved_orders (se existir)
SELECT COUNT(*) as total_saved_orders FROM public.saved_orders;

-- 3. Ver exemplos de saved_orders
SELECT id, created_at, archived_date, LEFT(data_json::text, 100) as preview
FROM public.saved_orders
ORDER BY created_at DESC
LIMIT 3;

-- 4. Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
