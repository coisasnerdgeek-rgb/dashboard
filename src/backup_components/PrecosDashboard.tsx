
import * as React from 'react';
import { PriceProduct } from '../types';

interface PrecosDashboardProps {
    priceTable: PriceProduct[];
    stores: { name: string; types: string[] }[];
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// --- Components ---

const KpiCard: React.FC<{ title: string; value: string; icon: React.ReactNode; gradient: string; shadow: string }> = ({ title, value, icon, gradient, shadow }) => (
    <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} rounded-2xl p-4 text-white shadow-lg ${shadow} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group`}>
        <div className="absolute -right-4 -bottom-4 opacity-10 transform rotate-12 group-hover:scale-110 transition-transform duration-500 [&>svg]:h-16 [&>svg]:w-16">
            {icon}
        </div>
        <div className="relative z-10">
            <h3 className="font-medium text-[10px] uppercase tracking-wider opacity-90">{title}</h3>
            <div className="text-2xl font-bold tracking-tight mt-1">{value}</div>
        </div>
    </div>
);

const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    let cumulativePercent = 0;

    const getCoordinatesForPercent = (percent: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    return (
        <div className="flex flex-col h-full items-center justify-center">
            <div className="relative w-48 h-48 flex-shrink-0 mb-4">
                <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                    {data.map((slice, i) => {
                        if (slice.value === 0) return null;
                        const startPercent = cumulativePercent;
                        const slicePercent = slice.value / total;
                        cumulativePercent += slicePercent;
                        const endPercent = cumulativePercent;

                        const [startX, startY] = getCoordinatesForPercent(startPercent);
                        const [endX, endY] = getCoordinatesForPercent(endPercent);
                        const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

                        const pathData = [
                            `M ${startX} ${startY}`,
                            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                            `L 0 0`,
                        ].join(' ');

                        return <path key={i} d={pathData} fill={slice.color} className="transition-all hover:opacity-90" />;
                    })}
                    <circle cx="0" cy="0" r="0.65" className="fill-white dark:fill-gray-800" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-widest">Total</span>
                    <span className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{total.toLocaleString('pt-BR')}</span>
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 w-full px-2">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-full border border-gray-100 dark:border-gray-600">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: item.color }}></span>
                        <span className="text-gray-600 dark:text-gray-300 font-medium">{item.label}</span>
                        <span className="font-bold text-gray-900 dark:text-white ml-0.5">{item.value}</span>
                        <span className="text-[10px] text-gray-400 ml-0.5">({total > 0 ? Math.round((item.value / total) * 100) : 0}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const BarChart: React.FC<{ data: { label: string; value: number }[]; title: string }> = ({ data, title }) => {
    const max = Math.max(...data.map(d => d.value), 1);

    return (
        <div className="w-full h-full flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">{title}</h3>
            <div className="flex-grow flex items-end gap-2 min-h-[250px]">
                {data.map((item, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center group">
                        <div className="w-full bg-blue-500 rounded-t-md hover:bg-blue-600 transition-colors relative" style={{ height: `${(item.value / max) * 100}%` }}>
                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap transition-opacity pointer-events-none">
                                {formatCurrency(item.value)}
                            </div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate w-full text-center">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PrecosDashboard: React.FC<PrecosDashboardProps> = ({ priceTable, stores }) => {
    const { metrics, storeAverages, categoryCounts } = React.useMemo(() => {
        let totalProducts = priceTable.length;
        let productsWithoutAssociation = priceTable.filter(p => !p.skuProductName).length;
        let totalPricePoints = 0;
        let missingPricePoints = 0;

        const storeTotals: Record<string, { sum: number; count: number }> = {};
        const catCounts: Record<string, number> = {};

        stores.forEach(s => storeTotals[s.name] = { sum: 0, count: 0 });

        priceTable.forEach(p => {
            // Category Count
            catCounts[p.category] = (catCounts[p.category] || 0) + 1;

            stores.forEach(s => {
                // Check prices
                // Robust lookup: try exact match, then case-insensitive
                let storePrices = p.prices[s.name];
                if (!storePrices) {
                    const storeKey = Object.keys(p.prices).find(k => k.trim().toUpperCase() === s.name.trim().toUpperCase());
                    if (storeKey) storePrices = p.prices[storeKey];
                }

                // Average based on 'COR' or first available type
                const priceVal = storePrices?.['COR'] || (storePrices ? Object.values(storePrices)[0] : undefined);

                if (priceVal && typeof priceVal === 'number') {
                    storeTotals[s.name].sum += priceVal;
                    storeTotals[s.name].count++;
                }

                s.types.forEach(t => {
                    totalPricePoints++;
                    // Check if price exists for this type (using the found storePrices)
                    if (typeof storePrices?.[t] !== 'number') {
                        missingPricePoints++;
                    }
                });
            });
        });

        const storeAverages = Object.entries(storeTotals)
            .map(([name, data]) => ({
                label: name,
                value: data.count > 0 ? data.sum / data.count : 0
            }))
            .sort((a, b) => b.value - a.value); // Highest avg price first

        // Donut Data for Categories
        const catData = Object.entries(catCounts)
            .map(([label, value], i) => ({
                label,
                value,
                color: [`#8b5cf6`, `#ec4899`, `#14b8a6`, `#f59e0b`, `#ef4444`, `#3b82f6`, `#6366f1`][i % 7]
            }))
            .sort((a, b) => b.value - a.value);

        return {
            metrics: {
                totalProducts,
                productsWithoutAssociation,
                associationRate: totalProducts > 0 ? ((totalProducts - productsWithoutAssociation) / totalProducts) * 100 : 0,
                pricingCompleteness: totalPricePoints > 0 ? ((totalPricePoints - missingPricePoints) / totalPricePoints) * 100 : 0
            },
            storeAverages,
            categoryCounts: catData
        };
    }, [priceTable, stores]);

    return (
        <div className="animate-slide-in space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    {
                        title: "Total de Produtos",
                        value: metrics.totalProducts.toString(),
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
                        gradient: "from-blue-500 to-indigo-600",
                        shadow: "shadow-blue-500/20"
                    },
                    {
                        title: "Associação SKU",
                        value: `${metrics.associationRate.toFixed(0)}%`,
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
                        gradient: "from-emerald-500 to-teal-600",
                        shadow: "shadow-emerald-500/20"
                    },
                    {
                        title: "Preenchimento Tabela",
                        value: `${metrics.pricingCompleteness.toFixed(0)}%`,
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                        gradient: "from-purple-500 to-fuchsia-600",
                        shadow: "shadow-purple-500/20"
                    },
                    {
                        title: "Não Associados",
                        value: metrics.productsWithoutAssociation.toString(),
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
                        gradient: "from-red-500 to-orange-600",
                        shadow: "shadow-red-500/20"
                    }
                ].map((kpi, index) => (
                    <div key={index} className="animate-slide-in" style={{ animationDelay: `${index * 100}ms` }}>
                        <KpiCard {...kpi} />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-[400px] flex flex-col animate-slide-in" style={{ animationDelay: '400ms' }}>
                    <BarChart data={storeAverages} title="Média de Preços por Loja (R$)" />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-[400px] flex flex-col justify-center animate-slide-in" style={{ animationDelay: '500ms' }}>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 text-center">Produtos por Categoria</h3>
                    <DonutChart data={categoryCounts} />
                </div>
            </div>
        </div>
    );
};

export default PrecosDashboard;
