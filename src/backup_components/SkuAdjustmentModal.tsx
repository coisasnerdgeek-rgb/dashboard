import * as React from 'react';
import { TableRow } from '../types';
import { parseSku, getSkuError, transformSku, smartImageLookup } from '../services/skuService';
import { getSalesChannel } from '../services/ecommerceService';

interface SkuAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    productName: string;
    rows: TableRow[];
    skuHeader: string;
    quantidadeHeader: string;
    idVendaHeader: string;
    nomeHeader: string;
    imageMappings?: Record<string, string>;
    onEditRow: (row: TableRow) => void;
    clickPosition?: { x: number, y: number } | null;
}

import { createPortal } from 'react-dom';

export const SkuAdjustmentModal: React.FC<SkuAdjustmentModalProps> = ({
    isOpen,
    onClose,
    productName,
    rows,
    skuHeader,
    quantidadeHeader,
    idVendaHeader,
    nomeHeader,
    imageMappings,
    onEditRow
}) => {
    if (!isOpen) return null;

    const modalRef = React.useRef<HTMLDivElement>(null);

    const filteredRows = React.useMemo(() => {
        return rows.filter(row => {
            const sku = String(row[skuHeader] ?? '');
            const parsed = parseSku(sku);
            const isInvalid = getSkuError(sku) !== null || !parsed || parsed.colorName === 'N/A' || parsed.sizeName === 'N/A';
            return isInvalid;
        }).sort((a, b) => {
            return String(a[idVendaHeader]).localeCompare(String(b[idVendaHeader]));
        });
    }, [rows, skuHeader, idVendaHeader]);

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 z-[11000] overflow-y-auto flex items-center justify-center p-4" onClick={onClose}>
            <div
                ref={modalRef}
                onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 opacity-100"
            >
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/30">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">{productName}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Correções: {filteredRows.length}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10 text-[10px] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            <tr>
                                <th className="px-2 py-1.5 text-left">ID / Loja</th>
                                <th className="px-2 py-1.5 text-left">Img</th>
                                <th className="px-2 py-1.5 text-left">SKU Atual</th>
                                <th className="px-2 py-1.5 text-left">Status</th>
                                <th className="px-2 py-1.5 text-left">Nome Produto</th>
                                <th className="px-2 py-1.5 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                            {filteredRows.map(row => {
                                const sku = String(row[skuHeader] ?? '');
                                const quantity = row[quantidadeHeader];
                                const orderId = String(row[idVendaHeader] ?? '');
                                const store = getSalesChannel(orderId, row.cnpj || null);
                                const parsed = parseSku(sku);
                                const isInvalid = getSkuError(sku) !== null || !parsed || parsed.colorName === 'N/A' || parsed.sizeName === 'N/A';
                                const uniqueKey = row._uniqueId || row._supabaseId || Math.random();

                                return (
                                    <tr key={uniqueKey as string} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isInvalid ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                                        <td className="px-2 py-1.5 whitespace-nowrap">
                                            <div className="font-medium text-gray-900 dark:text-gray-200 text-[11px]">{orderId}</div>
                                            <div className="text-[10px] text-gray-500">{store}</div>
                                        </td>
                                        <td className="px-1.5 py-1 whitespace-nowrap">
                                            {(() => {
                                                const imageUrl = smartImageLookup(sku, imageMappings || {});
                                                return imageUrl ? (
                                                    <div className="h-8 w-8 relative rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 bg-white">
                                                        <img src={imageUrl} alt="Produto" className="object-cover w-full h-full" />
                                                    </div>
                                                ) : (
                                                    <div className="h-8 w-8 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center text-gray-400">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap font-mono text-gray-600 dark:text-gray-300 text-[11px]">
                                            {transformSku(sku)}
                                            <div className="text-[10px] text-gray-400">Q: {quantity}</div>
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap">
                                            {isInvalid ? (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200">
                                                    Inválido
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                                                    OK
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-[10px] text-gray-500 truncate max-w-[180px]" title={String(row[nomeHeader] ?? '')}>
                                            {String(row[nomeHeader] ?? '')}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => onEditRow(row)}
                                                className="px-2 py-1 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-800 text-[10px] font-semibold transition-colors"
                                            >
                                                Corrigir
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium text-xs transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
