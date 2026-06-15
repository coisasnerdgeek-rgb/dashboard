

import * as React from 'react';

import { getDeletedOrderIds } from './services/deletedOrdersService';

import { getMontagemExclusions, addMontagemExclusion, removeMontagemExclusion, clearMontagemExclusions } from './services/montagemExclusionService';

import toast, { Toaster } from 'react-hot-toast';

import { Header } from './components/Header';

import FileUpload from './components/FileUpload';

import DataTable from './components/DataTable';

import { ViewSwitcher } from './components/ViewSwitcher';

import { SplashScreen } from './components/SplashScreen';

import { parseSpreadsheet } from './services/spreadsheetService';

import { TableRow, ProcessedTableRow, EstampaRow, SavedOrder, PaymentItem, PriceProduct, ArchivedSavedOrder, Contact, VerificationStatus, OrderTotals, PhoneCaseModel, SyncProgress } from './types';

import { Pedidos } from './components/Pedidos';

import { normalizeString } from './utils/stringUtils';

import { parseSku, transformSku, getCategory, isPersonalizado, getEffectiveQuantity, getProductMap, getColorMap, isKit, initializeSkuMaps, getSkuError } from './services/skuService';

import { EstampasKPIs } from './components/estampas/EstampasKPIs';

import { EstampasFilterBar } from './components/estampas/EstampasFilterBar';

import { EstampasList } from './components/estampas/EstampasList';

import { getAtrasoStatus, addBusinessDays } from './components/estampas/utils';



import { BackorderedItem } from './types';

import { sortSizes } from './utils/sortUtils';

import { getSalesChannel, getSupplier } from './services/ecommerceService';

import { toComparableDate, GLOBAL_DATE_CUTOFF, isAfterCutoff } from './utils/dateUtils';

import { defaultPriceData, calculateCost, initialStoresData, initializePriceTable, savePriceTable } from './services/priceTableService';

import Modal from './components/Modal';

import { Contatos } from './components/Contatos';

import { getContacts, saveContact, deleteContact, subscribeToContacts } from './services/contactsService';

import { updateSpreadsheetRow, insertSpreadsheetRow } from './services/supabaseService';

import { defaultPhoneCaseModels, initializePhoneCaseModels, addPhoneCaseModel, removePhoneCaseModel, updatePhoneCaseModel, renamePhoneCaseModel, movePhoneCaseModel } from './services/phoneCaseService';

import { cleanAndParse } from './utils/numberUtils';

import {

    getSavedOrders, getSavedOrdersPaginated, getDashboardMetrics, saveOrder, deleteOrder, saveArchivedOrder, getArchivedOrders,

    getDelayRules, saveDelayRule,

    getBackorderedItems, getResolvedBackorderedItems, saveBackorderedItem, resolveBackorderedItem, unresolveBackorderedItem, deleteBackorderedItem, subscribeToBackorderedItems,

    getVerificationStatus, saveVerificationStatus,

    getImageCategories, saveImageCategory, deleteImageCategory,

    getImageMappings, saveImageMapping, deleteImageMapping,

    getEstampasStatus, saveEstampasStatus,

    getTrackingMappings, saveTrackingMapping,

    getStores, saveStore, deleteStore,

    renamePhoneCaseBrand,

    getSetting

} from './services/supabaseService';



import { GoogleDrive } from './components/GoogleDrive';

import { useAppContext } from './contexts/AppContext';

// Lazy Loaded Components
const CriarPedido = React.lazy(() => import('./components/CriarPedido').then(m => ({ default: m.CriarPedido })));
const EnviarPedido = React.lazy(() => import('./components/EnviarPedido').then(m => ({ default: m.EnviarPedido })));
const Estampas = React.lazy(() => import('./components/Estampas').then(m => ({ default: m.Estampas })));
const SkuManager = React.lazy(() => import('./components/SkuManager'));
const Atrasados = React.lazy(() => import('./components/Atrasados').then(m => ({ default: m.Atrasados })));
const TabelaPrecos = React.lazy(() => import('./components/TabelaPrecos'));
const Metricas = React.lazy(() => import('./components/Metricas'));
const TaxasMarketplace = React.lazy(() => import('./components/TaxasMarketplace'));
const Pagamento = React.lazy(() => import('./components/Pagamento').then(m => ({ default: m.Pagamento })));
const Capinhas = React.lazy(() => import('./components/Capinhas'));
const Imagem = React.lazy(() => import('./components/Imagem'));
const Verificacao = React.lazy(() => import('./components/Verificacao'));
const Separacao = React.lazy(() => import('./components/Separacao'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));

import DataLoading from './components/common/DataLoading';



import { getPendingPayments, getArchivedPayments, savePayment, deletePayment } from './services/paymentService';

import {

    saveSpreadsheetData,

    getSpreadsheetData,

    deleteSpreadsheetFile,

    clearAllSpreadsheetData,

    subscribeToSpreadsheetChanges,

    subscribeToQueueChanges,

    deleteSpreadsheetRow,

    subscribeToSavedOrders,

    subscribeToVerificationStatus

} from './services/supabaseService';

import { useOrders } from './hooks/useOrders';

import { useEstampas } from './hooks/useEstampas';

import { useQueryClient } from '@tanstack/react-query';

import { getAppSettings, updateAppSetting, subscribeToAppSettings } from './services/appSettingsService';





export type View = 'dashboard' | 'data' | 'pedidos' | 'montar-pedido' | 'upload' | 'sku' | 'precos' | 'atrasados' | 'estampas' | 'pagamento' | 'enviar-pedido' | 'capinhas' | 'imagem' | 'verificacao' | 'separacao';



interface ModalState {

    isOpen: boolean;

    title: string;

    message: string | React.ReactNode;

    type: 'alert' | 'confirm';

    onConfirm?: () => void;

    onCancel?: () => void;

    confirmText?: string;

    cancelText?: string;

    maxWidth?: string;

    clickPosition?: { x: number; y: number }; // NEW: Position where user clicked

}



export type DelayRules = Record<string, { onTime: number; atRisk: number }>;



export interface ImageCategory {

    id: string;

    name: string;

}



export interface Store {

    name: string;

    types: string[];

}



// Removed hardcoded STORES constant in favor of dynamic state

// const STORES = ["GUSHI", "MAGIC", "GLOBAL", "FENOMENAL", "ALFA DEZ", "ERON", "INDICE"];





const VIEW_TITLES: Record<View, string> = {

    dashboard: 'Geral',

    upload: 'Upload de Planilha',

    pedidos: 'Análise de Pedidos',

    'montar-pedido': 'Montar Grade de Pedido',

    'enviar-pedido': 'Enviar Pedidos',

    data: 'Visualização de Dados',

    sku: 'Gerenciador de SKU',

    imagem: 'Cadastro de Imagens',

    precos: 'Ganhos',

    atrasados: 'Itens Atrasados',

    estampas: 'Estampas',

    capinhas: 'Capinhas',

    pagamento: 'Pagamentos',

    verificacao: 'Verificação',

    separacao: 'Separação',

};



const App: React.FC = () => {

    const queryClient = useQueryClient();

    const { data: ordersData, allRows: serverRows, headers: serverHeaders, isLoading: isOrdersLoading, isFetched, refetch, isRefetching } = useOrders();

    const { estampasStatus, updateStatus: mutateEstampaStatus, bulkUpdateStatus } = useEstampas();

    const [data, setData] = React.useState<Record<string, { rows: TableRow[], importDate: string }>>({});

    const [headers, setHeaders] = React.useState<string[]>([]);

    const [isLoading, setIsLoading] = React.useState(true);

    const [error, setError] = React.useState<string | null>(null);



    // Derive allRows from local state for real-time updates

    const allRows = React.useMemo(() => {

        return Object.values(data).flatMap(d => (d as any).rows || []);

    }, [data]);



    // Sync Server Data to Local State (Bridge for Legacy Code)

    React.useEffect(() => {

        if (isFetched && ordersData && Object.keys(ordersData).length > 0) {

            console.log('[App] 🔄 Sincronizando dados recém-carregados (Realtime/Fetch) para o estado local');

            setData(ordersData as Record<string, { rows: TableRow[], importDate: string }>);

        }



        if (serverHeaders && serverHeaders.length > 0 && headers.length === 0) {

            setHeaders(serverHeaders);

        }

    }, [ordersData, serverHeaders, headers.length, isFetched]);



    // UI State

    const [currentView, setCurrentView] = React.useState<View>(() => {

        const saved = localStorage.getItem('currentView');

        return (saved as View) || 'pedidos';

    });

    const [subViewHistory, setSubViewHistory] = React.useState<Record<string, string | null>>(() => {

        try {

            const saved = localStorage.getItem('subViewHistory');

            return saved ? JSON.parse(saved) : {};

        } catch (e) {

            return {};

        }

    });

    const [currentSubView, setCurrentSubView] = React.useState<string | null>(null);



    React.useEffect(() => {

        localStorage.setItem('currentView', currentView);

        const historyValue = subViewHistory[currentView] || null;

        setCurrentSubView(historyValue);

    }, [currentView]);



    React.useEffect(() => {

        localStorage.setItem('subViewHistory', JSON.stringify(subViewHistory));

    }, [subViewHistory]);



    const handleSubViewChange = React.useCallback((subView: string | null) => {

        setSubViewHistory(prev => ({ ...prev, [currentView]: subView }));

        setCurrentSubView(subView);

    }, [currentView]);

    const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');

    const [showSplash, setShowSplash] = React.useState(true);

    const [isAppReady, setIsAppReady] = React.useState(false);

    const [clearFiltersTimestamp, setClearFiltersTimestamp] = React.useState<number>(0);



    // Filtering State from Context



    // Filtering State from Context

    const {

        selectedCnpj, setSelectedCnpj,

        dateRange, setDateRange,

        globalSearchTerm, setGlobalSearchTerm,

        clearFilters,

        ruleVersion, refreshRules

    } = useAppContext();



    // Persist dateRange changes

    const lastClickRef = React.useRef<{ x: number; y: number } | undefined>(undefined);



    React.useEffect(() => {

        const handleMouseDown = (e: MouseEvent) => {

            lastClickRef.current = { x: e.clientX, y: e.clientY };

        };

        window.addEventListener('mousedown', handleMouseDown, true);

        return () => window.removeEventListener('mousedown', handleMouseDown, true);

    }, []);

    const [dateBoundaries, setDateBoundaries] = React.useState<{ min?: string; max?: string }>({});

    const [initialFilterForDataTable, setInitialFilterForDataTable] = React.useState<Record<string, string> | null>(null);

    const [delayRules, setDelayRules] = React.useState<DelayRules>({ default: { onTime: 4, atRisk: 6 } });

    const [isGoogleDriveOpen, setIsGoogleDriveOpen] = React.useState(false);

    const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);

    // Contacts State
    const [isContactsModalOpen, setIsContactsModalOpen] = React.useState(false);
    const [contacts, setContacts] = React.useState<Contact[]>([]);

    React.useEffect(() => {
        const loadContacts = async () => {
            const data = await getContacts();
            setContacts(data);
        };
        loadContacts();

        // Subscribe to changes if available, otherwise just initial load
        const subscription = subscribeToContacts(() => {
            const loadContacts = async () => {
                const data = await getContacts();
                setContacts(data);
            };
            loadContacts();
        });
        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    const handleSaveContact = async (contact: Contact) => {
        const saved = await saveContact(contact);
        if (saved) {
            toast.success('Contato salvo com sucesso!');
            // State is updated via subscription or manually if no subscription
            // For now assuming subscription works or we reload
            const data = await getContacts();
            setContacts(data);
        } else {
            toast.error('Erro ao salvar contato.');
        }
    };

    const handleDeleteContact = async (contactId: string) => {
        const success = await deleteContact(contactId);
        if (success) {
            toast.success('Contato removido.');
            const data = await getContacts();
            setContacts(data);
        } else {
            toast.error('Erro ao remover contato.');
        }
    };

    const [globalFilters, setGlobalFilters] = React.useState<Record<string, string | string[]>>({});

    const [driveSelectCallback, setDriveSelectCallback] = React.useState<((url: string) => void) | undefined>(undefined);



    // Modal State

    const [modalState, setModalState] = React.useState<ModalState>({

        isOpen: false,

        title: '',

        message: '',

        type: 'alert'

    });



    // Global Sync Progress State

    const [syncProgress, setSyncProgress] = React.useState<SyncProgress>({

        isVisible: false,

        status: 'searching',

        message: '',

        percentage: 0,

        totalProcessed: 0,

        totalPending: 0,

        totalFailed: 0,

        isMinimized: false

    });





    // Orders State

    const [savedOrders, setSavedOrders] = React.useState<SavedOrder[]>([]);



    // Selection and Filter state for EnviarPedido (Hoisted and Sync'ed with Supabase)

    const [enviarSelectedOrders, setEnviarSelectedOrders] = React.useState<Set<string>>(new Set());

    const [enviarCnpjFilterMode, setEnviarCnpjFilterMode] = React.useState<string>('AMBOS_SEPARADOS');



    // Sync state for CriarPedido (Shared)

    const [criarPedidoSelectedStore, setCriarPedidoSelectedStore] = React.useState<string>('');

    const [criarPedidoSelectedProduct, setCriarPedidoSelectedProduct] = React.useState<string>('');



    // Persistence and Real-time Sync for App Settings

    React.useEffect(() => {

        // 1. Initial Load

        getAppSettings().then(settings => {

            if (settings.ui_enviar_selected_orders) {

                setEnviarSelectedOrders(new Set(settings.ui_enviar_selected_orders));

            }

            if (settings.ui_enviar_cnpj_filter_mode) {

                setEnviarCnpjFilterMode(settings.ui_enviar_cnpj_filter_mode);

            }

            if (settings.ui_criar_pedido_selected_store) {

                setCriarPedidoSelectedStore(settings.ui_criar_pedido_selected_store);

            }

            if (settings.ui_criar_pedido_selected_product) {

                setCriarPedidoSelectedProduct(settings.ui_criar_pedido_selected_product);

            }

        });



        // 2. Real-time Subscription

        const subscription = subscribeToAppSettings((payload) => {

            if (payload.new) {

                const { key, value } = payload.new;

                let parsedValue;

                try {

                    parsedValue = JSON.parse(value);

                } catch (e) {

                    parsedValue = value;

                }



                if (key === 'ui_enviar_selected_orders') {

                    setEnviarSelectedOrders(new Set(parsedValue));

                } else if (key === 'ui_enviar_cnpj_filter_mode') {

                    setEnviarCnpjFilterMode(parsedValue);

                } else if (key === 'ui_criar_pedido_selected_store') {

                    setCriarPedidoSelectedStore(parsedValue);

                } else if (key === 'ui_criar_pedido_selected_product') {

                    setCriarPedidoSelectedProduct(parsedValue);

                }

            }

        });



        return () => {

            subscription.unsubscribe();

        };

    }, []);



    // 3. Update handlers for Supabase sync

    const onUpdateEnviarSelectedOrders = React.useCallback((ids: Set<string>) => {

        setEnviarSelectedOrders(ids);

        updateAppSetting('ui_enviar_selected_orders', Array.from(ids));

    }, []);



    const onUpdateEnviarCnpjFilterMode = React.useCallback((mode: string) => {

        setEnviarCnpjFilterMode(mode);

        updateAppSetting('ui_enviar_cnpj_filter_mode', mode);

    }, []);



    const onUpdateCriarPedidoSelectedStore = React.useCallback((store: string) => {

        setCriarPedidoSelectedStore(store);

        updateAppSetting('ui_criar_pedido_selected_store', store);

    }, []);



    const onUpdateCriarPedidoSelectedProduct = React.useCallback((product: string) => {

        setCriarPedidoSelectedProduct(product);

        updateAppSetting('ui_criar_pedido_selected_product', product);

    }, []);



    // Paginated Loading State (Performance Optimization)

    const [isLoadingMore, setIsLoadingMore] = React.useState(false);

    const [hasMoreOrders, setHasMoreOrders] = React.useState(true);

    const [oldestLoadedDate, setOldestLoadedDate] = React.useState<string | null>(null);

    const [initialLoadComplete, setInitialLoadComplete] = React.useState(false);



    const [archivedSavedOrders, setArchivedSavedOrders] = React.useState<ArchivedSavedOrder[]>([]);

    const [pendingPayments, setPendingPayments] = React.useState<PaymentItem[]>([]);

    const [archivedPayments, setArchivedPayments] = React.useState<PaymentItem[]>([]);

    const [backorderedItems, setBackorderedItems] = React.useState<BackorderedItem[]>([]);

    const [resolvedItems, setResolvedItems] = React.useState<BackorderedItem[]>([]);

    const [duplicateRows, setDuplicateRows] = React.useState<{ orderId: string, sku: string, fullText: string }[]>([]);

    // const [estampasStatus, setEstampasStatus] = React.useState<Record<string, Partial<EstampaRow>>>({});  // Now comes from useEstampas hook

    const [priceTable, setPriceTable] = React.useState<PriceProduct[]>([]);

    const [stores, setStores] = React.useState<Store[]>([]);



    const [imageMappings, setImageMappings] = React.useState<Record<string, string>>({});

    const [imageCategories, setImageCategories] = React.useState<ImageCategory[]>([]);

    const [imageCategoryAssignments, setImageCategoryAssignments] = React.useState<Record<string, string | null>>({});

    const [verificationStatus, setVerificationStatus] = React.useState<Record<string, VerificationStatus>>({});

    const [phoneCaseModels, setPhoneCaseModels] = React.useState<Record<string, PhoneCaseModel[]>>({});

    const [trackingMappings, setTrackingMappings] = React.useState<Record<string, string>>({});





    const [newOrdersCount, setNewOrdersCount] = React.useState(0);

    const [showNotification, setShowNotification] = React.useState(false);



    // Global Deletion State (Hoisted from CriarPedido)

    const [deletedOrderIds, setDeletedOrderIds] = React.useState<Set<string>>(new Set());

    const [montarExcludedOrderIds, setMontarExcludedOrderIds] = React.useState<Set<string>>(new Set());



    // Load deleted and excluded orders on start

    React.useEffect(() => {

        getDeletedOrderIds().then(ids => {

            setDeletedOrderIds(new Set(Array.from(ids).map(String)));

        });

        getMontagemExclusions().then(ids => {

            setMontarExcludedOrderIds(new Set(Array.from(ids).map(String)));

        });

    }, []);





    const fileInputRef = React.useRef<HTMLInputElement>(null);



    const showModal = React.useCallback((

        type: 'alert' | 'confirm',

        title: string,

        message: string | React.ReactNode,

        onConfirm?: () => void,

        options?: {

            onCancel?: () => void;

            confirmText?: string;

            cancelText?: string;

            maxWidth?: string;

            clickPosition?: { x: number; y: number };

        }

    ) => {

        setModalState({

            isOpen: true,

            type,

            title,

            message,

            onConfirm,

            onCancel: options?.onCancel,

            confirmText: options?.confirmText,

            cancelText: options?.cancelText,

            maxWidth: options?.maxWidth,

            clickPosition: options?.clickPosition || lastClickRef.current,

        });

    }, []);



    const closeModal = () => {

        setModalState({ ...modalState, isOpen: false });

    };





    // Derived state for saved product names

    const savedProductNames = React.useMemo(() => {

        return new Set(savedOrders.map(o => o.product));

    }, [savedOrders]);



    const storesList = React.useMemo(() => stores.map(s => s.name), [stores]);



    // Load theme and saved orders from Supabase on initial render

    React.useEffect(() => {

        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;

        if (savedTheme) {

            setTheme(savedTheme);

        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {

            setTheme('dark');

        } else {

            setTheme('light');

        }



        const initializeData = async () => {

            // Initialize Stores - Commented out as 'stores' table doesn't exist in Supabase

            // Using local initialStoresData instead

            setStores(initialStoresData);



            /* 

            try {

                const dbStores = await getStores();

                if (dbStores.length > 0) {

                    setStores(dbStores);

                } else {

                    setStores(initialStoresData);

                    // Optionally save initial data to DB?

                    initialStoresData.forEach(s => saveStore(s).catch(console.error));

                }

            } catch (error) {

                console.error("Failed to load stores from Supabase", error);

                setStores(initialStoresData);

            }

            */



            try {

                setSyncProgress(prev => ({ ...prev, percentage: 10, message: 'Inicializando serviços SKU...' }));

                await initializeSkuMaps();



                setSyncProgress(prev => ({ ...prev, percentage: 20, message: 'Carregando tabela de preços...' }));

                const prices = await initializePriceTable();

                setPriceTable(prices);



                setSyncProgress(prev => ({ ...prev, percentage: 30, message: 'Carregando modelos de capinhas...' }));

                const models = await initializePhoneCaseModels();

                const safeSet = async (percentage: number, message: string, fn: () => Promise<any>, setter: (val: any) => void) => {

                    setSyncProgress(prev => ({ ...prev, percentage, message }));

                    try {

                        const val = await fn();

                        setter(val);

                    } catch (e) {

                        console.error(`Error loading ${message}:`, e);

                    }

                };



                await safeSet(30, 'Modelos de cases', initializePhoneCaseModels, setPhoneCaseModels);



                setSyncProgress(prev => ({ ...prev, percentage: 40, message: 'Pedidos recentes' }));

                try {

                    const [orders, archivedOrders] = await Promise.all([

                        getSavedOrders(30),

                        getArchivedOrders()

                    ]);

                    setSavedOrders(orders);

                    setArchivedSavedOrders(archivedOrders);

                } catch (e) {

                    console.error('Error loading orders:', e);

                }



                await safeSet(50, 'Regras de atraso', getDelayRules, setDelayRules);



                setSyncProgress(prev => ({ ...prev, percentage: 60, message: 'Itens em falta' }));

                try {

                    const [backordered, resolved] = await Promise.all([

                        getBackorderedItems(),

                        getResolvedBackorderedItems()

                    ]);

                    setBackorderedItems(backordered);

                    setResolvedItems(resolved);

                } catch (e) {

                    console.error('Error loading backordered items:', e);

                }



                await safeSet(70, 'Status de produção', getVerificationStatus, setVerificationStatus);

                await safeSet(75, 'Categorias de imagens', getImageCategories, setImageCategories);



                setSyncProgress(prev => ({ ...prev, percentage: 80, message: 'Mapeamento de imagens' }));

                try {

                    const imgMaps = await getImageMappings();

                    setImageMappings(imgMaps.mappings);

                    setImageCategoryAssignments(imgMaps.assignments);

                } catch (e) {

                    console.error('Error loading image mappings:', e);

                }



                await safeSet(85, 'Contatos', getContacts, setContacts);



                setSyncProgress(prev => ({ ...prev, percentage: 90, message: 'Pagamentos' }));

                try {

                    const [pending, archived] = await Promise.all([

                        getPendingPayments(),

                        getArchivedPayments()

                    ]);

                    setPendingPayments(pending);

                    setArchivedPayments(archived);

                } catch (e) {

                    console.error('Error loading payments:', e);

                }



                // Load and sync Google Drive Settings

                getSetting('googleDriveFolderId_Atual').then(id => {

                    if (id) localStorage.setItem('googleDrivePublicFolderId', id);

                    else localStorage.setItem('googleDrivePublicFolderId', '11lPRLR2oHxhPrkg4etlNyeTawZvDBZxk');

                }).catch(() => { });



                getSetting('googleDriveFolderId_Backup').then(id => {

                    if (id) localStorage.setItem('googleDriveBackupFolderId', id);

                    else localStorage.setItem('googleDriveBackupFolderId', '1Wp9ZbBEI72wr4wjlxH9RN3zJNGmnWHxv');

                }).catch(() => { });



                getSetting('googleDriveFolderId_Estampas').then(id => {

                    if (id) localStorage.setItem('googleDriveEstampasFolderId', id);

                }).catch(() => { });



                // Tracking mappings

                getTrackingMappings().then(tracking => {

                    setTrackingMappings(tracking);

                }).catch(err => {

                    console.error("Failed to load tracking mappings", err);

                    setTrackingMappings({});

                });



                setIsLoading(false);

                setIsAppReady(true);

                setSyncProgress(prev => ({ ...prev, percentage: 100, message: 'Preparando interface...' }));



                setTimeout(() => {

                    setIsAppReady(true);

                    setTimeout(() => setShowSplash(false), 800);

                }, 1500);



            } catch (error) {

                console.error("Critical error during initialization:", error);

                setShowSplash(false);

            }

        };



        initializeData();

    }, []);

    // Realtime Subscriptions

    React.useEffect(() => {

        const contactsSub = subscribeToContacts(async () => {

            try {

                const updatedContacts = await getContacts();

                setContacts(updatedContacts);

            } catch (error) {

                console.error("Failed to update contacts from realtime event", error);

            }

        });



        const savedOrdersSub = subscribeToSavedOrders(async () => {

            console.log('[App] 🔔 Evento Realtime: Mudança em saved_orders detectada');

            try {

                const orders = await getSavedOrders(30); // Mantido em 30 dias - consistente com carga inicial para otimização

                setSavedOrders(orders);

                // Forçar refetch também dos arquivados se necessário, mas geralmente o foco é no que está ativo

                const archived = await getArchivedOrders();

                setArchivedSavedOrders(archived);

            } catch (error) {

                console.error("Failed to update saved orders from realtime event", error);

            }

        });







        const backordersSub = subscribeToBackorderedItems(async () => {

            console.log('[App] 🔔 Evento Realtime: Mudança em backordered_items detectada');

            try {

                const [backordered, resolved] = await Promise.all([

                    getBackorderedItems(),

                    getResolvedBackorderedItems()

                ]);

                setBackorderedItems(backordered);

                setResolvedItems(resolved);

            } catch (error) {

                console.error("Failed to update backordered items from realtime event", error);

            }

        });



        const verificationSub = subscribeToVerificationStatus(async () => {

            console.log('[App] 🔔 Evento Realtime: Mudança em verification_status detectada');

            try {

                const verification = await getVerificationStatus();

                setVerificationStatus(verification);

            } catch (error) {

                console.error("Failed to update verification status from realtime event", error);

            }

        });



        return () => {

            contactsSub.unsubscribe();

            savedOrdersSub.unsubscribe();

            backordersSub.unsubscribe();

            verificationSub.unsubscribe();

        };

    }, []);



    // Real-time subscription for spreadsheet data (new orders from Tiny ERP webhook)

    React.useEffect(() => {

        const playNotificationSound = () => {
            try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();

                osc1.connect(gain1);
                gain1.connect(ctx.destination);

                osc1.type = 'square';
                osc1.frequency.setValueAtTime(988, ctx.currentTime); // B5
                osc1.frequency.setValueAtTime(1319, ctx.currentTime + 0.08); // E6

                gain1.gain.setValueAtTime(0.1, ctx.currentTime);
                gain1.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.08);
                gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3); // Fade out

                osc1.start();
                osc1.stop(ctx.currentTime + 0.3);
            } catch (error) {
                console.error('Error playing sound:', error);
            }
        };



        const channel = subscribeToSpreadsheetChanges(async (payload) => {

            if (payload.eventType === 'INSERT') {



                // Play notification sound

                playNotificationSound();



                // Update order count

                setNewOrdersCount(prev => prev + 1);

                setShowNotification(true);



                // Hide notification after 5 seconds

                setTimeout(() => setShowNotification(false), 5000);



                // Invalidate query to trigger background refetch

                queryClient.invalidateQueries({ queryKey: ['spreadsheetData'] });

            }

        });



        return () => {

            channel.unsubscribe();

        };

    }, [data, headers]);



    // Real-time subscription for queue changes (orders waiting to be processed)

    React.useEffect(() => {

        const channel = subscribeToQueueChanges((payload) => {

            if (payload.eventType === 'INSERT') {

                // Notify that something is being processed

                setSyncProgress(prev => ({

                    ...prev,

                    isVisible: true,

                    status: 'processing',

                    message: 'Sincronizando novo pedido recebido...',

                    percentage: 10,

                    isMinimized: true // Keep it discreet

                }));



                // Auto-close after a while if no further updates

                setTimeout(() => {

                    setSyncProgress(prev => {

                        if (prev.status === 'processing' && prev.message === 'Sincronizando novo pedido recebido...') {

                            return { ...prev, isVisible: false };

                        }

                        return prev;

                    });

                }, 15000);

            }

        });



        return () => {

            channel.unsubscribe();

        };

    }, []);



    // Apply theme and page title to the document

    React.useEffect(() => {

        if (theme === 'dark') {

            document.documentElement.classList.add('dark');

        } else {

            document.documentElement.classList.remove('dark');

        }

        localStorage.setItem('theme', theme);

    }, [theme]);



    React.useEffect(() => {

        document.title = VIEW_TITLES[currentView];

    }, [currentView]);



    // Global keyboard shortcuts

    React.useEffect(() => {

        const handleGlobalKeyPress = (e: KeyboardEvent) => {

            const target = e.target as HTMLElement;

            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;



            // / - Focus search (if not in input)

            if (e.key === '/' && !isInput) {

                e.preventDefault();

                const searchInput = document.querySelector('input[placeholder*="Buscar"]') as HTMLInputElement;

                searchInput?.focus();

            }



            // Numbers 1-9 - Navigate between views (if not in input)

            if (!isInput && !e.ctrlKey && !e.altKey && /^[1-9]$/.test(e.key)) {

                const views: View[] = ['dashboard', 'pedidos', 'montar-pedido', 'data', 'separacao', 'atrasados', 'estampas', 'capinhas', 'pagamento'];

                const index = parseInt(e.key) - 1;

                if (views[index]) {

                    e.preventDefault();

                    setCurrentView(views[index]);

                }

            }

        };



        window.addEventListener('keydown', handleGlobalKeyPress);

        return () => window.removeEventListener('keydown', handleGlobalKeyPress);

    }, []);





    const handleThemeToggle = () => {

        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));

    };



    const handleViewChange = React.useCallback((newView: View, subView?: string) => {

        if (subView) {

            setSubViewHistory(prev => ({ ...prev, [newView]: subView }));

        }

        setCurrentView(newView);

        if (newView !== 'data') {

            setInitialFilterForDataTable(null);

        }

    }, [setSubViewHistory, setCurrentView, setInitialFilterForDataTable]);





    const handleDelayRulesUpdate = async (newRules: DelayRules) => {

        setDelayRules(newRules);

        // Save to Supabase (assuming 'default' store for now or iterating)

        try {

            for (const [store, rule] of Object.entries(newRules)) {

                await saveDelayRule(store, rule);

            }

            showModal('alert', 'Sucesso', 'Regras de atraso para estampas foram atualizadas!');

        } catch (error) {

            console.error("Failed to save delay rules:", error);

            showModal('alert', 'Erro', 'Erro ao salvar regras de atraso.');

        }

    };



    const handleSaveContact_Deprecated = async (contactToSave: Contact) => {

        try {

            const saved = await saveContact(contactToSave);

            setContacts(prev => {

                const existingIndex = prev.findIndex(c => c.id === saved.id);

                if (existingIndex > -1) {

                    const newContacts = [...prev];

                    newContacts[existingIndex] = saved;

                    return newContacts;

                } else {

                    return [...prev, saved];

                }

            });

            showModal('alert', 'Sucesso', 'Contato salvo com sucesso!');

        } catch (error) {

            console.error(error);

            showModal('alert', 'Erro', 'Erro ao salvar contato.');

        }

    };



    const handleDeleteContact_Deprecated = async (contactId: string) => {

        try {

            await deleteContact(contactId);

            setContacts(prev => prev.filter(c => c.id !== contactId));

            showModal('alert', 'Sucesso', 'Contato removido com sucesso!');

        } catch (error) {

            console.error(error);

            showModal('alert', 'Erro', 'Erro ao remover contato.');

        }

    };







    const handleImageMappingsUpdate = async (newMappings: Record<string, string>, newPrintNames?: Record<string, string>) => {

        const updatedMappings = { ...imageMappings, ...newMappings };

        setImageMappings(updatedMappings);



        // Also update print names if provided

        if (newPrintNames) {

            const newEstampasStatus = { ...estampasStatus };

            let hasChanges = false;



            Object.entries(newPrintNames).forEach(([sku, printName]) => {

                // If the row exists (or we can assume SKU maps to ID in many cases), update it

                // Note: estampasStatus key corresponds to row.id

                // We attempt to update matches. If row.id is unknown we might store it by SKU.

                // Estampas logic normally keys by row.id.



                // Try to find if 'sku' matches an ID in our data

                // Since this is a "blind" update from Drive, we might need to rely on the fact that

                // for many items, ID == SKU or ID contains SKU.



                // Ideally, we iterate existing keys or just set it.

                // Given the current architecture, let's update by SKU key directly, 

                // assuming the 'sku' from mapping is the ID used in estampasStatus.



                if (newEstampasStatus[sku]) {

                    newEstampasStatus[sku] = { ...newEstampasStatus[sku], nomeEstampa: printName };

                    hasChanges = true;

                    saveEstampasStatus(sku, { nomeEstampa: printName }).catch(console.error);

                } else {

                    // If it doesn't exist in status yet, we create it.

                    // The row might exist in "data" but not "status".

                    newEstampasStatus[sku] = { nomeEstampa: printName };

                    hasChanges = true;

                    saveEstampasStatus(sku, { nomeEstampa: printName }).catch(console.error);

                }

            });



            if (hasChanges) {

                // Not calling setEstampasStatus as it's handled by the hook and persistence now

                console.log('[App] Local changes to estampas names from Drive detected. Use saveEstampasStatus to persist.');

            }

        }



        try {

            // Save each new mapping to Supabase

            const promises = Object.entries(newMappings).map(([sku, url]) =>

                saveImageMapping(sku, url, imageCategoryAssignments[sku] || null)

            );

            await Promise.all(promises);



            let successMsg = `${Object.keys(newMappings).length} mapeamentos de imagem foram adicionados/atualizados.`;

            if (newPrintNames && Object.keys(newPrintNames).length > 0) {

                successMsg += `\n${Object.keys(newPrintNames).length} nomes de estampas foram extraídos.`;

            }



            showModal('alert', 'Sucesso', successMsg);

        } catch (error) {

            console.error("Failed to save image mappings:", error);



            // Extract proper error message from various error formats

            let errorMessage = 'Erro desconhecido';

            if (error && typeof error === 'object') {

                if ('message' in error) {

                    errorMessage = (error as any).message;

                } else if ('error' in error) {

                    errorMessage = (error as any).error;

                } else {

                    errorMessage = JSON.stringify(error);

                }

            } else if (typeof error === 'string') {

                errorMessage = error;

            }



            showModal('alert', 'Erro', `Erro ao salvar mapeamentos de imagem:\n\n${errorMessage}\n\nVerifique o console para mais detalhes.`);

        }

    };



    const handleUpdateDelayRules = async (newRules: DelayRules) => {
        setDelayRules(newRules);
        try {
            // Save each rule to Supabase
            const promises = Object.entries(newRules).map(([store, rule]) =>
                saveDelayRule(store, rule.onTime, rule.atRisk)
            );
            await Promise.all(promises);
            toast.success('Regras de atraso atualizadas com sucesso!');
        } catch (error) {
            console.error("Failed to save delay rules:", error);
            toast.error('Erro ao salvar regras de atraso.');
        }
    };

    const handleAddCategory = async (category: ImageCategory) => {

        setImageCategories(prev => [...prev, category]);

        try {

            await saveImageCategory(category);

        } catch (error) {

            console.error("Failed to save image category:", error);

        }

    };



    const handleDeleteCategory = async (categoryId: string) => {

        setImageCategories(prev => prev.filter(c => c.id !== categoryId));

        try {

            await deleteImageCategory(categoryId);

        } catch (error) {

            console.error("Failed to delete image category:", error);

        }

    };



    const handleAssignImageToCategory = async (imageId: string, categoryId: string | null) => {

        setImageCategoryAssignments(prev => ({ ...prev, [imageId]: categoryId }));

        try {

            const url = imageMappings[imageId];

            if (url) {

                await saveImageMapping(imageId, url, categoryId);

            }

        } catch (error) {

            console.error("Failed to save image assignment:", error);

        }

    };







    const handleSaveVerification = async (orderId: string, status: VerificationStatus) => {

        const newStatus = { ...verificationStatus, [orderId]: status };

        setVerificationStatus(newStatus);

        try {

            await saveVerificationStatus(orderId, status);

        } catch (error) {

            console.error("Failed to save verification status:", error);

        }

    };



    const handleAddBrand = async (brand: string) => {

        setPhoneCaseModels(prev => ({ ...prev, [brand]: [] }));

    };



    const handleDeleteBrand = async (brand: string) => {

        const models = phoneCaseModels[brand] || [];

        for (const model of models) {

            await removePhoneCaseModel(brand, model.name);

        }

        setPhoneCaseModels(prev => {

            const newState = { ...prev };

            delete newState[brand];

            return newState;

        });

    };



    const handleAddModel = async (brand: string, model: string) => {

        await addPhoneCaseModel(brand, model);

        setPhoneCaseModels(prev => {

            const brandModels = prev[brand] || [];

            const newModel = { name: model, inStock: true };

            return { ...prev, [brand]: [...brandModels, newModel].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) };

        });

    };



    const handleDeleteModel = async (brand: string, model: string) => {

        const trimmedBrand = brand.trim();

        const trimmedModel = model.trim();



        // Optimistic update

        setPhoneCaseModels(prev => ({

            ...prev,

            [trimmedBrand]: (prev[trimmedBrand] || []).filter(m => m.name !== trimmedModel)

        }));



        try {

            await removePhoneCaseModel(trimmedBrand, trimmedModel);

        } catch (error) {

            console.error("Failed to delete model:", error);

            showModal('alert', 'Erro', 'Falha ao deletar modelo. Por favor, tente novamente.');

            // Note: In a full implementation we would rollback state here

        }

    };



    const handleToggleStock = async (brand: string, modelName: string) => {

        const brandModels = phoneCaseModels[brand] || [];

        const model = brandModels.find(m => m.name === modelName);

        if (model) {

            const newStock = !model.inStock;

            await updatePhoneCaseModel(brand, modelName, newStock);

            setPhoneCaseModels(prev => ({

                ...prev,

                [brand]: prev[brand].map(m => m.name === modelName ? { ...m, inStock: newStock } : m)

            }));

        }

    };



    const handleEditModel = async (oldBrand: string, oldModel: string, newBrand: string, newModel: string) => {

        try {

            const trimmedOldBrand = oldBrand.trim();

            const trimmedOldModel = oldModel.trim();

            const trimmedNewBrand = newBrand.trim();

            const trimmedNewModel = newModel.trim();



            if (trimmedOldBrand === trimmedNewBrand && trimmedOldModel === trimmedNewModel) return;



            if (trimmedOldBrand === trimmedNewBrand) {

                // Rename only

                await renamePhoneCaseModel(trimmedOldBrand, trimmedOldModel, trimmedNewModel);

                setPhoneCaseModels(prev => {

                    const next = { ...prev };

                    if (next[trimmedOldBrand]) {

                        next[trimmedOldBrand] = next[trimmedOldBrand].map(m => m.name === trimmedOldModel ? { ...m, name: trimmedNewModel } : m)

                            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

                    }

                    return next;

                });

            } else {

                // Move (and optionally rename)

                await movePhoneCaseModel(trimmedOldBrand, trimmedOldModel, trimmedNewBrand, trimmedNewModel);



                setPhoneCaseModels(prev => {

                    const next = { ...prev };



                    // Remove from old

                    if (next[trimmedOldBrand]) {

                        // Find the original model data to preserve stock status

                        const originalModelData = next[trimmedOldBrand].find(m => m.name === trimmedOldModel);

                        const inStock = originalModelData ? originalModelData.inStock : true;



                        next[trimmedOldBrand] = next[trimmedOldBrand].filter(m => m.name !== trimmedOldModel);



                        // Add to new

                        if (!next[trimmedNewBrand]) next[trimmedNewBrand] = [];



                        next[trimmedNewBrand] = [...next[trimmedNewBrand], { name: trimmedNewModel, inStock }]

                            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

                    }

                    return next;

                });

            }



            showModal('alert', 'Sucesso', 'Modelo atualizado com sucesso!');

        } catch (error) {

            console.error("Error editing model:", error);

            showModal('alert', 'Erro', 'Erro ao editar modelo.');

        }

    };

    // If so, we should probably use add/remove functions instead of bulk update.

    // But if it's a bulk update, we might need to sync diffs.

    // For now, let's assume this is only called when we want to update local state after an operation?

    // Or is it used by a component that edits the whole list?

    // Checking Capinhas.tsx might be needed.

    // But for safety, let's not overwrite DB with this unless we are sure.

    // Actually, phoneCaseService has add/remove. 

    // If this is just setting state, we might not need to save to DB if the individual actions already did.

    // Let's check usage.

    // For now, just set state.





    const handlePriceTableUpdate = (newPriceTable: PriceProduct[]) => {

        setPriceTable(newPriceTable);

    };



    const handleSavePriceTable = async () => {

        try {

            await savePriceTable(priceTable);

        } catch (error) {

            console.error("Failed to save price table:", error);

            throw error; // Re-throw to let component handle UI feedback if needed

        }

    };



    const handleStoresUpdate = (newStores: Store[]) => {

        // Identify deleted stores

        const newStoreNames = new Set(newStores.map(s => s.name));

        const storesToDelete = stores.filter(s => !newStoreNames.has(s.name));



        storesToDelete.forEach(s => deleteStore(s.name).catch(console.error));

        newStores.forEach(s => saveStore(s).catch(console.error));



        setStores(newStores);

    };





    const fileList = Object.keys(data);

    const isDataLoaded = allRows.length > 0;



    const { skuHeader, idVendaHeader, quantidadeHeader, nomeHeader, dataHeader, valorUnitarioHeader, situacaoHeader, valorFreteHeader, valorDescontoHeader, outrasDespesasHeader } = React.useMemo(() => {

        const findConcept = (concepts: string[]) => {

            const normalizedConcepts = concepts.map(c => normalizeString(c));

            return headers.find(h => {

                const normH = normalizeString(h);

                return normalizedConcepts.some(concept => normH.includes(concept) || concept.includes(normH));

            });

        };



        return {

            skuHeader: findConcept(['sku', 'codigo', 'código']),

            idVendaHeader: findConcept(['numero da ordem de compra', 'id pedido', 'referencia do pedido', 'identificador']),

            quantidadeHeader: findConcept(['quantidade', 'qt.', 'qt', 'unidades']),

            nomeHeader: findConcept(['nome', 'nome do contato', 'cliente', 'contato']),

            dataHeader: findConcept(['data', 'emissão']),

            valorUnitarioHeader: findConcept(['valor unitario', 'valor unitário', 'preço', 'preco', 'unitário']),

            situacaoHeader: findConcept(['situacao', 'situação', 'status']),

            valorFreteHeader: findConcept(['valor frete', 'frete', 'envio']),

            valorDescontoHeader: findConcept(['valor do desconto', 'valor desconto', 'desconto']),

            outrasDespesasHeader: findConcept(['outras despesas', 'custo extra']),

        };

    }, [headers]);



    const allSkuProductNames = React.useMemo(() => {

        if (!skuHeader) return [];

        const productNames = new Set<string>();

        allRows.forEach(row => {

            const sku = String(row[skuHeader] ?? '');

            const parsedSku = parseSku(sku);

            if (parsedSku?.productName) {

                productNames.add(parsedSku.productName);

            }

        });

        return Array.from(productNames).sort();

    }, [allRows, skuHeader]);



    // Auto-associate Price Table Logic

    React.useEffect(() => {

        if (allSkuProductNames.length === 0 || priceTable.length === 0) return;



        let updated = false;

        const newPriceTable = priceTable.map(p => {

            if (!p.skuProductName) {

                const normalizedTableProductName = normalizeString(p.product);

                // Try exact match first

                let matchingSkuName = allSkuProductNames.find(skuName => normalizeString(skuName) === normalizedTableProductName);



                // If not found, try contains

                if (!matchingSkuName) {

                    matchingSkuName = allSkuProductNames.find(skuName => normalizeString(skuName).includes(normalizedTableProductName) || normalizedTableProductName.includes(normalizeString(skuName)));

                }



                if (matchingSkuName) {

                    updated = true;

                    return { ...p, skuProductName: matchingSkuName };

                }

            }

            return p;

        });



        if (updated) {

            setPriceTable(newPriceTable);

            // localStorage.setItem('priceTableProducts', JSON.stringify(newPriceTable));

            savePriceTable(newPriceTable).catch(console.error);

        }

    }, [allSkuProductNames, priceTable]);



    const roupasSkuProductNames = React.useMemo(() => {

        if (!skuHeader) return [];

        const productNames = new Set<string>();

        allRows.forEach(row => {

            const sku = String(row[skuHeader] ?? '');

            if (getCategory(sku) === 'Roupas') {

                const parsedSku = parseSku(sku);

                if (parsedSku?.productName) {

                    productNames.add(parsedSku.productName);

                }

            }

        });

        return Array.from(productNames).sort();

    }, [allRows, skuHeader]);



    const masterData = React.useMemo(() => {

        if (!skuHeader) return { colors: [], sizes: [] };

        const allColors = new Set<string>(Object.values(getColorMap()));

        const allSizes = new Set<string>();

        allRows.forEach(row => {

            const sku = String(row[skuHeader] ?? '');

            const parsed = parseSku(sku);

            if (parsed) {

                if (parsed.colorName !== 'N/A') allColors.add(parsed.colorName);

                if (parsed.sizeName !== 'N/A') parsed.sizeName.split('/').forEach(s => allSizes.add(s));

            }

        });



        return {

            colors: Array.from(allColors).sort(),

            sizes: sortSizes(Array.from(allSizes)),

        }

    }, [allRows, skuHeader]);



    const roupasMasterData = React.useMemo(() => {

        if (!skuHeader) return { colors: [], sizes: [] };

        const allColors = new Set<string>(Object.values(getColorMap()));

        const allSizes = new Set<string>();

        allRows.forEach(row => {

            const sku = String(row[skuHeader] ?? '');

            if (getCategory(sku) === 'Roupas') {

                const parsed = parseSku(sku);

                if (parsed) {

                    if (parsed.colorName !== 'N/A') allColors.add(parsed.colorName);

                    if (parsed.sizeName !== 'N/A') parsed.sizeName.split('/').forEach(s => allSizes.add(s));

                }

            }

        });



        return {

            colors: Array.from(allColors).sort((a, b) => a.localeCompare(b)),

            sizes: sortSizes(Array.from(allSizes)),

        }

    }, [allRows, skuHeader]);







    // Backorder Lookups for visual badges

    const backorderStatusMap = React.useMemo(() => {

        const map: Record<string, { isBackordered: boolean; isResolved: boolean; store?: string; backorderDate?: string }> = {};



        backorderedItems.forEach(item => {

            const orderId = String(item.originalRow[idVendaHeader!] || '');

            if (orderId) {

                map[orderId] = { isBackordered: true, isResolved: false, store: item.store, backorderDate: item.backorderDate };

            }

        });



        resolvedItems.forEach(item => {

            const orderId = String(item.originalRow[idVendaHeader!] || '');

            if (orderId) {

                map[orderId] = { isBackordered: false, isResolved: true, store: item.store, backorderDate: item.backorderDate };

            }

        });



        return map;

    }, [backorderedItems, resolvedItems, idVendaHeader]);



    const allProcessedData = React.useMemo(() => {

        const getVal = (row: TableRow, concepts: string[], fallbackHeader?: string) => {

            // Priority 1: Exact match with current headers (if provided)

            if (fallbackHeader && row[fallbackHeader] !== undefined) return row[fallbackHeader];



            // Priority 2: Concept matching

            const keys = Object.keys(row);

            const normalizedConcepts = concepts.map(c => normalizeString(c));

            const bestKey = keys.find(k => {

                const normK = normalizeString(k);

                return normalizedConcepts.some(c => normK.includes(c) || c.includes(normK));

            });

            return bestKey ? row[bestKey] : undefined;

        };



        const mappedData = allRows.map(row => {

            // Robust Field Extraction

            // Robust Field Extraction

            const sku = String(getVal(row, ['sku', 'codigo', 'código'], skuHeader) ?? '');

            const _idVenda = String(getVal(row, ['numero da ordem de compra', 'id pedido', 'referencia do pedido', 'identificador'], idVendaHeader) ?? '');

            const originalStatus = String(getVal(row, ['situacao', 'situação', 'status'], situacaoHeader) ?? '');

            const normalizedStatus = normalizeString(originalStatus);



            // Unified Name Logic (Merging synonym columns)

            const _nome = String(getVal(row, ['nome', 'nome do contato', 'cliente', 'contato'], nomeHeader) ?? '');



            // Unified Status Logic

            let _unifiedStatus = originalStatus;

            if (['preparando envio', 'faturado', 'em aberto', 'aprovado', 'pronto para envio', 'pendente', 'processando', 'a enviar'].some(s => normalizedStatus.includes(s))) {

                _unifiedStatus = 'Aprovado';

            }



            const parsedSku = parseSku(sku);

            const _productName = parsedSku?.productName || '';

            const _colorName = parsedSku?.colorName || 'N/A';

            const _sizeName = parsedSku?.sizeName || 'N/A';



            // Ecommerce Store Calculation

            let companyIdentifier: 'MM' | 'MVF' | null = null;

            const rawCnpj = String(row['CNPJ'] || row['cnpj'] || '').replace(/\D/g, ''); // Remove all non-digits

            const rawEmpresa = String(row['Empresa'] || row['empresa'] || '');



            if (rawEmpresa === 'MM' || rawEmpresa === 'MVF') {

                companyIdentifier = rawEmpresa as 'MM' | 'MVF';

            } else if (rawCnpj.includes('25116514') || rawCnpj === 'MVF') {

                companyIdentifier = 'MVF';

            } else if (rawCnpj.includes('39447291')) {

                companyIdentifier = 'MM';

            } else if (rawCnpj) {

                // Fallback attempt

                companyIdentifier = 'MM';

            }



            const existingCanal = String(row['Canal'] || row['canal'] || '').trim();

            const _ecommerceStore = getSalesChannel(_idVenda, companyIdentifier, existingCanal);



            const _skuDescription = sku ? transformSku(sku) : 'SKU não encontrado';

            const _categoryDisplay = sku ? `${getCategory(sku)}${isPersonalizado(sku) ? ' (Personalizado)' : ''}` : '';



            // Robust Quantity and Price Extraction

            const rawQty = getVal(row, ['quantidade', 'qt.', 'qt', 'unidades'], quantidadeHeader);

            const rawPrice = getVal(row, ['valor unitario', 'valor unitário', 'preço', 'preco', 'unitário'], valorUnitarioHeader);



            const _effectiveQuantity = getEffectiveQuantity(sku, String(rawQty ?? '1'));

            const valorUnitario = cleanAndParse(rawPrice ?? '0');

            const originalQuantity = cleanAndParse(rawQty ?? '1');

            const _valorTotal = originalQuantity * valorUnitario;



            const _isCancelled = normalizedStatus.includes('cancelado');

            const _isKit = isKit(sku);



            // Backorder flags

            const boStatus = backorderStatusMap[_idVenda];



            const rowId = row._supabaseId || row.id;

            const deterministicId = _idVenda && sku ? `tiny-${_idVenda}-${sku}` : null;



            // CRITICAL FIX: ALWAYS prefer deterministicId if available to ensure persistent deletions

            const finalUniqueId = deterministicId || row._uniqueId || (rowId ? String(rowId) : `row-${Date.now()}-${Math.random()}`);



            return {

                ...row,

                _uniqueId: finalUniqueId,

                _supabaseId: row._supabaseId || rowId, // Ensure it's preserved if it comes as 'id' from some source

                cnpj: companyIdentifier || row.cnpj, // Override CNPJ with calculated identifier (content-based detection)

                _unifiedStatus, // Add internal unified status

                [nomeHeader!]: _nome, // Merge names into the primary Nome column

                _idVenda,

                _ecommerceStore,

                _skuDescription,

                _categoryDisplay,

                _effectiveQuantity,

                _valorTotal,

                _isCancelled,

                _isKit,

                _productName,

                _colorName,

                _sizeName,

                _nome, // Also provide a dedicated _nome field for internal use

                _isBackordered: boStatus?.isBackordered || false,

                _isBackorderResolved: boStatus?.isResolved || false,
                _backorderStore: boStatus?.store,
                _backorderDate: boStatus?.backorderDate,
                _skuOriginal: sku,
                _isPersonalizado: isPersonalizado(sku),
                _deadline: (() => {
                    if (!row[dataHeader!] || !String(row[dataHeader!]).includes('/')) return null;
                    try {
                        const [d, m, y] = String(row[dataHeader!]).split('/').map(Number);
                        const orderDate = new Date(y, m - 1, d);
                        const isPerso = isPersonalizado(sku);
                        // Se for personalizado, tenta buscar a regra "Personalizados", senão usa padrão de 7 dias úteis
                        const rule = isPerso 
                            ? (delayRules['Personalizados'] || { onTime: 7, atRisk: 10 }) 
                            : (delayRules[_ecommerceStore] || delayRules.default || { onTime: 4, atRisk: 6 });
                        
                        const deadlineDate = addBusinessDays(orderDate, rule.onTime);
                        return `${String(deadlineDate.getDate()).padStart(2, '0')}/${String(deadlineDate.getMonth() + 1).padStart(2, '0')}/${deadlineDate.getFullYear()}`;
                    } catch (e) {
                        return null;
                    }
                })(),



                // Standardized Keys for Pedidos Screen

                id: _idVenda,

                data: String(row[dataHeader!] || ''),

                situacao: originalStatus,

                nome: _nome,

                produto: _productName,

                tamanho: _sizeName,

                cor: _colorName,

                quantidade: originalQuantity,

                valor_unitario: valorUnitario,

                canal: _ecommerceStore,

                categoria: getCategory(sku)

            } as ProcessedTableRow;

        });



        // Deduplication Logic

        const seenKeys = new Set<string>();



        return mappedData.filter(row => {

            // Apply GLOBAL CUTOFF early

            if (dataHeader && !isAfterCutoff(String(row[dataHeader]))) return false;



            // Deduplicate

            const id = row._idVenda;

            // Only deduplicate if we have a valid Order ID. Avulso/Manual rows might lack IDs.

            if (id && id.length > 3) {

                const sku = String(row[skuHeader!] || '');

                const qty = row._effectiveQuantity;

                const total = row._valorTotal;



                // Content-based key: ID + SKU + Qty + Total

                const key = `${id}|${sku}|${qty}|${total}`;



                if (seenKeys.has(key)) {

                    return false;

                }

                seenKeys.add(key);

            }



            return true;

        }).sort((a, b) => {

            const dateA = String(a[dataHeader!] || '');

            const dateB = String(b[dataHeader!] || '');



            const toSortingKey = (d: string) => {

                const p = d.trim().split('/');

                if (p.length === 3) {

                    // DD/MM/YYYY or DD/MM/YY

                    let year = p[2];

                    if (year.length === 2) year = `20${year}`;

                    return `${year}${p[1].padStart(2, '0')}${p[0].padStart(2, '0')}`;

                }

                if (p.length === 2) {

                    // DD/MM

                    const currentYear = new Date().getFullYear();

                    return `${currentYear}${p[1].padStart(2, '0')}${p[0].padStart(2, '0')}`;

                }

                return '00000000';

            };



            return toSortingKey(dateB).localeCompare(toSortingKey(dateA)) || String(b._idVenda || '').localeCompare(String(a._idVenda || ''), undefined, { numeric: true });
        });


    }, [allRows, skuHeader, idVendaHeader, quantidadeHeader, valorUnitarioHeader, situacaoHeader, dataHeader, backorderStatusMap]);







    const globalFilteredData = React.useMemo(() => {

        const { categoria, personalizado, canal, kit, produto, ...otherFilters } = globalFilters;

        const normalizedSearch = normalizeString(globalSearchTerm);



        return allProcessedData.filter(row => {

            // 1. CNPJ Filter (Existing logic from App.tsx)

            if (selectedCnpj !== 'Todos' && row.cnpj !== selectedCnpj) return false;



            // 2. Date Range Filter (Global Cutoff is already applied in allProcessedData)

            if (dataHeader) {

                const comparableDate = toComparableDate(String(row[dataHeader]));



                if (comparableDate) {

                    if (dateRange.start && comparableDate < dateRange.start) return false;

                    if (dateRange.end && comparableDate > dateRange.end) return false;

                }

            }



            // 3. Status Filter (Complex logic from Pedidos.tsx)

            const situacao = String(row[situacaoHeader!] ?? '').toLowerCase();

            const situacaoValues = situacaoHeader ? (globalFilters[situacaoHeader] as string[]) : undefined;



            // Default exclusion of cancelled and incomplete if no specific filters are applied

            if (!situacaoValues || situacaoValues.length === 0) {

                if (situacao.includes('cancelado') || situacao.includes('dados incompletos')) return false;

            } else {

                if (!situacaoValues.includes(String(row[situacaoHeader!]))) return false;

            }



            // 4. Other Specialized Filters

            if (canal && row._ecommerceStore !== canal) return false;

            if (produto && row._productName !== produto) return false;



            if (categoria) {

                const sku = String(row[skuHeader!] ?? '');

                if (getCategory(sku) !== categoria) return false;

            }



            if (kit) {

                if (kit === 'com' && !row._isKit) return false;

                if (kit === 'sem' && row._isKit) return false;

            }



            if (personalizado) {

                const isCustom = isPersonalizado(String(row[skuHeader!] ?? ''));

                if (personalizado === 'sim' && !isCustom) return false;

                if (personalizado === 'nao' && isCustom) return false;

            }



            // 5. Operational Filtering (Restricting to 'Aprovado' in operational views)

            const operationalViews: View[] = ['montar-pedido', 'estampas', 'capinhas', 'separacao'];

            if (operationalViews.includes(currentView)) {

                if (row._unifiedStatus !== 'Aprovado') return false;

            }



            // 6. Global Search Term

            if (normalizedSearch) {

                const searchFields = [

                    row._skuDescription,

                    row._idVenda,

                    String(row[nomeHeader!] ?? ''),

                    trackingMappings[row._idVenda] || ''

                ];

                if (!searchFields.some(field => normalizeString(field).includes(normalizedSearch))) return false;

            }



            // 6. Generic Header Filters

            const matchesOtherHeaders = Object.entries(otherFilters).every(([header, value]) => {

                if (!value || header === situacaoHeader) return true;

                return normalizeString(String(row[header] ?? '')) === normalizeString(String(value));

            });

            if (!matchesOtherHeaders) return false;



            return true;

        });

    }, [allProcessedData, globalFilters, globalSearchTerm, selectedCnpj, dateRange, dataHeader, situacaoHeader, skuHeader, nomeHeader, trackingMappings]);



    React.useEffect(() => {

        if (!isDataLoaded || !dataHeader) return;



        const dates = allRows

            .map(row => toComparableDate(String(row[dataHeader])))

            .filter((d): d is string => d !== null)

            .sort();



        if (dates.length > 0) {

            const minDate = dates[0];

            const maxDate = dates[dates.length - 1];

            setDateBoundaries({ min: minDate, max: maxDate });

            // Removed automatic date range initialization - let user set it manually

            // This was causing the filter counter to always show "1" on page load

            // if (!dateRange.start && !dateRange.end) {

            //     setDateRange({ start: minDate, end: maxDate });

            // }

        }

    }, [isDataLoaded, allRows, dataHeader, dateRange.start, dateRange.end]);





    const handleDeleteRow = React.useCallback(async (uniqueId: string | number) => {



        // Confirmation should ideally happen in the component, but we handle state update here

        setData(prevData => {

            const newData = JSON.parse(JSON.stringify(prevData));

            let supabaseId: string | number | null = null;

            let found = false;



            for (const fileName in newData) {

                const fileData = newData[fileName];

                const index = fileData.rows.findIndex((r: TableRow) =>

                    String(r._uniqueId) === String(uniqueId) ||

                    String(r._supabaseId) === String(uniqueId)

                );

                if (index !== -1) {

                    supabaseId = fileData.rows[index]._supabaseId;

                    fileData.rows.splice(index, 1);

                    found = true;

                    break;

                }

            }



            if (supabaseId) {

                deleteSpreadsheetRow(supabaseId).catch(err => {

                    console.error('Failed to delete from Supabase:', err);

                });

            }



            // Also add to global deletedOrderIds for persistence if it's a deterministic ID

            const stringId = String(uniqueId);

            setDeletedOrderIds(prev => new Set([...prev, stringId]));



            // Try to find orderId for context

            let orderId = 'manual';

            for (const fileName in newData) {

                const foundRow = newData[fileName].rows.find((r: TableRow) => String(r._uniqueId) === stringId);

                if (foundRow) {

                    orderId = String(foundRow[idVendaHeader!] || 'manual');

                    break;

                }

            }



            import('./services/deletedOrdersService').then(({ addDeletedOrder }) => {

                addDeletedOrder(stringId, orderId).catch(err =>

                    console.error('Failed to save deleted order persistence:', err)

                );

            });



            return newData;

        });

    }, [idVendaHeader]);



    const handleAddRow = React.useCallback(async (templateRow: TableRow, newSku: string, newQuantity: number) => {





        const orderId = String(templateRow[idVendaHeader!] || 'manual');

        const newRow: TableRow = {

            ...templateRow,

            _uniqueId: `row-manual-${orderId}-${newSku}-${Date.now()}`, // Manual rows still need some uniqueness but deterministic base

            _supabaseId: undefined, // Will be generated by Supabase

            _updatedFields: {},

            [skuHeader!]: newSku,

            [quantidadeHeader!]: newQuantity,

            _isEdited: true,

        };



        // If the template row has a specific CNPJ detection, preserve it

        // Note: _idVenda etc. are calculated in allProcessedData, so they will be recalculated



        setData(prevData => {

            const newData = JSON.parse(JSON.stringify(prevData));

            // Add to the same "file" as the template row if possible, or "Manual"

            let targetFileName = 'Manual Upload';

            for (const fileName in newData) {

                if (newData[fileName].rows.some((r: TableRow) => r._uniqueId === templateRow._uniqueId)) {

                    targetFileName = fileName;

                    break;

                }

            }



            if (!newData[targetFileName]) {

                newData[targetFileName] = { rows: [], importDate: new Date().toISOString() };

            }



            newData[targetFileName].rows.push(newRow);



            // Persist to Supabase

            insertSpreadsheetRow(targetFileName, newRow)

                .then(newSupabaseId => {

                    setData(currentData => {



                        const updated = JSON.parse(JSON.stringify(currentData));

                        const r = updated[targetFileName].rows.find((row: TableRow) => row._uniqueId === newRow._uniqueId);

                        if (r) r._supabaseId = newSupabaseId;

                        return updated;

                    });

                })

                .catch(err => console.error('Failed to insert new row into Supabase:', err));



            return newData;

        });

    }, [skuHeader, quantidadeHeader]);





    const handleBulkUpdateRows = React.useCallback(async (updates: { uniqueId: string | number, updatedFields: Partial<TableRow> }[]) => {

        setData(prevData => {



            const newData = JSON.parse(JSON.stringify(prevData));

            const supabaseUpdates: { id: string | number, fields: Partial<TableRow> }[] = [];



            updates.forEach(update => {

                const { uniqueId, updatedFields } = update;

                for (const fileName in newData) {

                    const fileData = newData[fileName];

                    const rowIndex = fileData.rows.findIndex((r: TableRow) =>

                        String(r._uniqueId) === String(uniqueId) ||

                        String(r._supabaseId) === String(uniqueId)

                    );

                    if (rowIndex !== -1) {

                        const originalRow = fileData.rows[rowIndex];

                        const updatedRow = { ...originalRow, ...updatedFields };

                        if (!updatedRow._updatedFields) updatedRow._updatedFields = {};

                        Object.keys(updatedFields).forEach(key => {

                            updatedRow._updatedFields![key] = true;

                        });

                        updatedRow._isEdited = true;

                        fileData.rows[rowIndex] = updatedRow;

                        if (originalRow._supabaseId) {

                            supabaseUpdates.push({ id: originalRow._supabaseId, fields: updatedFields });

                        }

                        break;

                    }

                }

            });



            supabaseUpdates.forEach(su => {

                updateSpreadsheetRow(su.id, su.fields).catch(err => console.error('Bulk update error:', err));

            });



            return newData;

        });

    }, []);



    const handleUpdateRow = React.useCallback(async (uniqueId: string | number, updatedFields: Partial<TableRow>) => {





        // Update local state

        setData(prevData => {

            const newData = JSON.parse(JSON.stringify(prevData)); // Deep copy to avoid mutation issues

            let found = false;

            let supabaseId: string | number | null = null;



            for (const fileName in newData) {

                const fileData = newData[fileName];

                const rowIndex = fileData.rows.findIndex((r: TableRow) =>

                    String(r._uniqueId) === String(uniqueId) ||

                    String(r._supabaseId) === String(uniqueId)

                );

                if (rowIndex !== -1) {

                    const originalRow = fileData.rows[rowIndex];

                    const updatedRow = { ...originalRow, ...updatedFields };



                    if (!updatedRow._updatedFields) updatedRow._updatedFields = {};

                    Object.keys(updatedFields).forEach(key => {

                        updatedRow._updatedFields![key] = true;

                    });

                    updatedRow._isEdited = true;



                    fileData.rows[rowIndex] = updatedRow;

                    supabaseId = originalRow._supabaseId;

                    found = true;

                    break;

                }

            }



            if (!found) {

                console.warn(`Could not find row with ID: ${uniqueId} to update.`);

            } else if (supabaseId) {

                // Update in Supabase if row has _supabaseId

                updateSpreadsheetRow(supabaseId, updatedFields).then(() => {

                    queryClient.invalidateQueries({ queryKey: ['spreadsheetData'] });

                }).catch(err => {

                    console.error('Failed to update Supabase:', err);

                });

            } else {

                // Row exists locally but not in Supabase - CREATE IT!

                console.warn('⚠️ Row não possui _supabaseId - CRIANDO no banco agora...');



                // Find the updated row to get all its data

                let fullRowData: any = null;

                for (const fileName in newData) {

                    const fileData = newData[fileName];

                    const row = fileData.rows.find((r: TableRow) => r._uniqueId === uniqueId);

                    if (row) {

                        fullRowData = { ...row };

                        delete fullRowData._uniqueId;

                        delete fullRowData._supabaseId;

                        delete fullRowData._updatedFields;

                        delete fullRowData._productName;

                        delete fullRowData._colorName;

                        delete fullRowData._sizeName;

                        delete fullRowData._idVenda;

                        delete fullRowData._ecommerceStore;

                        break;

                    }

                }



                if (fullRowData) {

                    insertSpreadsheetRow(fullRowData.filename || 'Manual Upload', fullRowData)

                        .then((newId) => {

                            // Update local state with new _supabaseId



                            setData(prevData => {

                                const updated = JSON.parse(JSON.stringify(prevData));

                                for (const fileName in updated) {

                                    const fileData = updated[fileName];

                                    const rowIndex = fileData.rows.findIndex((r: TableRow) => r._uniqueId === uniqueId);

                                    if (rowIndex !== -1) {

                                        fileData.rows[rowIndex]._supabaseId = newId;

                                        break;

                                    }

                                }

                                return updated;

                            });

                        })

                        .catch(err => {

                            console.error('Failed to insert into Supabase:', err);

                        });

                } else {

                    console.error('Could not find full row data to insert');

                }

            }



            return newData;

        });

    }, []);





    const handleFileUpload = React.useCallback(async (files: FileList) => {

        setIsLoading(true);

        setError(null);

        setInitialFilterForDataTable(null);



        const idHeaderForMap = headers.find(h => normalizeString(h).includes('numero da ordem de compra')) || 'numero da ordem de compra';

        const skuHForMap = headers.find(h => normalizeString(h).includes('sku')) || 'codigo (sku)';



        const nextData: Record<string, { rows: TableRow[], importDate: string }> = JSON.parse(JSON.stringify(data));

        const existingRowMap = new Map<string, TableRow>();

        Object.values(nextData).flatMap(d => d.rows).forEach((row: TableRow) => {

            const key = `${row[idHeaderForMap]}|${row[skuHForMap]}`;

            if (key !== 'undefined|undefined') {

                existingRowMap.set(key, row);

            }

        });



        const newOrOverwrittenFilesData: Record<string, { rows: TableRow[], importDate: string }> = {};

        const allNewHeaders = new Set<string>(headers);



        const uploadMessages: {

            updated: string[];

            duplicates: number;

            tracking: number;

            errors: string[];

        } = { updated: [], duplicates: 0, tracking: 0, errors: [] };



        const colorMap = getColorMap();

        const productMap = getProductMap();



        for (const file of Array.from(files)) {

            // Handle Tracking Sheet

            if (file.name.toLowerCase().startsWith('apenas a lista de empacotamento')) {

                try {

                    const { data: trackingRows, headers: trackingHeaders } = await parseSpreadsheet(file);



                    // Find headers dynamically

                    const rastreioHeader = trackingHeaders.find(h => {

                        const n = normalizeString(h);

                        return n.includes('rastreio') || n.includes('tracking') || n.includes('codigo') || n.includes('objeto');

                    }) || trackingHeaders[0];



                    const referenciaHeader = trackingHeaders.find(h => {

                        const n = normalizeString(h);

                        return n.includes('numero') || n.includes('pedido') || n.includes('referencia') || n.includes('venda');

                    }) || trackingHeaders[1];



                    if (!rastreioHeader || !referenciaHeader) {

                        throw new Error("Planilha de empacotamento não contém colunas identificáveis de Rastreio e Pedido.");

                    }



                    const newTrackingMappings: Record<string, string> = {};

                    let count = 0;

                    for (const row of trackingRows) {

                        const trackingCode = String(row[rastreioHeader] ?? '').trim();

                        const orderId = String(row[referenciaHeader] ?? '').trim();

                        if (trackingCode && orderId) {

                            newTrackingMappings[orderId] = trackingCode;

                            count++;

                        }

                    }



                    setTrackingMappings(prevMappings => {

                        const updated = { ...prevMappings, ...newTrackingMappings };

                        Object.entries(newTrackingMappings).forEach(([orderId, trackingCode]) => {

                            saveTrackingMapping(orderId, trackingCode).catch(console.error);

                        });

                        return updated;

                    });



                    uploadMessages.tracking += count;

                    continue; // Skip normal file processing

                } catch (err) {

                    const message = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';

                    uploadMessages.errors.push(`Erro no arquivo ${file.name}: ${message}`);

                    continue;

                }

            }



            // Normal File Processing

            try {

                const { data: parsedRows, headers: fileHeaders } = await parseSpreadsheet(file);

                const upperFileName = file.name.toUpperCase();



                // Improved robust CNPJ detection using regex

                const mmRegex = /(^|[^A-Z0-9])MM([^A-Z]|$)|SH.*?MM|SHOPEE.*?MM|^MM/i;

                const mvfRegex = /(^|[^A-Z0-9])MVF([^A-Z]|$)|SH.*?MVF|SHOPEE.*?MVF|^MVF/i;



                let currentFileCnpj: 'MM' | 'MVF' | undefined = undefined;



                if (mmRegex.test(upperFileName)) currentFileCnpj = 'MM';

                else if (mvfRegex.test(upperFileName)) currentFileCnpj = 'MVF';

                else if (upperFileName.startsWith('MM')) currentFileCnpj = 'MM'; // Fallback

                else if (upperFileName.startsWith('MVF')) currentFileCnpj = 'MVF'; // Fallback



                // Content-based detection if filename is ambiguous

                if (!currentFileCnpj && parsedRows.length > 0) {

                    const sampleRows = parsedRows.slice(0, 50); // Check first 50 rows

                    // Find likely CNPJ columns

                    const cnpjHeaders = fileHeaders.filter(h => {

                        const n = normalizeString(h);

                        return n.includes('cnpj') || n.includes('emitente') || n.includes('fornecedor') || n.includes('cpf');

                    });



                    for (const row of sampleRows) {

                        // If specific headers found, check them. Otherwise check all values.

                        const valuesToCheck = cnpjHeaders.length > 0

                            ? cnpjHeaders.map(h => row[h])

                            : Object.values(row);



                        const joined = valuesToCheck.map(v => String(v || '')).join(' ');

                        const cleaned = joined.replace(/\D/g, ''); // Remove non-generic chars



                        if (cleaned.includes('2511651400038')) {

                            currentFileCnpj = 'MVF'; // Found MVF CNPJ

                            console.log(`[CNPJ Detection] Identificado MVF via CNPJ no conteúdo do arquivo: ${file.name}`);

                            break;

                        }

                        // Future: Add MM CNPJ check here if known

                    }

                }



                const currentIdHeader = fileHeaders.find(h => normalizeString(h).includes('numero da ordem de compra')) || idHeaderForMap;

                const currentSkuHeader = fileHeaders.find(h => normalizeString(h).includes('sku')) || skuHForMap;

                const currentValorUnitarioHeader = fileHeaders.find(h => normalizeString(h).includes('valor unitario'));



                const finalRowsForThisFile: TableRow[] = [];

                const processedKeysInThisFile = new Set<string>();



                for (const newRow of parsedRows) {

                    const sku = String(newRow[currentSkuHeader] ?? '');

                    const lowerSku = sku.toLowerCase();

                    const kitMatch = lowerSku.match(/^kit(\d+)-/);



                    let rowsToProcess: TableRow[] = [];

                    let isMultiColorKit = false;



                    if (kitMatch) {

                        const numInKit = parseInt(kitMatch[1], 10);

                        const restOfSku = lowerSku.substring(kitMatch[0].length);

                        const parts = restOfSku.split('-');

                        let productSku = '';

                        let productEndIndex = -1;

                        for (const key in productMap) {

                            if (restOfSku.startsWith(key)) {

                                productSku = key;

                                productEndIndex = key.split('-').length;

                                break;

                            }

                        }

                        if (productSku) {

                            const remainingParts = parts.slice(productEndIndex);

                            const colorCodes: string[] = [];

                            let sizeStartIndex = -1;

                            for (let i = 0; i < remainingParts.length; i++) {

                                if (colorMap[remainingParts[i]]) {

                                    colorCodes.push(remainingParts[i]);

                                } else {

                                    sizeStartIndex = i;

                                    break;

                                }

                            }

                            if (sizeStartIndex !== -1 && colorCodes.length === numInKit) {

                                const sizeParts = remainingParts.slice(sizeStartIndex);

                                const sizeSku = sizeParts.join('-');

                                isMultiColorKit = true;

                                const originalValorUnitario = currentValorUnitarioHeader ? cleanAndParse(newRow[currentValorUnitarioHeader]!) : 0;

                                const newValorUnitario = (numInKit > 0) ? originalValorUnitario / numInKit : originalValorUnitario;

                                for (const colorCode of colorCodes) {

                                    const desmemberedSku = `${productSku}-${colorCode}-${sizeSku}`;

                                    const desmemberedRow = { ...newRow, [currentSkuHeader]: desmemberedSku, _originalSku: sku };

                                    if (currentValorUnitarioHeader) {

                                        desmemberedRow[currentValorUnitarioHeader] = newValorUnitario;

                                    }

                                    rowsToProcess.push(desmemberedRow);

                                }

                            }

                        }

                    }



                    if (!isMultiColorKit) {

                        rowsToProcess.push(newRow);

                    }



                    for (const rowToProcess of rowsToProcess) {

                        const orderId = String(rowToProcess[currentIdHeader]);

                        const processSku = String(rowToProcess[currentSkuHeader]);

                        const key = `${orderId}|${processSku}`;



                        if (processedKeysInThisFile.has(key)) continue;

                        processedKeysInThisFile.add(key);



                        if (existingRowMap.has(key)) {

                            const existingRow = existingRowMap.get(key)!;

                            let hasChanged = false;

                            const updatedFields: Record<string, boolean> = {};



                            const allComparedHeaders = new Set([...Object.keys(existingRow), ...Object.keys(rowToProcess)]);

                            allComparedHeaders.forEach(header => {

                                if (String(existingRow[header] ?? '') !== String(rowToProcess[header] ?? '')) {

                                    hasChanged = true;

                                    updatedFields[header] = true;

                                }

                            });



                            Object.assign(existingRow, rowToProcess);



                            // If we identified a CNPJ for the file, update the existing row

                            if (currentFileCnpj) {

                                existingRow.cnpj = currentFileCnpj;

                            }



                            if (hasChanged) {

                                if (currentIdHeader && existingRow[currentIdHeader]) {

                                    uploadMessages.updated.push(String(existingRow[currentIdHeader]));

                                }

                                if (!existingRow._updatedFields) existingRow._updatedFields = {};

                                Object.assign(existingRow._updatedFields, updatedFields);

                                if (currentIdHeader) existingRow._updatedFields[currentIdHeader] = true;

                            } else {

                                uploadMessages.duplicates++;

                            }



                            finalRowsForThisFile.push(existingRow);

                        } else {

                            const newRowWithMeta: TableRow = {

                                ...rowToProcess,

                                cnpj: currentFileCnpj,

                                _uniqueId: `row-${orderId}-${processSku}`

                            };

                            finalRowsForThisFile.push(newRowWithMeta);

                            existingRowMap.set(key, newRowWithMeta);

                        }

                    }

                }



                // Filter out orders before cutoff during extraction

                const currentFileDataHeader = fileHeaders.find(h => {

                    const n = normalizeString(h);

                    return n.includes('data') || n.includes('emissão');

                }) || dataHeader;



                const filteredFinalRows = finalRowsForThisFile.filter(row => {

                    if (!currentFileDataHeader) return true;

                    return isAfterCutoff(String(row[currentFileDataHeader]));

                });



                newOrOverwrittenFilesData[file.name] = { rows: filteredFinalRows, importDate: new Date().toISOString() };

                fileHeaders.forEach(h => allNewHeaders.add(h));



            } catch (err) {

                const message = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';

                uploadMessages.errors.push(`Erro no arquivo ${file.name}: ${message}`);

            }

        }



        Object.assign(nextData, newOrOverwrittenFilesData);

        setData(nextData);



        // --- Persistence Logic ---

        // Save to localStorage for fast access

        // Update localStorage (Sync cache)

        try {

            localStorage.setItem('spreadsheetData', JSON.stringify(nextData));

        } catch (e) {

            console.error("Failed to save to localStorage", e);

        }



        // Save to Supabase for backup

        Object.entries(newOrOverwrittenFilesData).forEach(([filename, fileData]) => {

            saveSpreadsheetData(filename, fileData.rows, fileData.importDate).catch(console.error);

        });

        // -------------------------

        setHeaders(Array.from(allNewHeaders));



        if (files.length > 0) {

            setCurrentView('dashboard');

        }



        let finalMessage = '';

        if (uploadMessages.tracking > 0) {

            finalMessage += `${uploadMessages.tracking} mapeamento(s) de rastreio foram carregados/atualizados.\n`;

        }

        if (uploadMessages.updated.length > 0) {

            const uniqueUpdatedIds = Array.from(new Set(uploadMessages.updated)).join(', ');

            finalMessage += `${uploadMessages.updated.length} linha(s) foram atualizadas com novos dados. IDs: ${uniqueUpdatedIds}. Campos alterados estão destacados em verde.\n`;

        }

        if (uploadMessages.duplicates > 0) {

            finalMessage += `${uploadMessages.duplicates} linha(s) duplicada(s) idênticas foram ignoradas.\n`;

        }

        if (uploadMessages.errors.length > 0) {

            finalMessage += `Erros:\n${uploadMessages.errors.join('\n')}`;

        }



        if (finalMessage) {

            setError(finalMessage.trim());

        }



        setIsLoading(false);

    }, [data, headers]);



    const triggerFileUpload = () => {

        fileInputRef.current?.click();

    };



    const handleClearData = React.useCallback(() => {

        setData({});

        setHeaders([]);

        setError(null);



        // --- Clear Persistence ---

        localStorage.removeItem('spreadsheetData');

        clearAllSpreadsheetData().catch(console.error);

        // -------------------------

        setCurrentView('upload');

        setCurrentSubView(null);

        setDateRange({ start: null, end: null });

        setDateBoundaries({});

        setSelectedCnpj('Todos');

        setGlobalSearchTerm('');

        setInitialFilterForDataTable(null);

        setBackorderedItems([]);

        setResolvedItems([]);

        setDuplicateRows([]);

        setEstampasStatus({});

        setSavedOrders([]);

        setArchivedSavedOrders([]);

        setPendingPayments([]);

        setArchivedPayments([]);

        setContacts([]);

        setImageMappings({});

        setImageCategories([]);

        setImageCategoryAssignments({});

        setVerificationStatus({});

        setPhoneCaseModels(defaultPhoneCaseModels);

        setTrackingMappings({});

        localStorage.removeItem('backorderedItems');

        localStorage.removeItem('resolvedItems');

        localStorage.removeItem('estampasStatus');

        localStorage.removeItem('savedOrders');

        localStorage.removeItem('archivedSavedOrders');

        localStorage.removeItem('pendingPayments');

        localStorage.removeItem('archivedPayments');

        localStorage.removeItem('contacts');

        localStorage.removeItem('imageMappings');

        localStorage.removeItem('imageCategories');

        localStorage.removeItem('imageCategoryAssignments');

        localStorage.removeItem('verificationStatus');

        localStorage.removeItem('phoneCaseModels');

        localStorage.removeItem('trackingMappings');

    }, []);



    const handleRemoveFile = React.useCallback((fileNameToRemove: string) => {

        setData(prevData => {

            const newData = { ...prevData };

            delete newData[fileNameToRemove];



            const remainingRows = Object.values(newData).flatMap((d: { rows: TableRow[] }) => d.rows);

            const newHeaders = new Set<string>();

            remainingRows.forEach(row => {

                Object.keys(row).forEach(key => newHeaders.add(key));

            });

            setHeaders(Array.from(newHeaders));



            if (Object.keys(newData).length === 0) {

                handleClearData();

            }



            return newData;

        });

    }, [handleClearData]);



    const calculateTotalsForGrid = (grid: Record<string, Record<string, number>>, forStore: string): OrderTotals => {

        let totalBranco = 0; let totalColorido = 0; let totalEspeciais = 0;

        const coresEspeciais = new Set(['vermelho', 'musgo', 'verde', 'royal', 'mescla']);

        Object.entries(grid).forEach(([color, sizeData]) => {

            const totalPorCor = Object.values(sizeData).reduce((sum, q) => sum + (Number(q) || 0), 0);

            const normalizedColor = normalizeString(color);

            if (forStore === 'GUSHI') {

                if (normalizedColor === 'branco') totalBranco += totalPorCor;

                else if (coresEspeciais.has(normalizedColor)) totalEspeciais += totalPorCor;

                else totalColorido += totalPorCor;

            } else {

                if (normalizedColor === 'branco') totalBranco += totalPorCor;

                else totalColorido += totalPorCor;

            }

        });

        return { totalBranco, totalColorido, totalEspeciais, totalGeral: totalBranco + totalColorido + totalEspeciais };

    };



    const handleSaveOrder = (order: Omit<SavedOrder, 'id'>) => {

        setSavedOrders(prevOrders => {

            const existingOrderIndex = prevOrders.findIndex(o =>

                o.product === order.product &&

                o.store === order.store &&

                o.cnpj === order.cnpj &&

                !o.hasMissingItems // Don't merge into 'faltante' orders

            );



            if (existingOrderIndex > -1) {

                const updatedOrders = [...prevOrders];

                const existingOrder = updatedOrders[existingOrderIndex]; // Get reference, don't spread



                const mergedQuantities = JSON.parse(JSON.stringify(existingOrder.quantities));



                Object.entries(order.quantities).forEach(([color, sizes]) => {

                    if (!mergedQuantities[color]) {

                        mergedQuantities[color] = {};

                    }

                    Object.entries(sizes).forEach(([size, qty]) => {

                        const currentQty = Number(mergedQuantities[color][size]) || 0;

                        const toAddQty = Number(qty) || 0;

                        mergedQuantities[color][size] = currentQty + toAddQty;

                    });

                });



                const mergedColors = Array.from(new Set([...existingOrder.colors, ...order.colors])).sort((a, b) => a.localeCompare(b));

                const mergedSizes = sortSizes(Array.from(new Set([...existingOrder.sizes, ...order.sizes])));

                const mergedTotals = calculateTotalsForGrid(mergedQuantities, order.store);

                const mergedSourceRowIds = Array.from(new Set([...(existingOrder._sourceRowIds || []), ...(order._sourceRowIds || [])]));



                const mergedOrder: SavedOrder = {

                    id: existingOrder.id,

                    product: existingOrder.product,

                    store: existingOrder.store,

                    cnpj: existingOrder.cnpj,

                    quantities: mergedQuantities,

                    colors: mergedColors,

                    sizes: mergedSizes,

                    totals: mergedTotals,

                    _sourceRowIds: mergedSourceRowIds,

                    hasMissingItems: existingOrder.hasMissingItems,

                    editedCells: existingOrder.editedCells,

                };



                updatedOrders[existingOrderIndex] = mergedOrder;

                // localStorage.setItem('savedOrders', JSON.stringify(updatedOrders));

                saveOrder(mergedOrder).catch(console.error);

                return updatedOrders;



            } else {

                const newOrderWithId: SavedOrder = { ...order, id: `${order.product}-${order.store}-${order.cnpj}-${Date.now()}-${Math.random()}` };

                const updatedOrders = [...prevOrders, newOrderWithId];

                // localStorage.setItem('savedOrders', JSON.stringify(updatedOrders));

                saveOrder(newOrderWithId).catch(console.error);

                return updatedOrders;

            }

        });

        setSelectedCnpj('Todos');

    };



    const handleDeleteOrder = async (orderIdToDelete: string) => {

        const idsToDelete = orderIdToDelete.split('+');



        console.log('[DELETE] Starting deletion process for IDs:', idsToDelete);



        // First, calculate what the new state should be (without merging yet)

        const indicesToDelete = new Set<number>();

        idsToDelete.forEach(id => {

            const idx = savedOrders.findIndex(o => o.id === id);

            if (idx > -1) indicesToDelete.add(idx);

        });



        if (indicesToDelete.size === 0) {

            console.log('[DELETE] No orders found to delete');

            return;

        }



        const ordersToDelete = savedOrders.filter((_, i) => indicesToDelete.has(i));

        console.log('[DELETE] Orders to delete:', ordersToDelete.map(o => ({ id: o.id, product: o.product, store: o.store })));



        // Process deletions and merges

        let ordersToKeep = savedOrders.filter((_, i) => !indicesToDelete.has(i));

        const ordersToUpdate: SavedOrder[] = [];

        const supabaseDeletionPromises: Promise<void>[] = [];



        for (const deletedOrder of ordersToDelete) {

            console.log('[DELETE] Processing order:', deletedOrder.id, 'hasMissingItems:', deletedOrder.hasMissingItems, 'product:', deletedOrder.product, 'store:', deletedOrder.store);

            let siblingIndex = -1;



            // First, try a very strict match.

            // CRITICAL: When deleting a FALTANTE (hasMissingItems=true), search for the original grade (hasMissingItems=false/undefined)

            // Use _originalStore if available (when FALTANTE was created in different store)

            const storeToMatch = deletedOrder.hasMissingItems && deletedOrder._originalStore

                ? deletedOrder._originalStore

                : deletedOrder.store;



            siblingIndex = ordersToKeep.findIndex(o =>

                o.product === deletedOrder.product &&

                o.store === storeToMatch &&

                o.cnpj === deletedOrder.cnpj &&

                // Exclude same missing status - deleted FALTANTE should restore to normal grade

                (deletedOrder.hasMissingItems ? !o.hasMissingItems : true)

            );



            console.log('[DELETE] Sibling search - index:', siblingIndex, 'searched in store:', storeToMatch);



            // Fallback for merging split 'Ambos' orders.

            if (siblingIndex === -1) {

                siblingIndex = ordersToKeep.findIndex(o =>

                    o.product === deletedOrder.product &&

                    o.store === deletedOrder.store &&

                    (

                        (o.cnpj === 'Ambos' && deletedOrder.cnpj === 'Ambos')

                    ) &&

                    // Also apply the same hasMissingItems logic here

                    (deletedOrder.hasMissingItems ? !o.hasMissingItems : true)

                );

            }



            if (siblingIndex > -1) {

                const sibling = ordersToKeep[siblingIndex];

                const mergedQuantities = JSON.parse(JSON.stringify(sibling.quantities));



                Object.entries(deletedOrder.quantities).forEach(([color, sizes]) => {

                    if (!mergedQuantities[color]) mergedQuantities[color] = {};

                    Object.entries(sizes).forEach(([size, qty]) => {

                        const currentQty = Number(mergedQuantities[color][size]) || 0;

                        const toAddQty = Number(qty) || 0;

                        mergedQuantities[color][size] = currentQty + toAddQty;

                    });

                });



                const allColors = Array.from(new Set([...sibling.colors, ...deletedOrder.colors])).sort((a, b) => a.localeCompare(b));

                const allSizes = sortSizes(Array.from(new Set([...sibling.sizes, ...deletedOrder.sizes])));

                const mergedSourceRowIds = Array.from(new Set([

                    ...(sibling._sourceRowIds || []),

                    ...(deletedOrder._sourceRowIds || [])

                ]));

                const mergedTotals = calculateTotalsForGrid(mergedQuantities, sibling.store);



                // A hyper-defensive approach to rebuild the merged order from scratch.

                const updatedSibling: SavedOrder = {

                    id: String(sibling.id),

                    product: String(sibling.product),

                    store: String(sibling.store),

                    cnpj: sibling.cnpj,

                    quantities: mergedQuantities,

                    totals: mergedTotals,

                    colors: allColors.map(c => String(c)),

                    sizes: allSizes.map(s => String(s)),

                    _sourceRowIds: mergedSourceRowIds,

                    hasMissingItems: sibling.hasMissingItems,

                    editedCells: undefined, // Reset editedCells after a merge operation

                };



                ordersToKeep = ordersToKeep.map((order, index) => index === siblingIndex ? updatedSibling : order);

                ordersToUpdate.push(updatedSibling);

            }



            // Queue up the Supabase deletion

            supabaseDeletionPromises.push(deleteOrder(deletedOrder.id));

        }



        try {

            // Execute all Supabase operations

            console.log('[DELETE] Executing Supabase deletions...');

            await Promise.all(supabaseDeletionPromises);

            console.log('[DELETE] ✅ All Supabase deletions successful');



            // Save all updated siblings

            if (ordersToUpdate.length > 0) {

                console.log('[DELETE] Saving', ordersToUpdate.length, 'merged siblings...');

                await Promise.all(ordersToUpdate.map(order => saveOrder(order)));

                console.log('[DELETE] ✅ All merged siblings saved');

            }



            // Only update React state after successful Supabase operations

            setSavedOrders(ordersToKeep);

            toast.success(`${ordersToDelete.length} pedido(s) deletado(s) com sucesso!`);

            console.log('[DELETE] ✅ React state updated successfully');



        } catch (error: any) {

            // Deletion failed - DO NOT update state

            console.error('[DELETE] ❌ CRITICAL: Deletion failed, state NOT updated');

            console.error('[DELETE] Error details:', error);

            console.error('[DELETE] Error message:', error?.message);

            console.error('[DELETE] Error code:', error?.code);



            // Show detailed error to user

            const errorMsg = error?.message || 'Erro desconhecido';

            toast.error(

                `❌ Falha ao deletar pedido(s) do banco de dados!\n\n` +

                `Erro: ${errorMsg}\n\n` +

                `Os pedidos NÃO foram removidos e reaparecerão ao recarregar a página.\n\n` +

                `Possível causa: Permissões do Supabase (RLS). Verifique o console para mais detalhes.`,

                { duration: 8000 }

            );



            // If there's a RLS-related error code, give specific guidance

            if (error?.code === '42501' || error?.message?.includes('permission') || error?.message?.includes('RLS')) {

                console.error('[DELETE] 🔒 RLS POLICY ERROR DETECTED!');

                console.error('[DELETE] This appears to be a Row Level Security (RLS) policy issue.');

                console.error('[DELETE] Action required:');

                console.error('[DELETE] 1. Check Supabase Dashboard → Authentication → Policies → saved_orders');

                console.error('[DELETE] 2. Ensure DELETE policy is enabled for your user/service role');

                console.error('[DELETE] 3. Run diagnostic script: npx ts-node scripts/check-rls.ts');

            }

        }

    };



    const handleSplitOrder = (updatedOriginalOrder: SavedOrder, newMissingOrder: Omit<SavedOrder, 'id'>) => {

        setSavedOrders(prevOrders => {

            let nextOrders = [...prevOrders];

            const wasMerged = updatedOriginalOrder.id.includes('+');

            const originalIds = updatedOriginalOrder.id.split('+');



            if (wasMerged) {

                // If it was a merged view, we don't delete the original IDs from DB here, 

                // because the UI logic for 'merged' is complex. 

            } else {

                const index = nextOrders.findIndex(o => o.id === updatedOriginalOrder.id);

                if (index > -1) {

                    nextOrders.splice(index, 1); // Remove the old version

                }

            }



            if (updatedOriginalOrder.totals.totalGeral > 0) {

                if (wasMerged) {

                    const safeCnpj = (updatedOriginalOrder.cnpj as any) === 'Ambos Unidos' ? 'Ambos' : updatedOriginalOrder.cnpj;

                    const newKeptOrder = { ...updatedOriginalOrder, id: `split-kept-${Date.now()}`, cnpj: safeCnpj };

                    nextOrders.push(newKeptOrder);

                    saveOrder(newKeptOrder).catch(console.error);

                } else {

                    nextOrders.push(updatedOriginalOrder);

                    saveOrder(updatedOriginalOrder).catch(console.error);

                }

            } else {

                // If total is 0, we should delete it if it existed

                if (!wasMerged) deleteOrder(updatedOriginalOrder.id).catch(console.error);

            }



            if (newMissingOrder.totals.totalGeral > 0) {

                // Ensure the new missing order also uses a standard CNPJ type

                const safeMissingCnpj = (newMissingOrder.cnpj as any) === 'Ambos Unidos' ? 'Ambos' : newMissingOrder.cnpj;

                const finalMissingOrder = { ...newMissingOrder, cnpj: safeMissingCnpj };



                const existingMissingOrderIndex = nextOrders.findIndex(o =>

                    o.product === finalMissingOrder.product &&

                    o.store === finalMissingOrder.store &&

                    o.hasMissingItems &&

                    o.cnpj === finalMissingOrder.cnpj

                );



                if (existingMissingOrderIndex > -1) {

                    const existingOrder = nextOrders[existingMissingOrderIndex];

                    const mergedQuantities = JSON.parse(JSON.stringify(existingOrder.quantities));



                    Object.entries(finalMissingOrder.quantities).forEach(([color, sizes]) => {

                        if (!mergedQuantities[color]) mergedQuantities[color] = {};

                        Object.entries(sizes).forEach(([size, qty]) => {

                            const currentQty = Number(mergedQuantities[color][size]) || 0;

                            const toAddQty = Number(qty) || 0;

                            mergedQuantities[color][size] = currentQty + toAddQty;

                        });

                    });



                    const mergedColors = Array.from(new Set([...existingOrder.colors, ...finalMissingOrder.colors])).sort((a, b) => a.localeCompare(b));

                    const mergedSizes = sortSizes(Array.from(new Set([...existingOrder.sizes, ...finalMissingOrder.sizes])));

                    const mergedTotals = calculateTotalsForGrid(mergedQuantities, existingOrder.store);

                    const mergedSourceRowIds = Array.from(new Set([...(existingOrder._sourceRowIds || []), ...(finalMissingOrder._sourceRowIds || [])]));



                    const mergedOrder: SavedOrder = {

                        id: existingOrder.id,

                        product: existingOrder.product,

                        store: existingOrder.store,

                        cnpj: existingOrder.cnpj,

                        quantities: mergedQuantities,

                        colors: mergedColors,

                        sizes: mergedSizes,

                        totals: mergedTotals,

                        _sourceRowIds: mergedSourceRowIds,

                        hasMissingItems: existingOrder.hasMissingItems,

                        editedCells: undefined, // Reset on merge

                    };

                    nextOrders[existingMissingOrderIndex] = mergedOrder;

                    saveOrder(mergedOrder).catch(console.error);



                } else {

                    const newMissingWithId: SavedOrder = { ...finalMissingOrder, id: `${finalMissingOrder.product}-${finalMissingOrder.store}-faltante-${Date.now()}` };

                    nextOrders.push(newMissingWithId);

                    saveOrder(newMissingWithId).catch(console.error);

                }

            }



            // localStorage.setItem('savedOrders', JSON.stringify(nextOrders));

            return nextOrders;

        });

    };



    const handleRestoreFromFaltante = (updatedFaltanteOrder: SavedOrder, restoredOrder: Omit<SavedOrder, 'id'>) => {

        setSavedOrders(prevOrders => {

            let nextOrders = [...prevOrders];



            if (updatedFaltanteOrder.totals.totalGeral > 0) {

                const index = nextOrders.findIndex(o => o.id === updatedFaltanteOrder.id);

                if (index > -1) {

                    nextOrders[index] = updatedFaltanteOrder;

                    saveOrder(updatedFaltanteOrder).catch(console.error);

                }

            } else {

                nextOrders = nextOrders.filter(o => o.id !== updatedFaltanteOrder.id);

                deleteOrder(updatedFaltanteOrder.id).catch(console.error);

            }



            const originalOrderIndex = nextOrders.findIndex(o =>

                o.product === restoredOrder.product &&

                o.store === restoredOrder.store &&

                o.cnpj === restoredOrder.cnpj &&

                !o.hasMissingItems

            );



            if (originalOrderIndex > -1) {

                const originalOrder = nextOrders[originalOrderIndex]; // Direct reference, no spread



                const mergedQuantities = JSON.parse(JSON.stringify(originalOrder.quantities));

                Object.entries(restoredOrder.quantities).forEach(([color, sizes]) => {

                    if (!mergedQuantities[color]) mergedQuantities[color] = {};

                    Object.entries(sizes).forEach(([size, qty]) => {

                        const currentQty = Number(mergedQuantities[color][size]) || 0;

                        const toAddQty = Number(qty) || 0;

                        mergedQuantities[color][size] = currentQty + toAddQty;

                    });

                });



                const mergedOrder: SavedOrder = {

                    id: originalOrder.id,

                    product: originalOrder.product,

                    store: originalOrder.store,

                    cnpj: originalOrder.cnpj,

                    quantities: mergedQuantities,

                    colors: Array.from(new Set([...originalOrder.colors, ...restoredOrder.colors])).sort((a, b) => a.localeCompare(b)),

                    sizes: sortSizes(Array.from(new Set([...originalOrder.sizes, ...restoredOrder.sizes]))),

                    totals: calculateTotalsForGrid(mergedQuantities, originalOrder.store),

                    _sourceRowIds: Array.from(new Set([...(originalOrder._sourceRowIds || []), ...(restoredOrder._sourceRowIds || [])])),

                    editedCells: undefined, // Reset editedCells on restore

                    hasMissingItems: originalOrder.hasMissingItems,

                };

                nextOrders[originalOrderIndex] = mergedOrder;

                saveOrder(mergedOrder).catch(console.error);



            } else {

                if (restoredOrder.totals.totalGeral > 0) {

                    const newRestoredWithId: SavedOrder = {

                        ...restoredOrder,

                        id: `restored-${Date.now()}`

                    };

                    nextOrders.push(newRestoredWithId);

                    saveOrder(newRestoredWithId).catch(console.error);

                }

            }



            // localStorage.setItem('savedOrders', JSON.stringify(nextOrders));

            return nextOrders;

        });

    };



    const handleSendOrders = (ordersToSend: { order: SavedOrder; cost: number }[]) => {

        const sentOrderIds = new Set(ordersToSend.map(({ order }) => order.id));

        const processedItemIds = new Set(ordersToSend.map(({ order }) => order.id));



        const newOrResetPaymentItems = ordersToSend.map(({ order, cost }) => ({

            id: order.id,

            product: order.product,

            store: order.store,

            cnpj: order.cnpj,

            sentDate: new Date().toISOString(),

            totalValue: cost,

            totalItems: order.totals.totalGeral,

            observation: '',

            status: 'pending' as const,

            amountPaid: 0,

            paymentHistory: [],

        }));



        const remainingPending = pendingPayments.filter(p => !processedItemIds.has(p.id));

        const remainingArchived = archivedPayments.filter(p => !processedItemIds.has(p.id));



        const nextPendingPayments = [...remainingPending, ...newOrResetPaymentItems];



        setPendingPayments(nextPendingPayments);

        // Save new payments to Supabase

        newOrResetPaymentItems.forEach(payment => savePayment(payment, false));



        if (remainingArchived.length !== archivedPayments.length) {

            setArchivedPayments(remainingArchived);

            // We don't need to explicitly delete from archived in Supabase if we just moved them back to pending?

            // Wait, if an order is re-sent, it might have been in archived payments?

            // If so, we need to update its status to pending.

            // The logic above creates NEW payment items or resets them.

            // If ID exists, upsert will handle it.

        }



        const updatedSavedOrders = savedOrders.filter(order => !sentOrderIds.has(order.id));

        setSavedOrders(updatedSavedOrders);

        // savedOrders are updated via deleteOrder/saveOrder logic elsewhere?

        // Here we are removing them from savedOrders.

        // We should call deleteOrder for them?

        // No, we are moving them to archivedSavedOrders.

        // So we should save them as archived.



        const ordersToArchive: ArchivedSavedOrder[] = ordersToSend.map(({ order }) => ({

            ...order,

            archivedDate: new Date().toISOString(),

        }));

        const updatedArchived = [...archivedSavedOrders, ...ordersToArchive];

        setArchivedSavedOrders(updatedArchived);



        // Save to Supabase

        ordersToArchive.forEach(order => saveArchivedOrder(order));

        // And remove from saved_orders (active) - saveArchivedOrder handles this by updating the record

        // ordersToSend.forEach(({ order }) => deleteOrder(order.id)); 

    };



    const handleRecoverOrder = (orderToRecover: ArchivedSavedOrder) => {

        const { archivedDate, ...originalOrder } = orderToRecover;



        setSavedOrders(prev => [...prev, originalOrder]);

        setArchivedSavedOrders(prev => prev.filter(o => o.id !== orderToRecover.id));



        // Update database - save as active (without archived_date)

        saveOrder(originalOrder);



        // Remove payment

        deletePayment(orderToRecover.id);



        showModal('alert', 'Sucesso', `A grade para "${originalOrder.product}" foi recuperada. O pagamento associado foi removido do histórico, e a grade está pronta para ser editada e enviada novamente.`);

    };



    const handleUndoVerification = (orderId: string) => {

        const orderToUndo = archivedSavedOrders.find(o => o.id === orderId);

        if (!orderToUndo) return;



        // Move back to active orders (Enviar)

        const { archivedDate, ...originalOrder } = orderToUndo;



        setSavedOrders(prev => [...prev, originalOrder]);

        setArchivedSavedOrders(prev => prev.filter(o => o.id !== orderId));



        // Update database - save as active (without archived_date)

        // saveOrder already sets archived_date to null, which "unarchives" it 

        // in our one-table-fits-all schema.

        saveOrder(originalOrder);



        showModal('alert', 'Pedido Desfeito', `O pedido "${originalOrder.product}" foi retornado para a tela Enviar.`);

    };



    const handleDeleteArchivedOrder = (orderId: string) => {

        const updatedArchived = archivedSavedOrders.filter(o => o.id !== orderId);

        setArchivedSavedOrders(updatedArchived);

        deleteOrder(orderId);

    };



    const handleMultiplePaymentUpdates = (updatedItems: PaymentItem[]) => {

        const updatedIds = new Set(updatedItems.map(item => item.id));

        const itemsToArchive = updatedItems.filter(item => item.status === 'paid');

        const idsToArchive = new Set(itemsToArchive.map(item => item.id));



        const newPending = [

            ...pendingPayments.filter(p => !updatedIds.has(p.id)),

            ...updatedItems.filter(p => p.status !== 'paid')

        ];



        const newArchived = [

            ...archivedPayments,

            ...itemsToArchive

        ].sort((a, b) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime());



        setPendingPayments(newPending);

        setArchivedPayments(newArchived);



        // Save updates to Supabase

        updatedItems.forEach(item => {

            const isPaid = item.status === 'paid';

            savePayment(item, isPaid);

        });

    };



    const handleAddToBackorder = (items: TableRow[], itemType?: 'estampa' | 'capinha') => {

        if (!headers) return;



        const existingUniqueIds = new Set(backorderedItems.map(item => item.originalRow._uniqueId).filter(Boolean));



        // Prepare items by ensuring they have a unique ID

        const itemsWithIds = items.map(item => {

            if (!item._uniqueId) {

                // If checking duplicates against an item without ID, we can't reliably dedup, 

                // but we should probably allow it and assign an ID.

                return { ...item, _uniqueId: `generated-${Date.now()}-${Math.random()}` };

            }

            return item;

        });



        const itemsToAdd = itemsWithIds.filter(item => {

            return !existingUniqueIds.has(item._uniqueId);

        });



        const duplicateCount = items.length - itemsToAdd.length;



        if (itemsToAdd.length === 0) {

            showModal(

                'alert',

                'Itens Duplicados',

                items.length > 1

                    ? 'Todos os itens selecionados já estão na lista de faltantes.'

                    : 'Este item já está na lista de faltantes.'

            );

            return;

        }



        const newBackorderedItems: BackorderedItem[] = itemsToAdd.map(item => ({

            id: `${Date.now()}-${Math.random()}`,

            backorderDate: new Date().toLocaleDateString('pt-BR'),

            originalRow: item,

            itemType: itemType || 'estampa'

        }));



        const updatedBackordered = [...backorderedItems, ...newBackorderedItems];

        setBackorderedItems(updatedBackordered);

        // localStorage.setItem('backorderedItems', JSON.stringify(updatedBackordered));

        newBackorderedItems.forEach(item => saveBackorderedItem(item).catch(console.error));



        if (duplicateCount > 0) {

            showModal(

                'alert',

                'Operação Parcialmente Concluída',

                `${itemsToAdd.length} novo(s) item(ns) foram adicionados.\n${duplicateCount} item(ns) já existentes foram ignorados.`

            );

        }

    };



    const handleEditBackorder = (

        backorderId: string,

        details: {

            newItems: { sku: string; quantity: number; }[];

            store?: string;

            observation?: string;

        }

    ) => {

        const updatedBackordered = backorderedItems.map(item => {

            if (item.id === backorderId) {

                if (details.newItems.length === 0 && !details.store && !details.observation) {

                    return null;

                }



                return {

                    ...item,

                    editedData: details.newItems.length > 0 ? details.newItems : undefined,

                    store: details.store,

                    observation: details.observation,

                };

            }

            return item;

        }).filter((item): item is BackorderedItem => item !== null);



        setBackorderedItems(updatedBackordered);

        // localStorage.setItem('backorderedItems', JSON.stringify(updatedBackordered));

        updatedBackordered.forEach(item => {

            if (item.id === backorderId) {

                saveBackorderedItem(item).catch(console.error);

            }

        });

    };



    const handleResolveBackorder = (backorderId: string) => {

        const itemToResolve = backorderedItems.find(item => item.id === backorderId);

        if (itemToResolve) {

            const updatedResolved = [...resolvedItems, { ...itemToResolve, resolvedDate: new Date().toISOString() }];

            setResolvedItems(updatedResolved);

            resolveBackorderedItem(backorderId).catch(console.error);

        }

        const updatedBackordered = backorderedItems.filter(item => item.id !== backorderId);

        setBackorderedItems(updatedBackordered);

    };



    const handleUnresolveBackorder = async (backorderId: string) => {

        try {

            const itemToRecover = resolvedItems.find(item => item.id === backorderId);

            if (itemToRecover) {

                setBackorderedItems(prev => [...prev, itemToRecover]);

                setResolvedItems(prev => prev.filter(item => item.id !== backorderId));

                await unresolveBackorderedItem(backorderId);

            }

        } catch (error) {

            console.error('Error unresolving backorder:', error);

            showModal('alert', 'Erro', 'Falha ao recuperar item de atrasados.');

        }

    };



    const loadFullHistory = async () => {

        setSyncProgress(prev => ({

            ...prev,

            isVisible: true,

            status: 'processing',

            message: 'Carregando histórico completo do banco...',

            percentage: 10

        }));



        try {

            setSyncProgress(prev => ({ ...prev, percentage: 30, message: 'Buscando milhares de registros...' }));

            const allOrders = await getSavedOrders(); // No param = all history

            setSavedOrders(allOrders);

            setInitialLoadComplete(true);



            setSyncProgress(prev => ({ ...prev, percentage: 100, message: 'Histórico carregado com sucesso!' }));

            setTimeout(() => {

                setSyncProgress(prev => ({ ...prev, isVisible: false }));

                toast.success(`${allOrders.length} pedidos carregados.`);

            }, 1500);

        } catch (error) {

            console.error('Error loading full history:', error);

            setSyncProgress(prev => ({ ...prev, status: 'error', message: 'Erro ao carregar histórico.' }));

            toast.error('Falha ao carregar histórico completo.');

        }

    };



    const handleDeleteBackorder = (backorderId: string) => {

        setBackorderedItems(prev => {

            const updatedBackordered = prev.filter(item => item.id !== backorderId);

            // localStorage.setItem('backorderedItems', JSON.stringify(updatedBackordered));

            deleteBackorderedItem(backorderId).catch(console.error);

            return updatedBackordered;

        });

    };



    const handleDeleteResolvedItem = (resolvedItemId: string) => {

        setResolvedItems(prev => {

            const updatedResolved = prev.filter(item => item.id !== resolvedItemId);

            // localStorage.setItem('resolvedItems', JSON.stringify(updatedResolved));

            deleteBackorderedItem(resolvedItemId).catch(console.error);

            return updatedResolved;

        });

    };





    const estampasRows: EstampaRow[] = React.useMemo(() => {

        if (!skuHeader || !idVendaHeader || !dataHeader || !quantidadeHeader || !nomeHeader) return [];



        const determineLocalEstampa = (sku: string): string => {

            const lowerSku = sku.toLowerCase();

            if (lowerSku.includes('peito-costa') || lowerSku.includes('peito-costas') || lowerSku.includes('peito e costas')) {

                return 'PEITO E COSTAS';

            }

            if (lowerSku.includes('frente-costas') || lowerSku.includes('frente-costa') || lowerSku.includes('frente e costas')) {

                return 'PEITO E COSTAS';

            }

            if (lowerSku.includes('peito') || lowerSku.includes('frente')) {

                return 'PEITO';

            }

            if (lowerSku.includes('costas') || lowerSku.includes('costa')) {

                return 'COSTAS';

            }

            return 'PEITO';

        };



        const roupasComEstampa = allProcessedData.filter(row => {

            const ecomId = String(row['Identificador do pedido e-commerce'] || '').trim();
            const orderId = String(row[idVendaHeader || ''] || '').trim();
            const skuForSearch = String(row[skuHeader || ''] || '');

            // IDs para rastreamento - procurar em múltiplos campos usando includes

            // 1. Filter out deleted orders - REMOVED per user request (Estampas should show everything)
            // if (deletedOrderIds.has(String(row._uniqueId))) return false;

            // 2. CNPJ Filter
            const rowCnpj = String(row.cnpj || '').toUpperCase();
            const selectedCnpjNorm = String(selectedCnpj || 'Todos').toUpperCase();
            if (selectedCnpjNorm !== 'TODOS' && rowCnpj !== selectedCnpjNorm) {
                return false;
            }

            // 3. Situacao Check - Allow production info editing even for shipped/delivered orders
            const situacaoRowKey = situacaoHeader || '';
            const situacao = String(row[situacaoRowKey] || '').toLowerCase().trim();
            const ESTAMPAS_ALLOWED = [
                'aprovado', 'preparando envio', 'faturado', 'em aberto',
                'pendente', 'processando', 'a enviar', 'pronto para envio',
                'enviado', 'entregue' // Added to allow editing production data after shipping
            ];
            const hasAllowedStatus = !situacao || ESTAMPAS_ALLOWED.some(allowed => situacao.includes(allowed));
            if (!hasAllowedStatus) {
                return false;
            }

            // 4. Canal Check
            const canal = (row._ecommerceStore || '').toUpperCase();
            const ALLOWED_CHANNELS = ['SH ML', 'SH MM', 'SH VEST', 'ML MM', 'ML VEST', 'SH', 'ML', 'SHOPEE', 'MERCADO', 'NT MM', 'BUSINESS'];
            const isAllowedChannel = ALLOWED_CHANNELS.some(allowedCanal => canal.includes(allowedCanal)) ||
                canal.startsWith('SH ') ||
                canal.startsWith('ML ') ||
                canal.startsWith('NT ');


            if (!isAllowedChannel) {
                return false;
            }

            const sku = (row._skuOriginal || String(row[skuHeader || ''] ?? '')).toLowerCase().trim();
            const category = getCategory(sku);

            const keywords = ['peito', 'costa', 'costas', 'frente', 'manga', 'perso', 'personalizado', 'pi', 'cabelereiro', 'cabeleireiro', 'cabelerero', 'cabeleirero', 'cabeleireira', 'eletricista', 'eletrecista', 'manicure', 'nutricionista'];
            const hasKeyword = keywords.some(k => sku.includes(k));

            return category === 'Roupas' && hasKeyword;
        });



        console.log('[ESTAMPAS DEBUG] After filters:', roupasComEstampa.length);

        console.log('[ESTAMPAS DEBUG] selectedCnpj:', selectedCnpj);

        console.log('[ESTAMPAS DEBUG] Headers:', { skuHeader, idVendaHeader, dataHeader, quantidadeHeader, nomeHeader, situacaoHeader });

        if (roupasComEstampa.length === 0 && allProcessedData.length > 0) {

            const sample = allProcessedData[0];

            console.log('[ESTAMPAS DEBUG] Sample row:', {

                _unifiedStatus: sample._unifiedStatus,

                situacao: sample[situacaoHeader!],

                sku: sample[skuHeader],

                category: getCategory(String(sample[skuHeader] ?? '')),

                isPersonalizado: isPersonalizado(String(sample[skuHeader] ?? ''))

            });

        }



        return roupasComEstampa.map(row => {

            // Robust ID extraction for the final Estampa object

            const ecommerceId = String(

                row['Identificador do pedido e-commerce'] ||

                row['id pedido'] ||

                row['ID'] ||

                row['Número'] ||

                row._idVenda ||

                (idVendaHeader && row[idVendaHeader]) ||

                ''

            ).trim();



            const orderId = String(row._idVenda || row[idVendaHeader || ''] || ecommerceId || '');

            const sku = String(row._skuOriginal || row[skuHeader || ''] || '');

            const key = `${ecommerceId || orderId}|${sku}`;



            const parsedSku = parseSku(sku);

            const statusData = estampasStatus[key] || {};

            const defaultLocalEstampa = determineLocalEstampa(sku);

            const fullDateString = String(row[dataHeader] ?? '');

            const trackingCode = trackingMappings[orderId] || trackingMappings[ecommerceId] || statusData.rastreio || '';



            // Use e-commerce ID for channel detection (more accurate)

            const channelId = ecommerceId || orderId;



            return {

                id: key,

                rastreio: trackingCode,

                codVenda: ecommerceId, // Use e-commerce ID instead of order ID

                link: statusData.link || statusData.linkPedido || '',

                canal: getSalesChannel(channelId, (row.cnpj as 'MM' | 'MVF' | null) || null, String(row['Canal'] || row['canal'] || '')),

                fornecedor: getSupplier(getSalesChannel(channelId, (row.cnpj as 'MM' | 'MVF' | null) || null, String(row['Canal'] || row['canal'] || '')), (row.cnpj as 'MM' | 'MVF' | null) || null),

                status: (() => {

                    const supabaseStatus = statusData.status;

                    // Se o status for nulo OU o status for o padrão "FAZER ARTE", permitimos a regra automática

                    if (supabaseStatus && supabaseStatus !== 'FAZER ARTE') {

                        if (supabaseStatus === 'ARTE PRONTA') return 'PRONTA';

                        if (supabaseStatus === 'SEM IMAGEM') return 'IMAGEM';

                        return supabaseStatus;

                    }



                    // Se não houver status no Supabase, verificamos a situação do pedido no Tiny/CSV

                    const rowSituacao = String(row[situacaoHeader || ''] || '').toLowerCase().trim();

                    const isShippedOrDelivered =

                        rowSituacao.includes('enviado') ||

                        rowSituacao.includes('entregue') ||

                        rowSituacao.includes('a caminho');



                    if (isShippedOrDelivered) return 'IMPRESSO';



                    return 'FAZER ARTE';

                })(),

                peca: parsedSku?.productName || 'N/A',

                localEstampa: statusData.localEstampa || defaultLocalEstampa,

                cor: statusData.cor || parsedSku?.colorName || 'N/A',

                tamanho: statusData.tamanho || parsedSku?.sizeName || 'N/A',

                quantidade: getEffectiveQuantity(sku, String(row[quantidadeHeader]!)),

                observacao: statusData.observacao || '',

                tratado: statusData.tratado || false,

                L: statusData.L || statusData.lote || '',

                data: statusData.data || fullDateString.substring(0, 5),

                fullDate: fullDateString,

                dataPrevista: (() => {

                    if (statusData.dataPrevista) return statusData.dataPrevista;



                    // Se não houver data prevista, calcula usando a data do pedido + regra de atraso

                    if (!fullDateString || !fullDateString.includes('/')) return '-';

                    try {

                        const [d, m, y] = fullDateString.split('/').map(Number);

                        const orderDate = new Date(y, m - 1, d);

                        const storeRule = delayRules[getSalesChannel(channelId, (row.cnpj as 'MM' | 'MVF' | null) || null, String(row['Canal'] || row['canal'] || ''))] || delayRules.default || { onTime: 1, atRisk: 2 };



                        // Usamos onTime como dias para a previsão padrão

                        const prevDate = addBusinessDays(orderDate, storeRule.onTime);

                        return `${String(prevDate.getDate()).padStart(2, '0')}/${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

                    } catch (e) {

                        return '-';

                    }

                })(),

                aramadoLetra: statusData.aramadoLetra,

                aramadoNumero: statusData.aramadoNumero,

                cliente: String(row[nomeHeader] || 'N/A'),

                nomeEstampa: statusData.nomeEstampa || '',

                sku: sku,

                googleDriveFolderId: statusData.googleDriveFolderId,

                googleDriveImages: statusData.googleDriveImages,

                linkPedido: statusData.linkPedido || '',

                arteProntaId: statusData.arteProntaId,    // ← ADDED

            };

        });

    }, [allProcessedData, selectedCnpj, estampasStatus, skuHeader, idVendaHeader, dataHeader, quantidadeHeader, nomeHeader, trackingMappings]);



    const handleEstampaChange = React.useCallback((updatedRow: EstampaRow) => {

        const key = updatedRow.id;

        const ecommerceId = updatedRow.codVenda;

        const updates: { orderId: string, status: Partial<EstampaRow> }[] = [];



        // Adiciona a atualização principal com TODOS os campos customizáveis

        updates.push({ orderId: key, status: updatedRow });



        // Sincroniza campos importantes para outros itens do mesmo pedido (ecommerceId)

        if (updatedRow.status || updatedRow.link || updatedRow.linkPedido || updatedRow.nomeEstampa || updatedRow.L) {

            estampasRows.forEach(row => {

                if (row.codVenda === ecommerceId && row.id !== key) {

                    // Sincroniza apenas campos relevantes para IDs duplicados

                    updates.push({

                        orderId: row.id,

                        status: {

                            status: updatedRow.status,

                            link: updatedRow.link,

                            linkPedido: updatedRow.linkPedido,

                            nomeEstampa: updatedRow.nomeEstampa,

                            L: updatedRow.L,

                        }

                    });

                }

            });

        }



        // bulkUpdateStatus já persiste no Supabase via useEstampas hook

        bulkUpdateStatus(updates);

    }, [estampasRows, bulkUpdateStatus]);



    const handleBulkEstampaChange = React.useCallback((updatedRows: EstampaRow[]) => {

        const updates = updatedRows.map(row => ({ orderId: row.id, status: row }));

        bulkUpdateStatus(updates);

    }, [bulkUpdateStatus]);







    const handleBulkAssignImagesToCategory = async (assignments: Record<string, string | null>) => {

        setImageCategoryAssignments(prev => ({ ...prev, ...assignments }));

        try {

            const promises = Object.entries(assignments).map(([imageId, categoryId]) => {

                const url = imageMappings[imageId];

                if (url) {

                    return saveImageMapping(imageId, url, categoryId);

                }

                return Promise.resolve();

            });

            await Promise.all(promises);

        } catch (error) {

            console.error("Failed to save bulk image assignments:", error);

        }

    };



    const handleRenameCategory = async (categoryId: string, newName: string) => {

        try {

            await renameImageCategory(categoryId, newName);

            setImageCategories(prev => prev.map(c => c.id === categoryId ? { ...c, name: newName } : c));

            showModal('alert', 'Sucesso', 'Categoria renomeada com sucesso!');

        } catch (error) {

            console.error(error);

            showModal('alert', 'Erro', 'Erro ao renomear categoria.');

        }

    };



    const handleRenameBrand = async (oldBrand: string, newBrand: string) => {

        try {

            await renamePhoneCaseBrand(oldBrand, newBrand);

            // Update local state

            setPhoneCaseModels(prev => {

                const next = { ...prev };

                if (next[oldBrand]) {

                    next[newBrand] = next[oldBrand];

                    delete next[oldBrand];

                }

                return next;

            });

            showModal('alert', 'Sucesso', 'Marca renomeada com sucesso!');

        } catch (error) {

            console.error(error);

            showModal('alert', 'Erro', 'Erro ao renomear marca.');

        }

    };



    const handleDeleteImage = async (imageIds: string[]) => {

        try {

            // Optimistic update

            setImageMappings(prev => {

                const next = { ...prev };

                imageIds.forEach(id => delete next[id]);

                return next;

            });



            // Update assignments too

            setImageCategoryAssignments(prev => {

                const next = { ...prev };

                imageIds.forEach(id => delete next[id]);

                return next;

            });



            // Delete from Supabase

            const promises = imageIds.map(id => deleteImageMapping(id));

            await Promise.all(promises);



            showModal('alert', 'Sucesso', `${imageIds.length} imagem(ns) removida(s) com sucesso.`);

        } catch (error) {

            console.error("Failed to delete images:", error);

            showModal('alert', 'Erro', 'Falha ao deletar imagens.');

            // Ideally rollback state here, but for now simple alert

        }

    };



    const handleRowClick = React.useCallback((filter: Record<string, string>) => {

        setInitialFilterForDataTable(filter);

        setCurrentView('data');

    }, []);



    const handleViewOrderDetails = React.useCallback((row: TableRow) => {

        const OrderDetailView = ({ rowData }: { rowData: TableRow }) => {

            const [localSearchTerm, setLocalSearchTerm] = React.useState('');



            const displayableData = Object.entries(rowData).filter(([key, value]) => {

                if (key.startsWith('_') || key === 'cnpj') return false;

                return value !== null && value !== undefined && String(value).trim() !== '';

            });



            const filteredData = displayableData.filter(([key, value]) => {

                const searchLower = localSearchTerm.toLowerCase();

                return key.toLowerCase().includes(searchLower) || String(value).toLowerCase().includes(searchLower);

            });



            if (displayableData.length === 0) {

                return <p>Não há detalhes adicionais para este item.</p>;

            }



            return (

                <div className="flex flex-col h-full max-h-[70vh]">

                    <div className="mb-4">

                        <input

                            type="search"

                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"

                            placeholder="Buscar nos detalhes..."

                            value={localSearchTerm}

                            onChange={(e) => setLocalSearchTerm(e.target.value)}

                            autoFocus

                        />

                    </div>

                    <div className="flex-1 overflow-y-auto pr-2">

                        {filteredData.length > 0 ? (

                            <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-4">

                                {filteredData.map(([key, value]) => (

                                    <div key={key} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg break-words shadow-sm hover:shadow-md transition-shadow">

                                        <dt className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{key}</dt>

                                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{String(value)}</dd>

                                    </div>

                                ))}

                            </dl>

                        ) : (

                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">

                                Nenhum dado encontrado para "{localSearchTerm}"

                            </div>

                        )}

                    </div>

                    <div className="mt-6 flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">

                        <button

                            onClick={closeModal}

                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"

                        >

                            Cancelar

                        </button>

                    </div>

                </div>

            );

        };



        showModal(

            'alert', // We use alert type to hide default buttons if we want custom ones, or we can use the custom one inside.

            // Actually, type 'alert' usually has an OK button. 'confirm' has OK/Cancel.

            // If we provide our own Cancel button in the content, we might still want the default 'OK' to be "Fechar" or similar.

            // For now, let's keep it consistent.

            `Detalhes do Pedido${idVendaHeader && row[idVendaHeader] ? `: ${row[idVendaHeader]}` : ''}`,

            <OrderDetailView rowData={row} />,

            () => { }, // onConfirm empty

            { maxWidth: 'max-w-6xl', confirmText: 'Fechar', onCancel: () => { } } // 'Fechar' is the main button. Our 'Cancelar' reduces redundancy but user asked for it. 

            // Wait, if I add "Cancelar" inside, and also have "Fechar" from modal... 

            // The prompt says "red 'Cancelar' button". 

            // I'll make sure the modal's default buttons don't conflict or look weird.

        );

    }, [headers, showModal, idVendaHeader]);



    const handleSearchSubmit = React.useCallback((term: string) => {

        if (!term.trim()) return;

        const lowerTerm = term.toLowerCase().trim();



        // Try exact match on ID first

        const strictMatch = allProcessedData.find(row => {

            const id = idVendaHeader ? String(row[idVendaHeader]) : '';

            return id.toLowerCase().trim() === lowerTerm;

        });



        if (strictMatch) {

            handleViewOrderDetails(strictMatch);

            return;

        }



        // Try partial match

        const match = allProcessedData.find(row => {

            const id = idVendaHeader ? String(row[idVendaHeader]) : '';

            // Search in other fields too? The prompt says "Buscar Pedido". usually implies ID.

            // But maybe client name?

            const client = nomeHeader ? String(row[nomeHeader]) : '';

            return id.toLowerCase().includes(lowerTerm) || client.toLowerCase().includes(lowerTerm);

        });



        if (match) {

            handleViewOrderDetails(match);

        } else {

            // Optional: Toast

            toast.error(`Nenhum pedido encontrado para "${term}"`);

        }

    }, [allProcessedData, idVendaHeader, nomeHeader, handleViewOrderDetails]);



    const handleFilteredDataChange = React.useCallback(() => {

    }, []);



    const resetInitialFilter = React.useCallback(() => {

        if (currentView !== 'data') {

            setInitialFilterForDataTable(null);

        }

    }, [currentView]);



    // React.useEffect(resetInitialFilter, [resetInitialFilter]);



    const availableOrdersCount = React.useMemo(() => {

        if (!skuHeader || !isDataLoaded) return 0;



        // Collect all processed IDs

        const processedIds = new Set<string>();

        [...savedOrders, ...archivedSavedOrders].forEach(o => {

            o._sourceRowIds?.forEach(id => processedIds.add(String(id)));

        });



        const productsWithPendingWork = new Set<string>();



        allProcessedData.forEach(row => {

            // Check Deleted

            if (deletedOrderIds.has(String(row._uniqueId))) return;



            // Only count if status is 'Aprovado'

            if (row._unifiedStatus !== 'Aprovado') return;



            const id = String(row._uniqueId || row._supabaseId);



            // Skip already processed rows

            if (processedIds.has(id)) return;



            const sku = String(row[skuHeader] ?? '');



            // Skip rows that don't belong to a product (e.g. unrecognizable SKU)

            // Note: We count specific Product types. If SKU is totally invalid (no product name), 

            // it won't appear in the Montar list grouping anyway.

            const parsedSku = parseSku(sku);

            if (parsedSku?.productName) {

                productsWithPendingWork.add(parsedSku.productName);

            }

        });



        return productsWithPendingWork.size;

    }, [allProcessedData, skuHeader, savedOrders, archivedSavedOrders, isDataLoaded, deletedOrderIds]);



    // Audio notification for new orders

    const previousOrdersCountRef = React.useRef<number | null>(null);



    React.useEffect(() => {

        // Skip on initial load

        if (previousOrdersCountRef.current === null) {

            previousOrdersCountRef.current = availableOrdersCount;

            return;

        }



        // Check if count increased

        if (availableOrdersCount > previousOrdersCountRef.current && availableOrdersCount > 0) {

            // Play notification sound

            try {

                // Using Web Audio API to generate a notification beep

                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

                const oscillator = audioContext.createOscillator();

                const gainNode = audioContext.createGain();



                oscillator.connect(gainNode);

                gainNode.connect(audioContext.destination);



                // Configure sound (pleasant notification tone)

                oscillator.frequency.value = 800; // Hz

                oscillator.type = 'sine';



                // Envelope for smooth sound

                gainNode.gain.setValueAtTime(0, audioContext.currentTime);

                gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);

                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);



                oscillator.start(audioContext.currentTime);

                oscillator.stop(audioContext.currentTime + 0.5);



            } catch (error) {



                console.error('Erro ao tocar notificação sonora:', error);

            }

        }



        previousOrdersCountRef.current = availableOrdersCount;

    }, [availableOrdersCount]);





    const fazerArteCount = React.useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        return estampasRows.filter(row => {
            // 1. Status Check (Match Estampas.tsx: Default to 'FAZER ARTE' if empty)
            const status = (row.status || 'FAZER ARTE').toUpperCase().trim();
            if (status !== 'FAZER ARTE') return false;

            // 2. Date Filter (Last 30 Days)
            if (!row.fullDate) return false;
            const parts = row.fullDate.split('/');
            if (parts.length < 3) return false;
            const rowDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));

            return rowDate >= thirtyDaysAgo;
        }).length;
    }, [estampasRows]);



    const invalidSkuCount = React.useMemo(() => {

        if (!skuHeader) return 0;

        return allProcessedData.filter(row => {

            // Check Deleted

            if (deletedOrderIds.has(String(row._uniqueId))) return false;



            // Check CNPJ

            if (selectedCnpj !== 'Todos' && row.cnpj !== selectedCnpj) return false;



            // Check Completed/Cancelled Status

            const status = String(row[situacaoHeader!] ?? '').toLowerCase();

            if (status.includes('enviado') || status.includes('cancelado') || status.includes('entregue')) return false;



            // Check SKU Validity

            const sku = String(row[skuHeader!] ?? '');

            if (!sku) return false;



            // Optional: Exclude "Dados Incompletos" if desired, but usually that *is* an invalid SKU issue.

            // Keeping stick to SKU Error check:

            const error = getSkuError(sku);

            return error !== null;

        }).length;

    }, [allProcessedData, skuHeader, deletedOrderIds, selectedCnpj, situacaoHeader, ruleVersion]);



    const pendingVerificationCount = React.useMemo(() => {

        const allSentOrderIds = new Set(archivedSavedOrders.map(o => o.id));



        let pendingCount = 0;

        allSentOrderIds.forEach(id => {

            const status = verificationStatus[id];

            if (!status || status.status === 'pending' || status.status === 'in-progress') {

                pendingCount++;

            }

        });

        return pendingCount;

    }, [archivedSavedOrders, verificationStatus]);



    const pendingCapinhasCount = React.useMemo(() => {

        if (!skuHeader || !situacaoHeader) return 0;

        return allProcessedData.filter(row => {

            // Exclude completed/canceled orders

            const status = String(row[situacaoHeader] ?? '').toUpperCase();

            if (status.includes('ENVIADO') || status.includes('CANCELADO') || status.includes('ENTREGUE')) return false;



            // Check Deleted

            if (deletedOrderIds.has(String(row._uniqueId))) return false;



            if (selectedCnpj !== 'Todos' && row.cnpj !== selectedCnpj) return false;

            const sku = String(row[skuHeader] ?? '');

            return getCategory(sku) === 'Capinha';

        }).length;

    }, [allProcessedData, selectedCnpj, skuHeader, situacaoHeader, deletedOrderIds]);



    const pendingRoupasCount = React.useMemo(() => {

        if (!skuHeader || !situacaoHeader) return 0;

        return allProcessedData.filter(row => {

            // Exclude completed/canceled orders

            const status = String(row[situacaoHeader] ?? '').toUpperCase();

            if (status.includes('ENVIADO') || status.includes('CANCELADO') || status.includes('ENTREGUE')) return false;



            // Check Deleted

            if (deletedOrderIds.has(String(row._uniqueId))) return false;



            if (selectedCnpj !== 'Todos' && row.cnpj !== selectedCnpj) return false;

            const sku = String(row[skuHeader] ?? '');

            return getCategory(sku) === 'Roupas';

        }).length;

    }, [allProcessedData, selectedCnpj, skuHeader, situacaoHeader, deletedOrderIds]);



    const uniqueStoresForRules = React.useMemo(() => {

        return Array.from(new Set(estampasRows.map(r => r.canal))).sort();

    }, [estampasRows]);



    const handleAddStore = async (newStoreName: string) => {

        try {

            const newStore: Store = { name: newStoreName, types: [] };

            await saveStore(newStore);

            setStores(prev => [...prev, newStore]);

        } catch (error) {

            console.error(error);

            showModal('alert', 'Erro', 'Erro ao adicionar loja.');

        }

    };



    const handleManageContacts = () => {

        const salesChannels = ['ML VEST', 'SH VEST', 'MG VEST', 'NT VEST', 'SN VEST', 'AM VEST', 'KW VEST', 'ML MM', 'SH MM', 'MG MM', 'NT MM', 'SN MM', 'AM MM', 'KW MM', 'BUSINESS'];



        const storesList = Array.from(new Set([

            ...stores.map(s => s.name),

            ...uniqueStoresForRules

        ]))

            .filter(store => !salesChannels.includes(store))

            .sort();



        showModal(

            'alert',

            'Gerenciar Contatos de Fornecedores',

            <Contatos

                contacts={contacts}

                stores={storesList}

                onSave={handleSaveContact}

                onDelete={handleDeleteContact}

                onAddStore={handleAddStore}

                onClose={closeModal}

            />,

            undefined,

            { maxWidth: 'max-w-4xl', confirmText: 'Fechar' }

        );

    };



    // New: Helper to calculate saved orders by date to subtract from pending

    const dailySavedOrders = React.useMemo(() => {

        const map: Record<string, number> = {};

        // Build a set of all sourceRowIds that are part of savedOrders

        const savedRowIds = new Set<string | number>();

        savedOrders.forEach(order => {

            order._sourceRowIds?.forEach(id => savedRowIds.add(id));

        });



        // Iterate processed rows to map dates for those saved IDs (honors GLOBAL CUTOFF)

        allProcessedData.forEach(row => {

            if (row._uniqueId && savedRowIds.has(row._uniqueId)) {

                const dateStr = String(row[dataHeader] ?? '');

                if (dateStr) {

                    const parts = dateStr.split('/');

                    if (parts.length === 3) {

                        const sortableDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;

                        map[sortableDate] = (map[sortableDate] || 0) + 1;

                    }

                }

            }

        });

        return map;

    }, [savedOrders, allRows, dataHeader]);



    // Define operational filter: ONLY include orders with these statuses

    // This applies to Capinhas, Estampas, and Separação screens

    const ALLOWED_STATUSES = ['aprovado', 'preparando envio', 'faturado'];

    const FORBIDDEN_STATUSES = ['enviado', 'entregue', 'cancelado', 'a caminho', 'enviando', 'entrega', 'envio'];



    const operationalFilteredData = React.useMemo(() => {

        // Derive directly from allProcessedData to avoid interference from global Status/Date filters

        return allProcessedData.filter(row => {

            // 1. Filter out if it's already "deleted" in the session/database

            if (deletedOrderIds.has(String(row._uniqueId))) return false;



            // 2. Apply CNPJ Filter (Consistent with UI toggle)

            if (selectedCnpj !== 'Todos' && row.cnpj !== selectedCnpj) return false;



            // 3. Operational filter: ONLY include orders with status "Aprovado"

            // AND explicitly exclude CANCELLED status (but allow sent/delivered)

            const status = String(row[situacaoHeader!] ?? '').toLowerCase();

            if (status.includes('cancelado')) return false;



            // Apply MONTAGEM-SPECIFIC local exclusion

            if (currentView === 'montar-pedido' && montarExcludedOrderIds.has(String(row._uniqueId))) return false;



            return row._unifiedStatus === 'Aprovado';

        });

    }, [allProcessedData, deletedOrderIds, selectedCnpj]);



    const dashboardMetrics = React.useMemo(() => {
        if (!isDataLoaded) return null;

        // --- DASHBOARD METRICS V6: HYBRID AUTHORITY STRATEGY ---
        // Goal: Resolve revenue discrepancies (Double Counting / Kit Explosions).
        // Strategy:
        // 1. Group CSV Data by Order ID.
        // 2. If a group matches a known "SavedOrder" (Active):
        //    -> Use the SavedOrder's 'totalGeral' and 'quantities' as the Source of Truth.
        //    -> Use the CSV Row's Date/Status for filtering.
        // 3. If a group DOES NOT match a SavedOrder:
        //    -> Use "Universal Source Deduplication" (V5) on the CSV rows.
        //    -> Filter out duplicate Source IDs to handle kit explosions manually.

        const savedOrdersMap = new Map<string, SavedOrder>();
        [...savedOrders, ...archivedSavedOrders].forEach(o => {
            if (o.id) savedOrdersMap.set(String(o.id).trim(), o);
        });

        // 1. Group CSV rows
        const rowsByOrder = new Map<string, ProcessedTableRow[]>();
        const avulsoRows: ProcessedTableRow[] = [];
        const nonCancelledRows: ProcessedTableRow[] = [];

        allProcessedData.forEach(row => {
            // Global Date/Cutoff filter is already applied to allProcessedData

            const orderId = row._idVenda ? String(row._idVenda).trim() : '';
            if (orderId && orderId.length > 3 && orderId.toLowerCase() !== 'manual') {
                if (!rowsByOrder.has(orderId)) {
                    rowsByOrder.set(orderId, []);
                }
                rowsByOrder.get(orderId)!.push(row);
            } else {
                avulsoRows.push(row);
            }
        });

        // Initialize Aggregates
        let faturamentoTotal = 0;
        const totalPedidosSet = new Set<string>();
        // let totalItens = 0; // Using a simple counter for total items

        // Daily Maps
        const dailySales: Record<string, number> = {};
        const dailyOrders: Record<string, number> = {};
        const dailyOrdersSet: Record<string, Set<string>> = {};
        const dailyCapinhas: Record<string, { perso: number; transp: number }> = {};
        const dailyKits: Record<string, number> = {};
        const dailyMulti: Record<string, number> = {};
        const dailyInvalidSku: Record<string, number> = {};
        const dailyCancelledSales: Record<string, number> = {};
        const dailyEstampas: Record<string, { fila: number; impresso: number }> = {};
        const dailySavedOrders: Record<string, number> = {};
        let capinhasTransparentesAtrasadas = 0;

        // Helper to add to daily metrics
        const addToDaily = (dateStr: string, revenue: number, orderId: string, isCancelled: boolean) => {
            if (!dateStr) return null;
            // Date Normalization (YYYY-MM-DD)
            const parts = dateStr.split('/');
            let sortableDate = '';
            let diffDays = 0;

            if (parts.length === 3) {
                sortableDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                // Calc delay
                const [day, month, year] = parts.map(Number);
                if (!isNaN(day)) {
                    const orderDate = new Date(year, month - 1, day);
                    const today = new Date();
                    orderDate.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0);
                    diffDays = Math.ceil((today.getTime() - orderDate.getTime()) / (86400000));
                }
            } else if (parts.length === 2) {
                // Handle DD/MM format (assume current year)
                const currentYear = new Date().getFullYear();
                sortableDate = `${currentYear}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else {
                return null; // Invalid date
            }

            if (isCancelled) {
                dailyCancelledSales[sortableDate] = (dailyCancelledSales[sortableDate] || 0) + revenue;
            } else {
                dailySales[sortableDate] = (dailySales[sortableDate] || 0) + revenue;

                if (!dailyOrdersSet[sortableDate]) dailyOrdersSet[sortableDate] = new Set();
                dailyOrdersSet[sortableDate].add(orderId);
            }
            return { sortableDate, diffDays };
        };

        const globalProcessedSourceIds = new Set<string>();

        // 2. Process Groups (Orders)
        rowsByOrder.forEach((rows, orderId) => {
            const representative = rows[0];
            const situacao = String(representative[situacaoHeader!] ?? '').toLowerCase();
            const isCancelled = situacao.includes('cancelado');
            const isIncomplete = situacao.includes('dados incompletos');
            const orderDate = String(representative[dataHeader!] || '');

            // Apply Filters (CNPJ check)
            if (selectedCnpj !== 'Todos' && representative.cnpj !== selectedCnpj) return;

            // NOTE: In V6 we allow "Incomplete" to be processed for Counts but maybe not Revenue?
            // V5 excluded Incomplete from Revenue. We will stick to that.

            const savedOrder = savedOrdersMap.get(orderId);

            if (savedOrder && !isCancelled) {
                // --- PATH A: TRUST SAVED ORDER ---
                // Use Golden Data for Revenue
                const goldenRevenue = savedOrder.totals.totalGeral || 0;
                faturamentoTotal += goldenRevenue;

                totalPedidosSet.add(orderId);

                // Add to Daily
                addToDaily(orderDate, goldenRevenue, orderId, isCancelled);

                // For Item Counts (Capinhas, etc), we should ideally use SavedOrder data
                // BUT extracting granular "Transparente vs Personalizada" from SavedOrder totals is hard without iterating items.
                // Hybrid approach: Iterate the CSV rows for *Operational Counts* but NOT for Revenue.
                // We assume CSV rows are "perfect enough" for count distribution even if revenue is mismatched.

                rows.forEach(r => {
                    // Count specific operational metrics (using the row logic)
                    nonCancelledRows.push(r);
                    const sku = String(r[skuHeader!] ?? '');
                    const qty = r._effectiveQuantity || 0;
                    const cat = getCategory(sku);

                    // We need the date info again for the row
                    const dInfo = addToDaily(String(r[dataHeader!]), 0, orderId, isCancelled); // Revenue 0 here, handled above
                    if (!dInfo) return;
                    const { sortableDate, diffDays } = dInfo;

                    if (cat === 'Capinha') {
                        if (!dailyCapinhas[sortableDate]) dailyCapinhas[sortableDate] = { perso: 0, transp: 0 };
                        if (isPersonalizado(sku)) dailyCapinhas[sortableDate].perso += qty;
                        else dailyCapinhas[sortableDate].transp += qty;

                        // Calculating Delays
                        if (!isPersonalizado(sku) && !isCancelled && !['enviado', 'entregue'].some(s => situacao.includes(s))) {
                            if (diffDays > 1) capinhasTransparentesAtrasadas += qty;
                        }
                    }
                    if (isKit(sku)) dailyKits[sortableDate] = (dailyKits[sortableDate] || 0) + qty;
                    else if (qty > 1) dailyMulti[sortableDate] = (dailyMulti[sortableDate] || 0) + qty;
                });

            } else {
                // --- PATH B: CSV FALLBACK (With Deduplication) ---
                if (isCancelled && !savedOrder) {
                    // Just track cancelled sales? handled in addToDaily loop below
                }

                // We iterate rows and applying V5 Dedupe
                rows.forEach(row => {
                    // Dedupe Check
                    if (row._sourceRowIds && row._sourceRowIds.length > 0) {
                        const sid = String(row._sourceRowIds[0]);
                        if (globalProcessedSourceIds.has(sid)) return;
                        globalProcessedSourceIds.add(sid);
                    }

                    const qty = cleanAndParse(row[quantidadeHeader]);
                    const price = cleanAndParse(row[valorUnitarioHeader]);
                    const revenue = qty * price;

                    if (!isCancelled) {
                        faturamentoTotal += revenue;
                        nonCancelledRows.push(row);
                    }

                    // Add to Daily
                    const dInfo = addToDaily(String(row[dataHeader!]), revenue, orderId, isCancelled);

                    if (!isCancelled) {
                        totalPedidosSet.add(orderId);
                    }

                    // Operational Metrics
                    if (dInfo && !isCancelled) {
                        const { sortableDate, diffDays } = dInfo;
                        const sku = String(row[skuHeader!] ?? '');
                        const cat = getCategory(sku);

                        if (cat === 'Capinha') {
                            if (!dailyCapinhas[sortableDate]) dailyCapinhas[sortableDate] = { perso: 0, transp: 0 };
                            if (isPersonalizado(sku)) dailyCapinhas[sortableDate].perso += qty;
                            else dailyCapinhas[sortableDate].transp += qty;

                            if (!isPersonalizado(sku) && !['enviado', 'entregue'].some(s => situacao.includes(s))) {
                                if (diffDays > 1) capinhasTransparentesAtrasadas += qty;
                            }
                        }
                        if (isKit(sku)) dailyKits[sortableDate] = (dailyKits[sortableDate] || 0) + qty;
                        else if (qty > 1) dailyMulti[sortableDate] = (dailyMulti[sortableDate] || 0) + qty;

                        if (cat === 'Roupas') {
                            // Invalid SKU check
                            const pSku = parseSku(sku);
                            if (!pSku || pSku.colorName === 'N/A' || pSku.sizeName === 'N/A') {
                                dailyInvalidSku[sortableDate] = (dailyInvalidSku[sortableDate] || 0) + 1;
                            }
                        }
                    }
                });

                // Apply Order Level Adjustments (Frete, Desconto, Outras) - ONCE per order
                if (!isCancelled && rows.length > 0) {
                    const rep = rows[0];
                    const valFrete = cleanAndParse(rep[valorFreteHeader]);
                    const valOutras = cleanAndParse(rep[outrasDespesasHeader]);
                    const valDesconto = cleanAndParse(rep[valorDescontoHeader]);

                    const orderAdjustments = valFrete + valOutras;

                    if (orderAdjustments !== 0) {
                        faturamentoTotal += orderAdjustments;
                        // Add to daily breakdown using the order date
                        addToDaily(orderDate, orderAdjustments, orderId, isCancelled);
                    }
                }
            }
        });

        // 3. Process Avulso/Manual Rows
        avulsoRows.forEach(row => {
            // Treat as independent rows
            // Apply Filters
            const situacao = String(row[situacaoHeader!] ?? '').toLowerCase();
            const isCancelled = situacao.includes('cancelado');
            const isIncomplete = situacao.includes('dados incompletos');

            if (selectedCnpj !== 'Todos' && row.cnpj !== selectedCnpj) return;

            const qty = cleanAndParse(row[quantidadeHeader]);
            const price = cleanAndParse(row[valorUnitarioHeader]);
            const revenue = qty * price;
            const orderId = String(row._uniqueId); // Use unique ID as order ID for manual

            if (!isCancelled) {
                faturamentoTotal += revenue;
                totalPedidosSet.add(orderId);
                nonCancelledRows.push(row);
            }

            const dInfo = addToDaily(String(row[dataHeader!]), revenue, orderId, isCancelled);

            // Ops Metrics for Avulso (Simplified)
            if (dInfo && !isCancelled) {
                const { sortableDate } = dInfo;
                const sku = String(row[skuHeader!] ?? '');
                if (isKit(sku)) dailyKits[sortableDate] = (dailyKits[sortableDate] || 0) + qty;
                else if (qty > 1) dailyMulti[sortableDate] = (dailyMulti[sortableDate] || 0) + qty;
            }
        });

        const processedSourceRowIds = globalProcessedSourceIds; // For compatibility if referenced later
        const totalPedidos = totalPedidosSet.size;


        // ... (Obsolete V3/V4 logic removed) ...












        // Convert Sets to counts for dailyOrders

        Object.entries(dailyOrdersSet).forEach(([date, set]) => {

            dailyOrders[date] = set.size;

        });



        // Estampas Logic (using existing logic)

        let estampasAtrasadasCount = 0;

        estampasRows.forEach(row => {

            const rowDateStr = row.fullDate;

            if (!rowDateStr) return;

            const parts = rowDateStr.split('/');

            if (parts.length !== 3) return;

            const sortableDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;



            if (!dailyEstampas[sortableDate]) dailyEstampas[sortableDate] = { fila: 0, impresso: 0, aprovado: 0, emAprovacao: 0 };

            const status = (row.status || '').toUpperCase().trim();

            if (status === 'IMPRESSO') {
                dailyEstampas[sortableDate].impresso += row.quantidade;
            } else if (status === 'APROVADO') {
                dailyEstampas[sortableDate].aprovado += row.quantidade;
            } else if (status === 'EM APROVAÇÃO' || status === 'APROVAÇÃO') {
                dailyEstampas[sortableDate].emAprovacao += row.quantidade;
            } else {
                dailyEstampas[sortableDate].fila += row.quantidade;



                // Calculate Delay for Metric

                const [day, month, year] = parts.map(Number);

                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {

                    const orderDate = new Date(year, month - 1, day);

                    const today = new Date();

                    orderDate.setHours(0, 0, 0, 0);

                    today.setHours(0, 0, 0, 0);

                    const diffTime = today.getTime() - orderDate.getTime();

                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));



                    const rule = delayRules[row.canal] || delayRules.default || { onTime: 4, atRisk: 6 };



                    // *** NEW LOGIC: If dataPrevista is missing, 1-day deadline strictly ***

                    const hasPrevista = !!row.dataPrevista;

                    if (!hasPrevista) {

                        if (diffDays > 1) {

                            estampasAtrasadasCount++;

                        }

                    } else {

                        if (diffDays > rule.atRisk) {

                            estampasAtrasadasCount++;

                        }

                    }

                }

            }

        });



        // Backorder Metrics

        const backorderItemsCount = backorderedItems.length;

        const backorderUniqueOrders = new Set(backorderedItems.map(i => i.originalRow[idVendaHeader!])).size;

        const backorderAvulsos = backorderedItems.filter(i => i.originalRow._isAvulso).length;



        // Calculates orders with images coverage

        const orderRows = new Map<string, any[]>();

        nonCancelledRows.forEach(row => {

            const id = String(row[idVendaHeader!] || '');

            if (!id) return;

            if (!orderRows.has(id)) orderRows.set(id, []);

            orderRows.get(id).push(row);

        });



        let ordersWithImagesCount = 0;

        orderRows.forEach((rows) => {

            const allProductsHaveImage = rows.every(row => {

                const product = String(row[nomeHeader!] || '');

                if (!product) return true;

                return imageMappings[product] || imageMappings[normalizeString(product)];

            });

            if (allProductsHaveImage) ordersWithImagesCount++;

        });



        return {

            totalPedidos,

            faturamentoTotal,

            itensPendentes: backorderedItems.length + fazerArteCount,

            skuAssociadosCount: priceTable.filter(p => p.skuProductName).length,

            totalPriceTableProducts: priceTable.length,

            imagensAssociadasCount: ordersWithImagesCount,

            totalUniqueOrderIds: totalPedidos,

            statusEstampas: estampasRows.reduce((acc, row) => {

                const status = row.status || 'FAZER ARTE';

                acc[status] = (acc[status] || 0) + 1;

                return acc;

            }, {} as Record<string, number>),

            // New Daily Maps

            dailySales,

            dailyOrders,

            dailyCapinhas,

            dailyEstampas,

            dailyKits,

            dailyMulti,

            dailySavedOrders,

            dailyInvalidSku,

            dailyCancelledSales,

            // Alerts

            estampasAtrasadasCount,

            backorderItemsCount,

            backorderUniqueOrders,

            backorderAvulsos,

            capinhasTransparentesAtrasadas

        };



    }, [isDataLoaded, allRows, selectedCnpj, situacaoHeader, idVendaHeader, valorUnitarioHeader, skuHeader, quantidadeHeader, dataHeader, delayRules, backorderedItems, fazerArteCount, priceTable, imageMappings, nomeHeader, estampasRows, dailySavedOrders, savedOrders, archivedSavedOrders, allProcessedData, valorFreteHeader, valorDescontoHeader, outrasDespesasHeader]);













    const renderCurrentView = () => {

        const fileUploadProps = {

            onFileUpload: handleFileUpload,

            isDataLoaded,

            files: fileList,

            onClearData: handleClearData,

            onRemoveFile: handleRemoveFile,

        };



        if (currentView === 'precos') {
            if (currentSubView === 'taxas') {
                return (
                    <div className="bg-white dark:bg-[#1e293b] rounded-lg shadow min-h-[500px]">
                        <TaxasMarketplace />
                    </div>
                );
            } else if (currentSubView === 'metricas' || !currentSubView) {
                return (
                    <div className="bg-white dark:bg-[#1e293b] rounded-lg shadow min-h-[500px]">
                        <Metricas allRows={allRows} priceTable={priceTable} />
                    </div>
                );
            } else {
                return <TabelaPrecos
                    allSkuProductNames={allSkuProductNames}
                    showModal={showModal}
                    priceTable={priceTable}
                    onUpdatePriceTable={handlePriceTableUpdate}
                    stores={stores}
                    setStores={handleStoresUpdate}
                    onSave={handleSavePriceTable}
                    activeTab={'tabela'} // Force view to table mode
                />;
            }
        }


        if (currentView === 'imagem') return <Imagem

            onImageUpload={handleImageMappingsUpdate}

            imageMappings={imageMappings}

            imageCategories={imageCategories}

            onAddCategory={handleAddCategory}

            onDeleteCategory={handleDeleteCategory}

            onRenameCategory={handleRenameCategory}

            imageCategoryAssignments={imageCategoryAssignments}

            onAssignImageToCategory={handleAssignImageToCategory}

            onBulkAssignImagesToCategory={handleBulkAssignImagesToCategory}

            filteredOrders={globalFilteredData}

            activeTab={currentSubView as any}

            onDeleteImage={handleDeleteImage}

        />;

        if (currentView === 'sku') return <SkuManager

            showModal={showModal}

            allRows={globalFilteredData}

            headers={headers}

            onUpdateRow={handleUpdateRow}

            onBulkUpdateRows={handleBulkUpdateRows}

            onDeleteRow={handleDeleteRow}

            onAddRow={handleAddRow}

            allSkuProductNames={allSkuProductNames}

            masterData={masterData}

            imageMappings={imageMappings}

            activeTab={currentSubView as any}

            ruleVersion={ruleVersion}

            onRuleChange={refreshRules}

        />;

        if (currentView === 'capinhas') return <Capinhas

            headers={headers}

            data={operationalFilteredData}

            globalSearchTerm={globalSearchTerm}

            phoneCaseModels={phoneCaseModels}

            onAddBrand={handleAddBrand}

            onDeleteBrand={handleDeleteBrand}

            onRenameBrand={handleRenameBrand}

            onAddModel={handleAddModel}

            onDeleteModel={handleDeleteModel}

            onEditModel={handleEditModel}

            onToggleStock={handleToggleStock}

            showModal={showModal}

            setCurrentView={handleViewChange}

            trackingMappings={trackingMappings}

            imageMappings={imageMappings}

            activeTab={currentSubView as any}

        />;



        if (!isDataLoaded) {

            return <FileUpload {...fileUploadProps} />;

        }



        switch (currentView) {

            case 'dashboard':

                return dashboardMetrics ? <Dashboard

                    metrics={dashboardMetrics}

                    setCurrentView={handleViewChange}

                    pendingCapinhasCount={pendingCapinhasCount}

                    invalidSkuCount={invalidSkuCount}

                    savedOrdersCount={savedOrders.length}

                    fazerArteCount={fazerArteCount}

                /> : null;

            case 'upload':

                return <FileUpload {...fileUploadProps} />;

            case 'data':

                return <DataTable headers={headers} data={globalFilteredData} initialFilter={initialFilterForDataTable} onFilterApplied={resetInitialFilter} savedProductNames={savedProductNames} trackingMappings={trackingMappings} />;

            case 'pedidos':

                return <Pedidos

                    headers={headers}

                    data={allProcessedData}

                    globalFilters={globalFilters}

                    onFiltersChange={setGlobalFilters}

                    onFilteredDataChange={handleFilteredDataChange}

                    onRowClick={handleViewOrderDetails}

                    imageMappings={imageMappings}

                    showModal={showModal}

                    trackingMappings={trackingMappings}

                />;

            case 'montar-pedido':

                console.log('[APP] Rendering CriarPedido (Montar View). Data length:', operationalFilteredData.length);

                return <CriarPedido

                    headers={headers}

                    data={operationalFilteredData}

                    onSaveOrder={handleSaveOrder}

                    savedOrders={savedOrders}

                    archivedSavedOrders={archivedSavedOrders}

                    pendingPayments={pendingPayments}

                    archivedPayments={archivedPayments}

                    onRowClick={handleRowClick}

                    onViewOrderDetails={handleViewOrderDetails}

                    backorderedItems={backorderedItems}

                    onAddToBackorder={handleAddToBackorder}

                    setCurrentView={handleViewChange}

                    onResolveBackorder={handleResolveBackorder}

                    showModal={showModal}

                    priceTable={priceTable}

                    onUpdateRow={handleUpdateRow}

                    onBulkUpdateRows={handleBulkUpdateRows}

                    onDeleteRow={handleDeleteRow}

                    onAddRow={handleAddRow}

                    allSkuProductNames={roupasSkuProductNames}

                    masterData={roupasMasterData}

                    imageMappings={imageMappings}

                    trackingMappings={trackingMappings}

                    deletedOrderIds={montarExcludedOrderIds}

                    onSetDeletedOrderIds={setMontarExcludedOrderIds}

                    selectedStore={criarPedidoSelectedStore}

                    onSetSelectedStore={onUpdateCriarPedidoSelectedStore}

                    selectedProduct={criarPedidoSelectedProduct}

                    onSetSelectedProduct={onUpdateCriarPedidoSelectedProduct}

                />;

            case 'enviar-pedido':

                console.log('[APP] Passing to EnviarPedido - allProcessedData length:', allProcessedData.length);

                return <EnviarPedido

                    savedOrders={savedOrders}

                    archivedSavedOrders={archivedSavedOrders}

                    onDeleteOrder={handleDeleteOrder}

                    onRecoverOrder={handleRecoverOrder}

                    onDeleteArchivedOrder={handleDeleteArchivedOrder}

                    priceTable={priceTable}

                    onSendOrders={handleSendOrders}

                    showModal={showModal}

                    contacts={contacts}

                    onSplitOrder={handleSplitOrder}

                    onRestoreFromFaltante={handleRestoreFromFaltante}

                    allRows={allProcessedData}

                    headers={headers}

                    onUpdateRow={handleUpdateRow}

                    onDeleteRow={handleDeleteRow}

                    onAddRow={handleAddRow}

                    allSkuProductNames={allSkuProductNames}

                    masterData={masterData}

                    imageMappings={imageMappings}

                    selectedOrders={enviarSelectedOrders}

                    onSelectionChange={onUpdateEnviarSelectedOrders}

                    cnpjFilterMode={enviarCnpjFilterMode as any}

                    onCnpjFilterChange={onUpdateEnviarCnpjFilterMode}

                />;

            case 'atrasados':

                return <Atrasados

                    allRows={globalFilteredData}

                    backorderedItems={backorderedItems}

                    resolvedItems={resolvedItems}

                    onAddToBackorder={handleAddToBackorder}

                    onResolveBackorder={handleResolveBackorder}

                    onUnresolveBackorder={handleUnresolveBackorder}

                    onEditBackorder={handleEditBackorder}

                    onDeleteResolvedItem={handleDeleteResolvedItem}

                    onDeleteBackorder={handleDeleteBackorder}

                    idVendaHeader={idVendaHeader || ''}

                    skuHeader={skuHeader || ''}

                    quantidadeHeader={quantidadeHeader || ''}

                    allSkuProductNames={roupasSkuProductNames}

                    masterData={roupasMasterData}

                    nomeHeader={nomeHeader || ''}

                    dataHeader={dataHeader || ''}

                    showModal={showModal}

                    imageMappings={imageMappings}
                    montarExcludedIds={montarExcludedOrderIds}
                />;

            case 'estampas':

                return <Estampas

                    data={estampasRows}

                    onRowUpdate={handleEstampaChange}

                    onBulkRowUpdate={handleBulkEstampaChange}

                    onAddRow={handleAddRow}

                    delayRules={delayRules}

                    imageMappings={imageMappings}

                    activeTab={currentSubView as any}

                    isLoading={isLoading || isOrdersLoading}

                    setCurrentView={handleViewChange}

                />;

            case 'pagamento':

                return <Pagamento

                    pendingPayments={pendingPayments}

                    archivedPayments={archivedPayments}

                    onMultiplePaymentUpdate={handleMultiplePaymentUpdates}

                    showModal={showModal}

                    activeTab={currentSubView as any}

                    onOpenDriveSelection={(callback) => {

                        setDriveSelectCallback(() => callback);

                        setIsGoogleDriveOpen(true);

                    }}

                />;

            case 'verificacao':

                const filteredArchivedOrders = archivedSavedOrders.filter(order => {

                    if (selectedCnpj !== 'Todos' && order.cnpj !== selectedCnpj && order.cnpj !== 'Ambos') return false;

                    const channelFilter = globalFilters['canal'] as string;

                    if (channelFilter && order.store !== channelFilter) return false;

                    return true;

                });

                return <Verificacao archivedSavedOrders={filteredArchivedOrders} verificationStatus={verificationStatus} onSaveVerification={handleSaveVerification} onUndo={handleUndoVerification} priceTable={priceTable} allRows={globalFilteredData} headers={headers} showModal={showModal} onUpdateRow={handleUpdateRow} imageMappings={imageMappings} />;

            case 'separacao':

                return <Separacao

                    pickingProps={{

                        headers: headers,

                        data: operationalFilteredData,

                        onRowClick: handleViewOrderDetails,

                        trackingMappings: trackingMappings,

                        imageMappings: imageMappings

                    }}

                    pickingRoupasProps={{

                        headers: headers,

                        data: operationalFilteredData,

                        onRowClick: handleViewOrderDetails,

                        trackingMappings: trackingMappings,

                        imageMappings: imageMappings

                    }}

                    pendingCasesCount={pendingCapinhasCount}

                    pendingRoupasCount={pendingRoupasCount}

                    activeTab={currentSubView as 'roupas' | 'capinhas' | undefined}

                />;

            default:

                return null;

        }

    };



    const mainContentShouldBeBoxed = isDataLoaded || ['preparando-envio', 'precos', 'sku', 'atrasados', 'estampas', 'capinhas', 'pagamento', 'enviar-pedido', 'imagem', 'verificacao', 'separacao'].includes(currentView);



    return (

        <>

            {showSplash && <SplashScreen />}

            <div className={`min-h-screen bg-transparent text-gray-900 dark:text-gray-100 font-sans transition-all duration-1000 ${isLoading ? 'opacity-50 pointer-events-none' : ''} ${!isAppReady && showSplash ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>

                <input

                    type="file"

                    ref={fileInputRef}

                    onChange={(e) => {

                        if (e.target.files) {

                            handleFileUpload(e.target.files);

                            (e.target as HTMLInputElement).value = '';

                        }

                    }}

                    multiple

                    className="hidden"

                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"

                />

                <Header

                    fileName={fileList.map((f: any) => f.name || f).join(', ')}

                    theme={theme}

                    onThemeToggle={handleThemeToggle}

                    isDataLoaded={isDataLoaded}

                    currentView={currentView}

                    setCurrentView={handleViewChange}

                    viewTitle={VIEW_TITLES[currentView]}
                    dateBoundaries={dateBoundaries}
                    backorderCount={backorderedItems.length}
                    onUploadClick={() => setIsUploadModalOpen(true)}
                    showModal={showModal}
                    onUpdateDelayRules={handleUpdateDelayRules}
                    onManageContacts={() => setIsContactsModalOpen(true)}
                    onGoogleDriveClick={() => setIsGoogleDriveOpen(true)}
                    uniqueStoresForRules={uniqueStoresForRules}
                    onClearAllFilters={clearFilters}
                    setSyncProgress={setSyncProgress}
                    onSearchSubmit={(term) => setGlobalSearchTerm(term)}
                    delayRules={delayRules}
                    onRefresh={refetch}
                    isRefetching={isRefetching}
                />



                <main className="w-full py-6">



                    <ViewSwitcher

                        currentView={currentView}

                        setCurrentView={handleViewChange}

                        savedOrdersCount={savedOrders.length}

                        availableOrdersCount={availableOrdersCount}

                        isDataLoaded={isDataLoaded}

                        fazerArteCount={fazerArteCount}

                        invalidSkuCount={invalidSkuCount}

                        pendingVerificationCount={pendingVerificationCount}

                        pendingCasesCount={pendingCapinhasCount}

                        pendingRoupasCount={pendingRoupasCount}

                        backorderCount={backorderedItems.length}

                        onSubViewChange={handleSubViewChange}

                    />



                    {error && (

                        <div className="relative my-4 p-4 pr-12 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg whitespace-pre-wrap" role="alert">

                            <span className="font-bold">Aviso:</span> {error}

                            <button

                                onClick={() => setError(null)}

                                className="absolute top-0 right-0 mt-3 mr-4 text-red-700 dark:text-red-200 hover:text-red-900 dark:hover:text-red-100"

                                aria-label="Fechar aviso"

                            >

                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />

                                </svg>

                            </button>

                        </div>

                    )}



                    {/* Data Loading Overlay (Second Loading Screen) */}

                    {(isLoading || isOrdersLoading) && isAppReady && !isDataLoaded && (

                        <DataLoading />

                    )}





                    {
                        mainContentShouldBeBoxed ? (

                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">

                                <div className={currentView === 'montar-pedido' ? 'p-1 sm:p-2' : currentView === 'estampas' ? 'p-2 sm:p-4 lg:p-6 !pt-0' : 'p-4 sm:p-6 lg:p-8'}>

                                    <React.Suspense fallback={<DataLoading />}>
                                        {renderCurrentView()}
                                    </React.Suspense>

                                </div>

                            </div>

                        ) : (

                            <React.Suspense fallback={<DataLoading />}>
                                {renderCurrentView()}
                            </React.Suspense>

                        )
                    }



                </main >



                {/* Real-time notification toast */}

                {
                    showNotification && (

                        <div className="fixed top-20 right-4 z-50 animate-slide-in">

                            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-lg shadow-2xl border border-green-400 flex items-center gap-3 min-w-[300px]">

                                <div className="flex-shrink-0">

                                    <svg className="h-6 w-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />

                                    </svg>

                                </div>

                                <div className="flex-1">

                                    <p className="font-bold text-sm">Novo Pedido Recebido!</p>

                                    <p className="text-xs opacity-90">

                                        {newOrdersCount === 1 ? '1 novo pedido' : `${newOrdersCount} novos pedidos`}

                                    </p>

                                </div>

                                <button

                                    onClick={() => setShowNotification(false)}

                                    className="flex-shrink-0 text-white hover:text-gray-200 transition-colors"

                                >

                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />

                                    </svg>

                                </button>

                            </div>

                        </div>

                    )
                }

            </div >



            {/* Floating Sync Progress Card */}

            {
                syncProgress.isVisible && (

                    <div className={`fixed bottom-6 right-6 z-[1000] ${syncProgress.isMinimized ? 'w-auto' : 'w-[350px]'} animate-slide-in transition-all duration-300`}>

                        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/30 overflow-hidden">

                            {syncProgress.isMinimized ? (

                                /* Minimalist View (Single Line) */

                                <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/20 dark:hover:bg-gray-700/20 transition-colors"

                                    onClick={() => setSyncProgress(prev => ({ ...prev, isMinimized: false }))}

                                >

                                    <div className={`w-2 h-2 rounded-full ${syncProgress.status === 'processing' ? 'bg-blue-500 animate-pulse' : syncProgress.status === 'completed' ? 'bg-green-500' : syncProgress.status === 'error' ? 'bg-red-500' : 'bg-gray-400 animate-pulse'}`}></div>

                                    <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-gray-900 dark:text-white">

                                        <span>{syncProgress.percentage}%</span>

                                        <span className="text-gray-400 dark:text-gray-500">|</span>

                                        <span className="text-blue-600 dark:text-blue-400">P: {syncProgress.totalProcessed}</span>

                                        <span className="text-gray-400 dark:text-gray-500">|</span>

                                        <span className="text-orange-500">F: {syncProgress.totalPending}</span>

                                    </div>

                                    <button

                                        onClick={(e) => {

                                            e.stopPropagation();

                                            setSyncProgress(prev => ({ ...prev, isMinimized: false }));

                                        }}

                                        className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"

                                    >

                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />

                                        </svg>

                                    </button>

                                </div>

                            ) : (

                                /* Expanded View */

                                <>

                                    <div className="p-4 border-b border-white/10 dark:border-gray-700/30 bg-gray-50/50 dark:bg-gray-900/40 flex justify-between items-center">

                                        <div className="flex items-center gap-2">

                                            <div className={`w-2 h-2 rounded-full ${syncProgress.status === 'processing' ? 'bg-blue-500 animate-pulse' : syncProgress.status === 'completed' ? 'bg-green-500' : syncProgress.status === 'error' ? 'bg-red-500' : 'bg-gray-400 animate-pulse'}`}></div>

                                            <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">

                                                {syncProgress.status === 'searching' ? '🔍 Buscando' : syncProgress.status === 'processing' ? '⚙️ Processando' : syncProgress.status === 'completed' ? '✅ Finalizado' : '⚠️ Erro'}

                                            </h3>

                                        </div>

                                        <div className="flex items-center gap-2">

                                            <button

                                                onClick={() => setSyncProgress(prev => ({ ...prev, isMinimized: true }))}

                                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"

                                                title="Minimizar"

                                            >

                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 12H6" />

                                                </svg>

                                            </button>

                                            {(syncProgress.status === 'completed' || syncProgress.status === 'error') && (

                                                <button

                                                    onClick={() => {

                                                        setSyncProgress(prev => ({ ...prev, isVisible: false }));

                                                        if (syncProgress.status === 'completed') window.location.reload();

                                                    }}

                                                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"

                                                >

                                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />

                                                    </svg>

                                                </button>

                                            )}

                                        </div>

                                    </div>



                                    <div className="p-5 space-y-4">

                                        <div className="flex justify-between items-end">

                                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate max-w-[240px]">{syncProgress.message}</p>

                                            <span className="text-xs font-black text-blue-600 dark:text-blue-400">{syncProgress.percentage}%</span>

                                        </div>



                                        <div className="w-full h-2.5 bg-gray-100/50 dark:bg-gray-700/30 rounded-full overflow-hidden shadow-inner border border-black/5 dark:border-white/5">

                                            <div

                                                className={`h-full transition-all duration-500 ease-out ${syncProgress.status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}

                                                style={{ width: `${syncProgress.percentage}%` }}

                                            />

                                        </div>



                                        <div className="grid grid-cols-2 gap-3 pt-1">

                                            <div className="p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-100/50 dark:border-blue-800/30 shadow-sm backdrop-blur-sm">

                                                <p className="text-[9px] uppercase tracking-wider text-blue-500 dark:text-blue-400 font-bold mb-0.5">Processados</p>

                                                <p className="text-lg font-black text-blue-700 dark:text-blue-300">{syncProgress.totalProcessed}</p>

                                            </div>

                                            <div className="p-3 bg-orange-50/50 dark:bg-orange-900/20 rounded-xl border border-orange-100/50 dark:border-orange-800/30 shadow-sm backdrop-blur-sm">

                                                <p className="text-[9px] uppercase tracking-wider text-orange-500 dark:text-orange-400 font-bold mb-0.5">Fila</p>

                                                <p className="text-lg font-black text-orange-700 dark:text-orange-300">{syncProgress.totalPending}</p>

                                            </div>

                                        </div>



                                        {syncProgress.totalFailed > 0 && (

                                            <div className="p-2.5 bg-red-50/50 dark:bg-red-900/20 border border-red-100/50 dark:border-red-900/30 rounded-lg flex items-center gap-2 animate-pulse">

                                                <span className="text-sm">⚠️</span>

                                                <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-tight">Falhas Críticas: {syncProgress.totalFailed}</p>

                                            </div>

                                        )}

                                    </div>

                                </>

                            )}

                        </div>

                    </div>

                )
            }



            {
                isGoogleDriveOpen && (

                    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">

                        <div className="flex items-start justify-center min-h-screen pt-10 px-4 pb-20 text-center sm:block sm:p-0">

                            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsGoogleDriveOpen(false)}></div>

                            <span className="hidden sm:inline-block sm:align-top sm:h-screen" aria-hidden="true">&#8203;</span>

                            <div className="inline-block align-top bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-top sm:max-w-4xl sm:w-full">

                                <GoogleDrive

                                    onClose={() => {

                                        setIsGoogleDriveOpen(false);

                                        setDriveSelectCallback(null);

                                    }}

                                    onSelectFile={driveSelectCallback ? (url) => {

                                        driveSelectCallback(url);

                                        setIsGoogleDriveOpen(false);

                                        setDriveSelectCallback(null);

                                    } : undefined}

                                    onSyncImages={handleImageMappingsUpdate}

                                />

                            </div>

                        </div>

                    </div>

                )
            }



            {/* Modal rendered outside transformed containers to ensure correct fixed positioning */}

            <Modal

                isOpen={modalState.isOpen}

                onClose={closeModal}

                title={modalState.title}

                type={modalState.type}

                onConfirm={modalState.onConfirm}

                onCancel={modalState.onCancel}

                confirmText={modalState.confirmText}

                cancelText={modalState.cancelText}

                maxWidth={modalState.maxWidth}

            >

                {modalState.message}

            </Modal>

            {/* Contacts Modal */}
            <Modal
                isOpen={isContactsModalOpen}
                onClose={() => setIsContactsModalOpen(false)}
                title="Gerenciar Contatos"
                maxWidth="4xl"
            >
                <Contatos
                    contacts={contacts}
                    stores={[...initialStoresData.map(s => s.name), ...uniqueStoresForRules]}
                    onSave={handleSaveContact}
                    onDelete={handleDeleteContact}
                    onAddStore={handleAddStore}
                    onClose={() => setIsContactsModalOpen(false)}
                />
            </Modal>



            {/* Toast Notifications */}

            <Toaster

                position="top-right"

                toastOptions={{

                    duration: 3000,

                    style: {

                        background: theme === 'dark' ? '#1f2937' : '#ffffff',

                        color: theme === 'dark' ? '#f3f4f6' : '#111827',

                        border: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',

                    },

                    success: {

                        iconTheme: {

                            primary: '#10b981',

                            secondary: '#ffffff',

                        },

                    },

                    error: {

                        iconTheme: {

                            primary: '#ef4444',

                            secondary: '#ffffff',

                        },

                    },

                }}

            />



            {/* Splash Screen with Real Progress */}

            {
                !isAppReady && showSplash && (

                    <SplashScreen

                        onFinish={() => setShowSplash(false)}

                        progress={syncProgress.percentage}

                        message={syncProgress.message}

                    />

                )
            }



            {/* Final Overlay for smooth transition */}

            {
                !isAppReady && showSplash && (

                    <div className="fixed inset-0 bg-gray-900 z-[9998]"></div>

                )
            }

        </>

    );

};



export default App;

