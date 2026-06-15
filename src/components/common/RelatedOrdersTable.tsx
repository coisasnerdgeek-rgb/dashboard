import * as React from 'react';
import { TableRow } from '../../types';
import { parseSku, getEffectiveQuantity, isKit, transformSku, smartImageLookup } from '../../services/skuService';
import { getSalesChannel } from '../../services/ecommerceService';
import { storeStyles, defaultStoreStyle } from '../../utils/ecommerceUtils';
import { CopyButton } from './CopyButton';

interface RelatedOrdersTableProps {
    rows: TableRow[];
    headers: { idVendaHeader?: string; skuHeader?: string; nomeHeader?: string; dataHeader?: string; quantidadeHeader?: string; };
    editedCells: Set<string>;
    showModal: any;
    onEditRow: (row: TableRow) => void;
    imageMappings?: Record<string, string>; // Add imageMappings
}

const RelatedOrdersTable: React.FC<RelatedOrdersTableProps> = ({ rows, headers, editedCells, showModal, onEditRow, imageMappings = {} }) => {
    const { idVendaHeader, skuHeader, nomeHeader, dataHeader, quantidadeHeader } = headers;
    const [copiedId, setCopiedId] = React.useState<string | null>(null);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(text);
            setTimeout(() => setCopiedId(null), 2500);
        });
    };

    if (rows.length === 0) {
        return <p className="text-xs text-center text-gray-500 py-4">Nenhum pedido corresponde ao filtro selecionado.</p>;
    }

    return (
        <div className="max-h-80 overflow-y-auto border dark:border-gray-600 rounded-md">
            <table className="min-w-full text-xs">
                <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
                    <tr>
                        <th className="p-1 text-left">Img</th>
                        <th className="p-1 text-left">Nome</th>
                        <th className="p-1 text-left">SKU</th>
                        <th className="p-1 text-left">Canal</th>
                        <th className="p-1 text-left">Data</th>
                        <th className="p-1 text-left">ID Pedido</th>
                        <th className="p-1 text-left">Kit</th>
                        <th className="p-1 text-right">Qt.</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {rows.map((row) => {
                        const sku = skuHeader ? String(row[skuHeader]) : '';
                        const parsed = parseSku(sku);
                        const isEdited = parsed ? editedCells.has(`${parsed.colorName}|${parsed.sizeName}`) : false;
                        const orderId = String(row[idVendaHeader!] || '');
                        const canal = getSalesChannel(orderId, row.cnpj || null);
                        const isMLStore = canal.startsWith('ML');
                        const storeStyle = storeStyles[canal] || defaultStoreStyle;

                        // Image resolution using smartImageLookup for kits
                        const imageUrl = smartImageLookup(sku, imageMappings);

                        // Highlighting Logic
                        const quantity = quantidadeHeader ? getEffectiveQuantity(sku, String(row[quantidadeHeader])) : 0;
                        const isAKit = isKit(sku);
                        const isMulti = !isAKit && quantity > 1;

                        let rowClass = `transition-colors cursor-pointer`;
                        if (isEdited) {
                            rowClass += ' bg-purple-100 dark:bg-purple-900/50';
                        } else if (isAKit) {
                            rowClass += ' bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50';
                        } else if (isMulti) {
                            rowClass += ' bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50';
                        } else {
                            rowClass += ' hover:bg-gray-50 dark:hover:bg-gray-700/50';
                        }

                        return (
                            <tr key={row._uniqueId as string} onClick={() => onEditRow(row)} className={rowClass}>
                                <td className="p-1">
                                    {imageUrl ? (
                                        <div className="w-8 h-8 rounded border border-gray-200 dark:border-gray-600 overflow-hidden bg-white">
                                            <img src={imageUrl} alt="Produto" className="w-full h-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-[10px] text-gray-400">
                                            -
                                        </div>
                                    )}
                                </td>
                                <td className="p-1 whitespace-nowrap truncate max-w-[120px]" title={nomeHeader ? String(row[nomeHeader] || '') : ''}>{nomeHeader ? String(row[nomeHeader] || '') : ''}</td>
                                <td className="p-1 whitespace-nowrap font-medium text-primary-600 dark:text-primary-400">{transformSku(sku)}</td>
                                <td className="p-1 whitespace-nowrap">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${storeStyle.bg} ${storeStyle.text}`}>
                                        {canal}
                                    </span>
                                </td>
                                <td className="p-1 whitespace-nowrap text-gray-500">{dataHeader ? (row[dataHeader] ? String(row[dataHeader]).substring(0, 5) : '') : ''}</td>
                                <td className="p-1 whitespace-nowrap font-mono">
                                    <div className="flex items-center justify-between group">
                                        {isMLStore ? (
                                            <a href={`https://www.mercadolivre.com.br/vendas/novo/mensagens/${orderId}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 dark:text-blue-400 hover:underline">
                                                {orderId}
                                            </a>
                                        ) : (
                                            <span>{orderId}</span>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleCopy(orderId); }}
                                            className={`p-1 rounded-md transition-all active:scale-90 opacity-0 group-hover:opacity-100 focus:opacity-100 ${copiedId === orderId ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400'}`}
                                            aria-label="Copiar ID"
                                        >
                                            {copiedId === orderId ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            )}
                                        </button>
                                    </div>
                                </td>
                                <td className="p-1 whitespace-nowrap">
                                    {isAKit ? (
                                        <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold">KIT</span>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="p-1 whitespace-nowrap text-right font-semibold">{quantidadeHeader ? getEffectiveQuantity(sku, String(row[quantidadeHeader])) : ''}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default RelatedOrdersTable;
