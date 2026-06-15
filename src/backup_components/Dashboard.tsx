

import * as React from 'react';
import { View } from '../App';
import { deleteManualSpreadsheetData } from '../services/supabaseService';
import KpiCard from './common/KpiCard';
import { useAppContext } from '../contexts/AppContext';

interface DashboardProps {
    metrics: {
        totalPedidos: number;
        faturamentoTotal: number;
        itensPendentes: number;
        skuAssociadosCount: number;
        totalPriceTableProducts: number;
        imagensAssociadasCount: number;
        totalUniqueOrderIds: number;
        statusEstampas: Record<string, number>;

        // Daily Breakdowns for dynamic filtering
        dailySales: Record<string, number>;
        dailyOrders: Record<string, number>;
        dailyCapinhas: Record<string, { perso: number; transp: number }>;
        dailyEstampas: Record<string, { fila: number; impresso: number }>;
        dailyKits: Record<string, number>;
        dailyMulti: Record<string, number>;
        dailySavedOrders: Record<string, number>;
        dailyInvalidSku: Record<string, number>;
        dailyCancelledSales: Record<string, number>;

        // Alerts
        estampasAtrasadasCount: number;
        backorderItemsCount: number;
        backorderUniqueOrders: number;
        backorderAvulsos: number;
        capinhasTransparentesAtrasadas: number;
    };
    setCurrentView: (view: View) => void;
    pendingCapinhasCount: number;
    invalidSkuCount: number;
    savedOrdersCount: number;
    fazerArteCount: number;
}

// --- Helper Functions ---

const formatCurrency = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

const generateDateRange = (range: '7d' | '15d' | 'month' | 'custom', customStart?: string, customEnd?: string): string[] => {
    const dates: string[] = [];
    const end = new Date(); // Today
    end.setHours(0, 0, 0, 0);

    let start = new Date(end);

    if (range === '7d') {
        start.setDate(end.getDate() - 6);
    } else if (range === '15d') {
        start.setDate(end.getDate() - 14);
    } else if (range === 'month') {
        start.setDate(1); // 1st of current month
    } else if (range === 'custom' && customStart && customEnd) {
        // Need to handle string inputs "YYYY-MM-DD" properly
        const [sY, sM, sD] = customStart.split('-').map(Number);
        const [eY, eM, eD] = customEnd.split('-').map(Number);
        start = new Date(sY, sM - 1, sD);
        end.setFullYear(eY, eM - 1, eD);
    }

    // Generate array
    const current = new Date(start);
    while (current <= end) {
        dates.push(formatDateKey(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
};

const getPreviousPeriodDates = (currentDates: string[]): string[] => {
    if (currentDates.length === 0) return [];
    const daysCount = currentDates.length;

    const shiftedDates = currentDates.map(dateStr => {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() - daysCount);
        return formatDateKey(d);
    });

    return shiftedDates;
};

// --- Components ---

// --- Main Component ---

const DonutChartWithTooltip: React.FC<{ data: { label: string; value: number; color: string }[], centerLabel?: string, showPercentage?: boolean }> = ({ data, centerLabel, showPercentage }) => {
    // Ensure all values are valid numbers
    const validData = data.map(item => ({
        ...item,
        value: typeof item.value === 'number' && !isNaN(item.value) ? item.value : 0
    }));

    const total = validData.reduce((acc, item) => acc + item.value, 0);

    // If no data, render a placeholder or empty state, but ensure layout holds
    if (total === 0) return <div className="flex items-center justify-center h-full text-gray-500 text-sm italic">Sem dados para o período.</div>;

    let cumulativePercent = 0;
    const getCoordinatesForPercent = (percent: number) => [Math.cos(2 * Math.PI * percent), Math.sin(2 * Math.PI * percent)];

    const primaryValue = validData[0]?.value || 0;
    const percentage = total > 0 ? Math.round((primaryValue / total) * 100) : 0;

    return (
        <div className="flex items-center gap-8 h-full justify-center">
            <div className="relative w-40 h-40 flex-shrink-0 group">
                <div className="absolute inset-0 bg-primary-500/5 rounded-full blur-xl group-hover:bg-primary-500/10 transition-all duration-500"></div>
                <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full relative z-10 drop-shadow-md">
                    {validData.map((slice) => {
                        if (slice.value === 0) return null;
                        const startPercent = cumulativePercent;
                        const slicePercent = slice.value / total;
                        cumulativePercent += slicePercent;
                        const endPercent = cumulativePercent;

                        const [startX, startY] = getCoordinatesForPercent(startPercent);
                        const [endX, endY] = getCoordinatesForPercent(endPercent);
                        const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

                        const pathData = [`M 0 0`, `L ${startX} ${startY}`, `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, `Z`].join(' ');

                        return <path key={slice.label} d={pathData} fill={slice.color} className="hover:opacity-90 transition-opacity cursor-pointer" />;
                    })}
                    {/* Inner circle to make it a donut */}
                    <circle cx="0" cy="0" r="0.75" className="fill-white dark:fill-gray-800" />
                </svg>

                {/* Centered Text Container - High Z-Index to ensure visibility over SVG */}
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <div className="flex flex-col items-center justify-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{centerLabel || (showPercentage ? 'Concluído' : 'Total')}</span>
                        <span className="text-2xl font-black text-gray-800 dark:text-white drop-shadow-sm">
                            {showPercentage ? `${percentage}%` : total}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-3 justify-center min-w-[120px]">
                {validData.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm group cursor-default">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full shadow-sm ring-1 ring-white/10" style={{ backgroundColor: item.color }}></span>
                            <span className="text-gray-600 dark:text-gray-300 font-medium group-hover:text-gray-900 dark:group-hover:text-white transition-colors truncate max-w-[120px]" title={item.label}>{item.label}</span>
                        </div>
                        <span className="font-bold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded-md text-xs">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface ChartDataset {
    label: string;
    data: number[];
    color: string;
    dashed?: boolean;
}

const MultiLineChart: React.FC<{ datasets: ChartDataset[]; labels: string[]; title: string; formatValue?: (val: number) => string }> = ({ datasets, labels, title, formatValue }) => {
    const [isAnimated, setIsAnimated] = React.useState(false);

    React.useEffect(() => {
        // Trigger animation after mount
        const timer = setTimeout(() => setIsAnimated(true), 100);
        return () => clearTimeout(timer);
    }, []);

    if (labels.length === 0) return <div className="flex h-full items-center justify-center text-gray-400 text-sm italic">Sem dados para o período</div>;

    const allValues = datasets.flatMap(d => d.data);
    const max = Math.max(...allValues, 1);
    const width = 1000;
    const height = 200;

    const buildPoints = (data: number[]) => data.map((val, i) => {
        const x = labels.length === 1 ? width / 2 : (i / (labels.length - 1)) * width;
        const y = height - (val / max) * height;
        return `${x},${y}`;
    }).join(' ');

    const formatLabel = formatValue || ((val: number) => Math.round(val).toString());

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 px-2">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    {title}
                </h3>
                <div className="flex flex-wrap gap-3 text-[10px] bg-gray-100/50 dark:bg-gray-700/30 p-1.5 rounded-full border border-gray-200 dark:border-gray-600/50">
                    {datasets.map(d => (
                        <div key={d.label} className="flex items-center gap-1.5 px-2">
                            {d.dashed ? (
                                <div className="w-3 h-0.5 bg-gray-400" style={{ borderTop: `2px dashed ${d.color}` }}></div>
                            ) : (
                                <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: d.color }}></span>
                            )}
                            <span className="text-gray-600 dark:text-gray-300 font-medium">{d.label}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="relative flex-grow h-48 group">
                <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                        {datasets.map((d, i) => (
                            <linearGradient key={`grad-${i}`} id={`dash-grad-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor={d.color} stopOpacity={0.5} />
                                <stop offset="100%" stopColor={d.color} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>

                    {/* Grid Lines */}
                    <line x1="0" y1={height} x2={width} y2={height} stroke="#e5e7eb" strokeWidth="1" className="dark:stroke-gray-700" />
                    <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" className="dark:stroke-gray-700 opacity-50" />
                    <line x1="0" y1={0} x2={width} y2={0} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" className="dark:stroke-gray-700 opacity-50" />

                    {datasets.map((dataset, idx) => {
                        const points = buildPoints(dataset.data);

                        const fillPath = (
                            <polygon
                                points={`${points} ${width},${height} 0,${height}`}
                                fill={`url(#dash-grad-${idx})`}
                                className="transition-all duration-500"
                                style={{
                                    opacity: isAnimated ? 1 : 0,
                                    transform: isAnimated ? 'scaleY(1)' : 'scaleY(0)',
                                    transformOrigin: 'bottom',
                                    transition: 'all 1s ease-out'
                                }}
                            />
                        );

                        return (
                            <g key={dataset.label}>
                                {fillPath}
                                <polyline
                                    points={points}
                                    fill="none"
                                    stroke={dataset.color}
                                    strokeWidth={dataset.dashed ? 2 : 3}
                                    strokeDasharray={dataset.dashed ? "6,4" : "none"}
                                    vectorEffect="non-scaling-stroke"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="transition-all duration-500 drop-shadow-sm"
                                    style={{
                                        strokeDashoffset: isAnimated ? 0 : 2000,
                                        transition: 'stroke-dashoffset 1.5s ease-out'
                                    }}
                                />
                                {!dataset.dashed && dataset.data.map((val, i) => {
                                    const x = labels.length === 1 ? width / 2 : (i / (labels.length - 1)) * width;
                                    const y = height - (val / max) * height;
                                    const formattedValue = formatLabel(val);

                                    return (
                                        <g key={i} className="group/point">
                                            {/* Always visible label at the top of each point */}
                                            <foreignObject
                                                x={x - 50}
                                                y={Math.max(y - 35, 5)}
                                                width="100"
                                                height="30"
                                                className="overflow-visible"
                                                style={{
                                                    opacity: isAnimated ? 1 : 0,
                                                    transform: isAnimated ? 'translateY(0)' : 'translateY(10px)',
                                                    transition: `all 0.8s ease-out ${idx * 0.2 + i * 0.1}s`
                                                }}
                                            >
                                                <div className="flex justify-center">
                                                    <div className="px-2 py-0.5 bg-gray-800/90 dark:bg-gray-700/90 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap backdrop-blur-sm">
                                                        {formattedValue}
                                                    </div>
                                                </div>
                                            </foreignObject>

                                            {/* Circle point */}
                                            <circle
                                                cx={x}
                                                cy={y}
                                                r="4"
                                                fill={dataset.color}
                                                stroke="white"
                                                strokeWidth="2"
                                                className="transition-all duration-300 group-hover/point:r-6"
                                                style={{
                                                    opacity: isAnimated ? 1 : 0,
                                                    transform: isAnimated ? 'scale(1)' : 'scale(0)',
                                                    transformOrigin: 'center',
                                                    transition: `all 0.6s ease-out ${idx * 0.2 + i * 0.15}s`
                                                }}
                                            />
                                        </g>
                                    );
                                })}
                            </g>
                        );
                    })}
                </svg>
                <div className="absolute bottom-[-24px] w-full flex justify-between text-[10px] font-medium text-gray-400 px-1">
                    {labels.map((l, i) => <span key={i} className="truncate text-center" style={{ width: `${100 / labels.length}%` }}>{l}</span>)}
                </div>
            </div>
        </div>
    );
};

interface TimeRangeControlProps {
    value: string;
    onChange: (value: '7d' | '15d' | 'month' | 'custom') => void;
    customDate: { start: string; end: string };
    onCustomDateChange: (newDates: { start: string; end: string }) => void;
}

const TimeRangeControl: React.FC<TimeRangeControlProps> = ({ value, onChange, customDate, onCustomDateChange }) => (
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
            <input
                type="date"
                value={customDate.start}
                onChange={(e) => {
                    onCustomDateChange({ ...customDate, start: e.target.value });
                    onChange('custom');
                }}
                className="bg-transparent text-gray-700 dark:text-gray-200 focus:outline-none font-medium cursor-pointer hover:text-primary-600 transition-colors"
            />
            <span className="text-gray-400 font-light">até</span>
            <input
                type="date"
                value={customDate.end}
                onChange={(e) => {
                    onCustomDateChange({ ...customDate, end: e.target.value });
                    onChange('custom');
                }}
                className="bg-transparent text-gray-700 dark:text-gray-200 focus:outline-none font-medium cursor-pointer hover:text-primary-600 transition-colors"
            />
        </div>
    </div>
);


const Dashboard: React.FC<DashboardProps> = ({ metrics, setCurrentView, fazerArteCount }) => {
    const { dateRange, setDateRange } = useAppContext();
    const { skuAssociadosCount, totalPriceTableProducts, imagensAssociadasCount, totalUniqueOrderIds, dailyCapinhas, dailyEstampas, dailySales, dailyOrders, dailyKits, dailyMulti, dailySavedOrders, dailyInvalidSku } = metrics;
    const [timeRange, setTimeRange] = React.useState<'7d' | '15d' | 'month' | 'custom'>('7d');
    const [customDate, setCustomDate] = React.useState<{ start: string; end: string }>({ start: '', end: '' });
    // Animation state to trigger chart growth on mount
    const [isMounted, setIsMounted] = React.useState(false);
    React.useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 150);
        return () => clearTimeout(timer);
    }, []);

    // Mathematical date range generation to ensure X-axis is consistent
    const dates = React.useMemo(() => {
        return generateDateRange(timeRange, customDate.start, customDate.end);
    }, [timeRange, customDate]);

    const prevDates = React.useMemo(() => {
        return getPreviousPeriodDates(dates);
    }, [dates]);

    // Dynamic Metric Calculation
    const filteredMetrics = React.useMemo(() => {
        const faturamento = dates.reduce((sum, date) => sum + (dailySales[date] || 0), 0);
        const pedidos = dates.reduce((sum, date) => sum + (dailyOrders[date] || 0), 0);
        const estampasPendentes = dates.reduce((sum, date) => sum + (dailyEstampas[date]?.fila || 0), 0);

        const capinhasPendentes = dates.reduce((sum, date) => {
            const dayData = dailyCapinhas[date];
            return sum + (dayData ? dayData.perso + dayData.transp : 0);
        }, 0);

        const kits = dates.reduce((sum, date) => sum + (dailyKits[date] || 0), 0);
        const multi = dates.reduce((sum, date) => sum + (dailyMulti[date] || 0), 0);

        const savedOrders = dates.reduce((sum, date) => sum + (dailySavedOrders[date] || 0), 0);
        const invalidSkus = dates.reduce((sum, date) => sum + (dailyInvalidSku[date] || 0), 0);

        return { faturamento, pedidos, estampasPendentes, capinhasPendentes, kits, multi, savedOrders, invalidSkus };
    }, [dailyOrders, dailySales, dailyEstampas, dailyCapinhas, dailyKits, dailyMulti, dailySavedOrders, dailyInvalidSku, dates]);


    // Chart Data Generation
    const processChartLabels = (dateStrings: string[]) => dateStrings.map(d => {
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}`;
    });

    const chartLabels = processChartLabels(dates);

    const salesChartData = React.useMemo(() => {
        // Use zero array if not mounted
        const currentData = isMounted ? dates.map(d => dailySales[d] || 0) : new Array(dates.length).fill(0);
        const prevData = isMounted ? prevDates.map(d => dailySales[d] || 0) : new Array(dates.length).fill(0);
        const cancelledData = isMounted ? dates.map(d => metrics.dailyCancelledSales[d] || 0) : new Array(dates.length).fill(0);

        return {
            labels: chartLabels,
            datasets: [
                { label: 'Faturamento', data: currentData, color: '#3b82f6' },
                { label: 'Cancelado', data: cancelledData, color: '#ef4444', dashed: true },
                { label: 'Anterior', data: prevData, color: '#9ca3af', dashed: true }
            ]
        };
    }, [dailySales, metrics.dailyCancelledSales, dates, prevDates, chartLabels, isMounted]);

    const capinhasChartData = React.useMemo(() => {
        const dataPerso = isMounted ? dates.map(d => dailyCapinhas[d]?.perso || 0) : new Array(dates.length).fill(0);
        const dataTransp = isMounted ? dates.map(d => dailyCapinhas[d]?.transp || 0) : new Array(dates.length).fill(0);
        return {
            labels: chartLabels,
            datasets: [
                { label: 'Personalizadas', data: dataPerso, color: '#c084fc' },
                { label: 'Transparentes', data: dataTransp, color: '#2dd4bf' }
            ]
        };
    }, [dailyCapinhas, dates, chartLabels, isMounted]);

    const estampasChartData = React.useMemo(() => {
        const dataFila = isMounted ? dates.map(d => dailyEstampas[d]?.fila || 0) : new Array(dates.length).fill(0);
        const dataImpresso = isMounted ? dates.map(d => dailyEstampas[d]?.impresso || 0) : new Array(dates.length).fill(0);
        return {
            labels: chartLabels,
            datasets: [
                { label: 'Fila', data: dataFila, color: '#f97316' },
                { label: 'Impresso', data: dataImpresso, color: '#22c55e' }
            ]
        };
    }, [dailyEstampas, dates, chartLabels, isMounted]);

    // Calculated for Donut
    const ordersPendingGrid = Math.max(0, filteredMetrics.pedidos - filteredMetrics.savedOrders);

    const resumoRapidoData = [
        { label: 'Fazer Arte', value: fazerArteCount, color: '#f97316' },
        { label: 'A Montar Grade', value: ordersPendingGrid, color: '#3b82f6' },
        { label: 'SKUs Inválidos', value: filteredMetrics.invalidSkus, color: '#ef4444' },
    ];

    const dateLabel = timeRange === '7d' ? '(7 Dias)' : timeRange === '15d' ? '(15 Dias)' : timeRange === 'month' ? '(Mês)' : '(Período)';

    return (
        <div className="animate-slide-in space-y-8 pt-4">
            {/* Row 1: KPIs */}

            {/* Row 1: KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {[
                    {
                        title: `Pedidos ${dateLabel}`,
                        value: filteredMetrics.pedidos.toLocaleString('pt-BR'),
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
                        colorObj: { from: 'from-blue-500', to: 'to-indigo-600', shadow: 'shadow-blue-500/20' }
                    },
                    {
                        title: `Faturamento ${dateLabel}`,
                        value: formatCurrency(filteredMetrics.faturamento),
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>,
                        colorObj: { from: 'from-emerald-500', to: 'to-teal-600', shadow: 'shadow-emerald-500/20' }
                    },
                    {
                        title: `Estampas Pendentes`,
                        value: filteredMetrics.estampasPendentes.toLocaleString('pt-BR'),
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
                        colorObj: { from: 'from-orange-500', to: 'to-amber-600', shadow: 'shadow-orange-500/20' }
                    },
                    {
                        title: `Capinhas Pendentes`,
                        value: filteredMetrics.capinhasPendentes.toLocaleString('pt-BR'),
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
                        colorObj: { from: 'from-purple-500', to: 'to-pink-600', shadow: 'shadow-purple-500/20' }
                    },
                    {
                        title: `Kits ${dateLabel}`,
                        value: `Kits: ${filteredMetrics.kits} | Mut: ${filteredMetrics.multi}`,
                        valueClassName: "text-lg xl:text-xl whitespace-nowrap",
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
                        colorObj: { from: 'from-pink-500', to: 'to-rose-600', shadow: 'shadow-pink-500/20' }
                    }
                ].map((kpi, index) => (
                    <div key={index} className="animate-slide-in" style={{ animationDelay: `${index * 100}ms` }}>
                        <KpiCard {...kpi} />
                    </div>
                ))}
            </div>

            {/* Row 2: Alerts & Warnings - Compact Design */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    {
                        title: "Transp. Atrasadas",
                        value: metrics.capinhasTransparentesAtrasadas.toLocaleString('pt-BR'),
                        subtitle: "> 1 dia sem envio",
                        icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                        colorObj: { from: '', to: '', shadow: '', iconBg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800/50' }
                    },
                    {
                        title: "Capinhas (Manual)",
                        value: metrics.backorderItemsCount.toLocaleString('pt-BR'),
                        subtitle: "Itens em backorder",
                        icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>,
                        colorObj: { from: '', to: '', shadow: '', iconBg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800/50' }
                    },
                    {
                        title: "Pedidos Atrasados",
                        value: metrics.backorderUniqueOrders.toLocaleString('pt-BR'),
                        subtitle: "Pedidos únicos afetados",
                        icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                        colorObj: { from: '', to: '', shadow: '', iconBg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800/50' }
                    },
                    {
                        title: "Estampas Atrasadas",
                        value: metrics.estampasAtrasadasCount.toLocaleString('pt-BR'),
                        subtitle: "Acima do prazo de risco",
                        icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
                        colorObj: { from: '', to: '', shadow: '', iconBg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800/50' }
                    },
                    {
                        title: "Itens Adicionais",
                        value: metrics.backorderAvulsos.toLocaleString('pt-BR'),
                        subtitle: "Pedidos Avulsos",
                        icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
                        colorObj: { from: '', to: '', shadow: '', iconBg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800/50' }
                    }
                ].map((alert, index) => (
                    <div key={index} className="animate-slide-in" style={{ animationDelay: `${index * 50 + 500}ms` }}>
                        <KpiCard variant="secondary" {...alert} />
                    </div>
                ))}
            </div>

            <TimeRangeControl
                value={timeRange}
                onChange={setTimeRange}
                customDate={customDate}
                onCustomDateChange={setCustomDate}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col hover:shadow-lg transition-shadow duration-300 animate-slide-in" style={{ animationDelay: '600ms' }}>
                    <div className="flex-grow flex items-end pb-4">
                        <MultiLineChart
                            datasets={salesChartData.datasets}
                            labels={salesChartData.labels}
                            title="Tendência de Faturamento"
                            formatValue={(val) => `R$ ${Math.round(val).toLocaleString('pt-BR')}`}
                        />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col hover:shadow-lg transition-shadow duration-300 animate-slide-in" style={{ animationDelay: '700ms' }}>
                    <div className="flex-grow flex items-end pb-4">
                        <MultiLineChart datasets={capinhasChartData.datasets} labels={capinhasChartData.labels} title="Tendência de Capinhas" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col hover:shadow-lg transition-shadow duration-300 animate-slide-in" style={{ animationDelay: '800ms' }}>
                    <div className="flex-grow flex items-end pb-4">
                        <MultiLineChart datasets={estampasChartData.datasets} labels={estampasChartData.labels} title="Fluxo de Estampas (por dia)" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow duration-300 animate-slide-in" style={{ animationDelay: '900ms' }}>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        Resumo Rápido de Pendências
                    </h3>
                    <DonutChartWithTooltip data={resumoRapidoData} centerLabel="" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6 hover:shadow-lg transition-shadow duration-300 animate-slide-in" style={{ animationDelay: '1000ms' }}>
                    <DonutChartWithTooltip
                        data={[{ label: 'Associados', value: skuAssociadosCount, color: '#10b981' }, { label: 'Pendente', value: totalPriceTableProducts - skuAssociadosCount, color: '#f59e0b' }]}
                        showPercentage={true}
                        centerLabel="Concluído"
                    />
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Saúde dos SKUs com preço</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{skuAssociadosCount} de {totalPriceTableProducts} produtos associados.</p>
                        <button onClick={() => setCurrentView('precos')} className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline mt-3 flex items-center gap-1">
                            Gerenciar Preços <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6 hover:shadow-lg transition-shadow duration-300 animate-slide-in" style={{ animationDelay: '1100ms' }}>
                    <DonutChartWithTooltip
                        data={[{ label: 'Associadas', value: imagensAssociadasCount, color: '#3b82f6' }, { label: 'Pendente', value: totalUniqueOrderIds - imagensAssociadasCount, color: '#ef4444' }]}
                        showPercentage={true}
                        centerLabel="Concluído"
                    />
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Saúde das Imagens</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{imagensAssociadasCount} de {totalUniqueOrderIds} pedidos com imagem.</p>
                        <button onClick={() => setCurrentView('imagem')} className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline mt-3 flex items-center gap-1">
                            Gerenciar Imagens <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;