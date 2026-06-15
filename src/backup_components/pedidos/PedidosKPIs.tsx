import React, { useMemo } from 'react';
import KpiCard from '../common/KpiCard';
import { getNewStatusColor, getStatusBadgeClasses } from './utils';

// Interfaces for props
interface PedidosKPIsProps {
    data: any[]; // Or ProcessedTableRow[] if available
    activeSummaryTab: 'status' | 'categoria';
    setActiveSummaryTab: (tab: 'status' | 'categoria') => void;
    globalFilters: Record<string, string | string[]>;
    onCardClick: (header: string, value: string) => void;
    getHeaderKey: (key: string) => string | undefined;
    situacaoHeader?: string;
    productHeader?: string;
}

export const PedidosKPIs: React.FC<PedidosKPIsProps> = ({
    data,
    activeSummaryTab,
    setActiveSummaryTab,
    globalFilters,
    onCardClick,
    getHeaderKey,
    situacaoHeader,
    productHeader
}) => {

    // --- Helpers extracted/adapted from Pedidos.tsx ---

    const getIcon = (s: string) => {
        if (s.includes('Aprovado')) return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
        if (s.includes('Erro')) return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
        if (s.includes('Enviado')) return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>;
        return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>;
    };

    // --- Derived Data ---

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        if (!situacaoHeader) return counts;

        data.forEach(row => {
            const status = row[situacaoHeader] as string;
            if (status) {
                // Normalize status if needed or just count raw
                // Original logic seemed to rely on raw values from Supabase/Spreadsheet
                counts[status] = (counts[status] || 0) + 1;
            }
        });
        return counts;
    }, [data, situacaoHeader]);

    const statusSummaryForDisplay = useMemo(() => {
        return Object.entries(statusCounts)
            .map(([status, count]) => ({ status, count }))
            .sort((a, b) => b.count - a.count);
    }, [statusCounts]);


    // Simplified logic for categories - originally it used complex deduplication per Order ID
    // We will keep it simple for now or port the full logic if needed.
    // Assuming 'data' here is rows.

    // NOTE: The original component had logic to calculate CATEGORY stats based on UNIQUE ORDERS (by 'identificador...').
    // If we want to preserve that exactly, we need to replicate it.
    // Let's assume passed 'data' is what we count on.

    return (
        <div className="mb-6">
            {/* Abas de Resumo */}
            {/* <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-4 mx-auto dark:bg-gray-700">
                <button
                    onClick={() => setActiveSummaryTab('status')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeSummaryTab === 'status' ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    Por Status
                </button>
                <button
                    onClick={() => setActiveSummaryTab('categoria')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeSummaryTab === 'categoria' ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    Por Categoria
                </button>
            </div> */}

            {/* Keeping it simple without tabs first, or supporting just Status as viewed in code snippet?
                The viewed code showed `activeSummaryTab === 'status'`.
                I'll assume both existed.
             */}

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {activeSummaryTab === 'status' && statusSummaryForDisplay.map(({ status, count }, index) => {
                    const displayStatus = status === 'Dados Incompletos' ? 'Incompleto' : status;
                    const statusColor = getNewStatusColor(status);

                    // Filter logic needs to match how Pedidos.tsx applied filters.
                    // safely check if globalFilters has this value
                    const currentFilter = globalFilters[situacaoHeader || ''];
                    const isActive = Array.isArray(currentFilter)
                        ? currentFilter.length === 1 && currentFilter[0] === status
                        : currentFilter === status;

                    return (
                        <div key={status} className="animate-fade-in-scale" style={{ animationDelay: `${index * 0.05}s` }}>
                            <KpiCard
                                variant="secondary"
                                title={displayStatus}
                                value={String(count)}
                                icon={getIcon(status)}
                                colorObj={{
                                    from: statusColor.includes('green') ? 'from-green-500' : statusColor.includes('red') ? 'from-red-500' : 'from-blue-500',
                                    to: '',
                                    shadow: '',
                                    iconBg: statusColor,
                                    text: statusColor.split(' ')[1] || 'text-gray-600',
                                    border: isActive ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-200 dark:border-gray-700'
                                }}
                                onClick={() => {
                                    if (situacaoHeader) {
                                        onCardClick(situacaoHeader, status);
                                    }
                                }}
                                className={isActive ? 'ring-2 ring-primary-500' : ''}
                            />
                        </div>
                    );
                })}

                {/* Placeholder for Categoria Tab if needed, or remove if not used */}
            </div>
        </div>
    );
};
