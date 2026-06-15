

import * as React from 'react';
import { DelayRules, View } from '../App';
import { SyncProgress } from '../types';
import { useAppContext } from '../contexts/AppContext';
import toast from 'react-hot-toast';

interface HeaderProps {
    fileName: string | null;
    theme: 'light' | 'dark';
    onThemeToggle: () => void;
    isDataLoaded: boolean;
    currentView: View;
    setCurrentView: (view: View) => void;
    viewTitle: string;
    dateBoundaries: { min?: string; max?: string; };
    backorderedItemsCount?: number;
    onUploadClick: () => void;
    showModal: (type: 'alert' | 'confirm', title: string, message: string | React.ReactNode, onConfirm?: () => void, options?: { confirmText?: string; onCancel?: () => void, maxWidth?: string }) => void;
    onUpdateDelayRules: (newRules: any[]) => void;
    onManageContacts: () => void;
    onGoogleDriveClick: () => void;
    uniqueStoresForRules: string[];
    onClearAllFilters: () => void;
    setSyncProgress: React.Dispatch<React.SetStateAction<SyncProgress>>;
    onSearchSubmit?: (term: string) => void;
}

interface QueueStatus {
    pendingCount: number;
    lastChecked: string;
}

type DatePreset = {
    label: string;
    days: number;
    isSingleDay?: boolean;
    isMonth?: boolean;
};

const datePresets: DatePreset[] = [
    { label: 'Hoje', days: 0, isSingleDay: true },
    { label: 'Ontem', days: 1, isSingleDay: true },
    { label: '2 Dias', days: 1 }, // today and yesterday
    { label: '3 Dias', days: 2 },
    { label: '7 Dias', days: 6 },
    { label: '1 Mês', days: 1, isMonth: true },
];

const formatDateToISO = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

interface RulesEditorProps {
    delayRules: DelayRules;
    uniqueStoresForRules: string[];
    onSave: (rules: DelayRules) => void;
    showModal: any;
}

const RulesEditor: React.FC<RulesEditorProps> = ({ delayRules, uniqueStoresForRules, onSave, showModal }) => {
    const [rules, setRules] = React.useState<DelayRules>(() => JSON.parse(JSON.stringify(delayRules)));
    const [activeTab, setActiveTab] = React.useState<'estampas' | 'capinhas'>('estampas');
    const [activeCnpjFilter, setActiveCnpjFilter] = React.useState<'todos' | 'mm' | 'mvf'>('todos');

    React.useEffect(() => {
        setRules(JSON.parse(JSON.stringify(delayRules)));
    }, [delayRules]);

    const handleRuleChange = (store: string, field: 'onTime' | 'atRisk', value: string) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue >= 0) {
            setRules(prev => ({
                ...prev,
                [store]: { ...(prev[store] || { onTime: 0, atRisk: 0 }), [field]: numValue }
            }));
        }
    };

    const handleApplyToAll = () => {
        const defaultRule = rules['default'] || { onTime: 4, atRisk: 6 };
        if (defaultRule.onTime >= defaultRule.atRisk) {
            toast.error('O prazo "Em dia" deve ser menor que "Em risco" nas regras padrões.');
            return;
        }

        const newRules = { ...rules };
        filteredStores.forEach(store => {
            if (store !== 'default') newRules[store] = { ...defaultRule };
        });
        setRules(newRules);

        // Also save immediately to satisfy "save to supabase" request
        onSave(newRules);
        toast.success(`Regras aplicadas a ${filteredStores.length - 1} lojas e salvas no banco!`);
    };

    // Filter stores based on CNPJ tab
    const filteredStores = React.useMemo(() => {
        const allStores = ['default', ...uniqueStoresForRules];
        if (activeCnpjFilter === 'todos') return allStores;

        return allStores.filter(store => {
            if (store === 'default') return true;
            if (activeCnpjFilter === 'mm') return store.includes(' MM');
            if (activeCnpjFilter === 'mvf') return store.includes(' VEST') || store.includes('MVF');
            return true;
        });
    }, [uniqueStoresForRules, activeCnpjFilter]);

    return (
        <div className="space-y-4 text-left max-h-[60vh] overflow-y-auto pr-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">Defina os prazos para o monitoramento de estampas. Os dias são contados a partir da data da venda.</p>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                {[
                    { key: 'estampas', label: '👕 Estampas', icon: '👕' },
                    { key: 'capinhas', label: '📱 Capinhas', icon: '📱' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as 'estampas' | 'capinhas')}
                        className={`px-4 py-2 text-sm font-bold transition-all relative ${activeTab === tab.key
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        {tab.label}
                        {activeTab === tab.key && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* CNPJ Filter Tabs */}
            <div className="flex gap-2 mt-3 mb-4">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase self-center mr-2">Filtrar CNPJ:</span>
                {[
                    { key: 'todos', label: 'Todos' },
                    { key: 'mm', label: 'MM' },
                    { key: 'mvf', label: 'MVF' }
                ].map(cnpj => (
                    <button
                        key={cnpj.key}
                        onClick={() => setActiveCnpjFilter(cnpj.key as 'todos' | 'mm' | 'mvf')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeCnpjFilter === cnpj.key
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                    >
                        {cnpj.label}
                    </button>
                ))}
            </div>

            {/* Rules per tab */}
            {filteredStores.map((store, index) => {
                const isDefault = store === 'default';
                const rule = rules[store] || { onTime: 4, atRisk: 6 };
                return (
                    <div key={store} className={`p-3 rounded-xl border ${isDefault ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-800/20 border-gray-100 dark:border-gray-700'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">{isDefault ? '🎯 Padrão (Aplicar a Todos)' : `🏪 ${store}`}</h4>
                            {isDefault && (
                                <button
                                    onClick={handleApplyToAll}
                                    className="px-2 py-1 text-[10px] font-black bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors uppercase"
                                >
                                    Aplicar
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                                    🟢 Em dia (até)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={rule.onTime}
                                        onChange={e => handleRuleChange(store, 'onTime', e.target.value)}
                                        className="w-full p-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                    <span className="absolute right-3 top-2 text-[10px] text-gray-400">Dias</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                                    🟡 Em risco (até)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={rule.atRisk}
                                        onChange={e => handleRuleChange(store, 'atRisk', e.target.value)}
                                        className="w-full p-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                    <span className="absolute right-3 top-2 text-[10px] text-gray-400">Dias</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
            {/* Save UI removed from here since we'll use modal confirm button */}
            <div className="pt-2 border-t dark:border-gray-700 flex justify-end">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                    Configurando: <strong className="text-gray-700 dark:text-gray-300">{activeTab === 'estampas' ? '👕 Estampas' : '📱 Capinhas'}</strong>
                </span>
            </div>
        </div>
    );
};


export const Header: React.FC<HeaderProps> = ({
    fileName,
    theme,
    onThemeToggle,
    isDataLoaded,
    currentView,
    setCurrentView,
    viewTitle,
    setSyncProgress,
    onSearchSubmit,
}) => {
    const {
        selectedCnpj, setSelectedCnpj,
        dateRange, setDateRange,
        globalSearchTerm, setGlobalSearchTerm,
        clearFilters
    } = useAppContext();

    const [showDateFilters, setShowDateFilters] = React.useState(false);
    const [showSyncMenu, setShowSyncMenu] = React.useState(false);
    const [pendingQueueCount, setPendingQueueCount] = React.useState<number>(0);
    const [lastQueueCheck, setLastQueueCheck] = React.useState<string>(new Date().toISOString());
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [activePreset, setActivePreset] = React.useState<string | null>(null);
    const dateFilterRef = React.useRef<HTMLDivElement>(null);
    const syncMenuRef = React.useRef<HTMLDivElement>(null);
    const prevPendingQueueCount = React.useRef(0);

    React.useEffect(() => {
        const savedProgress = localStorage.getItem('sync_progress_session');
        if (savedProgress) {
            try {
                const session = JSON.parse(savedProgress);
                const now = new Date().getTime();
                // Session valid for 1 hour
                if (now - session.timestamp < 3600000) {
                    setSyncProgress(prev => ({
                        ...prev,
                        isVisible: true,
                        status: 'processing',
                        message: 'Retomando sincronização...',
                        percentage: session.percentage,
                        totalProcessed: session.totalCompleted,
                        totalPending: session.pendingCount,
                        totalFailed: session.totalFailed
                    }));
                    // Automatically resume if it was processing
                    runProcessLoop('Retomando processamento...', session.initialPending, session.totalCompleted, session.totalFailed);
                } else {
                    localStorage.removeItem('sync_progress_session');
                }
            } catch (e) {
                console.error('Failed to parse saved progress:', e);
            }
        }
    }, []);

    React.useEffect(() => {
        if (!dateRange.start || !dateRange.end) {
            setActivePreset(null);
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = formatDateToISO(today);
        let matchedPreset = null;

        for (const preset of datePresets) {
            const startDateObj = new Date(today);
            let expectedStart: string;
            let expectedEnd: string;

            if (preset.isMonth) {
                startDateObj.setMonth(startDateObj.getMonth() - preset.days);
            } else {
                startDateObj.setDate(startDateObj.getDate() - preset.days);
            }
            expectedStart = formatDateToISO(startDateObj);

            if (preset.isSingleDay) {
                expectedEnd = expectedStart;
            } else {
                expectedEnd = todayStr;
            }

            if (dateRange.start === expectedStart && dateRange.end === expectedEnd) {
                matchedPreset = preset.label;
                break;
            }
        }
        setActivePreset(matchedPreset);

    }, [dateRange]);

    const handlePresetClick = (preset: DatePreset) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = formatDateToISO(today);

        const startDateObj = new Date(today);
        let startDate: string;

        if (preset.isMonth) {
            startDateObj.setMonth(startDateObj.getMonth() - preset.days);
        } else {
            startDateObj.setDate(startDateObj.getDate() - preset.days);
        }
        startDate = formatDateToISO(startDateObj);

        if (preset.isSingleDay) {
            setDateRange({ start: startDate, end: startDate });
        } else {
            setDateRange({ start: startDate, end: endDate });
        }

        setActivePreset(preset.label);
        setShowDateFilters(false);
    };

    const handleDateChange = (field: 'start' | 'end', value: string) => {
        setDateRange({ ...dateRange, [field]: value || null });
        setActivePreset(null);
    };

    const handleClearDates = () => {
        setDateRange({ start: null, end: null });
    };

    // Unified process loop to handle items in queue batch by batch
    const runProcessLoop = async (initialMessage: string = 'Processando pedidos...', customInitialPending?: number, customCompleted: number = 0, customFailed: number = 0) => {
        let totalCompleted = customCompleted;
        let totalFailed = customFailed;
        let initialPending = customInitialPending || 0;

        const updateStatus = (pendingCount: number, status: SyncProgress['status'] = 'processing') => {
            const totalProcessed = totalCompleted + totalFailed;
            const absoluteTotal = initialPending > totalProcessed + pendingCount ? initialPending : totalProcessed + pendingCount;
            const percentage = absoluteTotal > 0 ? Math.round((totalProcessed / absoluteTotal) * 100) : 0;

            const progressState = {
                isVisible: true,
                status,
                message: initialMessage,
                percentage,
                totalProcessed: totalCompleted,
                totalPending: pendingCount,
                totalFailed: totalFailed
            };

            setSyncProgress(prev => ({ ...prev, ...progressState }));

            // Save session to localStorage
            if (status !== 'completed' && status !== 'error') {
                localStorage.setItem('sync_progress_session', JSON.stringify({
                    initialPending,
                    totalCompleted,
                    totalFailed,
                    pendingCount,
                    percentage,
                    timestamp: new Date().getTime()
                }));
            } else if (status === 'completed') {
                localStorage.removeItem('sync_progress_session');
                // Refresh queue status after completion
                checkQueueStatus();
            }
        };

        try {
            let hasMore = true;
            setIsSyncing(true);
            while (hasMore) {
                const response = await fetch('/api/process-retry-queue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();

                if (!data.success) throw new Error(data.error || 'Erro no lote');

                totalCompleted += data.completed || 0;
                totalFailed += data.failed || 0;

                const pendingCount = data.pendingCount || 0;

                if (initialPending === 0 && pendingCount > 0) initialPending = pendingCount;

                updateStatus(pendingCount);

                if (pendingCount === 0 || (data.completed === 0 && data.retried === 0)) {
                    hasMore = false;
                } else {
                    await new Promise(r => setTimeout(r, 200)); // Reduced from 500ms for faster processing
                }
            }

            updateStatus(0, 'completed');
            // Clear localStorage when processing completes successfully
            localStorage.removeItem('sync_progress_session');

        } catch (error: any) {
            console.error('Process loop error:', error);
            setSyncProgress(prev => ({
                ...prev,
                status: 'error',
                message: `Erro: ${error.message}`
            }));
            localStorage.removeItem('sync_progress_session');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSyncTiny = async () => {
        setIsSyncing(true);
        setSyncProgress(prev => ({
            ...prev,
            isVisible: true,
            status: 'searching',
            message: 'Buscando novos pedidos no Tiny (últimos 30 dias)...',
            percentage: 0,
            totalProcessed: 0,
            totalPending: 0,
            totalFailed: 0
        }));

        try {
            const response = await fetch('/api/sync-tiny', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ daysBack: 3 })
            });
            const data = await response.json();

            if (!data.success) {
                setSyncProgress(prev => ({
                    ...prev,
                    status: 'error',
                    message: `Erro na descoberta: ${data.error}`
                }));
                return;
            }

            const { added } = data.stats;

            if (added === 0) {
                setSyncProgress(prev => ({
                    ...prev,
                    isVisible: true,
                    status: 'completed',
                    message: 'Nenhum pedido novo encontrado.',
                    percentage: 100,
                    totalProcessed: 0,
                    totalPending: 0,
                    totalFailed: 0
                }));
                return;
            }

            await runProcessLoop('Importando novos pedidos...', added);

        } catch (error: any) {
            setSyncProgress(prev => ({
                ...prev,
                status: 'error',
                message: `Erro: ${error.message}`
            }));
        } finally {
            setIsSyncing(false);
        }
    };

    const handleProcessQueue = async () => {
        setIsSyncing(true);
        try {
            // Step 1: Discovery for D-1
            setSyncProgress(prev => ({
                ...prev,
                isVisible: true,
                status: 'searching',
                message: 'Verificando últimos pedidos (D-1)...',
                percentage: 0,
                totalProcessed: 0,
                totalPending: 0,
                totalFailed: 0
            }));

            const syncResponse = await fetch('/api/sync-tiny', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}) // No limit on maxOrders to fetch all in range
            });

            // Even if discovery fails, we proceed to process whatever is in the queue
            await runProcessLoop('Processando fila de webhooks...');

        } catch (error: any) {
            setSyncProgress(prev => ({
                ...prev,
                status: 'error',
                message: `Erro: ${error.message}`
            }));
        } finally {
            setIsSyncing(false);
        }
    };

    const handleAtrasoInfoClick = () => {
        let currentRules: DelayRules = { ...delayRules };

        showModal(
            'confirm',
            "Editar Regras de Atraso de Estampas",
            <RulesEditor
                delayRules={delayRules}
                uniqueStoresForRules={uniqueStoresForRules}
                onSave={(newRules) => {
                    currentRules = newRules;
                    onUpdateDelayRules(newRules);
                }}
                showModal={showModal}
            />,
            () => {
                // Confirm action
                onUpdateDelayRules(currentRules);
            },
            { maxWidth: 'max-w-2xl', confirmText: 'Salvar Todas' }
        );
    };

    const checkQueueStatus = React.useCallback(async () => {
        try {
            // We use the same process-retry-queue but maybe a lightweight version or just peek
            // For now, let's call it and see the pendingCount it returns
            const response = await fetch('/api/process-retry-queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dryRun: true }) // Assuming API supports dryRun to just check
            });
            const data = await response.json();
            if (data.success) {
                setPendingQueueCount(data.pendingCount || 0);
                setLastQueueCheck(new Date().toISOString());
            }
        } catch (err) {
            console.error('Failed to check queue status:', err);
        }
    }, []);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
                setShowDateFilters(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        // Check queue on mount
        checkQueueStatus();

        // Check every 2 minutes
        const interval = setInterval(checkQueueStatus, 120000);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            clearInterval(interval);
        };
    }, [checkQueueStatus]);

    React.useEffect(() => {
        // Notification logic for new items in queue
        if (pendingQueueCount > prevPendingQueueCount.current && pendingQueueCount > 0) {
            // 1. Play Sound (Simple Beep via Web Audio API)
            try {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContext) {
                    const ctx = new AudioContext();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    // Pleasant "ding" sound
                    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
                    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
                    gain.gain.setValueAtTime(0.1, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

                    osc.start();
                    setTimeout(() => osc.stop(), 500);
                }
            } catch (e) {
                console.error('Failed to play notification sound', e);
            }

            // 2. System Notification
            if ('Notification' in window) {
                if (Notification.permission === 'granted') {
                    new Notification('Novos Pedidos no Tiny', {
                        body: `${pendingQueueCount} novos pedidos aguardando processamento.`,
                        icon: '/logo.png' // Fallback to default if not found
                    });
                } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            new Notification('Novos Pedidos no Tiny', {
                                body: `${pendingQueueCount} novos pedidos aguardando processamento.`
                            });
                        }
                    });
                }
            }
        }
        prevPendingQueueCount.current = pendingQueueCount;
    }, [pendingQueueCount]);

    const formatDateForDisplay = (dateString: string | null | undefined): string => {
        if (!dateString) return 'dd/mm';
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}`;
        }
        return 'dd/mm';
    };

    let displayLabel = activePreset;
    if (!activePreset) {
        const start = formatDateForDisplay(dateRange.start);
        const end = formatDateForDisplay(dateRange.end);
        if (start === 'dd/mm' && end === 'dd/mm') {
            displayLabel = 'Filtrar Data';
        } else {
            displayLabel = `${start} - ${end}`;
        }
    }

    const activeFiltersCount = React.useMemo(() => {
        let count = 0;
        if (selectedCnpj !== 'Todos') count++;
        if (dateRange.start || dateRange.end) count++;
        return count;
    }, [selectedCnpj, dateRange]);

    const handleClearAllFilters = () => {
        clearFilters();
        onClearAllFilters();
    };

    return (
        <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 gap-4">
                    <div className="flex items-center space-x-3 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h1 className="text-lg font-semibold truncate bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                            {viewTitle}
                        </h1>
                    </div>

                    <div className="flex items-center justify-end gap-2 flex-grow min-w-0">
                        {isDataLoaded && (
                            <div className="hidden lg:flex items-center gap-2 sm:gap-3 flex-grow min-w-0 justify-end">
                                {/* Search Filter */}
                                <div className="relative w-full max-w-xs">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                                    </div>
                                    <input
                                        type="search"
                                        value={globalSearchTerm}
                                        onChange={e => setGlobalSearchTerm(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && onSearchSubmit) {
                                                e.preventDefault();
                                                onSearchSubmit(globalSearchTerm);
                                            }
                                        }}
                                        className="block w-full h-9 pl-10 pr-3 py-2 text-sm border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-lg"
                                        placeholder="Buscar Pedido... (Enter para detalhes)"
                                    />
                                </div>
                                {/* Sync Menu Dropdown */}
                                <div className="relative flex-shrink-0" ref={syncMenuRef}>
                                    <button
                                        onClick={() => setShowSyncMenu(p => !p)}
                                        className="relative flex items-center justify-center h-9 px-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 bg-gradient-to-r from-blue-100 to-amber-100 dark:from-blue-900/40 dark:to-amber-900/40 border-blue-300 dark:border-blue-700 hover:from-blue-200 hover:to-amber-200 dark:hover:from-blue-800/60 dark:hover:to-amber-800/60"
                                        aria-label="Sincronização"
                                        title="Menu de sincronização"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 dark:text-amber-300 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        {pendingQueueCount > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] text-white items-center justify-center font-bold">
                                                    {pendingQueueCount > 99 ? '9+' : pendingQueueCount}
                                                </span>
                                            </span>
                                        )}
                                    </button>

                                    {showSyncMenu && (
                                        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-2">
                                            <button
                                                onClick={() => { handleSyncTiny(); setShowSyncMenu(false); }}
                                                disabled={isSyncing}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Sincronizar Tiny</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Últimos 30 dias</div>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => { handleProcessQueue(); setShowSyncMenu(false); }}
                                                disabled={isSyncing}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${pendingQueueCount > 0 ? 'bg-amber-500 text-white' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300'}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Processar Fila</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        {pendingQueueCount > 0 ? `${pendingQueueCount} pedidos pendentes` : 'Webhooks automáticos'}
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>



                                {/* Date Filter */}
                                <div className="relative flex-shrink-0" ref={dateFilterRef}>
                                    <button
                                        onClick={() => setShowDateFilters(p => !p)}
                                        className={`flex items-stretch h-9 w-full sm:w-auto rounded-lg border bg-white dark:bg-slate-800 transition-all ${showDateFilters ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'}`}
                                    >
                                        <div className="flex items-center p-2 text-gray-500 dark:text-gray-400 transition-colors bg-gray-100 dark:bg-slate-700 rounded-l-lg border-r border-gray-300 dark:border-gray-700">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <div className="flex items-center px-3 text-sm text-gray-700 dark:text-gray-200">
                                            <span>{displayLabel}</span>
                                        </div>
                                    </button>
                                    {showDateFilters && (
                                        <div className="absolute top-full right-0 mt-2 z-20 w-72 rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-700 shadow-lg text-gray-900 dark:text-gray-100">
                                            <div className="p-2 grid grid-cols-2 gap-2">
                                                {datePresets.map(preset => (
                                                    <button
                                                        key={preset.label}
                                                        onClick={() => handlePresetClick(preset)}
                                                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activePreset === preset.label
                                                            ? 'bg-primary-600 text-white font-semibold'
                                                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                            }`}
                                                    >
                                                        {preset.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="p-2">
                                                <hr className="border-gray-200 dark:border-gray-700 mb-2" />
                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 px-1">Intervalo Personalizado</p>
                                                <div className="flex items-center gap-0.5">
                                                    <input
                                                        type="date"
                                                        value={dateRange.start || ''}
                                                        onChange={e => handleDateChange('start', e.target.value)}
                                                        min={dateBoundaries.min}
                                                        max={dateBoundaries.max}
                                                        className="w-full text-sm bg-transparent focus:outline-none rounded-md p-1"
                                                        aria-label="Data de início"
                                                    />
                                                    <span className="text-gray-400 dark:text-gray-500">-</span>
                                                    <input
                                                        type="date"
                                                        value={dateRange.end || ''}
                                                        onChange={e => handleDateChange('end', e.target.value)}
                                                        min={dateRange.start || dateBoundaries.min}
                                                        max={dateBoundaries.max}
                                                        className="w-full text-sm bg-transparent focus:outline-none rounded-md p-1"
                                                        aria-label="Data de fim"
                                                    />
                                                    {(dateRange.start || dateRange.end) && (
                                                        <button
                                                            onClick={handleClearDates}
                                                            className="p-1.5 bg-gray-100 dark:bg-gray-600/50 text-gray-500 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500"
                                                            aria-label="Limpar datas"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* CNPJ Filter */}
                                <div className="flex-shrink-0 flex items-center rounded-lg bg-gray-100 dark:bg-gray-700/50 p-1 border dark:border-gray-600">
                                    {['Todos', 'MM', 'MVF'].map((cnpj) => (
                                        <button
                                            key={cnpj}
                                            onClick={() => setSelectedCnpj(cnpj as 'MM' | 'MVF' | 'Todos')}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${selectedCnpj === cnpj
                                                ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm'
                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                }`}
                                        >
                                            {cnpj}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Clear All Filters Button - Only show when filters are active */}
                        {activeFiltersCount > 0 && (
                            <button
                                onClick={handleClearAllFilters}
                                className="relative flex-shrink-0 flex items-center justify-center h-9 px-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 bg-orange-100 dark:bg-orange-900/40 border-orange-400 dark:border-orange-700 text-orange-600 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/60 focus:ring-orange-500 shadow-sm"
                                aria-label="Limpar todos os filtros"
                                title={`${activeFiltersCount} filtro${activeFiltersCount > 1 ? 's' : ''} ativo${activeFiltersCount > 1 ? 's' : ''} - Clique para limpar`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span className="ml-1.5 text-xs font-semibold">{activeFiltersCount}</span>
                            </button>
                        )}

                        <button
                            onClick={() => setCurrentView('upload')}
                            className="relative flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                            aria-label="Upload de planilha"
                            title="Ir para tela de Upload"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </button>

                        <button
                            onClick={handleAtrasoInfoClick}
                            className={`relative flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600`}
                            aria-label="Editar regras de atraso de estampas"
                            title="Editar regras de atraso de estampas"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <button
                            onClick={onGoogleDriveClick}
                            className="relative flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                            aria-label="Google Drive"
                            title="Google Drive"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 256 256" fill="currentColor">
                                <path d="M240.5,155.3L165.2,24.2H90.8l0,0l75.4,131.1H240.5z M102.9,166.2l-37.1,65.6h143.1l37.1-65.6H102.9z M81,40.6L10,166.2l37.2,65.6l72.1-125.7L81,40.6z" />
                            </svg>
                        </button>
                        <button
                            onClick={onManageContacts}
                            className="relative flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                            aria-label="Gerenciar Contatos"
                            title="Gerenciar Contatos"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                            </svg>
                        </button>




                        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

                        <button
                            onClick={onThemeToggle}
                            aria-label="Toggle theme"
                            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-full text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-primary-500"
                        >
                            {theme === 'light' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};