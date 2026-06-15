-- ========================================================
-- SCRIPT DE CORREÇÃO: TABELA DELETED_ORDERS
-- Execute este script no SQL Editor do seu NOVO projeto Supabase.
-- Isso forçará o banco a reconhecer todas as colunas necessárias.
-- ========================================================

-- 1. Remover a tabela antiga (se houver conflito de cache)
DROP TABLE IF EXISTS public.deleted_orders CASCADE;

-- 2. Recriar com a estrutura completa
CREATE TABLE public.deleted_orders (
    order_id text PRIMARY KEY,
    tiny_id text, -- Added column
    deleted_at timestamp with time zone DEFAULT now(),
    deleted_by text,
    order_data jsonb,
    reason text
);

-- 3. Habilitar permissões
ALTER TABLE public.deleted_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.deleted_orders FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.deleted_orders TO anon, authenticated, service_role;

-- 4. Notificar o sistema para atualizar o cache
NOTIFY pgrst, 'reload schema';
