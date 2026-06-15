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
    'CANCELADO': { bg: 'bg-slate-800', text: 'text-white', border: 'border-slate-800' },
};

export const STATUS_OPTIONS = ['FAZER ARTE', 'PRONTA', 'EM APROVAÇÃO', 'APROVADO', 'IMPRESSO', 'AJUSTE', 'IMAGEM', 'ERRO IMPRESSÃO', 'CANCELADO'];
export const LOCAL_ESTAMPA_OPTIONS = ['PEITO', 'COSTAS', 'PEITO E COSTAS'];

export const statusSelectColorClasses: Record<string, string> = {
    'FAZER ARTE': 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-700',
    'PRONTA': 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-700',
    'EM APROVAÇÃO': 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700',
    'APROVADO': 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-700',
    'IMPRESSO': 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-200 dark:border-green-700',
    'AJUSTE': 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300 dark:bg-fuchsia-900/50 dark:text-fuchsia-200 dark:border-fuchsia-700',
    'IMAGEM': 'bg-red-200 text-red-800 border-red-400 dark:bg-red-900/50 dark:text-red-200 dark:border-red-700',
    'ERRO IMPRESSÃO': 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-200 dark:border-red-700',
    'CANCELADO': 'bg-slate-200 text-slate-800 border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600',
};

export const localSelectColorClasses: Record<string, string> = {
    'PEITO': 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/50 dark:text-sky-200 dark:border-sky-700',
    'COSTAS': 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-200 dark:border-indigo-700',
    'PEITO E COSTAS': 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/50 dark:text-violet-200 dark:border-violet-700',
};

export const canalColorClasses: Record<string, string> = {
    'ML VEST': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200',
    'SH VEST': 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
    'MG VEST': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
    'NT VEST': 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
    'SN VEST': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    'AM VEST': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    'KW VEST': 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200',
    'ML MM': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200',
    'SH MM': 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
    'MG MM': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
    'NT MM': 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
    'SN MM': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    'AM MM': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    'KW MM': 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200',
    'BUSINESS': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

export const fornecedorColorClasses: Record<string, string> = {
    'MM': 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
    'MVF': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200',
    'N/A': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

// --- Helper Functions ---

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

export const TABLE_HEADERS: { key: keyof EstampaRow | 'atraso' | 'actions' | 'aramado'; label: string; sortable: boolean; widthClass: string; }[] = [
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
    { key: 'tratado', label: 'OK', sortable: true, widthClass: 'w-8 text-center' },
];
