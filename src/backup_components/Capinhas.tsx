
import * as React from 'react';
import { TableRow, PhoneCaseModel } from '../types';
import { getCategory, parseSku, getEffectiveQuantity, isPersonalizado, isKit } from '../services/skuService';
import { normalizeString } from '../utils/stringUtils';
import { getSalesChannel } from '../services/ecommerceService';
import { storeStyles, defaultStoreStyle } from '../utils/ecommerceUtils';
import ModelosCapinhas from './ModelosCapinhas';
import { View } from '../App';
import PaginationControls from './common/PaginationControls';
import { CopyButton } from './common/CopyButton';
import CapinhasDashboard from './CapinhasDashboard';
import KpiCard from './common/KpiCard';


interface CapinhasProps {
    headers: string[];
    data: TableRow[];
    globalSearchTerm?: string;

    onAddBrand: (brand: string) => void;
    onDeleteBrand: (brand: string) => void;
    onRenameBrand: (oldBrand: string, newBrand: string) => void;
    onAddModel: (brand: string, model: string) => void;
    onDeleteModel: (brand: string, model: string) => void;
    onEditModel: (oldBrand: string, oldModel: string, newBrand: string, newModel: string) => void;
    onToggleStock: (brand: string, model: string) => void;
    showModal: (type: 'alert' | 'confirm', title: string, message: string | React.ReactNode, onConfirm?: () => void, options?: { confirmText?: string; onCancel?: () => void }) => void;
    setCurrentView: (view: View) => void;
    trackingMappings: Record<string, string>;
    imageMappings?: Record<string, string>;
    activeTab?: 'dashboard' | 'analise' | 'modelos';
}


const AnaliseView: React.FC<Omit<CapinhasProps, 'phoneCaseModels' | 'onAddBrand' | 'onDeleteBrand' | 'onAddModel' | 'onDeleteModel' | 'onEditModel' | 'onToggleStock' | 'showModal'>> = ({ headers, data, globalSearchTerm, setCurrentView, trackingMappings, imageMappings }) => {
    const { skuHeader, quantidadeHeader, idVendaHeader, situacaoHeader, nomeHeader, dataHeader } = React.useMemo(() => {
        const find = (key: string) => headers.find(h => normalizeString(h).includes(key));
        return {
            skuHeader: find('sku'),
            quantidadeHeader: find('quantidade'),
            idVendaHeader: find('numero da ordem de compra'),
            situacaoHeader: find('situacao'),
            nomeHeader: find('nome'),
            dataHeader: find('data'),
        };
    }, [headers]);

    const [cardFilter, setCardFilter] = React.useState<string | null>(null);
    const [filters, setFilters] = React.useState({ brand: '', model: '', tipo: 'todos', semModelo: false, kit: 'todos', canal: '', status: '', });
    const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'idVenda', direction: 'asc' });
    const [currentPage, setCurrentPage] = React.useState(1);
    const [rowsPerPage, setRowsPerPage] = React.useState(25);

    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = React.useState({ canScrollLeft: false, canScrollRight: false });
    const [isTableInView, setIsTableInView] = React.useState(false);

    const { processedData, uniqueBrands, uniqueModels, uniqueStores, uniqueStatuses } = React.useMemo(() => {
        if (!skuHeader || !quantidadeHeader || !idVendaHeader) {
            return { processedData: [], uniqueBrands: [], uniqueModels: [], uniqueStores: [], uniqueStatuses: [] };
        }

        const filtered = data.filter(row => getCategory(String(row[skuHeader] ?? '')) === 'Capinha');

        const brands = new Set<string>();
        const models = new Set<string>();
        const cnpjs = new Set<string>();
        const stores = new Set<string>();

        const processedMap = new Map<string, any>();

        filtered.forEach((row, index) => {
            const sku = String(row[skuHeader] ?? '');
            const idVenda = String(row[idVendaHeader!] ?? '');

            // Create a unique key for deduplication
            const uniqueKey = `${idVenda}-${sku}`;

            // Skip if already processed
            if (processedMap.has(uniqueKey)) return;

            const parsed = parseSku(sku);
            const isPerso = isPersonalizado(sku);
            const isAKit = isKit(sku);

            const brand = parsed?.colorName || 'N/A';
            const model = parsed?.sizeName || 'N/A';

            if (brand !== 'N/A') brands.add(brand);
            if (model !== 'N/A') models.add(model);

            const store = getSalesChannel(idVenda, row.cnpj || null);

            const originalStatus = situacaoHeader ? String(row[situacaoHeader] ?? 'N/A') : 'N/A';
            const normalizedStatus = normalizeString(originalStatus);
            let unifiedStatus = originalStatus;
            if (['faturado', 'em aberto', 'aprovado'].some(s => normalizedStatus.includes(s))) {
                unifiedStatus = 'Aprovado';
            }

            if (store !== 'N/A') stores.add(store);

            const processedRow = {
                ...row,
                _uniqueId: row._uniqueId || `capinha-${index}`,
                _idVenda: idVenda,
                _sku: sku,
                _quantity: getEffectiveQuantity(sku, String(row[quantidadeHeader]!)),
                _brand: brand,
                _model: model,
                _isPersonalizado: isPerso,
                _isKit: isAKit,
                _store: store,
                _cnpj: row.cnpj,
                _status: originalStatus,
                _date: dataHeader ? String(row[dataHeader] || '') : '',
                _unifiedStatus: unifiedStatus,
                _isCancelado: normalizedStatus.includes('cancelado'),
                _rastreio: trackingMappings[idVenda],
            };

            processedMap.set(uniqueKey, processedRow);
        });

        const processed = Array.from(processedMap.values());

        const allStatuses = new Set(processed.map(p => p._unifiedStatus));

        return {
            processedData: processed,
            uniqueBrands: Array.from(brands).sort(),
            uniqueModels: Array.from(models).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
            uniqueStores: Array.from(stores).sort(),
        };
    }, [data, skuHeader, quantidadeHeader, idVendaHeader, situacaoHeader, trackingMappings]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [filters, rowsPerPage, cardFilter, globalSearchTerm]);

    const filteredAndSortedData = React.useMemo(() => {
        let filtered = [...processedData];

        if (globalSearchTerm) {
            const lowerSearch = globalSearchTerm.toLowerCase();
            filtered = filtered.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(lowerSearch)));
        }

        if (cardFilter) {
            const activeItems = processedData.filter(r => !r._isCancelado);
            switch (cardFilter) {
                case 'TOTAL': filtered = activeItems; break;
                case 'PERSONALIZADAS': filtered = activeItems.filter(r => r._isPersonalizado); break;
                case 'TRANSPARENTES': filtered = activeItems.filter(r => !r._isPersonalizado); break;
                case 'CANCELADOS': filtered = processedData.filter(r => r._isCancelado); break;
                case 'INCOMPLETOS': filtered = processedData.filter(r => r._model === 'N/A'); break;
                case 'ATRASADOS':
                    filtered = processedData.filter(row => {
                        if (row._isCancelado || row._isPersonalizado || !row._date) return false;
                        const parts = row._date.split('/');
                        if (parts.length !== 3) return false;
                        const [day, month, year] = parts.map(Number);
                        const orderDate = new Date(year, month - 1, day);
                        const today = new Date();
                        orderDate.setHours(0, 0, 0, 0);
                        today.setHours(0, 0, 0, 0);
                        const diffDays = Math.ceil((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
                        return diffDays > 1 && !['enviado', 'entregue', 'cancelado', 'concluido'].some(s => row._unifiedStatus.toLowerCase().includes(s));
                    });
                    break;
            }
        }

        if (filters.brand) filtered = filtered.filter(row => row._brand === filters.brand);
        if (filters.model) filtered = filtered.filter(row => row._model.toLowerCase().includes(filters.model.toLowerCase()));
        if (filters.tipo === 'personalizada') filtered = filtered.filter(row => row._isPersonalizado);
        if (filters.tipo === 'transparente') filtered = filtered.filter(row => !row._isPersonalizado);
        if (filters.semModelo) filtered = filtered.filter(row => row._model === 'N/A');
        if (filters.kit === 'sim') filtered = filtered.filter(row => row._isKit);
        else if (filters.kit === 'nao') filtered = filtered.filter(row => !row._isKit);
        if (filters.canal) filtered = filtered.filter(row => row._store === filters.canal);

        if (sortConfig) {
            filtered.sort((a, b) => {
                const keyMap: Record<string, keyof typeof a> = {
                    idVenda: '_idVenda',
                    canal: '_store',
                    cnpj: '_cnpj',
                    sku: '_sku',
                    brand: '_brand',
                    model: '_model',
                    quantity: '_quantity',
                    kit: '_isKit',
                    status: '_unifiedStatus',
                    nome: nomeHeader as keyof typeof a,
                    tipo: '_isPersonalizado',
                    date: '_date',
                };
                const sortKey = keyMap[sortConfig.key] || sortConfig.key as keyof typeof a;
                const valA = a[sortKey];
                const valB = b[sortKey];

                if (typeof valA === 'number' && typeof valB === 'number') {
                    const comparison = valA < valB ? -1 : (valA > valB ? 1 : 0);
                    return sortConfig.direction === 'asc' ? comparison : -comparison;
                }
                const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        return filtered;
    }, [processedData, filters, sortConfig, globalSearchTerm, cardFilter, nomeHeader]);

    const paginatedData = React.useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredAndSortedData.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredAndSortedData, currentPage, rowsPerPage]);

    const { summaryCounts, dailyBreakdown } = React.useMemo(() => {
        const counts = { total: 0, personalizadas: 0, transparentes: 0, cancelados: 0, incompletos: 0, enviado: 0, atrasados: 0, persoFuturas: 0, transFuturas: 0 };
        const daily = {
            perso: [0, 0, 0], // Today, +1, +2
            trans: [0, 0, 0]  // Today, +1, +2
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        processedData.forEach(row => {
            let isDelayed = false;

            // Reusable date parsing
            let orderDate: Date | null = null;
            if (row._date) {
                const parts = row._date.split('/');
                if (parts.length === 3) {
                    const [day, month, year] = parts.map(Number);
                    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                        orderDate = new Date(year, month - 1, day);
                        orderDate.setHours(0, 0, 0, 0);
                    }
                }
            }

            // Normal counts
            if (row._isCancelado) { counts.cancelados += row._quantity; return; }
            if (row._model === 'N/A') counts.incompletos += row._quantity;
            counts.total += row._quantity;
            if (row._isPersonalizado) counts.personalizadas += row._quantity;
            else counts.transparentes += row._quantity;

            if (orderDate) {
                const diffTime = today.getTime() - orderDate.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Delay Logic
                // Only consider delayed if it's NOT personalized (transparentes only?)
                // Actually the original logic was calculating delays for Transparentes. Can personalized be delayed?
                // The prompt says "Implement Capinhas Daily Counts".
                // Retaining original logic:
                if (!row._isPersonalizado && diffDays > 1 && !['enviado', 'entregue', 'cancelado', 'concluido'].some(s => row._unifiedStatus.toLowerCase().includes(s))) {
                    isDelayed = true;
                    counts.atrasados += row._quantity;
                }

                // Daily Counts Logic (Future)
                // Calculate difference in days from today to order date
                // Note: diffDays above is "Today - OrderDate".
                // For future, we want "OrderDate - Today".
                // const futureDays = -diffDays; // if diffDays is positive (past), futureDays is negative.
                const futureTime = orderDate.getTime() - today.getTime();
                const futureDays = Math.round(futureTime / (1000 * 60 * 60 * 24));

                if (futureDays >= 0 && futureDays <= 2) {
                    if (row._isPersonalizado) {
                        counts.persoFuturas += row._quantity;
                        daily.perso[futureDays] += row._quantity;
                    } else if (row._model !== 'N/A') {
                        counts.transFuturas += row._quantity;
                        daily.trans[futureDays] += row._quantity;
                    }
                }
            }
        });

        return { summaryCounts: counts, dailyBreakdown: daily };
    }, [processedData]);

    const handleFilterChange = (field: keyof typeof filters, value: string | boolean) => setFilters(prev => ({ ...prev, [field]: value }));
    const clearFilters = () => { setFilters({ brand: '', model: '', tipo: 'todos', semModelo: false, kit: 'todos', canal: '' }); setCardFilter(null); };
    const handleSort = (key: string) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig?.key === key && sortConfig.direction === 'asc') { direction = 'desc'; } setSortConfig({ key, direction }); };
    const handleCardClick = (filter: string) => setCardFilter(prev => (prev === filter ? null : filter));

    const checkScroll = React.useCallback(() => {
        const el = scrollContainerRef.current;
        if (el) {
            const buffer = 2;
            const canScrollLeft = el.scrollLeft > buffer;
            const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - buffer;
            if (canScrollLeft !== scrollState.canScrollLeft || canScrollRight !== scrollState.canScrollRight) {
                setScrollState({ canScrollLeft, canScrollRight });
            }
        }
    }, [scrollState.canScrollLeft, scrollState.canScrollRight]);

    React.useEffect(() => {
        const el = scrollContainerRef.current;
        if (el) {
            checkScroll();
            el.addEventListener('scroll', checkScroll, { passive: true });
            const resizeObserver = new ResizeObserver(checkScroll);
            resizeObserver.observe(el);
            return () => {
                el.removeEventListener('scroll', checkScroll);
                resizeObserver.unobserve(el);
            };
        }
    }, [checkScroll, paginatedData]);

    React.useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => setIsTableInView(entry.isIntersecting), { threshold: 0.1 });
        const currentEl = scrollContainerRef.current;
        if (currentEl) observer.observe(currentEl);
        return () => { if (currentEl) observer.unobserve(currentEl); };
    }, []);

    const handleScroll = (direction: 'left' | 'right') => {
        const el = scrollContainerRef.current;
        if (el) {
            const scrollAmount = el.clientWidth * 0.8;
            el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    const tableHeaders = [
        { key: 'nome', label: 'Nome', sortable: true, align: 'left' },
        { key: 'date', label: 'Data', sortable: true, align: 'center' },
        { key: 'idVenda', label: 'ID Pedido', sortable: true, align: 'left' },
        { key: 'tipo', label: 'Tipo', sortable: true, align: 'center' },
        { key: 'quantity', label: 'Qt.', sortable: true, align: 'right' },
        { key: 'kit', label: 'Kit', sortable: true, align: 'center' },
        { key: 'canal', label: 'Canal', sortable: true, align: 'left' },
        { key: 'sku', label: 'SKU Original', sortable: true, align: 'left' },
        { key: 'brand', label: 'Marca', sortable: true, align: 'left' },
        { key: 'model', label: 'Modelo', sortable: true, align: 'left' },
        { key: 'cnpj', label: 'CNPJ', sortable: true, align: 'left' },
    ];

    if (!skuHeader || !quantidadeHeader || !idVendaHeader) return <div className="p-8 text-center"><h2 className="text-xl font-semibold">Configuração Incompleta</h2><p className="text-gray-400 mt-2">Sua planilha precisa de colunas 'SKU' e 'Quantidade'.</p></div>;

    const FilterInput: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
        <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">{label}</label>
            {children}
        </div>
    );

    return (
        <div className="animate-fade-in-scale space-y-6">
            {/* New KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard
                    title="Total de Capinhas"
                    value={summaryCounts.total.toLocaleString('pt-BR')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>}
                    colorObj={{ from: 'from-indigo-500', to: 'to-blue-600', shadow: 'shadow-indigo-500/20' }}
                    onClick={() => handleCardClick('TOTAL')}
                    isActive={cardFilter === 'TOTAL'}
                />
                <KpiCard
                    title="Personalizadas"
                    value={summaryCounts.personalizadas.toLocaleString('pt-BR')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>}
                    colorObj={{ from: 'from-purple-500', to: 'to-fuchsia-600', shadow: 'shadow-purple-500/20' }}
                    onClick={() => handleCardClick('PERSONALIZADAS')}
                    isActive={cardFilter === 'PERSONALIZADAS'}
                />
                <KpiCard
                    title="Transparentes"
                    value={summaryCounts.transparentes.toLocaleString('pt-BR')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                    colorObj={{ from: 'from-teal-500', to: 'to-emerald-600', shadow: 'shadow-teal-500/20' }}
                    onClick={() => handleCardClick('TRANSPARENTES')}
                    isActive={cardFilter === 'TRANSPARENTES'}
                />
                <KpiCard
                    title="Perso. Próx 3d"
                    value={summaryCounts.persoFuturas.toLocaleString('pt-BR')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    colorObj={{ from: 'from-blue-600', to: 'to-indigo-700', shadow: 'shadow-blue-500/20' }}
                    onClick={() => { }}
                    isActive={false}
                    breakdown={`Hoje: ${dailyBreakdown.perso[0]} | Amanhã: ${dailyBreakdown.perso[1]} | Depois: ${dailyBreakdown.perso[2]}`}
                />
                <KpiCard
                    title="Trans. Próx 3d"
                    value={summaryCounts.transFuturas.toLocaleString('pt-BR')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    colorObj={{ from: 'from-emerald-600', to: 'to-teal-700', shadow: 'shadow-emerald-500/20' }}
                    onClick={() => { }}
                    isActive={false}
                    breakdown={`Hoje: ${dailyBreakdown.trans[0]} | Amanhã: ${dailyBreakdown.trans[1]} | Depois: ${dailyBreakdown.trans[2]}`}
                />
                <KpiCard
                    title="Atrasados"
                    value={summaryCounts.atrasados.toLocaleString('pt-BR')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    colorObj={{ from: 'from-amber-500', to: 'to-orange-600', shadow: 'shadow-amber-500/20' }}
                    onClick={() => handleCardClick('ATRASADOS')}
                    isActive={cardFilter === 'ATRASADOS'}
                />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Lista de Pedidos de Capinhas</h3>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => handleFilterChange('semModelo', !filters.semModelo)}
                            className={`p-2.5 rounded-lg transition-colors shadow-sm ${filters.semModelo ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 ring-2 ring-red-500' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                            title="Mostrar apenas itens sem modelo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                        </button>
                        <button
                            onClick={clearFilters}
                            className="px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shadow-sm"
                        >
                            Limpar
                        </button>
                        <button
                            onClick={() => setCurrentView('separacao')}
                            className="px-5 py-2.5 bg-cyan-600 text-white font-bold text-sm rounded-lg hover:bg-cyan-700 flex items-center gap-2 shadow-md transition-all hover:scale-105 active:scale-95"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            Ir para a Separação (Picking)
                        </button>
                    </div>
                </div>

                {/* Filters Section */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap gap-4 items-end">
                        <FilterInput label="Marca">
                            <select value={filters.brand} onChange={e => handleFilterChange('brand', e.target.value)} className="w-full h-10 px-3 text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-shadow">
                                <option value="">Todas</option>
                                {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </FilterInput>
                        <FilterInput label="Modelo">
                            <input type="text" value={filters.model} onChange={e => handleFilterChange('model', e.target.value)} className="w-full h-10 px-3 text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-shadow" placeholder="Ex: S23, iPhone 14..." />
                        </FilterInput>
                        <FilterInput label="Tipo">
                            <select value={filters.tipo} onChange={e => handleFilterChange('tipo', e.target.value)} className="w-full h-10 px-3 text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-shadow">
                                <option value="todos">Todos</option>
                                <option value="personalizada">Personalizada</option>
                                <option value="transparente">Transparente</option>
                            </select>
                        </FilterInput>
                        <FilterInput label="Kit">
                            <select value={filters.kit} onChange={e => handleFilterChange('kit', e.target.value)} className="w-full h-10 px-3 text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-shadow">
                                <option value="todos">Todos</option>
                                <option value="sim">Com Kit</option>
                                <option value="nao">Sem Kit</option>
                            </select>
                        </FilterInput>
                        <FilterInput label="Canal">
                            <select value={filters.canal} onChange={e => handleFilterChange('canal', e.target.value)} className="w-full h-10 px-3 text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-shadow">
                                <option value="">Todos</option>
                                {uniqueStores.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </FilterInput>
                    </div>
                </div>

                <div className="relative">
                    <div ref={scrollContainerRef} className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                    {tableHeaders.map(h => (
                                        <th key={h.key} scope="col" className={`py-2 px-1 text-${h.align} text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${h.sortable ? 'cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors' : ''}`} onClick={() => h.sortable && handleSort(h.key)}>
                                            <div className={`flex items-center gap-1 ${h.align === 'right' ? 'justify-end' : h.align === 'center' ? 'justify-center' : ''}`}>
                                                <span>{h.label}</span>
                                                {h.sortable && <span className={`transition-opacity text-primary-500 ${sortConfig?.key === h.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>{sortConfig?.direction === 'asc' ? '▲' : '▼'}</span>}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900/30">
                                {paginatedData.map(row => {
                                    return (
                                        <tr key={row._uniqueId as string} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group">
                                            {tableHeaders.map(header => {
                                                let cellContent: React.ReactNode = null;
                                                let cellClass = `px-1 py-1 whitespace-nowrap text-sm text-${header.align}`;
                                                let title = '';

                                                switch (header.key) {
                                                    case 'nome':
                                                        const nome = String(row[nomeHeader!] || '');
                                                        cellContent = nome;
                                                        cellClass += ' text-gray-700 dark:text-gray-300 font-medium truncate max-w-[180px]';
                                                        title = nome;
                                                        break;
                                                    case 'date':
                                                        cellContent = row._date || '-';
                                                        cellClass += ' text-gray-600 dark:text-gray-400 font-medium text-xs';
                                                        break;
                                                    case 'idVenda':
                                                        cellContent = (
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="font-mono text-gray-600 dark:text-gray-400">{row._idVenda}</span>
                                                                <CopyButton text={row._idVenda} iconSize="h-4 w-4" />
                                                            </div>
                                                        );
                                                        break;
                                                    case 'tipo':
                                                        cellContent = (
                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${row._isPersonalizado ? 'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800' : 'bg-teal-100 text-teal-700 border border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800'}`}>
                                                                {row._isPersonalizado ? 'Personalizada' : 'Transparente'}
                                                            </span>
                                                        );
                                                        break;
                                                    case 'quantity':
                                                        cellContent = row._quantity;
                                                        cellClass += ' font-bold text-gray-800 dark:text-gray-200 text-base';
                                                        break;
                                                    case 'kit':
                                                        cellContent = row._isKit ? <span className="text-lg">📦</span> : <span className="text-gray-300 dark:text-gray-600">—</span>;
                                                        break;
                                                    case 'canal':
                                                        cellContent = (
                                                            <span className={`px-2 py-1 rounded-md text-xs font-bold border shadow-sm ${(storeStyles[row._store] || defaultStoreStyle).bg} ${(storeStyles[row._store] || defaultStoreStyle).text} ${(storeStyles[row._store] || defaultStoreStyle).border}`}>
                                                                {row._store}
                                                            </span>
                                                        );
                                                        break;
                                                    case 'sku':
                                                        cellContent = row._sku;
                                                        title = row._sku;
                                                        cellClass += ' font-mono text-xs text-gray-500 truncate max-w-[150px]';
                                                        break;
                                                    case 'brand':
                                                        cellContent = (
                                                            <span className="px-2 py-1 rounded-md text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800">
                                                                {row._brand}
                                                            </span>
                                                        );
                                                        cellClass += ' font-semibold';
                                                        break;
                                                    case 'model':
                                                        cellContent = (
                                                            <span className="px-2 py-1 rounded-md text-xs font-bold bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 dark:bg-fuchsia-900/40 dark:text-fuchsia-300 dark:border-fuchsia-800">
                                                                {row._model}
                                                            </span>
                                                        );
                                                        cellClass += ' font-medium';
                                                        break;
                                                    case 'cnpj':
                                                        cellContent = <span className="font-mono text-xs font-medium text-gray-500 dark:text-gray-400">{row._cnpj}</span>;
                                                        break;
                                                }

                                                return (
                                                    <td key={header.key} className={cellClass} title={title}>
                                                        {cellContent}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {isTableInView && scrollState.canScrollLeft && (
                        <button
                            onClick={() => handleScroll('left')}
                            className="absolute top-1/2 left-4 -translate-y-1/2 z-30 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary-500"
                            aria-label="Rolar para esquerda"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    )}
                    {isTableInView && scrollState.canScrollRight && (
                        <button
                            onClick={() => handleScroll('right')}
                            className="absolute top-1/2 right-4 -translate-y-1/2 z-30 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary-500"
                            aria-label="Rolar para direita"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    )}
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                    <PaginationControls
                        totalResults={filteredAndSortedData.length}
                        rowsPerPage={rowsPerPage}
                        setRowsPerPage={setRowsPerPage}
                        currentPage={currentPage}
                        // @ts-ignore
                        setCurrentPage={setCurrentPage}
                        totalPages={Math.ceil(filteredAndSortedData.length / rowsPerPage)}
                    />
                </div>
            </div>
        </div>
    );
}

const Capinhas: React.FC<CapinhasProps> = (props) => {
    const [activeTab, setActiveTab] = React.useState<'dashboard' | 'analise' | 'modelos'>('dashboard');

    // Sync active tab with props or localStorage (from ViewSwitcher dropdown)
    React.useEffect(() => {
        const savedTab = localStorage.getItem('capinhas_activeTab');
        if (savedTab && (savedTab === 'dashboard' || savedTab === 'analise' || savedTab === 'modelos')) {
            setActiveTab(savedTab);
            localStorage.removeItem('capinhas_activeTab');
        } else if (props.activeTab) {
            setActiveTab(props.activeTab);
        }
    }, [props.activeTab]);

    // Force 'modelos' tab if no data is loaded
    React.useEffect(() => {
        if (props.data.length === 0 && activeTab !== 'modelos') {
            setActiveTab('modelos');
        }
    }, [props.data.length]);

    return (
        <div className="animate-fade-in-scale">
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        disabled={props.data.length === 0}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'dashboard' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'} ${props.data.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('analise')}
                        disabled={props.data.length === 0}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'analise' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'} ${props.data.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Pedidos
                    </button>
                    <button
                        onClick={() => setActiveTab('modelos')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'modelos' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'}`}
                    >
                        Modelos de Capinhas
                    </button>
                </nav>
            </div>
            <div>
                {activeTab === 'dashboard' && <CapinhasDashboard headers={props.headers} data={props.data} />}
                {activeTab === 'analise' && <AnaliseView {...props} />}
                {activeTab === 'modelos' && <ModelosCapinhas
                    phoneCaseModels={props.phoneCaseModels}
                    onAddBrand={props.onAddBrand}
                    onDeleteBrand={props.onDeleteBrand}
                    onRenameBrand={props.onRenameBrand}
                    onAddModel={props.onAddModel}
                    onDeleteModel={props.onDeleteModel}
                    onEditModel={props.onEditModel}
                    onToggleStock={props.onToggleStock}
                    showModal={props.showModal}
                />}
            </div>
        </div>
    );
};

export default Capinhas;
