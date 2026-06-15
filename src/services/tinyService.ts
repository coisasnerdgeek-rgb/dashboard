
export interface TinyOrder {
    id: string;
    numero: string;
    data_pedido: string;
    cliente: {
        nome: string;
        cpf_cnpj: string;
    };
    itens: {
        item: {
            codigo: string;
            descricao: string;
            quantidade: number;
            valor_unitario: number;
        }
    }[];
    situacao: string;
    valor_total: number;
}


const TINY_API_URL = 'https://api.tiny.com.br/api2';

export const fetchTinyOrder = async (id: string, token: string): Promise<TinyOrder | null> => {
    try {
        const url = `${TINY_API_URL}/pedido.obter.php`;
        const params = new URLSearchParams({
            token,
            id,
            formato: 'json'
        });

        const response = await fetch(`${url}?${params.toString()}`);
        const data = await response.json();

        if (data.retorno && data.retorno.status === 'OK') {
            return data.retorno.pedido as TinyOrder;
        } else {
            console.error('Tiny API Error:', data.retorno?.erros);
            return null;
        }
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
};

/**
 * Determina o canal de venda com base no ID do pedido e o CNPJ da empresa
 */
export const getEcommerceStore = (orderId: string | number, fileCnpj: 'MM' | 'MVF' | string | null): string => {
    const id = String(orderId ?? '').trim();
    if (!id) return 'BUSINESS';

    const isShopee = ['26', '2510', 'ID2', '25091', '25010', '25011', '2509', '2501', '2502', '250', '251', '252', '253', '254', '255', '256', '257', '258', '259', '260'].some(prefix => id.startsWith(prefix));
    if (isShopee) {
        if (fileCnpj === 'MM' || fileCnpj?.includes('39447291')) return 'SH MM';
        return 'SH VEST';
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

    if ((fileCnpj === 'MM' || fileCnpj?.includes('39447291')) && lojaBase !== 'BUSINESS') {
        return lojaBase.replace('VEST', 'MM');
    }

    return lojaBase;
};

/**
 * Realiza o parse do SKU para extrair Produto, Cor e Tamanho
 */
export const parseSku = (sku: string) => {
    if (!sku) return { productName: 'N/A', colorName: 'N/A', sizeName: 'N/A' };
    const lowerSku = sku.toLowerCase();

    const defaultColorMap: Record<string, string> = {
        'p': 'Preto', 'b': 'Branco', 'ma': 'Marinho', 'vm': 'Vermelho', 'cm': 'Mescla',
        'ar': 'Royal', 'vi': 'Vinho', 'vde': 'Musgo', 'am': 'Amarelo', 'la': 'Laranja',
        'ch': 'Chumbo', 'at': 'Turquesa', 'pi': 'Pink', 'vl': 'Verde Limao',
        'preto': 'Preto', 'branco': 'Branco', 'marinho': 'Marinho', 'vermelho': 'Vermelho',
        'mescla': 'Mescla', 'royal': 'Royal', 'vinho': 'Vinho', 'musgo': 'Musgo',
        'amarelo': 'Amarelo', 'laranja': 'Laranja', 'chumbo': 'Chumbo', 'turquesa': 'Turquesa',
        'pink': 'Pink', 'rosa': 'Rosa Bebê', 'lilás': 'Lilás'
    };

    const defaultSizeMap: Record<string, string> = {
        'p': 'P', 'm': 'M', 'g': 'G', 'gg': 'GG', 'xg': 'XG', 'eg': 'EG',
        'g1': 'G1', 'g2': 'G2', 'g3': 'G3', 'g4': 'G4', 'g5': 'G5', 'g6': 'G6',
        '2': '2', '4': '4', '6': '6', '8': '8', '10': '10', '12': '12', '14': '14', '16': '16'
    };

    let productName = 'N/A';
    const productMap: Record<string, string> = {
        'polo-fem': 'Polo Feminina', 'polo-masc': 'Polo Masculina',
        'mol-cang': 'Moletom Canguru', 'mol-careca': 'Moletom Careca',
        'cam-masc': 'Camiseta Masculina', 'babylook': 'Babylook',
        'regata': 'Regata', 'capa-': 'Capinha', 'cap-': 'Capinha',
        'kit': 'Kit'
    };

    for (const [key, value] of Object.entries(productMap)) {
        if (lowerSku.startsWith(key)) {
            productName = value;
            break;
        }
    }

    if (productName === 'N/A') return { productName, colorName: 'N/A', sizeName: 'N/A' };

    const rest = lowerSku.split('-').slice(1);
    let colorName = 'N/A';
    let sizeName = 'N/A';

    for (const part of rest) {
        if (defaultSizeMap[part]) sizeName = defaultSizeMap[part];
        else if (defaultColorMap[part]) colorName = defaultColorMap[part];
    }

    return { productName, colorName, sizeName };
};
