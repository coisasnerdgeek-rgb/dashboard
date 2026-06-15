-- ================================================
-- Lote-Pedido Linking Enhancement
-- ================================================
-- This migration adds performance optimizations and utility functions 
-- for the lote-to-pedido linking feature

-- 1. Add index on print_control.L column for faster lote queries
-- This significantly improves performance when filtering pedidos by lote
CREATE INDEX IF NOT EXISTS idx_print_control_l ON print_control(l);

-- 2. Create function to get lote statistics
-- Returns aggregated statistics for a given lote number
CREATE OR REPLACE FUNCTION get_lote_stats(p_lote_numero text)
RETURNS TABLE (
    lote_numero text,
    total_pedidos bigint,
    status_breakdown jsonb
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p_lote_numero AS lote_numero,
        COUNT(*) AS total_pedidos,
        jsonb_object_agg(
            COALESCE(status, 'SEM STATUS'),
            status_count
        ) AS status_breakdown
    FROM (
        SELECT 
            status,
            COUNT(*) AS status_count
        FROM print_control
        WHERE l = p_lote_numero
        GROUP BY status
    ) subquery;
END;
$$;

-- 3. Create function to get all lotes with their pedido counts
-- Useful for dashboard views
CREATE OR REPLACE FUNCTION get_all_lotes_with_counts()
RETURNS TABLE (
    numero_lote text,
    pedido_count bigint,
    imagem_url text,
    thumbnail text,
    data_criacao timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.numero_lote,
        COUNT(pc.order_id) AS pedido_count,
        l.imagem_url,
        l.thumbnail,
        l.data_criacao
    FROM lotes l
    LEFT JOIN print_control pc ON l.numero_lote = pc.l
    GROUP BY l.numero_lote, l.imagem_url, l.thumbnail, l.data_criacao
    ORDER BY l.data_criacao DESC;
END;
$$;

-- 4. Create index on print_control.order_id for faster lookups
-- Ensures unique constraint and speeds up bulk operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_print_control_order_id ON print_control(order_id);

-- Grant necessary permissions (adjust based on your RLS policies)
-- These functions should be accessible to authenticated users
GRANT EXECUTE ON FUNCTION get_lote_stats(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_lotes_with_counts() TO authenticated;

-- Add comments for documentation
COMMENT ON INDEX idx_print_control_l IS 'Index for faster lote-based queries on print_control table';
COMMENT ON FUNCTION get_lote_stats(text) IS 'Returns total pedidos and status breakdown for a given lote number';
COMMENT ON FUNCTION get_all_lotes_with_counts() IS 'Returns all lotes with their respective pedido counts';
