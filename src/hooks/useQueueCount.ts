/**
 * Hook para obter contagem da fila de retry
 */

import React from 'react';
import { supabase } from '../services/supabaseClient';

export const useQueueCount = () => {
    const [pendingCount, setPendingCount] = React.useState(0);
    const [loading, setLoading] = React.useState(true);

    const refreshCount = React.useCallback(async () => {
        try {
            const { count } = await supabase
                .from('webhook_retry_queue')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            setPendingCount(count || 0);
        } catch (error) {
            console.error('Error fetching queue count:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        refreshCount();

        // Atualizar a cada 30 segundos
        const interval = setInterval(refreshCount, 30000);

        return () => clearInterval(interval);
    }, [refreshCount]);

    return { pendingCount, loading, refreshCount };
};
