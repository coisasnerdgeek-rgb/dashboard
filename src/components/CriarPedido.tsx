import * as React from 'react';
import { createPortal } from 'react-dom';
import { TableRow, BackorderedItem, SavedOrder, PaymentItem, PriceProduct, OrderTotals, ArchivedSavedOrder, View, PhoneCaseModel, DelayRules, ImageCategory } from '../types';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);
import { parseSku, getEffectiveQuantity, getCategory, transformSku, buildSku, getColorMap, getProductMap, isKit, getSkuError, learnRulesFromCorrection, isPersonalizado } from '../services/skuService';
import { calculateCost } from '../services/priceTableService';
import { getSalesChannel } from '../services/ecommerceService';
import { storeStyles, defaultStoreStyle, STORES } from '../utils/ecommerceUtils';
import { normalizeString } from '../utils/stringUtils';
import { getColorHex, generatePastelColors, getTextColorForBackground } from '../utils/colorUtils';
import { sortSizes } from '../utils/sortUtils';
import { getDeletedOrderIds, addDeletedOrder, bulkAddDeletedOrders, removeDeletedOrder, bulkRemoveDeletedOrders } from '../services/deletedOrdersService';
import { toComparableDate } from '../utils/dateUtils';
import { addMontagemExclusion, removeMontagemExclusion, clearMontagemExclusions } from '../services/montagemExclusionService';
import { cleanAndParse } from '../utils/numberUtils';
import { useAppContext } from '../contexts/AppContext';
// import { View } from '../App'; // Removed duplicate View import (already imported from types)
import { EditModal } from './SkuManager';
import { SkuAdjustmentModal } from './SkuAdjustmentModal';
import { CopyButton } from './common/CopyButton';
import { getSetting, saveSetting } from '../services/supabaseService';


interface ComplexOrdersModalProps {
    isOpen: boolean;
    onClose: () => void;
    productName: string;
    rows: TableRow[];
    skuHeader: string;
    quantidadeHeader: string;
    idVendaHeader: string;
    nomeHeader: string;
    dataHeader: string;
    cnpjHeader?: string;
    imageMappings: Record<string, string>;
    priceTable: PriceProduct[];
    onUpdateRows: (updates: Array<{ uniqueId: string | number, fields: Partial<TableRow> }>) => void;
    onDeleteRows: (uniqueIds: Array<string | number>) => void;
    onAddRows: (items: Array<{ templateRow: TableRow, newSku: string, newQuantity: number }>) => void;
    onEditRow: (row: TableRow) => void;
    deletedRows?: TableRow[];
    onRestoreRow?: (uniqueId: string | number) => void;
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
    deletedOrderIds: Set<string>;
    onSetDeletedOrderIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
}

const ComplexOrdersModal: React.FC<ComplexOrdersModalProps> = ({
    isOpen,
    onClose,
    productName,
    rows,
    skuHeader,
    quantidadeHeader,
    idVendaHeader,
    nomeHeader,
    dataHeader,
    cnpjHeader,
    imageMappings,
    priceTable,
    onUpdateRows,
    onDeleteRows,
    onAddRows,
    onEditRow,
    deletedRows = [],
    onRestoreRow,
    showModal,
    deletedOrderIds,
    onSetDeletedOrderIds
}) => {
    const modalRef = React.useRef<HTMLDivElement>(null);
    const [localRows, setLocalRows] = React.useState<TableRow[]>([]);
    const [pendingUpdates, setPendingUpdates] = React.useState<Array<{ uniqueId: string | number, fields: Partial<TableRow> }>>([]);
    const [pendingDeletions, setPendingDeletions] = React.useState<Array<string | number>>([]);
    const [pendingAdditions, setPendingAdditions] = React.useState<Array<{ templateRow: TableRow, newSku: string, newQuantity: number }>>([]);

    React.useEffect(() => {
        if (isOpen) {
            setLocalRows([...rows]);
            setPendingUpdates([]);
            setPendingDeletions([]);
            setPendingAdditions([]);
        }
    }, [isOpen, rows]);

    const [modalFilter, setModalFilter] = React.useState<'todos' | 'kits' | 'multi'>('todos');

    if (!isOpen) return null;

    const allItems = (localRows || []).filter(row => {
        const id = row._uniqueId || row._supabaseId;
        if ((pendingDeletions || []).includes(id!)) return false;

        const sku = String(row[skuHeader] || '');
        const quantity = (parseInt(String(row[quantidadeHeader] || '1')) || 1);
        const isActuallyKit = isKit(sku) || (row as any)._isKit;
        const isMulti = quantity > 1 && !isActuallyKit;

        if (modalFilter === 'kits') return isActuallyKit;
        if (modalFilter === 'multi') return isMulti;
        return isActuallyKit || quantity > 1;
    });

    const standardItems = allItems.filter(r => !isPersonalizado(String(r[skuHeader] || '')));
    const personalizedItems = allItems.filter(r => isPersonalizado(String(r[skuHeader] || '')));

    const handleConfirm = () => {
        if (pendingUpdates.length > 0) onUpdateRows(pendingUpdates);
        if (pendingDeletions.length > 0) onDeleteRows(pendingDeletions);
        if (pendingAdditions.length > 0) onAddRows(pendingAdditions);
        onClose();
    };

    const getRowPrice = (row: TableRow) => {
        const orderId = String(row[idVendaHeader] || (row as any)._idVenda || '');
        const store = (row as any)._ecommerceStore || getSalesChannel(orderId, row.cnpj || null);
        const sku = String(row[skuHeader] || '');
        const parsed = parseSku(sku);
        if (!parsed || !parsed.productName) return 0;

        const price = calculateCost({
            product: parsed.productName,
            store: store,
            quantities: {
                [parsed.colorName]: { [parsed.sizeName]: 1 }
            }
        } as any, priceTable, store);

        return price;
    };

    const modalContent = (
        <div className="fixed inset-0 z-[11000] overflow-y-auto flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" aria-labelledby="modal-title" role="dialog" aria-modal="true" onClick={onClose}>
            <div
                ref={modalRef}
                onClick={e => e.stopPropagation()}
                className="relative bg-white dark:bg-gray-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all max-w-6xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700 scale-100 opacity-100"
            >
                <div className="bg-gradient-to-r from-primary-600 to-indigo-700 px-6 py-3 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider opacity-90 leading-none">
                                {productName}
                            </h3>
                            <div className="h-4 w-px bg-white/20"></div>
                            <p className="text-[10px] font-black text-white/90 uppercase tracking-widest">
                                Total: <span className="text-white text-sm">
                                    {allItems.reduce((acc, row) => acc + getEffectiveQuantity(String(row[skuHeader] || ''), row[quantidadeHeader]), 0)}
                                </span>
                            </p>
                            {personalizedItems.length > 0 && (
                                <>
                                    <div className="h-4 w-px bg-white/20"></div>
                                    <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest">
                                        Personalizados: <span className="text-white text-sm">
                                            {personalizedItems.reduce((acc, row) => acc + getEffectiveQuantity(String(row[skuHeader] || ''), row[quantidadeHeader]), 0)}
                                        </span>
                                    </p>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex bg-white/10 p-0.5 rounded-lg border border-white/20">
                                {[
                                    { id: 'todos', label: 'Ambos' },
                                    { id: 'kits', label: 'Apenas Kits' },
                                    { id: 'multi', label: 'Apenas +1 Unid' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setModalFilter(tab.id as any)}
                                        className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded transition-all ${modalFilter === tab.id
                                            ? 'bg-white text-primary-600 shadow-sm'
                                            : 'text-white hover:bg-white/10'
                                            } `}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => {
                                    if (allItems.length > 0) {
                                         const baseRow = allItems[0];
                                         const newRow = {
                                             ...baseRow,
                                             _uniqueId: `manual_${Date.now()}`,
                                             _isAvulso: true,
                                             [idVendaHeader]: 'NOVO',
                                             [nomeHeader]: 'Item Avulso',
                                             [dataHeader]: new Date().toLocaleDateString('pt-BR'),
                                             [skuHeader]: '',
                                             [quantidadeHeader]: 1,
                                             _effectiveQuantity: 1
                                         };
                                        setLocalRows(prev => [newRow, ...prev]);
                                        setPendingAdditions(prev => [...prev, { templateRow: baseRow, newSku: '', newQuantity: 1 }]);
                                    }
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-500/30 transition-all active:scale-95 uppercase tracking-wider"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                                Adicionar
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="bg-white/10 hover:bg-white text-white hover:text-primary-700 font-black text-[10px] px-4 py-1.5 rounded-lg shadow-lg uppercase transition-all active:scale-95 border border-white/20 tracking-wider"
                            >
                                Gravar e Atualizar Grade
                            </button>
                            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-full">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner bg-gray-50/30 dark:bg-gray-900/20">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-100 dark:bg-gray-800/80 sticky top-0 z-10 shadow-sm">
                                <tr className="text-left text-[8px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-tighter">
                                    <th className="px-1 py-1 w-10 text-center">Foto</th>
                                    <th className="px-1 py-1 w-10 text-center">Tipo</th>
                                    <th className="px-1 py-1 w-24">Pedido</th>
                                    <th className="px-1 py-1 w-32">Cliente</th>
                                    <th className="px-1 py-1 w-[220px]">SKU Original</th>
                                    <th className="px-1 py-1 w-28 text-center">Cor</th>
                                    <th className="px-1 py-1 w-10 text-center">Tam</th>
                                    <th className="px-1 py-1 w-10 text-center">Qt.</th>
                                    <th className="px-1 py-1 w-16 text-center">Total</th>
                                    <th className="px-1 py-1 w-20 text-center font-bold text-primary-600 dark:text-primary-400">Canal</th>
                                    <th className="px-1 py-1 w-16 text-center font-bold text-purple-600 dark:text-purple-400">Prazo</th>
                                    <th className="px-1 py-1 w-16 text-right pr-2">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-transparent divide-y divide-gray-200 dark:divide-gray-700 font-medium">
                                {standardItems.length > 0 && (
                                    <>
                                        {personalizedItems.length > 0 && (
                                            <tr className="bg-gray-100/50 dark:bg-gray-800/50">
                                                <td colSpan={12} className="px-4 py-1 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                                    Itens Normais
                                                </td>
                                            </tr>
                                        )}
                                        {standardItems.map((row) => {
                                            const orderId = String(row[idVendaHeader] || (row as any)._idVenda || '');
                                            const uniqueId = row._uniqueId || row._supabaseId;
                                            const sku = String(row[skuHeader] || '');
                                            const parsed = parseSku(sku);
                                            const store = (row as any)._ecommerceStore || getSalesChannel(orderId, row.cnpj || null);
                                            const customer = String(row[nomeHeader] || (row as any)._nome || 'N/A');
                                            const imageUrl = imageMappings[orderId] || imageMappings[sku];
                                            const deadline = (row as any)._deadline || '-';

                                            return (
                                                <tr key={String(uniqueId)} className="hover:bg-primary-500/5 dark:hover:bg-primary-400/5 transition-colors group">
                                                    <td className="px-1 py-1 text-center">
                                                        {imageUrl ? (
                                                            <div
                                                                className="h-8 w-8 mx-auto rounded overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all"
                                                                onClick={() => window.open(imageUrl, '_blank')}
                                                                title="Ver imagem original"
                                                            >
                                                                <img src={imageUrl} alt="Produto" className="h-full w-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div className="h-8 w-8 mx-auto rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shadow-inner">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-1 py-1 text-center">
                                                        <div className="flex flex-col gap-0.5 items-center">
                                                            {(row as any)._isKit || isKit(sku) ? (
                                                                <span className="bg-blue-600 text-white text-[7px] font-black px-1 rounded-sm">KIT</span>
                                                            ) : null}
                                                            {parseInt(String(row[quantidadeHeader] || '1')) > 1 ? (
                                                                <span className="bg-amber-500 text-white text-[7px] font-black px-1 rounded-sm">+1</span>
                                                            ) : null}
                                                            {!((row as any)._isKit || isKit(sku)) && parseInt(String(row[quantidadeHeader] || '1')) <= 1 && (
                                                                <span className="text-gray-300 dark:text-gray-600 text-[10px]">-</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-1.5 text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
                                                        <div className="flex items-center gap-1">
                                                            <CopyButton text={orderId} />
                                                            {(() => {
                                                                let storeUrl = '#';
                                                                if (store.includes('SH')) {
                                                                    storeUrl = `https://seller.shopee.com.br/portal/sale/order/${orderId}`;
                                                                } else if (store.includes('ML')) {
                                                                    storeUrl = `https://www.mercadolivre.com.br/vendas/${orderId}/detalhe`;
                                                                }

                                                                return storeUrl !== '#' ? (
                                                                    <a
                                                                        href={storeUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors flex items-center gap-1 group/link"
                                                                    >
                                                                        {orderId}
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                                    </a>
                                                                ) : orderId;
                                                            })()}
                                                        </div >
                                                    </td >
                                                    <td className="px-1 py-1">
                                                        <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 truncate max-w-[80px]" title={customer}>{customer}</div>
                                                    </td>
                                                    <td className="px-1 py-1 overflow-hidden">
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter mb-0.5 truncate max-w-[210px]">{sku}</span>
                                                            <span className="text-[10px] font-black text-primary-600 dark:text-primary-400 truncate max-w-[210px]">{transformSku(sku)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-1 py-1 text-center">
                                                        {(() => {
                                                            const currentColor = parsed?.colorName || '';
                                                            const bgColor = getColorHex(currentColor);
                                                            const textColor = getTextColorForBackground(bgColor);

                                                            return (
                                                                <select
                                                                    value={currentColor}
                                                                    onChange={(e) => {
                                                                        const selectedColor = e.target.value;
                                                                        const currentQty = parseInt(String(row[quantidadeHeader] || '1')) || 1;
                                                                        const newSku = buildSku(parsed?.productName || '', selectedColor, parsed?.sizeName || '', currentQty);

                                                                        const updatedFields = { [skuHeader]: newSku };
                                                                        const updatedRow = { ...row, ...updatedFields };
                                                                        setLocalRows(prev => prev.map(r => (r._uniqueId || r._supabaseId) === uniqueId ? updatedRow : r));
                                                                        setPendingUpdates(prev => {
                                                                            const filtered = prev.filter(p => p.uniqueId !== uniqueId);
                                                                            return [...filtered, { uniqueId: uniqueId!, fields: updatedFields }];
                                                                        });
                                                                        learnRulesFromCorrection(sku, parsed?.productName, selectedColor, parsed?.sizeName);
                                                                    }}
                                                                    style={{
                                                                        backgroundColor: bgColor,
                                                                        color: textColor,
                                                                        borderColor: textColor === '#FFFFFF' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'
                                                                    }}
                                                                    className="w-full text-[10px] font-black border rounded focus:ring-1 focus:ring-primary-500 py-0.5 px-0.5 transition-colors text-center"
                                                                >
                                                                    <option value="">Cor</option>
                                                                    {Array.from(new Set(Object.values(getColorMap()))).sort().map(color => (
                                                                        <option key={color} value={color} style={{ backgroundColor: getColorHex(color), color: getTextColorForBackground(getColorHex(color)) }}>
                                                                            {color.toUpperCase()}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-1 py-1 text-center">
                                                        <input
                                                            type="text"
                                                            value={parsed?.sizeName || ''}
                                                            onChange={(e) => {
                                                                const selectedSize = e.target.value.toUpperCase();
                                                                const currentQty = parseInt(String(row[quantidadeHeader] || '1')) || 1;
                                                                const newSku = buildSku(parsed?.productName || '', parsed?.colorName || '', selectedSize, currentQty);

                                                                const updatedFields = { [skuHeader]: newSku };
                                                                const updatedRow = { ...row, ...updatedFields };
                                                                setLocalRows(prev => prev.map(r => (r._uniqueId || r._supabaseId) === uniqueId ? updatedRow : r));
                                                                setPendingUpdates(prev => {
                                                                    const filtered = prev.filter(p => p.uniqueId !== uniqueId);
                                                                    return [...filtered, { uniqueId: uniqueId!, fields: updatedFields }];
                                                                });
                                                            }}
                                                            className="w-full text-[10px] font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded py-0.5 px-1 uppercase text-center"
                                                        />
                                                    </td>
                                                    <td className="px-1 py-1 text-center">
                                                        <input
                                                            type="number"
                                                            value={row[quantidadeHeader] || 1}
                                                            onChange={(e) => {
                                                                const newQty = parseInt(e.target.value) || 1;
                                                                const newSku = buildSku(parsed?.productName || '', parsed?.colorName || '', parsed?.sizeName || '', newQty);
                                                                const updatedFields = { [quantidadeHeader]: newQty, [skuHeader]: newSku };
                                                                const updatedRow = { ...row, ...updatedFields };
                                                                setLocalRows(prev => prev.map(r => (r._uniqueId || r._supabaseId) === uniqueId ? updatedRow : r));
                                                                setPendingUpdates(prev => {
                                                                    const filtered = prev.filter(p => p.uniqueId !== uniqueId);
                                                                    return [...filtered, { uniqueId: uniqueId!, fields: updatedFields }];
                                                                });
                                                            }}
                                                            className="w-full text-[10px] font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded py-0.5 px-1 text-center"
                                                        />
                                                    </td>
                                                    <td className="px-1 py-1 text-center text-[10px] font-black text-gray-700 dark:text-gray-300">
                                                        R$ {((parseInt(String(row[quantidadeHeader] || '1')) || 1) * getRowPrice(row)).toFixed(2)}
                                                    </td>
                                                    <td className="px-1 py-1 text-center">
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border shadow-sm ${(storeStyles[store] || defaultStoreStyle).bg} ${(storeStyles[store] || defaultStoreStyle).text} ${(storeStyles[store] || defaultStoreStyle).border}`}>
                                                            {store}
                                                        </span>
                                                    </td>
                                                    <td className="px-1 py-1 text-center text-[9px] font-bold text-gray-500 dark:text-gray-400">
                                                        {deadline}
                                                    </td>
                                                    <td className="px-1 py-1 text-right pr-2">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => onEditRow(row)}
                                                                className="p-1 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                                                                title="Editar item"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    showModal('confirm', 'Confirmar Exclusão', 'Excluir este item?', () => {
                                                                        setPendingDeletions(prev => [...prev, uniqueId!]);
                                                                    });
                                                                }}
                                                                className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                                title="Excluir item"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </>
                                )}

                                {personalizedItems.length > 0 && (
                                    <>
                                        <tr className="bg-purple-100/50 dark:bg-purple-900/20">
                                            <td colSpan={12} className="px-4 py-1 text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                                                <div className="flex items-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>
                                                    Pedidos Personalizados
                                                </div>
                                            </td>
                                        </tr>
                                        {personalizedItems.map((row) => {
                                            const orderId = String(row[idVendaHeader] || (row as any)._idVenda || '');
                                            const uniqueId = row._uniqueId || row._supabaseId;
                                            const sku = String(row[skuHeader] || '');
                                            const parsed = parseSku(sku);
                                            const store = (row as any)._ecommerceStore || getSalesChannel(orderId, row.cnpj || null);
                                            const customer = String(row[nomeHeader] || (row as any)._nome || 'N/A');
                                            const imageUrl = imageMappings[orderId] || imageMappings[sku];
                                            const deadline = (row as any)._deadline || '-';

                                            return (
                                                <tr key={String(uniqueId)} className="hover:bg-purple-500/5 dark:hover:bg-purple-400/5 transition-colors group">
                                                    <td className="px-1 py-1 text-center">
                                                        {imageUrl ? (
                                                            <div
                                                                className="h-8 w-8 mx-auto rounded overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
                                                                onClick={() => window.open(imageUrl, '_blank')}
                                                                title="Ver imagem original"
                                                            >
                                                                <img src={imageUrl} alt="Produto" className="h-full w-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div className="h-8 w-8 mx-auto rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shadow-inner">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-1 py-1 text-center">
                                                        <span className="bg-purple-600 text-white text-[7px] font-black px-1 rounded-sm uppercase tracking-tighter">PERSO</span>
                                                    </td>
                                                    <td className="px-2 py-1.5 text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
                                                        <div className="flex items-center gap-1">
                                                            <CopyButton text={orderId} />
                                                            {orderId}
                                                        </div >
                                                    </td >
                                                    <td className="px-1 py-1">
                                                        <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 truncate max-w-[80px]" title={customer}>{customer}</div>
                                                    </td>
                                                    <td className="px-1 py-1 overflow-hidden">
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter mb-0.5 truncate max-w-[210px]">{sku}</span>
                                                            <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 truncate max-w-[210px]">{transformSku(sku)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-1 py-1 text-center">
                                                        <span className="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300">{parsed?.colorName || '-'}</span>
                                                    </td>
                                                    <td className="px-1 py-1 text-center">
                                                        <span className="text-[10px] font-bold uppercase text-gray-700 dark:text-gray-300">{parsed?.sizeName || '-'}</span>
                                                    </td>
                                                    <td className="px-1 py-1 text-center font-black">
                                                        {row[quantidadeHeader] || 1}
                                                    </td>
                                                    <td className="px-1 py-1 text-center text-[10px] font-black text-gray-700 dark:text-gray-300">
                                                        R$ {((parseInt(String(row[quantidadeHeader] || '1')) || 1) * getRowPrice(row)).toFixed(2)}
                                                    </td>
                                                    <td className="px-1 py-1 text-center">
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border shadow-sm ${(storeStyles[store] || defaultStoreStyle).bg} ${(storeStyles[store] || defaultStoreStyle).text} ${(storeStyles[store] || defaultStoreStyle).border}`}>
                                                            {store}
                                                        </span>
                                                    </td>
                                                    <td className="px-1 py-1 text-center text-[9px] font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/10 rounded">
                                                        {deadline}
                                                    </td>
                                                    <td className="px-1 py-1 text-right pr-2">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    showModal('confirm', 'Confirmar Exclusão', 'Excluir este item personalizado?', () => {
                                                                        setPendingDeletions(prev => [...prev, uniqueId!]);
                                                                    });
                                                                }}
                                                                className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                                title="Excluir item"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};


interface CriarPedidoProps {
    headers: string[];
    data: TableRow[];
    onSaveOrder: (order: any) => void;
    savedOrders: SavedOrder[];
    archivedSavedOrders: ArchivedSavedOrder[];
    pendingPayments: PaymentItem[];
    archivedPayments: PaymentItem[];
    onRowClick?: (filter: Record<string, string>) => void;
    onViewOrderDetails?: (row: TableRow) => void;
    backorderedItems: BackorderedItem[];
    onAddToBackorder: (items: TableRow[], itemType?: 'estampa' | 'capinha') => void;
    setCurrentView: (view: View) => void;
    onResolveBackorder: (backorderId: string) => void;
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
    priceTable: PriceProduct[];
    onUpdateRow: (uniqueId: string | number, updatedFields: Partial<TableRow>) => void;
    onBulkUpdateRows: (updates: { uniqueId: string | number, updatedFields: Partial<TableRow> }[]) => void;
    onDeleteRow: (uniqueId: string | number) => void;
    onAddRow: (templateRow: TableRow, newSku: string, newQuantity: number) => void;
    allSkuProductNames: string[];
    masterData: { colors: string[]; sizes: string[] };
    imageMappings: Record<string, string>;
    trackingMappings: Record<string, string>;
    deletedOrderIds: Set<string>;
    onSetDeletedOrderIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
    selectedStore?: string;
    onSetSelectedStore?: (store: string) => void;
    selectedProduct?: string;
    onSetSelectedProduct?: (product: string) => void;
}

const storeBadgeClasses: Record<string, string> = {
    'GLOBAL': 'bg-blue-600 text-white',
    'GUSHI': 'bg-purple-600 text-white',
    'FENOMENAL': 'bg-red-600 text-white',
    'ALFA DEZ': 'bg-orange-500 text-white',
    'MAGIC': 'bg-indigo-600 text-white',
    'INDICE': 'bg-yellow-500 text-black',
    'ERON': 'bg-green-600 text-white',
};

// Helper to format DD/MM/YYYY to DD/MM
const formatDate = (dateString: string | number | undefined): string => {
    if (!dateString) return '';
    const str = String(dateString);
    if (!str.includes('/')) return str;
    const parts = str.split('/');
    if (parts.length === 3) {
        return `${parts[0]}/${parts[1]}`;
    }
    return str;
};

const formatCurrency = (value: number): string => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};



type GridData = Record<string, Record<string, number>>;

const AffectedItemRow: React.FC<{ item: { orderId: string; name: string; sku: string; quantity: number; store: string }; isMLStore: boolean }> = ({ item, isMLStore }) => {
    const [copiedId, setCopiedId] = React.useState(false);

    return (
        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td className="py-2 px-3">
                <span className={`text-xs font-semibold px-2 py-1 rounded ${item.store === 'ATRASADO' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200' :
                    'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                    }`}>
                    {item.store}
                </span>
            </td>
            <td className="py-2 px-3 font-mono text-xs">
                <div className="flex items-center gap-1">
                    {isMLStore ? (
                        <a
                            href={`https://www.mercadolivre.com.br/vendas/novo/mensagens/${item.orderId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 group"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {item.orderId}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                    ) : (
                        <span className="font-mono text-gray-700 dark:text-gray-300">{item.orderId}</span>
                    )}
                    <CopyButton text={item.orderId} />
                </div>
            </td>
            <td className="py-2 px-3 text-gray-600 dark:text-gray-300 truncate max-w-[200px]" title={item.name}>{item.name}</td>
            <td className="py-2 px-3 font-mono text-xs text-gray-700 dark:text-gray-300" title={item.sku}>{item.sku}</td>
            <td className="py-2 px-3 text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary-600 text-white text-[11px] font-black shadow-sm">
                    {item.quantity}x
                </span>
            </td>
        </tr>
    );
};


const AddDropdown: React.FC<{
    items: string[];
    onSelect: (item: string) => void;
    title: string;
    buttonContent: React.ReactNode;
    position?: 'right-0' | 'left-0';
}> = ({ items, onSelect, title, buttonContent, position = 'left-0' }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = React.useState('');

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    React.useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const filteredItems = (items || []).filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()));

    const buttonClasses = "w-full h-full flex items-center justify-center bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-300 rounded-sm hover:bg-primary-200 dark:hover:bg-primary-800 font-bold text-lg";

    if (items.length === 0) {
        return (
            <button title={title} className={`${buttonClasses} opacity-50 cursor-not-allowed`}>
                {buttonContent}
            </button>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                title={title}
                className={buttonClasses}
            >
                {buttonContent}
            </button>
            {isOpen && (
                <div className={`absolute z-20 mt-2 w-48 rounded-lg shadow-xl bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden border-2 border-primary-500/50 ${position}`}>
                    <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-2 py-1 text-sm rounded-md bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            autoFocus
                        />
                    </div>
                    <div className="py-1 max-h-56 overflow-y-auto" role="menu" aria-orientation="vertical">
                        {filteredItems.length > 0 ? filteredItems.map(item => (
                            <a
                                key={item}
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    onSelect(item);
                                    setIsOpen(false);
                                }}
                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 hover:text-primary-700 dark:hover:text-primary-300"
                                role="menuitem"
                            >
                                {item}
                            </a>
                        )) : (
                            <p className="px-4 py-2 text-sm text-gray-500">Nenhum item encontrado.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper to calculate business days and deadlines
const getBusinessDaysDiff = (startDate: Date, endDate: Date) => {
    let count = 0;
    let curDate = new Date(startDate.getTime());
    curDate.setHours(0, 0, 0, 0);
    const targetEndDate = new Date(endDate.getTime());
    targetEndDate.setHours(0, 0, 0, 0);
    while (curDate < targetEndDate) {
        curDate.setDate(curDate.getDate() + 1);
        const day = curDate.getDay();
        if (day !== 0 && day !== 6) count++;
    }
    return count;
};

const getPrazoInfo = (dateStr: string, isPersonalizadoGroup: boolean) => {
    if (!dateStr) return { text: '-', atrasado: false, emRisco: false, diff: 0 };
    let orderDate: Date;
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        orderDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
        orderDate = new Date(dateStr);
    }
    const today = new Date();
    const diff = getBusinessDaysDiff(orderDate, today);
    
    // For Normais: 1 business day. For Personalizados: 5 business days
    const deadline = isPersonalizadoGroup ? 5 : 1;
    const atrasado = diff > deadline;
    const emRisco = isPersonalizadoGroup ? (diff === 4 || diff === 5) : (diff === deadline && diff > 0);
    
    let text = diff === 0 ? 'Hoje' : diff === 1 ? '1 dia util' : `${diff} dias uteis`;
    return { text, atrasado, emRisco, diff };
};

export const CriarPedido: React.FC<CriarPedidoProps> = ({
    headers, data, onSaveOrder, savedOrders, archivedSavedOrders, pendingPayments, archivedPayments, onRowClick,
    onViewOrderDetails,
    backorderedItems, onAddToBackorder, setCurrentView, onResolveBackorder, showModal, priceTable, onUpdateRow, onBulkUpdateRows, onDeleteRow, onAddRow, allSkuProductNames, masterData, imageMappings, trackingMappings,
    deletedOrderIds, onSetDeletedOrderIds: setDeletedOrderIds,
    selectedStore: propsSelectedStore, onSetSelectedStore, selectedProduct: propsSelectedProduct, onSetSelectedProduct
}) => {
    const { globalSearchTerm, selectedCnpj, setSelectedCnpj: onCnpjChange, ruleVersion, refreshRules } = useAppContext();
    const { skuHeader, quantidadeHeader, dataHeader, nomeHeader, idVendaHeader, valorUnitarioHeader, cnpjHeader, lojaHeader, ecommerceIdHeader } = React.useMemo(() => {
        const findHeader = (key: string) => headers.find(h => normalizeString(h).includes(key));
        const findHeaderExact = (key: string) => headers.find(h => normalizeString(h) === key);
        return {
            skuHeader: findHeader('sku') || findHeaderExact('codigo') || findHeaderExact('código') || findHeaderExact('ref') || findHeaderExact('referencia'),
            quantidadeHeader: findHeader('quantidade') || findHeader('qt') || findHeaderExact('qnt') || findHeaderExact('qtd'),
            dataHeader: findHeader('data'),
            nomeHeader: findHeader('nome') || findHeaderExact('contato') || findHeaderExact('cliente'),
            idVendaHeader: findHeader('numero da ordem de compra') || findHeader('pedido') || findHeader('referencia') || findHeaderExact('id') || findHeaderExact('os') || findHeaderExact('venda'),
            valorUnitarioHeader: findHeader('valor unitario') || findHeader('valor'),
            cnpjHeader: findHeader('cnpj'),
            lojaHeader: findHeader('loja') || findHeaderExact('canal'),
            ecommerceIdHeader: findHeader('ecommerce id') || findHeader('ecommerce') || findHeader('id ecommerce'),
        };
    }, [headers]);

    const [selectedProduct, setSelectedProduct] = [propsSelectedProduct || '', onSetSelectedProduct || (() => { })];
    const [selectedStore, setSelectedStore] = [propsSelectedStore || '', onSetSelectedStore || (() => { })];
    const [montarTab, setMontarTab] = React.useState<'normais' | 'personalizados'>('normais');

    const processedRowIds = React.useMemo(() => {
        const ids = new Set<string>();
        [...savedOrders, ...archivedSavedOrders].forEach(order => {
            order._sourceRowIds?.forEach(id => ids.add(String(id)));
        });
        return ids;
    }, [savedOrders, archivedSavedOrders]);

    const [filterByQuantity, setFilterByQuantity] = React.useState(false);
    const [filterByKit, setFilterByKit] = React.useState<'todos' | 'com' | 'sem'>('todos');
    const [filterByAtrasado, setFilterByAtrasado] = React.useState(false);

    const filterAtrasadosBadgeCount = React.useMemo(() => {
        if (!selectedProduct || !skuHeader || montarTab !== 'personalizados') return 0;
        const orders = (data || []).filter(row => {
            const sku = String(row[skuHeader] ?? '');
            if (!isPersonalizado(sku)) return false;
            const parsedSku = parseSku(sku);
            const id = String(row._uniqueId || row._supabaseId || '');
            return parsedSku?.productName === selectedProduct && id && !(processedRowIds || new Set()).has(id) && !(deletedOrderIds || new Set()).has(id);
        });
        return orders.filter(row => {
            const dateStr = String(row[dataHeader] || '');
            const prazo = getPrazoInfo(dateStr, true);
            return prazo.atrasado || prazo.emRisco;
        }).length;
    }, [selectedProduct, skuHeader, data, processedRowIds, deletedOrderIds, montarTab, dataHeader]);

    const [editedQuantities, setEditedQuantities] = React.useState<Record<string, GridData>>(() => {
        const local = localStorage.getItem('ui_montar_edited_quantities');
        if (local) {
            try { return JSON.parse(local); } catch (e) {}
        }
        return {};
    });

    const [isDraftsLoaded, setIsDraftsLoaded] = React.useState(false);

    React.useEffect(() => {
        let mounted = true;
        getSetting('ui_montar_edited_quantities').then(val => {
            if (mounted) {
                if (val) {
                    try {
                        const parsed = JSON.parse(val);
                        setEditedQuantities(prev => ({ ...parsed, ...prev }));
                    } catch (e) {}
                }
                setIsDraftsLoaded(true);
            }
        });
        return () => { mounted = false; };
    }, []);

    React.useEffect(() => {
        if (!isDraftsLoaded) return;
        localStorage.setItem('ui_montar_edited_quantities', JSON.stringify(editedQuantities));
        
        const timeoutId = setTimeout(() => {
            saveSetting('ui_montar_edited_quantities', JSON.stringify(editedQuantities)).catch(console.error);
        }, 1500);

        return () => clearTimeout(timeoutId);
    }, [editedQuantities, isDraftsLoaded]);
    const [activeCell, setActiveCell] = React.useState<{ color: string, size: string, value: string } | null>(null);
    const [copiedId, setCopiedId] = React.useState<string | null>(null);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = React.useState({ canScrollLeft: false, canScrollRight: false });
    const [isTableInView, setIsTableInView] = React.useState(false);
    const [isSyncing, setIsSyncing] = React.useState(false);

    // --- Smart Sync Logic ---
    const handleSmartSync = async (forceTiny: boolean = false) => {
        setIsSyncing(true);
        const start = performance.now();

        try {
            // 1. Identify pending items currently visible
            const pendingItems: { id: string, orderId: string, cnpj: string }[] = [];

            // Collect from current filtered view (ignoring those already marked for deletion)
            productList.forEach(p => {
                const rows = allProductsData[p.name] || [];
                rows.forEach(r => {
                    const uniqueId = String(r._uniqueId || r._supabaseId);
                    if (processedRowIds.has(uniqueId) || deletedOrderIds.has(uniqueId)) return;

                    const status = String(r[situacaoHeader!] || '').toLowerCase();
                    // Double check if it's already completed
                    if (status.includes('enviado') || status.includes('entregue') || status.includes('cancelado')) return;

                    // Add to check list
                    if (r._supabaseId) {
                        pendingItems.push({
                            id: String(r._supabaseId),
                            orderId: String(r[idVendaHeader!]),
                            cnpj: r.cnpj
                        });
                    }
                });
            });

            if (pendingItems.length === 0) {
                toast.success('Nenhum item pendente para verificar.');
                setIsSyncing(false);
                return;
            }

            let updatedCount = 0;

            if (forceTiny) {
                // FORCE UPDATE (Tiny API via Server)
                // Batch in chunks of 20
                const chunks = [];
                for (let i = 0; i < pendingItems.length; i += 20) {
                    chunks.push(pendingItems.slice(i, i + 20));
                }

                for (const chunk of chunks) {
                    const response = await fetch('/api/refresh-order-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: chunk.map(i => ({ id: i.orderId, supabaseId: i.id, cnpj: i.cnpj })) })
                    });

                    if (response.ok) {
                        const resData = await response.json();
                        updatedCount += resData.updated || 0;

                        // We need to invalidate queries to reflect changes in UI efficiently?
                        // Actually, if we just updated Supabase, we should ideally simply REFETCH the main data.
                        // Or we can manually remove them from the UI to be instant.

                        if (resData.details) {
                            resData.details.forEach((u: any) => {
                                // Optimistically remove from view by adding to deleted? 
                                // Or strictly rely on refetch?
                                // Let's rely on refetch for Force Update as it is heavy anyway.
                            });
                        }
                    }
                }

                if (updatedCount > 0) {
                    toast.success(`${updatedCount} pedidos atualizados via Tiny! Recarregando...`);
                    queryClient.invalidateQueries({ queryKey: ['spreadsheetData'] });
                } else {
                    toast('Todos os pedidos já estavam atualizados no Tiny.');
                }

            } else {
                // SMART SYNC (Database Check)
                const ids = pendingItems.map(i => i.id);
                // Dynamically import to avoid circular dep issues if any
                const { syncOrderStatuses } = await import('../services/supabaseService');
                const statuses = await syncOrderStatuses(ids);

                const changedIds: string[] = [];

                statuses.forEach(s => {
                    // Check if status is now completed
                    const statusLower = s.status.toLowerCase();
                    if (statusLower.includes('enviado') || statusLower.includes('entregue') || statusLower.includes('cancelado')) {
                        changedIds.push(s.id);
                    }
                });

                if (changedIds.length > 0) {
                    // We found items that are NOW completed in DB but were pending in UI.
                    // Instead of full refetch, we can just trigger a "soft" refresh or manually hide them?
                    // Re-fetching is safer to ensure data consistency.
                    // Given Supabase is fast, let's invalidate.
                    console.log(`[SmartSync] Found ${changedIds.length} completed items. Refreshing view.`);
                    queryClient.invalidateQueries({ queryKey: ['spreadsheetData'] });
                    toast.success(`${changedIds.length} pedidos finalizados foram removidos da lista!`);
                    updatedCount = changedIds.length;
                } else {
                    toast('Sincronizado: Nenhuma mudança encontrada.');
                }
            }

        } catch (error) {
            console.error('Sync error:', error);
            toast.error('Erro na sincronização');
        } finally {
            setIsSyncing(false);
            console.log(`[SmartSync] Finished in ${Math.round(performance.now() - start)}ms`);
        }
    };
    const [customColors, setCustomColors] = React.useState<string[]>([]);
    const [customSizes, setCustomSizes] = React.useState<string[]>([]);
    const [editingImageUrl, setEditingImageUrl] = React.useState<string | null>(null);
    const [clickPosition, setClickPosition] = React.useState<{ x: number, y: number } | null>(null);
    const [editingRow, setEditingRow] = React.useState<TableRow | null>(null);
    const [isPedidosOriginaisOpen, setIsPedidosOriginaisOpen] = React.useState(true);
    const [isSkuAdjustmentModalOpen, setIsSkuAdjustmentModalOpen] = React.useState(false);
    const [isComplexOrdersModalOpen, setIsComplexOrdersModalOpen] = React.useState(false);
    // const [deletedOrderIds, setDeletedOrderIds] = React.useState<Set<string>>(new Set()); // Hoisted
    const [deletedRows, setDeletedRows] = React.useState<TableRow[]>([]); // Nova lista para itens excluídos na sessão
    const [showDeletedHistory, setShowDeletedHistory] = React.useState(false);
    const [quantityReductionModal, setQuantityReductionModal] = React.useState<{
        isOpen: boolean;
        newQuantity: number;
        currentQuantity: number;
        affectedItems: Array<{ orderId: string; name: string; sku: string; quantity: number; store: string }>;
        color: string;
        size: string;
        onConfirm: () => void;
        onCancel: () => void;
    }>({
        isOpen: false,
        newQuantity: 0,
        currentQuantity: 0,
        affectedItems: [],
        color: '',
        size: '',
        onConfirm: () => { },
        onCancel: () => { }
    });

    const backorderedItemsForProduct = React.useMemo(() => {
        if (!selectedProduct || !skuHeader) return [];
        return (backorderedItems || []).filter(item => {
            const sku = item.editedData
                ? item.editedData[0].sku
                : String(item.originalRow[skuHeader!] ?? '');
            const parsedSku = parseSku(sku);
            return parsedSku?.productName === selectedProduct;
        });
    }, [selectedProduct, backorderedItems, skuHeader]);




    /* Hoisted to App.tsx
    React.useEffect(() => {
        let mounted = true;
        getDeletedOrderIds().then(ids => {
            if (mounted) onSetDeletedOrderIds(new Set(Array.from(ids).map(String)));
        });
        return () => { mounted = false; };
    }, []);
    */

    // Auto-exclude old orders (older than 5 days) - ONLY in "Montar Grade" (atrasados) screen
    React.useEffect(() => {
        if (!data.length || !headers.length) return;

        const dataHeader = headers.find(h => normalizeString(h) === 'data da venda') || headers.find(h => normalizeString(h).includes('data'));
        if (!dataHeader) {
            console.log('[CriarPedido] No date header found, skipping auto-exclusion');
            return;
        }

        // Calculate cutoff date (5 days ago)
        const today = new Date();
        const fiveDaysAgo = new Date(today);
        fiveDaysAgo.setDate(today.getDate() - 5);
        const cutoffDate = fiveDaysAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD

        console.log(`[CriarPedido] Auto-exclusion cutoff date: ${cutoffDate} (5 days ago from ${today.toISOString().split('T')[0]})`);

        const idsToExclude: string[] = [];

        data.forEach(row => {
            const id = row._uniqueId || row._supabaseId;
            if (!id || deletedOrderIds.has(String(id))) return;

            // Don't exclude if it's already processed/saved
            if (processedRowIds.has(id)) {
                console.log(`[CriarPedido] Skipping order ${id} - already processed`);
                return;
            }

            const dateStr = String(row[dataHeader] || '');
            const comparable = toComparableDate(dateStr);

            if (comparable && comparable < cutoffDate) {
                console.log(`[CriarPedido] Marking order ${id} for exclusion - date: ${dateStr} (comparable: ${comparable}) < ${cutoffDate}`);
                idsToExclude.push(String(id));
            }
        });

        if (idsToExclude.length > 0) {
            console.log(`[CriarPedido] Auto-moving ${idsToExclude.length} orders older than 5 days to deletion history.`);
            bulkAddDeletedOrders(idsToExclude).then(success => {
                if (success) {
                    console.log(`[CriarPedido] Successfully added ${idsToExclude.length} orders to deletion history`);
                    setDeletedOrderIds(prev => {
                        const next = new Set(prev);
                        idsToExclude.forEach(id => next.add(id));
                        return next;
                    });
                } else {
                    console.error(`[CriarPedido] Failed to add orders to deletion history`);
                }
            });
        } else {
            console.log(`[CriarPedido] No old orders to exclude`);
        }
    }, [data, headers, deletedOrderIds, processedRowIds]);


    const hasCnpjData = React.useMemo(() => {
        const cnpjHeader = headers.find(h => normalizeString(h) === 'cnpj');
        return data.some(row => row.cnpj || (cnpjHeader && row[cnpjHeader]));
    }, [data, headers]);


    // Scroll logic
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
            const resizeObserver = new ResizeObserver(checkScroll);
            resizeObserver.observe(el);
            el.addEventListener('scroll', checkScroll, { passive: true });
            return () => {
                el.removeEventListener('scroll', checkScroll);
                resizeObserver.unobserve(el);
            };
        }
    }, [checkScroll, selectedProduct]); // Rerun when product changes and table appears

    React.useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => setIsTableInView(entry.isIntersecting), { threshold: 0.1 });

        const currentEl = scrollContainerRef.current;
        if (currentEl) {
            observer.observe(currentEl);
        }

        return () => {
            if (currentEl) {
                observer.unobserve(currentEl);
            }
        };
    }, [selectedProduct]);

    // Garantir que o acordeão de pedidos originais abra quando um produto é selecionado
    React.useEffect(() => {
        if (selectedProduct) {
            setIsPedidosOriginaisOpen(true);
        }
    }, [selectedProduct]);


    const handleScroll = (direction: 'left' | 'right') => {
        const el = scrollContainerRef.current;
        if (el) {
            const scrollAmount = el.clientWidth * 0.8;
            el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(text);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const handleImageClick = (imageUrl: string, orderId: string) => {
        showModal(
            'alert',
            `Imagem do Pedido: ${orderId}`,
            <img src={imageUrl} alt={`Imagem para ${orderId}`} className="max-w-full max-h-[70vh] mx-auto rounded-md" />,
            undefined,
            { maxWidth: 'max-w-4xl', confirmText: 'Fechar' }
        );
    };

    // Calculate the total number of personalized items globally (for the tab badge)
    const globalPersoCount = React.useMemo(() => {
        if (!skuHeader) return 0;
        let count = 0;
        data.forEach(row => {
            const sku = String(row[skuHeader] ?? '');
            if (isPersonalizado(sku)) {
                const id = String(row._uniqueId || row._supabaseId || '');
                if (!deletedOrderIds.has(id) && !processedRowIds.has(id)) {
                    count += ((row as any)._effectiveQuantity || parseInt(String(row[quantidadeHeader!] || '1')) || 1);
                }
            }
        });
        return count;
    }, [data, skuHeader, quantidadeHeader, deletedOrderIds, processedRowIds]);

    const { productList, allProductsData, totalPersonalizedCount } = React.useMemo(() => {
        if (!skuHeader || !quantidadeHeader || !idVendaHeader) {
            return { productList: [], allProductsData: {}, totalPersonalizedCount: 0 };
        }

        const productsData: Record<string, TableRow[]> = {};
        console.log('[CriarPedido DEBUG] Calculando productList. Rows recebidas:', data.length);

        data.forEach(row => {
            const sku = String(row[skuHeader] ?? '');
            const category = getCategory(sku);

            if (category === 'Capinha') {
                // console.log(`[CriarPedido DEBUG] Row ignorada (Capinha): ${sku}`);
                return;
            }

            const parsedSku = parseSku(sku);

            if (!parsedSku || !parsedSku.productName) {
                console.log(`[CriarPedido DEBUG] Row ignorada (Parse Error): ${sku}`, parsedSku);
                return;
            }

            const isPerso = isPersonalizado(sku);
            if (montarTab === 'normais' && isPerso) return;
            if (montarTab === 'personalizados' && !isPerso) return;

            console.log(`[CriarPedido DEBUG] Row Data:`, {
                sku,
                parsedName: parsedSku.productName,
                store: (row as any)._ecommerceStore,
                idVenda: row[idVendaHeader],
                rawCanal: (row as any).canal
            });

            // Prioridade: 1. Campo Loja do banco, 2. _ecommerceStore, 3. getSalesChannel com Ecommerce ID
            const lojaFromDb = lojaHeader ? String(row[lojaHeader] || '') : '';
            const ecommerceId = ecommerceIdHeader ? String(row[ecommerceIdHeader] || '') : '';
            const storeName = lojaFromDb || (row as any)._ecommerceStore || getSalesChannel(ecommerceId || String(row[idVendaHeader]!), row.cnpj || null, (row as any).canal);

            if (storeName !== 'N/A') {
                if (!productsData[parsedSku.productName]) {
                    productsData[parsedSku.productName] = [];
                }
                productsData[parsedSku.productName].push(row);
            } else {
                console.log(`[CriarPedido DEBUG] Row ignorada (Loja N/A): ${sku}`);
            }
        });

        const productInfoMap = new Map<string, {
            name: string;
            itemCount: number;
            incompleteSkuCount: number;
            hasSavedOrder: boolean;
            isBackordered: boolean;
            backorderCount: number;
            kitsCount: number;
            multiUnitCount: number;
            personalizedCount: number;
        }>();

        const backorderCounts: Record<string, number> = {};
        backorderedItems.forEach(item => {
            const sku = item.editedData
                ? item.editedData[0].sku
                : String(item.originalRow[skuHeader!] ?? '');
            
            const isPerso = isPersonalizado(sku);
            if (montarTab === 'normais' && isPerso) return;
            if (montarTab === 'personalizados' && !isPerso) return;

            const productName = parseSku(sku)?.productName;
            if (productName) {
                const quantity = item.editedData
                    ? item.editedData.reduce((sum, current) => sum + current.quantity, 0)
                    : ((item.originalRow as any)._effectiveQuantity || 1);

                backorderCounts[productName] = (backorderCounts[productName] || 0) + quantity;

                if (!productInfoMap.has(productName)) {
                    productInfoMap.set(productName, {
                        name: productName,
                        itemCount: 0,
                        incompleteSkuCount: 0,
                        hasSavedOrder: false,
                        isBackordered: true,
                        backorderCount: 0,
                        kitsCount: 0,
                        multiUnitCount: 0,
                        personalizedCount: 0,
                    });
                } else {
                    productInfoMap.get(productName)!.isBackordered = true;
                }
            }
        });

        productInfoMap.forEach((info, name) => {
            info.backorderCount = backorderCounts[name] || 0;
        });

        const allValidProductNames = Object.keys(productsData).sort();

        allValidProductNames.forEach(productName => {
            const rows = productsData[productName] || [];
            const unprocessedRows = (rows || []).filter(row => {
                const id = row._uniqueId || row._supabaseId;
                return id && !processedRowIds.has(String(id)) && !deletedOrderIds.has(String(id));
            });

            const itemCount = unprocessedRows.reduce((sum, row) => {
                const sku = String(row[skuHeader!]);
                const parsedSku = parseSku(sku);
                if (parsedSku && parsedSku.colorName !== 'N/A' && parsedSku.sizeName !== 'N/A') {
                    // Use pre-calculated effective quantity if available
                    return sum + ((row as any)._effectiveQuantity || 0);
                }
                return sum;
            }, 0);

            const incompleteSkuCount = unprocessedRows.filter(row => {
                const sku = String(row[skuHeader] ?? '');
                const parsedSku = parseSku(sku);
                return !parsedSku || parsedSku.colorName === 'N/A' || parsedSku.sizeName === 'N/A';
            }).length;

            let kitsCount = 0;
            let multiUnitCount = 0;
            let personalizedCount = 0;
            unprocessedRows.forEach(row => {
                const sku = String(row[skuHeader!]);
                if (isPersonalizado(sku)) {
                    personalizedCount++;
                }

                if (isKit(sku)) {
                    kitsCount++;
                } else {
                    const quantity = (row as any)._effectiveQuantity || 1;
                    if (quantity > 1) {
                        multiUnitCount++;
                    }
                }
            });

            const hasSavedOrder = rows.some(r => {
                const id = String(r._uniqueId || r._supabaseId || '');
                return id && processedRowIds.has(id);
            });

            if (productInfoMap.has(productName)) {
                const info = productInfoMap.get(productName)!;
                info.itemCount = itemCount;
                info.incompleteSkuCount = incompleteSkuCount;
                info.hasSavedOrder = hasSavedOrder;
                info.kitsCount = kitsCount;
                info.multiUnitCount = multiUnitCount;
                info.personalizedCount = personalizedCount;
            } else {
                if (itemCount > 0 || incompleteSkuCount > 0 || kitsCount > 0 || multiUnitCount > 0) {
                    productInfoMap.set(productName, {
                        name: productName,
                        itemCount,
                        incompleteSkuCount,
                        hasSavedOrder,
                        isBackordered: false,
                        backorderCount: 0,
                        kitsCount,
                        multiUnitCount,
                        personalizedCount,
                    });
                }
            }
        });

        const availableProductList = Array.from(productInfoMap.values())
            .sort((a, b) => {
                const aIsBackordered = a.backorderCount > 0;
                const bIsBackordered = b.backorderCount > 0;
                if (aIsBackordered && !bIsBackordered) return -1;
                if (!aIsBackordered && bIsBackordered) return 1;
                return (b.itemCount + b.backorderCount) - (a.itemCount + a.backorderCount);
            });

        const totalPersonalizedCount = availableProductList.reduce((sum, p) => sum + p.personalizedCount, 0);

        return {
            productList: availableProductList,
            allProductsData: productsData,
            totalPersonalizedCount
        };
    }, [data, skuHeader, quantidadeHeader, idVendaHeader, lojaHeader, ecommerceIdHeader, backorderedItems, processedRowIds, deletedOrderIds, ruleVersion, montarTab]);


    const { processedPercentage, totalPendingItems, totalProcessedItems, totalPieceCount, ordersWithPrice, ordersWithoutPrice, productPersonalizedTotal } = React.useMemo(() => {
        if (!skuHeader || !quantidadeHeader) return { processedPercentage: 0, totalPendingItems: 0, totalProcessedItems: 0, totalPieceCount: 0, ordersWithPrice: 0, ordersWithoutPrice: 0, productPersonalizedTotal: 0 };

        let totalRawQuantity = 0;
        Object.values(allProductsData).flat().forEach(row => {
            totalRawQuantity += ((row as any)._effectiveQuantity || 0);
        });

        if (totalRawQuantity <= 0) return { processedPercentage: 100, totalPendingItems: 0, totalProcessedItems: 0, totalPieceCount: 0, ordersWithPrice: 0, ordersWithoutPrice: 0, productPersonalizedTotal: 0 };

        const totalProcessedQuantity =
            savedOrders.reduce((sum: number, order: SavedOrder) => sum + (order.totals.totalGeral || 0), 0) +
            pendingPayments.reduce((sum: number, payment: PaymentItem) => sum + payment.totalItems, 0) +
            archivedPayments.reduce((sum: number, payment: PaymentItem) => sum + payment.totalItems, 0);

        const percentage = Math.round((totalProcessedQuantity / totalRawQuantity) * 100);

        // Calculate orders with/without price
        const priceAssociatedProductNames = new Set(priceTable.map(p => p.skuProductName).filter(Boolean));
        let withPrice = 0;
        let withoutPrice = 0;

        productList.forEach(product => {
            if (product.itemCount > 0 || product.backorderCount > 0 || product.incompleteSkuCount > 0) {
                if (priceAssociatedProductNames.has(product.name)) {
                    withPrice++;
                } else {
                    withoutPrice++;
                }
            }
        });

        return {
            processedPercentage: Math.min(100, percentage),
            totalPendingItems: Math.max(0, totalRawQuantity - totalProcessedQuantity),
            totalProcessedItems: totalProcessedQuantity,
            totalPieceCount: totalRawQuantity,
            ordersWithPrice: withPrice,
            ordersWithoutPrice: withoutPrice,
            productPersonalizedTotal: totalPersonalizedCount
        };
    }, [allProductsData, savedOrders, pendingPayments, archivedPayments, skuHeader, quantidadeHeader, priceTable, productList, totalPersonalizedCount]);



    const calculateTotalsForGrid = (grid: GridData, forStore: string): OrderTotals => {
        let totalBranco = 0;
        let totalColorido = 0;
        let totalEspeciais = 0;
        const coresEspeciais = new Set(['vermelho', 'musgo', 'verde', 'royal', 'mescla']);

        Object.entries(grid).forEach(([color, sizeData]) => {
            const totalPorCor = Object.values(sizeData).reduce((sum, q) => sum + q, 0);
            const normalizedColor = normalizeString(color);

            if (forStore === 'GUSHI') {
                if (normalizedColor === 'branco') {
                    totalBranco += totalPorCor;
                } else if (coresEspeciais.has(normalizedColor)) {
                    totalEspeciais += totalPorCor;
                } else {
                    totalColorido += totalPorCor;
                }
            } else {
                if (normalizedColor === 'branco') {
                    totalBranco += totalPorCor;
                } else {
                    totalColorido += totalPorCor;
                }
            }
        });
        const totalGeral = totalBranco + totalColorido + totalEspeciais;
        return { totalBranco, totalColorido, totalEspeciais, totalGeral };
    };

    const { minTotalCost, maxTotalCost } = React.useMemo(() => {
        let minSum = 0;
        let maxSum = 0;
        const destinationStores = ['MAGIC', 'FENOMENAL', 'ERON', 'GUSHI', 'INDICE', 'GLOBAL', 'ALFA DEZ'];

        const getProductPieces = (pName: string) => {
            let total = 0;
            const rows = allProductsData[pName] || [];
            rows.forEach(row => {
                const id = row._uniqueId || row._supabaseId;
                if (id && !processedRowIds.has(String(id)) && !deletedOrderIds.has(String(id))) {
                    total += (row as any)._effectiveQuantity || 0;
                }
            });
            backorderedItems.forEach(item => {
                const sku = item.editedData ? item.editedData[0].sku : String(item.originalRow[skuHeader!] ?? '');
                const parsed = parseSku(sku);
                if (parsed?.productName === pName) {
                    total += item.editedData
                        ? item.editedData.reduce((s, i) => s + i.quantity, 0)
                        : (item.originalRow as any)._effectiveQuantity || 1;
                }
            });
            return total;
        };

        productList.forEach(prod => {
            const totalPieces = getProductPieces(prod.name);
            if (totalPieces <= 0) return;

            const normalizedProdName = normalizeString(prod.name);
            const priceProduct = priceTable.find(p => normalizeString(p.product) === normalizedProdName);

            if (priceProduct) {
                const costs = destinationStores
                    .map(storeName => {
                        const storePrices = priceProduct.prices[storeName];
                        if (!storePrices) return null;
                        return calculateCost({
                            product: prod.name,
                            quantities: { 'UNICO': { 'UNI': totalPieces } },
                            store: storeName
                        } as any, priceTable, storeName);
                    })
                    .filter((c): c is number => c !== null && c > 0);

                if (costs.length > 0) {
                    minSum += Math.min(...costs);
                    maxSum += Math.max(...costs);
                }
            }
        });

        return { minTotalCost: minSum, maxTotalCost: maxSum };
    }, [priceTable, productList, allProductsData, processedRowIds, deletedOrderIds, skuHeader, backorderedItems]);

    const { storeBreakdown, finalGrid, uniqueColors, uniqueSizes, totals, specialCounts } = React.useMemo(() => {
        const productRows = (allProductsData[selectedProduct] || []).filter(row => {
            const id = row._uniqueId || row._supabaseId;
            return id && !processedRowIds.has(String(id)) && !deletedOrderIds.has(String(id));
        });

        const filteredRows = productRows;

        const breakdown: Record<string, OrderTotals> = {};
        const baseGrid: GridData = {};
        const allColors = new Set<string>(customColors);
        const allSizes = new Set<string>(customSizes);

        let kitsCount = 0;
        let multiUnitCount = 0;

        filteredRows.forEach(row => {
            const sku = String(row[skuHeader]!);
            const parsedSku = parseSku(sku);
            // Even if SKU is invalid, we want to count kits/multi if we can recognize them
            // or if the original row suggests them.
            const quantity = (row as any)._effectiveQuantity || 1;
            const lojaFromDb = lojaHeader ? String(row[lojaHeader] || '') : '';
            const ecommerceId = ecommerceIdHeader ? String(row[ecommerceIdHeader] || '') : '';
            const storeName = lojaFromDb || (row as any)._ecommerceStore || getSalesChannel(ecommerceId || String(row[idVendaHeader]!), row.cnpj || null, (row as any).canal);

            if ((row as any)._isKit || isKit(sku)) {
                kitsCount++;
            } else if (quantity > 1) {
                multiUnitCount++;
            }

            if (!parsedSku || parsedSku.colorName === 'N/A' || parsedSku.sizeName === 'N/A') return;

            const { colorName, sizeName } = parsedSku;

            // Populate baseGrid for the final calculation
            allColors.add(colorName);
            allSizes.add(sizeName);
            if (!baseGrid[colorName]) baseGrid[colorName] = {};
            baseGrid[colorName][sizeName] = (baseGrid[colorName][sizeName] || 0) + quantity;

            // Populate breakdown
            if (!breakdown[storeName]) breakdown[storeName] = { totalBranco: 0, totalColorido: 0, totalEspeciais: 0, totalGeral: 0 };
        });

        // NEW: Include backordered items in baseGrid
        backorderedItemsForProduct.forEach(item => {
            const sku = item.editedData ? item.editedData[0].sku : String(item.originalRow[skuHeader!] ?? '');
            const quantity = item.editedData ? item.editedData[0].quantity : ((item.originalRow as any)._effectiveQuantity || 1);
            const parsedSku = parseSku(sku);
            if (!parsedSku || parsedSku.colorName === 'N/A' || parsedSku.sizeName === 'N/A') return;
            const { colorName, sizeName } = parsedSku;

            allColors.add(colorName);
            allSizes.add(sizeName);
            if (!baseGrid[colorName]) baseGrid[colorName] = {};
            baseGrid[colorName][sizeName] = (baseGrid[colorName][sizeName] || 0) + quantity;
        });

        // Recalculate breakdown totals based on filtered rows
        Object.keys(breakdown).forEach(storeName => {
            const storeGrid: GridData = {};
            (filteredRows || []).filter(r => {
                const lojaFromRow = lojaHeader ? String(r[lojaHeader] || '') : '';
                const ecommerceIdFromRow = ecommerceIdHeader ? String(r[ecommerceIdHeader] || '') : '';
                return (lojaFromRow || (r as any)._ecommerceStore || getSalesChannel(ecommerceIdFromRow || String(r[idVendaHeader]!), r.cnpj || null, (r as any).canal)) === storeName;
            })
                .forEach(row => {
                    const sku = String(row[skuHeader]!);
                    const parsedSku = parseSku(sku);
                    if (!parsedSku || parsedSku.colorName === 'N/A' || parsedSku.sizeName === 'N/A') return;
                    const quantity = (row as any)._effectiveQuantity || 1;
                    if (!storeGrid[parsedSku.colorName]) storeGrid[parsedSku.colorName] = {};
                    storeGrid[parsedSku.colorName][parsedSku.sizeName] = (storeGrid[parsedSku.colorName][parsedSku.sizeName] || 0) + quantity;
                });
            breakdown[storeName] = calculateTotalsForGrid(storeGrid, storeName);
        });

        Object.keys(editedQuantities[selectedProduct] || {}).forEach(color => allColors.add(color));
        Object.values(editedQuantities[selectedProduct] || {}).forEach(sizeData => Object.keys(sizeData).forEach(size => allSizes.add(size)));

        const finalGrid = (() => {
            const grid: GridData = JSON.parse(JSON.stringify(baseGrid));
            const currentEdits = editedQuantities[selectedProduct] || {};
            Object.entries(currentEdits).forEach(([color, sizes]) => {
                if (!grid[color]) grid[color] = {};
                Object.entries(sizes).forEach(([size, qty]) => {
                    grid[color][size] = qty;
                });
            });
            return grid;
        })();

        const sortedSizes = sortSizes(Array.from(allSizes));

        const sortedColors = Array.from(allColors).sort((colorA, colorB) => {
            const totalA = Object.values(baseGrid[colorA] || {}).reduce((sum, qty) => sum + qty, 0);
            const totalB = Object.values(baseGrid[colorB] || {}).reduce((sum, qty) => sum + qty, 0);
            if (totalA !== totalB) return totalB - totalA;
            return colorA.localeCompare(colorB);
        });

        return {
            storeBreakdown: breakdown,
            finalGrid: finalGrid,
            uniqueColors: sortedColors,
            uniqueSizes: sortedSizes,
            totals: {
                final: calculateTotalsForGrid(finalGrid, selectedStore)
            },
            specialCounts: { kits: kitsCount, multi: multiUnitCount }
        };
    }, [selectedProduct, allProductsData, skuHeader, lojaHeader, ecommerceIdHeader, idVendaHeader, processedRowIds, deletedOrderIds, customColors, customSizes, editedQuantities, backorderedItemsForProduct, selectedStore, ruleVersion]);


    const relatedOrders = React.useMemo(() => {
        if (!selectedProduct || !skuHeader) return [];

        const orders = (data || []).filter(row => {
            const sku = String(row[skuHeader] ?? '');
            
            const isPerso = isPersonalizado(sku);
            if (montarTab === 'normais' && isPerso) return false;
            if (montarTab === 'personalizados' && !isPerso) return false;

            const parsedSku = parseSku(sku);
            const id = String(row._uniqueId || row._supabaseId || '');
            return parsedSku?.productName === selectedProduct && id && !(processedRowIds || new Set()).has(id) && !(deletedOrderIds || new Set()).has(id);
        });

        let filteredOrders = orders;


        if (filterByQuantity) {
            filteredOrders = (filteredOrders || []).filter(row => {
                const sku = String(row[skuHeader]!);
                const quantity = (row as any)._effectiveQuantity || 1;
                return quantity > 1;
            });
        }

        if (filterByKit === 'com') {
            filteredOrders = (filteredOrders || []).filter(row => (row as any)._isKit || isKit(String(row[skuHeader]!)));
        } else if (filterByKit === 'sem') {
            filteredOrders = (filteredOrders || []).filter(row => !((row as any)._isKit || isKit(String(row[skuHeader]!))));
        }

        if (filterByAtrasado && montarTab === 'personalizados') {
            filteredOrders = (filteredOrders || []).filter(row => {
                const dateStr = String(row[dataHeader] || '');
                const prazo = getPrazoInfo(dateStr, true);
                return prazo.atrasado || prazo.emRisco;
            });
        }

        if (globalSearchTerm) {
            const normalizedSearch = normalizeString(globalSearchTerm);
            return (filteredOrders || []).filter(row => {
                const orderId = String(row[idVendaHeader] ?? '');
                const name = String(row[nomeHeader] ?? '');
                const trackingCode = trackingMappings[orderId];
                return normalizeString(orderId).includes(normalizedSearch) ||
                    normalizeString(name).includes(normalizedSearch) ||
                    (trackingCode && normalizeString(trackingCode).includes(normalizedSearch));
            });
        }

        return filteredOrders;
    }, [selectedProduct, skuHeader, data, globalSearchTerm, filterByQuantity, filterByKit, idVendaHeader, nomeHeader, processedRowIds, trackingMappings, deletedOrderIds, montarTab, filterByAtrasado, dataHeader]);

    const relatedOrdersByStore = React.useMemo(() => {
        const byStore: Record<string, TableRow[]> = {};
        relatedOrders.forEach(row => {
            const storeName = getSalesChannel(String(row[idVendaHeader]!), row.cnpj || null);
            if (!byStore[storeName]) {
                byStore[storeName] = [];
            }
            byStore[storeName].push(row);
        });
        return byStore;
    }, [relatedOrders, idVendaHeader]);

    const relatedImages = React.useMemo(() => {
        if (!skuHeader || !imageMappings) return [];
        const imageMap = new Map<string, string>(); // Use a Map to store unique URLs with their associated order IDs
        relatedOrders.forEach(row => {
            const sku = String(row[skuHeader] ?? '');
            const orderId = String(row[idVendaHeader] ?? '');
            const imageUrl = imageMappings[sku] || imageMappings[orderId]; // Try SKU first, then OrderID as fallback
            if (imageUrl && !imageMap.has(imageUrl)) {
                imageMap.set(imageUrl, orderId);
            }
        });
        return Array.from(imageMap.entries()).map(([url, orderId]) => ({ url, orderId }));
    }, [relatedOrders, skuHeader, idVendaHeader, imageMappings]);


    const handleQuantityChange = React.useCallback((color: string, size: string, value: string) => {
        if (value !== '' && isNaN(parseInt(value, 10))) return;
        setActiveCell({ color, size, value });
    }, []);

    const finishEditing = React.useCallback((color: string, size: string, value: string) => {
        setActiveCell(null);
        if (value === '') {
            updateGrid(color, size, undefined);
            return;
        }

        const newQty = parseInt(value, 10);
        if (isNaN(newQty) || newQty < 0) return;

        // Get the "natural" quantity for this color/size (Original Orders + Existing Backorders)
        // Note: We need to access baseGrid. Since it's inside a memo, we can't directly.
        // We'll calculate it on the fly for this specific cell.
        const calculateBaseForCell = () => {
            let total = 0;
            const productRows = (allProductsData[selectedProduct] || []).filter(row => {
                const id = String(row._uniqueId || row._supabaseId || '');
                return id && !processedRowIds.has(id);
            });
            productRows.forEach(row => {
                const sku = String(row[skuHeader!] || '');
                const parsed = parseSku(sku);
                if (parsed?.colorName === color && parsed?.sizeName === size) {
                    total += (row as any)._effectiveQuantity || 0;
                }
            });
            backorderedItemsForProduct.forEach(item => {
                const sku = item.editedData ? item.editedData[0].sku : String(item.originalRow[skuHeader!] || '');
                const parsed = parseSku(sku);
                if (parsed?.colorName === color && parsed?.sizeName === size) {
                    total += item.editedData ? item.editedData[0].quantity : ((item.originalRow as any)._effectiveQuantity || 0);
                }
            });
            return total;
        };

        const currentTotalOrders = calculateBaseForCell(color, size);

        const updateGrid = (c: string, s: string, qty: number | undefined) => {
            setEditedQuantities(prev => {
                const next = { ...prev };
                const productEdits = { ...(next[selectedProduct] || {}) };
                if (qty === undefined) {
                    if (productEdits[c]) {
                        const { [s]: _, ...restSizes } = productEdits[c];
                        if (Object.keys(restSizes).length === 0) {
                            delete productEdits[c];
                        } else {
                            productEdits[c] = restSizes;
                        }
                    }
                } else {
                    if (!productEdits[c]) productEdits[c] = {};
                    productEdits[c][s] = qty;
                }
                next[selectedProduct] = productEdits;
                return next;
            });
        };

        if (value !== '' && newQty < currentTotalOrders) {
            // Collect affected items details
            const affectedItems: Array<{ orderId: string; name: string; sku: string; quantity: number; store: string }> = [];

            const productRows = (allProductsData[selectedProduct] || []).filter(row => {
                const id = String(row._uniqueId || row._supabaseId || '');
                return id && !processedRowIds.has(id) && !deletedOrderIds.has(id);
            });

            productRows.forEach(row => {
                const sku = String(row[skuHeader!] || '');
                const parsed = parseSku(sku);
                if (parsed?.colorName === color && parsed?.sizeName === size) {
                    affectedItems.push({
                        orderId: String(row[idVendaHeader!] || ''),
                        name: String(row[nomeHeader!] || ''),
                        sku: sku,
                        quantity: (row as any)._effectiveQuantity || 1,
                        store: (row as any)._ecommerceStore || 'N/A'
                    });
                }
            });

            backorderedItemsForProduct.forEach(item => {
                const sku = item.editedData ? item.editedData[0].sku : String(item.originalRow[skuHeader!] || '');
                const parsed = parseSku(sku);
                if (parsed?.colorName === color && parsed?.sizeName === size) {
                    affectedItems.push({
                        orderId: String(item.originalRow[idVendaHeader!] || ''),
                        name: String(item.originalRow[nomeHeader!] || ''),
                        sku: sku,
                        quantity: item.editedData ? item.editedData[0].quantity : ((item.originalRow as any)._effectiveQuantity || 1),
                        store: 'ATRASADO'
                    });
                }
            });

            setQuantityReductionModal({
                isOpen: true,
                newQuantity: newQty,
                currentQuantity: currentTotalOrders,
                affectedItems: affectedItems,
                color,
                size,
                onConfirm: () => {
                    updateGrid(color, size, newQty);
                    setQuantityReductionModal({ ...quantityReductionModal, isOpen: false });
                },
                onCancel: () => {
                    setQuantityReductionModal({ ...quantityReductionModal, isOpen: false });
                }
            });
            return;
        }

        /* 
        // Desativado a pedido do usuário: não criar mais pedidos em 'Atrasados' automaticamente
        if (value !== '' && newQty > currentTotalOrders) {
            // Auto-create ADICIONAL order for the excess
            const excess = newQty - currentTotalOrders;
            const templateRow = (allProductsData[selectedProduct] || []).find(row => {
                const sku = String(row[skuHeader!] || '');
                const parsed = parseSku(sku);
                return parsed?.productName === selectedProduct;
            });

            if (templateRow) {
                const additionalRow = {
                    ...templateRow,
                    _uniqueId: `adicional-${Date.now()}-${Math.random()}`,
                    [skuHeader!]: buildSku(selectedProduct, color, size, 1),
                    [quantidadeHeader!]: excess,
                    [idVendaHeader!]: `ADICIONAL-${color}-${size}`,
                    _ecommerceStore: 'ADICIONAL',
                    _isAdicional: true
                };
                onAddToBackorder([additionalRow], 'estampa');
            }
        }
        */

        updateGrid(color, size, newQty);
    }, [selectedProduct, allProductsData, processedRowIds, skuHeader, quantidadeHeader, idVendaHeader, backorderedItemsForProduct, setEditedQuantities, showModal, onAddToBackorder, quantityReductionModal]);

    const handleAddBackorderToGrid = React.useCallback((item: BackorderedItem) => {
        if (!skuHeader || !quantidadeHeader) return;
        const sku = item.editedData ? item.editedData[0].sku : String(item.originalRow[skuHeader] ?? '');
        const quantity = item.editedData ? item.editedData[0].quantity : cleanAndParse(item.originalRow[quantidadeHeader] as string);
        const parsedSku = parseSku(sku);

        if (parsedSku && parsedSku.colorName !== 'N/A' && parsedSku.sizeName !== 'N/A') {
            const { colorName, sizeName } = parsedSku;

            const currentQtyInGrid = finalGrid[colorName]?.[sizeName] || 0;
            const newTotalQty = currentQtyInGrid + quantity;

            finishEditing(colorName, sizeName, String(newTotalQty));
            onResolveBackorder(item.id);
        } else {
            showModal('alert', 'SKU Inválido', 'Não é possível adicionar este item à grade pois o SKU é inválido ou incompleto.');
        }
    }, [finalGrid, onResolveBackorder, skuHeader, quantidadeHeader, showModal, handleQuantityChange]);

    const handleSave = () => {
        if (!selectedProduct) {
            showModal('alert', 'Atenção', 'Selecione um produto antes de salvar.');
            return;
        }

        if (!selectedStore) {
            showModal('alert', 'Atenção', 'Selecione uma loja de destino antes de salvar.');
            return;
        }

        // IMPORTANT: Explicitly use the selected CNPJ state to ensure the order is tagged correctly.
        // This allows 'Ambos' to be saved as 'Ambos' (merged), or specific CNPJs if filtered.
        const cnpjToSave = selectedCnpj;

        if (totals.final.totalGeral === 0) {
            showModal('alert', 'Atenção', 'A grade está vazia. Adicione quantidades para salvar.');
            return;
        }

        const sourceRowIds = relatedOrders
            .map(row => {
                const sku = String(row[skuHeader!]);
                const parsed = parseSku(sku);
                if (parsed && parsed.colorName !== 'N/A' && parsed.sizeName !== 'N/A') {
                    return row._uniqueId || row._supabaseId;
                }
                return null;
            })
            .filter((id): id is string | number => !!id);

        const order = {
            product: selectedProduct,
            store: selectedStore,
            cnpj: cnpjToSave,
            quantities: finalGrid,
            colors: uniqueColors,
            sizes: uniqueSizes,
            totals: totals.final,
            _sourceRowIds: sourceRowIds,
        };
        onSaveOrder(order);

        // Reset state after saving
        setSelectedProduct('');
        setEditedQuantities(prev => {
            const next = { ...prev };
            delete next[selectedProduct];
            return next;
        });
        setCustomColors([]);
        setCustomSizes([]);
    };

    const handleSkuAdjustment = (e: React.MouseEvent, productName: string) => {
        setClickPosition({ x: e.clientX, y: e.clientY });
        setSelectedProduct(productName);
        setIsSkuAdjustmentModalOpen(true);
    };

    const handleAddColor = (color: string) => {
        if (!customColors.includes(color)) {
            setCustomColors(prev => [...prev, color]);
        }
    };

    const handleAddSize = (size: string) => {
        if (!customSizes.includes(size)) {
            setCustomSizes(prev => [...prev, size]);
        }
    };

    const handleDeleteColor = (colorToDelete: string) => {
        setCustomColors(prev => prev.filter(c => c !== colorToDelete));
        setEditedQuantities(prev => {
            const newEdits = { ...prev };
            delete newEdits[colorToDelete];
            return newEdits;
        });
    };

    const handleUpdateRows = React.useCallback((updates: Array<{ uniqueId: string | number, fields: Partial<TableRow> }>) => {
        updates.forEach(update => onUpdateRow(update.uniqueId, update.fields));
    }, [onUpdateRow]);

    const handleDeleteRows = React.useCallback((uniqueIds: Array<string | number>) => {
        uniqueIds.forEach(id => {
            const rowToDelete = allProductsData[selectedProduct]
                ? (allProductsData[selectedProduct] as TableRow[]).find(r => (r._uniqueId || r._supabaseId) === id)
                : undefined;
            if (rowToDelete) {
                onDeleteRow(id);
                setDeletedRows(prev => [...prev, rowToDelete]);
                setDeletedOrderIds(prev => {
                    const next = new Set(prev);
                    next.add(id);
                    return next;
                });
            }
        });
    }, [allProductsData, selectedProduct, onDeleteRow]);

    const handleAddRows = React.useCallback((items: Array<{ templateRow: TableRow, newSku: string, newQuantity: number }>) => {
        items.forEach(item => onAddRow(item.templateRow, item.newSku, item.newQuantity));
    }, [onAddRow]);


    const handleDeleteSize = (sizeToDelete: string) => {
        setCustomSizes(prev => prev.filter(s => s !== sizeToDelete));
        setEditedQuantities(prev => {
            const newEdits = { ...prev };
            Object.keys(newEdits).forEach(color => {
                delete newEdits[color][sizeToDelete];
            });
            return newEdits;
        });
    };

    const masterColorList = React.useMemo(() => {
        const colors = new Set<string>(Object.values(getColorMap()));
        return Array.from(colors).sort();
    }, []);

    if (!skuHeader || !quantidadeHeader || !idVendaHeader) {
        return (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow-md border border-red-200 dark:border-red-800">
                <div className="text-red-600 dark:text-red-400 font-bold mb-2 text-lg">⚠️ Colunas não identificadas</div>
                <p className="text-gray-600 dark:text-gray-300">O sistema não conseguiu identificar as colunas obrigatórias no arquivo.</p>
                <div className="mt-4 text-left inline-block bg-gray-50 dark:bg-gray-700/50 p-4 rounded text-sm text-gray-500 font-mono">
                    <p>Colunas detectadas no arquivo: {headers.join(', ')}</p>
                    <hr className="my-2 border-gray-200 dark:border-gray-600" />
                    <p>Colunas esperadas:</p>
                    <ul className="list-disc pl-5">
                        <li className={skuHeader ? "text-green-600" : "text-red-600"}>SKU / Código: {skuHeader || "Não encontrado"}</li>
                        <li className={quantidadeHeader ? "text-green-600" : "text-red-600"}>Quantidade: {quantidadeHeader || "Não encontrado"}</li>
                        <li className={idVendaHeader ? "text-green-600" : "text-red-600"}>ID do Pedido: {idVendaHeader || "Não encontrado"}</li>
                    </ul>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Progress Bar - Full width above both columns */}
            <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-primary-600 h-full progress-bar-animated" style={{ width: `${processedPercentage}%` }}></div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Peças: {totalPieceCount}</span>
                    <span className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase whitespace-nowrap">Com preço: {ordersWithPrice}</span>
                    <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase whitespace-nowrap">Sem preço: {ordersWithoutPrice}</span>
                    <span className="text-[10px] font-black text-primary-600 dark:text-primary-400 whitespace-nowrap">{processedPercentage}%</span>
                    {productPersonalizedTotal > 0 && (
                        <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase whitespace-nowrap flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>
                            Perso: {productPersonalizedTotal}
                        </span>
                    )}
                </div>
            </div>


            {/* ── Tab Switcher ─────────────────────────── */}
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-0">
                <button
                    onClick={() => { setMontarTab('normais'); setSelectedProduct(null); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-all ${
                        montarTab === 'normais'
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400 bg-white dark:bg-gray-800'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Pedidos Normais
                </button>
                <button
                    onClick={() => { setMontarTab('personalizados'); setSelectedProduct(null); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-all ${
                        montarTab === 'personalizados'
                            ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                    Personalizados
                    {globalPersoCount > 0 && (
                        <span className="bg-purple-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                            {globalPersoCount}
                        </span>
                    )}
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                {/* Column 1: Products (25%) */}
                <div className="md:w-1/4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700 flex flex-col h-full">
                    {/* CNPJ Filter and Attention Buttons at top - Grid 2x2 */}
                    <div className="mb-3 pb-3 border-b border-gray-100 dark:border-gray-700/50 grid grid-cols-2 gap-2">
                        {/* Row 1, Col 1: CNPJ Filter */}
                        <div className="flex items-center rounded-lg bg-gray-200 dark:bg-gray-700/80 p-0.5 border dark:border-gray-600 h-[40px] box-border">
                            {(['Todos', 'MM', 'MVF'] as const).map((cnpj) => (
                                <button key={cnpj} onClick={() => onCnpjChange(cnpj)}
                                    className={`flex-1 px-2 h-full text-xs font-bold rounded-md transition-all ${selectedCnpj === cnpj ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                                    {cnpj === 'Todos' ? 'Ambos' : cnpj}
                                </button>
                            ))}
                        </div>

                        {/* Row 1, Col 2: ATRASADOS */}
                        {backorderedItems.length > 0 && (
                            <div className="flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-900/40 border-2 border-red-300 dark:border-red-600 px-3 py-2 rounded-lg shadow-sm hover:bg-red-100 dark:hover:bg-red-800/60 transition-colors h-[40px]" title={`${backorderedItems.length} itens atrasados`}>
                                <span className="text-[10px] font-black text-red-700 dark:text-red-300 uppercase">ATRASADOS</span>
                                <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded">{backorderedItems.length}</span>
                            </div>
                        )}

                        {/* Row 2, Col 1: KITS */}
                        {selectedProduct && specialCounts.kits > 0 && (
                            <button
                                onClick={(e) => {
                                    setClickPosition({ x: e.clientX, y: e.clientY });
                                    setIsComplexOrdersModalOpen(true);
                                }}
                                className="flex items-center justify-center gap-1.5 bg-blue-50 dark:bg-blue-900/40 border-2 border-blue-300 dark:border-blue-600 px-3 py-2 rounded-lg shadow-sm hover:bg-blue-100 dark:hover:bg-blue-800/60 transition-colors h-[40px]"
                                title="Editar pedidos de Kit"
                            >
                                <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase">KITS</span>
                                <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded">{specialCounts.kits}</span>
                            </button>
                        )}

                        {/* Row 2, Col 2: +1 */}
                        {selectedProduct && specialCounts.multi > 0 && (
                            <button
                                onClick={(e) => {
                                    setClickPosition({ x: e.clientX, y: e.clientY });
                                    setIsComplexOrdersModalOpen(true);
                                }}
                                className="flex items-center justify-center gap-1.5 bg-amber-50 dark:bg-amber-900/40 border-2 border-amber-300 dark:border-amber-600 px-3 py-2 rounded-lg shadow-sm hover:bg-amber-100 dark:hover:bg-amber-800/60 transition-colors h-[40px]"
                                title="Editar pedidos com múltiplas unidades"
                            >
                                <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase">+1</span>
                                <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded">{specialCounts.multi}</span>
                            </button>
                        )}
                    </div>

                    {/* Price Cards */}
                    <div className="flex gap-2 mb-2">
                        <div className="flex-1 bg-white dark:bg-gray-700 p-2 rounded-lg border border-green-200 dark:border-green-800 shadow-sm flex flex-col items-center justify-center">
                            <span className="text-[9px] font-bold text-green-600 dark:text-green-400 uppercase">Estimativa Mínima</span>
                            <span className="text-sm font-black text-gray-800 dark:text-white">
                                {minTotalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                        <div className="flex-1 bg-white dark:bg-gray-700 p-2 rounded-lg border border-red-200 dark:border-red-800 shadow-sm flex flex-col items-center justify-center">
                            <span className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase">Estimativa Máxima</span>
                            <span className="text-sm font-black text-gray-800 dark:text-white">
                                {maxTotalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                    </div>


                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-2 custom-scrollbar flex flex-col">
                        {productList.map((product, index) => {
                            const isSelected = selectedProduct === product.name;
                            const totalItems = product.itemCount + product.backorderCount + product.incompleteSkuCount;
                            return (
                                <button
                                    key={`${product.name}-${index}`}
                                    onClick={() => {
                                        setSelectedProduct(product.name);
                                        setCustomColors([]);
                                        setCustomSizes([]);
                                    }}
                                    className={`w-full p-1 rounded-lg text-left transition-all duration-200 border-2 ${isSelected ? 'bg-primary-600 text-white border-primary-700 shadow-lg' : 'bg-white dark:bg-gray-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-transparent hover:border-primary-300'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-1.5 truncate">
                                            {(() => {
                                                const hasPrice = priceTable.some(p => p.skuProductName === product.name);
                                                return (
                                                    <div
                                                        className={`w-2 h-2 rounded-full flex-shrink-0 ${hasPrice ? 'bg-green-500' : 'bg-red-500'}`}
                                                        title={hasPrice ? 'Produto com preço cadastrado' : 'Produto sem preço cadastrado'}
                                                    ></div>
                                                );
                                            })()}
                                            <div className="font-semibold text-xs truncate max-w-[150px]">{product.name}</div>
                                        </div>
                                        <div className="flex items-center gap-1 text-[9px]">
                                            {product.isBackordered && product.backorderCount > 0 && (
                                                <span className="flex items-center gap-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 px-1.5 py-0 rounded-full font-bold" title={`${product.backorderCount} item(s) atrasado(s)`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                                                    {product.backorderCount}
                                                </span>
                                            )}
                                            {product.incompleteSkuCount > 0 && (
                                                <span className="flex items-center gap-1 bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 px-2 py-0.5 rounded-full font-bold" title={`${product.incompleteSkuCount} item(s) com SKU inválido`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                    {product.incompleteSkuCount}
                                                </span>
                                            )}
                                            {product.itemCount > 0 && (
                                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${isSelected ? 'bg-white text-primary-600' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'}`} title={`${product.itemCount} item(s) novo(s)`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                                    {product.itemCount}
                                                </span>
                                            )}
                                            {product.kitsCount > 0 && (
                                                <span className="flex items-center gap-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-1.5 py-0 rounded-full font-bold" title={`${product.kitsCount} pedido(s) de kit`}>
                                                    KITS
                                                    <span className="bg-white dark:bg-blue-800/50 text-blue-800 dark:text-blue-200 px-1 rounded-full text-[9px] font-extrabold">{product.kitsCount}</span>
                                                </span>
                                            )}
                                            {product.multiUnitCount > 0 && (
                                                <span className="flex items-center gap-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 px-1.5 py-0 rounded-full font-bold" title={`${product.multiUnitCount} pedido(s) com mais de 1 unidade`}>
                                                    +1
                                                    <span className="bg-white dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-200 px-1 rounded-full text-[9px] font-extrabold">{product.multiUnitCount}</span>
                                                </span>
                                            )}
                                            {product.personalizedCount > 0 && (
                                                <span className="flex items-center gap-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 px-1.5 py-0 rounded-full font-bold" title={`${product.personalizedCount} pedido(s) personalizados`}>
                                                    PERSO
                                                    <span className="bg-white dark:bg-purple-800/50 text-purple-800 dark:text-purple-200 px-1 rounded-full text-[9px] font-extrabold">{product.personalizedCount}</span>
                                                </span>
                                            )}
                                            {totalItems === 0 && !product.hasSavedOrder && (
                                                <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold">
                                                    Vazio
                                                </span>
                                            )}
                                            {totalItems === 0 && product.hasSavedOrder && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 font-bold" title="Todos os itens deste produto já foram processados em grades.">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                    Completo
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Column 2: Configure Grid (60%) */}
                <div className="md:w-[60%] p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl shadow-inner border border-purple-200 dark:border-purple-800/30 flex flex-col h-full">

                    <div className="flex flex-col gap-2 flex-grow">
                        {selectedProduct && Object.keys(storeBreakdown).length > 0 && (
                            <div className="flex-shrink-0">
                                {/* Pedidos por Canal - selos with SALVAR button inline - PRIMEIRO */}
                                <div className="mb-3 flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex flex-wrap gap-2">
                                        {(Object.entries(storeBreakdown) as [string, OrderTotals][])
                                            .sort(([, a], [, b]) => b.totalGeral - a.totalGeral)
                                            .map(([storeName, totals]) => {
                                                if (totals.totalGeral === 0) return null;
                                                const style = storeStyles[storeName] || defaultStoreStyle;
                                                return (
                                                    <div key={storeName} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold ${style.bg} ${style.text} shadow-sm`}>
                                                        <span>{storeName}</span>
                                                        <span className="font-black text-[12px]">{totals.totalGeral}</span>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                    <button
                                        onClick={handleSave}
                                        disabled={!selectedProduct}
                                        className="px-6 py-2 bg-primary-600 text-white font-black text-xs rounded-lg shadow-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all active:scale-95 hover:shadow-primary-500/30 uppercase whitespace-nowrap"
                                    >
                                        SALVAR GRADE
                                    </button>
                                </div>
                                {/* Loja de Destino - botões - SEGUNDO (abaixo dos selos) */}
                                <div className="flex-shrink-0 mb-4">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-black uppercase tracking-wider ${!selectedStore ? 'text-red-500 animate-pulse' : 'text-gray-500 dark:text-gray-400'}`}>
                                                Loja de Destino {!selectedStore && '• OBRIGATÓRIA'}
                                            </span>
                                        </div>
                                        <div className={`flex flex-wrap gap-1.5 p-1.5 rounded-lg transition-all duration-300 ${!selectedStore ? 'bg-red-50 dark:bg-red-900/20 ring-2 ring-red-500/50' : ''}`}>
                                            {['MAGIC', 'FENOMENAL', 'ERON', 'GUSHI', 'INDICE', 'GLOBAL', 'ALFA DEZ'].map(store => (
                                                <button key={store} onClick={() => setSelectedStore(store)}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all border-2 ${selectedStore === store ? `${storeBadgeClasses[store] || 'bg-gray-600 text-white'} border-transparent shadow-lg scale-105` : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary-400 shadow-sm'}`}>
                                                    {store}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>


                            </div>
                        )}

                        {/* Integrated Backorder Section with Scroll */}
                        <div className="mt-1 pt-1 flex flex-col gap-2">
                            {
                                selectedProduct && (
                                    <div className="mt-1 animate-fade-in-scale">
                                        <div className="bg-white dark:bg-gray-800/50 p-1.5 rounded-t-xl shadow-lg border-x border-t border-gray-200 dark:border-gray-700">
                                            <div className="flex justify-between items-center">
                                                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">{selectedProduct}</h2>
                                                <div className="flex items-center gap-2 text-[10px] font-bold">
                                                    {selectedStore === 'GUSHI' && totals.final.totalEspeciais ? (
                                                        <>
                                                            <span>Cores: {totals.final.totalColorido}</span>
                                                            <span>Branco: {totals.final.totalBranco}</span>
                                                            <span>Especiais: {totals.final.totalEspeciais}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>Cores: {totals.final.totalColorido}</span>
                                                            <span>Branco: {totals.final.totalBranco}</span>
                                                        </>
                                                    )}
                                                    <span className="ml-4 text-blue-600 dark:text-blue-400">Total: {totals.final.totalGeral}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* [RESTORED] SKU Adjustment Button */}
                                        {relatedOrders.some(row => {
                                            const sku = String(row[skuHeader!] || '');
                                            return getSkuError(sku) !== null;
                                        }) && (
                                                <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2 border-x border-amber-200 dark:border-amber-800 flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="text-xs font-bold text-amber-800 dark:text-amber-200">Existem SKUs que precisam de ajuste manual para entrar na grade.</span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleSkuAdjustment(e, selectedProduct)}
                                                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-lg shadow-sm transition-all active:scale-95 uppercase tracking-wider"
                                                    >
                                                        Ajustar SKU
                                                    </button>
                                                </div>
                                            )}

                                        <div className="relative">
                                            <div ref={scrollContainerRef} className="overflow-x-auto border border-gray-200 dark:border-gray-700">
                                                <table className="min-w-full border-collapse">
                                                    <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0 z-10">
                                                        <tr className="text-[10px] font-semibold text-gray-800 dark:text-gray-200">
                                                            <th className="border border-gray-400 dark:border-gray-600 p-0 w-8 h-6 align-middle">
                                                                <AddDropdown items={Array.from(masterColorList || []).filter(c => !uniqueColors.includes(c))} onSelect={handleAddColor} title="Adicionar Cor" buttonContent="+" />
                                                            </th>
                                                            {uniqueSizes.map(size => (
                                                                <th key={size} className="relative group border border-gray-400 dark:border-gray-600 p-0.5 w-14 text-[10px]">
                                                                    {size}
                                                                    <button onClick={() => handleDeleteSize(size)} className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 text-[10px]">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                                    </button>
                                                                </th>
                                                            ))}
                                                            <th className="border border-gray-400 dark:border-gray-600 p-0 w-8 h-6 align-middle">
                                                                <AddDropdown items={Array.from(masterData?.sizes || []).filter(s => !uniqueSizes.includes(s))} onSelect={handleAddSize} title="Adicionar Tamanho" buttonContent="+" position="right-0" />
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {uniqueColors.map(color => {
                                                            const bgColor = getColorHex(color);
                                                            const textColor = getTextColorForBackground(bgColor);
                                                            return (
                                                                <tr key={color} className="group">
                                                                    <td className="relative border border-gray-400 dark:border-gray-600 p-0.5 font-bold text-[10px] w-16 h-6 text-center align-middle" style={{ backgroundColor: bgColor, color: textColor }}>
                                                                        {color.toUpperCase()}
                                                                        <button onClick={() => handleDeleteColor(color)} className="absolute -top-1 -left-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                                        </button>
                                                                    </td>
                                                                    {uniqueSizes.map(size => {
                                                                        const baseQty = (finalGrid[color]?.[size] || 0) - (editedQuantities[color]?.[size] || 0);
                                                                        const editedQty = editedQuantities[color]?.[size];
                                                                        const finalQty = finalGrid[color]?.[size] || 0;
                                                                        return (
                                                                            <td key={`${color}-${size}`} className={`border border-gray-400 dark:border-gray-600 p-0 text-center align-middle w-14 h-6 relative group/cell ${finalQty > 0 ? 'bg-red-600/10 dark:bg-red-900/20' : ''}`}>
                                                                                <div className="relative h-full w-full flex items-center justify-center">
                                                                                    <input
                                                                                        type="text"
                                                                                        inputMode="numeric"
                                                                                        value={activeCell?.color === color && activeCell?.size === size ? activeCell.value : (editedQty ?? '')}
                                                                                        onChange={e => handleQuantityChange(color, size, e.target.value)}
                                                                                        onBlur={e => finishEditing(color, size, e.target.value)}
                                                                                        onFocus={() => setActiveCell({ color, size, value: editedQty !== undefined ? String(editedQty) : '' })}
                                                                                        onKeyDown={e => {
                                                                                            if (e.key === 'Enter') {
                                                                                                (e.target as HTMLInputElement).blur();
                                                                                            }
                                                                                        }}
                                                                                        placeholder={String(baseQty > 0 ? baseQty : '')}
                                                                                        className={`w-full h-full text-center text-xs rounded-sm border-none focus:ring-2 focus:ring-primary-500 font-bold bg-transparent no-spinners ${editedQty !== undefined ? 'text-primary-600 dark:text-primary-400' : 'placeholder-red-600 dark:placeholder-red-400 text-gray-400'}`}
                                                                                    />
                                                                                    {editedQty !== 0 && finalQty > 0 && (
                                                                                        <button
                                                                                            onClick={() => handleQuantityChange(color, size, '0')}
                                                                                            className="absolute -right-1 -top-1 opacity-0 group-hover/cell:opacity-100 p-0.5 bg-red-500 text-white rounded-full transition-opacity hover:bg-red-600 z-10 shadow-sm"
                                                                                            title="Zerar"
                                                                                        >
                                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                                                                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 4.293z" clipRule="evenodd" />
                                                                                            </svg>
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="border border-gray-400 dark:border-gray-600 p-2"></td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {isTableInView && scrollState.canScrollLeft && <button onClick={() => handleScroll('left')} className="absolute top-1/2 left-0 -translate-y-1/2 z-20 bg-white/80 dark:bg-gray-900/80 p-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:scale-110" aria-label="Rolar para esquerda"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>}
                                            {isTableInView && scrollState.canScrollRight && <button onClick={() => handleScroll('right')} className="absolute top-1/2 right-0 -translate-y-1/2 z-20 bg-white/80 dark:bg-gray-900/80 p-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:scale-110" aria-label="Rolar para direita"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></button>}
                                        </div>

                                        <details
                                            className="mt-4 group"
                                            open={isPedidosOriginaisOpen}
                                            onToggle={(e) => setIsPedidosOriginaisOpen((e.target as HTMLDetailsElement).open)}
                                        >
                                            <summary className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700/50 rounded-md cursor-pointer list-none">
                                                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300">Pedidos Originais ({relatedOrders.length})</h3>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                            </summary>
                                            <div className="mt-2 p-3 border dark:border-gray-700 rounded-b-md">
                                                <div className="flex flex-wrap items-center justify-between gap-4 mb-3 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-gray-500 uppercase mr-1">Filtros:</span>
                                                        <button
                                                            onClick={() => setFilterByQuantity(!filterByQuantity)}
                                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterByQuantity
                                                                ? 'bg-amber-100 text-amber-800 border-amber-200 border shadow-sm'
                                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-transparent border'
                                                                }`}
                                                        >
                                                            Apenas &gt; 1 Unid
                                                        </button>

                                                        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md p-1 border border-gray-200 dark:border-gray-600">
                                                            <button
                                                                onClick={() => setFilterByKit('todos')}
                                                                className={`px-3 py-1 rounded text-[10px] uppercase font-bold transition-all ${filterByKit === 'todos' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                                            >
                                                                Todos
                                                            </button>
                                                            <button
                                                                onClick={() => setFilterByKit('com')}
                                                                className={`px-3 py-1 rounded text-[10px] uppercase font-bold transition-all ${filterByKit === 'com' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                            >
                                                                Com Kit
                                                            </button>
                                                            <button
                                                                onClick={() => setFilterByKit('sem')}
                                                                className={`px-3 py-1 rounded text-[10px] uppercase font-bold transition-all ${filterByKit === 'sem' ? 'bg-gray-200 text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                            >
                                                                Sem Kit
                                                            </button>
                                                        </div>
                                                        
                                                        {montarTab === 'personalizados' && (
                                                            <button
                                                                onClick={() => setFilterByAtrasado(!filterByAtrasado)}
                                                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all uppercase flex items-center gap-1.5 ${filterByAtrasado
                                                                    ? 'bg-red-100 text-red-800 border-red-200 border shadow-sm dark:bg-red-900/40 dark:text-red-300 dark:border-red-800'
                                                                    : 'bg-white text-gray-600 hover:bg-red-50 hover:text-red-700 border-gray-200 border shadow-sm dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:border-gray-700'
                                                                    }`}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                Atrasados / Em Risco
                                                                {filterAtrasadosBadgeCount > 0 && (
                                                                    <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black ml-1">
                                                                        {filterAtrasadosBadgeCount}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-3 text-[10px] font-medium text-gray-500">
                                                        <span className="uppercase font-bold text-[9px] tracking-wider text-gray-400">Legenda:</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-blue-200"></span>
                                                            <span>Kit</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-100 border border-yellow-200"></span>
                                                            <span>&gt; 1 Unid</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-2.5 h-2.5 rounded-full bg-primary-50 border border-primary-100"></span>
                                                            <span>Padrão</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="max-h-80 overflow-y-auto space-y-4 pr-2">
                                                    {Object.entries(relatedOrdersByStore).map(([store, orders]: [string, TableRow[]]) => (
                                                        <div key={store}>
                                                            <h4 className={`font-bold text-sm ${(storeStyles[store] || defaultStoreStyle).text}`}>{store} ({orders.length})</h4>
                                                            <table className="min-w-full text-xs mt-1">
                                                                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold">
                                                                    <tr>
                                                                        <td className="py-1 px-2">Img</td>
                                                                        <td className="py-1 px-2 w-20">Canal</td>
                                                                        <td className="py-1 px-2">Data</td>
                                                                        <td className="py-1 px-2">ID Pedido</td>
                                                                        <td className="py-1 px-2">SKU</td>
                                                                        <td className="py-1 px-2">Nome</td>
                                                                        {montarTab === 'personalizados' && <td className="py-1 px-2 text-center text-red-600 dark:text-red-400">Prazo</td>}
                                                                        <td className="py-1 px-2">Kit</td>
                                                                        <td className="py-1 px-2 text-right">Qt.</td>
                                                                        <td className="py-1 px-2 text-center">Ações</td>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {orders.map((row, idx) => {
                                                                        const rowId = (row._uniqueId || row._supabaseId) as string | number;
                                                                        const orderId = String(row[idVendaHeader]!);
                                                                        const storeName = getSalesChannel(orderId, row.cnpj || null);
                                                                        const storeStyle = storeStyles[storeName] || defaultStoreStyle;
                                                                        const isMLStore = storeName.startsWith('ML');
                                                                        const sku = String(row[skuHeader]!);
                                                                        const quantity = (row as any)._effectiveQuantity || 1;
                                                                        const unitPrice = cleanAndParse(row[valorUnitarioHeader]!);

                                                                        const isAKit = isKit(sku);
                                                                        const hasMultipleUnits = quantity > 1;

                                                                        let rowClass = "border-b border-gray-200 dark:border-gray-700 cursor-pointer";

                                                                        if (isAKit) {
                                                                            rowClass += " bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60";
                                                                        } else if (hasMultipleUnits) {
                                                                            rowClass += " bg-yellow-100 dark:bg-yellow-900/40 hover:bg-yellow-200 dark:hover:bg-yellow-900/60";
                                                                        } else {
                                                                            rowClass += " hover:bg-primary-50 dark:hover:bg-primary-900/20";
                                                                        }


                                                                        return (
                                                                            <tr key={`${(row._uniqueId || row._supabaseId) as string}-${idx}`} onClick={() => {
                                                                                if (onViewOrderDetails) {
                                                                                    onViewOrderDetails(row);
                                                                                } else {
                                                                                    setEditingRow(row);
                                                                                }
                                                                            }} className={rowClass}>
                                                                                <td className="py-1 px-2">
                                                                                    {(() => {
                                                                                        const productImageUrl = imageMappings[sku] || imageMappings[transformSku(sku)] || imageMappings[orderId] || imageMappings[parseSku(sku)?.productName || ''];
                                                                                        if (productImageUrl) {
                                                                                            return (
                                                                                                <div className="relative group/img cursor-pointer" onClick={(e) => { e.stopPropagation(); handleImageClick(productImageUrl, orderId); }}>
                                                                                                    <img
                                                                                                        src={productImageUrl}
                                                                                                        alt="Ref"
                                                                                                        className="w-8 h-8 object-cover rounded border border-gray-200 dark:border-gray-600 hover:scale-150 transition-transform z-0 hover:z-50 bg-white"
                                                                                                        loading="lazy"
                                                                                                    />
                                                                                                </div>
                                                                                            );
                                                                                        }
                                                                                        return (
                                                                                            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-gray-300">
                                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                                                                                            </div>
                                                                                        );
                                                                                    })()}
                                                                                </td>
                                                                                <td className="py-1 px-2 w-20">
                                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap ${storeStyle.bg} ${storeStyle.text} border ${storeStyle.border}`}>
                                                                                        {storeName}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="py-1 px-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(String(row[dataHeader]!))}</td>
                                                                                <td className="py-1 px-2 font-mono text-gray-800 dark:text-gray-200">
                                                                                    <div className="flex items-center justify-between group">
                                                                                        {isMLStore ? (
                                                                                            <a href={`https://www.mercadolivre.com.br/vendas/novo/mensagens/${orderId}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 dark:text-blue-400 hover:underline">
                                                                                                {orderId}
                                                                                            </a>
                                                                                        ) : (
                                                                                            <span>{orderId}</span>
                                                                                        )}
                                                                                        <button onClick={(e) => { e.stopPropagation(); handleCopy(orderId); }} className="p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-opacity" aria-label="Copiar ID">
                                                                                            {copiedId === orderId ? <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2-2H9a2 2 0 01-2-2V9z" /><path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" /></svg>}
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="py-1 px-2 font-mono text-xs text-gray-700 dark:text-gray-300" title={sku}>{sku}</td>
                                                                                <td className="py-1 px-2 truncate max-w-[130px] text-gray-600 dark:text-gray-300" title={String(row[nomeHeader]!)}>{String(row[nomeHeader]!)}</td>
                                                                                {montarTab === 'personalizados' && (() => {
                                                                                    const dateStr = String(row[dataHeader] || '');
                                                                                    const prazo = getPrazoInfo(dateStr, true);
                                                                                    let badgeClass = "text-gray-600 dark:text-gray-400";
                                                                                    if (prazo.atrasado) badgeClass = "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800 uppercase font-black tracking-wider px-2 py-0.5 rounded-full";
                                                                                    else if (prazo.emRisco) badgeClass = "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800 font-bold px-2 py-0.5 rounded-full";
                                                                                    return (
                                                                                        <td className="py-1 px-2 text-center">
                                                                                            <span className={`text-[10px] ${badgeClass}`}>
                                                                                                {prazo.text}
                                                                                            </span>
                                                                                        </td>
                                                                                    );
                                                                                })()}
                                                                                <td className="py-1 px-2 text-center text-[10px]">
                                                                                    {isAKit ? (
                                                                                        <span className="inline-flex items-center justify-center bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 font-black px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-700">
                                                                                            KIT
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-gray-300 dark:text-gray-600">-</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-1 px-2 text-right font-bold text-gray-800 dark:text-gray-200">
                                                                                    <div className="flex items-center justify-end gap-1">
                                                                                        {quantity > 1 && (
                                                                                            <span className="inline-flex items-center justify-center bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 text-[8px] font-black px-1 py-0.5 rounded border border-yellow-200 dark:border-yellow-700">
                                                                                                +1
                                                                                            </span>
                                                                                        )}
                                                                                        {quantity}x
                                                                                    </div>
                                                                                </td>
                                                                                <td className="py-1 px-2 text-center">
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const stringId = String(rowId);
                                                                                            setDeletedOrderIds(prev => new Set([...prev, stringId]));
                                                                                            addMontagemExclusion(stringId);
                                                                                        }}
                                                                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                                                        title="Remover da grade"
                                                                                    >
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                                        </svg>
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ))}
                                                </div>

                                                {deletedOrderIds.size > 0 && (
                                                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                                        <div className="flex items-center justify-between">
                                                            <button
                                                                onClick={() => setShowDeletedHistory(!showDeletedHistory)}
                                                                className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-primary-600 transition-colors uppercase tracking-wider"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showDeletedHistory ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                                Histórico de Remoção Local ({deletedOrderIds.size})
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    showModal('confirm', 'Limpar Histórico', 'Deseja remover permanentemente todos os itens deste histórico local? Isso não afetará os dados globais.', () => {
                                                                        onSetDeletedOrderIds(new Set());
                                                                        clearMontagemExclusions();
                                                                    });
                                                                }}
                                                                className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors uppercase tracking-wider"
                                                            >
                                                                Limpar Tudo
                                                            </button>
                                                        </div>

                                                        {showDeletedHistory && (
                                                            <div className="mt-3 overflow-x-auto custom-scrollbar">
                                                                <table className="w-full text-[10px]">
                                                                    <thead>
                                                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                                                            <th className="py-1 px-2 text-left font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-12">Img</th>
                                                                            <th className="py-1 px-2 text-left font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                                                                            <th className="py-1 px-2 text-left font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">ID Pedido</th>
                                                                            <th className="py-1 px-2 text-center font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-12">Kit</th>
                                                                            <th className="py-1 px-2 text-right font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-16">QT</th>
                                                                            <th className="py-1 px-2 text-center font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-20">Data</th>
                                                                            <th className="py-1 px-2 text-center font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-20">Canal</th>
                                                                            <th className="py-1 px-2 text-center font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-24">Ações</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {(data || []).filter(row => {
                                                                            const id = row._uniqueId || row._supabaseId;
                                                                            return id && (deletedOrderIds || new Set()).has(id);
                                                                        }).map(row => {
                                                                            const id = (row._uniqueId || row._supabaseId) as string | number;
                                                                            const orderId = String(row[idVendaHeader]!);
                                                                            const sku = String(row[skuHeader!] || '');
                                                                            const productImageUrl = imageMappings[sku] || imageMappings[transformSku(sku)];
                                                                            const clientName = String(row[nomeHeader]!);
                                                                            const quantity = quantidadeHeader ? ((row as any)._effectiveQuantity || 1) : 1;
                                                                            const isAKit = isKit(sku);
                                                                            const date = row[dataHeader!] ? formatDate(row[dataHeader!]) : '-';
                                                                            const channel = getSalesChannel(row, headers);

                                                                            return (
                                                                                <tr key={id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                                                                                    <td className="py-1 px-2 w-20">
                                                                                        {productImageUrl ? (
                                                                                            <img src={productImageUrl} alt="Produto" className="w-8 h-8 object-cover rounded border border-gray-200 dark:border-gray-700" />
                                                                                        ) : (
                                                                                            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                                                </svg>
                                                                                            </div>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="py-1 px-2 truncate max-w-[130px] text-gray-700 dark:text-gray-300" title={clientName}>{clientName}</td>
                                                                                    <td className="py-1 px-2 font-mono text-blue-600 dark:text-blue-400">{orderId}</td>
                                                                                    <td className="py-1 px-2 text-center font-black">
                                                                                        {isAKit ? <span className="text-blue-600 dark:text-blue-400">SIM</span> : <span className="text-gray-300 dark:text-gray-600">-</span>}
                                                                                    </td>
                                                                                    <td className="py-1 px-2 text-right font-bold text-gray-800 dark:text-gray-200">{quantity}x</td>
                                                                                    <td className="py-1 px-2 text-center text-gray-600 dark:text-gray-400">{date}</td>
                                                                                    <td className="py-1 px-2 text-center w-28">
                                                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap" style={{ backgroundColor: channel === 'Mercado Livre' ? '#fff159' : channel === 'Shopee' ? '#ee4d2d' : '#3b82f6', color: channel === 'Mercado Livre' ? '#000' : '#fff' }}>
                                                                                            {channel}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="py-1 px-2 text-center">
                                                                                        <div className="flex items-center justify-center gap-1">
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    onSetDeletedOrderIds(prev => {
                                                                                                        const next = new Set(prev);
                                                                                                        next.delete(id);
                                                                                                        removeMontagemExclusion(String(id));
                                                                                                        return next;
                                                                                                    });
                                                                                                }}
                                                                                                className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 rounded text-[9px] font-bold transition-colors uppercase"
                                                                                            >
                                                                                                Restaurar
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    showModal('confirm', 'Exclusão Permanente', 'Tem certeza que deseja remover este item permanentemente?', () => {
                                                                                                        onDeleteRow(id);
                                                                                                        onSetDeletedOrderIds(prev => {
                                                                                                            const next = new Set(prev);
                                                                                                            next.delete(id);
                                                                                                            removeMontagemExclusion(String(id));
                                                                                                            return next;
                                                                                                        });
                                                                                                    });
                                                                                                }}
                                                                                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                                                            >
                                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                                                </svg>
                                                                                            </button>
                                                                                        </div>
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
                                            </div>
                                        </details>
                                        {!isPedidosOriginaisOpen && relatedImages.length > 0 && (
                                            <div className="mt-2 p-3 border border-gray-200 dark:border-gray-700 rounded-b-md bg-gray-50 dark:bg-gray-800/50 animate-fade-in-scale">
                                                <div className="flex overflow-x-auto gap-2 pb-2">
                                                    {relatedImages.map(({ url, orderId }, index) => (
                                                        <div key={index} onClick={() => handleImageClick(url, orderId)} className="flex-shrink-0 cursor-pointer">
                                                            <img
                                                                src={url}
                                                                alt={`Pedido relacionado ${index + 1}`}
                                                                className="h-[98px] object-cover rounded-md border-2 border-transparent hover:border-primary-500 transition-all"
                                                                loading="lazy"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                            {selectedProduct && (
                                <div className="mt-2 border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                                    <div className="bg-gray-100 dark:bg-gray-700/50 px-3 py-2 flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">Itens Atrasados / Avulsos</span>
                                        <span className="bg-primary-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none">
                                            {backorderedItemsForProduct.length}
                                        </span>
                                    </div>
                                    <div className="p-2 h-[180px] overflow-y-auto space-y-2 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/20">
                                        {backorderedItemsForProduct.length > 0 ? backorderedItemsForProduct.map(item => {
                                            const sku = item.editedData ? item.editedData[0].sku : String(item.originalRow[skuHeader!] ?? '');
                                            const quantity = item.editedData ? item.editedData[0].quantity : cleanAndParse(item.originalRow[quantidadeHeader] as string);

                                            return (
                                                <div key={item.id} className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center group hover:border-primary-500/50 transition-colors shadow-sm">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-bold text-[11px] truncate text-gray-800 dark:text-gray-100">{transformSku(sku)}</p>
                                                        <p className="text-[9px] text-gray-500 dark:text-gray-400">Qt: <span className="font-bold text-primary-600">{quantity}</span> | {item.store || 'Geral'}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddBackorderToGrid(item)}
                                                        className="ml-2 px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-[9px] font-black rounded shadow-sm transition-colors uppercase"
                                                    >
                                                        ADICIONAR
                                                    </button>
                                                </div>
                                            );
                                        }) : (
                                            <div className="h-full flex items-center justify-center text-gray-400 text-[10px] font-medium italic">
                                                Nenhum item atrasado para este produto.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 3: Cost Breakdown (15%) */}
                <div className="md:w-[15%] p-3 bg-green-50 dark:bg-green-900/10 rounded-xl shadow-inner border border-green-200 dark:border-green-800/30 flex flex-col h-full">

                    {/* Sales Channel Pie Chart */}
                    {selectedProduct && Object.keys(storeBreakdown).length > 0 && (
                        <div className="mb-4 h-32 relative">
                            <Doughnut
                                data={{
                                    labels: Object.entries(storeBreakdown)
                                        .sort(([, a], [, b]) => (a as any).totalGeral - (b as any).totalGeral)
                                        .map(([store]) => store),
                                    datasets: [
                                        {
                                            data: Object.entries(storeBreakdown)
                                                .sort(([, a], [, b]) => (a as any).totalGeral - (b as any).totalGeral)
                                                .map(([, data]) => (data as any).totalGeral),
                                            backgroundColor: Object.entries(storeBreakdown)
                                                .sort(([, a], [, b]) => (a as any).totalGeral - (b as any).totalGeral)
                                                .map(([store]) => {
                                                    const s = store.toUpperCase();

                                                    // Blue Palette for Mercado Livre Group
                                                    if (s.includes('MERCADO LIVRE') || s.includes('ML')) {
                                                        if (s.includes('VEST') || s.includes('VESTUARIO')) return '#1e3a8a'; // Dark Blue
                                                        if (s.includes('MM')) return '#3b82f6'; // Blue
                                                        if (s.includes('CAPI') || s.includes('CAPINHAS')) return '#60a5fa'; // Light Blue
                                                        return '#2563eb'; // Default Blue
                                                    }

                                                    // Purple Palette for Shopee Group
                                                    if (s.includes('SHOPEE') || s.includes('SH')) {
                                                        if (s.includes('VEST') || s.includes('VESTUARIO')) return '#581c87'; // Dark Purple
                                                        if (s.includes('MM')) return '#9333ea'; // Purple
                                                        if (s.includes('CAPI') || s.includes('CAPINHAS')) return '#c084fc'; // Light Purple
                                                        return '#7e22ce'; // Default Purple
                                                    }

                                                    // Others: Indigo/Violet Gradient
                                                    if (s.includes('B2W') || s.includes('AMERIC')) return '#4338ca'; // Indigo
                                                    if (s.includes('MAGALU')) return '#1d4ed8'; // Darker Blue/Indigo mixed
                                                    if (s.includes('SHEIN')) return '#4c1d95'; // Deep Violet
                                                    if (s.includes('SITE')) return '#db2777'; // Pink (accent)

                                                    return '#6366f1'; // Default Indigo
                                                }),
                                            borderWidth: 0, // No borders
                                            hoverOffset: 4
                                        },
                                    ],
                                }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    cutout: '65%', // Thicker ring (was 75%)
                                    plugins: {
                                        legend: {
                                            display: false,
                                        },
                                        tooltip: {
                                            callbacks: {
                                                label: function (context) {
                                                    const label = context.label || '';
                                                    const value = context.raw || 0;
                                                    const total = context.chart.data.datasets[0].data.reduce((a: any, b: any) => a + b, 0);
                                                    const percentage = total ? Math.round(((value as number) / (total as number)) * 100) + '%' : '0%';
                                                    return `${label}: ${value} (${percentage})`;
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                            {/* Center Text for Total Pieces */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-bold text-gray-800 dark:text-gray-100 leading-none">
                                    {Object.values(storeBreakdown).reduce((acc, val: any) => acc + (val.totalGeral || 0), 0)}
                                </span>
                                <span className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider mt-0.5">
                                    Peças
                                </span>
                            </div>
                        </div>
                    )}


                    {selectedProduct && (Object.keys(finalGrid).length > 0) ? (
                        <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-1">
                            {(() => {
                                const destinationStores = ['MAGIC', 'FENOMENAL', 'ERON', 'GUSHI', 'INDICE', 'GLOBAL', 'ALFA DEZ'];
                                const normalizedSelectedProduct = normalizeString(selectedProduct);

                                // Find the price product for the selected product
                                const priceProduct = priceTable.find(p => normalizeString(p.product) === normalizedSelectedProduct);

                                if (!priceProduct) return (
                                    <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200">
                                        <p className="text-[10px] text-yellow-700 dark:text-yellow-400">
                                            Produto sem preço cadastrado
                                        </p>
                                    </div>
                                );

                                // Calculate costs for each store
                                const storeCosts = destinationStores
                                    .map(storeName => {
                                        // A store has price if it exists in priceProduct.prices and has at least one valid price
                                        const storePriceData = priceProduct.prices[storeName];
                                        if (!storePriceData) return null;

                                        // Calculate total cost using the current grid (finalGrid)
                                        const cost = calculateCost({
                                            product: selectedProduct,
                                            quantities: finalGrid,
                                            store: storeName
                                        } as any, priceTable, storeName);

                                        if (cost <= 0) return null;

                                        const storeClass = storeBadgeClasses[storeName] || 'bg-gray-600 text-white';
                                        return { storeName, cost, storeClass };
                                    })
                                    .filter((item): item is { storeName: string; cost: number; storeClass: string } => item !== null)
                                    .sort((a, b) => a.cost - b.cost);

                                if (storeCosts.length === 0) return (
                                    <div className="text-center p-2">
                                        <p className="text-[10px] text-gray-500">Nenhum custo disponível para as lojas selecionadas</p>
                                    </div>
                                );

                                const maxCost = Math.max(...storeCosts.map(item => item.cost));

                                return storeCosts.map((item, index) => {
                                    const { storeName, cost, storeClass } = item;
                                    const isCheapest = index === 0;
                                    const isMostExpensive = cost === maxCost;
                                    const savings = maxCost - cost;
                                    const savingsPercent = maxCost > 0 ? ((savings / maxCost) * 100).toFixed(1) : "0";

                                    return (
                                        <div
                                            key={storeName}
                                            className={`bg-white dark:bg-gray-800/80 p-1.5 rounded-lg border-2 shadow-sm hover:shadow-md transition-all ${isCheapest ? 'border-green-500 dark:border-green-400' :
                                                isMostExpensive ? 'border-red-300 dark:border-red-600' :
                                                    'border-gray-200 dark:border-gray-700'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${storeClass}`}>
                                                    {storeName}
                                                </span>
                                                {isCheapest && (
                                                    <span className="text-[9px] font-black bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800 uppercase shadow-sm">
                                                        Melhor Preço
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-0.5">
                                                <div className="text-center">
                                                    <span className="text-xl font-black text-gray-800 dark:text-gray-100">
                                                        {cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </span>
                                                </div>

                                                {savings > 0 && (
                                                    <div className="text-center bg-green-50 dark:bg-green-900/20 py-1 rounded border border-green-100 dark:border-green-800/30 mt-0.5">
                                                        <span className="text-[10px] font-black text-green-600 dark:text-green-400 block uppercase tracking-tight leading-none mb-0.5">
                                                            ECONOMIA {savings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </span>
                                                        <span className="text-xs text-green-500 font-black">
                                                            (-{savingsPercent}%)
                                                        </span>
                                                    </div>
                                                )}

                                                {isMostExpensive && !isCheapest && (
                                                    <div className="text-center">
                                                        <span className="text-[8px] font-semibold text-red-600 dark:text-red-400">
                                                            Mais caro
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center p-4">
                                <div className="text-4xl mb-2">📊</div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    Selecione um produto para visualizar os custos
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div >

            {
                editingRow && skuHeader && quantidadeHeader && (
                    <EditModal
                        row={editingRow}
                        onClose={() => setEditingRow(null)}
                        onSave={(row, newSku, newQuantity) => {
                            const id = row._supabaseId || row._uniqueId;
                            if (id) {
                                // Persist SKU adjustment rule to database if needed
                                const parsed = parseSku(newSku);
                                if (parsed) {
                                    learnRulesFromCorrection(
                                        String(row[skuHeader!] || ''),
                                        parsed.productName,
                                        parsed.colorName,
                                        parsed.sizeName
                                    );
                                    refreshRules();
                                }

                                onUpdateRow(id, {
                                    [skuHeader]: newSku,
                                    [quantidadeHeader]: newQuantity
                                });
                            }
                            setEditingRow(null);
                        }}
                        onDelete={(uniqueId) => {
                            const rowToDelete = relatedOrders.find(r => (r._uniqueId || r._supabaseId) === uniqueId);
                            if (rowToDelete) {
                                const sku = String(rowToDelete[skuHeader!] || '');
                                const quantity = (rowToDelete as any)._effectiveQuantity || 1;
                                if (isKit(sku) || quantity > 1) {
                                    showModal('confirm', 'Confirmar Exclusão',
                                        `Este item faz parte de um ${isKit(sku) ? 'KIT' : 'pedido com múltiplas unidades'}. Tem certeza que deseja excluí-lo?`,
                                        () => onDeleteRow(uniqueId)
                                    );
                                    return;
                                }
                            }
                            onDeleteRow(uniqueId);
                        }}
                        onAdd={onAddRow}
                        skuHeader={skuHeader}
                        quantidadeHeader={quantidadeHeader}
                        idVendaHeader={idVendaHeader}
                        imageMappings={imageMappings}
                        allSkuProductNames={allSkuProductNames}
                        allRows={data}
                        onBulkUpdateRows={onBulkUpdateRows}
                        masterData={masterData}
                    />
                )
            }

            {
                skuHeader && quantidadeHeader && idVendaHeader && nomeHeader && (
                    <SkuAdjustmentModal
                        isOpen={isSkuAdjustmentModalOpen}
                        onClose={() => {
                            setIsSkuAdjustmentModalOpen(false);
                            setClickPosition(null);
                        }}
                        productName={selectedProduct || ''}
                        rows={relatedOrders}
                        skuHeader={skuHeader}
                        quantidadeHeader={quantidadeHeader}
                        idVendaHeader={idVendaHeader}
                        nomeHeader={nomeHeader}
                        imageMappings={imageMappings || {}}
                        onEditRow={setEditingRow}
                        onLearnRule={learnRulesFromCorrection}
                    />
                )
            }

            {
                skuHeader && quantidadeHeader && idVendaHeader && nomeHeader && (
                    <ComplexOrdersModal
                        isOpen={isComplexOrdersModalOpen}
                        onClose={() => {
                            setIsComplexOrdersModalOpen(false);
                            setClickPosition(null);
                        }}
                        productName={selectedProduct || ''}
                        rows={allProductsData[selectedProduct || ''] || []}
                        skuHeader={skuHeader}
                        quantidadeHeader={quantidadeHeader}
                        nomeHeader={nomeHeader}
                        idVendaHeader={idVendaHeader}
                        cnpjHeader={cnpjHeader}
                        imageMappings={imageMappings || {}}
                        priceTable={priceTable}
                        showModal={showModal}
                        onUpdateRows={handleUpdateRows}
                        onDeleteRows={handleDeleteRows}
                        onAddRows={handleAddRows}
                        onEditRow={setEditingRow}
                        deletedRows={(deletedRows || []).filter(r => {
                            const sku = String(r[skuHeader] || '');
                            const parsed = parseSku(sku);
                            return parsed?.productName === selectedProduct;
                        })}
                        onRestoreRow={(uniqueId) => {
                            setDeletedRows(prev => prev.filter(r => (r._uniqueId || r._supabaseId) !== uniqueId));
                            setDeletedOrderIds(prev => {
                                const next = new Set(prev);
                                next.delete(uniqueId);
                                return next;
                            });
                        }}
                    />
                )
            }


            {/* Quantity Reduction Modal */}
            {
                quantityReductionModal.isOpen && createPortal(
                    <div className="fixed inset-0 bg-black/60 z-[11000] flex items-center justify-center p-4" onClick={quantityReductionModal.onCancel}>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-center p-5 border-b dark:border-gray-700">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Diminuição de Quantidade</h3>
                                <button onClick={quantityReductionModal.onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full p-1">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 flex-grow overflow-y-auto">
                                <div className="mb-4">
                                    <p className="text-gray-700 dark:text-gray-300 mb-2"><span className="font-semibold">Você informou:</span> <span className="text-primary-600 dark:text-primary-400 font-bold text-lg">{quantityReductionModal.newQuantity}</span></p>
                                    <p className="text-gray-700 dark:text-gray-300"><span className="font-semibold">Mas existem:</span> <span className="text-red-600 dark:text-red-400 font-bold text-lg">{quantityReductionModal.currentQuantity}</span> itens vinculados a esta opção <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{quantityReductionModal.color} {quantityReductionModal.size}</span></p>
                                </div>
                                <div className="mt-6">
                                    <h4 className="text-md font-semibold mb-3 text-gray-800 dark:text-gray-200">Itens que serão afetados:</h4>
                                    <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold">
                                                <tr><td className="py-2 px-3">Canal</td><td className="py-2 px-3">ID Pedido</td><td className="py-2 px-3">Nome</td><td className="py-2 px-3">SKU</td><td className="py-2 px-3 text-right">Qt.</td></tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                {quantityReductionModal.affectedItems.map((item, idx) => {
                                                    const isMLStore = item.store.includes('ML');
                                                    return <AffectedItemRow key={idx} item={item} isMLStore={isMLStore} />;
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">⚠️ <strong>Atenção:</strong> Confirmar reduzirá a quantidade para {quantityReductionModal.newQuantity}. Os itens acima permanecerão na lista de pedidos originais, mas não serão incluídos na grade final.</p>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex justify-end gap-3">
                                <button onClick={quantityReductionModal.onCancel} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                                <button onClick={quantityReductionModal.onConfirm} className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-md">Confirmar</button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div >
    );
};



