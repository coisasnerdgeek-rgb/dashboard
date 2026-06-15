import React from 'react';

interface EstampasKPIsProps {
    summaryData: Record<string, number>;
    handleCardClick: (status: string) => void;
    cardFilter: string | null;
    isSyncing: boolean;
    syncProgress: { current: number; total: number };
}

export const EstampasKPIs: React.FC<EstampasKPIsProps> = ({
    summaryData,
    handleCardClick,
    cardFilter,
    isSyncing,
    syncProgress
}) => {
    // Calculate specific metrics for specific cards
    const totalCount = summaryData['TOTAL'] || 0;
    const impressoCount = summaryData['IMPRESSO'] || 0;
    const progressoPercent = totalCount > 0 ? Math.round((impressoCount / totalCount) * 100) : 0;

    const cards = [
        {
            id: 'PROGRESSO',
            label: 'PROGRESSO',
            value: `${progressoPercent}%`,
            subValue: `${impressoCount}/${totalCount}`,
            bgColor: 'bg-teal-500',
            textColor: 'text-white',
            onClick: () => handleCardClick('TODOS'),
            icon: (
                <svg className="absolute -right-2 -bottom-2 h-16 w-16 text-white/10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
            )
        },
        {
            id: 'FAZER ARTE',
            label: 'FAZER ARTE',
            value: summaryData['FAZER ARTE'] || 0,
            bgColor: 'bg-orange-500',
            textColor: 'text-white',
            icon: <svg className="absolute -right-1 -bottom-1 h-12 w-12 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
        },
        {
            id: 'PRONTA',
            label: 'PRONTA',
            value: summaryData['PRONTA'] || 0,
            bgColor: 'bg-yellow-400',
            textColor: 'text-white',
            icon: <svg className="absolute -right-1 -bottom-1 h-12 w-12 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
        },
        {
            id: 'APROVAÇÃO',
            label: 'APROVAÇÃO',
            value: summaryData['APROVAÇÃO'] || 0,
            bgColor: 'bg-blue-500',
            textColor: 'text-white',
            icon: <svg className="absolute -right-1 -bottom-1 h-12 w-12 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" /></svg>
        },
        {
            id: 'APROVADO',
            label: 'APROVADO',
            value: summaryData['APROVADO'] || 0,
            bgColor: 'bg-purple-600',
            textColor: 'text-white',
            icon: <svg className="absolute -right-1 -bottom-1 h-12 w-12 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z" /></svg>
        },
        {
            id: 'IMPRESSO',
            label: 'IMPRESSO',
            value: summaryData['IMPRESSO'] || 0,
            bgColor: 'bg-emerald-600',
            textColor: 'text-white',
            icon: <svg className="absolute -right-1 -bottom-1 h-12 w-12 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" /></svg>
        },
        {
            id: 'AJUSTE',
            label: 'AJUSTE',
            value: summaryData['AJUSTE'] || 0,
            bgColor: 'bg-fuchsia-500',
            textColor: 'text-white',
            icon: <svg className="absolute -right-1 -bottom-1 h-12 w-12 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
        },
        {
            id: 'SEM IMAGEM',
            label: 'SEM IMAGEM',
            value: summaryData['SEM IMAGEM'] || 0,
            bgColor: 'bg-red-600',
            textColor: 'text-white',
            icon: <svg className="absolute -right-1 -bottom-1 h-12 w-12 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>
        },
        {
            id: 'ERRO',
            label: 'ERRO',
            value: summaryData['ERRO IMPRESSÃO'] || 0,
            bgColor: 'bg-red-700',
            textColor: 'text-white',
            icon: <svg className="absolute -right-1 -bottom-1 h-12 w-12 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
        },
        {
            id: 'NÃO CHEGOU',
            label: 'NÃO CHEGOU',
            value: summaryData['NÃO CHEGOU'] || 0,
            bgColor: 'bg-[#722f37]',
            textColor: 'text-white',
            icon: <svg className="absolute -right-1 -bottom-1 h-12 w-12 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" /></svg>
        },
        {
            id: 'RISCO',
            label: 'RISCO / ATRASO',
            value: `${summaryData['RISCO'] || 0} / ${summaryData['ATRASADO'] || 0}`,
            bgColor: 'bg-amber-600',
            textColor: 'text-white',
            onClick: () => handleCardClick(cardFilter === 'RISCO' ? 'ATRASADO' : 'RISCO'),
            icon: <svg className="absolute -right-1 -bottom-1 h-12 w-12 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M13 14h-2V9h2v5zm0 4h-2v-2h2v2zm-12 3h22L12 2 1 21z" /></svg>
        },
        {
            id: 'CANCELADO',
            label: 'CANC/PEÇAS',
            value: summaryData['CANCELADO'] || 0,
            bgColor: 'bg-black',
            textColor: 'text-white',
            icon: <svg className="absolute -right-1 -bottom-1 h-12 w-12 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" /></svg>
        },
    ];

    return (
        <div className="z-30 transition-all duration-300">
            {/* Responsive Cards Container - Full Width Distributed */}
            <div className="flex flex-wrap gap-2">
                {cards.map((card) => (
                    <button
                        key={card.id}
                        onClick={card.onClick || (() => handleCardClick(card.id))}
                        className={`
                            relative flex-1 min-w-[90px] flex flex-col items-center justify-center overflow-hidden
                            h-[65px] rounded-xl shadow-sm transition-all duration-200
                            ${card.bgColor} ${card.textColor}
                            hover:scale-105 active:scale-95
                            ${cardFilter === card.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0f172a] z-10' : 'opacity-100'}
                        `}
                    >
                        {card.icon}

                        {card.id === 'PROGRESSO' ? (
                            <div className="flex flex-col items-center leading-none">
                                <div className="text-[10px] font-extrabold uppercase mb-1.5 opacity-90 tracking-wider">{card.label}</div>
                                <div className="flex items-baseline gap-1.5 mb-2">
                                    <span className="text-lg font-black">{card.value}</span>
                                    <span className="text-[11px] opacity-80 font-bold">{card.subValue}</span>
                                </div>
                                <div className="w-20 h-1.5 bg-black/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-white/90" style={{ width: card.value }}></div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center leading-none">
                                <div className="text-[10px] font-extrabold uppercase mb-1.5 opacity-90 tracking-wider w-full px-2 truncate text-center">{card.label}</div>
                                <div className="text-xl font-black">{card.value}</div>
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {isSyncing && (
                <div className="mt-1 text-center">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium animate-pulse">
                        Sincronizando imagens: {Math.round((syncProgress.current / syncProgress.total) * 100)}% ({syncProgress.current}/{syncProgress.total})
                    </span>
                </div>
            )}
        </div>
    );
};
