-- ========================================================
-- EXPORTAR DADOS DE WEBHOOK_RETRY_QUEUE
-- Execute no SQL Editor do BANCO ANTIGO (nbxubdmsepnhhhsbpzoq)
-- ========================================================

-- PASSO 1: Ver a estrutura da tabela
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'webhook_retry_queue'
ORDER BY ordinal_position;

-- PASSO 2: Ver quantos registros existem
SELECT COUNT(*) as total FROM public.webhook_retry_queue;

-- PASSO 3: Ver alguns exemplos para entender a estrutura
SELECT * FROM public.webhook_retry_queue LIMIT 3;
