import React from 'react';
import toast from 'react-hot-toast';
import { EstampaRow, Lote } from '../../types';

interface EstampasFilterBarProps {
    filters: Partial<Record<keyof EstampaRow | 'search' | 'month', string>>;
    handleFilterChange: (field: keyof EstampaRow | 'search' | 'month', value: string) => void;
    setEnterPressedForSearch: (pressed: boolean) => void;
    uniqueFilterValues: {
        canais: string[];
        status: string[];
        locais: string[];
    };
    selectedCnpj: string;
    setSelectedCnpj: (value: string) => void;
    showImpresso: boolean;
    setShowImpresso: (show: boolean) => void;
    isDriveConnected: boolean;
    handleSignIn: () => Promise<void>;
    setIsDriveConnected: (connected: boolean) => void;
    openModal: () => void;

    // Bulk Selection Props
    selectedCount: number;
    lotes: Lote[];
    bulkLoteNumber: string;
    setBulkLoteNumber: (value: string) => void;
    onBulkLoteAssignment: () => void;
    onClearSelection: () => void;

    // States for closing popovers (optional UI sugar)
    editingLinkRowId?: string | null;
    editingArteProntaRowId?: string | null;
    setEditingLinkRowId?: (id: string | null) => void;
    setEditingArteProntaRowId?: (id: string | null) => void;
}

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const EstampasFilterBar: React.FC<EstampasFilterBarProps> = ({
    filters,
    handleFilterChange,
    setEnterPressedForSearch,
    uniqueFilterValues,
    selectedCnpj,
    setSelectedCnpj,
    showImpresso,
    setShowImpresso,
    isDriveConnected,
    handleSignIn,
    setIsDriveConnected,
    openModal,
    selectedCount,
    lotes,
    bulkLoteNumber,
    setBulkLoteNumber,
    onBulkLoteAssignment,
    onClearSelection,
}) => {
    // Local state for search to ensure smooth typing
    const [localSearch, setLocalSearch] = React.useState(filters.search || '');

    // Sync local search with filter prop when filters.search changes externally
    React.useEffect(() => {
        if (filters.search !== localSearch) {
            setLocalSearch(filters.search || '');
        }
    }, [filters.search]);

    // Debounce filter change for performance
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== (filters.search || '')) {
                handleFilterChange('search', localSearch);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearch]);

    return (
        <div className="flex flex-col gap-3">
            {/* Bulk Selection Panel - Shows when items are selected */}
            {selectedCount > 0 && (
                <div className="bg-gradient-to-r from-purple-900/30 to-purple-800/20 border border-purple-500/40 rounded-lg px-4 py-3 flex items-center gap-4 shadow-lg animate-fade-in">
                    <div className="flex items-center gap-2 text-purple-300 font-bold">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>{selectedCount} pedido(s) selecionado(s)</span>
                    </div>

                    <div className="flex-grow flex items-center gap-3">
                        <select
                            value={bulkLoteNumber}
                            onChange={e => setBulkLoteNumber(e.target.value)}
                            className="flex-grow max-w-xs py-2 pl-3 pr-10 text-sm bg-slate-800/80 border border-purple-500/30 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 text-white rounded-lg appearance-none cursor-pointer"
                        >
                            <option value="">🏷 Selecione o lote</option>
                            {lotes.map(lote => (
                                <option key={lote.id} value={lote.numeroLote}>
                                    {lote.numeroLote}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={onBulkLoteAssignment}
                            disabled={!bulkLoteNumber}
                            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-md"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Atribuir Lote
                        </button>

                        <button
                            onClick={onClearSelection}
                            className="p-2 text-purple-300 hover:text-purple-100 hover:bg-purple-800/30 rounded-lg transition-all"
                            title="Limpar seleção"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Original Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center text-sm py-1">
                {/* 1. Busca */}
                <div className="flex-grow min-w-[200px] w-full md:w-auto">
                    <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.1em] mb-1.5 text-shadow-sm">BUSCAR ID / ESTAMPA / RASTREIO</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-3.5 w-3.5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={localSearch}
                            onChange={e => setLocalSearch(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { setEnterPressedForSearch(true); } }}
                            placeholder="Filtrar..."
                            className="block w-full pl-9 pr-3 py-2 text-sm bg-slate-800/80 border border-gray-700/50 focus:border-blue-500/50 focus:bg-slate-800 focus:ring-0 text-white rounded-lg placeholder-gray-500 transition-all shadow-inner"
                        />
                    </div>
                </div>

                {/* 2. Canal */}
                <div className="min-w-[130px] w-full md:w-auto">
                    <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.1em] mb-1.5">CANAL</label>
                    <select
                        value={filters.canal || ''}
                        onChange={e => handleFilterChange('canal', e.target.value)}
                        className="block w-full py-2 pl-3 pr-10 text-sm bg-slate-800/80 border border-gray-700/50 focus:border-blue-500/50 focus:bg-slate-800 focus:ring-0 text-white rounded-lg appearance-none cursor-pointer shadow-inner"
                    >
                        <option value="">Todos</option>
                        {uniqueFilterValues.canais.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                {/* 3. Local */}
                <div className="min-w-[130px] w-full md:w-auto">
                    <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.1em] mb-1.5">LOCAL</label>
                    <select
                        value={filters.local || ''}
                        onChange={e => handleFilterChange('local', e.target.value)}
                        className="block w-full py-2 pl-3 pr-10 text-sm bg-slate-800/80 border border-gray-700/50 focus:border-blue-500/50 focus:bg-slate-800 focus:ring-0 text-white rounded-lg appearance-none cursor-pointer shadow-inner"
                    >
                        <option value="">Todos</option>
                        {uniqueFilterValues.locais.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>

                {/* 4. Month */}
                <div className="min-w-[130px] w-full md:w-auto">
                    <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.1em] mb-1.5">MÊS</label>
                    <select
                        value={filters.month || ''}
                        onChange={e => handleFilterChange('month', e.target.value)}
                        className="block w-full py-2 pl-3 pr-10 text-sm bg-slate-800/80 border border-gray-700/50 focus:border-blue-500/50 focus:bg-slate-800 focus:ring-0 text-white rounded-lg appearance-none cursor-pointer shadow-inner"
                    >
                        <option value="">Todos</option>
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {/* 5. Lote Filter */}
                <div className="min-w-[130px] w-full md:w-auto">
                    <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.1em] mb-1.5">LOTE</label>
                    <select
                        value={filters.L || ''}
                        onChange={e => handleFilterChange('L' as keyof EstampaRow, e.target.value)}
                        className="block w-full py-2 pl-3 pr-10 text-sm bg-slate-800/80 border border-gray-700/50 focus:border-blue-500/50 focus:bg-slate-800 focus:ring-0 text-white rounded-lg appearance-none cursor-pointer shadow-inner"
                    >
                        <option value="">Todos</option>
                        {lotes.map(lote => (
                            <option key={lote.id} value={lote.numeroLote}>
                                {lote.numeroLote}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Actions Group */}
                <div className="flex flex-col gap-0.5 w-full md:w-auto mt-auto">
                    <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.1em] mb-1.5 ml-1">OPÇÕES</label>
                    <div className="flex items-center gap-2.5">


                        <button
                            onClick={handleSignIn}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all h-[38px] shadow-sm ${isDriveConnected
                                ? 'bg-blue-900/40 text-blue-400 border border-blue-800'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                        >
                            {!isDriveConnected && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 256 256" fill="currentColor">
                                    <path d="M240.5,155.3L165.2,24.2H90.8l0,0l75.4,131.1H240.5z M102.9,166.2l-37.1,65.6h143.1l37.1-65.6H102.9z M81,40.6L10,166.2l37.2,65.6l72.1-125.7L81,40.6z" />
                                </svg>
                            )}
                            {isDriveConnected ? 'Drive Conectado' : 'Conectar Drive'}
                        </button>

                        <button
                            onClick={openModal}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md h-[38px]"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
                            ADICIONAR ESTAMPA
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
