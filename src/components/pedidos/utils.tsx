import { normalizeString } from '../../utils/stringUtils';

// Colunas específicas que devem ser exibidas e filtradas na página de Pedidos
export const PEDIDOS_KEYS = ['imagem', 'data', 'data maxima de despacho', 'identificador do pedido e-commerce', 'nome', 'produto', 'tamanho', 'cor', 'quantidade', 'canal', 'situacao', 'cnpj', 'valor unitario'];

// Header Title Map
export const HEADER_TITLE_MAP: { [key: string]: string } = {
    'imagem': 'Img',
    'nome de contato': 'Nome',
    'nome': 'Nome',
    'valor unitario': 'Valor',
    'valor_unitario': 'Valor',
    'valor total': 'Total',
    'identificador do pedido e-commerce': 'ID',
    'numero da ordem de compra': 'ID',
    'id': 'ID',
    'data maxima de despacho': 'Prev',
    'prevista': 'Prev',
    'cnpj': 'CNPJ',
    'quantidade': 'Qt.',
    'tamanho': 'Tam/Var',
    'cor': 'Cor',
    'produto': 'Produto',
    'sku': 'SKU',
    'codigo (sku)': 'SKU',
    'codigo': 'SKU',
    'canal': 'Canal',
    'situacao': 'Situação',
    'data': 'Data',
    'categoria': 'Categoria'
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
        return 'bg-emerald-100/80 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800 shadow-sm';
    }
    if (['faturado'].some(s => normalizedStatus.includes(s))) {
        return 'bg-purple-100/80 text-purple-800 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800 shadow-sm';
    }
    if (['pendente', 'aguardando', 'processando', 'em transito'].some(s => normalizedStatus.includes(s))) {
        return 'bg-amber-100/80 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800 shadow-sm';
    }
    if (['cancelado', 'recusado', 'devolvido', 'falhou'].some(s => normalizedStatus.includes(s))) {
        return 'bg-rose-100/80 text-rose-800 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800 shadow-sm';
    }
    if (normalizedStatus.includes('enviado')) {
        return 'bg-blue-100/80 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800 shadow-sm';
    }
    return 'bg-gray-100/80 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 shadow-sm';
};

export const getNewStatusColor = (status: string): string => {
    const normalized = normalizeString(status);
    if (normalized.includes('aprovado')) return 'bg-emerald-400/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-400/50';
    if (normalized.includes('faturado')) return 'bg-purple-400/30 text-purple-800 dark:text-purple-200 hover:bg-purple-400/50';
    if (normalized.includes('dados incompletos')) return 'bg-rose-500/30 text-rose-800 dark:text-rose-200 hover:bg-rose-500/50';
    if (normalized.includes('erro de sku')) return 'bg-orange-500/30 text-orange-800 dark:text-orange-200 hover:bg-orange-500/50';
    if (normalized.includes('enviado')) return 'bg-sky-500/30 text-sky-800 dark:text-sky-200 hover:bg-sky-500/50';
    if (normalized.includes('entregue')) return 'bg-green-600/30 text-green-800 dark:text-green-200 hover:bg-green-600/50';
    if (normalized.includes('cancelado')) return 'bg-slate-500/30 text-slate-800 dark:text-slate-200 hover:bg-slate-500/50';
    return 'bg-gray-400/30 text-gray-800 dark:text-gray-200 hover:bg-gray-400/50';
};
