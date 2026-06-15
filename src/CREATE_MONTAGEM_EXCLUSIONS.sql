-- Criar tabela para armazenar exclusões da tela Montar Pedidos
-- Esta tabela mantém o histórico de pedidos removidos APENAS da visualização de Montar Pedidos
-- Não afeta outras telas (Estampas, Capinhas, etc.)

CREATE TABLE IF NOT EXISTS public.montagem_exclusions (
    id BIGSERIAL PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    excluded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice para busca rápida por order_id
CREATE INDEX IF NOT EXISTS idx_montagem_exclusions_order_id 
ON public.montagem_exclusions(order_id);

-- Criar índice para ordenação por data
CREATE INDEX IF NOT EXISTS idx_montagem_exclusions_excluded_at 
ON public.montagem_exclusions(excluded_at DESC);

-- Comentários
COMMENT ON TABLE public.montagem_exclusions IS 'Armazena IDs de pedidos excluídos da visualização Montar Pedidos (histórico local de remoção)';
COMMENT ON COLUMN public.montagem_exclusions.order_id IS 'ID único do pedido (_uniqueId ou _supabaseId)';
COMMENT ON COLUMN public.montagem_exclusions.excluded_at IS 'Data e hora da exclusão';
