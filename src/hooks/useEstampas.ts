import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEstampasStatus, saveEstampasStatus, saveBulkEstampasStatus } from '../services/supabaseService';
import { supabase } from '../services/supabaseClient';
import { EstampaRow } from '../types';

/**
 * Hook customizado para gerenciar o status das estampas (print_control).
 * Centraliza a busca e atualização dos dados de produção.
 */
export const useEstampas = () => {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['estampasStatus'],
        queryFn: getEstampasStatus,
    });

    const mutation = useMutation({
        mutationFn: ({ orderId, status }: { orderId: string, status: Partial<EstampaRow> }) =>
            saveEstampasStatus(orderId, status),
        onMutate: async (newUpdate) => {
            await queryClient.cancelQueries({ queryKey: ['estampasStatus'] });
            const previousStatus = queryClient.getQueryData<Record<string, Partial<EstampaRow>>>(['estampasStatus']);

            if (previousStatus) {
                queryClient.setQueryData<Record<string, Partial<EstampaRow>>>(['estampasStatus'], {
                    ...previousStatus,
                    [newUpdate.orderId]: {
                        ...(previousStatus[newUpdate.orderId] || {}),
                        ...newUpdate.status,
                    },
                });
            }

            return { previousStatus };
        },
        onError: (err, newUpdate, context) => {
            if (context?.previousStatus) {
                queryClient.setQueryData(['estampasStatus'], context.previousStatus);
            }
            console.error('Falha ao atualizar status da estampa:', err);
        },
        onSettled: (data, error, variables, context) => {
            // Apenas invalida se não houver outras mutações pendentes para evitar snap-back
            if (queryClient.isMutating({ mutationKey: ['estampasStatus'] }) === 0) {
                queryClient.invalidateQueries({ queryKey: ['estampasStatus'] });
            }
        },
    });

    const bulkMutation = useMutation({
        mutationKey: ['estampasStatus'], // Adicionado para rastreamento de isMutating
        mutationFn: async (updates: { orderId: string, status: Partial<EstampaRow> }[]) => {
            console.log('[useEstampas] Iniciando saveBulkEstampasStatus com', updates.length, 'atualizações');
            console.log('[useEstampas] Updates:', JSON.stringify(updates, null, 2));
            const result = await saveBulkEstampasStatus(updates);
            console.log('[useEstampas] saveBulkEstampasStatus completado com sucesso');
            return result;
        },
        onMutate: async (updates) => {
            console.log('[useEstampas] onMutate: Aplicando optimistic updates');
            await queryClient.cancelQueries({ queryKey: ['estampasStatus'] });
            const previousStatus = queryClient.getQueryData<Record<string, Partial<EstampaRow>>>(['estampasStatus']);

            if (previousStatus) {
                const newStatus = { ...previousStatus };
                updates.forEach(u => {
                    newStatus[u.orderId] = {
                        ...(newStatus[u.orderId] || {}),
                        ...u.status,
                    };
                });
                queryClient.setQueryData(['estampasStatus'], newStatus);
                console.log('[useEstampas] onMutate: Cache atualizado com sucesso');
            }

            return { previousStatus };
        },
        onError: (err: any, updates, context) => {
            console.error('[useEstampas] ❌ ERRO na mutation:', err);
            console.error('[useEstampas] Detalhes do erro:', {
                message: err?.message,
                code: err?.code,
                details: err?.details,
                hint: err?.hint
            });
            if (context?.previousStatus) {
                queryClient.setQueryData(['estampasStatus'], context.previousStatus);
                console.log('[useEstampas] onError: Cache revertido para estado anterior');
            }

            // Importar dinamicamente toast para mostrar erro ao usuário
            import('react-hot-toast').then(({ default: toast }) => {
                toast.error(`Erro ao salvar: ${err?.message || 'Erro desconhecido'}`, {
                    duration: 5000
                });
            });
        },
        onSettled: () => {
            console.log('[useEstampas] onSettled: Verificando invalidação de queries');
            // Don't check isMutating here, just invalidate after a brief delay
            // The real-time handler will skip if there are OTHER pending mutations
            setTimeout(() => {
                console.log('[useEstampas] ✅ Invalidando queries para refetch');
                queryClient.invalidateQueries({ queryKey: ['estampasStatus'] });
            }, 100);
        },
    });

    // 🔄 REAL-TIME UPDATES: DISABLED to save Supabase Free Tier resources
    // To re-enable, uncomment the useEffect below.
    /*
    React.useEffect(() => {
        let debounceTimer: NodeJS.Timeout;

        console.log('[useEstampas] 🔄 Iniciando subscription Realtime...');

        const channel = supabase
            .channel('print_control_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'print_control'
                },
                (payload: any) => {
                    console.log('[useEstampas] 🔔 Realtime event received:', payload.eventType, payload.new?.order_id);

                    // 🔴 CRITICAL FIX: Don't refetch if we have pending mutations!
                    // This prevents race condition where refetch overwrites unsaved edits
                    const pendingMutations = queryClient.isMutating({ mutationKey: ['estampasStatus'] });
                    if (pendingMutations > 0) {
                        console.log('[useEstampas] ⚠️ Ignorando evento Realtime - temos', pendingMutations, 'mutações pendentes');
                        return;
                    }

                    // Debounce: aguarda 5s antes de invalidar (evita refetch excessivo)
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        console.log('[useEstampas] ⚡ Invalidando queries após mudança Realtime');
                        queryClient.invalidateQueries({ queryKey: ['estampasStatus'] });
                    }, 5000);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[useEstampas] ✅ Realtime subscription ativa!');
                } else if (status === 'CHANNEL_ERROR') {
                    // Suppress error log to avoid traffic concerns as requested by user
                    // console.error('[useEstampas] ❌ Erro na subscription Realtime'); 
                } else {
                    // console.log('[useEstampas] Realtime status:', status);
                }
            });

        return () => {
            console.log('[useEstampas] 🔌 Desconectando Realtime subscription');
            clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, [queryClient]);
    */

    return {
        ...query,
        updateStatus: mutation.mutate,
        bulkUpdateStatus: bulkMutation.mutate,
        isUpdating: mutation.isPending || bulkMutation.isPending,
        estampasStatus: query.data || {},
    };
};
