import React from 'react';
import { ProcessedTableRow, TableRow } from '../../types';
import { Pagination } from '../common/Pagination';
import { getStatusBadgeClasses, getNewStatusColor, formatCurrency } from './utils';
import { HEADER_TITLE_MAP } from './utils';
import { getColorHex, getTextColorForBackground, getStringColor } from '../../utils/colorUtils';

// Icons
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>;
const ChevronUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>;

interface PedidosListProps {
    data: ProcessedTableRow[];
    headers: string[];
    onRowClick?: (row: TableRow) => void;
    onToggleRow: (rowId: string | number) => void;
    expandedRows: Set<string | number>;
    // Sorting
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    requestSort: (key: string) => void;
    // Pagination
    currentPage: number;
    totalPages: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (limit: number) => void;
    // Helpers
    getHeaderTitle: (title: string) => string;
    imageMappings?: Record<string, string>;
}

export const PedidosList: React.FC<PedidosListProps> = ({
    data,
    headers,
    onRowClick,
    onToggleRow,
    expandedRows,
    sortConfig,
    requestSort,
    currentPage,
    totalPages,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange,
    getHeaderTitle,
    imageMappings
}) => {
    // Filter out 'PREV' column as requested (Case insensitive check for various 'forecast' related terms)
    // Filter out 'PREV' column as requested (Case insensitive check for various 'forecast' related terms)
    const visibleHeaders = headers.filter(h => {
        const title = getHeaderTitle(h);
        const lower = h.toLowerCase();
        // Remove if title is 'Prev' OR raw header key indicates forecast OR 'cnpj' as requested
        if (title === 'Prev') return false;
        return !lower.includes('prev') && !lower.includes('prazo') && !lower.includes('sla') && !lower.includes('estimada') && !lower.includes('cnpj');
    });

    const renderCellContent = (row: ProcessedTableRow, header: string) => {
        const val = row[header];

        if (header === 'imagem') {
            const sku = String(row['sku'] || row['SKU'] || row['codigo'] || '');
            const fotoUrl = (row as any).fotoUrl || (row as any).image_url || (imageMappings && imageMappings[sku]);

            return (
                <div className="flex justify-center">
                    {fotoUrl ? (
                        <div className="w-8 h-8 rounded-md overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm bg-gray-50 dark:bg-gray-900">
                            <img src={fotoUrl} alt="Prod" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-md bg-gray-50 dark:bg-gray-800 flex items-center justify-center border border-gray-100 dark:border-gray-700">
                            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                    )}
                </div>
            )
        }

        if (header === 'situacao') {
            const statusClass = getStatusBadgeClasses(String(val));
            return (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter ${statusClass}`}>
                    {String(val)}
                </span>
            )
        }

        const headerLower = header.toLowerCase();
        if (headerLower === 'produto' || headerLower === 'product' || headerLower.includes('produto')) {
            const prodName = String(val);
            const isKit = prodName.toUpperCase().includes('KIT') || prodName.toUpperCase().includes('CONJUNTO');

            // Try to find quantity - usually in 'quantidade' header, but row keys might vary
            // We search for a key that looks like quantity
            const qtyKey = Object.keys(row).find(k => k.toLowerCase() === 'quantidade' || k.toLowerCase() === 'qtde') || 'quantidade';
            const qtyStr = String(row[qtyKey] || '1');
            const qty = parseInt(qtyStr.replace(/[^\d]/g, '') || '1', 10);
            const isMoreThanOne = qty > 1;

            // Generate dynamic colors
            const bgColor = getStringColor(prodName);
            const textColor = getTextColorForBackground(bgColor);

            return (
                <div className="flex items-center gap-1 max-w-[200px]">
                    <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border line-clamp-1 truncate flex-1"
                        title={prodName}
                        style={{ backgroundColor: bgColor, color: textColor, borderColor: 'rgba(0,0,0,0.1)' }}
                    >
                        {prodName}
                    </span>
                    {isKit && (
                        <span className="inline-flex items-center px-1 py-0.5 rounded-md text-[8px] font-black uppercase bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700 tracking-tighter shadow-sm flex-shrink-0">
                            KIT
                        </span>
                    )}
                    {isMoreThanOne && (
                        <span className="inline-flex items-center px-1 py-0.5 rounded-md text-[8px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 tracking-tighter shadow-sm flex-shrink-0">
                            +{qty}
                        </span>
                    )}
                </div>
            );
        }

        if (header === 'cnpj') {
            const valStr = String(val || '').toUpperCase();
            let badgeClass = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700'; // Padrão

            if (valStr.includes('MM')) badgeClass = 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800';
            if (valStr.includes('MVF')) badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';

            return (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${badgeClass}`}>
                    {String(val || '-')}
                </span>
            );
        }

        if (header === 'canal') {
            const valStr = String(val || '').toUpperCase();
            // Default: Gray/Slate
            let badgeClass = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';

            if (valStr.includes('MERCADO') || valStr.includes('ML')) badgeClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
            if (valStr.includes('SHOPEE') || valStr.includes('SH')) badgeClass = 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200 border-orange-200 dark:border-orange-800';
            if (valStr.includes('MAGALU')) badgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border-blue-200 dark:border-blue-800';
            if (valStr.includes('SITE') || valStr.includes('NUVEM')) badgeClass = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800';
            if (valStr.includes('SHEIN')) badgeClass = 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-gray-200';
            if (valStr.includes('TIKTOK')) badgeClass = 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-200 border-pink-200 dark:border-pink-800';

            return (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase border ${badgeClass}`}>
                    {String(val || '-')}
                </span>
            );
        }

        const hLower = header.toLowerCase();

        if (hLower === 'cor') {
            const hex = getColorHex(String(val));
            const textColor = getTextColorForBackground(hex);
            return (
                <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight shadow-sm border border-black/10"
                    style={{ backgroundColor: hex, color: textColor }}
                >
                    {String(val)}
                </span>
            );
        }

        if (hLower.includes('identificador') || hLower === 'id' || hLower.includes('numero da ordem')) {
            const idVal = row[header] || row['id'] || row['ID'] || '-';
            const canalStr = String(row['canal'] || '').toUpperCase();
            const isML = canalStr.includes('ML');
            const isSH = canalStr.includes('SH');

            let href = undefined;
            if (isML) {
                href = `https://www.mercadolivre.com.br/vendas/novo/mensagens/${idVal}`;
            } else if (isSH) {
                href = `https://seller.shopee.com.br/portal/sale/order/${idVal}`;
            }

            return (
                <div className="flex items-center gap-1">
                    {href ? (
                        <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-mono font-bold text-[10px]">
                            {String(idVal)}
                        </a>
                    ) : (
                        <span className="font-mono font-bold text-gray-700 dark:text-gray-300 text-[10px]">{String(idVal)}</span>
                    )}
                    <button
                        onClick={async (e) => {
                            e.stopPropagation();
                            try {
                                await navigator.clipboard.writeText(String(idVal));
                                const toast = await import('react-hot-toast');
                                toast.default.success('ID copiado!', { duration: 2000 });
                            } catch (err) {
                                console.error('Failed to copy:', err);
                            }
                        }}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Copiar ID"
                    >
                        <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </button>
                </div>
            );
        }

        if (hLower.includes('valor') || hLower.includes('preco')) {
            let numVal = Number(val);
            if (isNaN(numVal) && typeof val === 'string') {
                // Tenta limpar formato de moeda brasileira (R$ 1.000,00 -> 1000.00)
                const cleaned = val.replace(/[^\d,.-]/g, '').replace(',', '.');
                numVal = Number(cleaned);
            }
            // Fallback para _valorTotal se disponível
            if ((isNaN(numVal) || numVal === 0) && (row as any)._valorTotal) {
                numVal = Number((row as any)._valorTotal);
            }

            if (isNaN(numVal) || (!val && !numVal)) return <span className="text-gray-400 text-[10px]">-</span>;
            return (
                <span className="font-bold text-gray-900 dark:text-gray-100 text-[11px]">
                    {formatCurrency(numVal)}
                </span>
            );
        }

        if (hLower === 'data' || hLower.includes('despacho') || hLower.includes('prevista') || hLower.includes('prev') || hLower.includes('sla')) {
            // Se for coluna PREV/SLA, tenta buscar valores de prazo se a célula estiver vazia
            let displayVal = val;
            if ((!displayVal || displayVal === '-') && (hLower.includes('prev') || hLower.includes('sla'))) {
                displayVal = (row as any)['Data Prevista'] || (row as any)['Prazo'] || (row as any)['SLA'] || (row as any)['data_prevista'] || (row as any)['deadline'];
            }

            if (!displayVal) return <span className="text-gray-400 text-[10px]">-</span>;

            const str = String(displayVal);
            if (str.includes('/')) {
                const parts = str.split('/');
                if (parts.length >= 2) return <span className="text-gray-600 dark:text-gray-400 font-bold text-[10px]">{parts[0]}/{parts[1]}</span>;
            }
            // Tenta formatar se for data ISO
            if (str.includes('-') && str.length === 10) {
                try {
                    const [y, m, d] = str.split('-');
                    return <span className="text-gray-600 dark:text-gray-400 font-bold text-[10px]">{d}/{m}</span>;
                } catch (e) { }
            }
            return <span className="text-gray-600 dark:text-gray-400 font-bold text-[10px]">{str}</span>;
        }

        // Default
        return <span className="text-gray-700 dark:text-gray-300 text-[11px] truncate">{String(val || '-')}</span>;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Mobile / Card View can be implemented here if needed. Focusing on Table first. */}

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th scope="col" className="px-2 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8">
                            </th>
                            {visibleHeaders.map((header) => {
                                const title = getHeaderTitle(header);
                                let widthClass = 'min-w-[80px]';
                                if (header === 'imagem') widthClass = 'w-10';
                                if (header === 'quantidade') widthClass = 'w-12';
                                if (header === 'cor' || header === 'tamanho') widthClass = 'w-16';
                                if (header === 'situacao') widthClass = 'w-24';
                                if (header === 'data') widthClass = 'w-14';

                                return (
                                    <th
                                        key={header}
                                        scope="col"
                                        className={`px-1.5 py-1.5 text-left text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-tighter cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors select-none ${widthClass}`}
                                        onClick={() => requestSort(header)}
                                    >
                                        <div className="flex items-center space-x-0.5">
                                            <span>{title}</span>
                                            {sortConfig && sortConfig.key === header && (
                                                <span className="text-blue-500 text-[8px]">
                                                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {data.map((row, index) => {
                            const isExpanded = expandedRows.has(row.id as (string | number));

                            return (
                                <React.Fragment key={row.originalIndex || index}>
                                    <tr
                                        className={`${isExpanded ? 'bg-gray-50 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} transition-colors cursor-pointer`}
                                        onClick={() => onRowClick && onRowClick(row as any)}
                                    >
                                        <td className="px-2 py-1.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleRow(row.id as string | number);
                                                }}
                                                className="text-gray-400 hover:text-gray-600 focus:outline-none transition-transform duration-200 hover:scale-110"
                                            >
                                                {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                                            </button>
                                        </td>
                                        {visibleHeaders.map(header => (
                                            <td key={`${row.id}-${header}`} className="px-1 py-1.5 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                                {renderCellContent(row, header)}
                                            </td>
                                        ))}
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-blue-50/30 dark:bg-blue-900/10 transition-all animate-fade-in">
                                            <td colSpan={headers.length + 1} className="px-6 py-6 border-b border-blue-100 dark:border-blue-900/30">
                                                <div className="flex flex-col lg:flex-row gap-8">
                                                    {/* Product Image / Info Column */}
                                                    <div className="flex-shrink-0 w-full lg:w-48 text-center space-y-3">
                                                        <div className="relative group">
                                                            {(() => {
                                                                const sku = String(row['sku'] || row['SKU'] || row['codigo'] || '');
                                                                const fotoUrl = (row as any).fotoUrl || (row as any).image_url || (imageMappings && imageMappings[sku]);

                                                                return fotoUrl ? (
                                                                    <img
                                                                        src={fotoUrl}
                                                                        alt={String(row['produto'])}
                                                                        className="w-48 h-48 object-contain rounded-xl bg-white dark:bg-gray-700 shadow-md border-2 border-gray-100 dark:border-gray-600 group-hover:scale-105 transition-transform duration-300"
                                                                    />
                                                                ) : (
                                                                    <div className="w-48 h-48 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-300 border-2 border-dashed border-gray-200 dark:border-gray-600">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                                    </div>
                                                                );
                                                            })()}
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                                                                <span className="text-white text-xs font-bold px-3 py-1.5 bg-blue-600 rounded-full shadow-lg">Ver Detalhes</span>
                                                            </div>
                                                        </div>
                                                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                            {String(row['sku'] || 'SEM SKU')}
                                                        </div>
                                                    </div>

                                                    {/* Order Details Grid */}
                                                    <div className="flex-grow grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                                        {/* Client & Shipping */}
                                                        <div className="space-y-4">
                                                            <div>
                                                                <h4 className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                                    Dados do Cliente
                                                                </h4>
                                                                <div className="space-y-1 bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{String(row['nome'] || 'N/A')}</p>
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                                        <span className="font-medium">CNPJ/CPF:</span> {String(row['cnpj'] || '-')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            {row['endereco'] && (
                                                                <div>
                                                                    <h4 className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                        Endereço
                                                                    </h4>
                                                                    <p className="text-xs text-gray-600 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 leading-relaxed">
                                                                        {String(row['endereco'])}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Product Details */}
                                                        <div className="space-y-4">
                                                            <div>
                                                                <h4 className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                                                    Produto & Especificações
                                                                </h4>
                                                                <div className="space-y-2 bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                                                    <div className="flex justify-between items-start">
                                                                        <span className="text-xs font-medium text-gray-500">Item:</span>
                                                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 text-right max-w-[200px]">{String(row['produto'])}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-start">
                                                                        <span className="text-[10px] font-medium text-gray-400">Descrição:</span>
                                                                        <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 text-right max-w-[200px] break-all">{String(row['sku'] || row['SKU'] || '-')}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-xs">
                                                                        <span className="font-medium text-gray-500">Cor:</span>
                                                                        <span className="font-bold text-gray-800 dark:text-gray-200">{String(row['cor'] || '-')}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-xs">
                                                                        <span className="font-medium text-gray-500">Tamanho/Var:</span>
                                                                        <span className="font-bold text-gray-800 dark:text-gray-200">{String(row['tamanho'] || '-')}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Financials & Status */}
                                                        <div className="space-y-4">
                                                            <div>
                                                                <h4 className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                    Financeiro
                                                                </h4>
                                                                <div className="space-y-2 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Valor Unitário:</span>
                                                                        <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                                                                            {(() => {
                                                                                const valorUnit = row['valor unitario'] || row['Valor Unitário'] || row['valor_unitario'] || row['preco'] || row['preço'];
                                                                                return valorUnit ? formatCurrency(Number(valorUnit)) : '-';
                                                                            })()}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Quantidade:</span>
                                                                        <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{String(row['quantidade'])}</span>
                                                                    </div>
                                                                    <div className="h-px bg-emerald-200 dark:bg-emerald-800 my-1" />
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase">Subtotal:</span>
                                                                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                                                            {(() => {
                                                                                const valorUnit = row['valor unitario'] || row['Valor Unitário'] || row['valor_unitario'] || row['preco'] || row['preço'];
                                                                                const qty = row['quantidade'];
                                                                                return (valorUnit && qty) ? formatCurrency(Number(valorUnit) * Number(qty)) : '-';
                                                                            })()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Tracking Info if available */}
                                                            {row['tracking'] && (
                                                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                                                    <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">Cód. Rastreamento</p>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-mono font-bold dark:text-blue-300">{String(row['tracking'])}</span>
                                                                        <button className="text-[10px] text-blue-600 hover:underline">Rastrear</button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination Utilizada da Common ou Local se não compativel */}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                rowsPerPage={rowsPerPage}
                onPageChange={onPageChange}
                onRowsPerPageChange={onRowsPerPageChange}
            />
        </div>
    );
};
