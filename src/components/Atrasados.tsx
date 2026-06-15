import * as React from 'react';
import toast from 'react-hot-toast';
import { TableRow, BackorderedItem } from '../types';
import { transformSku, parseSku, buildSku, getColorMap, getEffectiveQuantity, smartImageLookup } from '../services/skuService';
import { cleanAndParse } from '../utils/numberUtils';
import { sortSizes } from '../utils/sortUtils';
import { storeStyles, defaultStoreStyle } from '../utils/ecommerceUtils';
import { getSalesChannel } from '../services/ecommerceService';
import { CopyButton } from './common/CopyButton';
import { useAppContext } from '../contexts/AppContext';

interface AtrasadosProps {
    allRows: TableRow[];
    backorderedItems: BackorderedItem[];
    resolvedItems: BackorderedItem[];
    onAddToBackorder: (items: TableRow[], itemType?: string) => void;
    onResolveBackorder: (backorderId: string) => void;
    onUnresolveBackorder: (backorderId: string) => void;
    onEditBackorder: (
        backorderId: string,
        details: {
            newItems: { sku: string; quantity: number }[];
            store?: string;
            observation?: string;
        }
    ) => void;
    onDeleteResolvedItem: (resolvedItemId: string) => void;
    onDeleteBackorder: (backorderId: string) => void;
    idVendaHeader: string;
    skuHeader: string;
    quantidadeHeader: string;
    nomeHeader: string;
    dataHeader: string;
    allSkuProductNames: string[];
    masterData: { colors: string[]; sizes: string[] };
    showModal: (
        type: 'alert' | 'confirm',
        title: string,
        message: string | React.ReactNode,
        onConfirm?: () => void,
        options?: {
            onCancel?: () => void;
            confirmText?: string;
            cancelText?: string;
            maxWidth?: string;
        }
    ) => void;
    imageMappings: Record<string, string>;
    montarExcludedIds?: Set<string | number>;
}

const formatDate = (dateString: string | number | undefined): string => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return String(dateString);
    }
};

const formatDateToDDMM = (dateString: string | number | undefined): string => {
    if (!dateString) return '';
    const str = String(dateString);
    const parts = str.split('/');
    if (parts.length === 3) { // DD/MM/YYYY
        return `${parts[0]}/${parts[1]}`;
    }
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
        const day = String(adjustedDate.getDate()).padStart(2, '0');
        const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    }
    return str; // Fallback
};

const STORES = ["GUSHI", "MAGIC", "GLOBAL", "FENOMENAL", "ALFA DEZ", "ERON", "INDICE"];



interface EditModalProps {
    item: BackorderedItem;
    onClose: () => void;
    onSave: (item: BackorderedItem, details: { newItems: { sku: string; quantity: number }[], store?: string; observation?: string; }) => void;
    allSkuProductNames: string[];
    masterData: { colors: string[]; sizes: string[] };
    skuHeader: string;
    quantidadeHeader: string;
    showModal: (type: 'alert' | 'confirm', title: string, message: string | React.ReactNode) => void;
    imageMappings: Record<string, string>;
    imageUrl?: string; // Pass image URL directly from card
}

const EditModal: React.FC<EditModalProps> = ({ item, onClose, onSave, allSkuProductNames, masterData, skuHeader, quantidadeHeader, showModal, imageMappings, imageUrl }) => {
    const { originalRow, editedData, store, observation } = item;
    const isAvulso = originalRow._isAvulso;

    const [items, setItems] = React.useState<{ product: string; color: string; size: string; quantity: number; id: number }[]>([]);
    const [selectedStore, setSelectedStore] = React.useState(store || (isAvulso ? 'Sem Loja' : STORES[0]));
    const [currentObservation, setCurrentObservation] = React.useState(observation || '');


    // Use image URL passed from card
    const [previewImage, setPreviewImage] = React.useState<string | undefined>(imageUrl);


    React.useEffect(() => {
        setPreviewImage(imageUrl); // Update if imageUrl changes
    }, [imageUrl]);



    React.useEffect(() => {
        const getInitialItems = () => {
            if (editedData && editedData.length > 0) {
                return editedData.map((d, index) => {
                    const parsed = parseSku(d.sku);
                    return {
                        product: parsed?.productName || '',
                        color: parsed?.colorName !== 'N/A' ? parsed.colorName : '',
                        size: parsed?.sizeName !== 'N/A' ? parsed.sizeName : '',
                        quantity: d.quantity,
                        id: index
                    };
                });
            }
            if (isAvulso) {
                return [];
            }
            const sku = String(originalRow[skuHeader] ?? '');
            const parsed = parseSku(sku);
            const quantity = getEffectiveQuantity(sku, String(originalRow[quantidadeHeader] ?? ''));
            return [{
                product: parsed?.productName || '',
                color: parsed?.colorName !== 'N/A' ? parsed.colorName : '',
                size: parsed?.sizeName !== 'N/A' ? parsed.sizeName : '',
                quantity: quantity,
                id: 0
            }];
        };

        setItems(getInitialItems());
        setSelectedStore(store || (isAvulso ? 'Sem Loja' : STORES[0]));
        setCurrentObservation(observation || '');

    }, [item, skuHeader, quantidadeHeader, editedData, isAvulso, originalRow, store, observation]);

    const handleItemChange = (index: number, field: 'product' | 'color' | 'size' | 'quantity', value: string) => {
        const newItems = [...items];
        if (field === 'quantity') {
            newItems[index][field] = parseInt(value, 10) || 0;
        } else {
            newItems[index][field] = value;
        }
        setItems(newItems);
    };

    const handleAddItem = () => {
        setItems([...items, { product: allSkuProductNames[0] || '', color: '', size: '', quantity: 1, id: Date.now() }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems((items || []).filter((_, i) => i !== index));
    };

    const handleSave = () => {
        for (const i of items) {
            if (!i.product || !i.color || !i.size) {
                showModal('alert', 'Campos Obrigatórios', 'Todos os itens devem ter Produto, Cor e Tamanho selecionados.');
                return;
            }
        }

        const newItems = items.map(i => ({
            sku: buildSku(i.product, i.color, i.size) || '',
            quantity: i.quantity
        })).filter(i => i.sku && i.quantity > 0) || [];

        const hasStore = selectedStore && selectedStore !== 'Sem Loja';
        if (newItems.length === 0 && !hasStore && !currentObservation) {
            onClose();
            return;
        }

        onSave(item, {
            newItems,
            store: hasStore ? selectedStore : undefined,
            observation: currentObservation,
        });
        toast.success('Item atrasado salvo!');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[10500] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full flex flex-col md:flex-row overflow-hidden" onClick={e => e.stopPropagation()}>

                {/* Image Preview Sidebar */}
                <div className="w-full md:w-1/3 bg-gray-100 dark:bg-gray-900 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r dark:border-gray-700">
                    {previewImage ? (
                        <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden shadow-md">
                            <img src={previewImage} alt="Preview" className="w-full h-full object-cover object-bottom" />
                        </div>
                    ) : (
                        <div className="w-full aspect-[3/4] bg-gray-200 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm">Sem imagem</span>
                        </div>
                    )}
                    <p className="mt-4 text-sm text-center text-gray-500 dark:text-gray-400">
                        {items.length > 0 && items[0].product && items[0].color
                            ? `${items[0].product} - ${items[0].color}`
                            : 'Selecione produto e cor'}
                    </p>
                </div>

                <div className="flex-1 flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Editar Item Atrasado</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        {items.map((itemData, index) => (
                            <div key={itemData.id} className="grid grid-cols-12 gap-2 items-end p-2 border rounded dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                                <div className="col-span-12 sm:col-span-4">
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Produto</label>
                                    <select value={itemData.product} onChange={e => handleItemChange(index, 'product', e.target.value)} className="mt-1 w-full p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                                        <option value="">Selecione</option>
                                        {allSkuProductNames.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Cor</label>
                                    <select value={itemData.color} onChange={e => handleItemChange(index, 'color', e.target.value)} className="mt-1 w-full p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                                        <option value="">Selecione</option>
                                        {masterData.colors.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Tamanho</label>
                                    <select value={itemData.size} onChange={e => handleItemChange(index, 'size', e.target.value)} className="mt-1 w-full p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                                        <option value="">Selecione</option>
                                        {masterData.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Qt.</label>
                                    <input type="number" value={itemData.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} className="mt-1 w-full p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                                </div>
                                <div className="col-span-6 sm:col-span-2 text-right">
                                    <button onClick={() => handleRemoveItem(index)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button onClick={handleAddItem} className="w-full mt-2 px-3 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs font-semibold rounded-md hover:border-primary-500 hover:text-primary-500">
                            + Adicionar Item
                        </button>
                        <hr className="dark:border-gray-600 my-4" />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Loja de Destino (Opcional)</label>
                            <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} className="mt-1 w-full p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                                <option value="Sem Loja">Sem Loja</option>
                                {STORES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Observação (Opcional)</label>
                            <textarea value={currentObservation} onChange={e => setCurrentObservation(e.target.value)} rows={2} className="mt-1 w-full p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-sm font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-md hover:bg-primary-700">Salvar Alterações</button>
                    </div>
                </div>
            </div>
        </div>
    );
};


interface ItemCardProps {
    item: BackorderedItem;
    index: number;
    onEdit: (item: BackorderedItem, imageUrl?: string) => void;
    onResolve: () => void;
    onDelete: () => void;
    skuHeader: string;
    quantidadeHeader: string;
    idVendaHeader: string;
    nomeHeader: string;
    dataHeader: string;
    imageMappings: Record<string, string>;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, index, onEdit, onResolve, onDelete, skuHeader, quantidadeHeader, idVendaHeader, nomeHeader, dataHeader, imageMappings }) => {
    const { originalRow, editedData, store, observation } = item;
    const orderId = String(originalRow[idVendaHeader] ?? 'N/A');
    const storeName = getSalesChannel(orderId, originalRow.cnpj || null);
    const storeStyle = storeStyles[storeName] || defaultStoreStyle;

    // Determine which SKU to use for image lookup
    let sku = String(originalRow[skuHeader] ?? '');
    if (editedData && editedData.length > 0) {
        sku = editedData[0].sku;
    }


    // Use smart lookup
    const imageUrl = smartImageLookup(sku, imageMappings);


    const isAvulso = originalRow._isAvulso;

    const ImagePlaceholder = () => (
        <div className="h-full w-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        </div>
    );

    return (
        <div
            className="bg-white dark:bg-gray-800/50 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex overflow-hidden animate-slide-in"
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            <div className="w-40 flex-shrink-0 relative group">
                {imageUrl ? (
                    <img src={imageUrl} alt={`Imagem para ${orderId}`} className="h-full w-full object-cover object-bottom" />
                ) : (
                    <ImagePlaceholder />
                )}
                {/* Hover overlay to show full image or details could go here */}
            </div>

            <div className="flex-grow p-4 flex flex-col justify-between">
                <div> {/* Top part */}
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${storeStyle.bg} ${storeStyle.text}`}>{isAvulso ? "AVULSO" : storeName}</span>
                                {item.itemType === 'capinha' && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                        Capinha
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center mt-1">
                                <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{orderId}</p>
                                <CopyButton text={orderId} />
                            </div>
                        </div>
                    </div>
                    {!isAvulso && <p className="text-base font-semibold text-gray-700 dark:text-gray-200 mt-2 leading-tight" title={String(originalRow[nomeHeader] ?? '')}>{String(originalRow[nomeHeader] ?? 'N/A')}</p>}
                    <p className="text-xs text-gray-400 mt-1">Pedido em: {formatDateToDDMM(String(originalRow[dataHeader]))} | Atrasado em: {formatDateToDDMM(item.backorderDate)}</p>

                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700"> {/* SKU Info */}
                        {editedData ? (
                            <ul className="space-y-2 text-xs">
                                {editedData.map((edit, index) => (
                                    <li key={index} className="p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded-md">
                                        <p className="font-semibold text-yellow-800 dark:text-yellow-200 leading-tight">{transformSku(edit.sku)}</p>
                                        <p className="text-yellow-700 dark:text-yellow-300">Quantidade: {edit.quantity}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm p-2 bg-gray-50 dark:bg-gray-900/50 rounded-md">
                                <p className="font-semibold text-gray-800 dark:text-gray-200 leading-tight">{transformSku(String(originalRow[skuHeader] ?? ''))}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">Quantidade: {getEffectiveQuantity(String(originalRow[skuHeader]), String(originalRow[quantidadeHeader] ?? ''))}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-4"> {/* Bottom part */}
                    {(store || observation) && (
                        <div className="mb-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs space-y-1">
                            {store && <p><span className="font-semibold">Loja de Destino:</span> {store}</p>}
                            {observation && <p className="whitespace-pre-wrap"><span className="font-semibold">Obs:</span> {observation}</p>}
                        </div>
                    )}
                    <div className="flex justify-end items-center gap-2">
                        <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full" title="Excluir item atrasado"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
                        <button onClick={() => onEdit(item, imageUrl)} className="px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-md hover:bg-yellow-600">Editar</button>
                        <button onClick={onResolve} className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-md hover:bg-green-700">Resolver</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Atrasados: React.FC<AtrasadosProps> = ({ allRows, backorderedItems, resolvedItems, onAddToBackorder, onResolveBackorder, onUnresolveBackorder, onEditBackorder, onDeleteResolvedItem, onDeleteBackorder, idVendaHeader, skuHeader, quantidadeHeader, nomeHeader, dataHeader, allSkuProductNames, masterData, showModal, imageMappings, montarExcludedIds }) => {
    const { globalSearchTerm } = useAppContext();
    const [searchOrderId, setSearchOrderId] = React.useState('');
    const [editingItem, setEditingItem] = React.useState<BackorderedItem | null>(null);
    const [selectedType, setSelectedType] = React.useState<'estampa' | 'capinha'>('estampa');
    const [searchType, setSearchType] = React.useState<'estampa' | 'capinha'>('estampa');
    const [activeTab, setActiveTab] = React.useState<'todos' | 'estampa' | 'capinha'>('todos');

    const [editingImageUrl, setEditingImageUrl] = React.useState<string | undefined>(undefined);
    const [isCreatingAvulso, setIsCreatingAvulso] = React.useState(false);
    const [ignoredLateOrders, setIgnoredLateOrders] = React.useState<Set<string | number>>(new Set());
    const [resolvedPage, setResolvedPage] = React.useState(1);
    const RESOLVED_PER_PAGE = 10;

    // NEW: Detect late clothing orders (>1 day, excluding certain statuses and non-clothing)
    const lateOrders = React.useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const isBusinessDay = (date: Date) => {
            const day = date.getDay();
            return day !== 0 && day !== 6; // 0 is Sunday, 6 is Saturday
        };

        const getBusinessDaysDiff = (startDate: Date, endDate: Date) => {
            let count = 0;
            let curDate = new Date(startDate.getTime());
            curDate.setHours(0, 0, 0, 0);

            // Normalize end date
            const targetEndDate = new Date(endDate.getTime());
            targetEndDate.setHours(0, 0, 0, 0);

            while (curDate < targetEndDate) {
                curDate.setDate(curDate.getDate() + 1);
                if (isBusinessDay(curDate)) {
                    count++;
                }
            }
            return count;
        };

        // RESTORED: Status filter. User requested to HIDE items with these specific statuses from the yellow box.
        // We KEEP 'enviar', 'em aberto' visible if they are late.
        const excludedStatuses = ['enviado', 'entregue', 'cancelado', 'a caminho', 'despachado', 'recebido', 'concluido'];

        return (allRows || []).filter(row => {
            // Skip if ignored
            if (ignoredLateOrders.has(row._uniqueId!)) return false;

            // Skip if excluded in Montar screen
            if (montarExcludedIds && montarExcludedIds.has(String(row._uniqueId!))) return false;
            if (montarExcludedIds && row._supabaseId && montarExcludedIds.has(String(row._supabaseId))) return false;

            // Check date
            const dateStr = String(row[dataHeader] || '');
            if (!dateStr) return false;

            let orderDate: Date;
            if (dateStr.includes('/')) {
                const [day, month, year] = dateStr.split('/');
                orderDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
                orderDate = new Date(dateStr);
            }
            orderDate.setHours(0, 0, 0, 0);

            // Calculate business days diff
            const diff = getBusinessDaysDiff(orderDate, today);

            // Late if more than 1 business day BUT less than or equal to 5 business days
            // This shows only recent late orders (2-5 days late)
            if (diff <= 1 || diff > 5) return false;

            // Check status (Situação column)
            const situacao = String(row['Situação'] || row['situacao'] || '').toLowerCase();
            if (excludedStatuses.some(status => situacao.includes(status))) return false;

            // Check if it's clothing (exclude capinhas/estampas/personalizados)
            const sku = String(row[skuHeader] || '').toLowerCase();
            if (sku.includes('capa') || sku.includes('cap-') || sku.includes('estampa')) return false;

            // Exclude personalized orders (can be added manually if needed)
            if (sku.includes('personalizado') || sku.includes('custom') || sku.includes('person')) return false;

            // Exclude SKUs with stamp location terms (these are stamps, not clothing)
            if (sku.includes('peito') || sku.includes('costas') || sku.includes('costa') || sku.includes('frente')) return false;

            return true;
        });
    }, [allRows, dataHeader, skuHeader, ignoredLateOrders]);

    // ... existing refs and effects ...

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchOrderId.trim()) {
            const foundRow = allRows.find(row =>
                String(row[idVendaHeader] || '').trim() === searchOrderId.trim()
            );

            if (foundRow) {
                // Pass searchType to onAddToBackorder
                onAddToBackorder([foundRow], searchType);
                setSearchOrderId('');
            } else {
                showModal('alert', 'Pedido não encontrado', `O pedido ${searchOrderId} não foi encontrado na lista atual.`);
            }
        }
    };

    const handleCreateAvulso = () => {
        const newItem: BackorderedItem = {
            id: `bo-avulso-${Date.now()}`,
            backorderDate: new Date().toLocaleDateString('pt-BR'),
            originalRow: {
                _uniqueId: `avulso-${Date.now()}`,
                _isAvulso: true,
                [idVendaHeader]: 'NOVO',
                [skuHeader]: 'AVULSO',
                [quantidadeHeader]: 1,
                [nomeHeader]: 'Item Avulso',
                [dataHeader]: new Date().toLocaleDateString('pt-BR')
            } as any,
            editedData: [],
            itemType: 'estampa' // Default, user can edit later or we can add selector in modal
        };
        setIsCreatingAvulso(true);
        handleEditItem(newItem);
    };

    const handleSaveFromModal = (updatedItem: BackorderedItem, details: { newItems: { sku: string; quantity: number }[], store?: string; observation?: string; }) => {
        if (updatedItem) {
            onEditBackorder(updatedItem.id, details);
        }
        handleCloseModal();
    };
    const filteredBackorderedItems = React.useMemo(() => {
        let items = backorderedItems;

        // Filter out items with excluded statuses (enviado, entregue, cancelado)
        // We allow 'em aberto', 'a enviar', 'pronto' etc because backordered items are typically in these states.
        const excludedStatuses = ['enviado', 'entregue', 'cancelado'];
        items = (items || []).filter(item => {
            const situacao = String(item.originalRow['Situação'] || item.originalRow['situacao'] || '').toLowerCase();
            // Keep item only if it doesn't match any excluded status
            return !excludedStatuses.some(status => situacao.includes(status));
        });

        // REMOVED: Date filter. Backordered items (manually added) should ALWAYS be visible 
        // regardless of date, until they are resolved or the order status changes (e.g. sent/cancelled).
        // The 2-5 day filter helps Identify NEW late orders (in lateOrders), but shouldn't hide ALREADY BACKORDERED items.

        // Filter by tab type
        if (activeTab !== 'todos') {
            items = (items || []).filter(item => (item.itemType || 'estampa') === activeTab);
        }

        // Filter by search term
        if (globalSearchTerm) {
            const search = globalSearchTerm.toLowerCase();
            items = (items || []).filter(item => {
                const row = item.originalRow;
                return (
                    String(row[nomeHeader] || '').toLowerCase().includes(search) ||
                    String(row[idVendaHeader] || '').toLowerCase().includes(search) ||
                    String(row[skuHeader] || '').toLowerCase().includes(search)
                );
            });
        }

        // Sort by backorder date (most recent first)
        items = [...items].sort((a, b) => {
            const parseDate = (dateStr: string): Date | null => {
                if (!dateStr) return null;
                const parts = String(dateStr).trim().split('/');

                if (parts.length === 3) {
                    const [day, month, year] = parts;
                    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                } else if (parts.length === 2) {
                    const [day, month] = parts;
                    const currentYear = new Date().getFullYear();
                    return new Date(currentYear, parseInt(month) - 1, parseInt(day));
                }
                return null;
            };

            const dateA = parseDate(a.backorderDate);
            const dateB = parseDate(b.backorderDate);

            if (dateA && dateB) {
                return dateB.getTime() - dateA.getTime();
            }
            return String(b.backorderDate).localeCompare(String(a.backorderDate));
        });

        return items;
    }, [backorderedItems, globalSearchTerm, activeTab, nomeHeader, idVendaHeader, skuHeader, dataHeader]);


    // ... logic for filteredResolvedItems ...
    const filteredResolvedItems = React.useMemo(() => {
        let items = resolvedItems;

        // Filter by tab type (resolved items also have type)
        if (activeTab !== 'todos') {
            items = (items || []).filter(item => (item.itemType || 'estampa') === activeTab);
        }

        // Filter by search term
        if (globalSearchTerm) {
            const search = globalSearchTerm.toLowerCase();
            items = (items || []).filter(item => {
                const row = item.originalRow;
                return (
                    String(row[nomeHeader] || '').toLowerCase().includes(search) ||
                    String(row[idVendaHeader] || '').toLowerCase().includes(search) ||
                    String(row[skuHeader] || '').toLowerCase().includes(search)
                );
            });
        }

        // Sort by backorder date (most recent first)
        items = [...items].sort((a, b) => {
            // ... sorting logic ...
            const parseDate = (dateStr: string): Date | null => {
                if (!dateStr) return null;
                const parts = String(dateStr).trim().split('/');

                if (parts.length === 3) {
                    const [day, month, year] = parts;
                    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                } else if (parts.length === 2) {
                    const [day, month] = parts;
                    const currentYear = new Date().getFullYear();
                    return new Date(currentYear, parseInt(month) - 1, parseInt(day));
                }
                return null;
            };

            const dateA = parseDate(a.backorderDate);
            const dateB = parseDate(b.backorderDate);

            if (dateA && dateB) {
                return dateB.getTime() - dateA.getTime();
            }
            return String(b.backorderDate).localeCompare(String(a.backorderDate));
        });

        return items;
    }, [resolvedItems, globalSearchTerm, activeTab, nomeHeader, idVendaHeader, skuHeader]);

    const handleEditItem = (itemToEdit: BackorderedItem, imageUrl?: string) => {
        setEditingItem(itemToEdit);
        setEditingImageUrl(imageUrl);
    };

    const handleCloseModal = () => {
        if (editingItem && editingItem.originalRow._isAvulso && (!editingItem.editedData || editingItem.editedData.length === 0)) {
            onDeleteBackorder(editingItem.id);
        }
        setEditingItem(null);
        setEditingImageUrl(undefined);
        setIsCreatingAvulso(false);
    };



    // ... other imports

    // ...

    // Helper for Copy Feedback removed, using imported component


    return (
        <div>


            {/* Type Filter Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 pb-1">
                <button
                    onClick={() => setActiveTab('todos')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'todos' ? 'bg-white dark:bg-gray-800 text-primary-600 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    Todos
                </button>
                <button
                    onClick={() => setActiveTab('estampa')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'estampa' ? 'bg-white dark:bg-gray-800 text-primary-600 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    Estampas
                </button>
                <button
                    onClick={() => setActiveTab('capinha')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'capinha' ? 'bg-white dark:bg-gray-800 text-primary-600 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    Capinhas
                </button>
            </div>

            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 items-start">
                    <div>
                        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">Adicionar Pedido Atrasado</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Busque um pedido existente pelo seu ID para adicioná-lo à lista de atrasados.</p>
                        <form onSubmit={handleSearch} className="flex items-center gap-2">
                            <select
                                value={searchType}
                                onChange={(e) => setSearchType(e.target.value as 'estampa' | 'capinha')}
                                className="h-11 px-3 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-lg shadow-sm w-32"
                            >
                                <option value="estampa">Estampa</option>
                                <option value="capinha">Capinha</option>
                            </select>
                            <div className="relative flex-grow">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                                </div>
                                <input
                                    id="order-search-input"
                                    type="text"
                                    value={searchOrderId}
                                    onChange={e => setSearchOrderId(e.target.value)}
                                    className="block w-full h-11 pl-10 pr-3 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 rounded-lg shadow-sm"
                                    placeholder="ID do Pedido..."
                                />
                            </div>
                            <button type="submit" className="h-11 px-5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 flex-shrink-0">Buscar</button>
                        </form>
                    </div>

                    <div className="md:border-l md:border-gray-300 md:dark:border-gray-600 md:pl-8">
                        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">...ou criar um item avulso</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Crie um novo item atrasado que não existe na planilha original.</p>
                        <button
                            onClick={handleCreateAvulso}
                            className="h-11 px-6 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 flex items-center justify-center gap-2 w-full md:w-auto"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            Criar Pedido Avulso
                        </button>
                    </div>
                </div>
            </div>

            {/* Empty State Message */}
            {lateOrders.length === 0 && (
                <div className="mb-8 bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-600 rounded-xl p-8 text-center">
                    <div className="flex justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2">
                        Nenhum item atrasado!
                    </h2>
                    <p className="text-sm text-green-700 dark:text-green-300">
                        Todos os pedidos estão em dia ou já foram processados.
                    </p>
                </div>
            )}

            {/* Manual Backordered Items (Cards) - Moved ABOVE Auto-Detected List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {(filteredBackorderedItems || []).map((item, index) => (
                    <ItemCard
                        key={item.id}
                        item={item}
                        index={index}
                        onEdit={(item, imageUrl) => handleEditItem(item, imageUrl)}
                        onResolve={() => onResolveBackorder(item.id)}
                        onDelete={() => onDeleteBackorder(item.id)}
                        skuHeader={skuHeader}
                        quantidadeHeader={quantidadeHeader}
                        idVendaHeader={idVendaHeader}
                        nomeHeader={nomeHeader}
                        dataHeader={dataHeader}
                        imageMappings={imageMappings}
                    />
                ))}
            </div>

            {/* Empty State Message for Manual Items - Only show if NO auto items either */}
            {backorderedItems.length === 0 && lateOrders.length === 0 && (
                <div className="text-center py-16 px-6 bg-gray-50 dark:bg-gray-800/30 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl mb-8">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Nenhum item atrasado!</h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Todos os pedidos estão em dia. Use a busca acima para adicionar um item manualmente, se necessário.</p>
                </div>
            )}

            {/* Auto-Detected Late Orders Section - Collapsible and Moved BELOW Manual Items */}
            {lateOrders.length > 0 && (
                <details className="mb-8 group" open>
                    <summary className="flex items-center gap-2 mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-xl cursor-pointer list-none">
                        <div className="flex-1 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-open:rotate-90 text-yellow-700 dark:text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                            <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-200">
                                Pedidos de Roupas Atrasados ({lateOrders.length})
                            </h2>
                        </div>
                    </summary>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-x-2 border-b-2 border-yellow-400 dark:border-yellow-600 rounded-b-xl p-6 -mt-4 pt-4">
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                            Pedidos com mais de 1 dia que ainda não foram enviados. Escolha uma ação para cada pedido:
                        </p>

                        <div className="space-y-2 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
                            {lateOrders.map((row, index) => {
                                const orderId = String(row[idVendaHeader] || '');
                                const clientName = String(row[nomeHeader] || 'N/A');
                                const sku = String(row[skuHeader] || '');
                                const dateStr = String(row[dataHeader] || '');
                                const quantity = getEffectiveQuantity(sku, String(row[quantidadeHeader] || ''));
                                const canal = getSalesChannel(orderId, row.cnpj || null);
                                const storeStyle = storeStyles[canal] || defaultStoreStyle;
                                const imageUrl = smartImageLookup(sku, imageMappings);
                                const isMLStore = canal.includes('ML');

                                return (
                                    <div key={`late-order-${row._uniqueId}-${index}`} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800/80 rounded-lg border border-yellow-300 dark:border-yellow-700 shadow-sm hover:border-yellow-400 dark:hover:border-yellow-600 transition-colors">
                                        {/* Product Image */}
                                        <div className="w-12 h-12 flex-shrink-0 rounded border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900">
                                            {imageUrl ? (
                                                <img src={imageUrl} alt="Produto" className="w-full h-full object-contain" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                                                    -
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${storeStyle.bg} ${storeStyle.text}`}>
                                                    {canal}
                                                </span>
                                                <div className="flex items-center group/id">
                                                    {isMLStore ? (
                                                        <a
                                                            href={`https://www.mercadolivre.com.br/vendas/novo/mensagens/${orderId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                                        >
                                                            #{orderId}
                                                        </a>
                                                    ) : (
                                                        <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
                                                            #{orderId}
                                                        </span>
                                                    )}
                                                    <div className="opacity-0 group-hover/id:opacity-100 transition-opacity ml-1">
                                                        <CopyButton text={orderId} />
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="font-bold text-gray-900 dark:text-white text-xs truncate">
                                                {clientName}
                                            </p>
                                            <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-tight">
                                                <span className="font-medium text-primary-600 dark:text-primary-400">{transformSku(sku)}</span>
                                                <span className="mx-1.5 opacity-30">|</span>
                                                Qtd: <span className="font-bold">{quantity}</span>
                                                <span className="mx-1.5 opacity-30">|</span>
                                                Data: <span className="font-medium">{dateStr}</span>
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            {/* Confirmar - Send to Criar Pedidos */}
                                            <button
                                                onClick={() => {
                                                    showModal('confirm', 'Confirmar Pedido',
                                                        `Deseja enviar o pedido #${orderId} para a tela "Montar Pedidos"?`,
                                                        () => {
                                                            // Just remove from late orders - it's already in allRows
                                                            setIgnoredLateOrders(prev => new Set(prev).add(row._uniqueId!));
                                                            toast.success(`Pedido #${orderId} disponível em "Montar Pedidos"`);
                                                        }
                                                    );
                                                }}
                                                className="h-8 px-2.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded shadow-sm transition-all active:scale-95 uppercase"
                                                title="Enviar para Montar Pedidos"
                                            >
                                                Confirmar
                                            </button>

                                            {/* Manter - Ignore */}
                                            <button
                                                onClick={() => {
                                                    setIgnoredLateOrders(prev => new Set(prev).add(row._uniqueId!));
                                                    toast.success(`Pedido #${orderId} removido da lista`);
                                                }}
                                                className="h-8 px-2.5 bg-gray-500 hover:bg-gray-600 text-white text-[10px] font-bold rounded shadow-sm transition-all active:scale-95 uppercase"
                                                title="Manter e ignorar"
                                            >
                                                Ignorar
                                            </button>

                                            {/* Deletar */}
                                            <button
                                                onClick={() => {
                                                    showModal('confirm', 'Deletar Pedido',
                                                        `Tem certeza que deseja DELETAR o pedido #${orderId}?`,
                                                        () => {
                                                            if (row._supabaseId) {
                                                                // Delete from database via parent component
                                                                // For now, just ignore it
                                                                setIgnoredLateOrders(prev => new Set(prev).add(row._uniqueId!));
                                                                toast.success(`Pedido #${orderId} removido`);
                                                            }
                                                        }
                                                    );
                                                }}
                                                className="h-8 px-2.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded shadow-sm transition-all active:scale-95 uppercase"
                                                title="Deletar pedido"
                                            >
                                                Deletar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </details>
            )}



            {/* Manual Backordered Items List */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {(filteredBackorderedItems || []).map((item, index) => (
                    <ItemCard
                        key={item.id}
                        item={item}
                        index={index}
                        onEdit={handleEditItem}
                        onResolve={() => onResolveBackorder(item.id)}
                        onDelete={() => onDeleteBackorder(item.id)}
                        skuHeader={skuHeader}
                        quantidadeHeader={quantidadeHeader}
                        idVendaHeader={idVendaHeader}
                        nomeHeader={nomeHeader}
                        dataHeader={dataHeader}
                        imageMappings={imageMappings}
                    />
                ))}
            </div>

            {resolvedItems.length > 0 && (
                <details className="mt-10 group" open>
                    <summary className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700/50 rounded-md cursor-pointer list-none">
                        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Itens Resolvidos ({resolvedItems.length})</h3>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </summary>
                    <div className="mt-4 space-y-3">
                        {(filteredResolvedItems || []).slice((resolvedPage - 1) * RESOLVED_PER_PAGE, resolvedPage * RESOLVED_PER_PAGE).map(item => (
                            <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 flex justify-between items-center group">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                        {transformSku(String(item.originalRow[skuHeader] ?? ''))}
                                    </p>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-2 gap-y-1 mt-1">
                                        <span className="font-medium text-blue-600 dark:text-blue-400">#{String(item.originalRow[idVendaHeader] ?? '')}</span>
                                        <span>•</span>
                                        <span>Loja: {item.store || 'N/A'}</span>
                                        <span>•</span>
                                        <span>Atrasado em: {formatDateToDDMM(item.backorderDate)}</span>
                                        <span>•</span>
                                        <span className="text-green-600 dark:text-green-400 font-medium">Resolvido: {formatDate(item.resolvedDate)}</span>
                                    </div>
                                    {item.observation && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic truncate">
                                            Obs: {item.observation}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onUnresolveBackorder(item.id)}
                                        className="p-1 px-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/40 rounded-md transition-colors flex items-center gap-1.5 text-xs font-semibold border border-blue-200 dark:border-blue-800"
                                        title="Recuperar item (volta para Pendentes)"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Recuperar
                                    </button>
                                    <button
                                        onClick={() => onDeleteResolvedItem(item.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                        title="Excluir histórico permanentemente"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Pagination Controls */}
                    {filteredResolvedItems.length > RESOLVED_PER_PAGE && (
                        <div className="flex justify-center mt-4 gap-2">
                            <button
                                onClick={() => setResolvedPage(p => Math.max(1, p - 1))}
                                disabled={resolvedPage === 1}
                                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 disabled:opacity-50 text-xs font-bold"
                            >
                                Anterior
                            </button>
                            <span className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 self-center">
                                Página {resolvedPage} de {Math.ceil(filteredResolvedItems.length / RESOLVED_PER_PAGE)}
                            </span>
                            <button
                                onClick={() => setResolvedPage(p => Math.min(Math.ceil(filteredResolvedItems.length / RESOLVED_PER_PAGE), p + 1))}
                                disabled={resolvedPage >= Math.ceil(filteredResolvedItems.length / RESOLVED_PER_PAGE)}
                                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 disabled:opacity-50 text-xs font-bold"
                            >
                                Próxima
                            </button>
                        </div>
                    )}
                </details>
            )}
        </div>
    );
};
