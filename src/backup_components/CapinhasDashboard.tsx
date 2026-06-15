import * as React from 'react';
import { TableRow } from '../types';
import { getCategory, parseSku, getEffectiveQuantity, isPersonalizado } from '../services/skuService';
import { cleanAndParse } from '../utils/numberUtils';
import { normalizeString } from '../utils/stringUtils';
import KpiCard from './common/KpiCard';

interface CapinhasDashboardProps {
    headers: string[];
    data: TableRow[];
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// --- SVG Components for Charts ---

interface ChartDataset {
    label: string;
    data: number[];
    color: string;
}

const MultiLineChart: React.FC<{ datasets: ChartDataset[]; labels: string[]; title: string }> = ({ datasets, labels, title }) => {
    if (labels.length === 0) return <div className="flex h-full items-center justify-center text-gray-400 text-sm">Sem dados para o período</div>;

    // Calculate max value across all datasets to scale Y axis
    const allValues = datasets.flatMap(d => d.data);
    const max = Math.max(...allValues, 1); // Avoid division by zero

    // SVG Dimensions
    const width = 1000;
    const height = 200;

    // Helper to build points string for polyline
    const buildPoints = (data: number[]) => {
        return data.map((val, i) => {
            // If single point, center it. Otherwise spread across width
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
                            <span className="text-gray-600 dark:text-gray-300 font-medium">{d.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="relative flex-grow h-48">
                <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                        {datasets.map((d, i) => (
                            <linearGradient key={`grad-${i}`} id={`grad-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor={d.color} stopOpacity={0.4} />
                                <stop offset="100%" stopColor={d.color} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>

                    {/* Grid Lines */}
                    <line x1="0" y1="0" x2={width} y2="0" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" vectorEffect="non-scaling-stroke" className="opacity-30" />
                    <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" vectorEffect="non-scaling-stroke" className="opacity-30" />
                    <line x1="0" y1={height} x2={width} y2={height} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" vectorEffect="non-scaling-stroke" className="opacity-30" />

                    {datasets.map((dataset, idx) => {
                        const points = buildPoints(dataset.data);
                        // Close the path for the gradient fill
                        const firstX = labels.length === 1 ? width / 2 : 0;
                        const lastX = labels.length === 1 ? width / 2 : width;
                        const fillPoints = `${points} ${lastX},${height} ${firstX},${height}`;

                        return (
                            <g key={dataset.label}>
                                {/* Gradient Area Fill */}
                                <polygon
                                    points={fillPoints}
                                    fill={`url(#grad-${idx})`}
                                    className="transition-all duration-500"
                                />

                                {/* Line */}
                                <polyline
                                    points={points}
                                    fill="none"
                                    stroke={dataset.color}
                                    strokeWidth="3"
                                    vectorEffect="non-scaling-stroke"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="drop-shadow-sm transition-all duration-500"
                                />

                                {/* Data Points (Dots) */}
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
                                                className="transition-all duration-500 group-hover:r-6 cursor-pointer"
                                            />
                                            {/* Value Label on Hover */}
                                            <g className="opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none transform translate-y-2 group-hover:translate-y-0">
                                                <foreignObject x={x - 30} y={y - 45} width="60" height="40">
                                                    <div className="flex justify-center">
                                                        <div className="px-2 py-1 bg-gray-900 text-white text-xs font-bold rounded shadow-lg whitespace-nowrap transform scale-110">
                                                            {Math.round(val)}
                                                        </div>
                                                    </div>
                                                </foreignObject>
                                            </g>
                                        </g>
                                    );
                                })}
                            </g>
                        );
                    })}
                </svg>

                {/* X Axis Labels */}
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
        <div className="flex items-center gap-6">
            <div className="relative w-32 h-32 flex-shrink-0">
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

                        return <path key={i} d={pathData} fill={slice.color} />;
                    })}
                    <circle cx="0" cy="0" r="0.7" className="fill-white dark:fill-gray-800" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total</span>
                    <span className="text-xl font-bold text-gray-800 dark:text-white">{total}</span>
                </div>
            </div>
            <div className="flex-grow space-y-2">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                            <span className="text-gray-600 dark:text-gray-300 truncate max-w-[100px]">{item.label}</span>
                        </div>
                        <span className="font-bold text-gray-800 dark:text-gray-200">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- Main Component ---

type TimeRange = 'today' | '7d' | '15d' | 'month' | 'custom';

const CapinhasDashboard: React.FC<CapinhasDashboardProps> = ({ headers, data }) => {
    const [timeRange, setTimeRange] = React.useState<TimeRange>('7d');
    const [customDate, setCustomDate] = React.useState<{ start: string; end: string }>({ start: '', end: '' });

    const memoData = React.useMemo(() => {
        const skuHeader = headers.find(h => normalizeString(h).includes('sku'));
        const qtyHeader = headers.find(h => normalizeString(h).includes('quantidade'));
        const valHeader = headers.find(h => normalizeString(h).includes('valor unitario'));
        const dateHeader = headers.find(h => normalizeString(h) === 'data');
        const statusHeader = headers.find(h => normalizeString(h).includes('situacao'));

        let totalQty = 0;
        let totalRevenue = 0;
        let totalOrders = 0;
        let delayedTransparentQty = 0;

        const brands: Record<string, { total: number; perso: number; transp: number }> = {};
        const models: Record<string, number> = {};
        const dailyPerso: Record<string, number> = {};
        const dailyTransp: Record<string, number> = {};
        const status: Record<string, number> = {};
        const types: Record<string, number> = { 'Personalizada': 0, 'Transparente': 0 };

        const today = new Date();
        const dates = [0, 1, 2].map(daysAgo => {
            const d = new Date(today);
            d.setDate(d.getDate() - daysAgo);
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        });

        const dailyBreakdown: Record<string, { total: number; perso: number; transp: number }> = {};
        dates.forEach(d => dailyBreakdown[d] = { total: 0, perso: 0, transp: 0 });

        const capinhasData = data.filter(row => getCategory(String(row[skuHeader!] ?? '')) === 'Capinha');

        capinhasData.forEach(row => {
            const sku = String(row[skuHeader!] ?? '');
            const qty = getEffectiveQuantity(sku, String(row[qtyHeader!] ?? '0'));
            const val = cleanAndParse(row[valHeader!]);
            const dateStr = String(row[dateHeader!] ?? '');
            const rowStatus = String(row[statusHeader!] ?? 'N/A');
            const isPerso = isPersonalizado(sku);

            // Metrics
            totalQty += qty;
            totalRevenue += (qty * val);
            totalOrders++;

            // Parse SKU
            const parsed = parseSku(sku);
            const brand = parsed?.colorName !== 'N/A' ? parsed?.colorName : 'Outros';
            const model = parsed?.sizeName !== 'N/A' ? parsed?.sizeName : 'Desconhecido';

            // Calculate Delayed Transparent
            if (!isPerso && dateStr) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    const [day, month, year] = parts.map(Number);
                    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                        const orderDate = new Date(year, month - 1, day);
                        const now = new Date();
                        orderDate.setHours(0, 0, 0, 0);
                        now.setHours(0, 0, 0, 0);
                        const diffTime = now.getTime() - orderDate.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        const normStatus = normalizeString(rowStatus);
                        if (diffDays > 1 && !['enviado', 'entregue', 'cancelado', 'concluido'].some(s => normStatus.includes(s))) {
                            delayedTransparentQty += qty;
                        }
                    }
                }
            }

            // Aggregations
            if (brand) {
                if (!brands[brand]) brands[brand] = { total: 0, perso: 0, transp: 0 };
                brands[brand].total += qty;
                if (isPerso) brands[brand].perso += qty;
                else brands[brand].transp += qty;
            }

            if (model) models[model] = (models[model] || 0) + qty;

            // Date Trend
            if (dateStr) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    const sortableDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    if (isPerso) {
                        dailyPerso[sortableDate] = (dailyPerso[sortableDate] || 0) + qty;
                    } else {
                        dailyTransp[sortableDate] = (dailyTransp[sortableDate] || 0) + qty;
                    }
                }
            }

            // Status
            let unifiedStatus = 'Pendente';
            const normStatus = normalizeString(rowStatus);
            if (normStatus.includes('cancelado')) unifiedStatus = 'Cancelado';
            else if (['faturado', 'em aberto', 'aprovado', 'concluido'].some(s => normStatus.includes(s))) unifiedStatus = 'Aprovado';
            else if (normStatus.includes('enviado')) unifiedStatus = 'Enviado';
            status[unifiedStatus] = (status[unifiedStatus] || 0) + qty;

            // Type
            if (isPerso) types['Personalizada'] += qty;
            else types['Transparente'] += qty;

            // Daily breakdown
            if (dateStr) {
                const dayMonth = dateStr.substring(0, 5); // "DD/MM"
                if (dailyBreakdown[dayMonth]) {
                    dailyBreakdown[dayMonth].total += qty;
                    if (isPerso) dailyBreakdown[dayMonth].perso += qty;
                    else dailyBreakdown[dayMonth].transp += qty;
                }
            }
        });

        // Charts
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // Calculate Today + 2 Days Ago (Orders)
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(today.getDate() - 2);
        const twoDaysAgoStr = `${twoDaysAgo.getFullYear()}-${String(twoDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(twoDaysAgo.getDate()).padStart(2, '0')}`;

        const qtyTodayTotal = (dailyPerso[todayStr] || 0) + (dailyTransp[todayStr] || 0);
        const qtyTwoDaysAgoTotal = (dailyPerso[twoDaysAgoStr] || 0) + (dailyTransp[twoDaysAgoStr] || 0);

        const displayTotalQty = qtyTodayTotal + qtyTwoDaysAgoTotal;
        const displayPersoQty = (dailyPerso[todayStr] || 0) + (dailyPerso[twoDaysAgoStr] || 0);
        const displayTranspQty = (dailyTransp[todayStr] || 0) + (dailyTransp[twoDaysAgoStr] || 0);

        const allDates = new Set([...Object.keys(dailyPerso), ...Object.keys(dailyTransp)]);
        let sortedDates = Array.from(allDates).sort();

        if (timeRange === 'today') sortedDates = sortedDates.filter(d => d === todayStr);
        else if (timeRange === 'month') {
            const currentMonth = today.getMonth() + 1;
            const currentYear = today.getFullYear();
            sortedDates = sortedDates.filter(d => {
                const [y, m] = d.split('-').map(Number);
                return y === currentYear && m === currentMonth;
            });
        }
        else if (timeRange === '7d') sortedDates = sortedDates.slice(-7);
        else if (timeRange === '15d') sortedDates = sortedDates.slice(-15);
        else if (timeRange === 'custom' && customDate.start && customDate.end) {
            sortedDates = sortedDates.filter(d => d >= customDate.start && d <= customDate.end);
        }

        const labels = sortedDates.map(d => {
            const parts = d.split('-');
            return `${parts[2]}/${parts[1]}`;
        });

        const chartData = {
            labels,
            datasets: [
                { label: 'Personalizadas', data: sortedDates.map(d => dailyPerso[d] || 0), color: '#c084fc' },
                { label: 'Transparentes', data: sortedDates.map(d => dailyTransp[d] || 0), color: '#2dd4bf' }
            ]
        };

        return {
            metrics: {
                totalQty,
                displayTotalQty, // New field
                displayPersoQty, // New field
                displayTranspQty, // New field
                totalRevenue,
                avgTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
                delayedTransparentQty
            },
            brandData: Object.entries(brands).sort((a, b) => b[1].total - a[1].total).slice(0, 6),
            modelData: Object.entries(models).sort((a, b) => b[1] - a[1]).slice(0, 12),
            chartData,
            statusData: status,
            typeData: types,
            dates,
            dailyBreakdown
        };
    }, [headers, data, timeRange, customDate]);

    const { metrics, brandData, modelData, chartData, statusData, typeData, dates, dailyBreakdown } = memoData;

    const statusChartData = [
        { label: 'Aprovado', value: statusData['Aprovado'] || 0, color: '#10b981' },
        { label: 'Enviado', value: statusData['Enviado'] || 0, color: '#3b82f6' },
        { label: 'Pendente', value: statusData['Pendente'] || 0, color: '#f59e0b' },
        { label: 'Cancelado', value: statusData['Cancelado'] || 0, color: '#ef4444' },
    ];

    const getBreakdownString = (type: 'total' | 'perso' | 'transp') => {
        return dates.map(d => `${d}: ${dailyBreakdown[d][type]}`).join(' | ');
    };

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <KpiCard
                    title="Total (Hoje + 2 dias atrás)"
                    value={(metrics as any).displayTotalQty.toLocaleString('pt-BR')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                    colorObj={{ from: 'from-indigo-500', to: 'to-blue-600', shadow: 'shadow-indigo-500/20' }}
                    subtitle="unidades"
                    breakdown={getBreakdownString('total')}
                />
                <KpiCard
                    title="Personalizadas"
                    value={(metrics as any).displayPersoQty.toLocaleString('pt-BR')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                    colorObj={{ from: 'from-purple-500', to: 'to-fuchsia-600', shadow: 'shadow-purple-500/20' }}
                    breakdown={getBreakdownString('perso')}
                />
                <KpiCard
                    title="Transparentes"
                    value={(metrics as any).displayTranspQty.toLocaleString('pt-BR')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>}
                    colorObj={{ from: 'from-teal-500', to: 'to-emerald-600', shadow: 'shadow-teal-500/20' }}
                    breakdown={getBreakdownString('transp')}
                />
                <KpiCard
                    title="Ticket Médio"
                    value={formatCurrency(metrics.avgTicket)}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                    colorObj={{ from: 'from-cyan-500', to: 'to-blue-600', shadow: 'shadow-cyan-500/20' }}
                />
                <KpiCard
                    title="Transp. Atrasadas"
                    value={metrics.delayedTransparentQty.toLocaleString('pt-BR')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    colorObj={{ from: 'from-red-500', to: 'to-orange-600', shadow: 'shadow-red-500/20' }}
                    subtitle="> 1 dia sem envio"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                        <MultiLineChart datasets={chartData.datasets} labels={chartData.labels} title="Tendência de Vendas" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in-scale" style={{ animationDelay: '500ms' }}>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Status dos Pedidos</h3>
                    <DonutChart data={statusChartData} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in-scale" style={{ animationDelay: '600ms' }}>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Top Marcas</h3>
                    <div className="space-y-5">
                        {brandData.map(([brand, counts]) => {
                            const maxTotal = brandData[0][1].total;
                            const persoPercent = (counts.perso / maxTotal) * 100;
                            const transpPercent = (counts.transp / maxTotal) * 100;

                            return (
                                <div key={brand} className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-end">
                                        <span className="font-bold text-gray-700 dark:text-gray-300 text-sm">{brand || 'N/A'}</span>
                                        <span className="font-bold text-gray-900 dark:text-white text-lg">{counts.total}</span>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-grow bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="bg-[#c084fc] h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${persoPercent}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-[10px] font-semibold text-[#c084fc] w-6 text-right">{counts.perso}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="flex-grow bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="bg-[#2dd4bf] h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${transpPercent}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-[10px] font-semibold text-[#2dd4bf] w-6 text-right">{counts.transp}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in-scale" style={{ animationDelay: '700ms' }}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Modelos Populares</h3>
                        <div className="flex gap-2 text-xs">
                            <span className="px-2 py-1 rounded-md bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200">Perso: {typeData['Personalizada']}</span>
                            <span className="px-2 py-1 rounded-md bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">Transp: {typeData['Transparente']}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {modelData.map(([model, count], index) => (
                            <div key={model} className="flex items-center p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                                <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs mr-3 ${getRankColorClass(index)}`}>
                                    {index + 1}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{model}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{count} unidades</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CapinhasDashboard;