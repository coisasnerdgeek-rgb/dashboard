import { supabase } from './supabaseClient';
import { MarketplaceFee } from '../types';

export const defaultMarketplaceFees: MarketplaceFee[] = [
    {
        marketplace: 'SH',
        name: 'Shopee',
        commission_percent: 14,
        fixed_fee: 4.00,
        tax_rate: 6,
        is_active: true,
        rules_json: {
            free_shipping_threshold: 79,
            max_commission: 100.00 // Shopee commission cap
        }
    },
    {
        marketplace: 'ML',
        name: 'Mercado Livre',
        commission_percent: 11, // Base (Classic)
        fixed_fee: 0, // Varies by tier
        tax_rate: 6,
        is_active: true,
        rules_json: {
            fixed_fee_tiers: [
                { max: 29.00, value: 6.25 },
                { max: 50.00, value: 6.50 },
                { max: 79.00, value: 6.75 }
            ],
            free_shipping_threshold: 79.00,
        }
    },
    {
        marketplace: 'AM',
        name: 'Amazon',
        commission_percent: 15,
        fixed_fee: 0,
        tax_rate: 6,
        is_active: true
    },
    {
        marketplace: 'MG',
        name: 'Magalu',
        commission_percent: 12.8,
        fixed_fee: 5.00,
        tax_rate: 6,
        is_active: true
    },
    {
        marketplace: 'NT',
        name: 'Netshoes',
        commission_percent: 20,
        fixed_fee: 0,
        tax_rate: 6,
        is_active: true
    },
    {
        marketplace: 'SHE', // User said "SG", checking normalization
        name: 'Shein',
        commission_percent: 16,
        fixed_fee: 0,
        tax_rate: 6,
        is_active: true
    },
    {
        marketplace: 'SI',
        name: 'Site Próprio',
        commission_percent: 0,
        fixed_fee: 0,
        tax_rate: 6,
        is_active: true
    },
    {
        marketplace: 'OT',
        name: 'Outros / Padrão',
        commission_percent: 10,  // Generic default
        fixed_fee: 0,
        tax_rate: 6,
        is_active: true
    }
];

export const getMarketplaceFees = async (): Promise<MarketplaceFee[]> => {
    // Try to fetch from Supabase
    const { data, error } = await supabase
        .from('marketplace_fees')
        .select('*');

    if (error) {
        console.error('Error fetching marketplace fees:', error);
        return defaultMarketplaceFees;
    }

    if (!data || data.length === 0) {
        return defaultMarketplaceFees;
    }

    return data as MarketplaceFee[];
};

export const saveMarketplaceFee = async (fee: MarketplaceFee): Promise<MarketplaceFee> => {
    const { data, error } = await supabase
        .from('marketplace_fees')
        .upsert(fee)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data as MarketplaceFee;
};

export const initializeMarketplaceFees = async () => {
    // Check if table is empty and seed
    const { count, error } = await supabase
        .from('marketplace_fees')
        .select('*', { count: 'exact', head: true });

    if (!error && count === 0) {
        console.log('Seeding marketplace fees...');
        for (const fee of defaultMarketplaceFees) {
            // Remove 'id' if present in default to allow DB to generate it, or specific fixed IDs
            const { ...feeData } = fee;
            await supabase.from('marketplace_fees').insert(feeData);
        }
    }
};

/**
 * Calculates the total marketplace fee for a given price and channel.
 */
export const calculateMarketplaceFees = (
    totalPrice: number,
    channelCode: string,
    fees: MarketplaceFee[],
    quantity: number = 1
): { totalFee: number, commission: number, fixed: number, tax: number, details: string[] } => {

    let normalizedChannel = channelCode.toUpperCase().trim();

    // Better normalization mapping
    if (normalizedChannel.includes('SHOPEE') || normalizedChannel.includes('SHP') || normalizedChannel.startsWith('SH ')) normalizedChannel = 'SH';
    else if (normalizedChannel.includes('MERCADO') || normalizedChannel.includes('LIVRE') || normalizedChannel.includes('JADLOG') || normalizedChannel === 'ML' || normalizedChannel.startsWith('ML ')) normalizedChannel = 'ML'; // Jadlog usually associated with ML drop-offs in some exports? Just "Mercado" is safer.
    else if (normalizedChannel.includes('AMAZON') || normalizedChannel === 'AM') normalizedChannel = 'AM';
    else if (normalizedChannel.includes('MAGALU') || normalizedChannel.includes('MAGAZINE')) normalizedChannel = 'MG';
    else if (normalizedChannel.includes('NETSHOES') || normalizedChannel === 'NT' || normalizedChannel.startsWith('NT ')) normalizedChannel = 'NT';
    else if (normalizedChannel.includes('SHEIN')) normalizedChannel = 'SHE';
    else if (normalizedChannel.includes('SITE')) normalizedChannel = 'SI';
    else if (normalizedChannel === 'SG') normalizedChannel = 'SHE';

    let rule = fees.find(f => f.marketplace === normalizedChannel) ||
        fees.find(f => f.name.toUpperCase().includes(channelCode.toUpperCase())) ||
        // Fallback defaults if DB is empty or missing
        defaultMarketplaceFees.find(f => f.marketplace === normalizedChannel);

    const details: string[] = [];

    // Fallback to 'Outros' if NO rule found
    if (!rule) {
        rule = fees.find(f => f.marketplace === 'OT') || defaultMarketplaceFees.find(f => f.marketplace === 'OT');
        if (rule) {
            details.push(`Regra exata não encontrada. Usando '${rule.name}'.`);
        }
    }

    if (!rule) {
        return { totalFee: 0, commission: 0, fixed: 0, tax: 0, details: ['Regra não encontrada'] };
    }



    // 1. Commission
    let commission = totalPrice * (rule.commission_percent / 100);

    const unitPrice = totalPrice / quantity;

    // Check for Max Commission Cap (common in Shopee, e.g. R$ 100 limit)
    if (rule.rules_json && (rule.rules_json as any).max_commission) {
        const maxComm = (rule.rules_json as any).max_commission;
        if (commission > maxComm) {
            commission = maxComm;
            details.push(`Comissão limitada ao teto de R$ ${maxComm.toFixed(2)}`);
        }
    }
    details.push(`Comissão (${rule.commission_percent}%): R$ ${commission.toFixed(2)}`);

    // 2. Fixed Fee
    let fixed = rule.fixed_fee * quantity; // Base fixed fee multiplied by quantity

    // Check for advanced rules in JSON
    if (rule.rules_json) {
        const rules = rule.rules_json as any;

        // Tiered Fixed Fees (e.g. ML) - Applied PER UNIT
        if (rules.fixed_fee_tiers && Array.isArray(rules.fixed_fee_tiers)) {
            // Sort tiers by max price ascending
            const tiers = rules.fixed_fee_tiers.sort((a: any, b: any) => a.max - b.max);
            const applicableTier = tiers.find((t: any) => unitPrice <= t.max);

            if (applicableTier) {
                fixed = applicableTier.value * quantity;
                details.push(`Taxa Fixa (Tier <= ${applicableTier.max} x ${quantity}): R$ ${fixed.toFixed(2)}`);
            } else {
                // If unitPrice >= threshold (e.g. 79), the fixed fee (unit fee) is usually waived
                if (rules.free_shipping_threshold && unitPrice >= rules.free_shipping_threshold) {
                    fixed = 0;
                    details.push(`Unitário >= R$ ${rules.free_shipping_threshold}: Isento de Taxa Fixa.`);
                } else if (rule.fixed_fee > 0) {
                    // Fallback to base fixed fee if > all tiers but < threshold
                    fixed = rule.fixed_fee * quantity;
                }
            }
        } else if (rules.free_shipping_threshold && unitPrice >= rules.free_shipping_threshold) {
            // Simple threshold check if no tiers
            fixed = 0;
            details.push(`Unitário >= R$ ${rules.free_shipping_threshold}: Isento de Taxa Fixa.`);
        }
    }

    // Only ensure fixed fee is non-zero or explicitly show 0 if it was waived
    if (fixed > 0 || !details.some(d => d.includes('Taxa Fixa') || d.includes('Isento'))) {
        details.push(`Taxa Fixa Base: R$ ${fixed.toFixed(2)}`);
    }

    // 3. Tax (Imposto)
    const tax = totalPrice * (rule.tax_rate / 100);
    details.push(`Imposto (${rule.tax_rate}%): R$ ${tax.toFixed(2)}`);

    const totalFee = commission + fixed + tax;

    return { totalFee, commission, fixed, tax, details };
};
