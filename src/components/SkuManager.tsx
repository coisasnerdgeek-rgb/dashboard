import * as React from 'react';
import { createPortal } from 'react-dom';
import { TableRow } from '../types';
import {
    getProductMap, saveProductMap,
    getColorMap, saveColorMap,
    getSizeMap, saveSizeMap,
    parseSku, buildSku, getSkuError, getCategory, getEffectiveQuantity,
    transformSku, smartImageLookup, learnRulesFromCorrection
} from '../services/skuService';
import { getSalesChannel } from '../services/ecommerceService';
import { cleanAndParse } from '../utils/numberUtils';
import { normalizeString } from '../utils/stringUtils';
import SkuDashboard from './SkuDashboard';

// XLSX is globally available from the script tag in index.html
declare const XLSX: any;

interface SkuManagerProps {
    showModal: (type: 'alert' | 'confirm', title: string, message: string | React.ReactNode, onConfirm?: () => void) => void;
    allRows: TableRow[];
    headers: string[];
    onUpdateRow: (uniqueId: string | number, updatedFields: Partial<TableRow>) => void;
    onBulkUpdateRows: (updates: { uniqueId: string | number, updatedFields: Partial<TableRow> }[]) => void;
    onDeleteRow: (uniqueId: string | number) => void;
    onAddRow: (templateRow: TableRow, newSku: string, newQuantity: number) => void;
    allSkuProductNames: string[];
    masterData: { colors: string[]; sizes: string[] };
    imageMappings?: Record<string, string>;
    activeTab?: 'dashboard' | 'treat' | 'rules';
    ruleVersion?: number;
    onRuleChange?: () => void;
}

interface EditModalProps {
    row: TableRow;
    onClose: () => void;
    onSave: (row: TableRow, newSku: string, newQuantity: number, applyToAll?: boolean) => void;
    onDelete: (uniqueId: string | number) => void;
    onAdd: (templateRow: TableRow, newSku: string, newQuantity: number) => void;
    skuHeader: string;
    affectedCount?: number;
    quantidadeHeader: string;
    nomeHeader: string;
    idVendaHeader?: string;
    ecommerceIdHeader?: string;
    imageMappings?: Record<string, string>;
    allSkuProductNames: string[];
    allRows?: TableRow[]; // NEW: For bulk color correction
    onBulkUpdateRows?: (updates: { uniqueId: string | number, updatedFields: Partial<TableRow> }[]) => void; // NEW
    masterData: { colors: string[]; sizes: string[] };
    onRuleChange?: () => void;
}

export const EditModal: React.FC<EditModalProps> = ({ row, onClose, onSave, onDelete, onAdd, skuHeader, quantidadeHeader, nomeHeader, idVendaHeader, ecommerceIdHeader, imageMappings, allSkuProductNames, allRows, onBulkUpdateRows, masterData, onRuleChange, affectedCount = 1 }) => {
    // Helper to extract basic info
    const getRowInfo = (r: TableRow) => {
        const sku = String(r[skuHeader] ?? '');
        const qty = getEffectiveQuantity(sku, String(r[quantidadeHeader] ?? ''));
        return { sku, qty };
    };

    const initialInfo = getRowInfo(row);

    // Calculate Store/Channel info
    const ecommerceId = String(ecommerceIdHeader ? row[ecommerceIdHeader] : '');
    const internalId = String(idVendaHeader ? row[idVendaHeader] : '');
    const orderId = ecommerceId || internalId;

    // Improved client name detection
    const clientName = React.useMemo(() => {
        if (nomeHeader && row[nomeHeader]) return String(row[nomeHeader]);
        // Fallback common keys
        const fallbacks = ['Nome', 'Nome de contato', 'cliente', 'Destinatário', 'nome'];
        for (const k of fallbacks) {
            if (row[k]) return String(row[k]);
        }
        // Fuzzy match
        const keys = Object.keys(row);
        const nameKey = keys.find(k => k.toLowerCase().includes('nome') || k.toLowerCase().includes('cliente'));
        if (nameKey) return String(row[nameKey]);
        return 'Cliente';
    }, [row, nomeHeader]);

    const store = getSalesChannel(orderId, row.cnpj as 'MM' | 'MVF' | null);

    const marketplaceLink = React.useMemo(() => {
        if (!orderId) return null;
        if (store.includes('SH')) {
            return `https://seller.shopee.com.br/portal/sale/order/${orderId}`;
        } else if (store.includes('ML')) {
            // Priority to messages for ML, as requested previously, or standard details
            return `https://www.mercadolivre.com.br/vendas/novo/mensagens/${orderId}`;
        }
        return null;
    }, [orderId, store]);
    const [isCopied, setIsCopied] = React.useState(false);

    const handleCopyId = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(orderId);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // Form State
    const [product, setProduct] = React.useState('');
    const [color, setColor] = React.useState('');
    const [size, setSize] = React.useState('');
    const [quantity, setQuantity] = React.useState(1);
    const [applyToAll, setApplyToAll] = React.useState(true);
    const [applyColorToAllSizes, setApplyColorToAllSizes] = React.useState(true); // NEW: Bulk color correction

    // Items List State
    // We track items to be saved.
    // 'original': The row we started with.
    // 'new': New rows to create based on the original template.
    type ItemStatus = 'pending' | 'deleted';
    interface EditItem {
        id: string; // 'original' or random for new
        type: 'original' | 'new';
        sku: string;
        quantity: number;
        status: ItemStatus;
        originalRow?: TableRow; // Only for 'original'
    }

    const [items, setItems] = React.useState<EditItem[]>([
        {
            id: 'original',
            type: 'original',
            sku: initialInfo.sku,
            quantity: initialInfo.qty,
            status: 'pending',
            originalRow: row
        }
    ]);

    const modalRef = React.useRef<HTMLDivElement>(null);


    // Initial parsing for form pre-fill (only if we have 1 item and it's invalid/needs fix)
    const initialParsed = React.useMemo(() => parseSku(initialInfo.sku), [initialInfo.sku]);

    React.useEffect(() => {
        const parsed = initialParsed;
        if (parsed) {
            if (parsed.productName) setProduct(parsed.productName);
            if (parsed.colorName !== 'N/A') setColor(parsed.colorName);
            if (parsed.sizeName !== 'N/A') setSize(parsed.sizeName);
            setQuantity(initialInfo.qty);
        }
    }, []);

    // NEW: Detect related SKUs (same product + same original color, different sizes)
    const relatedSizeSkus = React.useMemo(() => {
        if (!allRows || !skuHeader || !initialParsed?.productName || !initialParsed?.colorName || initialParsed.colorName === 'N/A') {
            return [];
        }

        const originalProduct = initialParsed.productName;
        const originalColor = initialParsed.colorName;

        return allRows.filter(r => {
            const rowSku = String(r[skuHeader] ?? '');
            if (rowSku === initialInfo.sku) return false; // Skip the current SKU

            const parsed = parseSku(rowSku);
            return parsed?.productName === originalProduct &&
                parsed?.colorName === originalColor;
        });
    }, [allRows, skuHeader, initialParsed, initialInfo.sku]);

    // AUTO-SYNC FORM TO ORIGINAL ITEM
    // This fixed the "not saving/updating" issue because the form state now
    // correctly updates the item list that handleSaveTransaction uses.
    React.useEffect(() => {
        if (product && color && size) {
            // ALWAYS build base SKU (qty 1) to avoid "KIT" prefix multiplication
            const newSku = buildSku(product, color, size, 1);
            if (newSku) {
                setItems(prev => prev.map(item =>
                    item.id === 'original' && item.status === 'pending'
                        ? { ...item, sku: newSku, quantity: quantity }
                        : item
                ));
            }
        }
    }, [product, color, size, quantity]);

    const imageUrl = React.useMemo(() => {
        if (product && color && size) {
            // Use quantity 1 for image lookup to avoid SKU mismatch issues when qty > 1
            const tempSku = buildSku(product, color, size, 1);
            if (tempSku) {
                return smartImageLookup(tempSku, imageMappings || {});
            }
        }
        return smartImageLookup(initialInfo.sku, imageMappings || {});
    }, [product, color, size, initialInfo.sku, imageMappings]);


    const handleAddToList = () => {
        if (!product || !color || !size) {
            alert("Preencha todos os campos do SKU.");
            return;
        }
        // Use 1 to force atomic SKU
        const newSku = buildSku(product, color, size, 1);
        if (!newSku) {
            alert("Erro ao gerar SKU. Verifique se os valores existem nos mapeamentos.");
            return;
        }

        const newItem: EditItem = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'new',
            sku: newSku,
            quantity: quantity,
            status: 'pending'
        };

        setItems(prev => [...prev, newItem]);
        // Optional: Reset form or keep? Keeping helpful for adding similar items.
    };

    const toggleDeleteItem = (id: string) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                if (item.type === 'new') {
                    // For new items, just remove them? Or mark deleted?
                    // Better to just remove logic-wise, but UX wise "undo" is nice.
                    // Let's just remove new items immediately if "deleted"
                    return null;
                }
                // For original, toggle status
                return { ...item, status: item.status === 'pending' ? 'deleted' : 'pending' };
            }
            return item;
        }).filter(Boolean) as EditItem[]);
    };

    const handleSaveAll = async () => {
        // Validate
        const hasPending = items.some(i => i.status === 'pending');
        const hasDeleted = items.some(i => i.status === 'deleted');

        if (!hasPending && !hasDeleted) {
            onClose();
            return;
        }

        // Process Original
        const originalItem = items.find(i => i.type === 'original');
        if (originalItem) {
            if (originalItem.status === 'deleted') {
                if (originalItem.originalRow) {
                    onDelete(originalItem.originalRow._supabaseId || originalItem.originalRow._uniqueId!);
                }
            } else if (originalItem.status === 'pending') {
                // Check if it changed? Or just save it?
                // The form inputs are for "new" or "current" definition.
                // Wait, the "Add To List" adds NEW items.
                // What about EDITING the original item?
                // The user workflow: "Corrigir Item" -> Usually means "Change THIS item's SKU".
                // So if I select Product/Color/Size and click "Add", I am adding a new one.
                // How do I update the *original*?
                // Maybe I should allow "Update Original" button?
                // OR: The "original" is just purely for reference/deletion, and we add "new" correct versions?
                // IF the user wants to FIX the sku, they are effectively replacing it.
                // So the flow: 
                // 1. Open modal.
                // 2. See original "Invalid SKU".
                // 3. Form: Select "Correct SKU".
                // 4. Click "Add to List" (New Item).
                // 5. Delete "Original" (Invalid Item).
                // 6. Save. -> This deletes the old, adds the new. = UPDATE.

                // Alternative: Allow updating the 'original' item in the list directly?
                // Complexity.

                // Let's stick to: Original is read-only in the list, can only be Deleted.
                // New items are added.
                // If user wants to "Edit", they Add Correct + Delete Wrong.
                // Exception: If they just want to change Quantity? 
                // We'll treat "Update" as "Add New + Delete Old" implicitly if we want, but explicit is better for "Split" scenarios.

                // However, the previous "Salvar Alterações" button did an Update.
                // If the user wants to simple "Fix", they might be confused if they have to "Add new, Delete old".

                // Let's allow "Update Original" action from the form?
                // Or: If items list has "Original" and it is PENDING, we assume it's kept AS IS.
                // If they want to change it, they should probably use the form.

                // HYBRID APPROACH:
                // The form can "Update Selected Item".
                // Default selects "Original".
                // If I change form and click "Update Item", it updates the selected item in the list.
                // If I click "Add New", it adds new.
            }
        }

        // WAIT. Implementing "Update Selected" is complex.
        // Let's support the user request: "lista de itens ... salvar ele ... deletar itens".
        // The user likely wants to break down a kit (1 SKU -> 3 SKUs) or fix a mistake.

        // Revised Strategy:
        // List shows all resulting items.
        // Original starts in the list.
        // User can "Add" new items to the list.
        // User can "Delete" items from the list.
        // For "Original": If it remains in the list (possibly modified?), we Update it. If removed, we Delete it.
        // Actually, "Updating" a row to a different SKU/Qty is fine.

        // Let's make the list items editable? Or map the form to an "active" item?
        // Let's keep it simple:
        // The list is the source of truth for the NEXT state.
        // If 'original' is in the list -> Update it with the values in the list.
        // If 'original' is NOT in the list -> Delete it.
        // Any 'new' items in the list -> Add them.

        // So I need to be able to Edit the list items.
        // But for MVP of this feature:
        // 1. "Original" item is in the list. User can "Delete" it.
        // 2. User can "Add" new items.
        // 3. User can NOT edit the "Original" SKU/Qty in this specific modal version without removing and re-adding?
        //    That's annoying. 
        //    Previous functionality allowed "Fixing" (Editing).
        //    So we MUST support editing the original.

        // Solution:
        // The form updates the "Pending Entry".
        // Use "Adicionar/Atualizar" buttons?

        // Let's keep the "Form" as a way to input data.
        // Action: "Substituir Original" (Updates original in list).
        // Action: "Adicionar Novo" (Adds new row).
        // List Actions: "Excluir".

        // Implementation:
        // "Substituir Original" -> Updates items[0] (if type original).
        // "Adicionar Outro" -> Pushes to items.

        // Process:
        // 1. Iterate items.
        // 2. If item.type == 'original':
        //    If status == 'deleted' -> call `onDelete`.
        //    If status == 'pending' -> call `onSave` (Update) with item.sku/quantity. (Even if same, harmless).
        // 3. If item.type == 'new':
        //    If status == 'pending' -> call `onAdd`.

        // So I need a way to UPDATE the "original" item in the local list using the form values.
    }

    const modalTitle = affectedCount > 1
        ? `Corrigir SKU (Afeta ${affectedCount} itens iguais)`
        : "Corrigir SKU";

    // Actually, let's just make the "Salvar Alterações" button smart.
    // But we need to let the user construct the state.

    // Let's add "Atualizar Original" button if the original is still active.

    const updateOriginalInList = () => {
        if (!product || !color || !size) { alert("Preencha..."); return; }
        // Use 1 to force atomic SKU
        const newSku = buildSku(product, color, size, 1);
        if (!newSku) { alert("Erro SKU..."); return; }

        setItems(prev => prev.map(i =>
            i.type === 'original'
                ? { ...i, sku: newSku, quantity: quantity, status: 'pending' }
                : i
        ));
        // The alert was removed to make it faster/smoother
    };

    const handleSaveTransaction = async () => {
        // Auto-learn rules from corrections if this was an invalid SKU
        try {
            // Only learn if we have a valid target definition
            if (product && color && size) {
                await learnRulesFromCorrection(initialInfo.sku, product, color, size);
            }
        } catch (err) {
            console.error("Error auto-learning SKU rule:", err);
        }

        // NEW: Bulk color correction for all sizes
        if (applyColorToAllSizes && relatedSizeSkus.length > 0 && initialParsed && onBulkUpdateRows && product && color) {
            const originalColor = initialParsed.colorName;
            const newColor = color;

            // Only apply if color actually changed
            if (originalColor !== newColor) {
                const bulkUpdates = relatedSizeSkus.map(relatedRow => {
                    const relatedSku = String(relatedRow[skuHeader] ?? '');
                    const relatedParsed = parseSku(relatedSku);

                    if (relatedParsed) {
                        // Build new SKU with new color
                        const newSku = buildSku(
                            relatedParsed.productName,
                            newColor,
                            relatedParsed.sizeName,
                            getEffectiveQuantity(relatedSku, String(relatedRow[quantidadeHeader] ?? ''))
                        );

                        if (newSku) {
                            return {
                                uniqueId: relatedRow._supabaseId || relatedRow._uniqueId!,
                                updatedFields: { [skuHeader]: newSku }
                            };
                        }
                    }
                    return null;
                }).filter(Boolean) as { uniqueId: string | number, updatedFields: Partial<TableRow> }[];

                if (bulkUpdates.length > 0) {
                    onBulkUpdateRows(bulkUpdates);
                }
            }
        }

        // Execute all
        const original = items.find(i => i.type === 'original');
        if (original) {
            if (original.status === 'deleted') {
                onDelete(original.originalRow!._supabaseId || original.originalRow!._uniqueId!);
            } else {
                // It might be unchanged or changed. We just send the update.
                // Optimization: Check if changed? No need, supabase handles it.
                onSave(original.originalRow!, original.sku, original.quantity, applyToAll);
            }
        }

        const newItems = items.filter(i => i.type === 'new' && i.status === 'pending');
        newItems.forEach(ni => {
            onAdd(row, ni.sku, ni.quantity);
        });

        onRuleChange?.();
        onClose();
    };

    const modalContent = (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[12000] flex items-center justify-center p-4" onClick={onClose}>
            <div
                ref={modalRef}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Image Sidebar - Full height */}
                <div className="w-full md:w-1/3 bg-gray-50 dark:bg-gray-900 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 min-h-[300px] md:min-h-0 relative">
                    {imageUrl ? (
                        <img src={imageUrl} alt="Produto" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400 h-full">
                            <span className="text-sm italic">Sem imagem</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 p-6 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="flex flex-col gap-0.5">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                                    {clientName}
                                </h3>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">{store}</span>
                                    <span className="text-gray-400">|</span>
                                    <div className="flex items-center gap-1.5 group">
                                        {marketplaceLink ? (
                                            <a href={marketplaceLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-mono font-bold">
                                                {orderId}
                                            </a>
                                        ) : (
                                            <span className="text-gray-500 dark:text-gray-400 font-mono">{orderId}</span>
                                        )}
                                        <button
                                            onClick={handleCopyId}
                                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-primary-600 focus:outline-none"
                                            title="Copiar ID"
                                        >
                                            {isCopied ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {/* Editor Form */}
                    <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Produto</label>
                                <select value={product} onChange={e => setProduct(e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-xs p-2 text-gray-900 dark:text-white">
                                    <option value="">Selecione...</option>
                                    {allSkuProductNames.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-1">
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Cor</label>
                                    <select value={masterData.colors.includes(color) ? color : 'OUTRO'} onChange={e => {
                                        if (e.target.value === 'OUTRO') setColor('');
                                        else setColor(e.target.value);
                                    }} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-xs p-2 text-gray-900 dark:text-white">
                                        <option value="">Selecione...</option>
                                        {masterData.colors.map(c => <option key={c} value={c}>{c}</option>)}
                                        <option value="OUTRO">Outra...</option>
                                    </select>
                                    {(!masterData.colors.includes(color) || color === '') && (
                                        <input type="text" placeholder="Nova cor" value={color} onChange={e => setColor(e.target.value.toUpperCase())} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-xs p-1 text-gray-900 dark:text-white" />
                                    )}
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Tamanho</label>
                                    <select value={masterData.sizes.includes(size) ? size : 'OUTRO'} onChange={e => {
                                        if (e.target.value === 'OUTRO') setSize('');
                                        else setSize(e.target.value);
                                    }} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-xs p-2 text-gray-900 dark:text-white">
                                        <option value="">Selecione...</option>
                                        {masterData.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                                        <option value="OUTRO">Outro...</option>
                                    </select>
                                    {(!masterData.sizes.includes(size) || size === '') && (
                                        <input type="text" placeholder="Novo tam" value={size} onChange={e => setSize(e.target.value.toUpperCase())} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-xs p-1 text-gray-900 dark:text-white" />
                                    )}
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Quantidade</label>
                                    <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-xs p-2 text-gray-900 dark:text-white" />
                                </div>
                            </div>

                            {/* NEW: Bulk color correction checkbox */}
                            {relatedSizeSkus.length > 0 && initialParsed && (
                                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={applyColorToAllSizes}
                                            onChange={(e) => setApplyColorToAllSizes(e.target.checked)}
                                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                            Aplicar correção de cor para todos os {relatedSizeSkus.length + 1} tamanhos de {initialParsed.productName} ({initialParsed.colorName})
                                        </span>
                                    </label>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                {items.some(i => i.type === 'original' && i.status !== 'deleted') && (
                                    <button
                                        onClick={() => {
                                            updateOriginalInList();
                                            // The alert was removed to make it faster/smoother
                                        }}
                                        className="px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-bold rounded hover:bg-blue-200 transition-colors"
                                    >
                                        Atualizar Original
                                    </button>
                                )}
                                <button
                                    onClick={handleAddToList}
                                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                    Adicionar à Lista
                                </button>
                            </div>
                        </div>
                    </div>

                    {affectedCount > 1 && (
                        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-md">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={applyToAll}
                                    onChange={e => setApplyToAll(e.target.checked)}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Aplicar correção para todos os {affectedCount} itens com este erro?
                                </span>
                            </label>
                        </div>
                    )}

                    {/* List of Changes */}
                    <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tipo</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">SKU</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qtd</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qt. Total</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {items.map((item, idx) => (
                                    <tr key={item.id} className={item.status === 'deleted' ? 'bg-red-50 dark:bg-red-900/10 opacity-60' : ''}>
                                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                                            {item.type === 'original' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">Original</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Novo</span>
                                            )}
                                            {item.status === 'deleted' && <span className="ml-2 text-red-600 font-bold">(Excluir)</span>}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-gray-700 dark:text-gray-300">{item.sku}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">{item.quantity}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-xs text-primary-600 dark:text-primary-400 font-bold">
                                            {getEffectiveQuantity(item.sku, item.quantity)}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-right text-xs">
                                            <button
                                                onClick={() => toggleDeleteItem(item.id)}
                                                className={`text-xs font-medium hover:underline ${item.status === 'deleted' ? 'text-gray-500' : 'text-red-600'}`}
                                            >
                                                {item.status === 'deleted' ? (item.type === 'original' ? 'Restaurar' : '') : 'Excluir'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-bold rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
                        <button onClick={handleSaveTransaction} className="px-6 py-2 bg-primary-600 text-white text-sm font-bold rounded-md hover:bg-primary-700 shadow-sm transition-colors">Salvar Alterações</button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

// Start of RuleManager component to satisfy replacement range (unchanged)
interface RuleManagerProps {
    initialMap: Record<string, string>;
    onSaveMap: (newMap: Record<string, string>) => Promise<void>;
    keyLabel: string;
    valueLabel: string;
    keyPlaceholder?: string;
    valuePlaceholder?: string;
    title: string;
    onRuleChange?: () => void;
}

const RuleManager: React.FC<RuleManagerProps> = ({ initialMap, onSaveMap, keyLabel, valueLabel, keyPlaceholder, valuePlaceholder, title, onRuleChange }) => {
    const [rules, setRules] = React.useState<{ key: string, value: string }[]>([]);
    const [newRule, setNewRule] = React.useState({ key: '', value: '' });
    const [filter, setFilter] = React.useState('');
    const [editingKey, setEditingKey] = React.useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        const rulesArray = Object.entries(initialMap).map(([key, value]) => ({ key, value }));
        // Sort by key length descending (longest keys first for specific matches)
        rulesArray.sort((a, b) => b.key.length - a.key.length);
        setRules(rulesArray);
    }, [initialMap]);

    const handleAddOrUpdate = async () => {
        if (newRule.key && newRule.value) {
            let updatedRules = [...rules];

            // If editing and key changed, remove old key
            if (editingKey && editingKey !== newRule.key) {
                updatedRules = updatedRules.filter(r => r.key !== editingKey);
            }

            // Remove existing entry if key matches (to overwrite)
            updatedRules = updatedRules.filter(r => r.key !== newRule.key);

            // Add new/updated rule
            updatedRules.push(newRule);
            updatedRules.sort((a, b) => b.key.length - a.key.length);

            setRules(updatedRules);
            setNewRule({ key: '', value: '' });
            setEditingKey(null);
            await saveToParent(updatedRules);
        }
    };

    const handleEdit = (rule: { key: string, value: string }) => {
        setNewRule({ key: rule.key, value: rule.value });
        setEditingKey(rule.key);
    };

    const handleCancelEdit = () => {
        setNewRule({ key: '', value: '' });
        setEditingKey(null);
    };

    const handleDelete = async (keyToDelete: string) => {
        if (confirm(`Tem certeza que deseja excluir a regra "${keyToDelete}"?`)) {
            const updatedRules = rules.filter(r => r.key !== keyToDelete);
            setRules(updatedRules);
            if (editingKey === keyToDelete) {
                handleCancelEdit();
            }
            await saveToParent(updatedRules);
        }
    };

    const saveToParent = async (currentRules: { key: string, value: string }[]) => {
        const newMap: Record<string, string> = {};
        currentRules.forEach(r => newMap[r.key] = r.value);
        try {
            await onSaveMap(newMap);
            onRuleChange?.();
        } catch (error) {
            console.error("Failed to save map:", error);
            alert("Erro ao salvar regras. Verifique o console.");
        }
    };

    const filteredRules = rules.filter(r =>
        r.key.toLowerCase().includes(filter.toLowerCase()) ||
        r.value.toLowerCase().includes(filter.toLowerCase())
    );

    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([[keyLabel, valueLabel]]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, `${title.replace(/\s/g, '_')}_Template.xlsx`);
    };

    const handleExportRules = () => {
        const data = [[keyLabel, valueLabel], ...rules.map(r => [r.key, r.value])];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Regras");
        XLSX.writeFile(wb, `${title.replace(/\s/g, '_')}_Regras.xlsx`);
    };

    const handleImportRules = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                // Expecting header row, so skip row 0
                if (data.length > 1) {
                    const newMap = { ...initialMap };
                    let addedCount = 0;
                    data.slice(1).forEach((row) => {
                        if (row[0] && row[1]) {
                            newMap[String(row[0])] = String(row[1]);
                            addedCount++;
                        }
                    });

                    const rulesArray = Object.entries(newMap).map(([key, value]) => ({ key, value: String(value) }));
                    rulesArray.sort((a, b) => b.key.length - a.key.length);
                    setRules(rulesArray);
                    await saveToParent(rulesArray);
                    alert(`${addedCount} regras importadas/atualizadas com sucesso!`);
                } else {
                    alert('Planilha vazia ou formato inválido.');
                }
            } catch (error) {
                console.error("Error importing rules:", error);
                alert("Erro ao importar planilha. Verifique o formato.");
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsBinaryString(file);
    };

    const triggerImport = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Filtrar regras..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="flex-grow min-w-[200px] p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />

                <div className="flex gap-2">
                    <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors shadow-sm"
                        title="Baixar modelo para preenchimento"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Baixar Modelo
                    </button>
                    <button
                        onClick={handleExportRules}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50 transition-colors shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Exportar
                    </button>
                    <button
                        onClick={triggerImport}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/50 transition-colors shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        Importar
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportRules}
                        className="hidden"
                        accept=".xlsx, .xls, .csv"
                    />
                </div>
            </div>

            <div className={`flex gap-2 p-3 rounded-lg border dark:border-gray-700 transition-colors ${editingKey ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <input
                    type="text"
                    placeholder={keyPlaceholder || keyLabel}
                    value={newRule.key}
                    onChange={e => setNewRule({ ...newRule, key: e.target.value })}
                    className="flex-1 p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <input
                    type="text"
                    placeholder={valuePlaceholder || valueLabel}
                    value={newRule.value}
                    onChange={e => setNewRule({ ...newRule, value: e.target.value })}
                    className="flex-1 p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button
                    onClick={handleAddOrUpdate}
                    disabled={!newRule.key || !newRule.value}
                    className={`px-4 py-2 text-white rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${editingKey ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {editingKey ? 'Atualizar' : 'Adicionar'}
                </button>
                {editingKey && (
                    <button onClick={handleCancelEdit} className="px-3 py-2 bg-gray-300 text-gray-700 rounded text-sm font-semibold hover:bg-gray-400">
                        Cancelar
                    </button>
                )}
            </div>

            <div className="max-h-[65vh] overflow-y-auto border rounded dark:border-gray-700 shadow-sm relative">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
                        <tr className="text-[10px] uppercase font-black tracking-wider">
                            <th className="px-2 py-1.5 text-left text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">{keyLabel}</th>
                            <th className="px-2 py-1.5 text-left text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">{valueLabel}</th>
                            <th className="px-2 py-1.5 text-right text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 w-24">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900/50">
                        {filteredRules.map(rule => (
                            <tr key={rule.key} className={`${editingKey === rule.key ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors`}>
                                <td className="px-2 py-1 font-mono text-xs font-bold text-gray-700 dark:text-gray-300">{rule.key}</td>
                                <td className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400">{rule.value}</td>
                                <td className="px-2 py-1 text-right flex justify-end gap-1">
                                    <button onClick={() => handleEdit(rule)} className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors" title="Editar">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button onClick={() => handleDelete(rule.key)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors" title="Excluir">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const SkuManager: React.FC<SkuManagerProps> = ({ showModal, allRows, headers, onUpdateRow, onBulkUpdateRows, onDeleteRow, onAddRow, allSkuProductNames, masterData, imageMappings, activeTab: initialTab, ruleVersion, onRuleChange }) => {
    const [activeTab, setActiveTab] = React.useState<'dashboard' | 'treat' | 'rules'>(initialTab || 'dashboard');
    const [ruleTab, setRuleTab] = React.useState<'products' | 'colors' | 'sizes'>('products');

    React.useEffect(() => {
        const savedTab = localStorage.getItem('sku_activeTab');
        if (savedTab && (savedTab === 'dashboard' || savedTab === 'treat' || savedTab === 'rules')) {
            setActiveTab(savedTab);
            localStorage.removeItem('sku_activeTab');
        } else if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    const { skuHeader, quantidadeHeader, idVendaHeader, ecommerceIdHeader, nomeHeader } = React.useMemo(() => {
        const find = (key: string) => headers.find(h => normalizeString(h).includes(key));
        return {
            skuHeader: find('sku'),
            quantidadeHeader: find('quantidade'),
            idVendaHeader: find('numero da ordem de compra'),
            ecommerceIdHeader: find('identificador do pedido e-commerce'),
            nomeHeader: find('nome'),
        };
    }, [headers]);

    const invalidGroups = React.useMemo(() => {
        if (!skuHeader) return [];

        const groups = new Map<string, { sku: string; sampleRow: TableRow; rows: TableRow[]; count: number; error: any }>();

        allRows.forEach(row => {
            const sku = String(row[skuHeader] ?? '');
            if (!sku) return;

            // getSkuError now handles all categories, so we don't filter by category here
            const error = getSkuError(sku);
            if (error !== null) {
                if (!groups.has(sku)) {
                    groups.set(sku, { sku, sampleRow: row, rows: [], count: 0, error });
                }
                const group = groups.get(sku)!;
                group.rows.push(row);
                group.count++;
            }
        });

        return Array.from(groups.values());
    }, [allRows, skuHeader, ruleVersion]);

    // Total count of invalid items (not deduplicated) for badge
    const totalInvalidCount = React.useMemo(() => {
        if (!skuHeader) return 0;
        const situacaoHeader = headers.find(h => normalizeString(h).includes('situacao'));

        return allRows.filter(row => {
            // Filter out cancelled orders
            if (situacaoHeader && normalizeString(String(row[situacaoHeader] ?? '')) === 'cancelado') return false;

            const sku = String(row[skuHeader] ?? '');
            if (!sku) return false;

            // Check all categories, not just Roupas
            const error = getSkuError(sku);
            return error !== null;
        }).length;
    }, [allRows, skuHeader, headers, ruleVersion]);

    const [editingGroup, setEditingGroup] = React.useState<{ row: TableRow, count: number, rows: TableRow[] } | null>(null);
    const [clickPosition, setClickPosition] = React.useState<{ x: number, y: number } | null>(null);

    const handleEditRow = (row: TableRow, count: number, rows: TableRow[], e?: React.MouseEvent) => {
        if (e) setClickPosition({ x: e.clientX, y: e.clientY });
        setEditingGroup({ row, count, rows });
    };

    const handleSaveRow = (row: TableRow, newSku: string, newQuantity: number, applyToAll: boolean = false) => {


        if (applyToAll && editingGroup) {
            const updates = editingGroup.rows.map(targetRow => ({
                uniqueId: targetRow._supabaseId || targetRow._uniqueId!,
                updatedFields: {
                    [skuHeader!]: newSku,
                    [quantidadeHeader!]: newQuantity
                }
            }));
            onBulkUpdateRows(updates);
        } else {
            const uniqueId = row._supabaseId || row._uniqueId;
            if (uniqueId && skuHeader && quantidadeHeader) {
                onUpdateRow(uniqueId, {
                    [skuHeader]: newSku,
                    [quantidadeHeader]: newQuantity
                });
            }
        }

        setEditingGroup(null);
    };

    return (
        <div className="space-y-6">
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'dashboard' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('treat')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'treat' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'}`}
                    >
                        Corrigir Pedidos ({totalInvalidCount})
                    </button>
                    <button
                        onClick={() => setActiveTab('rules')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'rules' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'}`}
                    >
                        Gerenciar Regras
                    </button>
                </nav>
            </div>

            {activeTab === 'dashboard' && <SkuDashboard allRows={allRows} headers={headers} />}

            {activeTab === 'treat' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Itens com SKU Inválido/Incompleto</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Estes itens não foram reconhecidos corretamente e precisam de ajuste manual.</p>
                    </div>
                    {invalidGroups.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            <p>Tudo certo! Nenhum item inválido encontrado.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-tight w-12 text-center">Foto</th>
                                        <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-tight">Venda</th>
                                        <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-tight w-16">Canal</th>
                                        <th className="px-2 py-2 text-center text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-tight w-12">Qtd</th>
                                        <th className="px-2 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-tight">SKU Original</th>
                                        <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-tight">Erro</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-tight w-20">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-900/20 divide-y divide-gray-200 dark:divide-gray-700">
                                    {invalidGroups.map((group) => {
                                        const row = group.sampleRow;
                                        const sku = String(skuHeader ? row[skuHeader] : '');
                                        const error = group.error;
                                        // Prioritize e-commerce ID over internal ID
                                        const ecommerceId = String(ecommerceIdHeader ? row[ecommerceIdHeader] : '');
                                        const internalId = String(idVendaHeader ? row[idVendaHeader] : '');
                                        const orderId = ecommerceId || internalId;
                                        const quantity = String(quantidadeHeader ? row[quantidadeHeader] : '');
                                        const store = getSalesChannel(orderId, row.cnpj as 'MM' | 'MVF' | null);

                                        let storeUrl = '#';
                                        if (store.includes('SH')) {
                                            storeUrl = `https://seller.shopee.com.br/portal/sale/order/${orderId}`;
                                        } else if (store.includes('ML')) {
                                            storeUrl = `https://www.mercadolivre.com.br/vendas/${orderId}/detalhe`;
                                        }

                                        const imageUrl = smartImageLookup(sku, imageMappings || {});

                                        return (
                                            <tr
                                                key={sku}
                                                onClick={() => handleEditRow(row, group.count, group.rows)}
                                                className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors border-b border-gray-100 dark:border-gray-800"
                                            >
                                                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                                    <div className="flex justify-center">
                                                        <div className="h-8 w-8 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden border border-gray-200 dark:border-gray-600 shadow-sm">
                                                            {imageUrl ? (
                                                                <img className="h-full w-full object-cover" src={imageUrl} alt="" />
                                                            ) : (
                                                                <div className="h-full w-full flex items-center justify-center text-gray-400">
                                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-xs font-black text-gray-900 dark:text-white">
                                                    {storeUrl !== '#' ? (
                                                        <a
                                                            href={storeUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {orderId}
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                        </a>
                                                    ) : (
                                                        orderId
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap">
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${store.includes('ML VEST') ? 'bg-yellow-600/40 text-yellow-200 border-yellow-500/20' :
                                                            store.includes('SH VEST') ? 'bg-orange-600/40 text-orange-200 border-orange-500/20' :
                                                                store.includes('MG VEST') ? 'bg-red-600/40 text-red-200 border-red-500/20' :
                                                                    store.includes('NT VEST') ? 'bg-sky-600/40 text-sky-200 border-sky-500/20' :
                                                                        store.includes('SN VEST') ? 'bg-emerald-600/40 text-emerald-200 border-emerald-500/20' :
                                                                            store.includes('AM VEST') ? 'bg-blue-600/40 text-blue-200 border-blue-500/20' :
                                                                                store.includes('KW VEST') ? 'bg-pink-600/40 text-pink-200 border-pink-500/20' :
                                                                                    store.includes('ML MM') ? 'bg-yellow-600/40 text-yellow-200 border-yellow-500/20' :
                                                                                        store.includes('SH MM') ? 'bg-orange-600/40 text-orange-200 border-orange-500/20' :
                                                                                            store.includes('MG MM') ? 'bg-red-600/40 text-red-200 border-red-500/20' :
                                                                                                store.includes('NT MM') ? 'bg-sky-600/40 text-sky-200 border-sky-500/20' :
                                                                                                    store.includes('SN MM') ? 'bg-emerald-600/40 text-emerald-200 border-emerald-500/20' :
                                                                                                        store.includes('AM MM') ? 'bg-blue-600/40 text-blue-200 border-blue-500/20' :
                                                                                                            store.includes('KW MM') ? 'bg-pink-600/40 text-pink-200 border-pink-500/20' :
                                                                                                                store.includes('BUSINESS') ? 'bg-gray-600/40 text-gray-200 border-gray-500/20' :
                                                                                                                    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                                        }`}>
                                                        {store}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-center font-black text-gray-500 dark:text-gray-300">{quantity}</td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-400 dark:text-gray-500 font-mono italic max-w-[150px] truncate">{sku}</td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-[11px] font-bold text-red-500/80 dark:text-red-400/80">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                                                         {error?.message?.replace('Segmentos não reconhecidos:', 'N/R:')}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-right text-xs font-medium">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEditRow(row, group.count, group.rows, e); }}
                                                        className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded font-bold transition-all text-[10px] shadow-sm uppercase tracking-wider"
                                                    >
                                                        Corrigir
                                                        {group.count > 1 && <span className="ml-1 bg-white text-primary-600 px-1 rounded-sm">{group.count}</span>}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'rules' && (
                <div>
                    <div className="flex space-x-2 mb-4">
                        <button onClick={() => setRuleTab('products')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${ruleTab === 'products' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>Produtos</button>
                        <button onClick={() => setRuleTab('colors')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${ruleTab === 'colors' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>Cores</button>
                        <button onClick={() => setRuleTab('sizes')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${ruleTab === 'sizes' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>Tamanhos</button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                        {ruleTab === 'products' && (
                            <>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Mapeamento de Produtos</h3>
                                <RuleManager
                                    initialMap={getProductMap()}
                                    onSaveMap={saveProductMap}
                                    keyLabel="Prefixo SKU"
                                    valueLabel="Nome do Produto"
                                    keyPlaceholder="Ex: cami-masc"
                                    valuePlaceholder="Ex: Camiseta Masculina"
                                    title="Mapeamento Produtos"
                                    onRuleChange={onRuleChange}
                                />
                            </>
                        )}
                        {ruleTab === 'colors' && (
                            <>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Mapeamento de Cores</h3>
                                <RuleManager
                                    initialMap={getColorMap()}
                                    onSaveMap={saveColorMap}
                                    keyLabel="Código/Nome no SKU"
                                    valueLabel="Nome Padrão"
                                    keyPlaceholder="Ex: pt ou preto"
                                    valuePlaceholder="Ex: Preto"
                                    title="Mapeamento Cores"
                                    onRuleChange={onRuleChange}
                                />
                            </>
                        )}
                        {ruleTab === 'sizes' && (
                            <>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Mapeamento de Tamanhos</h3>
                                <RuleManager
                                    initialMap={getSizeMap()}
                                    onSaveMap={saveSizeMap}
                                    keyLabel="Código no SKU"
                                    valueLabel="Tamanho Padrão"
                                    keyPlaceholder="Ex: p ou 38"
                                    valuePlaceholder="Ex: P"
                                    title="Mapeamento Tamanhos"
                                    onRuleChange={onRuleChange}
                                />
                            </>
                        )}
                    </div>
                </div>
            )}

            {editingGroup && skuHeader && quantidadeHeader && (
                <EditModal
                    row={editingGroup.row}
                    onClose={() => {
                        setEditingGroup(null);
                        setClickPosition(null);
                    }}
                    onSave={handleSaveRow}
                    onDelete={onDeleteRow}
                    onAdd={onAddRow}
                    skuHeader={skuHeader}
                    affectedCount={editingGroup.count}
                    quantidadeHeader={quantidadeHeader}
                    idVendaHeader={idVendaHeader}
                    ecommerceIdHeader={ecommerceIdHeader}
                    imageMappings={imageMappings}
                    allSkuProductNames={allSkuProductNames}
                    allRows={allRows}
                    onBulkUpdateRows={onBulkUpdateRows}
                    masterData={masterData}
                    nomeHeader={nomeHeader || ''}
                    onRuleChange={onRuleChange}
                    clickPosition={clickPosition}
                />
            )}
        </div>
    );
};

export default SkuManager;
