
import * as React from 'react';
import { getColorHex, getTextColorForBackground } from '../utils/colorUtils';
import { PriceProduct, SavedOrder, ArchivedSavedOrder, Contact, TableRow, OrderTotals } from '../types';
import { normalizeString } from '../utils/stringUtils';
import { storeStyles, defaultStoreStyle } from '../utils/ecommerceUtils';
import { sortSizes } from '../utils/sortUtils';
import { parseSku, getEffectiveQuantity, buildSku, getCategory, isKit, transformSku } from '../services/skuService';
import { getSalesChannel } from '../services/ecommerceService';
import { calculateCost } from '../services/priceTableService';
import { EditModal } from './SkuManager';
import RelatedOrdersTable from './common/RelatedOrdersTable';
import { useModalPosition } from '../hooks/useModalPosition';
import { useAppContext } from '../contexts/AppContext';

import KpiCard from './common/KpiCard';

interface EnviarPedidoProps {
    savedOrders: SavedOrder[];
    archivedSavedOrders: ArchivedSavedOrder[];
    onDeleteOrder: (orderId: string) => void;
    onRecoverOrder: (order: ArchivedSavedOrder) => void;
    onDeleteArchivedOrder: (orderId: string) => void;
    priceTable: PriceProduct[];
    onSendOrders: (orders: { order: SavedOrder; cost: number }[]) => void;
    showModal: (type: 'alert' | 'confirm', title: string, message: string | React.ReactNode, onConfirm?: () => void, options?: { confirmText?: string, cancelText?: string, onCancel?: () => void, maxWidth?: string }) => void;
    contacts: Contact[];
    onSplitOrder: (updatedOriginalOrder: SavedOrder, newFaltanteOrder: Omit<SavedOrder, 'id'>) => void;
    onRestoreFromFaltante: (updatedFaltanteOrder: SavedOrder, restoredOrder: Omit<SavedOrder, 'id'>) => void;
    allRows: TableRow[];
    headers: string[];
    onUpdateRow: (uniqueId: string | number, updatedFields: Partial<TableRow>) => void;
    onDeleteRow: (uniqueId: string | number) => void;
    onAddRow: (templateRow: TableRow, newSku: string, newQuantity: number) => void;
    allSkuProductNames: string[];
    masterData: { colors: string[]; sizes: string[] };
    masterData: { colors: string[]; sizes: string[] };
    imageMappings?: Record<string, string>;
}

type GridData = Record<string, Record<string, number>>;
type CnpjFilterMode = 'AMBOS_SEPARADOS' | 'AMBOS_UNIDOS' | 'MM' | 'MVF' | 'AMBOS';

const STORES = ["GUSHI", "MAGIC", "GLOBAL", "FENOMENAL", "ALFA DEZ", "ERON", "INDICE"];

// --- START: Merged Order Types and Logic ---

type MergedSavedOrder = Omit<SavedOrder, 'cnpj'> & {
    cnpj: 'MM' | 'MVF' | 'Ambos Unidos' | 'Ambos';
    _originalOrders?: SavedOrder[];
};

const mergeOrders = (orders: SavedOrder[]): MergedSavedOrder[] => {
    const groupedByProductAndStore = new Map<string, SavedOrder[]>();

    for (const order of orders) {
        if (order.cnpj === 'Ambos') {
            // Treat 'Ambos' orders as pre-merged, don't try to merge them further.
            continue;
        }
        const key = `${order.product}__${order.store}`;
        if (!groupedByProductAndStore.has(key)) {
            groupedByProductAndStore.set(key, []);
        }
        groupedByProductAndStore.get(key)!.push(order);
    }

    const mergedResult: MergedSavedOrder[] = [];
    // Add back the 'Ambos' orders that were skipped.
    mergedResult.push(...orders.filter(o => o.cnpj === 'Ambos'));


    for (const group of groupedByProductAndStore.values()) {
        const mmOrder = group.find(o => o.cnpj === 'MM');
        const mvfOrder = group.find(o => o.cnpj === 'MVF');

        if (mmOrder && mvfOrder) {
            // Merge them
            const mergedQuantities: GridData = JSON.parse(JSON.stringify(mmOrder.quantities));
            for (const color in mvfOrder.quantities) {
                if (!mergedQuantities[color]) mergedQuantities[color] = {};
                for (const size in mvfOrder.quantities[color]) {
                    mergedQuantities[color][size] = (mergedQuantities[color][size] || 0) + mvfOrder.quantities[color][size];
                }
            }

            const allColors = new Set([...mmOrder.colors, ...mvfOrder.colors]);
            const allSizes = new Set([...mmOrder.sizes, ...mvfOrder.sizes]);

            const totalEspeciais = (mmOrder.totals.totalEspeciais || 0) + (mvfOrder.totals.totalEspeciais || 0);

            const mergedEditedCells: SavedOrder['editedCells'] = JSON.parse(JSON.stringify(mmOrder.editedCells || {}));
            if (mvfOrder.editedCells) {
                for (const color in mvfOrder.editedCells) {
                    if (!mergedEditedCells[color]) {
                        mergedEditedCells[color] = {};
                    }
                    Object.assign(mergedEditedCells[color], mvfOrder.editedCells[color]);
                }
            }

            const mergedOrder: MergedSavedOrder = {
                id: `${mmOrder.id}+${mvfOrder.id}`,
                product: mmOrder.product,
                store: mmOrder.store,
                cnpj: 'Ambos Unidos',
                quantities: mergedQuantities,
                colors: Array.from(allColors).sort(),
                sizes: sortSizes(Array.from(allSizes)),
                totals: {
                    totalBranco: mmOrder.totals.totalBranco + mvfOrder.totals.totalBranco,
                    totalColorido: mmOrder.totals.totalColorido + mvfOrder.totals.totalColorido,
                    ...(totalEspeciais > 0 && { totalEspeciais }),
                    totalGeral: mmOrder.totals.totalGeral + mvfOrder.totals.totalGeral,
                },
                editedCells: mergedEditedCells,
                _originalOrders: [mmOrder, mvfOrder],
                _sourceRowIds: [...(mmOrder._sourceRowIds || []), ...(mvfOrder._sourceRowIds || [])],
            };
            mergedResult.push(mergedOrder);
        } else {
            // Push originals if no pair
            mergedResult.push(...group);
        }
    }
    return mergedResult;
};

// --- END: Merged Order Types and Logic ---



const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};


// --- START: NEW EXPORT MODAL & HELPERS ---

const getCurrentTimestamp = () => {
    return new Date().toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};


/**
 * Formats size quantities into a string like "5 M - 2 GG".
 */
const formatSizeQuantities = (sizes: Record<string, number>): string => {
    const sortedSizes = sortSizes(Object.keys(sizes));
    return sortedSizes.map(size => {
        const quantity = sizes[size];
        const isNumeric = /^\d+$/.test(size);
        const prefix = isNumeric ? 'Tam. ' : '';
        return `${quantity} ${prefix}${size.toUpperCase()}`;
    }).join(' - ');
};


/**
 * Generates a styled HTML string for the Packing List (for DOC/PDF).
 */
const generatePackingListHtml = (orders: (SavedOrder | MergedSavedOrder)[], groupBy: 'store' | 'product'): string => {
    let body = ``;
    const groupedData = new Map<string, (SavedOrder | MergedSavedOrder)[]>();

    orders.forEach(order => {
        const key = groupBy === 'store' ? order.store : order.product;
        if (!groupedData.has(key)) groupedData.set(key, []);
        groupedData.get(key)!.push(order);
    });

    Array.from(groupedData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([groupName, items]) => {
            const title = groupBy === 'store' ? groupName : `PRODUTO: ${groupName}`;
            body += `<h2 style="font-size: 1.1em; margin-top: 10px; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: flex-end;">
                        <span>${title}</span>
                        <span style="font-size: 0.8em; color: #555; font-weight: normal;">Gerado em: ${getCurrentTimestamp()}</span>
                     </h2>`;

            items.forEach((order) => {
                const { product, quantities, totals, store } = order;
                body += `<div style="margin-left: 10px; margin-bottom: 8px;">`;
                let productTitle = groupBy === 'store' ? product : groupName;
                if (order.cnpj !== 'Ambos Unidos') {
                    productTitle += ` (${order.cnpj})`;
                }
                body += `<h3 style="font-size: 1em; font-weight: bold; margin-bottom: 3px;">${productTitle}</h3>`;
                const sortedColors = Object.keys(quantities).sort();

                body += '<ul>';
                sortedColors.forEach(color => {
                    const sizeString = formatSizeQuantities(quantities[color]);
                    let fontColor = getColorHex(color);
                    const isWhite = fontColor.toUpperCase() === '#FFFFFF';
                    if (isWhite) {
                        fontColor = '#333333'; // Use dark gray for white text to be visible in DOC
                    }
                    body += `<li style="margin-bottom: 2px;"><span style="display:inline-block; width:10px; height:10px; border:1px solid #333; margin-right: 6px; vertical-align: middle;"></span><strong style="color: ${fontColor};">${color.toUpperCase()}:</strong> ${sizeString}</li>`;
                });
                body += '</ul>';

                let totalsHtml = `<p style="font-weight: bold; margin-top: 3px;">TOTAL: ${totals.totalGeral}`;
                totalsHtml += ` <span style="font-weight: normal;">(Branco: ${totals.totalBranco} | Cor: ${totals.totalColorido}`;
                if (store === 'GUSHI' && totals.totalEspeciais) {
                    totalsHtml += ` | Especial: ${totals.totalEspeciais}`;
                }
                totalsHtml += `)</span></p>`;
                body += totalsHtml;

                body += `</div>`;
            });
        });

    const css = `body{font-family:sans-serif; font-size: 9pt; line-height: 1.2;} ul{list-style:none; padding-left:5px; margin: 0;}`;

    return `<!DOCTYPE html><html><head><title>Packing Picking</title><style>${css}</style></head><body>${body}</body></html>`;
};


/**
 * Generates a styled HTML string for the Grid Export (for DOC/PDF).
 */
const generateGradeExportHtml = (orders: (SavedOrder | MergedSavedOrder)[], groupBy: 'store' | 'product'): string => {
    let bodyContent = ``;

    const createTotalsLegend = (totals: SavedOrder['totals'], store?: string) => {
        let legend = `TOTAL: ${totals.totalGeral} (Branco: ${totals.totalBranco} | Cor: ${totals.totalColorido}`;
        if (store === 'GUSHI' && totals.totalEspeciais) {
            legend += ` | Especial: ${totals.totalEspeciais}`;
        }
        legend += ')';
        return `<div class="totals-legend">${legend}</div>`;
    };

    if (groupBy === 'store') {
        const dataByStore = new Map<string, (SavedOrder | MergedSavedOrder)[]>();
        orders.forEach(order => {
            if (!dataByStore.has(order.store)) dataByStore.set(order.store, []);
            dataByStore.get(order.store)!.push(order);
        });

        Array.from(dataByStore.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([store, storeOrders]) => {
                bodyContent += `<div class="store-block">`;
                bodyContent += `<div class="store-header">
                                    <span>${store}</span>
                                    <span class="timestamp">Gerado em: ${getCurrentTimestamp()}</span>
                                </div>`;
                bodyContent += `<div class="multi-grid-wrapper">`;

                storeOrders.forEach(order => {
                    let productTitle = order.product;
                    if (order.cnpj !== 'Ambos Unidos') {
                        productTitle += ` (${order.cnpj})`;
                    }
                    bodyContent += `<div class="grid-item">`;
                    bodyContent += `<div class="product-header">${productTitle}</div>`;
                    bodyContent += '<table><thead><tr><th>CORES</th>';
                    order.sizes.forEach(size => bodyContent += `<th>${size}</th>`);
                    bodyContent += '</tr></thead><tbody>';
                    order.colors.forEach(color => {
                        const colorBg = getColorHex(color);
                        const colorText = getTextColorForBackground(colorBg);
                        bodyContent += `<tr><td style="background-color:${colorBg};color:${colorText};">${color.toUpperCase()}</td>`;
                        order.sizes.forEach(size => {
                            const qty = order.quantities[color]?.[size];
                            bodyContent += qty ? `<td class="qty-cell">${qty}</td>` : '<td></td>';
                        });
                        bodyContent += '</tr>';
                    });
                    bodyContent += '</tbody></table>';
                    bodyContent += createTotalsLegend(order.totals, order.store);
                    bodyContent += `</div>`; // close grid-item
                });

                bodyContent += `</div>`; // close multi-grid-wrapper
                bodyContent += `</div>`; // close store-block
            });
    } else { // groupBy === 'product'
        const dataByProduct = new Map<string, { quantities: GridData, allSizes: Set<string>, allColors: Set<string> }>();
        orders.forEach(order => {
            if (!dataByProduct.has(order.product)) dataByProduct.set(order.product, { quantities: {}, allSizes: new Set(), allColors: new Set() });
            const productData = dataByProduct.get(order.product)!;
            order.sizes.forEach(s => productData.allSizes.add(s));
            order.colors.forEach(c => productData.allColors.add(c));
            Object.entries(order.quantities).forEach(([color, sizes]) => {
                if (!productData.quantities[color]) productData.quantities[color] = {};
                Object.entries(sizes).forEach(([size, qty]) => {
                    productData.quantities[color][size] = (productData.quantities[color][size] || 0) + qty;
                });
            });
        });

        Array.from(dataByProduct.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([product, data]) => {
                const sortedSizes = sortSizes(Array.from(data.allSizes));
                const sortedColors = Array.from(data.allColors).sort();

                bodyContent += `<div class="grid-item">
                                    <div class="store-header">
                                        <span>${product}</span>
                                        <span class="timestamp">Gerado em: ${getCurrentTimestamp()}</span>
                                    </div>`;
                bodyContent += '<table><thead><tr><th>CORES</th>';
                sortedSizes.forEach(size => bodyContent += `<th>${size}</th>`);
                bodyContent += '</tr></thead><tbody>';
                sortedColors.forEach(color => {
                    const colorBg = getColorHex(color);
                    const colorText = getTextColorForBackground(colorBg);
                    bodyContent += `<tr><td style="background-color:${colorBg};color:${colorText};">${color.toUpperCase()}</td>`;
                    sortedSizes.forEach(size => {
                        const qty = data.quantities[color]?.[size];
                        bodyContent += qty ? `<td class="qty-cell">${qty}</td>` : '<td></td>';
                    });
                    bodyContent += '</tr>';
                });
                bodyContent += '</tbody></table>';

                let branco = 0;
                let cor = 0;
                Object.entries(data.quantities).forEach(([colorName, sizes]) => {
                    const totalForColor = Object.values(sizes).reduce((s, q) => s + q, 0);
                    if (normalizeString(colorName) === 'branco') {
                        branco += totalForColor;
                    } else {
                        cor += totalForColor;
                    }
                });
                const totalGeral = branco + cor;
                const totals: SavedOrder['totals'] = { totalBranco: branco, totalColorido: cor, totalGeral };

                bodyContent += createTotalsLegend(totals);
                bodyContent += '</div>';
            });
        bodyContent = `<div class="multi-grid-wrapper">${bodyContent}</div>`;
    }

    const css = `
        body{font-family:sans-serif;}
        table{border-collapse:collapse;margin-bottom:4px;font-size:10px;width:auto;}
        th,td{border:1px solid #ccc;padding:2px 4px;text-align:center;height:auto;}
        th{background-color:#f0f0f0;font-weight:bold;-webkit-print-color-adjust: exact; print-color-adjust: exact;}
        td:first-child{
            min-width:60px;
            text-align:left;
            padding-left:4px;
            font-weight:bold;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .qty-cell{
            background-color:#dc2626 !important;
            color:white !important;
            font-weight:bold;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .store-block {
            page-break-inside: avoid;
            width: 100%;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 15px;
        }
        .multi-grid-wrapper {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: flex-start;
        }
        .grid-item {
            border: 1px solid #eee;
            border-radius: 4px;
            padding: 5px;
            display: inline-block;
            vertical-align: top;
            page-break-inside: avoid;
        }
        .store-header {
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 10px;
            border-bottom: 2px solid #ccc;
            padding-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }
        .timestamp {
            font-size: 0.8em;
            color: #555;
            font-weight: normal;
        }
        .product-header{
            font-size:10px;
            font-weight:bold;
            margin:5px 0 3px 0;
            text-align:center;
        }
        .totals-legend{
            font-size:8px;
            text-align:left;
            color:#555;
            margin-top: 4px;
        }
    `;

    return `<!DOCTYPE html><html><head><title>Grade de Pedidos</title><style>${css}</style></head><body>${bodyContent}</body></html>`;
};



const ExportModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    orders: SavedOrder[];
    showModal: EnviarPedidoProps['showModal'];
    contacts: Contact[];
    selectedStore: string;
}> = ({ isOpen, onClose, orders, showModal, contacts, selectedStore }) => {
    const [groupBy, setGroupBy] = React.useState<'store' | 'product'>('store');
    const [isCopied, setIsCopied] = React.useState(false);
    const [selectedStores, setSelectedStores] = React.useState<string[]>([]);
    const [cnpjExportMode, setCnpjExportMode] = React.useState<CnpjFilterMode>('AMBOS_SEPARADOS');
    const [sendMethod, setSendMethod] = React.useState<'download' | 'whatsapp' | 'email'>('download');


    const uniqueStores = React.useMemo(() => Array.from(new Set(orders.map(o => o.store))).sort(), [orders]);
    const hasMultipleCnpjs = React.useMemo(() => new Set(orders.map(o => o.cnpj)).size > 1, [orders]);

    React.useEffect(() => {
        if (isOpen) {
            // Se uma loja já estiver filtrada na tela principal, pré-selecione-a.
            // Caso contrário, selecione todas as lojas disponíveis nos pedidos.
            if (selectedStore && uniqueStores.includes(selectedStore)) {
                setSelectedStores([selectedStore]);
            } else {
                setSelectedStores(uniqueStores);
            }
        }
    }, [isOpen, uniqueStores, selectedStore]);

    const { isWhatsappEnabled, isEmailEnabled, singleStoreName, contactForSingleStore } = React.useMemo(() => {
        // Habilita as opções de envio SOMENTE se exatamente uma loja estiver selecionada DENTRO do modal.
        if (selectedStores.length !== 1) {
            return { isWhatsappEnabled: false, isEmailEnabled: false, singleStoreName: null, contactForSingleStore: null };
        }
        const storeName = selectedStores[0];
        const contact = contacts.find(c => c.store === storeName);
        return {
            isWhatsappEnabled: !!(contact && contact.whatsapp && contact.whatsapp.trim() !== ''),
            isEmailEnabled: !!(contact && contact.email && contact.email.trim() !== ''),
            singleStoreName: storeName,
            contactForSingleStore: contact,
        };
    }, [contacts, selectedStores]);


    React.useEffect(() => {
        if (sendMethod === 'whatsapp' && !isWhatsappEnabled) {
            setSendMethod('download');
        }
        if (sendMethod === 'email' && !isEmailEnabled) {
            setSendMethod('download');
        }
    }, [isWhatsappEnabled, isEmailEnabled, sendMethod]);

    const handleStoreSelectionChange = (store: string) => {
        setSelectedStores(prev => {
            const newSet = new Set(prev);
            if (newSet.has(store)) {
                newSet.delete(store);
            } else {
                newSet.add(store);
            }
            return Array.from(newSet);
        });
    };

    const filteredOrders = React.useMemo(() => {
        let tempOrders = orders.filter(o => selectedStores.includes(o.store));

        if (cnpjExportMode === 'AMBOS_UNIDOS') {
            return mergeOrders(tempOrders);
        }
        if (cnpjExportMode === 'MM' || cnpjExportMode === 'MVF' || cnpjExportMode === 'AMBOS') {
            return tempOrders.filter(o => o.cnpj === cnpjExportMode);
        }

        // AMBOS_SEPARADOS
        return tempOrders;
    }, [orders, selectedStores, cnpjExportMode]);

    const { groupedData, plainTextData } = React.useMemo(() => {
        const data = new Map<string, (SavedOrder | MergedSavedOrder)[]>();
        filteredOrders.forEach(order => {
            const key = groupBy === 'store' ? order.store : order.product;
            if (!data.has(key)) data.set(key, []);
            data.get(key)!.push(order);
        });
        const sortedGroupedData = Array.from(data.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        let content = ``;

        sortedGroupedData.forEach(([groupName, items], groupIndex) => {
            if (groupIndex > 0) content += `\n`;
            const title = groupBy === 'store' ? groupName.toUpperCase() : `PRODUTO: ${groupName.toUpperCase()}`;
            content += `${title} - Gerado em: ${getCurrentTimestamp()}\n`;
            content += `-----------------\n`;
            items.forEach((order) => {
                const { product, quantities, totals, store } = order;
                if (groupBy === 'store') {
                    content += `${product}`;
                    if (order.cnpj !== 'Ambos Unidos') content += ` (${order.cnpj})`
                    content += `\n`;
                }

                Object.keys(quantities).sort().forEach(color => {
                    const sizeString = formatSizeQuantities(quantities[color]);
                    content += `[ ] ${color.toUpperCase()}: ${sizeString}\n`;
                });

                let totalsText = `TOTAL: ${totals.totalGeral} (Branco: ${totals.totalBranco} | Cor: ${totals.totalColorido}`;
                if (store === 'GUSHI' && totals.totalEspeciais) {
                    totalsText += ` | Especial: ${totals.totalEspeciais}`;
                }
                totalsText += ')\n\n';
                content += totalsText;
            });
        });

        return { groupedData: sortedGroupedData, plainTextData: content.trim() };
    }, [filteredOrders, groupBy]);

    const createSendHandler = (exportAction: () => void, isTextBased: boolean = false) => {
        return () => {
            if (sendMethod === 'download') {
                exportAction();
                return;
            }

            const contact = contactForSingleStore;
            if (!contact) {
                showModal('alert', 'Não é possível enviar', `Selecione um único canal com contato cadastrado.`);
                return;
            }

            const openAppLink = (message: string) => {
                if (sendMethod === 'whatsapp' && contact.whatsapp) {
                    const phone = contact.whatsapp.replace(/\D/g, '');
                    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`, '_blank');
                } else if (sendMethod === 'email' && contact.email) {
                    const subject = encodeURIComponent(`Pedido - ${singleStoreName} - ${new Date().toLocaleDateString('pt-BR')}`);
                    window.location.href = `mailto:${contact.email}?subject=${subject}&body=${encodeURIComponent(message)}`;
                }
            };

            if (isTextBased) {
                openAppLink(plainTextData);
            } else {
                const appName = sendMethod === 'whatsapp' ? 'WhatsApp' : 'Email';
                showModal(
                    'confirm',
                    `Enviar Arquivo via ${appName}`,
                    `Para enviar o arquivo, o processo ocorrerá em 2 etapas:\n\n1. A janela para salvar o arquivo em seu computador será aberta.\n2. Após salvar, a janela do ${appName} abrirá com uma mensagem padrão.\n\nVocê precisará anexar o arquivo salvo manualmente na conversa.`,
                    () => { // onConfirm
                        exportAction();
                        const genericMessage = `Olá ${contact.name || ''}, segue o pedido em anexo.`;
                        openAppLink(genericMessage);
                    },
                    { confirmText: 'Continuar' }
                );
            }
        };
    };

    const handleCopyText = () => {
        navigator.clipboard.writeText(plainTextData).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2500);
        });
    };

    const handleDownload = (fileExtension: string, content: string, mimeType: string) => {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const uniqueStoresInExport = Array.from(new Set(filteredOrders.map(o => o.store)));
        const storeName = uniqueStoresInExport.length === 1 ? uniqueStoresInExport[0] : 'Multi-Canais';

        let cnpjName = 'Multi-CNPJ';
        if (cnpjExportMode === 'MM' || cnpjExportMode === 'MVF' || cnpjExportMode === 'AMBOS') {
            cnpjName = cnpjExportMode;
        } else if (cnpjExportMode === 'AMBOS_UNIDOS') {
            cnpjName = 'Unido';
        }

        const filename = `${storeName}-${cnpjName}-${day}-${month}.${fileExtension}`;

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handlePrint = (htmlContent: string) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Não foi possível abrir a janela de impressão. Verifique se o seu navegador está bloqueando pop-ups.');
            return;
        }
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    const handleExportGrade = () => {
        const exportLogic = (format: 'doc' | 'pdf') => {
            const htmlContent = generateGradeExportHtml(filteredOrders, groupBy);
            if (format === 'doc') {
                handleDownload('doc', htmlContent, 'application/msword');
            } else {
                handlePrint(htmlContent);
            }
        };

        const wrappedAction = (format: 'doc' | 'pdf') => {
            if (sendMethod === 'download') {
                exportLogic(format);
            } else {
                createSendHandler(() => exportLogic(format))();
            }
        };

        showModal(
            'confirm',
            'Exportar Grade',
            `Selecione o formato para ${sendMethod === 'download' ? 'baixar' : 'enviar'} a grade gráfica:`,
            () => wrappedAction('pdf'), // onConfirm for PDF
            {
                confirmText: 'PDF',
                cancelText: 'DOC',
                onCancel: () => wrappedAction('doc')
            }
        );
    };

    if (!isOpen) return null;

    const actionVerb = sendMethod === 'download' ? 'Baixar' : 'Enviar';

    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-start justify-center p-4 pt-8" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full flex flex-col transform animate-fade-in-scale max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Exportar Packing Picking</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="p-6 flex-grow overflow-y-auto">
                    <div className="p-3 border dark:border-gray-600 rounded-md mb-4 bg-gray-50 dark:bg-gray-900/50">
                        <h4 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">Método de Envio</h4>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" name="send-method" value="download" checked={sendMethod === 'download'} onChange={e => setSendMethod(e.target.value as any)}
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-primary-500"
                                />
                                <span className="font-medium text-gray-700 dark:text-gray-300">Fazer Download</span>
                            </label>
                            <label className={`flex items-center gap-2 text-sm ${!isWhatsappEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} title={!isWhatsappEnabled ? 'Selecione um único canal com WhatsApp cadastrado' : ''}>
                                <input type="radio" name="send-method" value="whatsapp" checked={sendMethod === 'whatsapp'} onChange={e => setSendMethod(e.target.value as any)}
                                    disabled={!isWhatsappEnabled}
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-primary-500"
                                />
                                <span className="font-medium text-gray-700 dark:text-gray-300">Enviar via WhatsApp</span>
                            </label>
                            <label className={`flex items-center gap-2 text-sm ${!isEmailEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} title={!isEmailEnabled ? 'Selecione um único canal com Email cadastrado' : ''}>
                                <input type="radio" name="send-method" value="email" checked={sendMethod === 'email'} onChange={e => setSendMethod(e.target.value as any)}
                                    disabled={!isEmailEnabled}
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-primary-500"
                                />
                                <span className="font-medium text-gray-700 dark:text-gray-300">Enviar via Email</span>
                            </label>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Agrupar por:</span>
                            <div className="flex items-center rounded-lg bg-gray-100 dark:bg-gray-700/50 p-1 border dark:border-gray-600">
                                {(['Canal', 'Produto'] as const).map(option => {
                                    const value = option === 'Canal' ? 'store' : 'product';
                                    return (
                                        <button key={value} onClick={() => setGroupBy(value)}
                                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${groupBy === value ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                                            {option}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {hasMultipleCnpjs && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">CNPJ:</span>
                                <select value={cnpjExportMode} onChange={e => setCnpjExportMode(e.target.value as CnpjFilterMode)} className="w-full sm:w-auto pl-3 pr-10 py-2 text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md">
                                    <option value="AMBOS_SEPARADOS">Ambos (Separados)</option>
                                    <option value="AMBOS_UNIDOS">Ambos (Unidos)</option>
                                    <option value="AMBOS">Apenas Ambos</option>
                                    <option value="MM">Apenas MM</option>
                                    <option value="MVF">Apenas MVF</option>
                                </select>
                            </div>
                        )}
                    </div>
                    {uniqueStores.length > 1 && (
                        <div className="mb-4">
                            <div className="flex items-center gap-2 text-sm mb-2">
                                <span className="font-medium text-gray-700 dark:text-gray-300">Filtrar Canais:</span>
                                <button onClick={() => setSelectedStores(uniqueStores)} className="text-blue-600 hover:underline">Todos</button>
                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                <button onClick={() => setSelectedStores([])} className="text-blue-600 hover:underline">Nenhuma</button>
                            </div>
                            <div className="p-3 border dark:border-gray-600 rounded-md flex flex-wrap gap-x-4 gap-y-2">
                                {uniqueStores.map(store => (
                                    <label key={store} className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={selectedStores.includes(store)} onChange={() => handleStoreSelectionChange(store)}
                                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{store}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Rich Display Area */}
                    <div className="text-sm p-4 bg-white text-gray-800 rounded-md max-h-[50vh] overflow-auto border border-gray-300">
                        {groupedData.map(([groupName, items]) => (
                            <div key={groupName} className="mb-6">
                                <h2 className="text-xl font-bold mt-4 text-gray-800 border-b-2 border-gray-300 pb-1 mb-2 flex justify-between items-end">
                                    <span>{groupBy === 'store' ? groupName.toUpperCase() : `PRODUTO: ${groupName.toUpperCase()}`}</span>
                                    <span className="text-xs text-gray-500 font-normal">Gerado em: {getCurrentTimestamp()}</span>
                                </h2>
                                {items.map((order) => (
                                    <div key={order.id} className="ml-4 mb-4">
                                        <h3 className="text-lg font-semibold text-gray-700">
                                            {order.product}
                                            {order.cnpj !== 'Ambos Unidos' && <span className="text-sm font-normal text-gray-500 ml-2">({order.cnpj})</span>}
                                        </h3>
                                        <ul className="list-none pl-4">
                                            {Object.keys(order.quantities).sort().map(color => {
                                                const fontColor = getColorHex(color);
                                                const isWhite = fontColor.toUpperCase() === '#FFFFFF';
                                                const displayColor = isWhite ? '#333333' : fontColor;
                                                return (
                                                    <li key={color} className="text-gray-700 my-1 flex items-center">
                                                        <span className="inline-block w-4 h-4 border border-gray-400 mr-2 flex-shrink-0"></span>
                                                        <strong className="font-semibold" style={{ color: displayColor }} >{color.toUpperCase()}:</strong>
                                                        <span className="ml-2">{formatSizeQuantities(order.quantities[color])}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                        <p className="font-bold text-sm mt-2 text-blue-600">
                                            {`TOTAL: ${order.totals.totalGeral} (Branco: ${order.totals.totalBranco} | Cor: ${order.totals.totalColorido}${order.store === 'GUSHI' && order.totals.totalEspeciais ? ` | Especial: ${order.totals.totalEspeciais}` : ''})`}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex flex-wrap justify-end gap-3">
                    <button onClick={createSendHandler(handleCopyText, true)} className="px-4 py-2 bg-gray-500 text-white text-sm font-semibold rounded-md hover:bg-gray-600 flex items-center gap-2">
                        {sendMethod === 'download' ? (
                            isCopied ? 'Copiado!' : 'Copiar Texto'
                        ) : (
                            `${actionVerb} Texto`
                        )}
                    </button>
                    <button onClick={createSendHandler(() => handleDownload('txt', plainTextData, 'text/plain;charset=utf-8'))} className="px-4 py-2 bg-gray-600 text-white text-sm font-semibold rounded-md hover:bg-gray-700">{actionVerb} .TXT</button>
                    <button onClick={createSendHandler(() => handleDownload('doc', generatePackingListHtml(filteredOrders, groupBy), 'application/msword'))} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700">{actionVerb} .DOC</button>
                    <button onClick={createSendHandler(() => handlePrint(generatePackingListHtml(filteredOrders, groupBy)))} className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700">{actionVerb} .PDF</button>
                    <button onClick={handleExportGrade} className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-md hover:bg-purple-700 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 11a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        {actionVerb} Grade
                    </button>
                </div>
            </div>
        </div>
    );
};
// --- END: NEW EXPORT MODAL & HELPERS ---

interface SavedOrderGridProps {
    order: MergedSavedOrder;
    cost: number;
    savings: number;
    cheapestStore: string | null;
    isSplitting: boolean;
    onCancelSplit: () => void;
    onConfirmSplit: (keptOrder: SavedOrder, faltanteOrder: Omit<SavedOrder, 'id'>) => void;
    onRestore: (updatedFaltanteOrder: SavedOrder, restoredOrder: Omit<SavedOrder, 'id'>) => void;
    relatedRows: TableRow[];
    headers: { idVendaHeader?: string; skuHeader?: string; nomeHeader?: string; dataHeader?: string; quantidadeHeader?: string; };
    showModal: EnviarPedidoProps['showModal'];
    onEditOriginalOrder: (row: TableRow) => void;
    allRows: TableRow[];
    imageMappings?: Record<string, string>;
}

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

const SavedOrderGrid: React.FC<SavedOrderGridProps> = ({
    order, cost, savings, cheapestStore,
    isSplitting, onCancelSplit, onConfirmSplit, onRestore,
    relatedRows, headers, showModal, onEditOriginalOrder, allRows,
    imageMappings = {}
}) => {
    const availableFaltanteStores = STORES.filter(s => s !== order.store);
    const [editedQuantities, setEditedQuantities] = React.useState<GridData>({});
    const [editedCells, setEditedCells] = React.useState<Record<string, Record<string, 'edited' | 'deleted'>>>({});
    const [faltanteStore, setFaltanteStore] = React.useState<string>(availableFaltanteStores[0] || STORES[0]);
    const [showOriginalsModal, setShowOriginalsModal] = React.useState(false);

    React.useEffect(() => {
        if (isSplitting) {
            setEditedQuantities(JSON.parse(JSON.stringify(order.quantities)));
            setEditedCells({});
            // Reset faltanteStore to a valid initial value
            const availableStores = STORES.filter(s => s !== order.store);
            if (!availableStores.includes(faltanteStore)) {
                setFaltanteStore(availableStores[0] || '');
            }
        }
    }, [isSplitting, order.quantities, order.store]);

    const handleQuantityChange = (color: string, size: string, value: string) => {
        const newQty = parseInt(value, 10);
        if (value !== '' && (isNaN(newQty) || newQty < 0)) return;

        const originalQty = (order.quantities as GridData)[color]?.[size] || 0;
        if (!isNaN(newQty) && newQty > originalQty) return;

        setEditedQuantities(prev => {
            const newEdits = JSON.parse(JSON.stringify(prev));
            if (!newEdits[color]) newEdits[color] = {};

            if (value === '' || newQty === 0) {
                newEdits[color][size] = 0;
            } else {
                newEdits[color][size] = newQty;
            }
            return newEdits;
        });

        setEditedCells(prev => {
            const newCells = JSON.parse(JSON.stringify(prev));
            if (!newCells[color]) newCells[color] = {};
            if (value === '' || newQty === 0) {
                newCells[color][size] = 'deleted';
            } else {
                newCells[color][size] = 'edited';
            }
            return newCells;
        });
    };

    const handleConfirm = () => {
        if (order.cnpj === 'Ambos Unidos') {
            showModal('alert', 'Ação não permitida', 'Não é possível dividir ou restaurar uma grade com CNPJ unido. Mude o filtro de CNPJ para "Ambos (Separados)" e edite as grades individualmente.');
            return;
        }

        const isFaltante = order.hasMissingItems;

        if (isFaltante) {
            // --- RESTORE LOGIC ---
            const restoredQuantities: GridData = {};
            Object.entries(order.quantities as GridData).forEach(([color, sizes]) => {
                Object.entries(sizes).forEach(([size, originalQty]) => {
                    const newQty = editedQuantities[color]?.[size] || 0;
                    const restoredQty = (originalQty as number) - newQty;
                    if (restoredQty > 0) {
                        if (!restoredQuantities[color]) restoredQuantities[color] = {};
                        restoredQuantities[color][size] = restoredQty;
                    }
                });
            });

            let remainingRestoredQuantities: GridData = JSON.parse(JSON.stringify(restoredQuantities));
            const keptOnBackorderIds: (string | number)[] = [];
            const restoredIds: (string | number)[] = [];

            const sortedSourceRows = [...relatedRows].sort((a, b) => String(a._uniqueId).localeCompare(String(b._uniqueId!)));

            for (const row of sortedSourceRows) {
                const sku = String(headers.skuHeader ? row[headers.skuHeader] : '');
                const parsed = parseSku(sku);
                const qty = getEffectiveQuantity(sku, String(headers.quantidadeHeader ? row[headers.quantidadeHeader] : ''));

                let assignedToRestored = false;
                if (parsed && parsed.colorName !== 'N/A' && parsed.sizeName !== 'N/A') {
                    const { colorName, sizeName } = parsed;
                    if (remainingRestoredQuantities[colorName]?.[sizeName] > 0) {
                        restoredIds.push(row._uniqueId!);
                        remainingRestoredQuantities[colorName][sizeName] -= qty;
                        assignedToRestored = true;
                    }
                }
                if (!assignedToRestored) {
                    keptOnBackorderIds.push(row._uniqueId!);
                }
            }

            const keptOnBackorderQuantities = editedQuantities;

            const updatedFaltanteTotals = calculateTotalsForGrid(keptOnBackorderQuantities, order.store);
            const updatedFaltanteOrder: SavedOrder = {
                ...(order as SavedOrder),
                quantities: keptOnBackorderQuantities,
                totals: updatedFaltanteTotals,
                colors: Object.keys(keptOnBackorderQuantities).filter(c => Object.values(keptOnBackorderQuantities[c]).some((q: number) => q > 0)),
                sizes: sortSizes(Array.from(new Set(Object.values(keptOnBackorderQuantities).flatMap(sizes => Object.keys(sizes).filter(s => (sizes[s] || 0) > 0))))),
                _sourceRowIds: keptOnBackorderIds,
            };

            const restoredTotals = calculateTotalsForGrid(restoredQuantities, order.store); // Using original store for cost calculation
            const restoredOrder: Omit<SavedOrder, 'id'> = {
                product: order.product,
                store: order.store,
                cnpj: order.cnpj,
                quantities: restoredQuantities,
                totals: restoredTotals,
                colors: Object.keys(restoredQuantities),
                sizes: sortSizes(Array.from(new Set(Object.values(restoredQuantities).flatMap(Object.keys)))),
                _sourceRowIds: restoredIds,
            };

            onRestore(updatedFaltanteOrder, restoredOrder);

        } else {
            // --- SPLIT LOGIC ---
            const keptQuantities: GridData = editedQuantities;
            const faltanteQuantities: GridData = {};

            Object.entries(order.quantities).forEach(([color, sizes]) => {
                Object.entries(sizes).forEach(([size, originalQty]) => {
                    const newQty = keptQuantities[color]?.[size] ?? originalQty;
                    const faltanteQty = originalQty - newQty;
                    if (faltanteQty > 0) {
                        if (!faltanteQuantities[color]) faltanteQuantities[color] = {};
                        faltanteQuantities[color][size] = faltanteQty;
                    }
                });
            });

            // Distribute sourceRowIds based on which items were kept vs moved to backorder
            const keptQuantitiesCopy = JSON.parse(JSON.stringify(keptQuantities));
            const keptIds: (string | number)[] = [];
            const faltanteIds: (string | number)[] = [];

            const sortedSourceRows = (order._originalOrders ? order._originalOrders.flatMap(o => o._sourceRowIds || []) : order._sourceRowIds || [])
                .map(id => allRows.find(row => row._uniqueId === id))
                .filter((row): row is TableRow => !!row)
                .sort((a, b) => String(a._uniqueId).localeCompare(String(b._uniqueId!)));

            for (const row of sortedSourceRows) {
                const sku = String(headers.skuHeader ? row[headers.skuHeader] : '');
                const parsed = parseSku(sku);
                const qty = getEffectiveQuantity(sku, String(headers.quantidadeHeader ? row[headers.quantidadeHeader] : ''));

                let assignedToKept = false;
                if (parsed && parsed.colorName !== 'N/A' && parsed.sizeName !== 'N/A') {
                    const { colorName, sizeName } = parsed;
                    if (keptQuantitiesCopy[colorName]?.[sizeName] > 0) {
                        keptIds.push(row._uniqueId!);
                        keptQuantitiesCopy[colorName][sizeName] -= qty;
                        assignedToKept = true;
                    }
                }
                if (!assignedToKept) {
                    faltanteIds.push(row._uniqueId!);
                }
            }

            const keptTotals = calculateTotalsForGrid(keptQuantities, order.store);
            const keptOrder: SavedOrder = {
                id: String(order.id),
                product: String(order.product),
                store: String(order.store),
                cnpj: order.cnpj as 'MM' | 'MVF' | 'Ambos',
                quantities: keptQuantities,
                totals: keptTotals,
                editedCells: editedCells,
                colors: Object.keys(keptQuantities).filter(c => Object.values(keptQuantities[c]).some(q => q > 0)),
                sizes: sortSizes(Array.from(new Set(Object.values(keptQuantities).flatMap(sizes => Object.keys(sizes).filter(s => (sizes[s] || 0) > 0))))),
                _sourceRowIds: keptIds,
                hasMissingItems: false,
            };

            const faltanteTotals = calculateTotalsForGrid(faltanteQuantities, faltanteStore);
            const faltanteOrder: Omit<SavedOrder, 'id'> = {
                product: String(order.product),
                store: faltanteStore,
                cnpj: order.cnpj as 'MM' | 'MVF' | 'Ambos',
                quantities: faltanteQuantities,
                totals: faltanteTotals,
                hasMissingItems: true,
                colors: Object.keys(faltanteQuantities),
                sizes: sortSizes(Array.from(new Set(Object.values(faltanteQuantities).flatMap(Object.keys)))),
                _sourceRowIds: faltanteIds,
                _originalStore: order.store, // Track original store
                editedCells: undefined,
            };

            // --- CHECK FOR BROKEN KITS/MULTI-ITEM ORDERS ---
            const brokenOrders = new Set<string>();
            const keptOrderIds = new Set<string>();
            const faltanteOrderIds = new Set<string>();

            // Map row IDs back to Order IDs (idVenda)
            // We use relatedRows because sortedSourceRows contains the same items but guaranteed to be in allRows context
            // relatedRows is sufficient as it contains all items for this grid.
            const rowMap = new Map(relatedRows.map(r => [r._uniqueId, r]));

            keptIds.forEach(id => {
                const row = rowMap.get(id);
                if (row && headers.idVendaHeader) keptOrderIds.add(String(row[headers.idVendaHeader]));
            });
            faltanteIds.forEach(id => {
                const row = rowMap.get(id);
                if (row && headers.idVendaHeader) faltanteOrderIds.add(String(row[headers.idVendaHeader]));
            });

            // Find intersection: orders present in BOTH sets
            keptOrderIds.forEach(id => {
                if (faltanteOrderIds.has(id)) brokenOrders.add(id);
            });

            // Filter brokenOrders to find only those that are Kits or Multi-item
            const problematicOrders = Array.from(brokenOrders).filter(id => {
                // Find all rows belonging to this order ID within the current context
                const orderRows = relatedRows.filter(r => String(r[headers.idVendaHeader!]) === id);
                if (orderRows.length === 0) return false;

                // Check if it's a Kit
                const firstRowSku = String(orderRows[0][headers.skuHeader!] || '');
                if (isKit(firstRowSku)) return true;

                // Check if it has multiple rows (meaning multi-item order)
                if (orderRows.length > 1) return true;

                // Check if the single row has quantity > 1
                const totalQty = orderRows.reduce((sum, r) => sum + getEffectiveQuantity(String(r[headers.skuHeader!]), String(r[headers.quantidadeHeader!] || '0')), 0);
                if (totalQty > 1) return true;

                return false;
            });

            if (problematicOrders.length > 0) {
                showModal(
                    'confirm',
                    'Atenção: Quebra de Pedido',
                    <div className="w-full">
                        <div className="mb-4 text-gray-700 dark:text-gray-300">
                            <p className="mb-2">Você está dividindo <strong>{problematicOrders.length}</strong> pedido(s) que não deveriam ser separados (Kits ou Múltiplos itens).</p>
                            <p className="text-xs">O cliente pode receber pacotes de lojas diferentes.</p>
                        </div>

                        <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                            <table className="min-w-full text-xs text-left">
                                <thead className="bg-gray-100 dark:bg-gray-700 font-semibold text-gray-700 dark:text-gray-200 sticky top-0 shadow-sm">
                                    <tr>
                                        <th className="p-2">ID Pedido</th>
                                        <th className="p-2">Cliente</th>
                                        <th className="p-2">SKU</th>
                                        <th className="p-2 text-right">Qt.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {problematicOrders.map(orderId => {
                                        const rows = relatedRows.filter(r => String(r[headers.idVendaHeader!]) === orderId);
                                        if (rows.length === 0) return null;
                                        const row = rows[0];
                                        const isMLStore = getSalesChannel(orderId, row.cnpj || null).startsWith('ML');
                                        const clientName = headers.nomeHeader ? String(row[headers.nomeHeader] || 'N/A') : 'N/A';
                                        const sku = headers.skuHeader ? String(row[headers.skuHeader] || '') : '';
                                        const totalQty = rows.reduce((sum, r) => sum + getEffectiveQuantity(String(r[headers.skuHeader!]), String(r[headers.quantidadeHeader!] || '0')), 0);

                                        return (
                                            <tr key={orderId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="p-2 font-mono whitespace-nowrap">
                                                    {isMLStore ? (
                                                        <a
                                                            href={`https://www.mercadolivre.com.br/vendas/novo/mensagens/${orderId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {orderId}
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-800 dark:text-gray-200 font-medium">{orderId}</span>
                                                    )}
                                                </td>
                                                <td className="p-2 text-gray-600 dark:text-gray-300 truncate max-w-[120px]" title={clientName}>{clientName}</td>
                                                <td className="p-2 text-gray-500 dark:text-gray-400 truncate max-w-[150px]" title={sku}>{transformSku(sku)}</td>
                                                <td className="p-2 text-right font-bold text-gray-800 dark:text-gray-200">{totalQty}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-gray-800 dark:text-gray-200">Deseja confirmar a divisão destes pedidos?</p>
                    </div>,
                    () => {
                        onConfirmSplit(keptOrder, faltanteOrder);
                    },
                    { maxWidth: 'max-w-2xl' }
                );
                return;
            }

            onConfirmSplit(keptOrder, faltanteOrder);
        }
    };

    return (
        <div className={`p-4 rounded-b-xl border-x border-b dark:border-gray-700 transition-all ${isSplitting ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
            {isSplitting && (
                <div className="mb-4 p-3 bg-purple-100 dark:bg-purple-900/50 border border-purple-300 dark:border-purple-700 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                        {order.hasMissingItems ? 'Modo de Restauração: Selecione os itens que você recebeu.' : 'Modo de Divisão: Edite as quantidades para os itens que serão mantidos.'}
                    </p>
                    <div className="flex items-center gap-4">
                        {!order.hasMissingItems && (
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Loja Faltante:</label>
                                <select value={faltanteStore} onChange={e => setFaltanteStore(e.target.value)} className="w-full sm:w-auto p-1.5 text-xs rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-primary-500">
                                    {availableFaltanteStores.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button onClick={onCancelSplit} className="px-3 py-1.5 bg-gray-500 text-white text-xs font-semibold rounded-md hover:bg-gray-600">Cancelar</button>
                            <button onClick={handleConfirm} className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-md hover:bg-purple-700">{order.hasMissingItems ? 'Restaurar' : 'Confirmar Divisão'}</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                <div className="overflow-x-auto border border-gray-300 dark:border-gray-600 rounded-lg lg:col-span-2">
                    <table className="min-w-full text-xs border-collapse">
                        <thead className="bg-gray-100 dark:bg-gray-900/50">
                            <tr>
                                <th className="p-2 text-left font-semibold">CORES</th>
                                {order.sizes.map(size => <th key={size} className="p-2 font-semibold w-16">{size}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {order.colors.map(color => {
                                const bgColor = getColorHex(color);
                                const textColor = getTextColorForBackground(bgColor);
                                return (
                                    <tr key={color} className="border-t border-gray-200 dark:border-gray-700">
                                        <td className="py-1 px-2 font-bold" style={{ backgroundColor: bgColor, color: textColor }}>{color.toUpperCase()}</td>
                                        {order.sizes.map(size => {
                                            const originalQty = order.quantities[color]?.[size] || 0;
                                            const editedQty = editedQuantities[color]?.[size];
                                            const cellState = editedCells[color]?.[size] || order.editedCells?.[color]?.[size];

                                            let cellClass = '';
                                            if (cellState === 'edited') cellClass = 'bg-purple-200 dark:bg-purple-800/50';
                                            else if (cellState === 'deleted') cellClass = 'bg-red-200 dark:bg-red-800/50';

                                            return (
                                                <td key={`${color}-${size}`} className={`p-0 text-center align-middle ${cellClass}`}>
                                                    {isSplitting ? (
                                                        <input
                                                            type="number"
                                                            value={editedQty === 0 ? '' : (editedQty ?? '')}
                                                            onChange={e => handleQuantityChange(color, size, e.target.value)}
                                                            placeholder={String(originalQty > 0 ? originalQty : '')}
                                                            className="w-full h-full text-center rounded-sm border-none focus:ring-2 focus:ring-primary-500 font-bold bg-transparent placeholder-gray-400"
                                                        />
                                                    ) : (
                                                        <span className={`font-bold ${originalQty > 0 ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>{originalQty > 0 ? originalQty : '-'}</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="space-y-3 lg:col-span-3">
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-50 dark:text-gray-400">CUSTO DO PEDIDO</p>
                        <p className="text-3xl font-bold text-gray-800 dark:text-gray-200">{formatCurrency(cost)}</p>
                        {savings > 0 && cheapestStore && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                Economia de <strong>{formatCurrency(savings)}</strong> (vs. {cheapestStore})
                            </p>
                        )}
                    </div>

                    {/* Pedidos Originais - Bottom Modal */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowOriginalsModal(true);
                        }}
                        className="w-full mt-2 px-3 py-2 text-sm font-semibold text-left text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 transition-colors flex items-center justify-between"
                    >
                        <span>📋 Ver Pedidos Originais ({relatedRows.length})</span>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Bottom-Aligned Modal */}
                    {showOriginalsModal && (
                        <div
                            className="fixed inset-0 bg-black/40 z-[9999] flex items-end"
                            onClick={() => setShowOriginalsModal(false)}
                        >
                            <div
                                className="w-full bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl max-h-[60vh] flex flex-col animate-slide-up border-t-4 border-primary-500"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        📋 Pedidos Originais ({relatedRows.length})
                                    </h3>
                                    <button
                                        onClick={() => setShowOriginalsModal(false)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full transition-colors"
                                    >
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-4">
                                    <RelatedOrdersTable
                                        rows={relatedRows}
                                        headers={headers}
                                        editedCells={new Set(Object.entries(editedCells).flatMap(([color, sizes]) => Object.keys(sizes).map(size => `${color}|${size}`)))}
                                        showModal={showModal}
                                        onEditRow={onEditOriginalOrder}
                                        imageMappings={imageMappings}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const EnviarPedido: React.FC<EnviarPedidoProps> = ({
    savedOrders,
    archivedSavedOrders,
    onDeleteOrder,
    onRecoverOrder,
    onDeleteArchivedOrder,
    priceTable,
    onSendOrders,
    showModal,
    contacts,
    onSplitOrder,
    onRestoreFromFaltante,
    allRows,
    headers,
    onUpdateRow,
    onDeleteRow,
    onAddRow,
    allSkuProductNames,
    masterData,
    imageMappings,
}) => {
    const { globalSearchTerm } = useAppContext();
    const [selectedOrders, setSelectedOrders] = React.useState<Set<string>>(new Set());
    const [cnpjFilterMode, setCnpjFilterMode] = React.useState<CnpjFilterMode>('AMBOS_SEPARADOS');
    const [storeFilter, setStoreFilter] = React.useState<string>('all');
    const [productFilter, setProductFilter] = React.useState<string>('all');
    const [showArchived, setShowArchived] = React.useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
    const [showOriginalsModal, setShowOriginalsModal] = React.useState(false);
    const [splitOrderId, setSplitOrderId] = React.useState<string | null>(null);
    const [editingOriginalOrder, setEditingOriginalOrder] = React.useState<TableRow | null>(null);
    const [activeFilters, setActiveFilters] = React.useState<Record<string, 'ALL' | 'KIT' | 'MULTI'>>({});

    const hasMultipleCnpjs = React.useMemo(() => new Set(savedOrders.map(o => o.cnpj)).size > 1, [savedOrders]);
    const allProducts = React.useMemo(() => Array.from(new Set(savedOrders.map(o => o.product))).sort(), [savedOrders]);
    const allStores = React.useMemo(() => Array.from(new Set(savedOrders.map(o => o.store))).sort(), [savedOrders]);

    const handleSend = () => {
        const ordersToSend = savedOrders.filter(o => selectedOrders.has(o.id));
        if (ordersToSend.length === 0) {
            showModal('alert', 'Nenhuma Grade Selecionada', 'Selecione as grades que deseja enviar para a produção.');
            return;
        }

        const ordersWithCosts = ordersToSend.map(order => ({
            order,
            cost: calculateCost(order, priceTable)
        }));

        onSendOrders(ordersWithCosts);
        setSelectedOrders(new Set());
    };

    const handleSelectAll = (ordersToSelect: MergedSavedOrder[]) => {
        const allVisibleIds = new Set(ordersToSelect.map(o => o.id));
        const allCurrentlySelectedOnPage = ordersToSelect.every(o => selectedOrders.has(o.id));

        if (allCurrentlySelectedOnPage) {
            // Deselect all
            setSelectedOrders(prev => {
                const newSet = new Set(prev);
                allVisibleIds.forEach(id => newSet.delete(id));
                return newSet;
            });
        } else {
            // Select all
            setSelectedOrders(prev => new Set([...prev, ...allVisibleIds]));
        }
    };

    const handleSelectionChange = (orderId: string) => {
        setSelectedOrders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) {
                newSet.delete(orderId);
            } else {
                newSet.add(orderId);
            }
            return newSet;
        });
    };

    const toggleFilter = (orderId: string, type: 'KIT' | 'MULTI') => {
        setActiveFilters(prev => {
            const current = prev[orderId] || 'ALL';
            // If clicking the same active filter, toggle off (back to ALL). Else switch to new type.
            const newValue = current === type ? 'ALL' : type;
            return { ...prev, [orderId]: newValue };
        });
    };

    const { sortedAndFilteredOrders, cheapestStorePrices, grandTotalCost, costsByStore } = React.useMemo(() => {
        let filtered: MergedSavedOrder[];

        // Only merge orders if the user explicitly asks for 'AMBOS_UNIDOS'.
        // For 'AMBOS_SEPARADOS', 'MM', or 'MVF', we want the individual saved orders.
        if (cnpjFilterMode === 'AMBOS_UNIDOS') {
            filtered = mergeOrders(savedOrders);
        } else {
            // Use original list (cast to MergedSavedOrder for type compatibility in the rest of the component)
            filtered = savedOrders.map(o => o as unknown as MergedSavedOrder);
        }

        // Apply global search filter
        if (globalSearchTerm) {
            const search = globalSearchTerm.toLowerCase();
            filtered = filtered.filter(order => {
                return (
                    String(order.product || '').toLowerCase().includes(search) ||
                    String(order.store || '').toLowerCase().includes(search)
                );
            });
        }

        if (storeFilter !== 'all') {
            filtered = filtered.filter(o => o.store === storeFilter);
        }
        if (productFilter !== 'all') {
            filtered = filtered.filter(o => o.product === productFilter);
        }

        // If NOT in one of the "Ambos" modes, filter by the specific CNPJ
        if (cnpjFilterMode !== 'AMBOS_SEPARADOS' && cnpjFilterMode !== 'AMBOS_UNIDOS') {
            filtered = filtered.filter(o => o.cnpj === cnpjFilterMode);
        }

        // Sort: Faltante orders first, then by product name
        filtered.sort((a, b) => {
            if (a.hasMissingItems && !b.hasMissingItems) return -1;
            if (!a.hasMissingItems && b.hasMissingItems) return 1;
            return a.product.localeCompare(b.product);
        });

        // Calculate costs *after* filtering
        let totalCost = 0;
        const perStoreCosts: Record<string, number> = {};

        const cheapestPrices: Record<string, { store: string | null; cost: number, savings: number }> = {};

        filtered.forEach(order => {
            const currentCost = calculateCost(order as SavedOrder, priceTable);
            totalCost += currentCost;
            perStoreCosts[order.store] = (perStoreCosts[order.store] || 0) + currentCost;

            let minCost = Infinity;
            let bestStore: string | null = null;
            STORES.forEach(store => {
                const potentialCost = calculateCost(order as SavedOrder, priceTable, store);
                if (potentialCost > 0 && potentialCost < minCost) {
                    minCost = potentialCost;
                    bestStore = store;
                }
            });

            if (bestStore && minCost < currentCost) {
                cheapestPrices[order.id] = { store: bestStore, cost: minCost, savings: currentCost - minCost };
            }
        });

        return {
            sortedAndFilteredOrders: filtered,
            cheapestStorePrices: cheapestPrices,
            grandTotalCost: totalCost,
            costsByStore: perStoreCosts
        };
    }, [savedOrders, cnpjFilterMode, storeFilter, productFilter, priceTable, globalSearchTerm, allRows, headers]);

    // Derived state for what's actually visible on the page (archived or not)
    const displayedOrders = showArchived ? archivedSavedOrders : sortedAndFilteredOrders;

    const allOriginalRows = React.useMemo(() => {
        const rowMap = new Map<string | number, TableRow>();
        allRows.forEach(row => {
            if (row._uniqueId) {
                rowMap.set(row._uniqueId, row);
            }
        });
        console.log('[ENVIAR] allOriginalRows map size:', rowMap.size, 'allRows length:', allRows.length);
        return rowMap;
    }, [allRows]);

    const { skuHeader, idVendaHeader, nomeHeader, dataHeader, quantidadeHeader } = React.useMemo(() => {
        const find = (key: string) => headers.find(h => normalizeString(h).includes(key));
        return {
            skuHeader: find('sku'),
            idVendaHeader: find('numero da ordem de compra'),
            nomeHeader: find('nome'),
            dataHeader: find('data'),
            quantidadeHeader: find('quantidade')
        };
    }, [headers]);


    return (
        <div className="space-y-6">
            <div className="sticky top-[64px] z-[40] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-lg border dark:border-gray-700 shadow-md">
                <div className="flex items-center gap-4">
                    <button onClick={() => setShowArchived(p => !p)} className={`px-4 py-2 text-sm font-semibold rounded-md ${showArchived ? 'bg-gray-600 text-white' : 'bg-white dark:bg-gray-700'}`}>
                        {showArchived ? 'Ver Grades Ativas' : `Ver Arquivados (${archivedSavedOrders.length})`}
                    </button>
                    {hasMultipleCnpjs && !showArchived && (
                        <div>
                            <label htmlFor="cnpj-filter" className="sr-only">Filtrar por CNPJ</label>
                            <select id="cnpj-filter" value={cnpjFilterMode} onChange={e => setCnpjFilterMode(e.target.value as CnpjFilterMode)} className="w-full sm:w-auto pl-3 pr-10 py-2 text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md">
                                <option value="AMBOS_SEPARADOS">Ambos (Separados)</option>
                                <option value="AMBOS_UNIDOS">Ambos (Unidos)</option>
                                <option value="MM">Apenas MM</option>
                                <option value="MVF">Apenas MVF</option>
                            </select>
                        </div>
                    )}
                    {!showArchived && (
                        <>
                            <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} className="w-full sm:w-auto pl-3 pr-10 py-2 text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md">
                                <option value="all">Todas as Lojas</option>
                                {allStores.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select value={productFilter} onChange={e => setProductFilter(e.target.value)} className="w-full sm:w-auto pl-3 pr-10 py-2 text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md">
                                <option value="all">Todos os Produtos</option>
                                {allProducts.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </>
                    )}
                </div>
                {!showArchived && (
                    <div className="flex items-center gap-4">
                        <button onClick={() => handleSelectAll(sortedAndFilteredOrders)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white text-sm font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                            Selecionar Tudo
                        </button>
                        <button onClick={() => setIsExportModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700">Enviar para Loja</button>
                        <button onClick={handleSend} disabled={selectedOrders.size === 0} className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700 disabled:bg-gray-400">Finalizar Pedido ({selectedOrders.size})</button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-4">
                {Object.entries(costsByStore).map(([store, cost], index) => {
                    const style = storeStyles[store] || defaultStoreStyle;
                    const colorFrom = style.bg.includes('blue') ? 'from-blue-500' :
                        style.bg.includes('purple') ? 'from-purple-500' :
                            style.bg.includes('emerald') ? 'from-emerald-500' :
                                style.bg.includes('amber') ? 'from-amber-500' :
                                    style.bg.includes('rose') ? 'from-rose-500' : 'from-gray-500';

                    return (
                        <div key={store} className="animate-fade-in-scale" style={{ animationDelay: `${index * 0.05}s` }}>
                            <KpiCard
                                variant="secondary"
                                title={store}
                                value={formatCurrency(cost as number)}
                                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                                colorObj={{
                                    from: colorFrom,
                                    to: '',
                                    shadow: '',
                                    iconBg: style.bg,
                                    text: style.text,
                                    border: `border-gray-200 dark:border-gray-700`
                                }}
                            />
                        </div>
                    );
                })}
                <div className="animate-fade-in-scale" style={{ animationDelay: `${Object.keys(costsByStore).length * 0.05}s` }}>
                    <KpiCard
                        variant="secondary"
                        title="CUSTO TOTAL"
                        value={formatCurrency(grandTotalCost)}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>}
                        colorObj={{
                            from: 'from-emerald-500',
                            to: 'to-teal-600',
                            shadow: 'shadow-emerald-500/20',
                            iconBg: 'bg-emerald-500/10',
                            text: 'text-emerald-600 dark:text-emerald-400',
                            border: 'border-emerald-200 dark:border-emerald-800/50'
                        }}
                    />
                </div>
            </div>

            <div className="space-y-4">
                {displayedOrders.map(order => {
                    const typedOrder = order as MergedSavedOrder; // Cast for handling merged properties
                    const isSelected = selectedOrders.has(typedOrder.id);
                    const costInfo = cheapestStorePrices[typedOrder.id];
                    const originalSourceRows = (typedOrder._originalOrders ? typedOrder._originalOrders.flatMap(o => o._sourceRowIds || []) : typedOrder._sourceRowIds || [])
                        .map(id => allOriginalRows.get(id))
                        .filter((row): row is TableRow => !!row);

                    console.log('[ENVIAR] Order:', typedOrder.id, '_sourceRowIds:', typedOrder._sourceRowIds, 'found rows:', originalSourceRows.length);

                    const activeFilter = activeFilters[typedOrder.id] || 'ALL';

                    const relatedRows = (() => {
                        if (activeFilter === 'ALL') return originalSourceRows;
                        return originalSourceRows.filter(row => {
                            const sku = String(row[skuHeader!] || '');
                            const quantity = getEffectiveQuantity(sku, String(row[quantidadeHeader!] || '0'));
                            if (activeFilter === 'KIT') return isKit(sku);
                            if (activeFilter === 'MULTI') return quantity > 1 && !isKit(sku);
                            return true;
                        });
                    })();

                    const kitCount = originalSourceRows.filter(r => isKit(String(r[skuHeader!] || ''))).length;
                    const multiCount = originalSourceRows.filter(r => {
                        const s = String(r[skuHeader!] || '');
                        const q = getEffectiveQuantity(s, String(r[quantidadeHeader!] || '0'));
                        return q > 1 && !isKit(s);
                    }).length;

                    // Calculate channel breakdown
                    const channelBreakdown = originalSourceRows.reduce((acc, row) => {
                        const orderId = String(row[idVendaHeader!] || '');
                        const storeName = getSalesChannel(orderId, row.cnpj || null);
                        const sku = String(row[skuHeader!] || '');
                        const qty = getEffectiveQuantity(sku, String(row[quantidadeHeader!] || '0'));
                        acc[storeName] = (acc[storeName] || 0) + qty;
                        return acc;
                    }, {} as Record<string, number>);

                    const sortedChannels = Object.entries(channelBreakdown).sort((a, b) => b[1] - a[1]);

                    return (
                        <div key={order.id} className={`bg-white dark:bg-gray-800/50 rounded-xl shadow-lg border-2 ${isSelected ? 'border-primary-500' : 'border-gray-200 dark:border-gray-700'}`}>
                            <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex items-center gap-4 flex-grow min-w-0">
                                    {!showArchived && (
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleSelectionChange(typedOrder.id)}
                                            className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
                                        />
                                    )}
                                    <div className="flex-grow min-w-0">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 truncate" title={order.product}>{order.product}</h2>
                                            {(() => {
                                                const storeStyle = storeStyles[order.store] || defaultStoreStyle;
                                                return (
                                                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${storeStyle.bg} ${storeStyle.text}`}>{order.store}</span>
                                                );
                                            })()}
                                            {order.hasMissingItems && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200">FALTANTE</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${typedOrder.cnpj === 'MM' ? 'bg-purple-200 text-purple-800 dark:bg-purple-800/50 dark:text-purple-200' : typedOrder.cnpj === 'MVF' ? 'bg-blue-200 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>{typedOrder.cnpj}</span>
                                            <span>|</span>
                                            <span>{order.totals.totalGeral} peças</span>
                                            {showArchived && <span className="text-xs">Arquivado em: {new Date((order as ArchivedSavedOrder).archivedDate).toLocaleDateString()}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 flex flex-wrap items-center gap-2 mt-2 sm:mt-0 justify-end">
                                    {showArchived ? (
                                        <>
                                            <button onClick={() => onRecoverOrder(order as ArchivedSavedOrder)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700">Recuperar</button>
                                            <button onClick={() => onDeleteArchivedOrder(order.id)} className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700">Apagar</button>
                                        </>
                                    ) : (
                                        <>
                                            {/* Channel Badges */}
                                            {sortedChannels.map(([channel, count]) => {
                                                const style = storeStyles[channel] || defaultStoreStyle;
                                                return (
                                                    <span key={channel} className={`px-3 py-1 text-sm font-bold rounded-md border shadow-sm whitespace-nowrap ${style.bg} ${style.text} ${style.border}`}>
                                                        {channel} {count}
                                                    </span>
                                                );
                                            })}

                                            {kitCount > 0 && (
                                                <button
                                                    onClick={() => toggleFilter(typedOrder.id, 'KIT')}
                                                    className={`px-3 py-1 text-sm font-bold rounded-md border uppercase shadow-sm whitespace-nowrap transition-all ${activeFilter === 'KIT'
                                                        ? 'bg-blue-200 text-blue-900 border-blue-400 ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800'
                                                        : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900/70'
                                                        }`}
                                                >
                                                    KIT {kitCount}
                                                </button>
                                            )}
                                            {multiCount > 0 && (
                                                <button
                                                    onClick={() => toggleFilter(typedOrder.id, 'MULTI')}
                                                    className={`px-3 py-1 text-sm font-bold rounded-md border uppercase shadow-sm whitespace-nowrap transition-all ${activeFilter === 'MULTI'
                                                        ? 'bg-yellow-200 text-yellow-900 border-yellow-400 ring-2 ring-yellow-500 ring-offset-1 dark:ring-offset-gray-800'
                                                        : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-900/70'
                                                        }`}
                                                >
                                                    MULTI {multiCount}
                                                </button>
                                            )}
                                            <button onClick={() => setSplitOrderId(typedOrder.id)} className="px-6 py-2 bg-purple-600 text-white text-sm font-semibold rounded-md hover:bg-purple-700 whitespace-nowrap">{order.hasMissingItems ? 'Restaurar Itens' : 'Dividir Grade'}</button>
                                            <button onClick={() => onDeleteOrder(order.id)} className="flex-shrink-0 p-2.5 bg-red-600 text-white rounded-md hover:bg-red-700" title="Apagar Grade">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <SavedOrderGrid
                                order={typedOrder}
                                cost={calculateCost(typedOrder as SavedOrder, priceTable)}
                                savings={costInfo?.savings || 0}
                                cheapestStore={costInfo?.store || null}
                                isSplitting={splitOrderId === typedOrder.id}
                                onCancelSplit={() => setSplitOrderId(null)}
                                onConfirmSplit={(kept, faltante) => { onSplitOrder(kept, faltante); setSplitOrderId(null); }}
                                onRestore={(updated, restored) => { onRestoreFromFaltante(updated, restored); setSplitOrderId(null); }}
                                relatedRows={relatedRows}
                                headers={{ idVendaHeader, skuHeader, nomeHeader, dataHeader, quantidadeHeader }}
                                showModal={showModal}
                                onEditOriginalOrder={(row) => setEditingOriginalOrder(row)}
                                allRows={allRows}
                                imageMappings={imageMappings}
                            />
                        </div>
                    );
                })}
                {displayedOrders.length === 0 && (
                    <div className="text-center py-16 text-gray-500 dark:text-gray-400 border-2 border-dashed dark:border-gray-700 rounded-lg">
                        <p>Nenhuma grade encontrada.</p>
                    </div>
                )}
            </div>

            {isExportModalOpen && (
                <ExportModal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    orders={savedOrders}
                    showModal={showModal}
                    contacts={contacts}
                    selectedStore={storeFilter}
                />
            )}
            {editingOriginalOrder && skuHeader && quantidadeHeader && (
                <EditModal
                    row={editingOriginalOrder}
                    onClose={() => setEditingOriginalOrder(null)}
                    onSave={(row, newSku, newQuantity) => {
                        if (row._uniqueId) {
                            onUpdateRow(row._supabaseId || row._uniqueId, {
                                [skuHeader]: newSku,
                                [quantidadeHeader]: newQuantity
                            });
                        }
                        setEditingOriginalOrder(null);
                    }}
                    onDelete={onDeleteRow}
                    onAdd={onAddRow}
                    skuHeader={skuHeader}
                    quantidadeHeader={quantidadeHeader}
                    idVendaHeader={headers.find(h => normalizeString(h).includes('numero da ordem de compra'))}
                    imageMappings={imageMappings}
                    allSkuProductNames={allSkuProductNames}
                    masterData={masterData}
                />
            )}
        </div>
    );
};