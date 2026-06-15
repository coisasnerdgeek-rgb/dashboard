import { normalizeString } from '../../utils/stringUtils';

// Colunas específicas que devem ser exibidas e filtradas na página de Pedidos
export const PEDIDOS_KEYS = ['data', 'data maxima de despacho', 'identificador do pedido e-commerce', 'nome', 'produto', 'tamanho', 'cor', 'quantidade', 'canal', 'situacao', 'cnpj', 'valor unitario'];

// Header Title Map
export const HEADER_TITLE_MAP: { [key: string]: string } = {
    'nome de contato': 'Nome',
    'nome': 'Nome',
    'valor unitario': 'Valor',
    'valor total': 'Total',
    'identificador do pedido e-commerce': 'ID',
    'numero da ordem de compra': 'ID',
    'data maxima de despacho': 'Prevista',
    'cnpj': 'CNPJ',
    'quantidade': 'Qt.',
    'tamanho': 'Tam/Var',
    'cor': 'Cor',
    'produto': 'Produto',
    'sku': 'SKU',
    'codigo (sku)': 'SKU',
    'canal': 'Canal',
    'situacao': 'Situação'
};

// Helper to format DD/MM/YYYY to DD/MM
export const formatDate = (dateString: string | number | undefined): string => {
    if (!dateString) return '';
    const str = String(dateString);
    if (!str.includes('/')) return str;
    const parts = str.split('/');
    if (parts.length === 3) {
        return `${parts[0]}/${parts[1]}`;
    }
    return str;
};

// Formata um número como moeda brasileira
export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

// Retorna classes de CSS para a etiqueta de status com base no texto
export const getStatusBadgeClasses = (status: string): string => {
    const normalizedStatus = normalizeString(String(status ?? ''));
    if (['aprovado', 'entregue', 'pago', 'confirmado', 'concluido'].some(s => normalizedStatus.includes(s))) {
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    }
    if (['pendente', 'aguardando', 'processando', 'em transito'].some(s => normalizedStatus.includes(s))) {
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
    }
    if (['cancelado', 'recusado', 'devolvido', 'falhou'].some(s => normalizedStatus.includes(s))) {
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200';
    }
    if (normalizedStatus.includes('enviado')) {
        return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

export const getNewStatusColor = (status: string): string => {
    const normalized = normalizeString(status);
    if (normalized.includes('aprovado')) return 'bg-green-400/30 text-green-800 dark:text-green-200';
    if (normalized.includes('dados incompletos')) return 'bg-red-500/30 text-red-800 dark:text-red-200';
    if (normalized.includes('erro de sku')) return 'bg-orange-500/30 text-orange-800 dark:text-orange-200';
    if (normalized.includes('enviado')) return 'bg-emerald-500/30 text-emerald-800 dark:text-emerald-200';
    if (normalized.includes('entregue')) return 'bg-green-700/30 text-green-800 dark:text-green-200';
    if (normalized.includes('cancelado')) return 'bg-black/30 text-gray-800 dark:text-gray-200';
    return 'bg-gray-400/30 text-gray-800 dark:text-gray-200';
};
