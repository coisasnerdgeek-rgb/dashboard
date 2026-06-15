import * as React from 'react';
import { PaymentItem } from '../types';

interface PagamentoDashboardProps {
    pendingPayments: PaymentItem[];
    archivedPayments: PaymentItem[];
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

interface KpiCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    gradient: string;
    shadow: string;
    subtitle?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, gradient, shadow, subtitle }) => (
    <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} rounded-2xl p-4 text-white shadow-lg ${shadow} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group`}>
        <div className="absolute -right-4 -bottom-4 opacity-10 transform rotate-12 group-hover:scale-110 transition-transform duration-500">
            {React.cloneElement(icon as React.ReactElement<any>, { className: "h-16 w-16" })}
        </div>
        <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-[10px] uppercase tracking-wider opacity-90">{title}</h3>
                <div className="p-1 bg-white/20 rounded-lg backdrop-blur-sm shadow-inner">
                    {React.cloneElement(icon as React.ReactElement<any>, { className: "h-4 w-4" })}
                </div>
            </div>
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            {subtitle && <div className="mt-2 text-xs font-medium opacity-80">{subtitle}</div>}
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
                        {datasets.map((d, i) => (<linearGradient key={`grad-${i}`} id={`pmt-grad-${i}`} x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor={d.color} stopOpacity={0.4} /><stop offset="100%" stopColor={d.color} stopOpacity={0} /></linearGradient>))}
                    </defs>
                    {datasets.map((dataset, idx) => {
                        const points = buildPoints(dataset.data);
                        return (
                            <g key={dataset.label}>
                                <polygon points={`${points} ${labels.length === 1 ? width / 2 : width},${height} ${labels.length === 1 ? width / 2 : 0},${height}`} fill={`url(#pmt-grad-${idx})`} />
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
                            <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(item.value)}</span>
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

const PagamentoDashboard: React.FC<PagamentoDashboardProps> = ({ pendingPayments, archivedPayments }) => {
    const [timeRange, setTimeRange] = React.useState<'7d' | '15d' | 'month' | 'custom'>('7d');
    const [customDate, setCustomDate] = React.useState<{ start: string; end: string }>({ start: '', end: '' });

    const { metrics, chartData, topPendingStores, topPaidStores } = React.useMemo(() => {
        const allPayments = [...pendingPayments, ...archivedPayments];

        const dailySentValue: Record<string, number> = {};
        const dailyPaidValue: Record<string, number> = {};
        const pendingByStore: Record<string, number> = {};

        // General metrics (not time-filtered)
        const totalPendente = pendingPayments.reduce((sum, p) => sum + (p.totalValue - p.amountPaid), 0);

        pendingPayments.forEach(p => {
            pendingByStore[p.store] = (pendingByStore[p.store] || 0) + (p.totalValue - p.amountPaid);
        });

        // Daily aggregations
        allPayments.forEach(p => {
            const sentDate = formatDateKey(new Date(p.sentDate));
            dailySentValue[sentDate] = (dailySentValue[sentDate] || 0) + p.totalValue;

            p.paymentHistory.forEach(h => {
                const paidDate = formatDateKey(new Date(h.date));
                dailyPaidValue[paidDate] = (dailyPaidValue[paidDate] || 0) + h.amount;
            });
        });

        // Time-filtered metrics
        const dates = generateDateRange(timeRange, customDate.start, customDate.end);
        const labels = dates.map(d => `${d.split('-')[2]}/${d.split('-')[1]}`);

        const sentInPeriod = dates.reduce((sum, d) => sum + (dailySentValue[d] || 0), 0);
        const paidInPeriod = dates.reduce((sum, d) => sum + (dailyPaidValue[d] || 0), 0);

        // Time-filtered store payments
        const paidByStoreInPeriod: Record<string, number> = {};
        allPayments.forEach(p => {
            p.paymentHistory.forEach(h => {
                const paidDate = formatDateKey(new Date(h.date));
                if (dates.includes(paidDate)) {
                    paidByStoreInPeriod[p.store] = (paidByStoreInPeriod[p.store] || 0) + h.amount;
                }
            });
        });

        return {
            metrics: {
                totalPendente,
                sentInPeriod,
                paidInPeriod,
                pendingGrades: pendingPayments.length
            },
            chartData: {
                labels,
                datasets: [
                    { label: 'Valor Enviado', data: dates.map(d => dailySentValue[d] || 0), color: '#3b82f6' },
                    { label: 'Valor Pago', data: dates.map(d => dailyPaidValue[d] || 0), color: '#10b981' },
                ]
            },
            topPendingStores: Object.entries(pendingByStore).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value })),
            topPaidStores: Object.entries(paidByStoreInPeriod).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value })),
        };

    }, [pendingPayments, archivedPayments, timeRange, customDate]);

    return (
        <div className="animate-fade-in-scale space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="Valor Pendente Total" value={formatCurrency(metrics.totalPendente)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} gradient="from-red-500 to-orange-600" shadow="shadow-red-500/20" />
                <KpiCard title="Enviado no Período" value={formatCurrency(metrics.sentInPeriod)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8a1 1 0 001-1z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16h2a1 1 0 001-1V7l-4-4H9a1 1 0 00-1 1v2" /></svg>} gradient="from-blue-500 to-indigo-600" shadow="shadow-blue-500/20" />
                <KpiCard title="Pago no Período" value={formatCurrency(metrics.paidInPeriod)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>} gradient="from-emerald-500 to-teal-600" shadow="shadow-emerald-500/20" />
                <KpiCard title="Grades Pendentes" value={metrics.pendingGrades.toString()} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} gradient="from-purple-500 to-pink-600" shadow="shadow-purple-500/20" />
            </div>

            <TimeRangeControl value={timeRange} onChange={setTimeRange} customDate={customDate} onCustomDateChange={setCustomDate} />

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <MultiLineChart datasets={chartData.datasets} labels={chartData.labels} title="Tendência de Envios vs. Pagamentos" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TopListPanel title="Top Lojas por Valor Pendente" items={topPendingStores} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" /></svg>} />
                <TopListPanel title="Top Lojas por Valor Pago (Período)" items={topPaidStores} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>} />
            </div>
        </div>
    );
};

export default PagamentoDashboard;
