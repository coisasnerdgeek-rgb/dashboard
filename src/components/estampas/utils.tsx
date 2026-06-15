import React from 'react';
import { EstampaRow } from '../../types';

export const aramadoLetras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const aramadoNumeros = Array.from({ length: 10 }, (_, i) => String(i + 1));

// --- Color and Style Configurations ---
export const statusCardColorClasses: Record<string, { bg: string; text: string; border: string }> = {
    'FAZER ARTE': { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500' },
    'PRONTA': { bg: 'bg-yellow-500', text: 'text-white', border: 'border-yellow-500' },
    'EM APROVAÇÃO': { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-500' },
    'APROVADO': { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-600' },
    'IMPRESSO': { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500' },
    'AJUSTE': { bg: 'bg-fuchsia-500', text: 'text-white', border: 'border-fuchsia-500' },
    'IMAGEM': { bg: 'bg-red-800', text: 'text-white', border: 'border-red-800' },
    'ERRO IMPRESSÃO': { bg: 'bg-red-600', text: 'text-white', border: 'border-red-600' },
    'NÃO CHEGOU': { bg: 'bg-rose-900', text: 'text-white', border: 'border-rose-900' },
    'CANCELADO': { bg: 'bg-slate-800', text: 'text-white', border: 'border-slate-800' },
};

export const STATUS_OPTIONS = ['FAZER ARTE', 'PRONTA', 'EM APROVAÇÃO', 'APROVADO', 'IMPRESSO', 'AJUSTE', 'IMAGEM', 'ERRO IMPRESSÃO', 'NÃO CHEGOU', 'CANCELADO'];
export const LOCAL_ESTAMPA_OPTIONS = ['PEITO', 'COSTAS', 'PEITO E COSTAS'];

export const statusSelectColorClasses: Record<string, string> = {
    'FAZER ARTE': 'bg-orange-600/40 text-white border-2 border-orange-500',
    'PRONTA': 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30',
    'EM APROVAÇÃO': 'bg-blue-600/40 text-white border-2 border-blue-500',
    'APROVADO': 'bg-purple-600/40 text-white border-2 border-purple-500',
    'IMPRESSO': 'bg-emerald-600/40 text-white border-2 border-emerald-500',
    'AJUSTE': 'bg-fuchsia-600/40 text-white border-2 border-fuchsia-500',
    'IMAGEM': 'bg-red-800/40 text-white border-2 border-red-700',
    'ERRO IMPRESSÃO': 'bg-red-600/40 text-white border-2 border-red-500',
    'NÃO CHEGOU': 'bg-rose-900/40 text-white border-2 border-rose-800',
    'CANCELADO': 'bg-slate-700/40 text-white border-2 border-slate-600',
};

export const localSelectColorClasses: Record<string, string> = {
    'PEITO': 'bg-cyan-600/40 text-white border-2 border-cyan-500',
    'COSTAS': 'bg-indigo-600/40 text-white border-2 border-indigo-500',
    'PEITO E COSTAS': 'bg-violet-600/40 text-white border-2 border-violet-500',
};

export const canalColorClasses: Record<string, string> = {
    'ML VEST': 'bg-yellow-600/40 text-yellow-200 border-yellow-500/20',
    'SH VEST': 'bg-orange-600/40 text-orange-200 border-orange-500/20',
    'MG VEST': 'bg-red-600/40 text-red-200 border-red-500/20',
    'NT VEST': 'bg-sky-600/40 text-sky-200 border-sky-500/20',
    'SN VEST': 'bg-emerald-600/40 text-emerald-200 border-emerald-500/20',
    'AM VEST': 'bg-blue-600/40 text-blue-200 border-blue-500/20',
    'KW VEST': 'bg-pink-600/40 text-pink-200 border-pink-500/20',
    'ML MM': 'bg-yellow-600/40 text-yellow-200 border-yellow-500/20',
    'SH MM': 'bg-orange-600/40 text-orange-200 border-orange-500/20',
    'MG MM': 'bg-red-600/40 text-red-200 border-red-500/20',
    'NT MM': 'bg-sky-600/40 text-sky-200 border-sky-500/20',
    'SN MM': 'bg-emerald-600/40 text-emerald-200 border-emerald-500/20',
    'AM MM': 'bg-blue-600/40 text-blue-200 border-blue-500/20',
    'KW MM': 'bg-pink-600/40 text-pink-200 border-pink-500/20',
    'BUSINESS': 'bg-gray-600/40 text-gray-200 border-gray-500/20',
};

export const fornecedorColorClasses: Record<string, string> = {
    'MM': 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
    'MVF': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200',
    'N/A': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

// --- Helper Functions ---

/**
 * Adiciona dias úteis a uma data, pulando sábados e domingos.
 */
export const addBusinessDays = (startDate: Date, days: number): Date => {
    const date = new Date(startDate.getTime());
    let addedDays = 0;
    while (addedDays < days) {
        date.setDate(date.getDate() + 1);
        if (date.getDay() !== 0 && date.getDay() !== 6) {
            addedDays++;
        }
    }
    return date;
};

export const extractEstampaName = (folderName: string, orderId: string): string => {
    if (!folderName) return '';

    // Remove Order ID (case insensitive)
    let name = folderName.replace(new RegExp(orderId, 'i'), '').trim();

    // Remove ignored words (case insensitive)
    const ignoredPattern = /\b(frente|costas|costa|peito|manga|total)\b/gi;
    name = name.replace(ignoredPattern, '');

    // Remove " e " connector
    name = name.replace(/\b e \b/gi, ' ');

    // Clean up spaces and special chars
    name = name.replace(/[-_]/g, ' ');

    return name.replace(/\s+/g, ' ').trim().toUpperCase();
};

export const getPecaColorClass = (peca: string): string => {
    const lowerPeca = peca.toLowerCase();
    if (lowerPeca.includes('masculin')) return 'text-sky-500 dark:text-sky-400 font-semibold';
    if (lowerPeca.includes('feminin')) return 'text-pink-500 dark:text-pink-400 font-semibold';
    if (lowerPeca.includes('moletom')) return 'text-red-500 dark:text-red-400 font-semibold';
    if (lowerPeca.includes('infantil')) return 'text-green-500 dark:text-green-400 font-semibold';
    return 'text-gray-800 dark:text-gray-200';
};

export const getAtrasoStatus = (dateStr: string, store: string, rules: Record<string, { onTime: number; atRisk: number }>, dataPrevista?: string) => {
    const defaultStatus = { status: 'sem-data', color: 'bg-gray-400 rounded-full flex items-center justify-center', icon: <span className="text-white text-xs font-black">-</span>, tooltip: 'Sem data' };
    if (!dateStr || !dateStr.includes('/')) return defaultStatus;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return { ...defaultStatus, tooltip: 'Data inválida' };
    const [day, month, year] = parts.map(Number);
    if (isNaN(day) || isNaN(month) || isNaN(year) || year < 2000) return { ...defaultStatus, tooltip: 'Data inválida' };

    const orderDate = new Date(year, month - 1, day);
    const today = new Date();
    orderDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - orderDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const storeRule = rules[store] || rules.default || { onTime: 4, atRisk: 6 };

    // NEW LOGIC: If dataPrevista is missing, force 1-day deadline rule
    if (!dataPrevista) {
        if (diffDays > 1) {
            return { status: 'atrasado', color: 'bg-red-500 rounded-full flex items-center justify-center', icon: <span className="text-white text-xs font-black">⚠</span>, tooltip: `Atrasado` };
        }
        if (diffDays === 1) {
            return { status: 'em-risco', color: 'bg-yellow-500 rounded-full flex items-center justify-center', icon: <span className="text-white text-xs font-black">!</span>, tooltip: `Risco(1d sem data prevista)` };
        }
        return { status: 'em-dia', color: 'bg-green-500 rounded-full flex items-center justify-center', icon: <span className="text-white text-xs font-black flex items-center justify-center w-full h-full pb-[2px]">✓</span>, tooltip: `Em dia` };
    }

    // Original Logic for items WITH dataPrevista
    if (diffDays <= storeRule.onTime) {
        return { status: 'em-dia', color: 'bg-green-500 rounded-full flex items-center justify-center', icon: <span className="text-white text-xs font-black flex items-center justify-center w-full h-full pb-[2px]">✓</span>, tooltip: `Em dia(${diffDays}d)` };
    }
    if (diffDays <= storeRule.atRisk) {
        return { status: 'em-risco', color: 'bg-yellow-500 rounded-full flex items-center justify-center', icon: <span className="text-white text-xs font-black flex items-center justify-center w-full h-full pb-[2px]">!</span>, tooltip: `Em risco(${diffDays}d)` };
    }
    return { status: 'atrasado', color: 'bg-red-500 rounded-full flex items-center justify-center', icon: <span className="text-white text-xs font-black flex items-center justify-center w-full h-full pb-[3px]">⚠</span>, tooltip: `Atrasado(${diffDays}d)` };
};

export const TABLE_HEADERS: { key: keyof EstampaRow | 'atraso' | 'actions' | 'aramado' | 'select'; label: string; sortable: boolean; widthClass: string; }[] = [
    { key: 'select', label: '', sortable: false, widthClass: 'w-8 text-center' },
    { key: 'actions', label: '', sortable: false, widthClass: 'w-10 text-center' },
    { key: 'atraso', label: '', sortable: false, widthClass: 'w-6 text-center' },
    { key: 'status', label: 'STATUS', sortable: true, widthClass: 'w-44 text-center' },
    { key: 'data', label: 'Data', sortable: true, widthClass: 'w-20 text-center' },
    { key: 'dataPrevista', label: 'Prev', sortable: true, widthClass: 'w-24 text-center' },
    { key: 'codVenda', label: 'Pedido', sortable: true, widthClass: 'w-32 text-center' },
    { key: 'canal', label: 'Canal', sortable: true, widthClass: 'w-20 text-center' },
    // Fornecedor agora é barra lateral colorida na TR
    { key: 'peca', label: 'Peça', sortable: true, widthClass: 'w-24 text-center' },
    { key: 'nomeEstampa', label: 'Estampa', sortable: true, widthClass: 'w-64 text-center text-xs' },
    { key: 'localEstampa', label: 'Local', sortable: true, widthClass: 'w-48 text-center text-xs' },
    { key: 'cor', label: 'Cor', sortable: true, widthClass: 'w-24 text-center' },
    { key: 'tamanho', label: 'Tam', sortable: true, widthClass: 'w-12 text-center' },
    { key: 'quantidade', label: 'Qt', sortable: true, widthClass: 'w-10 text-center' },
    { key: 'aramado', label: 'Aramado', sortable: false, widthClass: 'w-32 text-center' },
    { key: 'L', label: 'L', sortable: true, widthClass: 'w-8 text-center' },
    { key: 'observacao', label: 'Obs', sortable: false, widthClass: 'w-8 text-center' },
];
