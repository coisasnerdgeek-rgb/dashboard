
import * as React from 'react';
import { TableRow } from '../types';
import { getCategory, parseSku, getEffectiveQuantity, isPersonalizado, isKit } from '../services/skuService';
import { normalizeString } from '../utils/stringUtils';
import { getSalesChannel } from '../services/ecommerceService';
import UniversalPicking, { UniversalPickingItem } from './UniversalPicking';

interface PickingProps {
    headers: string[];
    data: TableRow[];
    onRowClick: (row: TableRow) => void;
    trackingMappings: Record<string, string>;
    imageMappings: Record<string, string>;
}

const Picking: React.FC<PickingProps> = ({ headers, data, onRowClick, trackingMappings, imageMappings }) => {
    const { idVendaHeader, skuHeader, quantidadeHeader, situacaoHeader, nomeHeader } = React.useMemo(() => {
        const find = (key: string) => headers.find(h => normalizeString(h).includes(key));
        return {
            skuHeader: find('sku'),
            quantidadeHeader: find('quantidade'),
            idVendaHeader: find('numero da ordem de compra'),
            situacaoHeader: find('situacao'),
            nomeHeader: find('nome'),
        };
    }, [headers]);

    const normalizedItems: UniversalPickingItem[] = React.useMemo(() => {
        if (!skuHeader || !quantidadeHeader || !idVendaHeader) return [];

        return data
            .filter(row => {
                const sku = String(row[skuHeader] ?? '');
                if (getCategory(sku) !== 'Capinha') return false;
                return true;
            })
            .map(row => {
                const sku = String(row[skuHeader] ?? '');
                const parsed = parseSku(sku);
                const idVenda = String(row[idVendaHeader] ?? '');
                const store = getSalesChannel(idVenda, row.cnpj || null);
                const isPerso = isPersonalizado(sku);
                const brand = parsed?.colorName || 'N/A';
                const model = parsed?.sizeName || 'N/A';

                return {
                    _uniqueId: row._uniqueId || `capinha-${Math.random()}`,
                    _idVenda: idVenda,
                    _sku: sku,
                    _store: store,
                    _nome: String(row[nomeHeader!] ?? ''),
                    _rastreio: trackingMappings[idVenda],

                    // Mappings for Universal Picking
                    title: model,
                    subtitle: brand,
                    imageUrl: imageMappings[idVenda] || imageMappings[sku],
                    isPersonalized: isPerso,
                    groupKey: brand, // Group Summary by Brand
                    subGroupKey: model // Count stats by Model
                };
            });
    }, [data, skuHeader, quantidadeHeader, idVendaHeader, situacaoHeader, trackingMappings, imageMappings]);

    if (!idVendaHeader || !skuHeader) {
        return <div className="text-center text-red-500"><p>Colunas SKU e ID Venda necessárias.</p></div>;
    }

    return (
        <UniversalPicking
            items={normalizedItems}
            onRowClick={onRowClick}
            summaryLabels={{ group: 'Marca', subGroup: 'Modelo' }}
            filterOptions={{ showTransparentPersonalized: true }}
        />
    );
};

export default Picking;
