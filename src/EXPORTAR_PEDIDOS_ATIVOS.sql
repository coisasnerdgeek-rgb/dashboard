-- ========================================================
-- EXPORTAR OS 5 PEDIDOS ATIVOS (SEM ARCHIVED_DATE)
-- Execute no SQL Editor do BANCO ANTIGO (nbxubdmsepnhhhsbpzoq)
-- ========================================================

-- Confirmar quantos pedidos ativos existem
SELECT COUNT(*) as total_ativos FROM public.saved_orders WHERE archived_date IS NULL;

-- Ver quais são os pedidos ativos
SELECT id, created_at, LEFT(data_json::text, 100) as preview
FROM public.saved_orders 
WHERE archived_date IS NULL
ORDER BY created_at DESC;

-- Exportar os pedidos ativos em formato INSERT
SELECT 
    'INSERT INTO public.saved_orders (archived_date, created_at, data_json, id, updated_at) VALUES' || E'\n' ||
    string_agg(
        format(
            '(%L, %L, %L, %L, %L)',
            archived_date,
            created_at,
            data_json::text,
            id,
            updated_at
        ),
        ',' || E'\n'
    ) || E'\nON CONFLICT (id) DO UPDATE SET\n' ||
    '  archived_date = EXCLUDED.archived_date,\n' ||
    '  created_at = EXCLUDED.created_at,\n' ||
    '  data_json = EXCLUDED.data_json,\n' ||
    '  updated_at = EXCLUDED.updated_at;'
FROM public.saved_orders
WHERE archived_date IS NULL;
