
import * as React from 'react';
import { defaultPriceData, initialStoresData } from '../services/priceTableService';
import { PriceProduct } from '../types';
import { normalizeString } from '../utils/stringUtils';
import PrecosDashboard from './PrecosDashboard';

interface Store {
    name: string;
    types: string[];
}

interface TabelaPrecosProps {
    allSkuProductNames: string[];
    showModal: (
        type: 'alert' | 'confirm',
        title: string,
        message: string | React.ReactNode,
        onConfirm?: () => void,
        options?: {
            onCancel?: () => void;
            confirmText?: string;
            cancelText?: string;
        }
    ) => void;
    priceTable: PriceProduct[];
    onUpdatePriceTable: (newPriceTable: PriceProduct[]) => void;
    stores: Store[];
    setStores: (stores: Store[]) => void;
    onSave: () => Promise<void>;
    activeTab?: 'dashboard' | 'tabela';
}

// Component for the modal content to capture state locally
const AddStoreModalContent: React.FC<{
    onStateChange: (state: { name: string; hasWhite: boolean }) => void;
}> = ({ onStateChange }) => {
    const [name, setName] = React.useState('');
    const [hasWhite, setHasWhite] = React.useState(false);

    React.useEffect(() => {
        onStateChange({ name, hasWhite });
    }, [name, hasWhite]);

    return (
        <div className="space-y-4 text-left">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome da Nova Loja
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: MINHA LOJA"
                    className="block w-full pl-3 pr-4 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                    autoFocus
                />
            </div>
            <div className="flex items-center">
                <input
                    id="has-white"
                    type="checkbox"
                    checked={hasWhite}
                    onChange={(e) => setHasWhite(e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="has-white" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Possui preço diferenciado para "BRANCO"?
                </label>
            </div>
        </div>
    );
};


const TabelaPrecos: React.FC<TabelaPrecosProps> = ({ allSkuProductNames, showModal, priceTable, onUpdatePriceTable, stores, setStores, onSave, activeTab: propActiveTab }) => {
    const [activeTab, setActiveTab] = React.useState<'dashboard' | 'tabela'>('dashboard');

    // Sync activeTab prop with state
    React.useEffect(() => {
        if (propActiveTab && (propActiveTab === 'dashboard' || propActiveTab === 'tabela')) {
            setActiveTab(propActiveTab);
        }
    }, [propActiveTab]);

    // Local state for UI interactions
    const [originalProducts, setOriginalProducts] = React.useState<PriceProduct[]>([]);
    const [originalStores, setOriginalStores] = React.useState<Store[]>([]);
    const [editingRows, setEditingRows] = React.useState<Set<string>>(new Set());
    const [openCategories, setOpenCategories] = React.useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem('tabelaPrecos_openCategories');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch (e) {
            return new Set();
        }
    });

    // Persist openCategories in localStorage
    React.useEffect(() => {
        try {
            localStorage.setItem('tabelaPrecos_openCategories', JSON.stringify(Array.from(openCategories)));
        } catch (e) {
            console.error("Failed to save openCategories to localStorage", e);
        }
    }, [openCategories]);
    const [hasChanges, setHasChanges] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [notification, setNotification] = React.useState<string | null>(null);

    // Scroll State
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = React.useState({ canScrollLeft: false, canScrollRight: false });
    const [isTableInView, setIsTableInView] = React.useState(false);

    // State for drag-and-drop category reordering
    const [categoryOrder, setCategoryOrder] = React.useState<string[]>([]);
    const [draggedCategory, setDraggedCategory] = React.useState<string | null>(null);
    const isInitialMount = React.useRef(true);

    // Read activeTab from localStorage (set by ViewSwitcher dropdown or stored here)
    React.useEffect(() => {
        const savedTab = localStorage.getItem('precos_activeTab');
        if (savedTab && (savedTab === 'dashboard' || savedTab === 'tabela')) {
            setActiveTab(savedTab);
        }
    }, []);

    // Save activeTab to localStorage whenever it changes
    React.useEffect(() => {
        localStorage.setItem('precos_activeTab', activeTab);
    }, [activeTab]);

    const showNotification = (message: string) => {
        setNotification(message);
        setTimeout(() => setNotification(null), 5000);
    };

    // Initialize original state for change tracking and category order
    React.useEffect(() => {
        // When component mounts or priceTable updates from parent (e.g. initial load), update original if it's the first load
        if (isInitialMount.current && priceTable.length > 0) {
            setOriginalProducts(JSON.parse(JSON.stringify(priceTable)));
            setOriginalStores(JSON.parse(JSON.stringify(stores)));

            const allCategories = Array.from(new Set(priceTable.map(p => p.category))).sort();
            const savedCategoryOrder = localStorage.getItem('priceTableCategoryOrder');

            if (savedCategoryOrder) {
                try {
                    const parsedOrder = JSON.parse(savedCategoryOrder);
                    if (Array.isArray(parsedOrder)) {
                        const currentCategoriesSet = new Set(allCategories);
                        const reconciledOrder = parsedOrder.filter(cat => currentCategoriesSet.has(cat));
                        allCategories.forEach(cat => {
                            if (!reconciledOrder.includes(cat)) {
                                reconciledOrder.push(cat);
                            }
                        });
                        setCategoryOrder(reconciledOrder);
                    } else {
                        setCategoryOrder(allCategories);
                    }
                } catch (e) {
                    setCategoryOrder(allCategories);
                }
            } else {
                setCategoryOrder(allCategories);
            }

            if (priceTable.length > 0) {
                setOpenCategories(new Set([allCategories[0]]));
            }
            isInitialMount.current = false;
        }
    }, [priceTable, stores]);

    // Track changes
    React.useEffect(() => {
        const productsChanged = JSON.stringify(priceTable) !== JSON.stringify(originalProducts);
        const storesChanged = JSON.stringify(stores) !== JSON.stringify(originalStores);
        setHasChanges(productsChanged || storesChanged);
    }, [priceTable, originalProducts, stores, originalStores]);

    React.useEffect(() => {
        if (!isInitialMount.current) {
            localStorage.setItem('priceTableCategoryOrder', JSON.stringify(categoryOrder));
        }
    }, [categoryOrder]);

    // Auto-save com debounce
    const autoSaveTimeoutRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        // Limpar timeout anterior
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        // Se houve mudanças e não é primeira montagem, agendar save
        if (hasChanges && !isInitialMount.current) {
            autoSaveTimeoutRef.current = window.setTimeout(() => {
                console.log('[AUTO-SAVE] Salvando tabela automaticamente...');
                saveData().catch(err => console.error('[AUTO-SAVE] Erro:', err));
            }, 500); // 500ms debounce
        }

        // Cleanup
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [priceTable, stores, hasChanges]); // Re-run quando tabela mudar


    // --- Scroll Logic ---
    const checkScroll = React.useCallback(() => {
        const el = scrollContainerRef.current;
        if (el) {
            const buffer = 2;
            const canScrollLeft = el.scrollLeft > buffer;
            const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - buffer;
            setScrollState(prev => {
                if (prev.canScrollLeft === canScrollLeft && prev.canScrollRight === canScrollRight) return prev;
                return { canScrollLeft, canScrollRight };
            });
        }
    }, []);

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
    }, [checkScroll, stores, priceTable, openCategories, activeTab]);

    React.useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => setIsTableInView(entry.isIntersecting), { threshold: 0.1 });
        const currentEl = scrollContainerRef.current;
        if (currentEl) observer.observe(currentEl);
        return () => { if (currentEl) observer.unobserve(currentEl); };
    }, [activeTab]);

    const handleScroll = (direction: 'left' | 'right') => {
        const el = scrollContainerRef.current;
        if (el) {
            const scrollAmount = el.clientWidth * 0.6;
            el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };
    // --- End Scroll Logic ---

    const filteredProducts = React.useMemo(() => {
        if (!searchTerm) {
            return priceTable;
        }
        const lowercasedFilter = searchTerm.toLowerCase();
        return priceTable.filter(p =>
            p.product.toLowerCase().includes(lowercasedFilter)
        );
    }, [priceTable, searchTerm]);

    const priceExtremes = React.useMemo(() => {
        const extremes: Record<string, { min: number | null; max: number | null }> = {};
        priceTable.forEach(product => {
            let minPrice: number | null = null;
            let maxPrice: number | null = null;

            Object.entries(product.prices).forEach(([storeName, storePrices]) => {
                Object.values(storePrices).forEach(price => {
                    if (typeof price === 'number') {
                        if (storeName.toUpperCase() !== 'SITE') {
                            if (minPrice === null || price < minPrice) minPrice = price;
                        }
                        if (maxPrice === null || price > maxPrice) maxPrice = price;
                    }
                });
            });

            if (minPrice !== null && maxPrice !== null && minPrice < maxPrice) {
                extremes[product.id] = { min: minPrice, max: maxPrice };
            } else {
                extremes[product.id] = { min: null, max: null };
            }
        });
        return extremes;
    }, [priceTable]);

    const saveData = async () => {
        try {
            await onSave();
            setOriginalProducts(JSON.parse(JSON.stringify(priceTable)));
            setOriginalStores(JSON.parse(JSON.stringify(stores)));
            setHasChanges(false);
            showNotification('Alterações salvas com sucesso!');
        } catch (error) {
            showModal('alert', 'Erro', 'Erro ao salvar alterações.');
        }
    };

    const handleFieldChange = (id: string, field: keyof PriceProduct, value: any) => {
        let finalValue = value;
        if (field === 'product') {
            finalValue = String(value).toUpperCase();
        } else if (field === 'skuProductName') {
            finalValue = value === '' ? null : value;
        }
        onUpdatePriceTable(priceTable.map(p => p.id === id ? { ...p, [field]: finalValue } : p));
    };

    const handlePriceChange = (id: string, storeName: string, type: string, value: string) => {
        const parsedValue = parseFloat(value);
        const finalValue = isNaN(parsedValue) ? null : parsedValue;
        onUpdatePriceTable(priceTable.map(p => {
            if (p.id === id) {
                const newPrices = { ...p.prices };
                if (!newPrices[storeName]) newPrices[storeName] = {};
                newPrices[storeName][type] = finalValue;
                return { ...p, prices: newPrices };
            }
            return p;
        }));
    };

    const toggleEditMode = (id: string) => {
        setEditingRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
                const original = originalProducts.find(op => op.id === id);
                if (original) {
                    onUpdatePriceTable(priceTable.map(p => p.id === id ? original : p));
                }
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSaveRow = (id: string) => {
        setEditingRows(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
    };

    const handleAddProduct = (category: string) => {
        const newProduct: PriceProduct = {
            id: `product-${Date.now()}`,
            category: category,
            product: 'NOVO PRODUTO',
            skuProductName: null,
            prices: {},
        };
        onUpdatePriceTable([newProduct, ...priceTable]);
        setEditingRows(prev => new Set(prev).add(newProduct.id));
    };

    const handleDeleteProduct = (id: string) => {
        onUpdatePriceTable(priceTable.filter(p => p.id !== id));
    };

    const handleAddStore = () => {
        const formStateRef = { current: { name: '', hasWhite: false } };

        showModal(
            'confirm',
            'Adicionar Nova Loja',
            <AddStoreModalContent onStateChange={(state) => formStateRef.current = state} />,
            () => {
                const { name, hasWhite } = formStateRef.current;
                const trimmedName = name.trim().toUpperCase();

                if (!trimmedName) {
                    showModal('alert', 'Erro', 'O nome da loja é obrigatório.');
                    return;
                }
                if (stores.some(s => s.name === trimmedName)) {
                    showModal('alert', 'Erro', 'Já existe uma loja com este nome.');
                    return;
                }

                const types = hasWhite ? ['BRANCO', 'COR'] : ['COR'];
                const newStore: Store = { name: trimmedName, types };

                const newStores = [...stores, newStore];
                setStores(newStores);

                // Ensure products have this store key initialized
                const newPriceTable = priceTable.map(p => {
                    if (!p.prices[trimmedName]) {
                        return { ...p, prices: { ...p.prices, [trimmedName]: {} } };
                    }
                    return p;
                });
                onUpdatePriceTable(newPriceTable);
            },
            { confirmText: 'Adicionar' }
        );
    };

    const handleDeleteStore = (storeName: string) => {
        showModal(
            'confirm',
            'Confirmar Exclusão',
            `Tem certeza que deseja excluir a loja "${storeName}" e todos os seus preços?`,
            () => {
                setStores(stores.filter(s => s.name !== storeName));
                onUpdatePriceTable(priceTable.map(p => {
                    const newPrices = { ...p.prices };
                    delete newPrices[storeName];
                    return { ...p, prices: newPrices };
                }));
            },
            { confirmText: 'Excluir' }
        );
    };

    const toggleCategory = (category: string) => {
        setOpenCategories(prev => {
            const newSet = new Set(prev);
            newSet.has(category) ? newSet.delete(category) : newSet.add(category);
            return newSet;
        });
    };

    const groupedProducts = React.useMemo(() => {
        return filteredProducts.reduce((acc: Record<string, PriceProduct[]>, product) => {
            (acc[product.category] = acc[product.category] || []).push(product);
            return acc;
        }, {} as Record<string, PriceProduct[]>);
    }, [filteredProducts]);

    const displayedCategoryOrder = React.useMemo(() => {
        const categoriesInFilteredProducts = new Set(Object.keys(groupedProducts));
        return categoryOrder.filter(category => categoriesInFilteredProducts.has(category));
    }, [categoryOrder, groupedProducts]);


    const formatPrice = (value: number | null | undefined) => {
        if (value === null || value === undefined) return '-';
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const abbreviatePriceType = (type: string): string => {
        switch (type.toUpperCase()) {
            case 'BRANCO': return 'BR';
            case 'COR': return 'COR';
            case 'ESPECIAL': return 'ESP';
            default: return type;
        }
    };

    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, category: string) => {
        setDraggedCategory(category);
        e.dataTransfer.setData('text/plain', category);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, targetCategory: string) => {
        e.preventDefault();
        const sourceCategory = e.dataTransfer.getData('text/plain');
        if (sourceCategory && sourceCategory !== targetCategory) {
            const sourceIndex = categoryOrder.indexOf(sourceCategory);
            const targetIndex = categoryOrder.indexOf(targetCategory);

            const newOrder = [...categoryOrder];
            const [removed] = newOrder.splice(sourceIndex, 1);
            newOrder.splice(targetIndex, 0, removed);

            setCategoryOrder(newOrder);
        }
        setDraggedCategory(null);
        e.currentTarget.classList.remove('bg-primary-100', 'dark:bg-primary-900/50');
    };

    const handleDragEnter = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.currentTarget.classList.add('bg-primary-100', 'dark:bg-primary-900/50');
    }

    const handleDragLeave = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.currentTarget.classList.remove('bg-primary-100', 'dark:bg-primary-900/50');
    }

    const handleDragEnd = () => setDraggedCategory(null);

    const isAnyRowEditing = editingRows.size > 0;

    const { associatedCount, unassociatedCount } = React.useMemo(() => {
        if (!priceTable || priceTable.length === 0) {
            return { associatedCount: 0, unassociatedCount: 0 };
        }
        const associated = priceTable.filter(p => p.skuProductName !== null).length;
        const unassociated = priceTable.length - associated;
        return { associatedCount: associated, unassociatedCount: unassociated };
    }, [priceTable]);

    const RowActions: React.FC<{ product: PriceProduct }> = ({ product }) => {
        const isEditing = editingRows.has(product.id);
        return (
            <div className="flex items-center justify-start gap-0.5">
                {isEditing ? (
                    <>
                        <button onClick={() => handleSaveRow(product.id)} title="Salvar" className="p-1.5 text-green-600 dark:text-green-500 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                        <button onClick={() => toggleEditMode(product.id)} title="Cancelar" className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </>
                ) : (
                    <button onClick={() => toggleEditMode(product.id)} title="Editar" className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                )}
                <button onClick={() => handleDeleteProduct(product.id)} title="Excluir" className="p-1.5 text-red-600 dark:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                </button>
            </div>
        );
    };

    const totalColumns = 2 + (isAnyRowEditing ? 1 : 0) + stores.reduce((acc, s) => acc + s.types.length, 0);

    return (
        <div>
            {notification && (
                <div className="fixed top-20 right-8 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-pulse z-50">
                    {notification}
                </div>
            )}

            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'dashboard' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('tabela')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'tabela' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'}`}
                    >
                        Gerenciar Preços
                    </button>
                </nav>
            </div>

            {activeTab === 'dashboard' ? (
                <PrecosDashboard priceTable={priceTable} stores={stores} />
            ) : (
                <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tabela de Preços / Custos</h1>
                            <p className="text-xs text-gray-600 dark:text-gray-300">Arraste as categorias para reordenar.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-4 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg border dark:border-gray-700">
                                <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300" title="Produtos na tabela que possuem um SKU correspondente na planilha carregada.">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.233 5.383l1.06-1.06A2.5 2.5 0 0112.232 4.232z" /><path d="M7.768 15.768a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 005.656 5.656l3-3a4 4 0 00-.233-5.383l-1.06 1.06A2.5 2.5 0 017.768 15.768z" /></svg>
                                    <span className="font-semibold">{associatedCount}</span> Associados
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300" title="Produtos na tabela que ainda não foram encontrados na planilha.">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.533 1.22a.75.75 0 00-1.066 0L6.22 2.467a.75.75 0 000 1.066l.934.934a.75.75 0 101.06-1.06L7.54 2.753l.993-.993a.75.75 0 000-1.066zm5.934 2.247a.75.75 0 00-1.06-1.06l-.934.934a.75.75 0 101.06 1.06l.934-.934zM11.467 18.78a.75.75 0 001.066 0l1.247-1.247a.75.75 0 000-1.066l-.934-.934a.75.75 0 10-1.06 1.06l.672.672-.994.994a.75.75 0 000 1.066zm-5.934-2.247a.75.75 0 001.06 1.06l.934-.934a.75.75 0 10-1.06-1.06l-.934.934zM4.22 7.467a.75.75 0 000-1.066L3.285 5.467a.75.75 0 10-1.06 1.06l.672.672-.994.994a.75.75 0 000 1.066l1.247 1.247a.75.75 0 001.066 0L5.467 9.533a.75.75 0 000-1.066l-.934-.934.687-.686zm11.56 5.066a.75.75 0 000 1.066l.934.934a.75.75 0 101.06-1.06l-.672-.672.994-.994a.75.75 0 000-1.066l-1.247-1.247a.75.75 0 00-1.066 0L14.533 10.467a.75.75 0 000 1.066l.934.934-.687.686z" clipRule="evenodd" /><path fillRule="evenodd" d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-3 3a2.5 2.5 0 01-3.536-3.536l3-3zM8.707 7.768a2.5 2.5 0 00-3.536 3.536l3 3a2.5 2.5 0 003.536-3.536l-3-3z" clipRule="evenodd" /></svg>
                                    <span className="font-semibold">{unassociatedCount}</span> Não Associados
                                </div>
                            </div>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                                </div>
                                <input
                                    type="search"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Buscar produto..."
                                    className="block w-full h-8 pl-9 pr-3 py-2 text-xs border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-lg"
                                />
                            </div>
                            <button onClick={handleAddStore} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700">Adicionar Loja</button>
                            <button onClick={saveData} disabled={!hasChanges} className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${hasChanges ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                                Salvar
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <div ref={scrollContainerRef} className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                            <table className="min-w-full text-xs">
                                <thead className="bg-gray-100 dark:bg-gray-900/50 sticky top-0 z-10">
                                    <tr>
                                        <th scope="col" className="sticky left-0 bg-gray-100 dark:bg-gray-900/50 py-1 px-2 text-left font-medium text-gray-600 dark:text-gray-300 w-20 z-20">Ações</th>
                                        <th scope="col" className="sticky left-20 bg-gray-100 dark:bg-gray-900/50 py-1 px-2 text-left font-medium text-gray-600 dark:text-gray-300 w-56 max-w-56 z-20">PRODUTO (TABELA)</th>
                                        {isAnyRowEditing && <th scope="col" className="sticky left-[19rem] bg-gray-100 dark:bg-gray-900/50 py-1 px-2 text-left font-medium text-gray-600 dark:text-gray-300 w-40 max-w-40 z-20">Assoc.</th>}
                                        {stores.map(store => (
                                            <th key={store.name} colSpan={store.types.length} className="whitespace-nowrap py-1 px-2 text-center font-semibold text-gray-900 dark:text-gray-100 border-l border-gray-300 dark:border-gray-600">
                                                <div className="flex items-center justify-center gap-1">
                                                    {store.name}
                                                    <button onClick={() => handleDeleteStore(store.name)} className="text-red-400 hover:text-red-600 opacity-50 hover:opacity-100">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                    <tr>
                                        <th scope="col" className="sticky left-0 bg-gray-100 dark:bg-gray-900/50 py-1 px-2 z-20"></th>
                                        <th scope="col" className="sticky left-20 bg-gray-100 dark:bg-gray-900/50 py-1 px-2 z-20"></th>
                                        {isAnyRowEditing && <th scope="col" className="sticky left-[19rem] bg-gray-100 dark:bg-gray-900/50 py-1 px-2 z-20"></th>}
                                        {stores.map(store => store.types.map(type => (
                                            <th key={`${store.name}-${type}`} className="py-1 px-2 text-center text-[10px] font-bold text-gray-600 dark:text-gray-300 border-l border-gray-300 dark:border-gray-600">{abbreviatePriceType(type)}</th>
                                        ))).flat()}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {displayedCategoryOrder.map(category => {
                                        const productsInCategory = groupedProducts[category] || [];
                                        const isOpen = openCategories.has(category);
                                        const isDragging = draggedCategory === category;

                                        // Cores vibrantes por categoria
                                        const getCategoryColor = () => {
                                            const cat = category.toLowerCase();
                                            if (cat.includes('feminino')) return 'bg-gradient-to-r from-pink-500 to-pink-600';
                                            if (cat.includes('masculino')) return 'bg-gradient-to-r from-blue-500 to-blue-600';
                                            if (cat.includes('unisex')) return 'bg-gradient-to-r from-purple-500 to-purple-600';
                                            if (cat.includes('infantil')) return 'bg-gradient-to-r from-yellow-500 to-yellow-600';
                                            if (cat.includes('acessóri')) return 'bg-gradient-to-r from-green-500 to-green-600';
                                            if (cat.includes('capinha')) return 'bg-gradient-to-r from-indigo-500 to-indigo-600';
                                            return 'bg-gradient-to-r from-gray-500 to-gray-600';
                                        };

                                        return (
                                            <React.Fragment key={category}>
                                                <tr
                                                    className={`${getCategoryColor()} text-white border-t-2 border-b border-white/20 transition-colors ${isDragging ? 'opacity-50' : ''}`}
                                                    draggable="true"
                                                    onDragStart={(e) => handleDragStart(e, category)}
                                                    onDragEnd={handleDragEnd}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, category)}
                                                    onDragEnter={handleDragEnter}
                                                    onDragLeave={handleDragLeave}
                                                >
                                                    <th colSpan={totalColumns} className="text-left p-0 cursor-grab active:cursor-grabbing">
                                                        <div className="flex items-center justify-between p-2 w-full">
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={(e) => { e.stopPropagation(); handleAddProduct(category); }} className="px-2 py-0.5 bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 text-xs font-bold rounded-full hover:bg-primary-200">
                                                                    + Adicionar
                                                                </button>
                                                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleCategory(category)}>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                                                    <h2 className="font-semibold text-sm text-gray-800 dark:text-gray-200">{category}</h2>
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{productsInCategory.length} produtos</span>
                                                                </div>
                                                            </div>
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                                                        </div>
                                                    </th>
                                                </tr>
                                                {isOpen && productsInCategory.map(product => {
                                                    const isEditing = editingRows.has(product.id);
                                                    const productExtremes = priceExtremes[product.id];

                                                    return (
                                                        <tr key={product.id} className="group bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                            <td className="sticky left-0 bg-white dark:bg-gray-800/50 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 py-0.5 px-2 z-10">
                                                                <RowActions product={product} />
                                                            </td>
                                                            <td className="sticky left-20 bg-white dark:bg-gray-800/50 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 py-0.5 px-2">
                                                                <div className="flex items-center gap-2">
                                                                    {product.skuProductName ? (
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                                            <title>{`Associado a: ${product.skuProductName}`}</title>
                                                                            <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.233 5.383l1.06-1.06A2.5 2.5 0 0112.232 4.232z" />
                                                                            <path d="M7.768 15.768a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 005.656 5.656l3-3a4 4 0 00-.233-5.383l-1.06 1.06A2.5 2.5 0 017.768 15.768z" />
                                                                        </svg>
                                                                    ) : (
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                                            <title>Não associado</title>
                                                                            <path fillRule="evenodd" d="M8.533 1.22a.75.75 0 00-1.066 0L6.22 2.467a.75.75 0 000 1.066l.934.934a.75.75 0 101.06-1.06L7.54 2.753l.993-.993a.75.75 0 000-1.066zm5.934 2.247a.75.75 0 00-1.06-1.06l-.934.934a.75.75 0 101.06 1.06l.934-.934zM11.467 18.78a.75.75 0 001.066 0l1.247-1.247a.75.75 0 000-1.066l-.934-.934a.75.75 0 10-1.06 1.06l.672.672-.994.994a.75.75 0 000 1.066zm-5.934-2.247a.75.75 0 001.06 1.06l.934-.934a.75.75 0 10-1.06-1.06l-.934.934zM4.22 7.467a.75.75 0 000-1.066L3.285 5.467a.75.75 0 10-1.06 1.06l.672.672-.994.994a.75.75 0 000 1.066l1.247 1.247a.75.75 0 001.066 0L5.467 9.533a.75.75 0 000-1.066l-.934-.934.687-.686zm11.56 5.066a.75.75 0 000 1.066l.934.934a.75.75 0 101.06-1.06l-.672-.672.994-.994a.75.75 0 000-1.066l-1.247-1.247a.75.75 0 00-1.066 0L14.533 10.467a.75.75 0 000 1.066l.934.934-.687.686z" clipRule="evenodd" />
                                                                            <path fillRule="evenodd" d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-3 3a2.5 2.5 0 01-3.536-3.536l3-3zM8.707 7.768a2.5 2.5 0 00-3.536 3.536l3 3a2.5 2.5 0 003.536-3.536l-3-3z" clipRule="evenodd" />
                                                                        </svg>
                                                                    )}
                                                                    {isEditing ? (
                                                                        <input type="text" value={product.product} maxLength={75} onChange={e => handleFieldChange(product.id, 'product', e.target.value)} className="w-full bg-gray-50 dark:bg-gray-700/50 p-1 rounded-sm border-b-2 border-primary-500 focus:outline-none font-mono uppercase" />
                                                                    ) : (
                                                                        <span title={product.product} className="font-mono text-gray-800 dark:text-gray-200 block truncate">{product.product}</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            {isAnyRowEditing && (
                                                                <td className="sticky left-[19rem] bg-white dark:bg-gray-800/50 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 py-0.5 px-2">
                                                                    {isEditing ? (
                                                                        <select
                                                                            value={product.skuProductName || ''}
                                                                            onChange={e => handleFieldChange(product.id, 'skuProductName', e.target.value)}
                                                                            className="w-full bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-primary-500 focus:border-primary-500 rounded p-1"
                                                                        >
                                                                            <option value="">-- Associar SKU --</option>
                                                                            {allSkuProductNames.map(name => <option key={name} value={name}>{name}</option>)}
                                                                        </select>
                                                                    ) : (
                                                                        <span className="text-gray-500 dark:text-gray-400 block truncate">{product.skuProductName}</span>
                                                                    )}
                                                                </td>
                                                            )}
                                                            {stores.map(store => store.types.map(type => {
                                                                const currentPrice = product.prices[store.name]?.[type];
                                                                let priceCellClass = '';
                                                                if (typeof currentPrice === 'number' && productExtremes?.min !== null) {
                                                                    if (currentPrice === productExtremes.min) priceCellClass = 'bg-green-100 dark:bg-green-900/50';
                                                                    else if (currentPrice === productExtremes.max) priceCellClass = 'bg-red-100 dark:bg-red-900/50';
                                                                }
                                                                return (
                                                                    <td key={`${store.name}-${type}`} className={`py-0.5 px-1 border-l border-gray-300 dark:border-gray-600 ${priceCellClass}`}>
                                                                        {isEditing ? (
                                                                            <input type="number" step="0.01" value={currentPrice ?? ''} onChange={e => handlePriceChange(product.id, store.name, type, e.target.value)} className="w-14 text-xs bg-gray-50 dark:bg-gray-700/50 p-0.5 rounded-sm border-b-2 border-primary-500 focus:outline-none" />
                                                                        ) : (
                                                                            <span className="block text-center text-xs w-14">{formatPrice(currentPrice)}</span>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })).flat()}
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {isTableInView && scrollState.canScrollLeft && (
                            <button
                                onClick={() => handleScroll('left')}
                                className="fixed top-1/2 left-2 sm:left-4 -translate-y-1/2 z-30 bg-white/80 dark:bg-gray-900/80 p-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary-500"
                                aria-label="Rolar para esquerda"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                        )}
                        {isTableInView && scrollState.canScrollRight && (
                            <button
                                onClick={() => handleScroll('right')}
                                className="fixed top-1/2 right-2 sm:right-4 -translate-y-1/2 z-30 bg-white/80 dark:bg-gray-900/80 p-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary-500"
                                aria-label="Rolar para direita"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default TabelaPrecos;
