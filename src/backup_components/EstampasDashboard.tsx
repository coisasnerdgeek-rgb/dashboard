import * as React from 'react';
import { EstampaRow } from '../types';
import { normalizeString } from '../utils/stringUtils';

interface EstampasDashboardProps {
    data: EstampaRow[];
    delayRules: Record<string, { onTime: number; atRisk: number }>;
}

// --- SVG Components for Charts ---

interface ChartDataset {
    label: string;
    data: number[];
    color: string;
}

const MultiLineChart: React.FC<{ datasets: ChartDataset[]; labels: string[]; title: string }> = ({ datasets, labels, title }) => {
    if (labels.length === 0) return <div className="flex h-full items-center justify-center text-gray-400 text-sm">Sem dados para o período</div>;

    // Add keyframe animation
    React.useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes drawLine {
                to { stroke-dashoffset: 0; }
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    const allValues = datasets.flatMap(d => d.data);
    const max = Math.max(...allValues, 1);
    const width = 1000;
    const height = 200;

    const buildPoints = (data: number[]) => {
        return data.map((val, i) => {
            const x = labels.length === 1 ? width / 2 : (i / (labels.length - 1)) * width;
            const y = height - (val / max) * height;
            return `${x},${y}`;
        }).join(' ');
    };

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
                <div className="flex flex-wrap gap-3 text-[10px] bg-white/50 dark:bg-gray-800/50 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 backdrop-blur-sm shadow-sm">
                    {datasets.map(d => (
                        <div key={d.label} className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                            <span className="text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">{d.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="relative flex-grow h-48">
                <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                        {datasets.map((d, i) => (
                            <linearGradient key={`grad-${i}`} id={`est-grad-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor={d.color} stopOpacity={0.5} />
                                <stop offset="100%" stopColor={d.color} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>

                    <line x1="0" y1="0" x2={width} y2="0" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" vectorEffect="non-scaling-stroke" className="opacity-30" />
                    <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" vectorEffect="non-scaling-stroke" className="opacity-30" />
                    <line x1="0" y1={height} x2={width} y2={height} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" vectorEffect="non-scaling-stroke" className="opacity-30" />

                    {datasets.map((dataset, idx) => {
                        const points = buildPoints(dataset.data);
                        const firstX = labels.length === 1 ? width / 2 : 0;
                        const lastX = labels.length === 1 ? width / 2 : width;
                        const fillPoints = `${points} ${lastX},${height} ${firstX},${height}`;

                        return (
                            <g key={dataset.label}>
                                <polygon points={fillPoints} fill={`url(#est-grad-${idx})`} className="transition-all duration-500" />
                                <polyline
                                    points={points}
                                    fill="none"
                                    stroke={dataset.color}
                                    strokeWidth="3"
                                    vectorEffect="non-scaling-stroke"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="drop-shadow-sm transition-all duration-500"
                                    strokeDasharray="2000"
                                    strokeDashoffset="2000"
                                    style={{
                                        animation: `drawLine 1.5s ease-out ${idx * 0.2}s forwards`
                                    }}
                                />
                                {dataset.data.map((val, i) => {
                                    const x = labels.length === 1 ? width / 2 : (i / (labels.length - 1)) * width;
                                    const y = height - (val / max) * height;
                                    return (
                                        <g key={i} className="group">
                                            <circle
                                                cx={x}
                                                cy={y}
                                                r="4"
                                                fill={dataset.color}
                                                stroke="white"
                                                strokeWidth="1.5"
                                                vectorEffect="non-scaling-stroke"
                                                className="transition-all duration-300 group-hover:r-6 cursor-pointer"
                                            />
                                            {/* Tooltip on Hover */}
                                            <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                                <rect
                                                    x={x - 24}
                                                    y={y - 40}
                                                    width="48"
                                                    height="28"
                                                    rx="6"
                                                    fill={dataset.color}
                                                    stroke="white"
                                                    strokeWidth="2"
                                                    className="shadow-lg"
                                                />
                                                <text
                                                    x={x}
                                                    y={y - 26}
                                                    textAnchor="middle"
                                                    fill="white"
                                                    fontSize="16"
                                                    fontWeight="bold"
                                                    dominantBaseline="middle"
                                                >
                                                    {val}
                                                </text>
                                            </g>
                                        </g>
                                    );
                                })}
                            </g>
                        );
                    })}
                </svg>
                <div className="absolute bottom-[-20px] w-full flex justify-between text-[10px] text-gray-400 px-1">
                    {labels.map((l, i) => (
                        <span key={i} className="truncate text-center" style={{ width: `${100 / labels.length}%` }}>{l}</span>
                    ))}
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
        <div className="flex items-center gap-6 h-full">
            <div className="relative w-36 h-36 flex-shrink-0">
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

                        const pathData = [`M 0 0`, `L ${startX} ${startY}`, `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, `Z`].join(' ');
                        return <path key={i} d={pathData} fill={slice.color} />;
                    })}
                    <circle cx="0" cy="0" r="0.7" className="fill-white dark:fill-gray-800" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total</span>
                    <span className="text-2xl font-bold text-gray-800 dark:text-white">{total}</span>
                </div>
            </div>
            <div className="flex-grow space-y-2 overflow-y-auto max-h-48 pr-1">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                            <span className="text-gray-600 dark:text-gray-300 truncate max-w-[100px]" title={item.label}>{item.label}</span>
                        </div>
                        <span className="font-bold text-gray-800 dark:text-gray-200">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const getAtrasoStatus = (dateStr: string, store: string, rules: Record<string, { onTime: number; atRisk: number }>, dataPrevista?: string) => {
    if (!dateStr || !dateStr.includes('/')) return 'normal';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return 'normal';
    const [day, month, year] = parts.map(Number);
    const orderDate = new Date(year, month - 1, day);
    const today = new Date();
    orderDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - orderDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const storeRule = rules[store] || rules.default || { onTime: 4, atRisk: 6 };

    // NEW LOGIC: If dataPrevista is missing, force 1-day deadline rule
    if (!dataPrevista) {
        if (diffDays > 1) return 'atrasado';
        if (diffDays === 1) return 'risco';
        return 'normal';
    }

    // Existing logic for items with dataPrevista
    if (diffDays > storeRule.atRisk) return 'atrasado';
    if (diffDays > storeRule.onTime) return 'risco';
    return 'normal';
};

type TimeRange = 'today' | '7d' | '15d' | 'month' | 'custom';

const EstampasDashboard: React.FC<EstampasDashboardProps> = ({ data, delayRules }) => {
    const [timeRange, setTimeRange] = React.useState<TimeRange>('7d');
    const [customDate, setCustomDate] = React.useState<{ start: string; end: string }>({ start: '', end: '' });

    const { metrics, locationData, pieceData, chartData, statusChartData } = React.useMemo(() => {
        // 1. Determine Date Range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        let startDate = new Date(today);
        let endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);

        if (timeRange === '7d') {
            startDate.setDate(today.getDate() - 6);
        } else if (timeRange === '15d') {
            startDate.setDate(today.getDate() - 14);
        } else if (timeRange === 'month') {
            startDate = new Date(currentYear, currentMonth, 1);
        } else if (timeRange === 'custom' && customDate.start && customDate.end) {
            const [sY, sM, sD] = customDate.start.split('-').map(Number);
            const [eY, eM, eD] = customDate.end.split('-').map(Number);
            startDate = new Date(sY, sM - 1, sD);
            endDate = new Date(eY, eM - 1, eD);
            endDate.setHours(23, 59, 59, 999);
        }

        // 2. Filter Data by Date Range
        const filteredData = data.filter(row => {
            if (!row.fullDate) return false;
            const parts = row.fullDate.split('/');
            if (parts.length !== 3) return false;
            const [day, month, year] = parts.map(Number);
            const rowDate = new Date(year, month - 1, day);
            return rowDate >= startDate && rowDate <= endDate;
        });

        // 3. Aggregate Metrics on Filtered Data
        let totalItems = 0;
        let totalImpresso = 0;
        let totalAtrasado = 0;
        let totalRisco = 0;

        const locations: Record<string, number> = {};
        const pieces: Record<string, number> = {};

        // Daily Tracking for Line Chart
        const dailyVolume: Record<string, number> = {};
        const dailyImpresso: Record<string, number> = {};
        const dailyAprovado: Record<string, number> = {};
        const dailyAprovacao: Record<string, number> = {};

        // Status Breakdown for Donut Chart
        const donutStatusCounts: Record<string, number> = {
            'Impresso': 0,
            'Fazer Arte': 0,
            'Aprovação': 0,
            'Arte Pronta': 0,
            'Aprovado': 0,
            'Cancelado': 0,
            'Atrasado': 0, // Priority override
            'Risco': 0     // Priority override
        };

        filteredData.forEach(row => {
            const qty = row.quantidade || 1;
            totalItems += qty;

            const status = row.status || 'FAZER ARTE';
            const atraso = getAtrasoStatus(row.fullDate, row.canal, delayRules, row.dataPrevista);

            // KPIs
            if (status === 'IMPRESSO') totalImpresso += qty;
            else {
                if (atraso === 'atrasado') totalAtrasado += qty;
                if (atraso === 'risco') totalRisco += qty;
            }

            // Donut Chart Logic (Priority: Cancelado > Impresso > Atrasado > Risco > Normal Status)
            if (status === 'CANCELADO' || status.includes('CANCELADO')) {
                donutStatusCounts['Cancelado'] += qty;
            } else if (status === 'IMPRESSO') {
                donutStatusCounts['Impresso'] += qty;
            } else if (atraso === 'atrasado') {
                donutStatusCounts['Atrasado'] += qty;
            } else if (atraso === 'risco') {
                donutStatusCounts['Risco'] += qty;
            } else {
                // Map standard statuses
                if (status === 'FAZER ARTE') donutStatusCounts['Fazer Arte'] += qty;
                else if (status === 'EM APROVAÇÃO') donutStatusCounts['Aprovação'] += qty;
                else if (status === 'PRONTA') donutStatusCounts['Arte Pronta'] += qty;
                else if (status === 'APROVADO') donutStatusCounts['Aprovado'] += qty;
                else if (status === 'IMAGEM') donutStatusCounts['Sem Imagem'] += qty;
            }

            // Location
            const loc = row.localEstampa || 'N/A';
            locations[loc] = (locations[loc] || 0) + qty;

            // Pieces
            const pecaRaw = row.peca || 'Outros';
            const normPeca = normalizeString(pecaRaw);
            let peca = pecaRaw;
            if (normPeca.includes('camiseta')) peca = 'Camiseta';
            else if (normPeca.includes('baby')) peca = 'Babylook';
            else if (normPeca.includes('moletom')) peca = 'Moletom';
            else if (normPeca.includes('polo')) {
                if (normPeca.includes('feminina')) peca = 'Polo Feminina';
                else if (normPeca.includes('masculina')) peca = 'Polo Masculina';
                else peca = 'Polo';
            }
            else if (normPeca.includes('regata')) peca = 'Regata';

            pieces[peca] = (pieces[peca] || 0) + qty;

            // Daily Trend
            if (row.fullDate) {
                const parts = row.fullDate.split('/');
                if (parts.length === 3) {
                    const sortableDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    dailyVolume[sortableDate] = (dailyVolume[sortableDate] || 0) + qty;
                    if (status === 'IMPRESSO') dailyImpresso[sortableDate] = (dailyImpresso[sortableDate] || 0) + qty;
                    else if (status === 'APROVADO') dailyAprovado[sortableDate] = (dailyAprovado[sortableDate] || 0) + qty;
                    else if (status === 'EM APROVAÇÃO') dailyAprovacao[sortableDate] = (dailyAprovacao[sortableDate] || 0) + qty;
                }
            }
        });

        // Prepare Chart Arrays
        const allDates = Object.keys(dailyVolume).sort();
        const labels = allDates.map(d => {
            const parts = d.split('-');
            return `${parts[2]}/${parts[1]}`;
        });

        const chartData = {
            labels,
            datasets: [
                { label: 'Volume Total', data: allDates.map(d => dailyVolume[d] || 0), color: '#f97316' },
                { label: 'Impressos', data: allDates.map(d => dailyImpresso[d] || 0), color: '#22c55e' },
                { label: 'Aprovados', data: allDates.map(d => dailyAprovado[d] || 0), color: '#9333ea' },
                { label: 'Aprovação', data: allDates.map(d => dailyAprovacao[d] || 0), color: '#3b82f6' }
            ]
        };

        const statusChart = [
            { label: 'Atrasado', value: donutStatusCounts['Atrasado'], color: '#ef4444' }, // Red
            { label: 'Risco', value: donutStatusCounts['Risco'], color: '#f59e0b' }, // Amber
            { label: 'Impresso', value: donutStatusCounts['Impresso'], color: '#22c55e' }, // Green
            { label: 'Fazer Arte', value: donutStatusCounts['Fazer Arte'], color: '#f97316' }, // Orange
            { label: 'Aprovação', value: donutStatusCounts['Aprovação'], color: '#3b82f6' }, // Blue
            { label: 'Pronta', value: donutStatusCounts['Arte Pronta'], color: '#eab308' }, // Yellow
            { label: 'Aprovado', value: donutStatusCounts['Aprovado'], color: '#9333ea' }, // Purple
            { label: 'Imagem', value: donutStatusCounts['Sem Imagem'], color: '#ef4444' }, // Red
            { label: 'Cancelado', value: donutStatusCounts['Cancelado'], color: '#1f2937' }, // Dark Gray
        ].filter(d => d.value > 0);

        return {
            metrics: {
                totalItems,
                totalImpresso,
                totalPending: totalItems - totalImpresso,
                totalAtrasado,
                totalRisco
            },
            locationData: Object.entries(locations).sort((a, b) => b[1] - a[1]).slice(0, 5),
            pieceData: Object.entries(pieces).sort((a, b) => b[1] - a[1]).slice(0, 6),
            chartData,
            statusChartData: statusChart
        };
    }, [data, delayRules, timeRange, customDate]);

    const getRankColorClass = (index: number) => {
        switch (index) {
            case 0: return 'bg-yellow-400 text-white shadow-lg shadow-yellow-600/40 border-2 border-yellow-300';
            case 1: return 'bg-gray-300 text-gray-800 shadow-lg shadow-gray-600/40 border-2 border-gray-200';
            case 2: return 'bg-orange-400 text-white shadow-lg shadow-orange-700/40 border-2 border-orange-300';
            default: return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300';
        }
    };

    return (
        <div className="animate-fade-in-scale space-y-6">
            {/* Top KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-4 text-white shadow-lg shadow-orange-500/20 animate-fade-in-scale" style={{ animationDelay: '100ms' }}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-orange-100 font-medium text-xs uppercase tracking-wide">Fila de Produção</h3>
                        <div className="p-1.5 bg-white/20 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold">{metrics.totalPending.toLocaleString('pt-BR')}</span>
                        <span className="text-orange-200 text-xs">pendentes</span>
                    </div>
                    <div className="mt-1.5 text-[10px] text-orange-100 font-medium flex gap-2">
                        <span className="bg-red-700/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-red-300"></span> {metrics.totalAtrasado}
                        </span>
                        <span className="bg-yellow-600/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-yellow-300"></span> {metrics.totalRisco}
                        </span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl p-4 text-white shadow-lg shadow-amber-500/20 animate-fade-in-scale" style={{ animationDelay: '150ms' }}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-amber-100 font-medium text-xs uppercase tracking-wide">Em Risco</h3>
                        <div className="p-1.5 bg-white/20 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold">{metrics.totalRisco.toLocaleString('pt-BR')}</span>
                        <span className="text-amber-100 text-xs">itens</span>
                    </div>
                    <p className="text-amber-100 text-[10px] mt-1">Prazo vencendo</p>
                </div>

                <div className="bg-gradient-to-br from-red-600 to-rose-700 rounded-xl p-4 text-white shadow-lg shadow-red-600/20 animate-fade-in-scale" style={{ animationDelay: '200ms' }}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-red-100 font-medium text-xs uppercase tracking-wide">Atrasados</h3>
                        <div className="p-1.5 bg-white/20 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold">{metrics.totalAtrasado.toLocaleString('pt-BR')}</span>
                        <span className="text-red-100 text-xs">itens</span>
                    </div>
                    <p className="text-red-100 text-[10px] mt-1">Prazo excedido</p>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg shadow-green-500/20 animate-fade-in-scale" style={{ animationDelay: '250ms' }}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-green-100 font-medium text-xs uppercase tracking-wide">Total Impresso</h3>
                        <div className="p-1.5 bg-white/20 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        </div>
                    </div>
                    <div className="text-3xl font-bold">{metrics.totalImpresso.toLocaleString('pt-BR')}</div>
                    <p className="text-green-100 text-[10px] mt-1">{metrics.totalItems > 0 ? Math.round((metrics.totalImpresso / metrics.totalItems) * 100) : 0}% do total</p>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg shadow-blue-500/20 animate-fade-in-scale" style={{ animationDelay: '300ms' }}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-blue-100 font-medium text-xs uppercase tracking-wide">Total de Itens</h3>
                        <div className="p-1.5 bg-white/20 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                        </div>
                    </div>
                    <div className="text-3xl font-bold">{metrics.totalItems.toLocaleString('pt-BR')}</div>
                </div>
            </div>

            {/* Middle Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trend */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col animate-fade-in-scale" style={{ animationDelay: '400ms' }}>
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col sm:flex-row justify-center items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-2 sm:gap-4">
                            <div className="flex gap-1">
                                {[
                                    { id: 'today', label: 'Hoje' },
                                    { id: '7d', label: '7 Dias' },
                                    { id: '15d', label: '15 Dias' },
                                    { id: 'month', label: 'Mês' },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setTimeRange(opt.id as TimeRange)}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeRange === opt.id
                                            ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <div className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Personalizado:</span>
                                <input
                                    type="date"
                                    value={customDate.start}
                                    onChange={(e) => {
                                        setCustomDate(prev => ({ ...prev, start: e.target.value }));
                                        setTimeRange('custom');
                                    }}
                                    className="bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    value={customDate.end}
                                    onChange={(e) => {
                                        setCustomDate(prev => ({ ...prev, end: e.target.value }));
                                        setTimeRange('custom');
                                    }}
                                    className="bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex-grow flex items-end pb-4">
                        <MultiLineChart datasets={chartData.datasets} labels={chartData.labels} title="Fluxo de Estampas" />
                    </div>
                </div>

                {/* Status Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in-scale" style={{ animationDelay: '500ms' }}>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Status Atual</h3>
                    <DonutChart data={statusChartData} />
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Locations */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in-scale" style={{ animationDelay: '600ms' }}>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Local da Estampa</h3>
                    <div className="space-y-4">
                        {locationData.map(([loc, count]) => {
                            const max = locationData.length > 0 ? locationData[0][1] : 1;
                            const percent = (count / max) * 100;
                            return (
                                <div key={loc}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{loc || 'N/A'}</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{count}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                        <div className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Top Pieces */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in-scale" style={{ animationDelay: '700ms' }}>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Top Peças</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {pieceData.map(([piece, count], index) => (
                            <div key={piece} className="flex flex-col p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 relative overflow-hidden">
                                <div className="flex justify-between items-start z-10 relative">
                                    <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full font-bold text-xs ${getRankColorClass(index)}`}>{index + 1}</div>
                                    {/* Percentage of Total Volume */}
                                    <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-1.5 py-0.5 rounded">{metrics.totalItems > 0 ? Math.round((count / metrics.totalItems) * 100) : 0}%</span>
                                </div>
                                <div className="mt-2 z-10 relative">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{piece}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{count} unidades</p>
                                </div>
                                {/* Mini progress bar at bottom representing volume share */}
                                <div className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all duration-500" style={{ width: `${metrics.totalItems > 0 ? (count / metrics.totalItems) * 100 : 0}%` }}></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EstampasDashboard;