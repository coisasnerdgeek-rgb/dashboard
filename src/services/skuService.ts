import { cleanAndParse } from '../utils/numberUtils';
import { getSkuMappings, saveSkuMapping, deleteSkuMapping, SkuMapping } from './supabaseService';

// --- DEFAULT RULES ---
export const defaultProductMap: Record<string, string> = {
    'babylook': 'Babylook',
    'botton': 'Botton',
    'cam-masc': 'Camiseta Masculina',
    'cam-polia': 'Camiseta Masculina Poliamida',
    'cami-poliéster': 'Camiseta Masculina Poliéster',
    'cami-infantil': 'Camiseta Infantil',
    'cami-lon': 'Camiseta Masculina Manga Longa',
    'cami-malha-fria': 'Camiseta Masculina Malha Fria',
    'cami-masc-long-plus': 'Camiseta Masculina Manga Longa Plus',
    'cami-masc-plus': 'Camiseta Masculina Plus',
    'cami-plus': 'Camiseta Masculina Plus',
    'cami-reg': 'Regata',
    'cami-v-masc': 'Camiseta Masculina V',
    'e-cam-masc-minion-big': 'Camiseta Masculina',
    'e-cam-masc': 'Camiseta Masculina',
    'e-cam': 'Camiseta Masculina',
    'gola-v-fem': 'Babylook V',
    'gola-v-malha-fria': 'Camiseta Masculina V Malha Fria',
    'golav-fem-long': 'Babylook V Longa',
    'golav-fem-plus': 'Babylook V',
    'golav-malha-fria': 'Camiseta Masculina V Malha Fria',
    'golav-masc-plus': 'Camiseta Masculina V Plus',
    'golav-masc': 'Camiseta Masculina V',
    'golav-mfria': 'Camiseta Masculina V Malha Fria',
    'golav-plus': 'Camiseta Masculina V Plus',
    'golav': 'Babylook V',
    'infantil-longa': 'Camiseta Infantil Manga Longa',
    'longa-plus-redonda': 'Camiseta Masculina Manga Longa Plus',
    'longa-plus': 'Camiseta Masculina Manga Longa Plus',
    'longa-v-sem-corte': 'Mullet Longa V Sem Corte',
    'longline': 'Camiseta Feminina Longline',
    'manga-longa': 'Camiseta Masculina Manga Longa',
    'mol-cang': 'Moletom Canguru',
    'mol-cangu': 'Moletom Canguru',
    'mol-careca': 'Moletom Careca',
    'mol-plus': 'Moletom Careca',
    'mol-zip': 'Moletom Ziper',
    'moletom-fasesdalua': 'Moletom Careca',
    'mullet-golav': 'Mullet Gola V',
    'mulletv': 'Mullet Gola V',
    'mullet': 'Mullet',
    'ombro-caido': 'Ombro Caído',
    'polo-fem-plus': 'Polo Feminina Plus',
    'polo-fem': 'Polo Feminina',
    'polo-fem-2logo-peito': 'Polo Feminina',
    'polo-fe-fem-plus': 'Polo Feminina Plus',
    'polo-listrada': 'Polo Listrada',
    'polo-masc-plus-size': 'Polo Masculina Plus Size',
    'polo-masc-plus': 'Polo Masculina Plus Size',
    'polo-masc': 'Polo Masculina',
    'polo-plus-malhafria': 'Polo Masculina Plus Malha Fria',
    'polo-plus-size': 'Polo Masculina Plus Size',
    'polo-poliester-masc': 'Polo Poliéster',
    'reg-masc': 'Regata',
    'regata-masc': 'Regata',
    'thundercats-simbolo': 'Camiseta Masculina',
    'starwars-queen': 'Camiseta Masculina',
    'superman-logo': 'Camiseta Masculina',
    'house-love': 'Camiseta Masculina',
    'bob-dylan': 'Camiseta Masculina',
    'cam-starwas-boba-fett2': 'Camiseta Masculina',
    'cam-ozzy-1-feminina': 'Babylook',
    'capa-apple-casal_perso-vestt': 'Capinha IPhone',
    'capa-samsung-casal_perso-vestt': 'Capinha Samsung',
    'capa-moto-casal_perso-vestt': 'Capinha Motorola',
    'capa-xiaomi-casal_perso-vestt': 'Capinha Xiaomi',
    'cap-straykids-stray kids poster': 'Capinha',
    'capa-motorola-casal_perso-vestt': 'Capinha Motorola',
    'cap-straykids-stray kids zoo-1 capinha': 'Capinha',
    'capa-coracoes-nome-samsung': 'Capinha Samsung',
    'capa-xiomi-casal_perso-vestt': 'Capinha Xiaomi',
    'kit1-capinha-personalizada-mototrola': 'Capinha Motorola',
    'kit1-capinha-personalizada-samsung': 'Capinha Samsung',
    'kit1-capinha-personalizada-motorola': 'Capinha Motorola',
    'capa-apple-casal_perso': 'Capinha IPhone',
    'capa-coracoes-nome-xiaomi': 'Capinha Xiaomi',
    'capa-motorola-casal_perso': 'Capinha Motorola',
    'kit2-capinha-personalizada-motorola': 'Capinha Motorola',
    'capinha-personalizada-iphone': 'Capinha IPhone',
    'cap-straykids': 'Capinha',
    'capa-coracoes-nome-iphone': 'Capinha IPhone',
    'cap-tpu-iphone': 'Capinha IPhone',
    'capa-coracoes-nome-motorola': 'Capinha Motorola',
    'stray kids make-1 capinhas': 'Capinha',
    'cami-fem-brasil-verde amarela-g': 'Babylook do Brasil',
    'cam-straykids-fem-frente-poli': 'Babylook Poliester',
    'kit2-cam-polia': 'Camiseta Masculina Poliamida'
};

export const defaultColorMap: Record<string, string> = {
    // ABBREVIATIONS
    'b': 'Branco',
    'br': 'Branco',
    'ar': 'Royal',
    'vi': 'Vinho',
    'ma': 'Marinho',
    'vde': 'Musgo',
    'p': 'Preto',
    'vm': 'Vermelho',
    'am': 'Amarelo',
    'ama': 'Amarelo',
    'la': 'Laranja',
    'vd': 'Verde',
    've': 'Verde',
    'ch': 'Chumbo',
    'cm': 'Mescla',
    'at': 'Turquesa',
    'pi': 'Pink',
    'vl': 'Verde Limao',
    'eu': 'Verde Euforia',
    'mr': 'Caramelo',
    'co': 'Coral',
    'ab': 'Azul Claro',
    'va': 'Variadas',
    'chat': 'CHAT',
    'ro': 'Roxo',
    'rb': 'Rosa Bebê',
    'll': 'Lilás',

    // FULL NAMES & VARIATIONS (lowercase keys)
    'azul royal': 'Royal',
    'cinza claro mescla': 'Mescla',
    'cinza claro': 'Mescla',
    'vinho': 'Vinho',
    'azul marinho': 'Marinho',
    'verde escuro': 'Musgo',
    'preto': 'Preto',
    'preta': 'Preto',
    'vermelho': 'Vermelho',
    'chumbo': 'Chumbo',
    'amarelo': 'Amarelo',
    'laranja': 'Laranja',
    'verde bandeira': 'Verde',
    'verde': 'Verde',
    'cinza chumbo': 'Chumbo',
    'cinza chumbo escuro': 'Chumbo',
    'cinza mescla': 'Mescla',
    'azul escuro': 'Marinho',
    'azul tuquesa': 'Turquesa',
    'pink': 'Pink',
    'rosa pink': 'Pink',
    'fuscia': 'Pink',
    'musgo': 'Musgo',
    'verde escuro musgo': 'Musgo',
    'azul': 'Royal',
    'bordo': 'Vinho',
    'vermelho escuro': 'Vinho',
    'rosa bebë': 'Rosa Bebê',
    'rosa': 'Rosa Bebê',
    'rosa claro': 'Rosa Bebê',
    'verde musgo': 'Musgo',
    'azul turquesa': 'Turquesa',
    'roxo': 'Roxo',
    'cinza mescla claro': 'Mescla',
    'rosa bebê': 'Rosa Bebê',
    'azul-marinho': 'Marinho',
    'cinza': 'Mescla',
    'branca': 'Branco',
    'branco': 'Branco',
    'cinza-claro': 'Mescla',
    'cinza-clara': 'Mescla',
    'verde lima': 'Verde Limao',
    'verde limão': 'Verde Limao',
    'rosa fúcsia': 'Pink',
    'azul-turquesa': 'Turquesa',
    'verde-limão': 'Verde Limao',
    'cinza escuro': 'Chumbo',
    'azul escuro marinho': 'Marinho',
    'vermelha': 'Vermelho',
    'cinza escuro chumbo': 'Chumbo',
    'cinza médio': 'Mescla',
    'marinho': 'Marinho',
    'royal': 'Royal',
    'lilás': 'Lilás',
    'vermelho bordô': 'Vinho',
    'vermelho vinho': 'Vinho',
    'cinza mescla escuro': 'Chumbo',
    'violeta': 'Roxo',
    'azul turqueza': 'Turquesa',
    'ver euforia': 'Verde Euforia',
    'verde militar': 'Musgo',
    'azul bebê': 'Azul Claro',
    'turquesa': 'Turquesa',
    'verde brilhante': 'Verde Limao',
    'variadas': 'Variadas',
    'vou informar as cores no chat': 'CHAT',
    'amarela': 'Amarelo',
    'cores variadas': 'Variadas',
    'cores que informarei no chat': 'CHAT',
    'vinhos': 'Vinho',
    'cinzas mescla': 'Mescla',
    'brancas': 'Branco',
    'pretas': 'Preto',
    'vermelhas': 'Vermelho',
    'verdes escuros': 'Musgo',
    'rosas claros': 'Rosa Bebê',
    'azul royais': 'Royal',
    'verde euforia': 'Verde Euforia',
    'verde limao': 'Verde Limao',
    'verde azulado': 'Verde Euforia',
    'marrom caramelo': 'Caramelo',
    'rosa flamingo': 'Coral',
    'azul claro': 'Azul Claro',
    'verde amarela': 'CHAT'
};

export const defaultSizeMap: Record<string, string> = {
    'p': 'P',
    'm': 'M',
    'g': 'G',
    'gg': 'GG',
    'xg': 'XG',
    'eg': 'EG',
    'egg': 'EG',
    'g1': 'G1',
    'g2': 'G2',
    'g3': 'G3',
    'g4': 'G4',
    'g5': 'G5',
    'g6': 'G6',
    '2': '2',
    '4': '4',
    '6': '6',
    '8': '8',
    '10': '10',
    '12': '12',
    '14': '14',
    '16': '16',
    'g1/46': 'G1',
    'g1-46': 'G1',
    '46': 'G1',
    'g2/48': 'G2',
    'g2-48': 'G2',
    '48': 'G2',
    'g3/50': 'G3',
    'g3-50': 'G3',
    '50': 'G3',
    'g4/52': 'G4',
    'g4-52': 'G4',
    '52': 'G4',
    'g5/54': 'G5',
    'g5-54': 'G5',
    '54': 'G5',
    'g6/56': 'G6',
    'g6-56': 'G6',
    '56': 'G6',
    'g1 / 46': 'G1',
    'g2 / 48': 'G2',
    'g3 / 50': 'G3',
    'g4 / 52': 'G4',
    'g5 / 54': 'G5',
    'g6 / 56': 'G6',
    '2 polos informe tamnho no chat': 'VA',
    '3 polos informe tamnho no chat': 'VA',
    '4 polos informe tamnho no chat': 'VA',
    '2 polo informe tamanho no chat': 'VA',
    '3 polo informe tamanho no chat': 'VA',
    '4 polo informe tamanho no chat': 'VA',
};


// --- DYNAMIC RULE MANAGEMENT ---

let productMap: Record<string, string> | null = null;
let colorMap: Record<string, string> | null = null;
let sizeMap: Record<string, string> | null = null;
let phoneBrandMap: Record<string, string> | null = null;

let invertedProductMap: Record<string, string> | null = null;
let invertedColorMap: Record<string, string> | null = null;
let invertedSizeMap: Record<string, string> | null = null;

const PHONE_BRAND_KEYWORDS: Record<string, string[]> = {
    APPLE: ['iphone', 'apple'],
    SAMSUNG: ['samsung', 'galaxy', 'samsug', 'sam'],
    MOTOROLA: ['motorola', 'moto', 'mototrola'],
    XIAOMI: ['xiaomi', 'redmi', 'poco', 'xiomi'],
    LG: ['lg'],
    REALME: ['realme'],
};

export const defaultPhoneBrandMap: Record<string, string> = {};
for (const brand in PHONE_BRAND_KEYWORDS) {
    PHONE_BRAND_KEYWORDS[brand].forEach(keyword => {
        defaultPhoneBrandMap[keyword] = brand;
    });
}

// Initialize maps from Supabase
export const initializeSkuMaps = async () => {
    try {
        const mappings = await getSkuMappings();

        productMap = { ...defaultProductMap, ...mappings.productMap };
        colorMap = { ...defaultColorMap, ...mappings.colorMap };
        sizeMap = { ...defaultSizeMap, ...mappings.sizeMap };
        phoneBrandMap = { ...defaultPhoneBrandMap, ...mappings.phoneBrandMap };

        // Sort maps for predictable lookups (longest keys first)
        const sortMap = (map: Record<string, string>) => {
            const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);
            const sortedMap: Record<string, string> = {};
            for (const key of sortedKeys) {
                sortedMap[key] = map[key];
            }
            return sortedMap;
        };

        productMap = sortMap(productMap);
        colorMap = sortMap(colorMap);
        sizeMap = sortMap(sizeMap);
        phoneBrandMap = sortMap(phoneBrandMap);

    } catch (error) {
        console.error("Failed to initialize SKU maps from Supabase:", error);
        // Fallback to defaults
        productMap = defaultProductMap;
        colorMap = defaultColorMap;
        sizeMap = defaultSizeMap;
        phoneBrandMap = defaultPhoneBrandMap;
    }
};

export const getProductMap = (): Record<string, string> => {
    if (!productMap) return defaultProductMap;
    return productMap;
};

export const getColorMap = (): Record<string, string> => {
    if (!colorMap) return defaultColorMap;
    return colorMap;
};

export const getSizeMap = (): Record<string, string> => {
    if (!sizeMap) return defaultSizeMap;
    return sizeMap;
};

export const getPhoneBrandMap = (): Record<string, string> => {
    if (!phoneBrandMap) return defaultPhoneBrandMap;
    return phoneBrandMap;
};

export const saveProductMap = async (newMap: Record<string, string>) => {
    // Identify changes and save to Supabase
    // Ideally we should only pass the changed item, but for now we might need to diff or just save the new entry if the UI passes the whole map.
    // Assuming the UI might be refactored to pass key/value, but currently it passes the whole map.
    // For now, we will just update the local cache. The UI component should call saveSkuMapping individually.
    // BUT, to keep compatibility, we'll assume the caller wants to update the cache.
    // Real persistence should happen via specific calls or we need to diff.
    // Let's rely on the UI calling `addSkuMapping` wrapper we'll create, or we update this to just update cache.

    // For this migration, we'll update the cache and let the UI call specific save functions.
    // If the UI passes the whole map, we can't easily know what changed without diffing.
    // Let's update the cache.
    productMap = newMap;
    invertedProductMap = null;
};

export const saveColorMap = (newMap: Record<string, string>) => {
    colorMap = newMap;
    invertedColorMap = null;
};

export const saveSizeMap = (newMap: Record<string, string>) => {
    sizeMap = newMap;
    invertedSizeMap = null;
};

export const savePhoneBrandMap = (newMap: Record<string, string>) => {
    phoneBrandMap = newMap;
};

// New helper functions for individual updates (to be used by UI)
export const addSkuMapping = async (type: 'product' | 'color' | 'size' | 'brand', key: string, value: string) => {
    await saveSkuMapping(type, key, value);
    // Update local cache
    if (type === 'product' && productMap) productMap[key] = value;
    if (type === 'color' && colorMap) colorMap[key] = value;
    if (type === 'size' && sizeMap) sizeMap[key] = value;
    if (type === 'brand' && phoneBrandMap) phoneBrandMap[key] = value;

    // Invalidate inverted maps
    if (type === 'product') invertedProductMap = null;
    if (type === 'color') invertedColorMap = null;
    if (type === 'size') invertedSizeMap = null;
};

export const removeSkuMapping = async (type: 'product' | 'color' | 'size' | 'brand', key: string) => {
    await deleteSkuMapping(type, key);
    // Update local cache
    if (type === 'product' && productMap) delete productMap[key];
    if (type === 'color' && colorMap) delete colorMap[key];
    if (type === 'size' && sizeMap) delete sizeMap[key];
    if (type === 'brand' && phoneBrandMap) delete phoneBrandMap[key];

    // Invalidate inverted maps
    if (type === 'product') invertedProductMap = null;
    if (type === 'color') invertedColorMap = null;
    if (type === 'size') invertedSizeMap = null;
};


export const resetProductMap = () => {
    // This would delete all custom mappings. Dangerous.
    // For now, maybe just reset cache to defaults?
    // Implementing "Reset" with Supabase is complex (delete all rows?).
    // Let's just reset the local cache to defaults for the session.
    productMap = defaultProductMap;
    invertedProductMap = null;
}

export const resetColorMap = () => {
    colorMap = defaultColorMap;
    invertedColorMap = null;
}

export const resetSizeMap = () => {
    sizeMap = defaultSizeMap;
    invertedSizeMap = null;
}

export const resetPhoneBrandMap = () => {
    phoneBrandMap = defaultPhoneBrandMap;
}

export const learnRulesFromCorrection = async (
    originalSku: string | undefined,
    targetProduct: string | undefined,
    targetColor: string | undefined,
    targetSize: string | undefined
) => {
    if (!originalSku) return;

    // 1. Clean and Normalize
    let cleanOriginal = originalSku.toLowerCase().trim().replace(/^kit\d*-/, '');
    const originalParts = cleanOriginal.split('-').map(p => p.trim()).filter(p => !!p);

    if (originalParts.length === 0) return;

    // Check what is currently recognized by the rules
    const currentParsed = parseSku(originalSku);
    
    // Maps
    const productMap = getProductMap();
    const colorMap = getColorMap();
    const sizeMap = getSizeMap();

    // Identify unrecognized parts
    const unrecognizedParts = originalParts.filter(p => 
        !productMap[p] && !colorMap[p] && !sizeMap[p] && 
        !['peito', 'frente', 'costas', 'costa', 'manga'].includes(p)
    );

    // PRODUCT LEARNING
    if (targetProduct && targetProduct !== 'N/A') {
        const pKey = originalParts[0]; // Product usually first
        if (pKey && (!productMap[pKey] || (currentParsed && currentParsed.productName !== targetProduct))) {
            await addSkuMapping('product', pKey, targetProduct);
        }
    }

    // SIZE LEARNING
    if (targetSize && targetSize !== 'N/A') {
        const sKey = originalParts[originalParts.length - 1]; // Size usually last
        if (sKey && (!sizeMap[sKey] || (currentParsed && currentParsed.sizeName !== targetSize))) {
            // Learn size if it's the last part and not already a product/color OR if it was previously misidentified
            await addSkuMapping('size', sKey, targetSize);
        }
    }

    // COLOR LEARNING
    if (targetColor && targetColor !== 'N/A') {
        // Find potential color keywords (unrecognized parts that aren't the size key if we just learned it)
        const sKey = originalParts[originalParts.length - 1];
        const potentialColorKeys = unrecognizedParts.filter(p => p !== sKey);
        
        if (potentialColorKeys.length > 0) {
            const cKey = potentialColorKeys[potentialColorKeys.length - 1]; // Take last one before size
            if (cKey && (!colorMap[cKey] || (currentParsed && currentParsed.colorName !== targetColor))) {
                await addSkuMapping('color', cKey, targetColor);
            }
        } else if (unrecognizedParts.length === 1 && unrecognizedParts[0] === sKey) {
            // If there's only one unrecognized part and it's also the size key, 
            // it likely implicitly includes the color or we need to map it anyway.
            // But usually, if we have only one part, we can't map it to two things easily without collision.
            // For now, we only map if it's not already something else or if explicitly correcting.
            if (!colorMap[sKey] || (currentParsed && currentParsed.colorName !== targetColor)) {
                 // risky but sometimes needed if one keyword maps to both implicitly in user's mind
                 // however, parseSku findLongestSuffix will favor one.
            }
        }
    }
};


const getInvertedMap = (map: Record<string, string>, caseSensitive = false): Record<string, string> => {
    const inverted: Record<string, string> = {};
    for (const key in map) {
        let value = map[key];
        if (!caseSensitive) {
            value = value.toLowerCase();
        }
        // Handle multiple keys mapping to the same value; take the shortest/simplest key
        if (!inverted[value] || key.length < inverted[value].length) {
            inverted[value] = key;
        }
    }
    return inverted;
}


export const getCategory = (sku: string): 'Roupas' | 'Capinha' | 'Outros' => {
    let lowerSku = sku.toLowerCase();

    // Normalize: strip kit prefix for category detection (handles "kit2-", "kit 2-", etc)
    const normalizedSku = lowerSku.replace(/^kit\s*\d*-/, '');

    const capinhaKeywords = ['cap-', 'capa-', 'capinha', 'case'];
    if (capinhaKeywords.some(keyword => normalizedSku.startsWith(keyword))) {
        return 'Capinha';
    }

    const productMap = getProductMap();
    let matchedKey = '';
    // productMap is sorted by key length descending
    for (const key in productMap) {
        if (normalizedSku.startsWith(key)) {
            matchedKey = key;
            break;
        }
    }

    if (matchedKey) {
        const productName = productMap[matchedKey].toLowerCase();
        if (productName.includes('capinha')) return 'Capinha';
        return 'Roupas';
    }

    // Fallback check: if it contains any phone brand, it's likely a phone case
    for (const brandName in PHONE_BRAND_KEYWORDS) {
        if (PHONE_BRAND_KEYWORDS[brandName].some(keyword => lowerSku.includes(keyword))) {
            return 'Capinha';
        }
    }

    // New: Check for clothing-specific personalization keywords (including 'kit' for broad detection)
    const clothingKeywords = ['peito', 'frente', 'costas', 'costa', 'manga', 'cabeleireira', 'cabelereiro', 'cabeleireiro', 'cabelerero', 'cabeleirero', 'kit', 'perso', 'personalizado', 'pi', 'eletricista', 'eletrecista', 'manicure', 'nutricionista'];
    if (clothingKeywords.some(keyword => lowerSku.includes(keyword))) {
        return 'Roupas';
    }

    return 'Outros';
};

export const isKit = (sku: string): boolean => {
    if (!sku) return false;
    const lowerSku = sku.toLowerCase();
    if (lowerSku.startsWith('kit1-polo-fem')) {
        return false;
    }
    return lowerSku.startsWith('kit');
};

export const getEffectiveQuantity = (sku: string, quantity: string | number): number => {
    const qty = cleanAndParse(quantity);
    if (!sku) return qty;

    const lowerSku = sku.toLowerCase();

    // Rule for "kitX-" prefix - matches kit followed by one or more digits and a hyphen
    const kitMatch = lowerSku.match(/^kit(\d+)-/);
    if (kitMatch && kitMatch[1]) {
        return qty * parseInt(kitMatch[1], 10);
    }

    // Rule for "-X capinhas..." suffix
    const capinhasMatch = lowerSku.match(/-(\d+)\s*capinha(s)?/);
    if (capinhasMatch && capinhasMatch[1]) {
        return qty * parseInt(capinhasMatch[1], 10);
    }

    return qty;
};

export const isPersonalizado = (sku: string): boolean => {
    if (!sku) return false;

    const lowerSku = sku.toLowerCase();
    const category = getCategory(sku);

    if (category !== 'Roupas') {
        // Usuário solicitou explicitamente que apenas itens da categoria Roupas
        // sejam contabilizados e mostrados na aba de personalizados.
        return false;
    }

    // Original logic for clothes and other categories
    const keywords = ['perso', 'personalizada', 'chat', 'sublima', 'peito', 'frente', 'costas', 'costa', 'cabeleireira', 'nome', 'numero', 'número', 'foto'];
    
    if (keywords.some(keyword => lowerSku.includes(keyword))) {
        return true;
    }

    // A palavra "manga" só é considerada personalização se não fizer parte do nome do produto (ex: Manga Longa)
    if (
        lowerSku.includes('manga') && 
        !lowerSku.includes('manga-longa') && 
        !lowerSku.includes('manga longa') && 
        !lowerSku.includes('manga-curta') && 
        !lowerSku.includes('manga curta') &&
        !lowerSku.includes('manga-princesa')
    ) {
        return true;
    }

    return false;
};

interface ParsedSku {
    productName: string;
    colorName: string;
    sizeName: string;
}

/**
 * Helper to find the longest matching suffix in a set of rules.
 * @param parts - Array of SKU parts.
 * @param rules - The rule map to check against.
 * @returns Info about the match or null.
 */
function findLongestSuffix(parts: string[], rules: Record<string, string>): { value: string; key: string; partsCount: number } | null {
    // Assume keys have max 3 parts (e.g., 'g-1-46' is unlikely but possible)
    for (let i = Math.min(parts.length, 3); i > 0; i--) {
        const potentialParts = parts.slice(-i);
        const potentialKey = potentialParts.join('-');
        if (rules[potentialKey]) {
            return {
                value: rules[potentialKey],
                key: potentialKey,
                partsCount: i,
            };
        }
    }
    return null;
}


export const parseSku = (sku: string): ParsedSku | null => {
    if (!sku) return null;

    let lowerSku = sku.toLowerCase();

    // --- Capinha Logic ---
    if (getCategory(sku) === 'Capinha') {
        let productName = 'Capinha';
        const productRules = getProductMap();
        for (const key in productRules) {
            if (lowerSku.startsWith(key) && productRules[key].toLowerCase().includes('capinha')) {
                productName = productRules[key];
                break;
            }
        }

        let modelString = lowerSku
            .replace(/^cap-tpu-/, '')
            .replace(/^capa-/, '')
            .replace(/^capinha-/, '');

        let brand = 'N/A';
        let brandKeyFound = '';

        const brandRules = getPhoneBrandMap(); // This is sorted by key length descending
        for (const keyword in brandRules) {
            if (modelString.includes(keyword)) {
                brand = brandRules[keyword];
                brandKeyFound = keyword;
                break;
            }
        }

        if (brandKeyFound) {
            modelString = modelString.substring(modelString.indexOf(brandKeyFound) + brandKeyFound.length).replace(/^-/, '');
        }

        // Specific rule for Samsung models like 's-S23'
        if (brand === 'SAMSUNG' && modelString.startsWith('s-')) {
            modelString = modelString.substring(2);
        }

        const ignoredParts = ['casal_perso', 'mmoda', 'perso', 'personalizada', 'vestt', 'ves'];
        let finalModel = modelString;
        for (const part of ignoredParts) {
            finalModel = finalModel.replace(new RegExp(part, 'gi'), '');
        }

        finalModel = finalModel.replace(/-\d+\s*capinha(s)?.*/, '').trim();
        finalModel = finalModel.replace(/^-/, '').replace(/-$/, '').trim();

        if (!finalModel || finalModel.length === 0) {
            finalModel = 'N/A';
        } else {
            if (brand === 'APPLE') {
                finalModel = `IPHONE ${finalModel.replace(/^iphone-?/, '')}`.trim();
            }
            finalModel = finalModel.toUpperCase();
        }

        return {
            productName: productName,
            colorName: brand, // Using colorName for brand
            sizeName: finalModel, // Using sizeName for model
        };
    }


    // --- Roupas Logic ---
    lowerSku = lowerSku.replace(/^kit\d+-/, '');

    const productRules = getProductMap();
    const colorRules = getColorMap();
    const sizeRules = getSizeMap();

    let productName = 'N/A';

    let productKey = '';
    for (const key in productRules) {
        if (lowerSku.startsWith(key)) {
            productKey = key;
            productName = productRules[key];
            break;
        }
    }

    if (productName === 'N/A') return null;

    const restOfSku = lowerSku.substring(productKey.length).replace(/^-/, '');
    if (!restOfSku) {
        return { productName, colorName: 'N/A', sizeName: 'N/A' };
    }

    // DO NOT filter out personalization keywords - they are essential for identifying print locations
    const parts = restOfSku.split('-').map(p => p.trim()).filter(p => !!p);

    // Attempt 1: Size is Suffix, Color is Suffix of remainder
    let colorName1 = 'N/A';
    let sizeName1 = 'N/A';
    const sizeInfo1 = findLongestSuffix(parts, sizeRules);
    if (sizeInfo1) {
        sizeName1 = sizeInfo1.value;
        const remainingParts1 = parts.slice(0, parts.length - sizeInfo1.partsCount);
        if (remainingParts1.length > 0) {
            const colorInfo1 = findLongestSuffix(remainingParts1, colorRules);
            if (colorInfo1) {
                colorName1 = colorInfo1.value;
            }
        }
    }

    // Attempt 2: Color is Suffix, Size is Suffix of remainder
    let colorName2 = 'N/A';
    let sizeName2 = 'N/A';
    const colorInfo2 = findLongestSuffix(parts, colorRules);
    if (colorInfo2) {
        colorName2 = colorInfo2.value;
        const remainingParts2 = parts.slice(0, parts.length - colorInfo2.partsCount);
        if (remainingParts2.length > 0) {
            const sizeInfo2 = findLongestSuffix(remainingParts2, sizeRules);
            if (sizeInfo2) {
                sizeName2 = sizeInfo2.value;
            }
        }
    }

    // Score and decide which attempt was better
    const score1 = (colorName1 !== 'N/A' ? 1 : 0) + (sizeName1 !== 'N/A' ? 1 : 0);
    const score2 = (colorName2 !== 'N/A' ? 1 : 0) + (sizeName2 !== 'N/A' ? 1 : 0);

    if (score1 > score2) {
        return { productName, colorName: colorName1, sizeName: sizeName1 };
    } else if (score2 > score1) {
        return { productName, colorName: colorName2, sizeName: sizeName2 };
    }

    // Scores are equal or both are 0.
    // Prefer the pattern where size is the final suffix (...-color-size), which is Attempt 1.
    const finalResult = { colorName: colorName1, sizeName: sizeName1 };

    // If the preferred result is still incomplete, try a stricter match on the last two parts.
    // This strongly enforces the `-color-size` pattern as a high-confidence fallback.
    if ((finalResult.colorName === 'N/A' || finalResult.sizeName === 'N/A') && parts.length >= 2) {
        const potentialSizeKey = parts[parts.length - 1];
        const potentialColorKey = parts[parts.length - 2];

        const sizeMatch = sizeRules[potentialSizeKey];
        const colorMatch = colorRules[potentialColorKey];

        if (sizeMatch && colorMatch) {
            // A full match from this simple heuristic is better than a partial match from the complex one.
            return { productName, colorName: colorMatch, sizeName: sizeMatch };
        }
    }

    return { productName, colorName: finalResult.colorName, sizeName: finalResult.sizeName };
};

export const getSkuError = (sku: string): { message: string; type: 'produto' | 'cor' | 'tamanho' } | null => {
    if (!sku) {
        return null;
    }

    const category = getCategory(sku);
    const parsed = parseSku(sku);

    // If SKU can't be parsed at all, it's an invalid product
    if (!parsed) {
        return { message: 'Produto não reconhecido', type: 'produto' };
    }

    // For Roupas category (clothes), also check for missing color/size
    if (category === 'Roupas') {
        if (parsed.colorName === 'N/A') {
            return { message: 'Cor não reconhecida', type: 'cor' };
        }
        if (parsed.sizeName === 'N/A') {
            return { message: 'Tamanho não reconhecido', type: 'tamanho' };
        }

        // --- LENTIENT VALIDATION: Only strictly check if it's NOT recognized as a core product/color/size combo ---
        // We previously flagged unrecognized segments as errors, but this was too strict for descriptive SKUs.
        // As long as we have a valid Product, Color, and Size (not N/A), we consider the SKU "valid" for the grade.
        if (parsed.colorName === 'N/A' || parsed.sizeName === 'N/A') {
            const lowerSku = sku.toLowerCase().replace(/^kit\d+-/, '');
            const productRules = getProductMap();
            let productKey = '';
            for (const key in productRules) {
                if (lowerSku.startsWith(key)) {
                    productKey = key;
                    break;
                }
            }

            if (productKey) {
                const rest = lowerSku.substring(productKey.length).replace(/^-/, '');
                if (rest) {
                    const parts = rest.split('-');
                    const colorRules = getColorMap();
                    const sizeRules = getSizeMap();

                    // Check which parts are recognized
                    const recognizedParts = parts.filter(part => {
                        return !!(colorRules[part] || sizeRules[part]);
                    });

                    // If fewer parts are recognized than are present, and it's not a common keyword
                    if (recognizedParts.length < parts.length) {
                        const unrecognized = parts.filter(part => {
                            const isKeyword = ['peito', 'frente', 'costas', 'costa', 'manga'].some(k => part.includes(k));
                            return !(colorRules[part] || sizeRules[part] || isKeyword);
                        });

                        if (unrecognized.length > 0) {
                            return {
                                message: `Segmentos não reconhecidos: ${unrecognized.join(', ')}`,
                                type: 'produto'
                            };
                        }
                    }
                }
            }
        }
    }

    // For Capinhas, check if product name is just "Capinha" (generic) when it should be more specific
    // This would happen if the model/brand wasn't recognized
    if (category === 'Capinha' && parsed.productName === 'Capinha') {
        // Generic capinha name suggests the model wasn't identified properly
        // But this is not necessarily an error - some capinhas might be generic
        // So we don't return an error here
    }

    if (parsed.colorName === 'N/A' || parsed.sizeName === 'N/A') {
        console.log(`[getSkuError] Validation Failed for SKU: "${sku}"`, {
            product: parsed.productName,
            color: parsed.colorName,
            size: parsed.sizeName
        });
        if (parsed.colorName === 'N/A') return { message: 'Cor não identificada', type: 'cor' };
        if (parsed.sizeName === 'N/A') return { message: 'Tamanho não identificado', type: 'tamanho' };
    }

    return null; // No error
};


export const transformSku = (sku: string): string => {
    const parsed = parseSku(sku);
    if (!parsed) return sku;

    const parts: string[] = [];
    if (parsed.productName !== 'N/A') parts.push(parsed.productName);
    if (parsed.colorName !== 'N/A') parts.push(parsed.colorName);
    if (parsed.sizeName !== 'N/A') parts.push(parsed.sizeName);

    return parts.join(' - ');
};

const getInvertedProductMap = (): Record<string, string> => {
    if (!invertedProductMap) {
        invertedProductMap = getInvertedMap(getProductMap(), false);
    }
    return invertedProductMap;
};

const getInvertedColorMap = (): Record<string, string> => {
    if (!invertedColorMap) {
        invertedColorMap = getInvertedMap(getColorMap(), false);
    }
    return invertedColorMap;
};

const getInvertedSizeMap = (): Record<string, string> => {
    if (!invertedSizeMap) {
        invertedSizeMap = getInvertedMap(getSizeMap(), false);
    }
    return invertedSizeMap;
};

export const buildSku = (product: string, color: string, size: string, quantity: number = 1): string | null => {
    if (!product || !color || !size) return null;

    const invProductMap = getInvertedProductMap();
    const invColorMap = getInvertedColorMap();
    const invSizeMap = getInvertedSizeMap();

    const productKey = invProductMap[product.toLowerCase()] || product.toUpperCase().replace(/\s+/g, '-');
    
    const colorKey = invColorMap[color.toLowerCase()] || color.toUpperCase().replace(/\s+/g, '-');
    
    // Find size key. `getInvertedMap` takes the shortest.
    const sizeKey = invSizeMap[size.toUpperCase()] || size.toUpperCase();

    let sku = `${productKey}-${colorKey}-${sizeKey}`;
    if (quantity > 1) {
        sku = `KIT${quantity}-${sku}`;
    }

    return sku.toUpperCase();
};

export const smartImageLookup = (sku: string | undefined, mappings: Record<string, string>): string | undefined => {
    if (!sku || !mappings) return undefined;

    let skuLower = sku.toLowerCase().trim();

    // Strip kit prefix if present (e.g. kit6-polo-fem-rs-p -> polo-fem-rs-p)
    skuLower = skuLower.replace(/^kit\d*-/, '');

    // 1. Exact match (case-insensitive)
    for (const key in mappings) {
        if (key.toLowerCase() === skuLower) {
            return mappings[key];
        }
    }

    // 2. Try removing size (assuming SKU format like PRODUCT-COLOR-SIZE)
    // This prioritizes color-specific images
    const parts = skuLower.split('-');
    if (parts.length > 2) {
        const productAndColor = parts.slice(0, parts.length - 1).join('-');
        for (const key in mappings) {
            if (key.toLowerCase() === productAndColor) {
                return mappings[key];
            }
        }
    }

    // 3. Try using parseSku to reconstruct without size
    const parsed = parseSku(sku);
    if (parsed && parsed.productName && parsed.colorName && parsed.productName !== 'N/A' && parsed.colorName !== 'N/A') {
        // Try constructing a "base" SKU for the image (using inversions to get standard keys)
        const baseSku = buildSku(parsed.productName, parsed.colorName, 'M');
        if (baseSku) {
            const partsBase = baseSku.toLowerCase().split('-');
            const withoutSizeBase = partsBase.slice(0, -1).join('-');

            for (const key in mappings) {
                if (key.toLowerCase() === withoutSizeBase) {
                    return mappings[key];
                }
            }
        }
    }

    // 4. Fuzzy matching fallback (tries to find similar SKUs with color)
    // Try to find similar SKUs using Levenshtein distance
    try {
        const { fuzzyGet } = require('../utils/stringMatch');
        // Lowered threshold to 0.75 for better phone case matching
        const fuzzyResult = fuzzyGet(skuLower, mappings, 0.75);
        if (fuzzyResult) {
            return fuzzyResult;
        }
    } catch (e) {
        // Fuzzy matching not available, skip
    }

    // 5. LAST RESORT: Try product prefix match (PRODUCT only, ignores color)
    // Only use this as absolute fallback when nothing else works
    const parts2 = skuLower.split('-');
    if (parts2.length >= 2) {
        const productPrefix = parts2[0];
        for (const key in mappings) {
            if (key.toLowerCase().startsWith(productPrefix)) {
                return mappings[key];
            }
        }
    }

    return undefined;
};