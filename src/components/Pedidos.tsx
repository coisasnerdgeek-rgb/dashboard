import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { TableRow, ProcessedTableRow } from '../types';
import { PedidosKPIs } from './pedidos/PedidosKPIs';
import { PedidosFilterBar } from './pedidos/PedidosFilterBar';
import { PedidosList } from './pedidos/PedidosList';
import { HEADER_TITLE_MAP, PEDIDOS_KEYS } from './pedidos/utils';
import { useAppContext } from '../contexts/AppContext';

// Imports de Serviço e Utils mantidos se necessários
import { updateSpreadsheetRow } from '../services/supabaseService';
import { exportToExcel } from '../utils/exportToExcel';

interface PedidosProps {
    headers: string[]; // Recebe headers brutos, mas usaremos PEDIDOS_KEYS preferencialmente para display
    data: ProcessedTableRow[];
    globalFilters: Record<string, string | string[]>;
    onFiltersChange: (filters: Record<string, string | string[]>) => void;
    onFilteredDataChange: (filteredData: TableRow[]) => void;
    onRowClick?: (row: TableRow) => void;
    imageMappings: Record<string, string>;
    showModal: (type: 'alert' | 'confirm', title: string, message: string | React.ReactNode, onConfirm?: () => void, options?: { maxWidth?: string, confirmText?: string }) => void;
    trackingMappings: Record<string, string>;
}

export const Pedidos: React.FC<PedidosProps> = ({
    headers,
    data,
    globalFilters,
    onFiltersChange,
    onFilteredDataChange,
    onRowClick,
    imageMappings,
    showModal,
    trackingMappings
}) => {
    // --- Context Defaults ---
    const { dateRange, selectedCnpj } = useAppContext();


    // --- State ---
    const [activeSummaryTab, setActiveSummaryTab] = useState<'status' | 'categoria'>('status');
    const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // Pagination (Local)
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    // --- Helpers ---
    const getHeaderTitle = (key: string) => HEADER_TITLE_MAP[key.toLowerCase()] || key;
    const getHeaderKey = (title: string) => Object.keys(HEADER_TITLE_MAP).find(k => HEADER_TITLE_MAP[k] === title);

    // --- Filtering Logic (Local Refinement or rely on Props?) ---
    // The props say `data` is `ProcessedTableRow[]`. usually this is ALL data.
    // If `globalFilters` are passed, we must apply them HERE if the parent doesn't.
    // Check original `Pedidos.tsx`: it seemed to apply filters inside `filteredData` memo.

    const filteredData = useMemo(() => {
        return data.filter(row => {
            // Apply Global Filters (Text Search)
            for (const [key, value] of Object.entries(globalFilters)) {
                // Ignore empty or internal metadata filters
                if (!value || key.startsWith('_')) continue;
                if (Array.isArray(value) && value.length === 0) continue;

                const rowValue = String(row[key] || '').toLowerCase();

                if (Array.isArray(value)) {
                    // Exact match one of the options
                    if (!value.some(v => rowValue.includes(String(v).toLowerCase()))) return false;
                } else {
                    // Text Search
                    if (!rowValue.includes(String(value).toLowerCase())) return false;
                }
            }

            // Apply Context Filters (Date & CNPJ) - STRICT ENFORCEMENT

            // 1. CNPJ Filter
            if (selectedCnpj && selectedCnpj !== 'Todos') {
                const rowCnpj = String(row['cnpj'] || '').toUpperCase();
                const filterCnpj = selectedCnpj.toUpperCase();
                // Handle "Ambos" cases if applicable, but usually strict match
                if (rowCnpj !== filterCnpj && rowCnpj !== 'AMBOS') return false;
            }

            // 2. Date Range Filter
            if (dateRange && (dateRange.start || dateRange.end)) {
                // Find date column - usually 'Data' or 'data'
                const dateVal = String(row['Data'] || row['data'] || row['Data Venda'] || '').trim();
                if (dateVal) {
                    // Parse DD/MM/YYYY
                    const parts = dateVal.split('/');
                    if (parts.length === 3) {
                        const [d, m, y] = parts.map(Number);
                        const rowDate = new Date(y, m - 1, d);
                        rowDate.setHours(0, 0, 0, 0);

                        if (dateRange.start) {
                            const start = new Date(dateRange.start);
                            start.setHours(0, 0, 0, 0);
                            if (rowDate < start) return false;
                        }
                        if (dateRange.end) {
                            const end = new Date(dateRange.end);
                            end.setHours(23, 59, 59, 999);
                            if (rowDate > end) return false;
                        }
                    }
                }
            }

            return true;
        });
    }, [data, globalFilters, dateRange, selectedCnpj]);

    // Notify parent of filtered change
    useEffect(() => {
        onFilteredDataChange(filteredData);
    }, [filteredData, onFilteredDataChange]);

    // --- Sorting ---
    const sortedData = useMemo(() => {
        let sortableItems = [...filteredData];
        if (sortConfig) {
            sortableItems.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];

                // 1. Date Sorting (DD/MM/YYYY)
                const isDateColumn = (key: string) => {
                    const k = key.toLowerCase();
                    return k === 'data' || k.includes('data') || k.includes('prevista') || k.includes('prazo') || k.includes('deadline');
                };

                if (isDateColumn(sortConfig.key)) {
                    const parseDate = (d: any) => {
                        if (!d || typeof d !== 'string') return 0;
                        if (d.includes('/')) {
                            const parts = d.split('/');
                            if (parts.length === 3) {
                                // DD/MM/YYYY
                                return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
                            }
                            if (parts.length === 2) {
                                // DD/MM (Assume current year or handle appropriately)
                                return new Date(new Date().getFullYear(), Number(parts[1]) - 1, Number(parts[0])).getTime();
                            }
                        }
                        // Try standard parse
                        return new Date(d).getTime() || 0;
                    };

                    const da = parseDate(aVal);
                    const db = parseDate(bVal);
                    if (da !== db) {
                        return sortConfig.direction === 'asc' ? da - db : db - da;
                    }
                }

                // 2. Numeric Sorting
                const isNumeric = (n: any) => !isNaN(parseFloat(n)) && isFinite(n);
                if (isNumeric(aVal) && isNumeric(bVal)) {
                    const na = parseFloat(aVal);
                    const nb = parseFloat(bVal);
                    if (na !== nb) {
                        return sortConfig.direction === 'asc' ? na - nb : nb - na;
                    }
                }

                // 3. String Sorting (Default)
                const safeA = String(aVal || '').toLowerCase();
                const safeB = String(bVal || '').toLowerCase();

                if (safeA < safeB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (safeA > safeB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredData, sortConfig]);

    // --- Pagination ---
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return sortedData.slice(start, start + rowsPerPage);
    }, [sortedData, currentPage, rowsPerPage]);

    // Reset pagination
    useEffect(() => {
        setCurrentPage(1);
    }, [globalFilters, sortConfig]);


    // --- Handlers ---

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleSync = async () => {
        setIsSyncing(true);
        // Simulate or call actual sync prop if available. 
        // Original had 'handleSyncToDatabase' inside.
        // If logic was complex, we might need a Service for it.
        // For now, toast mock.
        setTimeout(() => {
            setIsSyncing(false);
            toast.success('Sincronização simulada (lógica a migrar)');
        }, 2000);
    };

    const handleExport = () => {
        exportToExcel(filteredData);
    };

    const toggleRow = (id: string | number) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedRows(newSet);
    };

    return (
        <div className="flex flex-col gap-6">
            <PedidosKPIs
                data={filteredData}
                globalFilters={globalFilters}
                onFiltersChange={onFiltersChange}
                situacaoHeader="situacao"
            />

            <PedidosFilterBar
                globalFilters={globalFilters}
                onFilterChange={(key, val) => onFiltersChange({ ...globalFilters, [key]: val })}
                onSync={handleSync}
                onExport={handleExport}
                isSyncing={isSyncing}
                totalRecords={filteredData.length}
                getHeaderKey={getHeaderKey}
            />

            <PedidosList
                data={paginatedData}
                headers={PEDIDOS_KEYS} // Use subset of keys or 'headers' prop? PEDIDOS_KEYS is derived safe list.
                onRowClick={onRowClick}
                onToggleRow={toggleRow}
                expandedRows={expandedRows}
                sortConfig={sortConfig}
                requestSort={handleSort}
                currentPage={currentPage}
                totalPages={Math.ceil(filteredData.length / rowsPerPage)}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={setRowsPerPage}
                getHeaderTitle={getHeaderTitle}
                imageMappings={imageMappings}
            />
        </div>
    );
};
