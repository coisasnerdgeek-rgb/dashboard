
import * as React from 'react';

interface ImagemDashboardProps {
    imageMappings: Record<string, string>;
    imageCategories: { id: string; name: string }[];
    imageCategoryAssignments: Record<string, string | null>;
}

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

const BarChart: React.FC<{ data: { label: string; value: number }[]; title: string }> = ({ data, title }) => {
    const max = Math.max(...data.map(d => d.value), 1);

    // Filter out zero values and limit to valid data
    const validData = data.filter(d => d.value > 0);

    if (validData.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{title}</h3>
                <div className="text-gray-400 dark:text-gray-500 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm">Nenhuma categoria encontrada</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">{title}</h3>
            <div className="flex-1 flex items-end gap-2">
                {validData.map((item, i) => {
                    const heightPercent = (item.value / max) * 100;
                    // Ensure minimum 5% height for visibility
                    const displayHeight = Math.max(heightPercent, 5);

                    return (
                        <div key={i} className="flex-1 flex flex-col items-center group">
                            <div
                                className="w-full bg-blue-500 rounded-t-md hover:bg-blue-600 transition-colors relative"
                                style={{ height: `${displayHeight}%` }}
                            >
                                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap transition-opacity pointer-events-none z-10">
                                    {item.value}
                                </div>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate w-full text-center" title={item.label}>{item.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ImagemDashboard: React.FC<ImagemDashboardProps> = ({ imageMappings, imageCategories, imageCategoryAssignments }) => {
    const { metrics, categoryCounts } = React.useMemo(() => {
        const totalImages = Object.keys(imageMappings).length;
        const totalCategories = imageCategories.length;
        let categorizedImages = 0;
        const counts: Record<string, number> = { 'Sem Categoria': 0 };

        imageCategories.forEach(c => counts[c.name] = 0);

        Object.keys(imageMappings).forEach(imgId => {
            const catId = imageCategoryAssignments[imgId];
            if (catId) {
                categorizedImages++;
                const catName = imageCategories.find(c => c.id === catId)?.name || 'Desconhecida';
                counts[catName] = (counts[catName] || 0) + 1;
            } else {
                counts['Sem Categoria']++;
            }
        });

        // Sort counts desc
        const sortedCounts = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([label, value]) => ({ label, value }));

        return {
            metrics: {
                totalImages,
                totalCategories,
                categorizedImages,
                categorizedRate: totalImages > 0 ? (categorizedImages / totalImages) * 100 : 0
            },
            categoryCounts: sortedCounts
        };
    }, [imageMappings, imageCategories, imageCategoryAssignments]);

    const donutData = [
        { label: 'Categorizadas', value: metrics.categorizedImages, color: '#10b981' },
        { label: 'Sem Categoria', value: metrics.totalImages - metrics.categorizedImages, color: '#9ca3af' }
    ];

    return (
        <div className="animate-fade-in-scale space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard
                    title="Total de Imagens"
                    value={metrics.totalImages.toString()}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                    gradient="from-blue-500 to-indigo-600"
                    shadow="shadow-blue-500/20"
                />
                <KpiCard
                    title="Categorizadas"
                    value={`${metrics.categorizedRate.toFixed(0)}%`}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
                    gradient="from-emerald-500 to-teal-600"
                    shadow="shadow-emerald-500/20"
                />
                <KpiCard
                    title="Categorias Criadas"
                    value={metrics.totalCategories.toString()}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                    gradient="from-purple-500 to-fuchsia-600"
                    shadow="shadow-purple-500/20"
                />
                <KpiCard
                    title="Sem Categoria"
                    value={(metrics.totalImages - metrics.categorizedImages).toString()}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                    gradient="from-gray-500 to-slate-600"
                    shadow="shadow-gray-500/20"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-[400px] flex flex-col">
                    <BarChart data={categoryCounts.slice(0, 10)} title="Top Categorias (Volume)" />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-[400px] flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 text-center">Organização</h3>
                    <DonutChart data={donutData} />
                </div>
            </div>
        </div>
    );
};

export default ImagemDashboard;
