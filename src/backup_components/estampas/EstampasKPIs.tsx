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
    return (
        <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 pb-3 -mx-4 px-4 sm:-mx-8 sm:px-8 border-b dark:border-gray-800 shadow-sm transition-all duration-300">
            {/* Cards KPI - Atualizado com Design Moderno / Glassmorphism Clean */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4 pt-4">
                {/* TOTAL CARD */}
                <div className="animate-fade-in-scale" style={{ animationDelay: '0.1s' }}>
                    <button
                        onClick={() => handleCardClick('TODOS')}
                        className={`relative overflow-hidden w-full text-center p-2 rounded-lg shadow-sm transition-all bg-gradient-to-br from-indigo-500 to-indigo-600 text-white hover:scale-105 active:scale-95 h-full flex flex-col items-center justify-center min-h-[50px] ${!cardFilter ? 'ring-2 ring-white ring-offset-1 ring-offset-indigo-600 shadow-lg scale-105 z-20 font-bold' : 'opacity-90 hover:opacity-100'}`}
                    >
                        <div className="absolute top-0 right-0 p-1 opacity-20">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="text-[9px] font-bold uppercase tracking-tight opacity-80 leading-tight">TOTAL</div>
                            <div className="text-xl font-black leading-tight tracking-tight">{summaryData['TOTAL']}</div>
                            <div className="text-[8px] opacity-70 mt-0.5 font-medium bg-black/20 px-1.5 py-px rounded-full">Itens</div>
                        </div>
                    </button>
                </div>

                {/* IMPRESSO CARD */}
                <div className="animate-fade-in-scale" style={{ animationDelay: '0.2s' }}>
                    <button
                        onClick={() => handleCardClick('IMPRESSO')}
                        className={`relative overflow-hidden w-full text-center p-2 rounded-lg shadow-sm transition-all bg-emerald-600 text-white hover:scale-105 active:scale-95 h-full flex flex-col items-center justify-center min-h-[50px] ${cardFilter === 'IMPRESSO' ? 'ring-2 ring-white ring-offset-1 ring-offset-emerald-600 z-20' : ''}`}
                    >
                        <div className="absolute -right-1.5 -bottom-1.5 opacity-20 transform -rotate-12 scale-[1.8] pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        </div>
                        <div className="relative z-10">
                            <div className="text-[9px] font-bold uppercase tracking-tight opacity-80 leading-tight">IMPRESSO</div>
                            <div className="text-lg font-black leading-tight">{summaryData['IMPRESSO']}</div>
                        </div>
                    </button>
                </div>

                {/* AJUSTE CARD */}
                <div className="animate-fade-in-scale" style={{ animationDelay: '0.3s' }}>
                    <button
                        onClick={() => handleCardClick('AJUSTE')}
                        className={`relative overflow-hidden w-full text-center p-2 rounded-lg shadow-sm transition-all bg-fuchsia-600 text-white hover:scale-105 active:scale-95 h-full flex flex-col items-center justify-center min-h-[50px] ${cardFilter === 'AJUSTE' ? 'ring-2 ring-white ring-offset-1 ring-offset-fuchsia-600 z-20' : ''}`}
                    >
                        <div className="absolute -right-1.5 -bottom-1.5 opacity-20 transform -rotate-12 scale-[1.8] pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </div>
                        <div className="relative z-10">
                            <div className="text-[9px] font-bold uppercase tracking-tight opacity-80 leading-tight">AJUSTE</div>
                            <div className="text-lg font-black leading-tight">{summaryData['AJUSTE']}</div>
                        </div>
                    </button>
                </div>

                {/* SEM IMAGEM CARD */}
                <div className="animate-fade-in-scale" style={{ animationDelay: '0.35s' }}>
                    <button
                        onClick={() => handleCardClick('SEM IMAGEM')}
                        className={`relative overflow-hidden w-full text-center p-2 rounded-lg shadow-sm transition-all bg-red-700 text-white hover:scale-105 active:scale-95 h-full flex flex-col items-center justify-center min-h-[50px] ${cardFilter === 'SEM IMAGEM' ? 'ring-2 ring-white ring-offset-1 ring-offset-red-700' : ''}`}
                    >
                        <div className="absolute -right-1.5 -bottom-1.5 opacity-20 transform -rotate-12 scale-[1.8] pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <div className="relative z-10">
                            <div className="text-[9px] font-bold uppercase tracking-tight opacity-80 leading-tight">SEM IMAGEM</div>
                            <div className="text-lg font-black leading-tight">{summaryData['SEM IMAGEM']}</div>
                        </div>
                    </button>
                </div>

                {/* ERRO CARD */}
                <div className="animate-fade-in-scale" style={{ animationDelay: '0.4s' }}>
                    <button
                        onClick={() => handleCardClick('ERRO IMPRESSÃO')}
                        className={`relative overflow-hidden w-full text-center p-2 rounded-lg shadow-sm transition-all bg-red-600 text-white hover:scale-105 active:scale-95 h-full flex flex-col items-center justify-center min-h-[50px] ${cardFilter === 'ERRO IMPRESSÃO' ? 'ring-2 ring-white ring-offset-1 ring-offset-red-600' : ''}`}
                    >
                        <div className="absolute -right-1.5 -bottom-1.5 opacity-20 transform -rotate-12 scale-[1.8] pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div className="relative z-10">
                            <div className="text-[9px] font-bold uppercase tracking-tight opacity-80 leading-tight">ERRO</div>
                            <div className="text-lg font-black leading-tight">{summaryData['ERRO IMPRESSÃO']}</div>
                        </div>
                    </button>
                </div>

                {/* RISCO / ATRASO CARD */}
                <div className="animate-fade-in-scale" style={{ animationDelay: '0.45s' }}>
                    <button
                        onClick={() => handleCardClick(cardFilter === 'RISCO' ? 'ATRASADO' : 'RISCO')}
                        className={`relative overflow-hidden w-full text-center p-2 rounded-lg shadow-sm transition-all bg-amber-600 text-white hover:scale-105 active:scale-95 h-full flex flex-col items-center justify-center min-h-[50px] ${(cardFilter === 'RISCO' || cardFilter === 'ATRASADO') ? 'ring-2 ring-white ring-offset-1 ring-offset-amber-600 z-20' : ''}`}
                    >
                        <div className="absolute -right-1.5 -bottom-1.5 opacity-20 transform -rotate-12 scale-[1.8] pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <div className="relative z-10">
                            <div className="text-[9px] font-bold uppercase tracking-tight opacity-80 leading-tight">RISCO / ATRASO</div>
                            <div className="text-lg font-black leading-tight">{summaryData['RISCO']} / {summaryData['ATRASADO']}</div>
                        </div>
                    </button>
                </div>

                {/* CANCELADO CARD */}
                <div className="animate-fade-in-scale" style={{ animationDelay: '0.5s' }}>
                    <button
                        onClick={() => handleCardClick('CANCELADO')}
                        className={`relative overflow-hidden w-full text-center p-2 rounded-lg shadow-sm transition-all bg-slate-700 text-white hover:scale-105 active:scale-95 h-full flex flex-col items-center justify-center min-h-[50px] ${cardFilter === 'CANCELADO' ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-700 z-20' : ''}`}
                    >
                        <div className="absolute -right-1.5 -bottom-1.5 opacity-20 transform -rotate-12 scale-[1.8] pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                        <div className="relative z-10">
                            <div className="text-[9px] font-bold uppercase tracking-tight opacity-80 leading-tight">CANCELADO</div>
                            <div className="text-lg font-black leading-tight">{summaryData['CANCELADO']}</div>
                        </div>
                    </button>
                </div>
            </div>

            {isSyncing && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg flex items-center gap-3 animate-pulse">
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                        Sincronizando imagens do Google Drive... ({syncProgress.current}/{syncProgress.total})
                    </span>
                </div>
            )}

            {/* O conteúdo sticky continua em EstampasFilterBar */}
        </div>
    );
};
