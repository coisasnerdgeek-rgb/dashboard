import React, { useMemo, useState, useEffect } from 'react';
import { TableRow, PriceProduct, MetricRow, MarketplaceFee } from '../types';
import { calculateCost } from '../services/priceTableService';
import { calculateMarketplaceFees, getMarketplaceFees } from '../services/marketplaceService';
import { normalizeString } from '../utils/stringUtils';
import { parseSku, getEffectiveQuantity } from '../services/skuService';

interface MetricasProps {
    allRows: TableRow[];
    priceTable: PriceProduct[];
}

const Metricas: React.FC<MetricasProps> = ({ allRows, priceTable }) => {
    const [fees, setFees] = useState<MarketplaceFee[]>([]);
    const [loadingFees, setLoadingFees] = useState(true);

    // Filter States
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [onlyLoss, setOnlyLoss] = useState(false);

    // Column Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: keyof MetricRow | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'desc' });

    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [showLowProfitOnly, setShowLowProfitOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [startDate, endDate, onlyLoss, sortConfig, showLowProfitOnly, searchQuery]);

    const handleSort = (key: keyof MetricRow) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            // Optional: could toggle back to null or stay desc. Standard is toggle.
            direction = 'asc';
        } else {
            // Default for new column. Numbers usually desc first (highest value), text asc.
            // Let's stick to asc default unless specified otherwise, but for metrics, desc is often better (highest sales).
            // Simpler: Default 'desc' for everything initially? Or 'asc'? 
            // Let's go with 'desc' for numbers, 'asc' for text.
            if (['total', 'custo', 'taxas', 'imposto', 'lucro', 'lucroPercent', 'roi', 'quantidade', 'valor'].includes(key)) {
                direction = 'desc';
            } else {
                direction = 'asc';
            }
        }
        setSortConfig({ key, direction });
    };

    const toggleRow = (id: string) => {
        setExpandedRow(prev => prev === id ? null : id);
    };

    const applyDateFilter = (days: number | 'month' | 'yesterday') => {
        const end = new Date();
        const start = new Date();

        if (days === 'yesterday') {
            start.setDate(start.getDate() - 1);
            end.setDate(end.getDate() - 1);
        } else if (days === 'month') {
            start.setDate(1);
        } else {
            start.setDate(start.getDate() - days);
        }

        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };

    useEffect(() => {
        getMarketplaceFees().then(data => {
            setFees(data);
            setLoadingFees(false);
        });
    }, []);

    const data = useMemo(() => {
        if (loadingFees) return [];

        const rows: MetricRow[] = [];

        // Maps to cache costs
        const priceMap = new Map<string, PriceProduct>();
        const skuMap = new Map<string, PriceProduct>();

        priceTable.forEach(p => {
            priceMap.set(normalizeString(p.product), p);
            if (p.skuProductName) {
                skuMap.set(normalizeString(p.skuProductName), p);
            }
        });

        allRows.forEach((row, index) => {
            // Helpful utility to find value case-insensitively
            const getValue = (keys: string[]): any => {
                for (const key of keys) {
                    // check direct key
                    if (row[key] !== undefined) return row[key];
                    // check normalized keys in row
                    const foundKey = Object.keys(row).find(k => normalizeString(k) === normalizeString(key));
                    if (foundKey) return row[foundKey];
                }
                return null;
            };

            const id = getValue(['Id', 'Pedido', 'Order Id', 'Código', 'Numero', 'Número do Pedido']) || `row-${index}`;
            const produto = String(getValue(['Produto', 'Item', 'Nome do Produto', 'Descricao', 'Descrição', 'Nome']) || 'Desconhecido');
            const sku = String(getValue(['Sku', 'Reference', 'Referência', 'Codigo', 'Código']) || '');
            const canal = String(getValue(['Canal', 'Marketplace', 'Loja', 'Origem', 'Nome da Loja', 'Canal de Venda']) || 'Outros');

            const rawDate = getValue(['Data', 'Data Pedido', 'Data do Pedido', 'Date', 'Created At']);
            let dataVenda: Date | undefined;
            if (rawDate) {
                // Try to parse 'DD/MM/YYYY' or 'YYYY-MM-DD'
                const dStr = String(rawDate).trim();
                let parts = dStr.split('/');
                if (parts.length === 3) {
                    // Assume DD/MM/YYYY
                    dataVenda = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                } else {
                    dataVenda = new Date(dStr);
                }
                // Validate
                if (isNaN(dataVenda.getTime())) dataVenda = undefined;
            }

            // Parse Monetary Values
            const parseMoney = (val: any): number => {
                if (typeof val === 'number') return val;
                if (!val) return 0;
                let str = String(val).replace('R$', '').trim();

                // Heuristic to detect format
                if (str.includes(',') && str.includes('.')) {
                    // Has both. If comma is last, it's BR (1.000,00). If dot is last, it's US (1,000.00)
                    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                        // BR: remove dots, swap comma
                        str = str.replace(/\./g, '').replace(',', '.');
                    } else {
                        // US: remove commas
                        str = str.replace(/,/g, '');
                    }
                } else if (str.includes(',')) {
                    // Only comma (39,90) -> Replace with dot
                    str = str.replace(',', '.');
                } else if (str.includes('.')) {
                    // Only dot. 
                    // If multiple dots (1.234.567), it's thousands separators -> Remove.
                    // If single dot (39.90), it's decimal -> Keep.
                    // Edge case: "1.000" (1000) vs "1.000" (1). 
                    // Given the user report "3.990,00 should be 39,90", the input for 39.90 was likely "39.90" and got stripped.
                    // We assume single dot = decimal.
                    if ((str.match(/\./g) || []).length > 1) {
                        str = str.replace(/\./g, '');
                    }
                }

                return parseFloat(str) || 0;
            };

            const valorUnitario = parseMoney(getValue(['Valor', 'Preço Unitário', 'Unit Price', 'Valor Unitário', 'Valor Liquido']));
            const quantidade = parseMoney(getValue(['Quantidade', 'Qtd', 'Qty'])) || 1;
            const totalVenda = parseMoney(getValue(['Total', 'Valor Total', 'Valor Venda'])) || (valorUnitario * quantidade);

            // Calculate Cost using Price Table
            const rowString = JSON.stringify(row).toLowerCase();
            const isWhite = rowString.includes('branco') || rowString.includes('branca');
            const priceType = isWhite ? 'BRANCO' : 'COR';

            const fornecedor = String(getValue(['Fornecedor', 'Fábrica', 'Store']) || 'GUSHI').toUpperCase();

            // Advanced SKU Parsing for accurate identification
            const parsedSku = parseSku(sku);
            const effectiveQuantity = getEffectiveQuantity(sku, quantidade);

            // Determine the best Product Name to use for lookup
            let matchName = produto;
            if (parsedSku && parsedSku.productName !== 'N/A') {
                matchName = parsedSku.productName;
            }

            // Lookup Strategy:
            // 1. Try Parsed Name (Canonical)
            let productMatch = priceMap.get(normalizeString(matchName));

            // 2. Try SKU Map direct match (from Price Table 'sku' column)
            if (!productMatch && sku) {
                productMatch = skuMap.get(normalizeString(sku));
            }

            // 3. Fallback to original row Product Name if different from parsed
            if (!productMatch && matchName !== produto) {
                productMatch = priceMap.get(normalizeString(produto));
            }

            let custo = 0;
            if (productMatch && productMatch.prices) {
                // User Request: Priority is always 'MAGIC' store
                let storePriceObj = productMatch.prices['MAGIC'];

                // If 'MAGIC' price not found, try ANY available store (next value)
                if (!storePriceObj) {
                    const firstStore = Object.keys(productMatch.prices)[0];
                    if (firstStore) storePriceObj = productMatch.prices[firstStore];
                }

                if (storePriceObj) {
                    const price = storePriceObj[priceType] || storePriceObj['COR'] || storePriceObj['BRANCO'] || 0;
                    custo = Number(price) * effectiveQuantity;
                }
            }

            // Calculate Fees
            const feeResult = calculateMarketplaceFees(totalVenda, canal, fees, quantidade);

            const lucro = totalVenda - custo - feeResult.totalFee;
            const lucroPercent = totalVenda > 0 ? (lucro / totalVenda) * 100 : 0;
            const roi = custo > 0 ? (lucro / custo) * 100 : 0;

            if (totalVenda > 0) { // Filter out empty lines
                rows.push({
                    ...row,
                    id,
                    channel: canal,
                    product: matchName !== 'N/A' && matchName !== 'Desconhecido' ? matchName : produto, // Prefer parsed name
                    sku,
                    valor: valorUnitario,
                    total: totalVenda,
                    quantidade,
                    lucro,
                    lucroPercent,
                    taxas: feeResult.commission + feeResult.fixed, // Combine comm + fixed
                    imposto: feeResult.tax,
                    custo,
                    roi,
                    details: feeResult.details,
                    date: dataVenda
                });
            }
        });

        // Apply Filters
        let filteredRows = rows.filter(row => {
            const rowDate = row.date;
            if (startDate && rowDate && rowDate < new Date(startDate)) return false;
            if (endDate && rowDate && rowDate > new Date(endDate)) return false;
            if (onlyLoss && row.lucro >= 0) return false;
            if (onlyLoss && row.lucro >= 0) return false;
            if (showLowProfitOnly && row.lucroPercent >= 5) return false;

            if (searchQuery) {
                const searchLower = normalizeString(searchQuery);
                const matchId = normalizeString(String(row.id)).includes(searchLower);
                const matchProduct = normalizeString(String(row.product)).includes(searchLower);
                const matchSku = normalizeString(String(row.sku)).includes(searchLower);
                if (!matchId && !matchProduct && !matchSku) return false;
            }

            return true;
        });

        // Apply Sorting
        if (sortConfig.key) {
            filteredRows.sort((a, b) => {
                const aValue = a[sortConfig.key!];
                const bValue = b[sortConfig.key!];

                if (aValue === bValue) return 0;

                // Handle strings case-insensitive
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortConfig.direction === 'asc'
                        ? aValue.localeCompare(bValue)
                        : bValue.localeCompare(aValue);
                }

                // Handle numbers / dates
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filteredRows;
    }, [allRows, fees, priceTable, loadingFees, startDate, endDate, onlyLoss, sortConfig, showLowProfitOnly, searchQuery]);

    const getChannelBadge = (channel: string) => {
        const c = String(channel).toUpperCase().trim();
        // Base classes layout only, no colors
        const className = 'px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-md shadow-sm border border-black/10 items-center justify-center min-w-[80px]';
        let label = channel;

        // Default style
        let style = { backgroundColor: '#f3f4f6', color: '#374151' };

        if (c.includes('SHOPEE') || c === 'SH' || c.startsWith('SH ')) {
            style = { backgroundColor: '#EE4D2D', color: '#FFFFFF' };
            label = 'Shopee';
        }
        else if (c.includes('MERCADO') || c === 'ML' || c.startsWith('ML ')) {
            style = { backgroundColor: '#FFE600', color: '#2D3277' };
            label = 'Mercado Livre';
        }
        else if (c.includes('AMAZON') || c === 'AM') {
            style = { backgroundColor: '#232F3E', color: '#FFFFFF' };
            label = 'Amazon';
        }
        else if (c.includes('MAGALU') || c === 'MG' || c.includes('MAGAZINE') || c === 'MG VEST' || c === 'MG MM') {
            style = { backgroundColor: '#4169E1', color: '#FFFFFF' }; // Royal Blue
            label = 'Magalu';
        }
        else if (c.includes('NETSHOES') || c === 'NT' || c.startsWith('NT ')) {
            style = { backgroundColor: '#7e22ce', color: '#FFFFFF' }; // Purple 700
            label = 'Netshoes';
        }
        else if (c.includes('SHEIN') || c === 'SHE' || c === 'SG') {
            style = { backgroundColor: '#000000', color: '#FFFFFF' };
            label = 'Shein';
        }
        else if (c.includes('SITE') || c === 'SI') {
            style = { backgroundColor: '#10B981', color: '#FFFFFF' };
            label = 'Site';
        }
        else if (c === 'BUSINESS' || c.includes('BUSINESS')) {
            style = { backgroundColor: '#10B981', color: '#FFFFFF' }; // Green
            label = 'Business';
        }

        return (
            <span className={className} style={style}>
                {label}
            </span>
        );
    };

    const handleCopyId = (id: string) => {
        navigator.clipboard.writeText(id);
        // Could enable a toast here if available, for now simple action
    };

    if (loadingFees) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#111827] flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-lg bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                    <div className="relative h-2 bg-gray-100 dark:bg-gray-700">
                        <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-loading-bar"></div>
                    </div>
                    <div className="p-10 flex flex-col items-center text-center">
                        <div className="relative mb-8">
                            <div className="w-24 h-24 rounded-full border-4 border-blue-100 dark:border-blue-900 mx-auto"></div>
                            <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                </svg>
                            </div>
                        </div>

                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Processando Métricas
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
                            Estamos analisando seus pedidos, cruzando custos e calculando a rentabilidade em tempo real.
                        </p>

                        <div className="w-full space-y-3">
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    Carregando dados de vendas
                                </span>
                                <span className="text-green-600 font-bold">OK</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                                    Aplicando taxas (Shopee, ML...)
                                </span>
                                <span className="text-blue-600 font-bold animate-pulse">...</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                                    Calculando Lucro e ROI
                                </span>
                                <span className="text-purple-600 font-bold">...</span>
                            </div>
                        </div>
                    </div>
                </div>
                <style>{`
                    @keyframes loading-bar {
                        0% { width: 0%; transform: translateX(0); }
                        50% { width: 100%; transform: translateX(0); }
                        100% { width: 0%; transform: translateX(100%); }
                    }
                    .animate-loading-bar {
                        animation: loading-bar 2s infinite linear;
                    }
                `}</style>
            </div>
        );
    }

    const totalLucro = data.reduce((acc, r) => acc + r.lucro, 0);
    const totalVendas = data.reduce((acc, r) => acc + r.total, 0);
    const mediaRoi = data.length > 0 ? data.reduce((acc, r) => acc + r.roi, 0) / data.length : 0;
    const ticketMedio = data.length > 0 ? totalVendas / data.length : 0;
    const pedidosBaixoLucro = data.filter(r => r.lucroPercent < 5 && r.lucro >= 0).length;
    const pedidosPrejuizo = data.filter(r => r.lucro < 0).length;

    const currentData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="p-6 space-y-6 bg-gray-50 dark:bg-[#111827] min-h-screen">
            {/* KPI Cards (Gradient + Icons) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                {/* Total Vendas - Blue Gradient */}
                <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700 p-4 rounded-xl shadow-lg shadow-blue-500/20 text-white">
                    <div className="relative z-10">
                        <p className="text-xs font-medium text-blue-100 uppercase tracking-wider">Total Vendas</p>
                        <p className="text-xl font-bold mt-1 truncate">
                            {totalVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 text-blue-800/30 rotate-12">
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.15-1.46-3.27-3.4h1.96c.1 1.05 1.18 1.91 2.53 1.91 1.33 0 2.26-.82 2.26-1.96 0-1.1-1.05-1.57-2.62-1.97-2.09-.54-3.56-1.35-3.56-3.37 0-1.78 1.34-2.9 3.1-3.26V4h2.67v1.9c1.61.35 2.89 1.48 2.94 3.26h-1.96c-.05-.82-.76-1.63-2.12-1.63-1.08 0-2.16.59-2.16 1.76 0 .86.85 1.36 2.53 1.77 2.49.61 3.65 1.63 3.65 3.55 0 1.96-1.55 3.14-3.29 3.45z" /></svg>
                    </div>
                </div>

                {/* Lucro Líquido - Green/Red Gradient */}
                <div className={`relative overflow-hidden p-4 rounded-xl shadow-lg text-white ${totalLucro >= 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-500/20' : 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-500/20'}`}>
                    <div className="relative z-10">
                        <p className={`text-xs font-medium uppercase tracking-wider ${totalLucro >= 0 ? 'text-emerald-100' : 'text-red-100'}`}>Lucro Líquido</p>
                        <p className="text-xl font-bold mt-1 truncate">
                            {totalLucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                    <div className={`absolute -right-4 -bottom-4 rotate-12 ${totalLucro >= 0 ? 'text-emerald-800/30' : 'text-red-800/30'}`}>
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" /></svg>
                    </div>
                </div>

                {/* Margem Média - Indigo Gradient */}
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 rounded-xl shadow-lg shadow-indigo-500/20 text-white">
                    <div className="relative z-10">
                        <p className="text-xs font-medium text-indigo-100 uppercase tracking-wider">Margem Média</p>
                        <p className="text-xl font-bold mt-1 truncate">
                            {totalVendas > 0 ? ((totalLucro / totalVendas) * 100).toFixed(1) : 0}%
                        </p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 text-indigo-800/30 rotate-12">
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" /></svg>
                    </div>
                </div>

                {/* ROI Médio - Purple Gradient */}
                <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-purple-700 p-4 rounded-xl shadow-lg shadow-purple-500/20 text-white">
                    <div className="relative z-10">
                        <p className="text-xs font-medium text-purple-100 uppercase tracking-wider">ROI Médio</p>
                        <p className="text-xl font-bold mt-1 truncate">
                            {mediaRoi.toFixed(1)}%
                        </p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 text-purple-800/30 rotate-12">
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
                    </div>
                </div>

                {/* Ticket Médio - Teal Gradient */}
                <div className="relative overflow-hidden bg-gradient-to-br from-teal-500 to-teal-700 p-4 rounded-xl shadow-lg shadow-teal-500/20 text-white">
                    <div className="relative z-10">
                        <p className="text-xs font-medium text-teal-100 uppercase tracking-wider">Ticket Médio</p>
                        <p className="text-xl font-bold mt-1 truncate">
                            {ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 text-teal-800/30 rotate-12">
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1z" /></svg>
                    </div>
                </div>

                {/* Baixo Lucro - Orange/Red Warning Gradient */}

                {/* Prejuízo - Red Gradient - Clickable Filter */}
                <div
                    onClick={() => setOnlyLoss(!onlyLoss)}
                    className={`relative overflow-hidden p-4 rounded-xl shadow-lg cursor-pointer transition-all duration-200 group
                        ${onlyLoss
                            ? 'bg-gradient-to-br from-red-700 to-red-900 ring-4 ring-offset-2 ring-red-500 dark:ring-offset-gray-900 scale-[1.03]'
                            : 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-500/20 hover:scale-[1.03] active:scale-95'
                        } text-white`}
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-red-100 uppercase tracking-wider">Prejuízo</p>
                            {onlyLoss && <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">FILTRANDO</span>}
                        </div>
                        <p className="text-xl font-bold mt-1 truncate">
                            {pedidosPrejuizo} <span className="text-xs font-normal opacity-75">pedidos</span>
                        </p>
                    </div>
                    <div className={`absolute -right-4 -bottom-4 rotate-12 ${onlyLoss ? 'text-red-900/30' : 'text-red-800/30'} transition-transform group-hover:rotate-45`}>
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                    </div>
                </div>
                {/* Baixo Lucro - Orange/Red Warning Gradient - Clikable Filter */}
                <div
                    onClick={() => setShowLowProfitOnly(!showLowProfitOnly)}
                    className={`relative overflow-hidden p-4 rounded-xl shadow-lg cursor-pointer transition-all duration-200 group
                        ${showLowProfitOnly
                            ? 'bg-gradient-to-br from-red-600 to-red-800 ring-4 ring-offset-2 ring-red-400 dark:ring-offset-gray-900 scale-[1.03]'
                            : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-500/20 hover:scale-[1.03] active:scale-95'
                        } text-white`}
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-amber-100 uppercase tracking-wider">Menos de 5%</p>
                            {showLowProfitOnly && <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">FILTRANDO</span>}
                        </div>
                        <p className="text-xl font-bold mt-1 truncate">
                            {pedidosBaixoLucro} <span className="text-xs font-normal opacity-75">pedidos</span>
                        </p>
                    </div>
                    <div className={`absolute -right-4 -bottom-4 rotate-12 ${showLowProfitOnly ? 'text-red-900/30' : 'text-orange-800/30'} transition-transform group-hover:rotate-45`}>
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                    </div>
                </div>
            </div>

            {/* Minimalist Filters Bar */}
            <div className="flex flex-wrap gap-6 items-end justify-end px-2">
                <div className="flex flex-col">
                    <label className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">Período</label>
                    <div className="flex items-center space-x-2">
                        {/* Shortcuts */}
                        <div className="flex bg-white dark:bg-[#1e293b] rounded-lg border border-gray-200 dark:border-gray-700 p-1 mr-2">
                            <button onClick={() => applyDateFilter(0)} className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">Hoje</button>
                            <button onClick={() => applyDateFilter('yesterday')} className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">Ontem</button>
                            <button onClick={() => applyDateFilter(7)} className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">7 Dias</button>
                            <button onClick={() => applyDateFilter(15)} className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">15 Dias</button>
                            <button onClick={() => applyDateFilter('month')} className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">Mês</button>
                        </div>

                        <div className="flex items-center space-x-2 bg-white dark:bg-[#1e293b] rounded-lg px-2 py-1 border border-gray-200 dark:border-gray-700 shadow-sm">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent text-sm text-gray-700 dark:text-gray-200 focus:outline-none border-none p-1"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent text-sm text-gray-700 dark:text-gray-200 focus:outline-none border-none p-1"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">Ordenação Rápida</label>
                    <div className="relative">
                        <select
                            value={sortConfig.key === 'lucro' ? (sortConfig.direction === 'desc' ? 'profit_desc' : 'profit_asc') : 'default'}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'profit_desc') setSortConfig({ key: 'lucro', direction: 'desc' });
                                else if (val === 'profit_asc') setSortConfig({ key: 'lucro', direction: 'asc' });
                                else setSortConfig({ key: null, direction: 'desc' });
                            }}
                            className="appearance-none bg-white dark:bg-[#1e293b] text-sm text-gray-700 dark:text-gray-200 pl-4 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
                        >
                            <option value="default">⚡ Padrão</option>
                            <option value="profit_desc">💎 Maior Lucro</option>
                            <option value="profit_asc">🔻 Menor Lucro</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col flex-grow min-w-[200px]">
                    <label className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">Buscar</label>
                    <div className="relative w-full">
                        <input
                            type="text"
                            placeholder="ID, Produto ou SKU"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white dark:bg-[#1e293b] text-sm text-gray-700 dark:text-gray-200 pl-8 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 w-full"
                        />
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2 text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                    </div>
                </div>

                {(startDate || endDate || sortConfig.key || showLowProfitOnly || onlyLoss || searchQuery) && (
                    <button
                        onClick={() => {
                            setStartDate('');
                            setEndDate('');
                            setSortConfig({ key: null, direction: 'desc' });
                            setShowLowProfitOnly(false);
                            setOnlyLoss(false);
                            setSearchQuery('');
                        }}
                        className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 hover:underline pb-2 transition-colors"
                    >
                        Limpar
                    </button>
                )}
            </div>

            {/* Debug Info for User Support */}
            {data.length === 0 && allRows.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">
                        ⚠️ Nenhum dado identificado (ou filtro muito restritivo)
                    </h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                        Não encontramos dados com os critérios atuais. Verifique os filtros ou o mapeamento da planilha.
                    </p>
                    <div className="bg-gray-800 text-gray-200 p-3 rounded text-xs overflow-auto font-mono max-h-40">
                        <strong>Colunas Encontradas:</strong>
                        <br />
                        {JSON.stringify(Object.keys(allRows[0]), null, 2)}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 whitespace-nowrap text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-0 py-3 w-6 text-center"></th>
                                {[
                                    { key: 'channel', label: 'Canal' },
                                    { key: 'date', label: 'Data', align: 'center' },
                                    { key: 'id', label: 'ID' },
                                    { key: 'sku', label: 'SKU' },
                                    { key: 'quantidade', label: 'Qtd', align: 'center' },
                                    { key: 'product', label: 'Produto' },
                                    { key: 'total', label: 'Valor Total', align: 'right' },
                                    { key: 'custo', label: 'Custo', align: 'right' },
                                    { key: 'taxas', label: 'Taxas', align: 'right' },
                                    { key: 'imposto', label: 'Impostos', align: 'right' },
                                    { key: 'lucro', label: 'Lucro R$', align: 'right' },
                                    { key: 'lucroPercent', label: 'Lucro %', align: 'right' },
                                    { key: 'roi', label: 'ROI', align: 'right' },
                                ].map((col) => (
                                    <th
                                        key={col.key}
                                        onClick={() => handleSort(col.key as keyof MetricRow)}
                                        className={`px-1 py-3 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                                    >
                                        <div className={`flex items-center gap-1 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                                            {col.label}
                                            {sortConfig.key === col.key && (
                                                <span className="text-blue-500">
                                                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {currentData.map((row, i) => ( // Pagination Active
                                <React.Fragment key={i}>
                                    <tr className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${row.lucro < 0 ? 'bg-red-50 dark:bg-red-900/20' : ''} transition-colors`}>
                                        <td className="px-0 py-2 text-center">
                                            <button
                                                onClick={() => toggleRow(row.id)}
                                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors focus:outline-none"
                                            >
                                                {expandedRow === row.id ? (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-1 py-2">
                                            {getChannelBadge(row.channel)}
                                        </td>
                                        <td className="px-1 py-2 text-center text-gray-500 dark:text-gray-400 text-xs">
                                            {row.date ? new Date(row.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                                        </td>
                                        <td className="px-1 py-2 text-gray-500 dark:text-gray-400 group relative flex items-center gap-2">
                                            <span>{row.id.substring(0, 10)}</span>
                                            <button
                                                onClick={() => handleCopyId(row.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-opacity"
                                                title="Copiar ID"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                </svg>
                                            </button>
                                        </td>
                                        <td className="px-1 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs truncate max-w-[150px]" title={row.sku}>
                                            {row.sku.length > 18 ? `${row.sku.substring(0, 18)}...` : row.sku}
                                        </td>
                                        <td className="px-1 py-2 text-center text-gray-500 dark:text-gray-400">{row.quantidade}</td>
                                        <td className="px-1 py-2 text-gray-900 dark:text-white truncate max-w-[200px]" title={row.product}>{row.product}</td>
                                        <td className="px-1 py-2 text-right text-gray-900 dark:text-white">{row.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        <td className="px-1 py-2 text-right text-red-400">{row.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        <td className="px-1 py-2 text-right text-orange-400">
                                            {row.taxas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-1 py-2 text-right text-orange-400">
                                            {row.imposto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className={`px-1 py-2 text-right font-bold ${row.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {row.lucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className={`px-1 py-2 text-right ${row.lucroPercent >= 20 ? 'text-green-600' : 'text-yellow-600'}`}>
                                            {row.lucroPercent.toFixed(1)}%
                                        </td>
                                        <td className="px-1 py-2 text-right text-purple-600">{row.roi.toFixed(0)}%</td>
                                    </tr>
                                    {expandedRow === row.id && (
                                        <tr className="bg-gray-50 dark:bg-gray-800/50">
                                            <td colSpan={13} className="px-4 py-3">
                                                <div className="text-sm text-gray-600 dark:text-gray-300 ml-8 border-l-2 border-gray-300 dark:border-gray-600 pl-4">
                                                    <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-gray-500">Detalhamento Financeiro</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <ul className="space-y-1">
                                                                {row.details?.map((detail, idx) => (
                                                                    <li key={idx} className="flex items-center text-xs">
                                                                        <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                                                                        {detail}
                                                                    </li>
                                                                ))}
                                                                <li className="flex items-center text-xs text-red-400 mt-2 font-medium">
                                                                    <span className="w-1 h-1 bg-red-400 rounded-full mr-2"></span>
                                                                    Custo do Produto: - {row.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </li>
                                                            </ul>
                                                        </div>
                                                        <div className="bg-white dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700">
                                                            <div className="flex justify-between text-xs mb-1">
                                                                <span>Valor Venda:</span>
                                                                <span className="font-bold">{row.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                            </div>
                                                            <div className="flex justify-between text-xs text-red-500 mb-1">
                                                                <span>Deduções (Taxas+Impostos+Custos):</span>
                                                                <span>- {(row.taxas + row.imposto + row.custo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                            </div>
                                                            <div className="border-t border-gray-200 dark:border-gray-700 my-1 pt-1 flex justify-between text-sm font-bold">
                                                                <span>Resultado Final:</span>
                                                                <span className={row.lucro >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                                    {row.lucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
                    <div className="flex-1 flex justify-between sm:hidden">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                            Anterior
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(data.length / itemsPerPage)))}
                            disabled={currentPage === Math.ceil(data.length / itemsPerPage)}
                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                            Próxima
                        </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, data.length)}</span> de <span className="font-medium">{data.length}</span> resultados
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                                >
                                    <span className="sr-only">Anterior</span>
                                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                {/* Page Numbers (Simplified for brevity: 1, current, last) */}
                                {Array.from({ length: Math.min(5, Math.ceil(data.length / itemsPerPage)) }).map((_, idx) => {
                                    // Logic to show a window of pages could be complex, keeping it simple: show first 5 or logic around current
                                    // For now, let's just show previous, current, next + first/last if far?
                                    // Simplest robust solution for short snippet: just prev/next buttons + page info text above.
                                    // But user asked for table pagination... often implies page numbers.
                                    // Let's implement a simple range.
                                    let pageNum = idx + 1;
                                    const totalPages = Math.ceil(data.length / itemsPerPage);

                                    // Shift window if current page > 3
                                    if (totalPages > 5 && currentPage > 3) {
                                        pageNum = currentPage - 2 + idx;
                                    }
                                    if (pageNum > totalPages) return null;

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium
                                                ${currentPage === pageNum
                                                    ? 'z-10 bg-indigo-50 dark:bg-indigo-900 border-indigo-500 text-indigo-600 dark:text-indigo-200'
                                                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(data.length / itemsPerPage)))}
                                    disabled={currentPage === Math.ceil(data.length / itemsPerPage)}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                                >
                                    <span className="sr-only">Próxima</span>
                                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Metricas;

