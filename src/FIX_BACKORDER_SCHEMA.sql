-- ========================================================
-- SCRIPT DE CORREÇÃO: TABELA BACKORDERED_ITEMS
-- Execute este script no SQL Editor do seu NOVO projeto Supabase.
-- Isso forçará o banco a reconhecer a coluna data_json.
-- ========================================================

-- 1. Remover a tabela antiga (se houver conflito de cache)
DROP TABLE IF EXISTS public.backordered_items CASCADE;

-- 2. Recriar com a estrutura exata esperada
CREATE TABLE public.backordered_items (
    id text PRIMARY KEY,
    data_json jsonb NOT NULL,
    is_resolved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
    resolved_at timestamp with time zone
);

-- 3. Habilitar permissões
ALTER TABLE public.backordered_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.backordered_items FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.backordered_items TO anon, authenticated, service_role;

-- 4. Notificar o sistema para atualizar o cache
NOTIFY pgrst, 'reload schema';
