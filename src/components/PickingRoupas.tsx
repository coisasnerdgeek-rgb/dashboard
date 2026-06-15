
import * as React from 'react';
import { TableRow } from '../types';
import { getCategory, parseSku } from '../services/skuService';
import { normalizeString } from '../utils/stringUtils';
import { getSalesChannel } from '../services/ecommerceService';
import UniversalPicking, { UniversalPickingItem } from './UniversalPicking';

interface PickingRoupasProps {
    headers: string[];
    data: TableRow[];
    onRowClick: (row: TableRow) => void;
    trackingMappings: Record<string, string>;
    imageMappings: Record<string, string>;
}

const PickingRoupas: React.FC<PickingRoupasProps> = ({ headers, data, onRowClick, trackingMappings, imageMappings }) => {
    const { idVendaHeader, skuHeader, situacaoHeader, nomeHeader } = React.useMemo(() => {
        const find = (key: string) => headers.find(h => normalizeString(h).includes(key));
        return {
            skuHeader: find('sku'),
            idVendaHeader: find('numero da ordem de compra'),
            situacaoHeader: find('situacao'),
            nomeHeader: find('nome'),
        };
    }, [headers]);

    const normalizedItems: UniversalPickingItem[] = React.useMemo(() => {
        if (!skuHeader || !idVendaHeader) return [];

        return data
            .filter(row => {
                const sku = String(row[skuHeader] ?? '');
                if (getCategory(sku) !== 'Roupas') return false;

                // Status Filter: Exclude completed orders
                if (situacaoHeader) {
                    const status = String(row[situacaoHeader] ?? '').toLowerCase().trim();
                    if (['entregue', 'enviado', 'cancelado'].includes(status)) return false;
                }

                return true;
            })
            .map(row => {
                const sku = String(row[skuHeader] ?? '');
                const parsed = parseSku(sku);
                const idVenda = String(row[idVendaHeader] ?? '');
                const store = getSalesChannel(idVenda, row.cnpj || null);

                const productName = parsed?.productName || 'N/A';
                const colorName = parsed?.colorName || 'N/A';
                const sizeName = parsed?.sizeName || 'N/A';

                return {
                    _uniqueId: row._uniqueId || `roupa-${Math.random()}`,
                    _idVenda: idVenda,
                    _sku: sku,
                    _store: store,
                    _nome: String(row[nomeHeader!] ?? ''),
                    _rastreio: trackingMappings[idVenda],

                    // Mappings for Universal Picking
                    title: productName,
                    subtitle: `${colorName} - ${sizeName}`,
                    imageUrl: imageMappings[idVenda] || imageMappings[sku],
                    isPersonalized: false, // Roupas generally don't use the Transp/Perso filter in the same way
                    groupKey: productName, // Group Summary by Product
                    subGroupKey: `${productName} ${colorName} ${sizeName}` // Unique key for counting (Product+Color+Size) or just Product if we want stats by Product
                };
            });
    }, [data, skuHeader, idVendaHeader, situacaoHeader, trackingMappings, imageMappings]);

    if (!idVendaHeader || !skuHeader) {
        return <div className="text-center text-red-500"><p>Colunas SKU e ID Venda necessárias.</p></div>;
    }

    return (
        <UniversalPicking
            items={normalizedItems}
            onRowClick={onRowClick}
            summaryLabels={{ group: 'Produto', subGroup: 'Variação' }}
            filterOptions={{ showTransparentPersonalized: false }} // Disable this filter for Roupas
        />
    );
};

export default PickingRoupas;
