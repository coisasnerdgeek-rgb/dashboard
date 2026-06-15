import * as React from 'react';
import { ArchivedSavedOrder, VerificationStatus, PriceProduct, SavedOrder } from '../types';
import { getColorHex, getTextColorForBackground } from '../utils/colorUtils';
import { sortSizes } from '../utils/sortUtils';
import KpiCard from './common/KpiCard';
import { normalizeString } from '../utils/stringUtils';
import { parseSku } from '../services/skuService';
import RelatedOrdersTable from './common/RelatedOrdersTable';
import { useAppContext } from '../contexts/AppContext';

// XLSX is globally available from the script tag in index.html
declare const XLSX: any;

// Helper functions for cost calculation
const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

const calculateCost = (order: Omit<SavedOrder, 'id'> | SavedOrder, priceTable: PriceProduct[], forStore?: string): number => {
    const costLookup = new Map<string, PriceProduct>();
    priceTable.forEach(p => {
        costLookup.set(normalizeString(p.product), p);
    });

    const priceProduct = costLookup.get(normalizeString(order.product));
    if (!priceProduct) return 0;

    let cost = 0;
    const targetStore = forStore || order.store;
    const storePrices = priceProduct.prices[targetStore];
    if (!storePrices) return 0;

    const coresEspeciais = new Set(['vermelho', 'verde escuro', 'verde', 'royal', 'mescla']);

    for (const color in order.quantities) {
        const normalizedColor = normalizeString(color);
        let priceType = 'COR';
        if (normalizedColor === 'branco') {
            priceType = 'BRANCO';
        } else if (targetStore === 'GUSHI' && coresEspeciais.has(normalizedColor)) {
            priceType = 'ESPECIAL';
        }

        let price = storePrices[priceType];
        if (price === null || price === undefined) {
            price = storePrices['COR'];
        }
        if (price === null || price === undefined) {
            price = storePrices['BRANCO'];
        }

        if (typeof price === 'number') {
            const totalQuantityForColor = Object.values(order.quantities[color] || {}).reduce((sum, q) => sum + Number(q || 0), 0);
            cost += totalQuantityForColor * price;
        }
    }
    return cost;
};

const calculateReceivedCost = (order: ArchivedSavedOrder, status: VerificationStatus, priceTable: PriceProduct[]): number => {
    const receivedQuantities: Record<string, Record<string, number>> = {};
    if (status && status.items) {
        const allColors = new Set([...Object.keys(order.quantities), ...Object.keys(status.items)]);
        allColors.forEach(color => {
            const allSizes = new Set([
                ...(order.quantities[color] ? Object.keys(order.quantities[color]) : []),
                ...(status.items[color] ? Object.keys(status.items[color]) : [])
            ]);

            allSizes.forEach(size => {
                const qty = status.items[color]?.[size];
                if (qty && qty.received !== null && qty.received > 0) {
                    if (!receivedQuantities[color]) receivedQuantities[color] = {};
                    receivedQuantities[color][size] = qty.received;
                }
            });
        });
    }
    const tempOrder = { ...order, quantities: receivedQuantities };
    return calculateCost(tempOrder, priceTable);
};


interface VerificacaoProps {
    archivedSavedOrders: ArchivedSavedOrder[];
    verificationStatus: Record<string, VerificationStatus>;
    onSaveVerification: (orderId: string, status: VerificationStatus) => void;
    onUndo?: (orderId: string) => void;
    priceTable: PriceProduct[];
    allRows: any[];
    headers: any;
    showModal: any;
    onUpdateRow: any;
    imageMappings?: Record<string, string>;
}

const DiscrepancyDetails: React.FC<{
    order: ArchivedSavedOrder;
    status: VerificationStatus;
}> = ({ order, status }) => {
    const [isCopied, setIsCopied] = React.useState(false);

    const discrepancies: { type: 'Faltou' | 'Sobrou'; color: string; size: string; qty: number }[] = [];

    const allColors = new Set([...order.colors, ...Object.keys(status.items || {})]);

    allColors.forEach(color => {
        const allSizes = new Set([
            ...(order.quantities[color] ? Object.keys(order.quantities[color]) : []),
            ...(status.items[color] ? Object.keys(status.items[color]) : [])
        ]);

        allSizes.forEach(size => {
            const expected = order.quantities[color]?.[size] || 0;
            const received = status.items[color]?.[size]?.received;

            if (received !== null && received !== undefined) {
                const diff = received - expected;
                if (diff < 0) {
                    discrepancies.push({ type: 'Faltou', color, size, qty: -diff });
                } else if (diff > 0) {
                    discrepancies.push({ type: 'Sobrou', color, size, qty: diff });
                }
            } else if (expected > 0) {
                // If an item was expected but not marked as received (is null), it's missing.
                discrepancies.push({ type: 'Faltou', color, size, qty: expected });
            }
        });
    });


    const faltou = discrepancies.filter(d => d.type === 'Faltou');
    const sobrou = discrepancies.filter(d => d.type === 'Sobrou');

    if (faltou.length === 0 && sobrou.length === 0 && !status.notes) {
        return null;
    }

    const handleCopy = () => {
        let text = `VERIFICAÇÃO PEDIDO: ${order.product} - ${order.store} (${order.cnpj})\n\n`;
        if (faltou.length > 0) {
            text += "FALTOU:\n";
            faltou.forEach(item => {
                text += `- ${item.qty}x ${item.color} - ${item.size}\n`;
            });
            text += "\n";
        }
        if (sobrou.length > 0) {
            text += "SOBROU:\n";
            sobrou.forEach(item => {
                text += `- ${item.qty}x ${item.color} - ${item.size}\n`;
            });
            text += "\n";
        }
        if (status.notes) {
            text += "OBSERVAÇÕES:\n";
            text += status.notes;
        }

        navigator.clipboard.writeText(text.trim()).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2500);
        });
    };

    const hasBothLists = faltou.length > 0 && sobrou.length > 0;
    const obsColSpanClass = hasBothLists ? "md:col-span-2" : "md:col-span-1";
    const obsBorderStyle = hasBothLists ? "mt-2 pt-2 border-t dark:border-gray-600" : "";


    return (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-gray-700 dark:text-gray-300">Detalhes da Verificação</h4>
                <button
                    onClick={handleCopy}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ${isCopied ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                >
                    {isCopied ? (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            <span>Copiado!</span>
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            <span>Copiar Resumo</span>
                        </>
                    )}
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {faltou.length > 0 && (
                    <div className="md:col-span-1">
                        <h5 className="font-bold text-red-500 mb-1">Faltou:</h5>
                        <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                            {faltou.map(item => (
                                <li key={`${item.color}-${item.size}`} className="flex justify-between">
                                    <span>{item.color} - {item.size}</span>
                                    <span className="font-semibold">{item.qty}x</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {sobrou.length > 0 && (
                    <div className="md:col-span-1">
                        <h5 className="font-bold text-yellow-500 mb-1">Sobrou:</h5>
                        <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                            {sobrou.map(item => (
                                <li key={`${item.color}-${item.size}`} className="flex justify-between">
                                    <span>{item.color} - {item.size}</span>
                                    <span className="font-semibold">{item.qty}x</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {status.notes && (
                    <div className={`${obsColSpanClass} ${obsBorderStyle}`}>
                        <h5 className="font-bold text-blue-500 mb-1">Observações:</h5>
                        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md">{status.notes}</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const VerificationModal: React.FC<{
    order: ArchivedSavedOrder;
    status: VerificationStatus | undefined;
    onClose: () => void;
    onSave: (orderId: string, status: VerificationStatus) => void;
    priceTable: PriceProduct[];
    allRows: any[];
    headers: any;
    showModal: any;
    onUpdateRow: any;
    imageMappings?: Record<string, string>;
}> = ({ order, status, onClose, onSave, priceTable, allRows, headers, showModal, onUpdateRow, imageMappings = {} }) => {

    const [receivedQuantities, setReceivedQuantities] = React.useState<Record<string, Record<string, number | null>>>({});
    const [notes, setNotes] = React.useState('');
    const [costs, setCosts] = React.useState({ expected: 0, received: 0, difference: 0 });

    const relatedRows = React.useMemo(() => {
        // Handle both standalone orders and merged orders
        const sourceIds = order._originalOrders
            ? order._originalOrders.flatMap(o => o._sourceRowIds || [])
            : (order._sourceRowIds || []);

        if (sourceIds.length === 0) return [];

        const idSet = new Set(sourceIds);
        return allRows.filter(r => idSet.has(r._uniqueId!));
    }, [order._sourceRowIds, order._originalOrders, allRows]);


    React.useEffect(() => {
        const initialQt: Record<string, Record<string, number | null>> = {};
        order.colors.forEach(color => {
            initialQt[color] = {};
            order.sizes.forEach(size => {
                initialQt[color][size] = status?.items?.[color]?.[size]?.received ?? null;
            });
        });
        setReceivedQuantities(initialQt);
        setNotes(status?.notes || '');
    }, [order, status]);

    React.useEffect(() => {
        const expected = calculateCost(order, priceTable);
        const tempStatusForCost: VerificationStatus = {
            items: {},
            notes: '',
            status: 'pending'
        };
        for (const color in receivedQuantities) {
            tempStatusForCost.items[color] = {};
            for (const size in receivedQuantities[color]) {
                tempStatusForCost.items[color][size] = {
                    expected: order.quantities[color]?.[size] || 0,
                    received: receivedQuantities[color][size]
                }
            }
        }
        const received = calculateReceivedCost(order, tempStatusForCost, priceTable);
        setCosts({
            expected: expected,
            received: received,
            difference: received - expected
        });
    }, [receivedQuantities, order, priceTable]);


    const handleQuantityChange = (color: string, size: string, value: string) => {
        const numValue = parseInt(value, 10);
        const finalValue = isNaN(numValue) || value === '' ? null : numValue;
        setReceivedQuantities(prev => {
            const newQt = JSON.parse(JSON.stringify(prev));
            if (!newQt[color]) newQt[color] = {};
            newQt[color][size] = finalValue;
            return newQt;
        });
    };

    const handleSave = () => {
        let totalExpectedSlots = 0;
        let checkedSlots = 0;
        let hasDiscrepancy = false;

        const finalItems: VerificationStatus['items'] = {};

        const allColors = new Set([...order.colors, ...Object.keys(receivedQuantities)]);

        allColors.forEach(color => {
            const allSizes = new Set([
                ...(order.quantities[color] ? Object.keys(order.quantities[color]) : []),
                ...(receivedQuantities[color] ? Object.keys(receivedQuantities[color]) : [])
            ]);

            finalItems[color] = {};

            allSizes.forEach(size => {
                const expected = order.quantities[color]?.[size] || 0;
                const received = receivedQuantities[color]?.[size] ?? null;

                finalItems[color][size] = { expected, received };

                if (expected > 0) {
                    totalExpectedSlots++;
                    if (received !== null) {
                        checkedSlots++;
                    }
                }

                if ((received ?? 0) !== expected) {
                    hasDiscrepancy = true;
                }
            });
        });

        let finalStatus: VerificationStatus['status'];
        const allExpectedItemsChecked = totalExpectedSlots > 0 && checkedSlots >= totalExpectedSlots;
        const hasAnyCheck = Object.values(finalItems).some(colors => Object.values(colors).some(size => size.received !== null));

        if (hasDiscrepancy) {
            finalStatus = 'discrepancy';
        } else if (allExpectedItemsChecked) {
            finalStatus = 'verified';
        } else if (hasAnyCheck) {
            finalStatus = 'in-progress';
        } else {
            finalStatus = 'pending';
        }

        // If there are notes, it's at least a discrepancy unless already verified without item differences
        if (notes.trim() !== '' && finalStatus !== 'verified') {
            finalStatus = 'discrepancy';
        }


        const newStatus: VerificationStatus = {
            items: finalItems,
            notes,
            status: finalStatus,
            lastChecked: new Date().toISOString(),
        };

        onSave(order.id, newStatus);
        onClose();
    };


    const markAllAsCorrect = () => {
        const correctQuantities: Record<string, Record<string, number | null>> = {};
        order.colors.forEach(color => {
            correctQuantities[color] = {};
            order.sizes.forEach(size => {
                correctQuantities[color][size] = order.quantities[color]?.[size] || 0;
            });
        });
        setReceivedQuantities(correctQuantities);
    };

    const handleClearAll = () => {
        const clearedQuantities: Record<string, Record<string, null>> = {};
        order.colors.forEach(color => {
            clearedQuantities[color] = {};
            order.sizes.forEach(size => {
                clearedQuantities[color][size] = null;
            });
        });
        setReceivedQuantities(clearedQuantities);
    };

    const totalDiff = costs.received - costs.expected;

    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-start justify-center p-4 pt-8" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl flex flex-col max-h-[95vh] border border-gray-700" onClick={e => e.stopPropagation()}>
                {/* Header Compacto */}
                <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                            Verificar Pedido: <span className="text-primary-500">{order.product}</span>
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{order.store} - {new Date(order.date).toLocaleDateString()}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Resumo Financeiro Compacto */}
                <div className="flex justify-center gap-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
                    <div className="bg-gray-700 px-3 py-1 rounded text-center min-w-[100px]">
                        <span className="block text-[10px] uppercase text-gray-400">Custo Esperado</span>
                        <span className="block text-sm font-bold text-white">{formatCurrency(costs.expected)}</span>
                    </div>
                    <div className="bg-gray-700 px-3 py-1 rounded text-center min-w-[100px]">
                        <span className="block text-[10px] uppercase text-gray-400">Custo Recebido</span>
                        <span className="block text-sm font-bold text-white">{formatCurrency(costs.received)}</span>
                    </div>
                    <div className={`px-3 py-1 rounded text-center min-w-[100px] ${totalDiff === 0 ? 'bg-green-900/50 text-green-400' : totalDiff > 0 ? 'bg-yellow-900/50 text-yellow-500' : 'bg-red-900/50 text-red-400'}`}>
                        <span className="block text-[10px] uppercase opacity-80">Diferença</span>
                        <span className="block text-sm font-bold">{formatCurrency(totalDiff)}</span>
                    </div>
                </div>

                {/* Conteúdo Scrollável */}
                <div className="flex-1 overflow-y-auto p-2 bg-gray-900">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                        {/* Tabela Esperado */}
                        <div className="bg-gray-800 rounded shadow-sm border border-gray-700 flex flex-col">
                            <h4 className="text-center py-1.5 text-xs font-bold text-gray-300 border-b border-gray-700 bg-gray-700/50">Esperado</h4>
                            <div className="overflow-auto flex-1 p-1 custom-scrollbar">
                                <table className="w-full text-[10px]">
                                    <thead>
                                        <tr>
                                            <th className="text-left font-bold text-gray-400 pb-1 pl-2">CORES</th>
                                            {sortSizes(order.sizes).map(size => (
                                                <th key={size} className="text-center font-bold text-gray-400 pb-1 px-1 min-w-[25px]">{size}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {order.colors.map(color => (
                                            <tr key={color} className="hover:bg-gray-700/50">
                                                <td className="py-1 pl-2 font-bold text-gray-200 uppercase truncate max-w-[100px]" style={{ color: getTextColorForBackground(getColorHex(color)), backgroundColor: getColorHex(color) + '40' }}>{color}</td>
                                                {sortSizes(order.sizes).map(size => (
                                                    <td key={size} className="text-center py-1 font-medium text-gray-300">
                                                        {order.quantities[color]?.[size] || '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Tabela Recebido */}
                        <div className="bg-gray-800 rounded shadow-sm border border-gray-700 flex flex-col">
                            <h4 className="text-center py-1.5 text-xs font-bold text-gray-300 border-b border-gray-700 bg-gray-700/50">Recebido</h4>
                            <div className="overflow-auto flex-1 p-1 custom-scrollbar">
                                <table className="w-full text-[10px]">
                                    <thead>
                                        <tr>
                                            <th className="text-left font-bold text-gray-400 pb-1 pl-2">CORES</th>
                                            {sortSizes(order.sizes).map(size => (
                                                <th key={size} className="text-center font-bold text-gray-400 pb-1 px-1 min-w-[25px]">{size}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700 text-white">
                                        {order.colors.map(color => (
                                            <tr key={color} className="hover:bg-gray-700/50">
                                                <td className="py-1 pl-2 font-bold uppercase truncate max-w-[100px]" style={{ color: getTextColorForBackground(getColorHex(color)), backgroundColor: getColorHex(color) + '40' }}>{color}</td>
                                                {sortSizes(order.sizes).map(size => {
                                                    const expected = order.quantities[color]?.[size] || 0;
                                                    const received = receivedQuantities[color]?.[size];
                                                    const isMatch = received === expected;
                                                    const isEmpty = received === null || received === undefined;

                                                    let cellClass = "bg-transparent";
                                                    if (!isEmpty && !isMatch) {
                                                        cellClass = received! > expected ? "bg-yellow-900/30 text-yellow-300" : "bg-red-900/30 text-red-300";
                                                    } else if (isMatch && expected > 0) {
                                                        cellClass = "text-green-400";
                                                    }

                                                    return (
                                                        <td key={size} className={`p-0 text-center ${cellClass}`}>
                                                            <input
                                                                type="text"
                                                                className={`w-full h-full min-h-[24px] bg-transparent text-center border-none focus:ring-1 focus:ring-primary-500 rounded-none text-[10px] p-0 ${cellClass}`}
                                                                value={received ?? ''}
                                                                placeholder={expected > 0 ? String(expected) : '-'}
                                                                onChange={(e) => handleQuantityChange(color, size, e.target.value)}
                                                                onFocus={(e) => e.target.select()}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pedidos Originais */}
                {relatedRows.length > 0 && (
                    <div className="px-4 py-3 bg-gray-900 border-t border-gray-700 flex-shrink-0">
                        <details>
                            <summary className="text-xs font-semibold cursor-pointer text-gray-500 hover:text-primary-400 mb-2">
                                Pedidos Originais ({relatedRows.length})
                            </summary>
                            <div className="mt-2">
                                <RelatedOrdersTable
                                    rows={relatedRows}
                                    headers={headers}
                                    editedCells={new Set()}
                                    showModal={showModal}
                                    onEditRow={(row) => onUpdateRow(row._uniqueId!, row)} // Simplified edit for now
                                    imageMappings={imageMappings}
                                />
                            </div>
                        </details>
                    </div>
                )}

                {/* Footer Actions */}
                <div className="p-3 border-t border-gray-700 bg-gray-800 flex justify-between items-center flex-shrink-0">
                    <button
                        onClick={() => {
                            setReceivedQuantities({});
                            setNotes('');
                        }}
                        className="text-[10px] text-gray-400 hover:text-white underline"
                    >
                        Limpar Tudo
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                // Auto-fill
                                const filled: Record<string, Record<string, number>> = {};
                                order.colors.forEach(c => {
                                    filled[c] = {};
                                    order.sizes.forEach(s => {
                                        if (order.quantities[c]?.[s]) {
                                            filled[c][s] = order.quantities[c][s];
                                        }
                                    });
                                });
                                // Type casting hack for quick reset
                                setReceivedQuantities(filled as any);
                            }}
                            className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-bold rounded shadow-sm"
                        >
                            Marcar Tudo Correto
                        </button>
                        <button onClick={onClose} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold rounded">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold rounded shadow-md">Salvar Verificação</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const getStatusInfo = (status: VerificationStatus['status'] | undefined) => {
    switch (status) {
        case 'verified':
            return { text: 'Verificado', color: 'text-green-600 dark:text-green-400', ringColor: 'ring-green-500', neonClass: 'neon-effect-green' };
        case 'discrepancy':
            return { text: 'Divergência', color: 'text-red-600 dark:text-red-400', ringColor: 'ring-red-500', neonClass: 'neon-effect-red' };
        case 'in-progress':
            return { text: 'Em Andamento', color: 'text-blue-600 dark:text-blue-400', ringColor: 'ring-blue-500', neonClass: 'neon-effect-yellow' };
        default: // pending
            return { text: 'Pendente', color: 'text-gray-500 dark:text-gray-400', ringColor: 'ring-gray-500', neonClass: 'neon-effect-yellow' };
    }
};

const Verificacao: React.FC<VerificacaoProps> = ({ archivedSavedOrders, verificationStatus, onSaveVerification, onUndo, priceTable, allRows, headers, showModal, onUpdateRow, imageMappings = {} }) => {
    const { globalSearchTerm } = useAppContext();
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedOrder, setSelectedOrder] = React.useState<ArchivedSavedOrder | null>(null);

    const handleExportDiscrepancies = () => {
        const rowsToExport: any[] = [];

        archivedSavedOrders.forEach(order => {
            const status = verificationStatus[order.id];
            if (!status || (status.status !== 'discrepancy' && !status.notes)) {
                return; // Skip orders without discrepancies or notes
            }

            const discrepancies: { type: 'Faltou' | 'Sobrou'; color: string; size: string; qty: number }[] = [];
            const allColors = new Set([...order.colors, ...Object.keys(status.items || {})]);

            allColors.forEach(color => {
                const allSizes = new Set([
                    ...(order.quantities[color] ? Object.keys(order.quantities[color]) : []),
                    ...(status.items[color] ? Object.keys(status.items[color]) : [])
                ]);

                allSizes.forEach(size => {
                    const expected = order.quantities[color]?.[size] || 0;
                    const received = status.items[color]?.[size]?.received;

                    if (received !== null && received !== undefined) {
                        const diff = received - expected;
                        if (diff < 0) {
                            discrepancies.push({ type: 'Faltou', color, size, qty: -diff });
                        } else if (diff > 0) {
                            discrepancies.push({ type: 'Sobrou', color, size, qty: diff });
                        }
                    } else if (expected > 0) {
                        discrepancies.push({ type: 'Faltou', color, size, qty: expected });
                    }
                });
            });

            if (discrepancies.length > 0) {
                discrepancies.forEach(d => {
                    rowsToExport.push({
                        'Data de Envio': new Date(order.archivedDate).toLocaleDateString('pt-BR'),
                        'Loja': order.store,
                        'Produto': order.product,
                        'CNPJ': order.cnpj,
                        'Cor': d.color,
                        'Tamanho': d.size,
                        'Tipo': d.type,
                        'Quantidade': d.qty,
                        'Observações Gerais': status.notes || ''
                    });
                });
            } else if (status.notes) {
                rowsToExport.push({
                    'Data de Envio': new Date(order.archivedDate).toLocaleDateString('pt-BR'),
                    'Loja': order.store,
                    'Produto': order.product,
                    'CNPJ': order.cnpj,
                    'Cor': '',
                    'Tamanho': '',
                    'Tipo': 'Observação',
                    'Quantidade': '',
                    'Observações Gerais': status.notes || ''
                });
            }
        });

        if (rowsToExport.length === 0) {
            alert("Nenhuma divergência encontrada para exportar.");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(rowsToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Divergencias");

        const cols = [{ wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 50 }];
        worksheet['!cols'] = cols;

        XLSX.writeFile(workbook, `Relatorio_Verificacao_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const ordersByStore = React.useMemo(() => {
        const groups: Record<string, ArchivedSavedOrder[]> = {};

        let filteredOrders = archivedSavedOrders;

        // Apply global search filter
        if (globalSearchTerm) {
            const search = globalSearchTerm.toLowerCase();
            filteredOrders = archivedSavedOrders.filter(order =>
                String(order.product || '').toLowerCase().includes(search) ||
                String(order.store || '').toLowerCase().includes(search) ||
                String(order.cnpj || '').toLowerCase().includes(search)
            );
        }

        filteredOrders.forEach(order => {
            if (!groups[order.store]) {
                groups[order.store] = [];
            }
            groups[order.store].push(order);
        });
        // Sort orders within each group by date, most recent first
        for (const store in groups) {
            groups[store].sort((a, b) => new Date(b.archivedDate).getTime() - new Date(a.archivedDate).getTime());
        }
        return groups;
    }, [archivedSavedOrders, globalSearchTerm]);

    const { totalExpectedCost, totalReceivedCost, totalDifference } = React.useMemo(() => {
        let expected = 0;
        let received = 0;
        archivedSavedOrders.forEach(order => {
            const orderExpected = calculateCost(order, priceTable);
            expected += orderExpected;
            const status = verificationStatus[order.id];
            if (status) {
                received += calculateReceivedCost(order, status, priceTable);
            } else {
                // If not verified at all, received cost is 0, so difference is full expected cost
            }
        });
        return { totalExpectedCost: expected, totalReceivedCost: received, totalDifference: received - expected };
    }, [archivedSavedOrders, verificationStatus, priceTable]);

    const handleOpenModal = (order: ArchivedSavedOrder) => {
        setSelectedOrder(order);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setSelectedOrder(null);
        setIsModalOpen(false);
    };

    const getVerificationSummary = (order: ArchivedSavedOrder, status: VerificationStatus | undefined) => {
        if (!status || status.status === 'pending') {
            return { checked: 0, total: order.totals.totalGeral, progress: 0 };
        }
        let checkedCount = 0;
        let totalSlotsWithItems = 0;

        for (const color of order.colors) {
            for (const size of order.sizes) {
                const expected = order.quantities[color]?.[size] || 0;
                if (expected > 0) {
                    totalSlotsWithItems++;
                    const received = status.items[color]?.[size]?.received;
                    if (received !== null && received !== undefined) {
                        checkedCount++;
                    }
                }
            }
        }

        return {
            checked: checkedCount,
            total: totalSlotsWithItems,
            progress: totalSlotsWithItems > 0 ? (checkedCount / totalSlotsWithItems) * 100 : 0
        };
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Verificação de Pedidos</h1>
                <button
                    onClick={handleExportDiscrepancies}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Exportar Planilha
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <KpiCard
                    variant="secondary"
                    title="Custo Total Esperado"
                    value={formatCurrency(totalExpectedCost)}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>}
                    colorObj={{
                        from: 'from-amber-500',
                        to: 'to-orange-600',
                        shadow: 'shadow-amber-500/20',
                        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
                        text: 'text-amber-600 dark:text-amber-400',
                        border: 'border-amber-200 dark:border-amber-800/50'
                    }}
                />
                <KpiCard
                    variant="secondary"
                    title="Custo Total Recebido"
                    value={formatCurrency(totalReceivedCost)}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    colorObj={{
                        from: 'from-emerald-500',
                        to: 'to-teal-600',
                        shadow: 'shadow-emerald-500/20',
                        iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
                        text: 'text-emerald-600 dark:text-emerald-400',
                        border: 'border-emerald-200 dark:border-emerald-800/50'
                    }}
                />
                <KpiCard
                    variant="secondary"
                    title="Diferença (Saldo)"
                    value={formatCurrency(totalDifference)}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>}
                    colorObj={{
                        from: totalDifference === 0 ? 'from-slate-500' : totalDifference > 0 ? 'from-rose-500' : 'from-blue-500',
                        to: totalDifference === 0 ? 'to-gray-600' : totalDifference > 0 ? 'to-red-600' : 'to-indigo-600',
                        shadow: totalDifference === 0 ? 'shadow-slate-500/20' : totalDifference > 0 ? 'shadow-rose-500/20' : 'shadow-blue-500/20',
                        iconBg: totalDifference === 0 ? 'bg-slate-100 dark:bg-slate-900/30' : totalDifference > 0 ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-blue-100 dark:bg-blue-900/30',
                        text: totalDifference === 0 ? 'text-slate-600 dark:text-slate-400' : totalDifference > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400',
                        border: totalDifference === 0 ? 'border-gray-200 dark:border-gray-700' : totalDifference > 0 ? 'border-rose-200 dark:border-rose-800/50' : 'border-blue-200 dark:border-blue-800/50'
                    }}
                />
            </div>
            <div className="space-y-6">
                {Object.entries(ordersByStore)
                    .sort(([storeA], [storeB]) => storeA.localeCompare(storeB))
                    .map(([store, orders]: [string, ArchivedSavedOrder[]]) => (
                        <div key={store}>
                            <h2 className="text-lg font-bold text-primary-600 dark:text-primary-400 mb-2">{store}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {orders.map(order => {
                                    const status = verificationStatus[order.id];
                                    const summary = getVerificationSummary(order, status);
                                    const statusInfo = getStatusInfo(status?.status);
                                    const expectedCost = calculateCost(order, priceTable);
                                    const receivedCost = status ? calculateReceivedCost(order, status, priceTable) : 0;
                                    const costDifference = receivedCost - expectedCost;

                                    return (
                                        <div key={order.id} className={`bg-white dark:bg-gray-800/50 p-4 rounded-lg shadow-sm border dark:border-gray-700 flex flex-col justify-between ${statusInfo.neonClass}`}>
                                            <div>
                                                <div className="flex justify-between items-start">
                                                    <h3 className="font-bold text-gray-800 dark:text-gray-200">{order.product} <span className="text-sm font-normal text-gray-500">({order.cnpj})</span></h3>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusInfo.color.replace('text-', 'bg-').replace('600', '100').replace('dark:text-', 'dark:bg-').replace('400', '900/50')}`}>{statusInfo.text}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(order.archivedDate).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            {status && (status.status === 'discrepancy' || (status.notes && status.notes.trim() !== '')) && <DiscrepancyDetails order={order} status={status} />}
                                            <div className="my-4">
                                                <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                    <span>Progresso</span>
                                                    <span>{summary.checked} / {summary.total} verificados</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                                    <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `${summary.progress}%` }}></div>
                                                </div>
                                                {status && status.status !== 'pending' && costDifference !== 0 && (
                                                    <div className={`mt-2 text-sm font-bold text-right ${costDifference > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        Diferença: {formatCurrency(costDifference)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                {onUndo && (
                                                    <button
                                                        onClick={() => onUndo(order.id)}
                                                        className="flex-1 px-4 py-2 bg-gray-500 text-white text-sm font-semibold rounded-md hover:bg-gray-600"
                                                        title="Desfazer e retornar para Enviar"
                                                    >
                                                        Desfazer
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleOpenModal(order)}
                                                    className="flex-1 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-md hover:bg-primary-700"
                                                >
                                                    Verificar
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
            </div>

            {isModalOpen && selectedOrder && (
                <VerificationModal
                    order={selectedOrder}
                    status={verificationStatus[selectedOrder.id]}
                    onClose={handleCloseModal}
                    onSave={onSaveVerification}
                    priceTable={priceTable}
                    allRows={allRows}
                    headers={headers}
                    showModal={showModal}
                    onUpdateRow={onUpdateRow}
                    imageMappings={imageMappings}
                />
            )}
        </div>
    );
};

export default Verificacao;