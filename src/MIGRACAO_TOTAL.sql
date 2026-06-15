-- ========================================================
-- SCRIPT DE MIGRAÇÃO TOTAL - DASHBOARD DE PEDIDOS
-- Copie e cole este script no SQL Editor do seu NOVO projeto Supabase.
-- ========================================================

-- 1. HABILITAR EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CRIAR TABELAS (ESTRUTURA COMPLETA)

-- Tabela: app_settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Tabela: contacts
CREATE TABLE IF NOT EXISTS public.contacts (
    id TEXT PRIMARY KEY,
    store TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Tabela: delay_rules
CREATE TABLE IF NOT EXISTS public.delay_rules (
    store_name TEXT PRIMARY KEY,
    on_time_days INTEGER NOT NULL,
    at_risk_days INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Tabela: image_categories
CREATE TABLE IF NOT EXISTS public.image_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Tabela: image_mappings
CREATE TABLE IF NOT EXISTS public.image_mappings (
    sku TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    category_id UUID REFERENCES public.image_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Tabela: phone_case_models
CREATE TABLE IF NOT EXISTS public.phone_case_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand TEXT NOT NULL,
    name TEXT NOT NULL,
    in_stock BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    UNIQUE(brand, name)
);

-- Tabela: price_tables
CREATE TABLE IF NOT EXISTS public.price_tables (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    product TEXT NOT NULL,
    sku_product_name TEXT,
    prices_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Tabela: saved_orders (AQUI FICAM OS PEDIDOS MONTADOS)
CREATE TABLE IF NOT EXISTS public.saved_orders (
    id TEXT PRIMARY KEY,
    data_json JSONB NOT NULL,
    archived_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Tabela: spreadsheet_data (HISTÓRICO DE IMPORTAÇÕES)
CREATE TABLE IF NOT EXISTS public.spreadsheet_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    import_date TIMESTAMPTZ NOT NULL,
    row_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: print_control (CONTROLE DE ESTAMPARIA)
CREATE TABLE IF NOT EXISTS public.print_control (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id TEXT NOT NULL UNIQUE,
    item_id TEXT,
    status TEXT DEFAULT 'PENDENTE',
    local_estampa TEXT,
    observacao TEXT,
    data_prevista DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    google_drive_folder_id TEXT,
    google_drive_images JSONB,
    nome_estampa TEXT,
    tratado BOOLEAN DEFAULT false,
    cor TEXT,
    tamanho TEXT,
    data TEXT,
    l TEXT,
    aramado_letra TEXT,
    aramado_numero TEXT,
    rastreio TEXT,
    link_pedido TEXT,
    arte_pronta_id TEXT,
    aramado_data_colocacao TEXT,
    aramado_data_retirada TEXT,
    link TEXT
);

-- Tabela: lotes
CREATE TABLE IF NOT EXISTS public.lotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_lote VARCHAR(20) NOT NULL UNIQUE,
    imagem_url TEXT NOT NULL,
    data_criacao TIMESTAMPTZ DEFAULT now(),
    thumbnail TEXT,
    imagens TEXT[]
);

-- Tabela: sku_mappings
CREATE TABLE IF NOT EXISTS public.sku_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mapping_type TEXT CHECK (mapping_type IN ('product', 'color', 'size', 'brand')),
    mapping_key TEXT NOT NULL,
    mapping_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    UNIQUE(mapping_type, mapping_key)
);

-- Tabela: verification_status
CREATE TABLE IF NOT EXISTS public.verification_status (
    order_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    verified_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    verified_by TEXT
);

-- Tabela: webhook_retry_queue
CREATE TABLE IF NOT EXISTS public.webhook_retry_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL,
    cnpj TEXT,
    company TEXT,
    payload JSONB,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 10,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_error TEXT,
    status TEXT DEFAULT 'pending',
    order_date TEXT
);

-- 3. CRIAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_saved_orders_created_at ON public.saved_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_data_filename ON public.spreadsheet_data(filename);
CREATE INDEX IF NOT EXISTS idx_print_control_order_id ON public.print_control(order_id);
CREATE INDEX IF NOT EXISTS idx_print_control_l ON public.print_control(l);
CREATE INDEX IF NOT EXISTS idx_lotes_numero_lote ON public.lotes(numero_lote);

-- 4. HABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delay_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_case_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreadsheet_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sku_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_retry_queue ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE ACESSO (PERMISSIVO - PÚBLICO)
-- Nota: Ajuste se precisar de autenticação obrigatória
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('CREATE POLICY "Allow all to %I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
        EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, service_role', t);
    END LOOP;
END $$;

-- 6. INSTRUÇÕES PARA DADOS
-- O volume de dados da tabela spreadsheet_data (historico) é grande.
-- Recomendo re-importar suas planilhas no novo Dashboard para economizar tráfego.
-- Abaixo estaria o script para saved_orders e print_control se necessário.

-- Mensagens finais
-- ✅ Estrutura de tabelas criada!
-- ✅ RLS habilitado e políticas criadas!
-- ✅ Extensões e índices configurados!
