import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSpreadsheetData } from '../services/supabaseService';
import { supabase } from '../services/supabaseClient';
import { TableRow } from '../types';
import { useMemo, useEffect } from 'react';

/**
 * Hook customizado para gerenciar os dados dos pedidos (spreadsheet data).
 * Utiliza TanStack Query para cache e sincronização com o Supabase.
 */
export const useOrders = () => {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['spreadsheetData'],
        queryFn: getSpreadsheetData,
        staleTime: Infinity, // Dados considerados sempre frescos para evitar reload automático
        refetchOnWindowFocus: false, // Não recarregar ao focar na janela
    });

    // 🔄 REAL-TIME UPDATES: DISABLED to save Supabase Free Tier resources
    /*
    useEffect(() => {
        let debounceTimer: NodeJS.Timeout;

        console.log('[useOrders] 🔄 Iniciando subscription Realtime para spreadsheet_data...');

        const channel = supabase
            .channel('spreadsheet_data_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'spreadsheet_data'
                },
                (payload: any) => {
                    console.log('[useOrders] 🔔 Realtime event received:', payload.eventType);

                    // Debounce: aguarda 5s antes de invalidar (evita refetch excessivo durante imports)
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        console.log('[useOrders] ⚡ Invalidando queries após mudança Realtime');
                        queryClient.invalidateQueries({ queryKey: ['spreadsheetData'] });
                    }, 5000);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[useOrders] ✅ Realtime subscription ativa para pedidos!');
                }
            });

        return () => {
            clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, [queryClient]);
    */

    // Mapeia os dados brutos para o formato allRows e extrai os headers
    const allRows = useMemo(() => {
        if (!query.data) return [];
        return Object.values(query.data).flatMap((d: { rows: TableRow[] }) => d.rows);
    }, [query.data]);

    const headers = useMemo(() => {
        if (!query.data) return [];
        const allHeaders = new Set<string>();
        Object.values(query.data).forEach(file => {
            if (file.rows.length > 0) {
                Object.keys(file.rows[0]).forEach(h => allHeaders.add(h));
            }
        });
        return Array.from(allHeaders);
    }, [query.data]);

    return {
        ...query,
        allRows,
        headers,
        data: query.data || {}
    };
};
