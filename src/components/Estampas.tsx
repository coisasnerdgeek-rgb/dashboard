import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';
import { EstampaRow, Lote } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { EstampasKPIs } from './estampas/EstampasKPIs';
import { EstampasFilterBar } from './estampas/EstampasFilterBar';
import { EstampasList } from './estampas/EstampasList';
import { Pagination } from './common/Pagination';
import DataLoading from './common/DataLoading';
import { getAtrasoStatus, extractEstampaName, STATUS_OPTIONS, LOCAL_ESTAMPA_OPTIONS, statusSelectColorClasses, localSelectColorClasses, aramadoLetras, aramadoNumeros } from './estampas/utils';
import { isUserAuthenticated, handleSignIn, getImagesForOrder, getThumbnailUrl } from '../services/googleDriveService';
import { getColorHex, getTextColorForBackground } from '../utils/colorUtils';
import { getColorMap, parseSku } from '../services/skuService';
import EstampasDashboard from './EstampasDashboard';
import { EstoqueEstampas } from './EstoqueEstampas';
import { LotesManager } from './estampas/LotesManager';
import { LoteImageModal } from './estampas/LoteImageModal';
import { getLotes, bulkAssignLoteToPedidos } from '../services/supabaseService';

interface EstampasProps {
    data: EstampaRow[];
    onRowUpdate: (updatedRow: EstampaRow) => void;
    onAddRow?: (newRow: Partial<any>, sku: string, quantity: number) => Promise<void>;
    isLoading?: boolean;
    imageMappings?: Record<string, string>;
    delayRules: Record<string, { onTime: number; atRisk: number }>;
    onBulkRowUpdate?: (updates: EstampaRow[]) => void;
    setCurrentView?: (view: any) => void;
    activeTab?: 'dashboard' | 'lista' | 'estoque';
}

export const Estampas: React.FC<EstampasProps> = ({
    data,
    onRowUpdate,
    onAddRow,
    isLoading = false,
    imageMappings,
    delayRules,
    onBulkRowUpdate,
    setCurrentView,
    activeTab: activeTabProp
}) => {
    const colorList = useMemo(() => [...new Set(Object.values(getColorMap()))].sort(), []);
    // --- Context ---
    const {
        selectedCnpj,
        setSelectedCnpj,
        dateRange,
        globalSearchTerm,
        setGlobalSearchTerm // Assuming this setter exists or we use internal state synced
    } = useAppContext();

    // --- State ---
    const [activeTab, setActiveTab] = useState<'dashboard' | 'lista' | 'lote' | 'estoque'>('lista');
    const [isDriveConnected, setIsDriveConnected] = useState(false);

    // Lotes State
    const [lotes, setLotes] = useState<Lote[]>([]);

    // Filters
    const [filters, setFilters] = useState(() => {
        try {
            const saved = localStorage.getItem('estampas_filters');
            return saved ? JSON.parse(saved) : {
                search: '',
                canal: '',
                local: '',
                month: '',
                status: ''
            };
        } catch (e) {
            return { search: '', canal: '', local: '', month: '', status: '' };
        }
    });

    useEffect(() => {
        localStorage.setItem('estampas_filters', JSON.stringify(filters));
    }, [filters]);

    const [sortConfig, setSortConfig] = useState<{ key: keyof EstampaRow; direction: 'asc' | 'desc' } | null>({ key: 'data', direction: 'desc' }); // Sort by Date Desc default

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(() => {
        const saved = localStorage.getItem('estampas_rowsPerPage');
        return saved ? parseInt(saved, 10) : 50;
    });

    useEffect(() => {
        localStorage.setItem('estampas_rowsPerPage', rowsPerPage.toString());
    }, [rowsPerPage]);

    // View Options
    const [showImpresso, setShowImpresso] = useState(() => {
        const saved = localStorage.getItem('estampas_showImpresso');
        return saved !== null ? saved === 'true' : true;
    });

    useEffect(() => {
        localStorage.setItem('estampas_showImpresso', showImpresso.toString());
    }, [showImpresso]);

    const [cardFilter, setCardFilter] = useState<string | null>(() => {
        return localStorage.getItem('estampas_cardFilter');
    });

    useEffect(() => {
        if (cardFilter) localStorage.setItem('estampas_cardFilter', cardFilter);
        else localStorage.removeItem('estampas_cardFilter');
    }, [cardFilter]);

    // Bulk Selection State
    const [selectedPedidos, setSelectedPedidos] = useState<Set<string>>(new Set());
    const [bulkLoteNumber, setBulkLoteNumber] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<EstampaRow | null>(null);
    const [selectedRowForModal, setSelectedRowForModal] = useState<EstampaRow | null>(null);
    const [suggestedPrevista, setSuggestedPrevista] = useState('');
    const [modalImages, setModalImages] = useState<any[]>([]);
    const [isLoadingImages, setIsLoadingImages] = useState(false);
    const [modalSearch, setModalSearch] = useState('');
    const [viewingModalLote, setViewingModalLote] = useState<Lote | null>(null);

    // Sync State
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
    const checkedRowsRef = useRef<Set<string>>(new Set());

    // Load Lotes
    const loadLotes = async () => {
        try {
            const data = await getLotes();
            setLotes(data);
        } catch (error) {
            console.error('Error loading lotes:', error);
        }
    };

    useEffect(() => {
        loadLotes();
    }, []);

    // Reload lotes when switching to lista tab (to catch newly created lotes)
    useEffect(() => {
        if (activeTab === 'lista') {
            loadLotes();
        }
    }, [activeTab]);

    // Sync active tab with props or localStorage
    useEffect(() => {
        const savedTab = localStorage.getItem('estampas_activeTab');
        if (savedTab && (savedTab === 'dashboard' || savedTab === 'lista' || savedTab === 'lote' || savedTab === 'estoque')) {
            setActiveTab(savedTab as any);
            localStorage.removeItem('estampas_activeTab');
        } else if (activeTabProp) {
            setActiveTab(activeTabProp);
        }
    }, [activeTabProp]);

    // --- Auth Check ---
    useEffect(() => {
        // Inicializa o sistema do Drive (autenticado ou público) e restaura token se existir
        const initDrive = async () => {
            try {
                const { initializeDriveSystem } = await import('../services/googleDriveService');
                const isAuth = await initializeDriveSystem();
                setIsDriveConnected(isAuth);
                console.log('[Estampas] Drive initialized. Auth:', isAuth);
            } catch (error) {
                console.error('[Estampas] Failed to initialize Drive:', error);
                toast.error('Erro ao inicializar Google Drive. Verifique o console.');
            }
        };
        initDrive();
    }, []);

    const handleConnectDrive = async () => {
        const success = await handleSignIn();
        if (success) {
            setIsDriveConnected(true);
            toast.success('Conectado ao Google Drive!');
        } else {
            toast.error('Falha ao conectar ao Google Drive.');
        }
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

            // Take a small batch (e.g., 2) to process in background
            const batch = candidates.slice(0, 2);

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

                        if (changed) {
                            const partialUpdate: Partial<EstampaRow> = {
                                id: updatedRow.id
                            };
                            if (updatedRow.googleDriveImages !== row.googleDriveImages) {
                                partialUpdate.googleDriveImages = updatedRow.googleDriveImages;
                            }
                            if (updatedRow.googleDriveFolderId !== row.googleDriveFolderId) {
                                partialUpdate.googleDriveFolderId = updatedRow.googleDriveFolderId;
                            }
                            if (updatedRow.nomeEstampa !== row.nomeEstampa) {
                                partialUpdate.nomeEstampa = updatedRow.nomeEstampa;
                            }
                            updates.push(partialUpdate as EstampaRow);
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

        const interval = setInterval(checkImagesIncremental, 5000); // Sync enabled (5s)
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
            canais: Array.from(canals).sort(),
            locais: Array.from(existingLocals).sort(),
            months: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
        };
    }, [data]);

    // Mapeamento entre IDs dos cards e os status reais da tabela
    const CARD_TO_STATUS_MAP: Record<string, string> = {
        'SEM IMAGEM': 'IMAGEM',
        'APROVAÇÃO': 'EM APROVAÇÃO',
        'ERRO': 'ERRO IMPRESSÃO'
    };

    const processedData = useMemo(() => {
        let result = [...data];

        // 1. Global Search (from Context or Local Input)

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

        // --- New SKU Filter Rule ---
        // REGRA GERAL: Só manter se tiver as palavras: peito, frente, costas, costa, cabelereiro, cabeleireiro, cabelerero, cabeleirero
        result = result.filter(row => {
            if (!row.sku) return true;
            const lowerSku = row.sku.toLowerCase();

            const allowedWords = [
                'peito',
                'frente',
                'costas',
                'costa',
                'cabelereiro',
                'cabeleireiro',
                'cabelerero',
                'cabeleirero',
                'cabeleireira',
                'eletricista',
                'eletrecista',
                'manicure',
                'nutricionista'
            ];

            // Manter se houver QUALQUER uma das palavras permitidas
            const keep = allowedWords.some(word => lowerSku.includes(word));
            if (!keep && row.sku) {
                // console.log(`[Estampas] Filtered out SKU: ${row.sku}`);
            }
            return keep;
        });

        // 2. Specific Filters
        if (filters.canal) result = result.filter(row => row.canal === filters.canal);
        if (filters.local) result = result.filter(row => row.localEstampa === filters.local);
        if (filters.L) result = result.filter(row => row.L?.toUpperCase() === filters.L.toUpperCase());
        if (filters.status) result = result.filter(row => row.status === filters.status);
        if (filters.month) {
            const monthIndex = uniqueFilterValues.months.indexOf(filters.month) + 1;
            const monthStr = monthIndex.toString().padStart(2, '0');
            result = result.filter(row => row.fullDate.split('/')[1] === monthStr);
        }

        // 3. CNPJ Filter (Context)
        if (selectedCnpj) {
            result = result.filter(row => {
                if (selectedCnpj === 'filial_rs') return row.fornecedor === 'MM' || (row.canal && row.canal.includes('MM'));
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
                if (cardFilter === 'RISCO' || cardFilter === 'ATRASADO') {
                    const atraso = getAtrasoStatus(row.fullDate, row.canal, delayRules, row.dataPrevista);
                    if (cardFilter === 'RISCO') return atraso.status === 'em-risco';
                    if (cardFilter === 'ATRASADO') return atraso.status === 'atrasado';
                }
                if (cardFilter === 'RISCO / ATRASO') {
                    const atraso = getAtrasoStatus(row.fullDate, row.canal, delayRules, row.dataPrevista);
                    return atraso.status === 'atrasado' || atraso.status === 'em-risco';
                }
                // Usar mapeamento para comparar corretamente
                const mappedStatus = CARD_TO_STATUS_MAP[cardFilter] || cardFilter;
                return row.status === mappedStatus;
            });
        }

        // 6. Show Impresso filter (always true now that button is removed, but we keep the logic for search/cards)
        if (!showImpresso && cardFilter !== 'IMPRESSO' && !searchTerm) {
            result = result.filter(row => (row.status || '').toUpperCase().trim() !== 'IMPRESSO');
        }

        // 7. Sorting
        if (sortConfig) {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                // 1. Date Sorting
                const isDateColumn = (key: string) => {
                    const k = key.toLowerCase();
                    return k === 'data' || k.includes('date') || k.includes('prevista') || k === 'fulldate';
                };

                if (isDateColumn(sortConfig.key)) {
                    // Use fullDate for 'data' column to ensure year is respected
                    const valA = (sortConfig.key === 'data' && a.fullDate) ? a.fullDate : aValue;
                    const valB = (sortConfig.key === 'data' && b.fullDate) ? b.fullDate : bValue;

                    // Helper to parse DD/MM/YYYY
                    const parseDate = (d: any) => {
                        if (!d || typeof d !== 'string') return 0;
                        if (d.includes('/')) {
                            const parts = d.split('/');
                            // DD/MM/YYYY
                            if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
                            // DD/MM (Assume current year)
                            if (parts.length === 2) return new Date(new Date().getFullYear(), Number(parts[1]) - 1, Number(parts[0])).getTime();
                        }
                        return new Date(d).getTime() || 0;
                    };
                    const da = parseDate(valA);
                    const db = parseDate(valB);
                    if (da !== db) {
                        return sortConfig.direction === 'asc' ? da - db : db - da;
                    }
                }

                // 2. Numeric Sorting
                const isNumeric = (n: any) => !isNaN(parseFloat(n)) && isFinite(n);
                if (isNumeric(aValue) && isNumeric(bValue)) {
                    const na = parseFloat(aValue as string);
                    const nb = parseFloat(bValue as string);
                    if (na !== nb) {
                        return sortConfig.direction === 'asc' ? na - nb : nb - na;
                    }
                }

                // 3. String Sorting (Default)
                let comparison = 0;
                if (aValue < bValue) comparison = sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) comparison = sortConfig.direction === 'asc' ? 1 : -1;
                return comparison;
            });
        }

        return result;
    }, [data, filters, globalSearchTerm, selectedCnpj, dateRange, cardFilter, showImpresso, sortConfig, delayRules, uniqueFilterValues.months]);

    // Data for KPIs and Dashboard
    const { summaryData, dashboardData } = useMemo(() => {
        let baseData = [...data];

        // 1. CNPJ Filter (Context)
        if (selectedCnpj) {
            baseData = baseData.filter(row => {
                if (selectedCnpj === 'filial_rs') return row.fornecedor === 'MM' || (row.canal && row.canal.includes('MM'));
                if (selectedCnpj === 'matriz_sp') return row.fornecedor !== 'MM' && !(row.canal && row.canal.includes('MM'));
                return true;
            });
        }

        // 2. SKU Filter
        baseData = baseData.filter(row => {
            if (!row.sku) return true;
            const lowerSku = row.sku.toLowerCase();
            const allowedWords = [
                'peito', 'frente', 'costas', 'costa',
                'cabelereiro', 'cabeleireiro', 'cabelerero', 'cabeleirero'
            ];
            return allowedWords.some(word => lowerSku.includes(word));
        });

        let filteredForDashboard = [...baseData]; // Snapshot for Dashboard

        // 3. Date Filtering (Month OR Date Range OR Default)
        const hasMonthFilter = !!filters.month;
        const hasDateRange = !!(dateRange && (dateRange.startDate || dateRange.endDate));
        const isExternallyFiltered = hasMonthFilter || hasDateRange;

        if (isExternallyFiltered) {
            // Apply Month Filter if present
            if (hasMonthFilter) {
                const monthIndex = uniqueFilterValues.months.indexOf(filters.month) + 1;
                const monthStr = monthIndex.toString().padStart(2, '0');
                const filterDate = (row: EstampaRow) => row.fullDate && row.fullDate.split('/')[1] === monthStr;
                baseData = baseData.filter(filterDate);
                filteredForDashboard = filteredForDashboard.filter(filterDate);
            }

            // Apply Date Range Filter if present
            if (hasDateRange) {
                const start = dateRange.startDate ? new Date(dateRange.startDate) : new Date(0);
                const end = dateRange.endDate ? new Date(dateRange.endDate) : new Date(2100, 0, 1);
                end.setHours(23, 59, 59, 999);

                const filterRange = (row: EstampaRow) => {
                    if (!row.fullDate) return false;
                    const parts = row.fullDate.split('/');
                    if (parts.length !== 3) return false;
                    const rowDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                    return rowDate >= start && rowDate <= end;
                };
                baseData = baseData.filter(filterRange);
                filteredForDashboard = filteredForDashboard.filter(filterRange);
            }
        } else {
            // Default 30 days if NO month selected
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            baseData = baseData.filter(row => {
                if (!row.fullDate) return false;
                const parts = row.fullDate.split('/');
                if (parts.length < 3) return false;
                const rowDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                return rowDate >= thirtyDaysAgo;
            });
        }

        const statusSets: Record<string, Set<string>> = {
            TOTAL: new Set(),
            'FAZER ARTE': new Set(),
            'PRONTA': new Set(),
            'APROVAÇÃO': new Set(),
            'APROVADO': new Set(),
            'IMPRESSO': new Set(),
            'AJUSTE': new Set(),
            'SEM IMAGEM': new Set(),
            'ERRO IMPRESSÃO': new Set(),
            'NÃO CHEGOU': new Set(),
            'RISCO': new Set(),
            'ATRASADO': new Set(),
            'CANCELADO': new Set()
        };

        baseData.forEach(row => {
            const orderId = row.codVenda;
            if (!orderId) return;

            statusSets.TOTAL.add(orderId);

            let status = row.status?.toUpperCase().trim() || 'FAZER ARTE';

            // Map table status values to KPI card keys
            if (status === 'EM APROVAÇÃO') status = 'APROVAÇÃO';
            if (status === 'IMAGEM') status = 'SEM IMAGEM';

            if (statusSets[status] !== undefined) {
                statusSets[status].add(orderId);
            }

            // Check for Delay/Risk independently of status (or based on not being final)
            const rowStatus = (row.status || '').toUpperCase().trim();
            if (rowStatus !== 'IMPRESSO' && rowStatus !== 'CANCELADO') {
                const atraso = getAtrasoStatus(row.fullDate, row.canal, delayRules, row.dataPrevista);
                if (atraso.status === 'atrasado') statusSets.ATRASADO.add(orderId);
                if (atraso.status === 'em-risco') statusSets.RISCO.add(orderId);
            }
        });

        const counts: Record<string, number> = {};
        Object.keys(statusSets).forEach(key => {
            counts[key] = statusSets[key].size;
        });

        return { summaryData: counts, dashboardData: filteredForDashboard };
    }, [data, selectedCnpj, filters.month, dateRange, uniqueFilterValues.months, delayRules]);

    const distributionData = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Map data to 30 days for distribution
        const last30DaysData = processedData.filter(row => {
            if (!row.fullDate) return false;
            const parts = row.fullDate.split('/');
            if (parts.length < 3) return false;
            const rowDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            return rowDate >= thirtyDaysAgo;
        });

        const counts: Record<string, number> = {};
        let totalPieces = 0;
        const totalOrders = new Set(last30DaysData.map(r => r.codVenda)).size;

        last30DaysData.forEach(row => {
            const type = row.peca || 'Outros';
            const qty = row.quantidade || 0;
            counts[type] = (counts[type] || 0) + qty;
            totalPieces += qty;
        });

        const sortedTypes = Object.entries(counts)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);

        return {
            types: sortedTypes,
            totalPieces,
            totalOrders
        };
    }, [processedData]);

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
    const openModal = async (row?: EstampaRow) => {
        setModalImages([]);
        setIsLoadingImages(false);
        setModalSearch('');

        if (row) {
            setModalData({ ...row });
            setSelectedRowForModal(row);

            // Initialize images from cache if available
            if (row.googleDriveImages) {
                try {
                    const cached = JSON.parse(row.googleDriveImages);
                    if (Array.isArray(cached) && cached.length > 0) {
                        setModalImages(cached);
                    }
                } catch (e) {
                    console.error('[Estampas] Error parsing cached images:', e);
                }
            }

            // Fetch Drive images if connected and row has no cached images OR we want to refresh
            if (isDriveConnected && row.codVenda) {
                // If we already have cached images, we don't necessarily need to trigger loading state
                // but we can still refresh in the background.
                if (modalImages.length === 0) setIsLoadingImages(true);

                try {
                    const result = await getImagesForOrder(row.codVenda, row.fullDate || row.data, row.arteProntaId);
                    if (result && result.images) {
                        setModalImages(result.images);
                        // Update cache in parent if it significantly changed
                        if (JSON.stringify(result.images) !== row.googleDriveImages) {
                            onRowUpdate({ ...row, googleDriveImages: JSON.stringify(result.images) });
                        }
                    }
                } catch (err) {
                    console.error('[Estampas] Modal image fetch error:', err);
                } finally {
                    setIsLoadingImages(false);
                }
            }
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
                fornecedor: '',
                rastreio: '',
                link: '',
                localEstampa: '',
                observacao: '',
                tratado: false,
                L: '',
                aramadoLetra: '',
                aramadoNumero: ''
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
        }
    }, [modalData?.fullDate, modalData?.canal, isModalOpen]);

    // AUTO-SAVE LOGIC
    useEffect(() => {
        if (isModalOpen && modalData) {
            // Se for item existente, salva ao mudar qualquer campo (debounce)
            if (!modalData.id.startsWith('new-')) {
                const timer = setTimeout(() => {
                    onRowUpdate(modalData);
                }, 1000);
                return () => clearTimeout(timer);
            }
        }
    }, [modalData, isModalOpen, onRowUpdate]);

    // Auto re-fetch images when arteProntaId changes in modal
    useEffect(() => {
        if (!isModalOpen || !modalData || !isDriveConnected || !modalData.codVenda) return;

        const timer = setTimeout(async () => {
            setIsLoadingImages(true);
            try {
                const result = await getImagesForOrder(modalData.codVenda, modalData.fullDate || modalData.data, modalData.arteProntaId);
                if (result && result.images) {
                    setModalImages(result.images);
                } else {
                    setModalImages([]);
                }
            } catch (err) {
                console.error('[Estampas] Auto re-fetch error:', err);
            } finally {
                setIsLoadingImages(false);
            }
        }, 800); // 800ms debounce

        return () => clearTimeout(timer);
    }, [modalData?.arteProntaId, isModalOpen, isDriveConnected]);

    // Navigation suggestions in modal
    const modalSearchSuggestions = useMemo(() => {
        if (!modalSearch || modalSearch.length < 2) return [];
        const term = modalSearch.toLowerCase();
        return data.filter(row =>
            row.codVenda.toLowerCase().includes(term) ||
            (row.cliente && row.cliente.toLowerCase().includes(term)) ||
            (row.nomeEstampa && row.nomeEstampa.toLowerCase().includes(term))
        ).slice(0, 8);
    }, [data, modalSearch]);

    // --- Bulk Selection Functions ---
    const togglePedidoSelection = (orderId: string) => {
        setSelectedPedidos(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) {
                newSet.delete(orderId);
            } else {
                newSet.add(orderId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedPedidos.size === paginatedData.length) {
            setSelectedPedidos(new Set());
        } else {
            setSelectedPedidos(new Set(paginatedData.map(row => row.codVenda)));
        }
    };

    const handleBulkLoteAssignment = async () => {
        if (selectedPedidos.size === 0) {
            toast.error('Selecione pelo menos um pedido');
            return;
        }

        if (!bulkLoteNumber) {
            toast.error('Selecione um lote');
            return;
        }

        try {
            await bulkAssignLoteToPedidos(Array.from(selectedPedidos), bulkLoteNumber);

            const now = new Date();
            const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            // Update local state
            const updates = data
                .filter(row => selectedPedidos.has(row.codVenda))
                .map(row => ({
                    ...row,
                    L: bulkLoteNumber,
                    aramadoDataColocacao: row.aramadoDataColocacao || formattedDate
                }));

            if (onBulkRowUpdate) {
                onBulkRowUpdate(updates);
            } else {
                updates.forEach(row => onRowUpdate(row));
            }

            toast.success(`${selectedPedidos.size} pedido(s) atribuído(s) ao lote ${bulkLoteNumber}`);

            // Clear selection
            setSelectedPedidos(new Set());
            setBulkLoteNumber('');
        } catch (error) {
            console.error('Error in bulk lote assignment:', error);
            toast.error('Erro ao atribuir lotes em massa');
        }
    };

    const clearSelection = () => {
        setSelectedPedidos(new Set());
        setBulkLoteNumber('');
    };


    return (
        <>
            <div className="flex flex-col w-full max-w-full">
                {/* Unified Sticky Header: Tabs + KPIs + Filters */}
                <div className="sticky top-[64px] z-30 bg-white/98 dark:bg-[#0f172a]/98 backdrop-blur-md w-full px-4 sm:px-6 lg:px-8 pt-[2.2rem] pb-3 flex flex-col gap-4 -mx-2 sm:-mx-4 lg:-mx-6 w-[calc(100%+1rem)] sm:w-[calc(100%+2rem)] lg:w-[calc(100%+3rem)] rounded-t-xl dark:border-gray-700/50 shadow-sm border-b">
                    {/* 1. Nav Tabs (Exactly like image) */}
                    <div className="flex items-center justify-between w-full px-1">
                        <div className="flex items-center gap-8">
                            {[
                                { label: 'DASHBOARD', tab: 'dashboard' },
                                { label: 'PEDIDOS', tab: 'lista' },
                                { label: 'LOTE', tab: 'lote' },
                                { label: 'ESTOQUE', tab: 'estoque' }
                            ].map((item) => (
                                <button
                                    key={item.tab}
                                    onClick={() => setActiveTab(item.tab as any)}
                                    className={`relative py-1 text-[11px] font-bold tracking-[0.12em] transition-all ${activeTab === item.tab
                                        ? 'text-blue-500 dark:text-blue-400'
                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                        }`}
                                >
                                    {item.label}
                                    {activeTab === item.tab && (
                                        <div className="absolute -bottom-1 left-0 right-0 h-[3px] bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-4 flex-1 justify-end overflow-hidden max-w-full">
                            {/* Bar Chart Summary */}
                            <div className="flex items-center gap-2 h-7 bg-gray-100 dark:bg-gray-800/50 rounded-lg px-2 flex-1 max-w-[650px] border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                                <div className="flex gap-0.5 h-3.5 flex-1 items-center min-w-[100px]">
                                    {distributionData.types.slice(0, 5).map(([type, count], idx) => {
                                        const percentage = (count / distributionData.totalPieces) * 100;
                                        const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500'];
                                        const bgColor = colors[idx % colors.length];

                                        return (
                                            <div
                                                key={type}
                                                className={`h-full ${bgColor} rounded-sm transition-all hover:scale-y-110 cursor-help relative group flex items-center justify-center`}
                                                style={{ width: `${Math.max(percentage, 5)}%` }}
                                            >
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity font-bold">
                                                    {type}: {count} pçs ({Math.round(percentage)}%)
                                                </div>

                                                {percentage > 20 && (
                                                    <span className="text-[7px] font-black text-white/90 truncate px-1 uppercase tracking-tighter pointer-events-none">
                                                        {count}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {distributionData.types.length === 0 && (
                                        <div className="h-full w-full bg-gray-200 dark:bg-gray-700 rounded-sm opacity-50"></div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 ml-2 border-l border-gray-300 dark:border-gray-600 pl-3 flex-shrink-0">
                                    <div className="flex flex-col leading-none">
                                        <span className="text-[8px] text-gray-400 dark:text-gray-500 uppercase font-black tracking-tighter line-clamp-1">30 DIAS</span>
                                        <span className="flex gap-2">
                                            <span className="text-[10px] font-black text-blue-500 dark:text-blue-400">{distributionData.totalOrders}<small className="ml-0.5 font-normal text-gray-400 uppercase">ped</small></span>
                                            <span className="text-[10px] font-black text-emerald-500 dark:text-emerald-400">{distributionData.totalPieces}<small className="ml-0.5 font-normal text-gray-400 uppercase">pçs</small></span>
                                        </span>
                                    </div>
                                </div>

                                {isSyncing && (
                                    <div className="flex-shrink-0 ml-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                        {/* Legend Section */}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 justify-end items-center mr-4">
                            {distributionData.types.slice(0, 5).map(([type, count], idx) => {
                                const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500'];
                                const bgColor = colors[idx % colors.length];
                                return (
                                    <div key={type} className="flex items-center gap-1 whitespace-nowrap">
                                        <div className={`w-1.5 h-1.5 rounded-full ${bgColor}`}></div>
                                        <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-tighter leading-none inline-flex items-center gap-1">
                                            {type}: <span className="text-gray-900 dark:text-white font-black">{count}</span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <EstampasKPIs
                            summaryData={summaryData}
                            cardFilter={cardFilter}
                            handleCardClick={(filter) => {
                                setCardFilter(prev => prev === filter ? null : filter);
                                if (filter) setFilters(prev => ({ ...prev, status: '' }));
                            }}
                            isSyncing={isSyncing}
                            syncProgress={syncProgress}
                        />
                    </div>

                    {/* 3. Filter Bar (Integrated) */}
                    <EstampasFilterBar
                        filters={filters}
                        handleFilterChange={(key, value) => {
                            setFilters(prev => ({ ...prev, [key]: value }));
                        }}
                        setEnterPressedForSearch={() => { }}
                        uniqueFilterValues={uniqueFilterValues}
                        selectedCnpj={selectedCnpj}
                        setSelectedCnpj={setSelectedCnpj}
                        showImpresso={showImpresso}
                        setShowImpresso={setShowImpresso}
                        handleSignIn={handleConnectDrive}
                        isDriveConnected={isDriveConnected}
                        setIsDriveConnected={setIsDriveConnected}
                        openModal={() => openModal()}
                        selectedCount={selectedPedidos.size}
                        lotes={lotes}
                        bulkLoteNumber={bulkLoteNumber}
                        setBulkLoteNumber={setBulkLoteNumber}
                        onBulkLoteAssignment={handleBulkLoteAssignment}
                        onClearSelection={clearSelection}
                    />
                </div>

                {/* Main Content */}
                <div className="w-full min-h-[400px] mt-4">
                    {isLoading ? (
                        <DataLoading fullScreen={false} />
                    ) : (
                        <>
                            {activeTab === 'dashboard' && <EstampasDashboard
                                data={dashboardData}
                                delayRules={delayRules}
                                externalFilterActive={!!filters.month || !!(dateRange && (dateRange.startDate || dateRange.endDate))}
                            />}

                            {activeTab === 'lista' && (
                                <>
                                    <div className="mb-2 text-sm text-gray-500 dark:text-gray-400 font-medium flex justify-end items-center px-4">
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
                                        lotes={lotes}
                                        selectedPedidos={selectedPedidos}
                                        onTogglePedidoSelection={togglePedidoSelection}
                                        onToggleSelectAll={toggleSelectAll}
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

                            {activeTab === 'lote' && <LotesManager lotes={lotes} onLoteChange={loadLotes} />}

                            {activeTab === 'estoque' && <EstoqueEstampas />}
                        </>
                    )}
                </div>

                {/* Modal de Edição/Criação */}
                {isModalOpen && modalData && ReactDOM.createPortal(
                    <div className="fixed inset-0 z-[100001] overflow-y-auto" onClick={() => setIsModalOpen(false)}>
                        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-100"></div>
                            </div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div
                                className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full border dark:border-gray-700 animate-fade-in-scale"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="bg-white dark:bg-gray-800 flex flex-row h-[85vh]">
                                    {/* LEFT SIDE - Info & Forms (67%) */}
                                    <div className="flex-[0_0_67%] flex flex-col border-r dark:border-gray-700/50">
                                        {/* Header - Only on Left Side */}
                                        <div className="px-6 py-4 border-b dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/20">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    {modalData.id.startsWith('new-') ? (
                                                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nova Estampa</h3>
                                                                    ) : (
                                                                        <>
                                                                            {(() => {
                                                                                const isML = modalData.canal?.toUpperCase().includes('ML');
                                                                                const isSH = modalData.canal?.toUpperCase().includes('SH');
                                                                                const storeColor = isML ? 'bg-yellow-500' : isSH ? 'bg-orange-500' : 'bg-gray-500';

                                                                                return (
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className={`text-[10px] font-black text-white ${storeColor} px-2 py-0.5 rounded shadow-sm`}>{modalData.canal}</span>
                                                                                        <span className="text-sm font-bold text-gray-900 dark:text-white">{modalData.codVenda}</span>
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">{modalData.cliente}</p>
                                                            </div>

                                                            <div className="flex items-center gap-6">
                                                                {modalData.dataPrevista && (
                                                                    <span className="flex-shrink-0 text-[11px] font-black text-white bg-blue-600 px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 animate-pulse ring-2 ring-blue-500/20">
                                                                        <span className="text-sm">📅</span>
                                                                        <span className="tracking-tight uppercase">PREVISTA: {modalData.dataPrevista}</span>
                                                                    </span>
                                                                )}

                                                                {!modalData.id.startsWith('new-') && (
                                                                    <div className="relative w-72">
                                                                        <input
                                                                            type="text"
                                                                            value={modalSearch}
                                                                            onChange={(e) => setModalSearch(e.target.value)}
                                                                            placeholder="Navegar por pedido..."
                                                                            className="w-full h-9 pl-9 pr-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-primary-500/50 transition-all dark:text-white shadow-sm"
                                                                        />
                                                                        <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                                        </svg>

                                                                        {modalSearchSuggestions.length > 0 && (
                                                                            <div className="absolute top-10 left-0 right-0 bg-white dark:bg-gray-800 rounded-md shadow-xl border dark:border-gray-700 z-[1000] overflow-hidden">
                                                                                {modalSearchSuggestions.map((row) => (
                                                                                    <button
                                                                                        key={row.id}
                                                                                        onClick={() => openModal(row)}
                                                                                        className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
                                                                                    >
                                                                                        <div className="flex flex-col">
                                                                                            <span className="font-bold text-gray-900 dark:text-white">{row.codVenda}</span>
                                                                                            <span className="text-[10px] text-gray-500 truncate">{row.cliente}</span>
                                                                                        </div>
                                                                                        <span className="text-[9px] text-primary-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">ABRIR</span>
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                <button onClick={() => setIsModalOpen(false)} className="flex-shrink-0 text-gray-400 hover:text-red-500 focus:outline-none p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors ml-2">
                                                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6">
                                            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                                                {/* Column 1: Core Info */}
                                                <div className="space-y-5">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Status do Pedido</label>
                                                        <select
                                                            value={modalData.status}
                                                            onChange={(e) => setModalData({ ...modalData, status: e.target.value })}
                                                            className={`block w-full h-9 px-3 rounded-md border focus:ring-2 focus:ring-primary-500 transition-all font-bold text-xs appearance-none cursor-pointer uppercase ${statusSelectColorClasses[modalData.status] || 'bg-gray-50 dark:bg-gray-900 dark:text-white border-gray-300 dark:border-gray-600'}`}
                                                        >
                                                            {STATUS_OPTIONS.map(opt => (
                                                                <option key={opt} value={opt} className={`${statusSelectColorClasses[opt]} text-white`}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Local</label>
                                                            <select
                                                                value={modalData.localEstampa || ''}
                                                                onChange={(e) => setModalData({ ...modalData, localEstampa: e.target.value })}
                                                                className={`block w-full h-9 px-3 rounded-md border focus:ring-2 focus:ring-primary-500 transition-all text-xs font-bold appearance-none cursor-pointer ${localSelectColorClasses[(modalData.localEstampa || '').trim().toUpperCase()] || 'bg-gray-50 dark:bg-gray-900 dark:text-white border-gray-300 dark:border-gray-600'}`}
                                                            >
                                                                <option value="" className="bg-gray-800 text-white">Selecione...</option>
                                                                {LOCAL_ESTAMPA_OPTIONS.map(opt => (
                                                                    <option key={opt} value={opt} className={`${localSelectColorClasses[opt]} text-white`}>{opt}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Lote</label>
                                                            <div className="flex items-center gap-1.5">
                                                                <select
                                                                    value={modalData.L || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const now = new Date();
                                                                        const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                                                        setModalData({
                                                                            ...modalData,
                                                                            L: val,
                                                                            aramadoDataColocacao: val && !modalData.aramadoDataColocacao ? formattedDate : modalData.aramadoDataColocacao
                                                                        });
                                                                    }}
                                                                    className="block flex-1 h-9 px-3 rounded-md border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 transition-all font-bold text-xs text-center appearance-none cursor-pointer"
                                                                >
                                                                    <option value="">--</option>
                                                                    {lotes.map(lote => (
                                                                        <option key={lote.id} value={lote.numeroLote}>{lote.numeroLote}</option>
                                                                    ))}
                                                                </select>
                                                                {modalData.L && lotes.find(l => l.numeroLote?.toUpperCase() === modalData.L?.toUpperCase()) && (
                                                                    <button
                                                                        onClick={() => {
                                                                            const lote = lotes.find(l => l.numeroLote?.toUpperCase() === modalData.L?.toUpperCase());
                                                                            if (lote) setViewingModalLote(lote);
                                                                        }}
                                                                        className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-purple-500 hover:bg-purple-600 text-white rounded-md shadow-sm transition-all animate-pulse"
                                                                        title="Ver imagem do lote"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                        </svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-100 dark:border-gray-700">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Aramado</label>
                                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Aramado</label>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const isRetirado = !modalData.aramadoRetirado;
                                                                    const now = new Date();
                                                                    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                                                                    setModalData({
                                                                        ...modalData,
                                                                        aramadoRetirado: isRetirado,
                                                                        aramadoDataRetirada: isRetirado ? formattedDate : ''
                                                                    });
                                                                }}
                                                                className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all shadow-sm flex items-center gap-1.5 ${modalData.aramadoRetirado ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                                                            >
                                                                <div className={`w-2 h-2 rounded-full ${modalData.aramadoRetirado ? 'bg-white animate-pulse' : 'bg-gray-400'}`}></div>
                                                                {modalData.aramadoRetirado ? 'Retirado' : 'Marcar como Retirado'}
                                                            </button>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <span className="block text-[9px] text-gray-400 mb-0.5 font-bold">LETRA</span>
                                                                <select
                                                                    value={modalData.aramadoLetra || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const now = new Date();
                                                                        const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                                                        setModalData({
                                                                            ...modalData,
                                                                            aramadoLetra: val,
                                                                            aramadoDataColocacao: val ? formattedDate : modalData.aramadoDataColocacao
                                                                        });
                                                                    }}
                                                                    className={`block w-full h-8 px-2 rounded border focus:ring-1 text-center font-bold uppercase transition-all appearance-none cursor-pointer text-xs ${modalData.aramadoRetirado ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-500 text-white shadow-md' : modalData.aramadoLetra ? 'bg-gradient-to-br from-purple-600 to-indigo-700 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-white dark:bg-gray-800 dark:text-white border-gray-300 dark:border-gray-700'}`}
                                                                >
                                                                    <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">-</option>
                                                                    {aramadoLetras.map(l => <option key={l} value={l} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{l}</option>)}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[9px] text-gray-400 mb-0.5 font-bold">NÚMERO</span>
                                                                <select
                                                                    value={modalData.aramadoNumero || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const now = new Date();
                                                                        const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                                                        setModalData({
                                                                            ...modalData,
                                                                            aramadoNumero: val,
                                                                            aramadoDataColocacao: val ? formattedDate : modalData.aramadoDataColocacao
                                                                        });
                                                                    }}
                                                                    className={`block w-full h-8 px-2 rounded border focus:ring-1 text-center font-bold transition-all appearance-none cursor-pointer text-xs ${modalData.aramadoRetirado ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-500 text-white shadow-md' : modalData.aramadoNumero ? 'bg-gradient-to-br from-purple-600 to-indigo-700 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-white dark:bg-gray-800 dark:text-white border-gray-300 dark:border-gray-700'}`}
                                                                >
                                                                    <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">-</option>
                                                                    {aramadoNumeros.map(n => <option key={n} value={n} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{n}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        {(modalData.aramadoDataRetirada || modalData.aramadoDataColocacao) && (
                                                            <div className="mt-2 text-center bg-gray-100 dark:bg-gray-900/80 py-2 rounded-lg border border-gray-200 dark:border-gray-700/50 shadow-inner">
                                                                {modalData.aramadoRetirado ? (
                                                                    <span className="text-emerald-600 font-black text-sm uppercase tracking-tighter flex items-center justify-center gap-1">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                                        Retirado em {modalData.aramadoDataRetirada}
                                                                    </span>
                                                                ) : modalData.aramadoDataColocacao ? (
                                                                    <span className="text-purple-600 font-black text-sm uppercase tracking-tighter flex items-center justify-center gap-1">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                                                                        Colocado em {modalData.aramadoDataColocacao}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Column 2: Product & Notes */}
                                                <div className="space-y-5">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Nome da Estampa</label>
                                                        <input
                                                            type="text"
                                                            value={modalData.nomeEstampa || ''}
                                                            onChange={(e) => setModalData({ ...modalData, nomeEstampa: e.target.value })}
                                                            className="block w-full h-9 px-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 transition-all text-xs font-medium"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Vincular Arte</label>
                                                        <input
                                                            type="text"
                                                            value={modalData.arteProntaId || ''}
                                                            onChange={(e) => setModalData({ ...modalData, arteProntaId: e.target.value })}
                                                            placeholder="ID da pasta ou número do pedido"
                                                            className="block w-full h-9 px-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 transition-all text-xs font-medium"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Peça</label>
                                                            <input
                                                                type="text"
                                                                value={modalData.peca || ''}
                                                                disabled
                                                                className="block w-full h-9 px-3 rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-[10px] truncate"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Cor</label>
                                                            <select
                                                                value={modalData.cor || ''}
                                                                onChange={(e) => setModalData({ ...modalData, cor: e.target.value })}
                                                                className="block w-full h-9 px-3 rounded-md border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-primary-500 transition-all text-xs font-bold appearance-none cursor-pointer"
                                                                style={{
                                                                    backgroundColor: getColorHex(modalData.cor),
                                                                    color: getTextColorForBackground(getColorHex(modalData.cor))
                                                                }}
                                                            >
                                                                <option value="" style={{ backgroundColor: '#fff', color: '#000' }}>Selecione cor...</option>
                                                                {colorList.map(c => (
                                                                    <option
                                                                        key={c}
                                                                        value={c}
                                                                        style={{
                                                                            backgroundColor: getColorHex(c),
                                                                            color: getTextColorForBackground(getColorHex(c))
                                                                        }}
                                                                    >
                                                                        {c}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Observação</label>
                                                        <textarea
                                                            rows={3}
                                                            value={modalData.observacao || ''}
                                                            onChange={(e) => setModalData({ ...modalData, observacao: e.target.value })}
                                                            className="block w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 transition-all text-xs resize-none"
                                                            placeholder="Notas internas..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer Actions */}
                                        <div className="px-6 py-4 border-t dark:border-gray-700/50 bg-gray-50/30 dark:bg-gray-900/10 flex justify-between items-center">
                                            {modalData.id.startsWith('new-') ? (
                                                <button
                                                    type="button"
                                                    onClick={handleModalSave}
                                                    className="inline-flex items-center justify-center rounded px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm transition-all"
                                                >
                                                    CRIAR NOVA ESTAMPA
                                                </button>
                                            ) : <div className="text-[10px] text-gray-400 italic">Alterações são salvas automaticamente</div>}

                                            <div className="flex items-center gap-2 text-gray-400">
                                                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                                <span className="text-[9px] font-bold uppercase tracking-widest">Sincronização Ativa</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT SIDE - Images (33%) - FULL HEIGHT */}
                                    <div className="flex-[0_0_33%] bg-slate-50 dark:bg-slate-900/40 flex flex-col">
                                        {/* Content Area - NO HEADER, NO LATERAL PADDING */}
                                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                                            {!isDriveConnected && modalImages.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
                                                    <div className="p-4 bg-blue-100/20 dark:bg-blue-900/20 rounded-full mb-4">
                                                        <svg className="w-12 h-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V5C20 3.89543 19.1046 3 18 3H6C4.89543 3 4 3.89543 4 5V19C4 20.1046 4.89543 21 6 21ZM16 11L12 7M12 7L8 11M12 7V15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                    </div>
                                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">Google Drive Desconectado</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Conecte para visualizar artes automaticamente.</p>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleConnectDrive(); }}
                                                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                                                    >
                                                        CONECTAR DRIVE
                                                    </button>
                                                </div>
                                            ) : isLoadingImages && modalImages.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center py-12">
                                                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent mb-4"></div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Buscando artes...</p>
                                                </div>
                                            ) : modalImages.length > 0 ? (
                                                <div className="grid grid-cols-2 gap-0">
                                                    {modalImages.map((img) => (
                                                        <a
                                                            key={img.id}
                                                            href={img.webViewLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="group relative aspect-square overflow-hidden bg-white dark:bg-gray-800 hover:z-10 transition-all duration-300"
                                                        >
                                                            <img src={getThumbnailUrl(img)}
                                                                alt={img.name}
                                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                                onError={(e) => {
                                                                    const target = e.target as HTMLImageElement;
                                                                    // Se a miniatura falhar, mostra o ícone de PDF se for um PDF, ou tenta o fallback básico
                                                                    if (img.mimeType === 'application/pdf' || img.name.toLowerCase().endsWith('.pdf')) {
                                                                        target.src = 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg';
                                                                    } else {
                                                                        target.src = `https://drive.google.com/thumbnail?id=${img.id}&sz=w800`;
                                                                    }
                                                                }}
                                                            />
                                                            {(img.mimeType === 'application/pdf' || img.name.toLowerCase().endsWith('.pdf')) && (
                                                                <div className="absolute top-2 left-2 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm z-20">PDF</div>
                                                            )}
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <div className="p-2 bg-white/20 backdrop-blur-md rounded-full transform scale-75 group-hover:scale-100 transition-transform duration-300">
                                                                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                                </div>
                                                            </div>
                                                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-[9px] text-white truncate font-medium opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">{img.name}</div>
                                                        </a>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                                    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                                                        <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Nenhuma arte encontrada</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Lote Image Modal - Separate Portal */}
                {viewingModalLote && ReactDOM.createPortal(
                    <LoteImageModal
                        loteNumero={viewingModalLote.numeroLote}
                        imagemUrl={viewingModalLote.imagemUrl}
                        dataCriacao={viewingModalLote.dataCriacao}
                        onClose={() => setViewingModalLote(null)}
                    />,
                    document.body
                )}
            </div >
        </>
    );
};
