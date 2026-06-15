// services/ecommerceService.ts

export const getSalesChannel = (orderId: string | number, fileCnpj: 'MM' | 'MVF' | null, channel?: string): string => {
    // Map generic channel names to specific stores based on CNPJ
    if (channel) {
        const trimmedChannel = channel.trim();
        const normalizedChannel = trimmedChannel.toLowerCase();

        // Mapping generic names
        if (normalizedChannel === 'shopee') {
            return fileCnpj === 'MM' ? 'SH MM' : 'SH VEST';
        }
        if (normalizedChannel === 'mercado livre' || normalizedChannel === 'mercadolivre') {
            return fileCnpj === 'MM' ? 'ML MM' : 'ML VEST';
        }

        // Preserve already specific channel names or normalize them
        const specificStores = [
            'SH MM', 'SH VEST', 'ML MM', 'ML VEST',
            'MG VEST', 'NT VEST', 'SN VEST', 'AM VEST', 'KW VEST',
            'MG MM', 'NT MM', 'SN MM', 'AM MM', 'KW MM'
        ];
        const upperChannel = trimmedChannel.toUpperCase();
        if (specificStores.includes(upperChannel)) {
            return upperChannel;
        }

        // If it's something like "Mercado Livre - MM", we can try to extract parts
        if (upperChannel.includes('MERCADO LIVRE') || upperChannel.includes('MERCADOLIVRE')) {
            return fileCnpj === 'MM' || upperChannel.includes('MM') ? 'ML MM' : 'ML VEST';
        }
        if (upperChannel.includes('SHOPEE')) {
            return fileCnpj === 'MM' || upperChannel.includes('MM') ? 'SH MM' : 'SH VEST';
        }
    }

    // Ensure orderId is always a string and trimmed, default to empty string if null/undefined
    const id = String(orderId ?? '').trim();
    if (!id) return 'BUSINESS';

    // Added '26' to catch newer Shopee IDs
    const isShopee = ['26', '2510', 'ID2', '25091', '25010', '25011', '2509', '2501', '2502', '250', '251', '252', '253', '254', '255', '256', '257', '258', '259', '260'].some(prefix => id.startsWith(prefix));

    if (isShopee) {
        if (fileCnpj === 'MM') return 'SH MM';
        return 'SH VEST'; // Default to SH VEST (MVF)
    }

    let lojaBase: string;

    if (id.startsWith('2000') || id.startsWith('2,000') || id.startsWith('0200') || id.startsWith('MLB')) {
        lojaBase = 'ML VEST';
    } else if (id.startsWith('LU-')) {
        lojaBase = 'MG VEST';
    } else if (id.startsWith('14')) {
        lojaBase = 'NT VEST';
    } else if (id.startsWith('GSH')) {
        lojaBase = 'SN VEST';
    } else if (id.match(/^\d{3}-\d{7}-\d{7}$/) || id.startsWith('701') || id.startsWith('702')) {
        lojaBase = 'AM VEST';
    } else if (id.startsWith('12')) {
        lojaBase = 'KW VEST';
    } else {
        lojaBase = 'BUSINESS';
    }

    if (fileCnpj === 'MM' && lojaBase !== 'BUSINESS') {
        return lojaBase.replace('VEST', 'MM');
    }

    return lojaBase;
};

export const getSupplier = (salesChannel: string, fileCnpj?: string | null): string => {
    const upper = salesChannel.trim().toUpperCase();

    // 1. Try to determine from channel suffix
    if (upper.endsWith(' MM') || upper.includes(' MM')) return 'MM';
    if (upper.endsWith(' VEST') || upper.includes(' VEST')) return 'MVF';

    // 2. Try to determine from fileCnpj
    if (fileCnpj === 'MM') return 'MM';
    if (fileCnpj === 'MVF') return 'MVF';

    // 3. Default
    return 'MVF';
};