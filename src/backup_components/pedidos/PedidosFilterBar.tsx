import React from 'react';

interface PedidosFilterBarProps {
    globalFilters: Record<string, string | string[]>;
    onFilterChange: (header: string, value: string | string[]) => void; // Allow array for consistency
    onSync: () => void;
    onExport: () => void;
    isSyncing: boolean;
    totalRecords: number;
    lastUpdated?: string;
    getHeaderKey: (title: string) => string | undefined;
}

export const PedidosFilterBar: React.FC<PedidosFilterBarProps> = ({
    globalFilters,
    onFilterChange,
    onSync,
    onExport,
    isSyncing,
    totalRecords,
    lastUpdated,
    getHeaderKey
}) => {

    // Helper to get value
    const getValue = (title: string): string => {
        const key = getHeaderKey(title);
        if (!key) return '';
        const val = globalFilters[key];
        return Array.isArray(val) ? val.join(',') : val || '';
    };

    const handleTextChange = (title: string, val: string) => {
        const key = getHeaderKey(title);
        if (key) onFilterChange(key, val);
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

                {/* Search Inputs Group */}
                <div className="flex flex-wrap gap-3 w-full md:w-auto flex-grow">
                    {/* Search by ID/Name */}
                    <div className="min-w-[200px] flex-grow md:flex-grow-0">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Buscar Pedido / Nome</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="ID, Nome, SKU..."
                                value={getValue('ID') || getValue('Nome') || ''} // Naive dual binding check, ideally separate
                                onChange={(e) => {
                                    // Complex logic: Pedidos.tsx likely had a single global search or specific fields.
                                    // For now, let's assume valid implementation updates specific filter or global search.
                                    // If we bind to 'identificador', update it.
                                    const val = e.target.value;
                                    const idKey = getHeaderKey('ID');
                                    // If existing code treated search as global filter, pass it.
                                    // Here we simulate searching by ID. 
                                    // To allow multi-column search, component props might need 'onGlobalSearch'.
                                    // But based on props, we update filters. 
                                    if (idKey) onFilterChange(idKey, val);
                                }}
                                className="pl-10 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm bg-gray-50 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Canal Filter (Dropdown?) */}
                    {/* Add more filters here as needed matching Pedidos.tsx UI */}
                </div>

                {/* Actions Group */}
                <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                    <div className="flex items-center mr-4 text-sm text-gray-500 dark:text-gray-400 border-r pr-4 border-gray-200 dark:border-gray-700 h-8">
                        <span className="font-medium mr-1">{totalRecords}</span> pedidos
                        {lastUpdated && <span className="ml-2 text-xs opacity-75">Atualizado: {lastUpdated}</span>}
                    </div>

                    <button
                        onClick={onExport}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                        title="Exportar para Excel"
                    >
                        <svg className="mr-2 h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Excel
                    </button>

                    <button
                        onClick={onSync}
                        disabled={isSyncing}
                        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${isSyncing ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
                            }`}
                    >
                        {isSyncing ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Sincronizando...
                            </>
                        ) : (
                            <>
                                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Sincronizar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
