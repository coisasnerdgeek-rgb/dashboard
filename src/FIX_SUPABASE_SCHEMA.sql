-- ========================================================
-- SCRIPT DE CORREÇÃO COMPLETA: TABELAS FALTANTES E ESQUEMA
-- Copie e cole este script no SQL Editor do Supabase
-- ========================================================

-- 1. CRIAR TABELAS FALTANTES

-- Tabela: backordered_items
CREATE TABLE IF NOT EXISTS public.backordered_items (
    id TEXT PRIMARY KEY,
    data_json JSONB NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Tabela: payments
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    data_json JSONB NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE, -- Alias para garantir compatibilidade
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Tabela: deleted_orders
CREATE TABLE IF NOT EXISTS public.deleted_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL UNIQUE,
    tiny_id TEXT,
    deleted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Tabela: whatsapp_contacts (Caso seja usada por algum componente legado)
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store TEXT,
    name TEXT,
    phone TEXT,
    email TEXT,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. CORREÇÃO DE COLUNAS EM TABELAS EXISTENTES

-- Tabela: verification_status
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'verification_status' AND column_name = 'status_json'
    ) THEN
        ALTER TABLE verification_status ADD COLUMN status_json JSONB;
    END IF;
END $$;

-- 3. HABILITAR RLS E POLÍTICAS PARA NOVAS TABELAS
ALTER TABLE public.backordered_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t text;
    tables_to_fix text[] := ARRAY['backordered_items', 'payments', 'deleted_orders', 'whatsapp_contacts'];
BEGIN
    FOREACH t IN ARRAY tables_to_fix
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all to %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Allow all to %I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
        EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, service_role', t);
    END LOOP;
END $$;
