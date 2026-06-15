import React, { useMemo } from 'react';
import KpiCard from '../common/KpiCard';
import { getNewStatusColor, getStatusBadgeClasses } from './utils';

interface PedidosKPIsProps {
    data: any[];
    globalFilters: Record<string, string | string[]>;
    onFiltersChange: (filters: Record<string, string | string[]>) => void;
    situacaoHeader: string;
}

export const PedidosKPIs: React.FC<PedidosKPIsProps> = ({
    data,
    globalFilters,
    onFiltersChange,
    situacaoHeader
}) => {
    // --- Derived Data ---

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        if (!situacaoHeader || !data || !Array.isArray(data)) return counts;

        data.forEach(row => {
            const status = row[situacaoHeader] as string;
            if (status) counts[status] = (counts[status] || 0) + 1;
        });
        return counts;
    }, [data, situacaoHeader]);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        if (!data || !Array.isArray(data)) return counts;

        data.forEach(row => {
            // Check multiple possible keys for category
            const category = row.categoria || row.Categoria || row['categoria'] || 'SEM CATEGORIA';
            counts[category] = (counts[category] || 0) + 1;
        });
        return counts;
    }, [data]);

    const storeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        if (!data || !Array.isArray(data)) return counts;

        data.forEach(row => {
            const canal = row.canal || row.Canal || 'OUTROS';
            counts[canal] = (counts[canal] || 0) + 1;
        });
        return counts;
    }, [data]);

    const activeSummaryTab = (globalFilters as any)._activeTab || 'status';

    const getDisplayData = () => {
        if (activeSummaryTab === 'status') {
            return Object.entries(statusCounts).map(([status, count]) => ({ id: status, label: status === 'Dados Incompletos' ? 'Incompleto' : status, count }));
        } else if (activeSummaryTab === 'categoria') {
            return Object.entries(categoryCounts).map(([cat, count]) => ({ id: cat, label: cat, count }));
        } else {
            return Object.entries(storeCounts).map(([store, count]) => ({ id: store, label: store, count }));
        }
    };

    const summaryForDisplay = useMemo(() => {
        return getDisplayData().sort((a, b) => (b.count as number) - (a.count as number));
    }, [activeSummaryTab, statusCounts, categoryCounts, storeCounts]);

    const getIcon = (id: string) => {
        const norm = id.toLowerCase();
        if (norm.includes('aprovado') || norm.includes('pago')) return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
        if (norm.includes('erro') || norm.includes('incompleto')) return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
        if (norm.includes('enviado')) return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>;
        if (activeSummaryTab === 'loja') return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>;
        return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>;
    };

    const getKpiGradient = (id: string) => {
        const norm = id.toLowerCase();

        // Cores padrão por Loja/Canal
        if (norm.includes('mercado') || norm.includes('ml')) return { from: 'from-yellow-400', to: 'to-yellow-500', shadow: 'shadow-yellow-500/10' };
        if (norm.includes('shopee') || norm.includes('sh')) return { from: 'from-orange-500', to: 'to-orange-600', shadow: 'shadow-orange-500/10' };
        if (norm.includes('magalu')) return { from: 'from-blue-500', to: 'to-blue-600', shadow: 'shadow-blue-500/10' };
        if (norm.includes('shein')) return { from: 'from-gray-800', to: 'to-black', shadow: 'shadow-black/20' };
        if (norm.includes('tiktok')) return { from: 'from-pink-500', to: 'to-rose-600', shadow: 'shadow-pink-500/10' };
        if (norm.includes('site') || norm.includes('nuvem')) return { from: 'from-cyan-500', to: 'to-cyan-600', shadow: 'shadow-cyan-500/10' };

        // Cores Globais por Tab
        if (activeSummaryTab === 'loja') {
            // Generate consistent color based on store name hash
            const colors = [
                { from: 'from-emerald-500', to: 'to-emerald-700' },
                { from: 'from-violet-500', to: 'to-violet-700' },
                { from: 'from-fuchsia-500', to: 'to-fuchsia-700' },
                { from: 'from-sky-500', to: 'to-sky-700' },
                { from: 'from-lime-500', to: 'to-lime-700' },
                { from: 'from-rose-500', to: 'to-rose-700' },
                { from: 'from-amber-600', to: 'to-orange-700' },
                { from: 'from-indigo-600', to: 'to-blue-800' }
            ];
            const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const color = colors[hash % colors.length];
            return { ...color, shadow: `shadow-${color.from.replace('from-', '')}/20` };
        }
        if (activeSummaryTab === 'categoria') return { from: 'from-indigo-500', to: 'to-blue-600', shadow: 'shadow-blue-500/10' };

        // Cores por Status (Padrão do Sistema)
        if (norm.includes('aprovado') || norm.includes('pago')) return { from: 'from-emerald-500', to: 'to-emerald-600', shadow: 'shadow-emerald-500/20' };
        if (norm.includes('faturado')) return { from: 'from-purple-500', to: 'to-fuchsia-600', shadow: 'shadow-purple-500/20' };
        if (norm.includes('dados incompletos') || norm.includes('erro')) return { from: 'from-rose-500', to: 'to-pink-600', shadow: 'shadow-rose-500/20' };
        if (norm.includes('enviado')) return { from: 'from-blue-500', to: 'to-indigo-600', shadow: 'shadow-blue-500/20' };
        if (norm.includes('entregue')) return { from: 'from-cyan-500', to: 'to-teal-600', shadow: 'shadow-cyan-500/20' };
        if (norm.includes('cancelado')) return { from: 'from-slate-600', to: 'to-slate-800', shadow: 'shadow-slate-500/20' };
        if (norm.includes('em aberto')) return { from: 'from-amber-400', to: 'to-amber-500', shadow: 'shadow-amber-500/20' };
        if (norm.includes('preparando')) return { from: 'from-gray-500', to: 'to-gray-600', shadow: 'shadow-gray-500/20' };

        return { from: 'from-slate-600', to: 'to-slate-700', shadow: 'shadow-slate-500/10' };
    };

    const handleCardToggle = (id: string) => {
        const key = activeSummaryTab === 'status' ? situacaoHeader : (activeSummaryTab === 'categoria' ? 'categoria' : 'canal');
        const current = globalFilters[key];
        let newVal: string[] = [];
        if (Array.isArray(current)) {
            if (current.includes(id)) newVal = current.filter(v => v !== id);
            else newVal = [...current, id];
        } else {
            newVal = current === id ? [] : [id];
        }
        onFiltersChange({ ...globalFilters, [key]: newVal });
    };

    return (
        <div className="mb-6 space-y-4">
            {/* Nav Tabs Style Estampas */}
            <div className="flex items-center gap-8 mb-4 border-b dark:border-gray-700/50 pb-1">
                {[
                    { id: 'status', label: 'POR STATUS' },
                    { id: 'categoria', label: 'POR CATEGORIA' },
                    { id: 'loja', label: 'POR LOJA' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onFiltersChange({ ...globalFilters, _activeTab: tab.id } as any)}
                        className={`relative py-2 text-[11px] font-bold tracking-[0.12em] transition-all ${activeSummaryTab === tab.id
                            ? 'text-blue-500 dark:text-blue-400'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                            }`}
                    >
                        {tab.label}
                        {activeSummaryTab === tab.id && (
                            <div className="absolute -bottom-1.5 left-0 right-0 h-[3px] bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* Grid de Cards Responsivo - Aumentam/Diminuem lateralmente */}
            <div className="flex gap-1 w-full pb-2">
                {summaryForDisplay.map((item, index) => {
                    const filterKey = activeSummaryTab === 'status' ? situacaoHeader : (activeSummaryTab === 'categoria' ? 'categoria' : 'canal');
                    const currentFilter = globalFilters[filterKey];
                    const isActive = Array.isArray(currentFilter) ? currentFilter.includes(item.id) : currentFilter === item.id;

                    const colorObj = getKpiGradient(item.id);

                    return (
                        <div
                            key={item.id}
                            className="flex-1 min-w-[100px] animate-fade-in-scale"
                            style={{ animationDelay: `${index * 0.04}s` }}
                        >
                            <KpiCard
                                variant="primary"
                                title={item.label}
                                value={String(item.count)}
                                icon={getIcon(item.id)}
                                colorObj={colorObj}
                                onClick={() => handleCardToggle(item.id)}
                                isActive={isActive}
                                className="transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-md h-full w-full"
                            />
                        </div>
                    );
                })}
            </div>
        </div >
    );
};
