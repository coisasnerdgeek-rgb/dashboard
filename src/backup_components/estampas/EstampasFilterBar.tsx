import React from 'react';
import toast from 'react-hot-toast';
import { EstampaRow } from '../../types';

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
    editingLinkRowId,
    editingArteProntaRowId,
    setEditingLinkRowId,
    setEditingArteProntaRowId
}) => {
    return (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border dark:border-gray-700 flex flex-wrap items-end gap-3 text-sm">
            {/* SEARCH INPUT */}
            <div className="flex-grow min-w-[150px]">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Buscar ID / Estampa / Rastreio</label>
                <input type="text" value={filters.search || ''}
                    onChange={e => handleFilterChange('search', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setEnterPressedForSearch(true); } }}
                    placeholder="Filtrar..." className="mt-1 block w-full pl-2 pr-2 py-1.5 text-sm bg-white border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md" />
            </div>

            {/* CANAL DROPDOWN */}
            <div className="flex-grow min-w-[120px]">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Canal</label>
                <select value={filters.canal || ''} onChange={e => handleFilterChange('canal', e.target.value)} className="mt-1 block w-full pl-2 pr-8 py-1.5 text-sm bg-white border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md">
                    <option value="">Todos</option>
                    {uniqueFilterValues.canais.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
            </div>

            {/* LOCAL DROPDOWN */}
            <div className="flex-grow min-w-[120px]">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Local</label>
                <select value={filters.localEstampa || ''} onChange={e => handleFilterChange('localEstampa', e.target.value)} className="mt-1 block w-full pl-2 pr-8 py-1.5 text-sm bg-white border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md">
                    <option value="">Todos</option>
                    {uniqueFilterValues.locais.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
            </div>

            {/* MONTH DROPDOWN */}
            <div className="flex-grow min-w-[120px]">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Mês</label>
                <select value={filters.month || ''} onChange={e => handleFilterChange('month', e.target.value)} className="mt-1 block w-full pl-2 pr-8 py-1.5 text-sm bg-white border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md">
                    <option value="">Todos</option>
                    {months.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                </select>
            </div>

            {/* CNPJ FILTER */}
            <div className="flex-shrink-0 min-w-[140px]">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Empresa</label>
                <div className="mt-1 flex items-center rounded-lg bg-gray-200 dark:bg-gray-700/80 p-0.5 border dark:border-gray-600 h-[34px] box-border">
                    {(['Todos', 'MM', 'MVF'] as const).map((cnpj) => (
                        <button
                            key={cnpj}
                            onClick={() => setSelectedCnpj(cnpj)}
                            className={`flex-1 px-2 h-full text-[10px] font-bold rounded-md transition-all ${selectedCnpj === cnpj ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            {cnpj === 'Todos' ? 'Ambos' : cnpj}
                        </button>
                    ))}
                </div>
            </div>

            {/* ACTION BUTTONS ROW */}
            <div className="flex items-center space-x-4 pt-5">
                {/* TOGGLE IMPRESSOS */}
                <button
                    onClick={() => setShowImpresso(!showImpresso)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${showImpresso
                        ? 'bg-green-500/20 text-green-700 hover:bg-green-500/30 dark:text-green-300 dark:hover:bg-green-500/40 focus:ring-green-500 border border-green-500/50'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 focus:ring-gray-500'
                        }`}
                >
                    {showImpresso ? 'Ocultar Impressos' : 'Mostrar Impressos'}
                </button>

                {/* CONNECT DRIVE */}
                {!isDriveConnected ? (
                    <button
                        onClick={async () => {
                            try {
                                await handleSignIn();
                                setIsDriveConnected(true);
                                toast.success('Google Drive conectado!');
                            } catch (err) {
                                toast.error('Falha ao conectar Google Drive');
                            }
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 transition-all active:scale-95 animate-button-pulse"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
                        </svg>
                        Conectar Drive
                    </button>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-100 dark:border-emerald-800/30">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Drive OK
                    </div>
                )}

                {/* ADD ESTAMPA (MODAL) */}
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all border border-white/20 uppercase tracking-widest"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Adicionar Estampa
                </button>
            </div>

            {/* EDIT POPUP CLOSER HELPER */}
            {(editingLinkRowId || editingArteProntaRowId) && setEditingLinkRowId && setEditingArteProntaRowId && (
                <div className="fixed top-4 right-4 z-[100002]">
                    <button onClick={() => { setEditingLinkRowId(null); setEditingArteProntaRowId(null); }} className="bg-red-500 text-white px-2 py-1 rounded text-xs shadow-lg">
                        Fechar Edições
                    </button>
                </div>
            )}

        </div>
    );
};
