// services/priceTableService.ts
import { PriceProduct, SavedOrder } from '../Dashboard/types';
import { normalizeString } from '../utils/stringUtils';
import { getPriceTables, savePriceTable as savePriceTableSupabase } from './supabaseService';

export const initialStoresData = [
    { name: 'ERON', types: ['COR'] },
    { name: 'MAGIC', types: ['BRANCO', 'COR'] },
    { name: 'GUSHI', types: ['BRANCO', 'COR', 'ESPECIAL'] },
    { name: 'GLOBAL', types: ['BRANCO', 'COR'] },
    { name: 'MIKONOS', types: ['BRANCO', 'COR'] },
    { name: 'INDICE', types: ['BRANCO', 'COR'] },
    { name: 'FENOMENAL', types: ['BRANCO', 'COR'] },
    { name: 'ALFA DEZ', types: ['COR'] },
    { name: 'SITE', types: ['BRANCO'] },
];

export const defaultPriceData: PriceProduct[] = [
    {
        id: 'p1',
        category: "Outros",
        product: "QUADRO A4 UV",
        skuProductName: null,
        prices: { 'SITE': { 'BRANCO': 10.50 } }
    },
    {
        id: 'p2',
        category: "Feminino",
        product: "BABYLOOK",
        skuProductName: null,
        prices: {
            'MAGIC': { 'BRANCO': 13.50, 'COR': 15.00 },
            'GUSHI': { 'BRANCO': 15.00, 'COR': 16.30, 'ESPECIAL': 16.30 },
            'MIKONOS': { 'BRANCO': 14.50 },
            'SITE': { 'BRANCO': 12.00 }
        }
    },
    {
        id: 'p3',
        category: "Feminino",
        product: "BABYLOOK V",
        skuProductName: null,
        prices: {
            'MAGIC': { 'BRANCO': 13.50, 'COR': 13.50 },
            'GUSHI': { 'BRANCO': 16.20, 'COR': 17.80, 'ESPECIAL': 17.80 },
            'GLOBAL': { 'BRANCO': 13.99, 'COR': 13.99 }
        }
    },
    { id: 'p4', category: "Feminino", product: "BLUSA GOLA CARECA PLUS SIZE FENOMENAL", skuProductName: null, prices: { 'FENOMENAL': { 'BRANCO': 37.00, 'COR': 37.00 } } },
    { id: 'p5', category: "Feminino", product: "BLUSA GOLA V MAIOR PLUS SIZE", skuProductName: null, prices: { 'FENOMENAL': { 'BRANCO': 37.00, 'COR': 37.00 } } },
    { id: 'p6', category: "Feminino", product: "BLUSA LONGLINE DE VISCO", skuProductName: null, prices: { 'FENOMENAL': { 'BRANCO': 37.00, 'COR': 37.00 } } },
    { id: 'p7', category: "Feminino", product: "BLUSA MALHA FRIA MODERNA", skuProductName: null, prices: { 'INDICE': { 'BRANCO': 21.00, 'COR': 21.00 } } },
    { id: 'p8', category: "Feminino", product: "BLUSA V LONGA BÁSICA", skuProductName: null, prices: { 'INDICE': { 'BRANCO': 21.00, 'COR': 21.00 } } },
    { id: 'p9', category: "Outros", product: "BOTTON", skuProductName: null, prices: {} },
    { id: 'p10', category: "Outros", product: "CALÇA DE MOLETOM", skuProductName: null, prices: { 'MAGIC': { 'COR': 40.99 } } },
    { id: 'p11', category: "Outros", product: "CALÇA DE MOLETOM XG", skuProductName: null, prices: { 'MAGIC': { 'COR': 44.99 } } },
    {
        id: 'p12',
        category: "Feminino",
        product: "CAMISETA BABYLOOK PLUS SIZE",
        skuProductName: null,
        prices: {
            'MAGIC': { 'BRANCO': 14.50, 'COR': 14.50 },
            'GUSHI': { 'BRANCO': 18.20, 'COR': 18.20, 'ESPECIAL': 18.20 },
            'SITE': { 'BRANCO': 12.50 }
        }
    },
    { id: 'p13', category: "Masculino", product: "CAMISETA GOLA V MALHA FRIA PLUS SIZE MASCULINA", skuProductName: null, prices: { 'GUSHI': { 'BRANCO': 29.90, 'COR': 29.90, 'ESPECIAL': 29.90 }, 'SITE': { 'BRANCO': 21.00 } } },
    { id: 'p14', category: "Feminino", product: "CAMISETA GOLA V PLUS SIZE FEMININA", skuProductName: null, prices: { 'GUSHI': { 'BRANCO': 20.50, 'COR': 20.50, 'ESPECIAL': 20.50 }, 'SITE': { 'BRANCO': 15.00 } } },
    {
        id: 'p15',
        category: "Infantil",
        product: "CAMISETA INFANTIL",
        skuProductName: null,
        prices: {
            'MAGIC': { 'BRANCO': 14.50, 'COR': 14.50 },
            'GUSHI': { 'BRANCO': 14.40, 'COR': 16.80, 'ESPECIAL': 16.80 },
            'GLOBAL': { 'BRANCO': 10.93, 'COR': 10.93 },
            'SITE': { 'BRANCO': 8.00 }
        }
    },
    { id: 'p16', category: "Infantil", product: "CAMISETA INFANTIL MANGA LONGA", skuProductName: null, prices: { 'GUSHI': { 'BRANCO': 22.60, 'COR': 22.60, 'ESPECIAL': 22.60 }, 'FENOMENAL': { 'BRANCO': 29.60, 'COR': 29.60 }, 'SITE': { 'BRANCO': 12.00 } } },
    { id: 'p17', category: "Masculino", product: "CAMISETA MALHA FRIA MASCULINA", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 15.50, 'COR': 16.50 }, 'GUSHI': { 'BRANCO': 16.70, 'COR': 18.90, 'ESPECIAL': 20.00 }, 'INDICE': { 'BRANCO': 21.00, 'COR': 21.00 }, 'SITE': { 'BRANCO': 11.50 } } },
    { id: 'p18', category: "Masculino", product: "CAMISETA MALHA FRIA PLUS SIZE MASCULINA", skuProductName: null, prices: { 'GUSHI': { 'BRANCO': 27.00, 'COR': 27.00, 'ESPECIAL': 27.00 }, 'FENOMENAL': { 'BRANCO': 28.00, 'COR': 28.00 }, 'SITE': { 'BRANCO': 24.00 } } },
    {
        id: 'p19',
        category: "Masculino",
        product: "CAMISETA MASCULINA",
        skuProductName: null,
        prices: {
            'MAGIC': { 'BRANCO': 18.50, 'COR': 19.50 },
            'GUSHI': { 'BRANCO': 18.40, 'COR': 20.30, 'ESPECIAL': 21.00 },
            'GLOBAL': { 'BRANCO': 16.00, 'COR': 17.50 },
            'MIKONOS': { 'BRANCO': 13.50 },
            'SITE': { 'BRANCO': 12.50 }
        }
    },
    { id: 'p20', category: "Masculino", product: "CAMISETA MASCULINA MANGA LONGA", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 22.00, 'COR': 23.00 }, 'GUSHI': { 'BRANCO': 25.20, 'COR': 26.90, 'ESPECIAL': 26.90 }, 'GLOBAL': { 'BRANCO': 20.90, 'COR': 20.90 }, 'SITE': { 'BRANCO': 18.90 } } },
    { id: 'p21', category: "Masculino", product: "CAMISETA MASCULINA MANGA LONGA PLUS", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 27.00, 'COR': 27.00 }, 'GUSHI': { 'BRANCO': 33.60, 'COR': 33.60, 'ESPECIAL': 33.60 }, 'FENOMENAL': { 'BRANCO': 42.00, 'COR': 42.00 }, 'SITE': { 'BRANCO': 25.00 } } },
    { id: 'p22', category: "Masculino", product: "CAMISETA MASCULINA PLUS", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 21.00, 'COR': 21.00 }, 'GUSHI': { 'BRANCO': 28.90, 'COR': 28.90, 'ESPECIAL': 28.90 }, 'FENOMENAL': { 'BRANCO': 28.00, 'COR': 28.00 }, 'SITE': { 'BRANCO': 21.00 } } },
    { id: 'p23', category: "Masculino", product: "CAMISETA MASCULINA POLIAMIDA", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 22.90, 'COR': 22.90 } } },
    { id: 'p24', category: "Masculino", product: "CAMISETA MASCULINA V", skuProductName: null, prices: { 'GUSHI': { 'BRANCO': 18.90, 'COR': 20.80, 'ESPECIAL': 22.60 }, 'GLOBAL': { 'BRANCO': 16.50, 'COR': 16.50 }, 'SITE': { 'BRANCO': 13.20 } } },
    { id: 'p25', category: "Masculino", product: "CAMISETA MASCULINA V MALHA FRIA", skuProductName: null, prices: { 'GUSHI': { 'BRANCO': 17.80, 'COR': 20.00, 'ESPECIAL': 21.50 }, 'INDICE': { 'BRANCO': 21.00, 'COR': 21.00 }, 'SITE': { 'BRANCO': 12.40 } } },
    { id: 'p26', category: "Masculino", product: "CAMISETA MASCULINA V PLUS", skuProductName: null, prices: { 'GUSHI': { 'BRANCO': 32.00, 'COR': 32.00, 'ESPECIAL': 32.00 }, 'SITE': { 'BRANCO': 23.50 } } },
    { id: 'p27', category: "Outros", product: "CAMISETA P/ SUBLIMAÇAO GRANDE", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 15.00, 'COR': 15.00 } } },
    { id: 'p28', category: "Masculino", product: "CAMISETA POLIESTER", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 14.00, 'COR': 15.00 }, 'GUSHI': { 'BRANCO': 25.20, 'COR': 15.20, 'ESPECIAL': 15.20 }, 'INDICE': { 'BRANCO': 21.00, 'COR': 21.00 }, 'SITE': { 'BRANCO': 11.20 } } },
    { id: 'p29', category: "Masculino", product: "CAMISETA RAGLAN", skuProductName: null, prices: { 'MIKONOS': { 'BRANCO': 18.00 }, 'SITE': { 'BRANCO': 0.00 } } },
    { id: 'p30', category: "Feminino", product: "BABYLOOK DO BRASIL", skuProductName: null, prices: { 'MAGIC': { 'COR': 14.50 } } },
    { id: 'p31', category: "Masculino", product: "CAMSETA POLIESTER PLUS SIZE MASCULINA", skuProductName: null, prices: { 'GUSHI': { 'BRANCO': 25.20, 'COR': 25.20, 'ESPECIAL': 25.20 }, 'SITE': { 'BRANCO': 21.00 } } },
    { id: 'p32', category: "Outros", product: "CAPINHA ESTAMPADA", skuProductName: null, prices: {} },
    { id: 'p33', category: "Outros", product: "IPHONE PELICULA PRIVACIDADE", skuProductName: null, prices: {} },
    { id: 'p34', category: "Outros", product: "LEGGING COTTON", skuProductName: null, prices: { 'GLOBAL': { 'BRANCO': 0.00, 'COR': 0.00 } } },
    { id: 'p35', category: "Feminino", product: "MAXI TSHIRT", skuProductName: null, prices: { 'INDICE': { 'BRANCO': 21.00, 'COR': 21.00 } } },
    { id: 'p36', category: "Feminino", product: "MAXI TSHIRT PLUS SIZE", skuProductName: null, prices: { 'FENOMENAL': { 'BRANCO': 37.00, 'COR': 37.00 } } },
    { id: 'p37', category: "Moleton", product: "MOLETOM CANGURU", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 43.99, 'COR': 43.99 }, 'FENOMENAL': { 'BRANCO': 98.00, 'COR': 98.00 } } },
    { id: 'p38', category: "Moleton", product: "MOLETOM CARECA", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 33.99, 'COR': 33.99 }, 'GLOBAL': { 'BRANCO': 37.00, 'COR': 37.00 } } },
    { id: 'p39', category: "Moleton", product: "MOLETOM CARECA PLUS SIZE", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 38.99, 'COR': 38.99 }, 'FENOMENAL': { 'BRANCO': 79.10, 'COR': 79.10 } } },
    { id: 'p40', category: "Moleton", product: "MOLETOM ZIPER", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 48.99, 'COR': 48.99 }, 'GLOBAL': { 'BRANCO': 49.00, 'COR': 49.00 } } },
    { id: 'p41', category: "Feminino", product: "MULLET", skuProductName: null, prices: { 'INDICE': { 'BRANCO': 21.00, 'COR': 21.00 } } },
    { id: 'p42', category: "Feminino", product: "MULLET GOLA REDONDA PLUS SIZE", skuProductName: null, prices: { 'FENOMENAL': { 'BRANCO': 37.00, 'COR': 37.00 } } },
    { id: 'p43', category: "Feminino", product: "MULLET GOLA V", skuProductName: null, prices: { 'INDICE': { 'BRANCO': 21.00, 'COR': 21.00 } } },
    { id: 'p44', category: "Feminino", product: "MULLET TJ", skuProductName: null, prices: { 'INDICE': { 'BRANCO': 21.00, 'COR': 21.00 } } },
    { id: 'p45', category: "Feminino", product: "MULLET TJ PLUS SIZE", skuProductName: null, prices: { 'FENOMENAL': { 'BRANCO': 37.00, 'COR': 37.00 } } },
    { id: 'p46', category: "Feminino", product: "OMBRO CAÍDO", skuProductName: null, prices: { 'GLOBAL': { 'BRANCO': 14.73, 'COR': 14.73 } } },
    { id: 'p47', category: "Outros", product: "PELICULA 3D VIDRO", skuProductName: null, prices: {} },
    { id: 'p48', category: "Feminino", product: "POLO FEMININA", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 24.99, 'COR': 26.50 }, 'GUSHI': { 'BRANCO': 23.60, 'COR': 25.20, 'ESPECIAL': 25.20 }, 'GLOBAL': { 'BRANCO': 20.90, 'COR': 20.90 }, 'FENOMENAL': { 'BRANCO': 30.00, 'COR': 30.00 }, 'SITE': { 'BRANCO': 17.00 } } },
    { id: 'p49', category: "Feminino", product: "POLO FEMININA PLUS", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 25.00, 'COR': 25.00 }, 'GUSHI': { 'BRANCO': 23.60, 'COR': 25.20, 'ESPECIAL': 25.20 }, 'GLOBAL': { 'BRANCO': 21.85, 'COR': 21.85 }, 'FENOMENAL': { 'BRANCO': 37.00, 'COR': 37.00 }, 'SITE': { 'BRANCO': 17.00 } } },
    { id: 'p50', category: "Infantil", product: "POLO INFANTIL LISTRADA", skuProductName: null, prices: { 'ALFA DEZ': { 'COR': 9.80 } } },
    { id: 'p51', category: "Masculino", product: "POLO LISTRADA MASCULINA", skuProductName: null, prices: { 'SITE': { 'BRANCO': 15.00 } } },
    { id: 'p52', category: "Masculino", product: "POLO MALHA FRIA MASCULINA", skuProductName: null, prices: { 'FENOMENAL': { 'BRANCO': 30.00, 'COR': 30.00 } } },
    { id: 'p53', category: "Feminino", product: "POLO MALHA FRIA FEMININA", skuProductName: null, prices: { 'FENOMENAL': { 'BRANCO': 30.00, 'COR': 30.00 } } },
    { id: 'p54', category: "Feminino", product: "POLO MALHA FRIA PLUS SIZE FEMININA", skuProductName: null, prices: { 'FENOMENAL': { 'BRANCO': 37.00, 'COR': 37.00 } } },
    { id: 'p55', category: "Masculino", product: "POLO MASCULINA", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 28.99, 'COR': 29.99 }, 'GUSHI': { 'BRANCO': 28.40, 'COR': 31.00, 'ESPECIAL': 31.00 }, 'GLOBAL': { 'BRANCO': 28.49, 'COR': 28.49 }, 'FENOMENAL': { 'BRANCO': 30.00, 'COR': 30.00 }, 'SITE': { 'BRANCO': 21.00 } } },
    { id: 'p56', category: "Masculino", product: "POLO MASCULINA PLUS MALHA FRIA", skuProductName: null, prices: { 'GUSHI': { 'BRANCO': 30.50, 'COR': 30.50, 'ESPECIAL': 30.50 }, 'FENOMENAL': { 'BRANCO': 37.00, 'COR': 37.00 }, 'SITE': { 'BRANCO': 29.50 } } },
    { id: 'p57', category: "Masculino", product: "POLO MASCULINA PLUS SIZE", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 31.00, 'COR': 31.00 }, 'GUSHI': { 'BRANCO': 32.00, 'COR': 32.00, 'ESPECIAL': 32.00 }, 'GLOBAL': { 'BRANCO': 31.85, 'COR': 31.85 }, 'FENOMENAL': { 'BRANCO': 37.00, 'COR': 37.00 }, 'SITE': { 'BRANCO': 32.00 } } },
    { id: 'p58', category: "Masculino", product: "POLO MASCULINA POLIÉSTER", skuProductName: null, prices: { 'FENOMENAL': { 'BRANCO': 30.00, 'COR': 30.00 } } },
    { id: 'p59', category: "Masculino", product: "REGATA", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 14.00, 'COR': 14.00 }, 'GUSHI': { 'BRANCO': 14.90, 'COR': 16.00, 'ESPECIAL': 16.00 }, 'GLOBAL': { 'BRANCO': 15.00, 'COR': 15.00 }, 'FENOMENAL': { 'BRANCO': 28.00, 'COR': 28.00 }, 'SITE': { 'BRANCO': 10.90 } } },
    { id: 'p60', category: "Masculino", product: "REGATA MACHÃO", skuProductName: null, prices: { 'FENOMENAL': { 'BRANCO': 19.00, 'COR': 19.00 } } },
    { id: 'p61', category: "Masculino", product: "REGATA MACHÃO PLUS SIZE FENOMENAL", skuProductName: null, prices: { 'GUSHI': { 'BRANCO': 0.00, 'COR': 0.00, 'ESPECIAL': 0.00 }, 'FENOMENAL': { 'BRANCO': 27.00, 'COR': 27.00 }, 'SITE': { 'BRANCO': 0.00 } } },
    { id: 'p62', category: "Masculino", product: "REGATA PLUS SIZE MASCULINA", skuProductName: null, prices: { 'GUSHI': { 'BRANCO': 17.00, 'COR': 17.00, 'ESPECIAL': 17.00 }, 'FENOMENAL': { 'BRANCO': 27.00, 'COR': 27.00 }, 'SITE': { 'BRANCO': 12.80 } } },
    { id: 'p63', category: "Masculino", product: "CAMISETA MASCULINA MANGA LONGA V", skuProductName: null, prices: {} },
    { id: 'p64', category: "Feminino", product: "BABYLOOK POLIESTER", skuProductName: null, prices: {} },
    { id: 'p65', category: "Feminino", product: "MOLETOM CARECA", skuProductName: null, prices: { 'MAGIC': { 'BRANCO': 33.99, 'COR': 33.99 } } },
].map(p => ({ ...p, id: p.id || `product-${Math.random()}` }));

// Dynamic Price Table Management
let priceTableCache: PriceProduct[] | null = null;

export const initializePriceTable = async (): Promise<PriceProduct[]> => {
    try {
        const data = await getPriceTables();
        if (data && data.length > 0) {
            priceTableCache = data;
        } else {
            console.warn("No price table found in Supabase, using default.");
            priceTableCache = defaultPriceData;
        }
    } catch (error) {
        console.error("Failed to initialize price table from Supabase:", error);
        priceTableCache = defaultPriceData;
    }
    return priceTableCache;
};

export const getPriceTable = (): PriceProduct[] => {
    return priceTableCache || defaultPriceData;
};

export const savePriceTable = async (newTable: PriceProduct[]) => {
    priceTableCache = newTable;
    // Save each item to Supabase
    // Ideally we should batch this or only save changed items.
    // For now, we'll iterate and save all.
    for (const item of newTable) {
        await savePriceTableSupabase(item);
    }
};

export const calculateCost = (order: Omit<SavedOrder, 'id'> | SavedOrder, priceTable: PriceProduct[], forStore?: string): number => {
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

    const coresEspeciais = new Set(['vermelho', 'musgo', 'verde', 'royal', 'mescla']);

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
            price = storePrices['COR']; // Fallback to 'COR'
        }
        if (price === null || price === undefined) {
            price = storePrices['BRANCO']; // Fallback to 'BRANCO' if 'COR' also missing
        }

        if (typeof price === 'number') {
            const totalQuantityForColor = Object.values(order.quantities[color]).reduce((sum, q) => sum + q, 0);
            cost += totalQuantityForColor * price;
        }
    }
    return cost;
};
