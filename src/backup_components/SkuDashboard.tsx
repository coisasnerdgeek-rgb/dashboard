
import * as React from 'react';
import { TableRow } from '../types';
import { getSkuError, getCategory, getEffectiveQuantity, parseSku } from '../services/skuService';
import { normalizeString } from '../utils/stringUtils';

interface SkuDashboardProps {
    allRows: TableRow[];
    headers: string[];
}

// --- Helper Functions ---

const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

const generateDateRange = (range: '7d' | '15d' | 'month' | 'custom', customStart?: string, customEnd?: string): string[] => {
    const dates: string[] = [];
    const end = new Date();
    end.setHours(0, 0, 0, 0);

    let start = new Date(end);

    if (range === '7d') start.setDate(end.getDate() - 6);
    else if (range === '15d') start.setDate(end.getDate() - 14);
    else if (range === 'month') start.setDate(1);
    else if (range === 'custom' && customStart && customEnd) {
        const [sY, sM, sD] = customStart.split('-').map(Number);
        const [eY, eM, eD] = customEnd.split('-').map(Number);
        start = new Date(sY, sM - 1, sD);
        end.setFullYear(eY, eM - 1, eD);
    }

    const current = new Date(start);
    while (current <= end) {
        dates.push(formatDateKey(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
};

// --- Components ---

const KpiCard: React.FC<{ title: string; value: string; icon: React.ReactNode; gradient: string; shadow: string; subtitle?: string }> = ({ title, value, icon, gradient, shadow, subtitle }) => (
    <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} rounded-2xl p-4 text-white shadow-lg ${shadow} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group`}>
        <div className="absolute -right-4 -bottom-4 opacity-10 transform rotate-12 group-hover:scale-110 transition-transform duration-500 [&>svg]:h-16 [&>svg]:w-16">
            {icon}
        </div>
        <div className="relative z-10">
            <h3 className="font-medium text-[10px] uppercase tracking-wider opacity-90">{title}</h3>
            <div className="text-2xl font-bold tracking-tight mt-1">{value}</div>
            {subtitle && <p className="text-xs opacity-75 mt-1">{subtitle}</p>}
        </div>
    </div>
);

interface ChartDataset {
    label: string;
    data: number[];
    color: string;
}

const MultiLineChart: React.FC<{ datasets: ChartDataset[]; labels: string[]; title: string }> = ({ datasets, labels, title }) => {
    if (labels.length === 0) return <div className="flex h-full items-center justify-center text-gray-400 text-sm">Sem dados para o período</div>;
    const allValues = datasets.flatMap(d => d.data);
    const max = Math.max(...allValues, 1);
    const width = 1000;
    const height = 200;

    const buildPoints = (data: number[]) => data.map((val, i) => `${labels.length === 1 ? width / 2 : (i / (labels.length - 1)) * width},${height - (val / max) * height}`).join(' ');

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
                <div className="flex flex-wrap gap-3 text-[10px] bg-white/50 dark:bg-gray-800/50 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 backdrop-blur-sm shadow-sm">
                    {datasets.map(d => (
                        <div key={d.label} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span><span className="text-gray-600 dark:text-gray-300 font-medium">{d.label}</span></div>
                    ))}
                </div>
            </div>
            <div className="relative flex-grow h-48">
                <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                        {datasets.map((d, i) => (<linearGradient key={`grad-${i}`} id={`sku-grad-${i}`} x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor={d.color} stopOpacity={0.4} /><stop offset="100%" stopColor={d.color} stopOpacity={0} /></linearGradient>))}
                    </defs>
                    {datasets.map((dataset, idx) => {
                        const points = buildPoints(dataset.data);
                        return (
                            <g key={dataset.label}>
                                <polygon points={`${points} ${labels.length === 1 ? width / 2 : width},${height} ${labels.length === 1 ? width / 2 : 0},${height}`} fill={`url(#sku-grad-${idx})`} />
                                <polyline points={points} fill="none" stroke={dataset.color} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm" />
                            </g>
                        );
                    })}
                </svg>
                <div className="absolute bottom-[-20px] w-full flex justify-between text-[10px] text-gray-400 px-1">
                    {labels.map((l, i) => <span key={i} className="truncate text-center" style={{ width: `${100 / labels.length}%` }}>{l}</span>)}
                </div>
            </div>
        </div>
    );
};

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
            <div className="relative w-64 h-64 flex-shrink-0 mb-6">
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
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-widest">Total</span>
                    <span className="text-4xl font-bold text-gray-800 dark:text-white mt-1">{total.toLocaleString('pt-BR')}</span>
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 w-full px-4">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-600">
                        <span className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: item.color }}></span>
                        <span className="text-gray-600 dark:text-gray-300 font-medium">{item.label}</span>
                        <span className="font-bold text-gray-900 dark:text-white ml-1">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TimeRangeControl: React.FC<{ value: string; onChange: (value: any) => void; customDate: { start: string; end: string }; onCustomDateChange: (newDates: { start: string; end: string }) => void; }> = ({ value, onChange, customDate, onCustomDateChange }) => (
    <div className="flex flex-col sm:flex-row justify-center items-center bg-white dark:bg-gray-800 rounded-xl p-1.5 gap-2 sm:gap-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {(['7d', '15d', 'month'] as const).map(opt => (
                <button key={opt} onClick={() => onChange(opt)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ${value === opt ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600/50'}`}>
                    {opt === '7d' ? '7 Dias' : opt === '15d' ? '15 Dias' : 'Mês Atual'}
                </button>
            ))}
        </div>
        <div className="hidden sm:block w-px h-5 bg-gray-300 dark:bg-gray-600"></div>
        <div className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-900/30 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700">
            <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wide">Período:</span>
            <input type="date" value={customDate.start} onChange={e => { onCustomDateChange({ ...customDate, start: e.target.value }); onChange('custom'); }} className="bg-transparent text-gray-700 dark:text-gray-200 focus:outline-none font-medium cursor-pointer" />
            <span className="text-gray-400 font-light">até</span>
            <input type="date" value={customDate.end} onChange={e => { onCustomDateChange({ ...customDate, end: e.target.value }); onChange('custom'); }} className="bg-transparent text-gray-700 dark:text-gray-200 focus:outline-none font-medium cursor-pointer" />
        </div>
    </div>
);

const SkuDashboard: React.FC<SkuDashboardProps> = ({ allRows, headers }) => {
    const [timeRange, setTimeRange] = React.useState<'7d' | '15d' | 'month' | 'custom'>('7d');
    const [customDate, setCustomDate] = React.useState<{ start: string; end: string }>({ start: '', end: '' });

    const { skuHeader, dataHeader, quantidadeHeader } = React.useMemo(() => {
        const find = (key: string) => headers.find(h => normalizeString(h).includes(key));
        return {
            skuHeader: find('sku'),
            dataHeader: find('data'),
            quantidadeHeader: find('quantidade')
        };
    }, [headers]);

    const { metrics, chartData, donutData } = React.useMemo(() => {
        let totalItems = 0;
        let validItems = 0;
        let invalidItems = 0;
        const errors = { product: 0, color: 0, size: 0 };

        const dailyValid: Record<string, number> = {};
        const dailyInvalid: Record<string, number> = {};

        const dates = generateDateRange(timeRange, customDate.start, customDate.end);

        allRows.forEach(row => {
            const sku = String(skuHeader ? row[skuHeader] : '');
            if (getCategory(sku) !== 'Roupas') return;

            const dateStr = String(dataHeader ? row[dataHeader] : '');
            let sortableDate = '';
            if (dateStr && dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) sortableDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            // Only count if date matches filter
            if (!dates.includes(sortableDate)) return;

            const qty = getEffectiveQuantity(sku, String(quantidadeHeader ? row[quantidadeHeader] : '0'));
            totalItems += qty;

            const error = getSkuError(sku);
            if (error) {
                invalidItems += qty;
                dailyInvalid[sortableDate] = (dailyInvalid[sortableDate] || 0) + qty;
                if (error.type === 'produto') errors.product += qty;
                else if (error.type === 'cor') errors.color += qty;
                else if (error.type === 'tamanho') errors.size += qty;
            } else {
                validItems += qty;
                dailyValid[sortableDate] = (dailyValid[sortableDate] || 0) + qty;
            }
        });

        const successRate = totalItems > 0 ? (validItems / totalItems) * 100 : 0;

        return {
            metrics: { totalItems, validItems, invalidItems, successRate },
            chartData: {
                labels: dates.map(d => `${d.split('-')[2]}/${d.split('-')[1]}`),
                datasets: [
                    { label: 'SKUs Válidos', data: dates.map(d => dailyValid[d] || 0), color: '#10b981' },
                    { label: 'SKUs Inválidos', data: dates.map(d => dailyInvalid[d] || 0), color: '#ef4444' },
                ]
            },
            donutData: [
                { label: 'Produto', value: errors.product, color: '#f59e0b' },
                { label: 'Cor', value: errors.color, color: '#3b82f6' },
                { label: 'Tamanho', value: errors.size, color: '#8b5cf6' },
            ].filter(d => d.value > 0)
        };
    }, [allRows, skuHeader, dataHeader, quantidadeHeader, timeRange, customDate]);

    return (
        <div className="animate-fade-in-scale space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="Total de Roupas" value={metrics.totalItems.toLocaleString('pt-BR')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>} gradient="from-blue-500 to-cyan-600" shadow="shadow-blue-500/20" />
                <KpiCard title="Taxa de Sucesso" value={`${metrics.successRate.toFixed(1)}%`} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} gradient="from-green-500 to-emerald-600" shadow="shadow-green-500/20" />
                <KpiCard title="Itens Inválidos" value={metrics.invalidItems.toLocaleString('pt-BR')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} gradient="from-red-500 to-rose-600" shadow="shadow-red-500/20" />
                <KpiCard title="Qualidade dos Dados" value={metrics.invalidItems === 0 ? 'Excelente' : metrics.successRate > 95 ? 'Boa' : 'Atenção'} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} gradient="from-purple-500 to-indigo-600" shadow="shadow-purple-500/20" />
            </div>

            <TimeRangeControl value={timeRange} onChange={setTimeRange} customDate={customDate} onCustomDateChange={setCustomDate} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-[400px] flex flex-col">
                    <MultiLineChart datasets={chartData.datasets} labels={chartData.labels} title="Qualidade dos Dados (SKUs)" />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-[400px] flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 text-center">Distribuição de Erros</h3>
                    {metrics.invalidItems > 0 ? (
                        <DonutChart data={donutData} />
                    ) : (
                        <div className="flex flex-col items-center text-center text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p>Nenhum erro encontrado!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SkuDashboard;
