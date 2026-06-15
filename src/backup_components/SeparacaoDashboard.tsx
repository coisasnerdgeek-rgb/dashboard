import * as React from 'react';
import { TableRow } from '../types';
import { getCategory, isPersonalizado, parseSku } from '../services/skuService';
import { normalizeString } from '../utils/stringUtils';
import KpiCard from './common/KpiCard';

interface SeparacaoDashboardProps {
    headers: string[];
    data: TableRow[];
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
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
                <div className="flex flex-wrap gap-3 text-[10px] bg-white/50 dark:bg-gray-800/50 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 backdrop-blur-sm shadow-sm">
                    {datasets.map(d => (
                        <div key={d.label} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span><span className="text-gray-600 dark:text-gray-300 font-medium">{d.label}</span></div>
                    ))}
                </div>
            </div>
            <div className="relative flex-grow min-h-0">
                <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                        {datasets.map((d, i) => (<linearGradient key={`grad-${i}`} id={`sep-grad-${i}`} x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor={d.color} stopOpacity={0.4} /><stop offset="100%" stopColor={d.color} stopOpacity={0} /></linearGradient>))}
                    </defs>
                    {datasets.map((dataset, idx) => {
                        const points = buildPoints(dataset.data);
                        return (
                            <g key={dataset.label}>
                                <polygon points={`${points} ${labels.length === 1 ? width / 2 : width},${height} ${labels.length === 1 ? width / 2 : 0},${height}`} fill={`url(#sep-grad-${idx})`} />
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
                        <span className="text-xs text-gray-400 ml-1">({total > 0 ? Math.round((item.value / total) * 100) : 0}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TopListPanel: React.FC<{ title: string; items: { name: string; value: number }[]; icon: React.ReactNode; }> = ({ title, items, icon }) => {
    const max = items.length > 0 ? items[0].value : 0;
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-full">
            <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-300">{icon}</div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h2>
            </div>
            <ul className="space-y-4">
                {items.map(item => (
                    <li key={item.name} className="text-sm">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
                            <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{item.value.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5"><div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}></div></div>
                    </li>
                ))}
                {items.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 py-4">Nenhum dado para exibir.</p>}
            </ul>
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

const SeparacaoDashboard: React.FC<SeparacaoDashboardProps> = ({ headers, data }) => {
    const [timeRange, setTimeRange] = React.useState<'7d' | '15d' | 'month' | 'custom'>('7d');
    const [customDate, setCustomDate] = React.useState<{ start: string; end: string }>({ start: '', end: '' });

    const { metrics, chartData, topStores, donutData } = React.useMemo(() => {
        const dateHeader = headers.find(h => normalizeString(h) === 'data');
        const skuHeader = headers.find(h => normalizeString(h).includes('sku'));
        const situacaoHeader = headers.find(h => normalizeString(h).includes('situacao'));

        const dailyRoupas: Record<string, number> = {};
        const dailyCapinhasPerso: Record<string, number> = {};
        const dailyCapinhasTransp: Record<string, number> = {};
        const pendingByStore: Record<string, number> = {};

        const allItems = data.filter(row => {
            if (situacaoHeader) {
                const status = String(row[situacaoHeader] ?? '').toLowerCase();
                if (status.includes('cancelado')) return false;
            }
            return true;
        });

        // Date range for filtering
        const dates = generateDateRange(timeRange, customDate.start, customDate.end);

        const timeFilteredItems = allItems.filter(row => {
            const dateStr = String(row[dateHeader!] ?? '');
            if (!dateStr) return false;
            const parts = dateStr.split('/');
            if (parts.length !== 3) return false;
            const sortableDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            return dates.includes(sortableDate);
        });

        timeFilteredItems.forEach(row => {
            const dateStr = String(row[dateHeader!] ?? '');
            const parts = dateStr.split('/');
            const sortableDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

            const sku = String(row[skuHeader!] ?? '');
            const category = getCategory(sku);

            if (category === 'Roupas') {
                dailyRoupas[sortableDate] = (dailyRoupas[sortableDate] || 0) + 1;
            } else if (category === 'Capinha') {
                if (isPersonalizado(sku)) {
                    dailyCapinhasPerso[sortableDate] = (dailyCapinhasPerso[sortableDate] || 0) + 1;
                } else {
                    dailyCapinhasTransp[sortableDate] = (dailyCapinhasTransp[sortableDate] || 0) + 1;
                }
            }
        });

        // Calculate total metrics and rankings on all items (not time filtered)
        let totalRoupas = 0;
        let totalCapinhas = 0;
        let totalPerso = 0;
        let totalTransp = 0;

        allItems.forEach(row => {
            const sku = String(row[skuHeader!] ?? '');
            const category = getCategory(sku);
            if (category === 'Roupas') totalRoupas++;
            else if (category === 'Capinha') {
                totalCapinhas++;
                if (isPersonalizado(sku)) totalPerso++;
                else totalTransp++;
            }
        });

        const donutData = [
            { label: 'Total de Roupas', value: totalRoupas, color: '#8b5cf6' }, // Violet
            { label: 'Capinhas Perso', value: totalPerso, color: '#ec4899' }, // Pink
            { label: 'Capinhas Transp', value: totalTransp, color: '#14b8a6' }, // Teal
        ];

        return {
            metrics: {
                totalItems: totalRoupas + totalCapinhas,
                totalRoupas,
                totalCapinhas,
                totalPerso,
                totalTransp
            },
            chartData: {
                labels: dates.map(d => `${d.split('-')[2]}/${d.split('-')[1]}`),
                datasets: [
                    { label: 'Roupas', data: dates.map(d => dailyRoupas[d] || 0), color: '#8b5cf6' },
                    { label: 'Capinhas Perso', data: dates.map(d => dailyCapinhasPerso[d] || 0), color: '#ec4899' },
                    { label: 'Capinhas Transp', data: dates.map(d => dailyCapinhasTransp[d] || 0), color: '#14b8a6' },
                ]
            },
            topStores: Object.entries(pendingByStore).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value })),
            donutData,
        };

    }, [headers, data, timeRange, customDate]);

    return (
        <div className="animate-fade-in-scale space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <KpiCard title="Total para Separar" value={metrics.totalItems.toLocaleString('pt-BR')} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" /><path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /></svg>} colorObj={{ from: 'from-cyan-500', to: 'to-blue-600', shadow: 'shadow-cyan-500/20' }} />
                <KpiCard title="Total de Roupas" value={metrics.totalRoupas.toLocaleString('pt-BR')} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.982 11.982a2.503 2.503 0 01-1.103 1.09 6.253 6.253 0 00-1.75 4.88 1.87 1.87 0 001.87 1.87h12.002a1.87 1.87 0 001.87-1.87 6.253 6.253 0 00-1.75-4.88 2.503 2.503 0 01-1.102-1.09 4.375 4.375 0 00-7.94 0z" /></svg>} colorObj={{ from: 'from-violet-500', to: 'to-purple-600', shadow: 'shadow-violet-500/20' }} />
                <KpiCard title="Total de Capinhas" value={metrics.totalCapinhas.toLocaleString('pt-BR')} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>} colorObj={{ from: 'from-sky-500', to: 'to-cyan-600', shadow: 'shadow-sky-500/20' }} />
                <KpiCard title="Capinhas Perso" value={metrics.totalPerso.toLocaleString('pt-BR')} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>} colorObj={{ from: 'from-fuchsia-500', to: 'to-pink-600', shadow: 'shadow-fuchsia-500/20' }} />
                <KpiCard title="Capinhas Transp" value={metrics.totalTransp.toLocaleString('pt-BR')} icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>} colorObj={{ from: 'from-teal-500', to: 'to-emerald-600', shadow: 'shadow-teal-500/20' }} />
            </div>

            <TimeRangeControl value={timeRange} onChange={setTimeRange} customDate={customDate} onCustomDateChange={setCustomDate} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-[500px] flex flex-col">
                    <MultiLineChart datasets={chartData.datasets} labels={chartData.labels} title="Volume de Itens para Separação por Dia" />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-[500px] flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 text-center">Distribuição por Tipo</h3>
                    <DonutChart data={donutData} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TopListPanel title="Top Lojas por Itens a Separar" items={topStores} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>} />
                {/* Placeholder for another panel if needed */}
                <div></div>
            </div>

        </div>
    );
};

export default SeparacaoDashboard;