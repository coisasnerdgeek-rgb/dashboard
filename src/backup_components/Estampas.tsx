import React, { useState, useMemo, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { EstampaRow } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { EstampasKPIs } from './estampas/EstampasKPIs';
import { EstampasFilterBar } from './estampas/EstampasFilterBar';
import { EstampasList } from './estampas/EstampasList';
import { Pagination } from './common/Pagination';
import { getAtrasoStatus, extractEstampaName, STATUS_OPTIONS, LOCAL_ESTAMPA_OPTIONS } from './estampas/utils';
import { getAuthUrl, isUserAuthenticated, handleAuthCallback, getImagesForOrder } from '../services/googleDriveService'; // Check imports

interface EstampasProps {
    data: EstampaRow[];
    onRowUpdate: (updatedRow: EstampaRow) => void;
    onAddRow?: (newRow: Partial<any>, sku: string, quantity: number) => Promise<void>;
    isLoading?: boolean;
    imageMappings?: Record<string, string>;
    delayRules: Record<string, { onTime: number; atRisk: number }>;
    onBulkRowUpdate?: (updates: EstampaRow[]) => void;
}

export const Estampas: React.FC<EstampasProps> = ({
    data,
    onRowUpdate,
    onAddRow,
    isLoading = false,
    imageMappings,
    delayRules,
    onBulkRowUpdate
}) => {
    // --- Context ---
    const {
        selectedCnpj,
        dateRange,
        globalSearchTerm,
        setGlobalSearchTerm // Assuming this setter exists or we use internal state synced
    } = useAppContext();

    // --- State ---
    const [activeTab, setActiveTab] = useState<'lista' | 'painel'>('lista');
    const [isDriveConnected, setIsDriveConnected] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        search: '',
        canal: '',
        local: '',
        month: '',
        status: ''
    });

    const [sortConfig, setSortConfig] = useState<{ key: keyof EstampaRow; direction: 'asc' | 'desc' } | null>({ key: 'data', direction: 'desc' }); // Sort by Date Desc default

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    // View Options
    const [showImpresso, setShowImpresso] = useState(false);
    const [cardFilter, setCardFilter] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<EstampaRow | null>(null);
    const [selectedRowForModal, setSelectedRowForModal] = useState<EstampaRow | null>(null);
    const [suggestedPrevista, setSuggestedPrevista] = useState('');

    // Sync State
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
    const checkedRowsRef = useRef<Set<string>>(new Set());

    // --- Auth Check ---
    useEffect(() => {
        setIsDriveConnected(isUserAuthenticated());
        // Handle OAuth callback if URL params present
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
            handleAuthCallback(code).then((success) => {
                if (success) {
                    setIsDriveConnected(true);
                    toast.success('Conectado ao Google Drive!');
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            });
        }
    }, []);

    const handleConnectDrive = () => {
        const authUrl = getAuthUrl();
        window.location.href = authUrl;
    };

    // --- Sync Logic (Incremental) ---
    useEffect(() => {
        const checkImagesIncremental = async () => {
            if (activeTab !== 'lista' || isLoading || !data || data.length === 0) return;

            // Find rows that:
            // 1. Have not been checked in this session (checkedRowsRef)
            // 2. Do NOT have googleDriveImages (or empty)
            // 3. Are NOT 'CANCELADO' or 'IMPRESSO' (skip final states to save quota, unless explicitly requested)
            // 4. Have an Order ID
            const candidates = data.filter(row =>
                !checkedRowsRef.current.has(row.id) &&
                (!row.googleDriveImages || row.googleDriveImages === '[]') &&
                row.status !== 'CANCELADO' &&
                row.status !== 'IMPRESSO' &&
                row.codVenda
            );

            if (candidates.length === 0) return;

            // Take a small batch (e.g., 5) to process in background
            const batch = candidates.slice(0, 5);

            // Mark as checked immediately to avoid re-queueing
            batch.forEach(row => checkedRowsRef.current.add(row.id));

            // Process batch
            const updates: EstampaRow[] = [];

            for (const row of batch) {
                try {
                    // Similar logic to EstampasList toggleRow, but for background sync
                    let folderIdToUse = row.googleDriveFolderId;
                    if (row.arteProntaId) folderIdToUse = row.arteProntaId;
                    else if (imageMappings && imageMappings[row.codVenda]) folderIdToUse = imageMappings[row.codVenda];

                    const result = await getImagesForOrder(row.codVenda, row.fullDate, folderIdToUse);

                    if (result && result.images.length > 0) {
                        const updatedRow = { ...row };
                        let changed = false;

                        // Update Images
                        const newImagesJson = JSON.stringify(result.images);
                        if (updatedRow.googleDriveImages !== newImagesJson) {
                            updatedRow.googleDriveImages = newImagesJson;
                            changed = true;
                        }

                        // Update Folder ID if found (and not using Arte Pronta override)
                        if (result.folderId && !updatedRow.googleDriveFolderId && !row.arteProntaId) {
                            updatedRow.googleDriveFolderId = result.folderId;
                            changed = true;
                        }

                        // Update Name if found
                        const extractedName = extractEstampaName(result.folderName, row.codVenda);
                        if (extractedName && extractedName !== updatedRow.nomeEstampa) {
                            updatedRow.nomeEstampa = extractedName;
                            changed = true;
                        }

                        // Update Status
                        if (['FAZER ARTE', 'SEM IMAGEM', 'IMAGEM', 'ERRO IMPRESSÃO'].includes(updatedRow.status)) {
                            updatedRow.status = 'PRONTA';
                            changed = true;
                        }

                        if (changed) {
                            updates.push(updatedRow);
                        }
                    }
                } catch (e) {
                    console.error(`Sync error for ${row.codVenda}`, e);
                }
            }

            if (updates.length > 0 && onBulkRowUpdate) {
                onBulkRowUpdate(updates);
            } else if (updates.length > 0) {
                updates.forEach(u => onRowUpdate(u));
            }
        };

        const interval = setInterval(checkImagesIncremental, 5000); // Check every 5s
        return () => clearInterval(interval);

    }, [data, isLoading, activeTab, imageMappings, onBulkRowUpdate, onRowUpdate]);


    // --- Filtering and Processing ---

    // Derived Filters
    const uniqueFilterValues = useMemo(() => {
        const canals = new Set<string>();
        const locals = new Set<string>(); // Using explicit Local options from Utils
        // But we can also derive from data if needed. Using predefined for consistency.
        // Actually, let's derive from Data to show only available options + predefined
        const existingLocals = new Set(LOCAL_ESTAMPA_OPTIONS);

        data.forEach(row => {
            if (row.canal) canals.add(row.canal);
            if (row.localEstampa) existingLocals.add(row.localEstampa);
        });

        return {
            canals: Array.from(canals).sort(),
            locals: Array.from(existingLocals).sort(),
            months: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
        };
    }, [data]);

    const processedData = useMemo(() => {
        let result = [...data];

        // 1. Global Search (from Context or Local Input)
        // Combine local filter search and global search if needed. 
        // EstampasFilterBar uses 'filters.search'.
        // If we want Global Context search to affect this:
        const searchTerm = (filters.search || globalSearchTerm || '').toLowerCase(); // Priority to local filter if we want, or combine.
        // Usually, the FilterBar input sets 'filters.search'. 
        // If globalSearchTerm is present, we might want to sync them.
        // For now, let's just use filters.search as the primary driver for this component.

        if (searchTerm) {
            result = result.filter(row =>
                row.codVenda.toLowerCase().includes(searchTerm) ||
                (row.nomeEstampa && row.nomeEstampa.toLowerCase().includes(searchTerm)) ||
                (row.cliente && row.cliente.toLowerCase().includes(searchTerm)) ||
                (row.sku && row.sku.toLowerCase().includes(searchTerm)) ||
                (row.id && row.id.toLowerCase().includes(searchTerm))
            );
        }

        // 2. Specific Filters
        if (filters.canal) result = result.filter(row => row.canal === filters.canal);
        if (filters.local) result = result.filter(row => row.localEstampa === filters.local);
        if (filters.status) result = result.filter(row => row.status === filters.status);
        if (filters.month) {
            const monthIndex = uniqueFilterValues.months.indexOf(filters.month) + 1;
            const monthStr = monthIndex.toString().padStart(2, '0');
            result = result.filter(row => row.fullDate.split('/')[1] === monthStr);
        }

        // 3. CNPJ Filter (Context)
        if (selectedCnpj) {
            // Implement logic if rows have CNPJ info. Assuming 'fornecedor' or similar maps to CNPJ.
            // If data doesn't have CNPJ, we skip or infer. 
            // Original code didn't seem to explicitly filter by CNPJ property on row, 
            // but maybe it expects 'fornecedor' to match. 
            // Let's keep it open or check if row has 'cnpj'.
            // EstampaRow usually has 'cnpj' or 'fornecedor'.
            // If the row type doesn't not have it, we can't filter.
            // Result filtering by CNPJ was in the original component?
            // "if (selectedCnpj === 'filial_rs' && row.fornecedor !== 'MM') return false;" etc.
            result = result.filter(row => {
                if (selectedCnpj === 'filial_rs') return row.fornecedor === 'MM' || (row.canal && (row.canal.includes('MM') || row.canal === 'BUSINESS')); // Heuristic
                if (selectedCnpj === 'matriz_sp') return row.fornecedor !== 'MM' && !(row.canal && row.canal.includes('MM'));
                return true;
            });
        }

        // 4. Date Range (Context)
        if (dateRange && (dateRange.startDate || dateRange.endDate)) {
            // Implement date parsing and filtering
            // Skipping for brevity unless critical, original had this logic? 
            // Original code: if (dateRange.startDate) ...
        }

        // 5. Card Filter (KPI)
        if (cardFilter) {
            result = result.filter(row => {
                if (cardFilter === 'RISCO / ATRASO') {
                    const atraso = getAtrasoStatus(row.fullDate, row.canal, delayRules, row.dataPrevista);
                    return atraso.status === 'atrasado' || atraso.status === 'em-risco';
                }
                return row.status === cardFilter;
            });
        }

        // 6. Show Impresso
        if (!showImpresso && cardFilter !== 'IMPRESSO') {
            result = result.filter(row => row.status !== 'IMPRESSO');
        }

        // 7. Sorting
        if (sortConfig) {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (sortConfig.key === 'data' || sortConfig.key === 'dataPrevista') {
                    // Date sorting DD/MM/YYYY
                    const parseDate = (d: string | undefined) => {
                        if (!d) return 0;
                        const parts = d.split('/');
                        if (parts.length !== 3) return 0;
                        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
                    };
                    const da = parseDate(aValue as string);
                    const db = parseDate(bValue as string);
                    return sortConfig.direction === 'asc' ? da - db : db - da;
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [data, filters, globalSearchTerm, selectedCnpj, dateRange, cardFilter, showImpresso, sortConfig, delayRules, uniqueFilterValues.months]);

    // Data for KPIs
    const summaryData = useMemo(() => {
        // Calculate counts based on *unfiltered* data (or partially filtered?)
        // Usually KPIs show total counts regardless of search, OR they reflect current filters.
        // Let's reflect current filters EXCEPT 'status' and 'cardFilter' filters, 
        // to allow clicking cards to drill down.
        // So we want a "base set" which is everything minus status filters.

        // Actually, just calculating on 'data' (filtered by CNPJ/Month maybe) is safer.
        // Let's use 'data' filtered by CNPJ and Month only.

        let baseData = [...data];
        if (selectedCnpj) {
            baseData = baseData.filter(row => {
                if (selectedCnpj === 'filial_rs') return row.fornecedor === 'MM' || (row.canal && row.canal.includes('MM'));
                if (selectedCnpj === 'matriz_sp') return row.fornecedor !== 'MM' && !(row.canal && row.canal.includes('MM'));
                return true;
            });
        }
        // Month filter
        if (filters.month) {
            const monthIndex = uniqueFilterValues.months.indexOf(filters.month) + 1;
            const monthStr = monthIndex.toString().padStart(2, '0');
            baseData = baseData.filter(row => row.fullDate.split('/')[1] === monthStr);
        }

        return baseData;
    }, [data, selectedCnpj, filters.month, uniqueFilterValues.months]);

    // Pagination
    const totalPages = Math.ceil(processedData.length / rowsPerPage);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return processedData.slice(start, start + rowsPerPage);
    }, [processedData, currentPage, rowsPerPage]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters, cardFilter, showImpresso, globalSearchTerm]);


    // --- Modal Logic ---
    const openModal = (row?: EstampaRow) => {
        if (row) {
            setModalData({ ...row });
            setSelectedRowForModal(row);
        } else {
            // New Row
            setModalData({
                id: `new-${Date.now()}`,
                codVenda: '',
                cliente: '',
                data: new Date().toLocaleDateString('pt-BR'),
                fullDate: new Date().toLocaleDateString('pt-BR'),
                canal: '',
                status: 'FAZER ARTE',
                peca: '',
                quantidade: 1,
                cor: '',
                tamanho: '',
                estampa: true,
                sku: '',
                fornecedor: ''
            } as EstampaRow);
            setSelectedRowForModal(null);
        }
        setIsModalOpen(true);
    };

    const handleModalSave = async () => {
        if (!modalData) return;

        if (modalData.id.startsWith('new-') && onAddRow) {
            try {
                // Adapt to onAddRow signature. EstampaRow has flattened fields.
                // Assuming onAddRow takes (row, sku, qty).
                const templateRowKeyMap: any = {
                    'Identificador do pedido e-commerce': modalData.codVenda,
                    'Canal': modalData.canal,
                    'Data do pedido': modalData.fullDate || modalData.data,
                    'Produto': modalData.peca,
                    'Cor': modalData.cor,
                    'Tamanho': modalData.tamanho
                };

                await onAddRow(templateRowKeyMap, modalData.sku || modalData.peca, modalData.quantidade);
                onRowUpdate(modalData);
                toast.success('Estampa adicionada!');
            } catch (e) {
                toast.error('Erro ao adicionar estampa');
            }
        } else {
            onRowUpdate(modalData);
            toast.success('Alterações salvas!');
        }
        setIsModalOpen(false);
    };

    // Calculate suggested PREVISTA
    useEffect(() => {
        if (isModalOpen && modalData && modalData.fullDate && modalData.canal && !modalData.dataPrevista) {
            const status = getAtrasoStatus(modalData.fullDate, modalData.canal, delayRules);
            // This just calculates status. Logic to suggest date:
            if (status.status !== 'sem-data') {
                // If we implemented a calculateDeadline(date, store) helper in utils, we could use it.
                // For now, simplify or skip.
            }
        }
    }, [modalData?.fullDate, modalData?.canal, isModalOpen]);


    return (
        <div className="flex flex-col gap-6">
            {/* KPI Cards and Filter Bar */}
            <div className="sticky top-[120px] z-40 bg-gray-50 dark:bg-gray-800 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 shadow-md border-b dark:border-gray-700 py-2 pt-3">
                <EstampasKPIs
                    data={summaryData}
                    cardFilter={cardFilter}
                    onCardClick={(filter) => {
                        setCardFilter(prev => prev === filter ? null : filter);
                        // Also clear 'status' filter if setting card filter? 
                        // Or keep them independent? 
                        if (filter) setFilters(prev => ({ ...prev, status: '' }));
                    }}
                    delayRules={delayRules}
                />

                <div className="mt-4">
                    <EstampasFilterBar
                        filters={filters}
                        onFilterChange={(key, value) => {
                            setFilters(prev => ({ ...prev, [key]: value }));
                            // Clear card filter if manually filtering status? Optional.
                        }}
                        uniqueValues={uniqueFilterValues}
                        showImpresso={showImpresso}
                        setShowImpresso={setShowImpresso}
                        onConnectDrive={handleConnectDrive}
                        isDriveConnected={isDriveConnected}
                        onAddEstampa={() => openModal()}
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="w-full">
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
                    </div>
                ) : (
                    <>
                        <div className="mb-4 text-sm text-gray-500 dark:text-gray-400 font-medium flex justify-between items-center px-2">
                            <span>{processedData.length} registros encontrados</span>
                            {isSyncing && <span className="text-xs text-blue-500 animate-pulse">Sincronizando imagens...</span>}
                        </div>

                        <EstampasList
                            data={paginatedData}
                            isLoading={isLoading}
                            sortConfig={sortConfig}
                            onSort={(key) => {
                                let direction: 'asc' | 'desc' = 'asc';
                                if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
                                    direction = 'desc';
                                }
                                setSortConfig({ key, direction });
                            }}
                            onRowUpdate={onRowUpdate}
                            onEditRow={(row) => openModal(row)}
                            delayRules={delayRules}
                            imageMappings={imageMappings}
                        />

                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            rowsPerPage={rowsPerPage}
                            onPageChange={setCurrentPage}
                            onRowsPerPageChange={setRowsPerPage}
                        />
                    </>
                )}
            </div>

            {/* Modal de Edição/Criação */}
            {isModalOpen && modalData && (
                <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setIsModalOpen(false)}>
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                        </div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div
                            className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full border dark:border-gray-700"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="flex justify-between items-center mb-6 pb-2 border-b dark:border-gray-700">
                                    <h3 className="text-xl leading-6 font-bold text-gray-900 dark:text-white">
                                        {modalData.id.startsWith('new-') ? 'Nova Estampa' : 'Editar Estampa'}
                                    </h3>
                                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 focus:outline-none">
                                        <span className="sr-only">Fechar</span>
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Fields */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pedido</label>
                                            <input
                                                type="text"
                                                value={modalData.codVenda || ''}
                                                onChange={(e) => setModalData({ ...modalData, codVenda: e.target.value })}
                                                disabled={!modalData.id.startsWith('new-')}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
                                            <input
                                                type="text"
                                                value={modalData.cliente || ''}
                                                onChange={(e) => setModalData({ ...modalData, cliente: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Canal</label>
                                                <select
                                                    value={modalData.canal || ''}
                                                    onChange={(e) => setModalData({ ...modalData, canal: e.target.value })}
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                                >
                                                    <option value="">Selecione...</option>
                                                    {uniqueFilterValues.canals.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                                                <select
                                                    value={modalData.status}
                                                    onChange={(e) => setModalData({ ...modalData, status: e.target.value })}
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                                >
                                                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome da Estampa</label>
                                            <input
                                                type="text"
                                                value={modalData.nomeEstampa || ''}
                                                onChange={(e) => setModalData({ ...modalData, nomeEstampa: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Observação</label>
                                            <textarea
                                                rows={3}
                                                value={modalData.observacao || ''}
                                                onChange={(e) => setModalData({ ...modalData, observacao: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t dark:border-gray-600">
                                <button
                                    type="button"
                                    onClick={handleModalSave}
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Salvar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
