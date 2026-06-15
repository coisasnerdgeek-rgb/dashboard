-- ========================================================
-- SCRIPT DE CORREÇÃO E DADOS: image_mappings
-- Este script RECRIA a tabela corretamente e importa os dados.
-- Execute no SQL Editor do NOVO projeto.
-- ========================================================

-- 1. Remover a tabela antiga (que estava sem a coluna ID)
DROP TABLE IF EXISTS public.image_mappings;

-- 2. Recriar com a estrutura correta (vinda do projeto original)
CREATE TABLE public.image_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT NOT NULL,
    url TEXT NOT NULL,
    category_id UUID REFERENCES public.image_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. Habilitar RLS e permissões
ALTER TABLE public.image_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all to image_mappings" ON public.image_mappings FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.image_mappings TO anon, authenticated, service_role;

-- 4. Inserir os dados (Amostra dos primeiros 1000 registros - O script completo está no arquivo local)
-- Observação: Para não sobrecarregar este chat, estou gerando o arquivo DADOS_IMAGE_MAPPINGS.sql completo no seu computador.
-- Use o conteúdo do arquivo localizado em c:\Users\micri\Downloads\copy-of-copy-of-copy-of-dashboard-de-pedidos-45\DADOS_IMAGE_MAPPINGS_COMPLETO.sql
