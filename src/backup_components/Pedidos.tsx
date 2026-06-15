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
    // If context provides filters, use them. Props `globalFilters` might be redundant or synced.
    // Following existing pattern where Pedidos receives filters via props (likely fro App or Context wrapper)

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
            // Apply Global Filters
            for (const [key, value] of Object.entries(globalFilters)) {
                if (!value || (Array.isArray(value) && value.length === 0)) continue;

                const rowValue = String(row[key] || '').toLowerCase();

                if (Array.isArray(value)) {
                    // Exact match one of the options (e.g. Status)
                    // If filter is 'situacao', values are like 'Pendente', 'Pago'.
                    // Row value might be 'Pendente'.
                    if (!value.some(v => rowValue.includes(v.toLowerCase()))) return false;
                } else {
                    // Text Search or Single Value
                    if (!rowValue.includes(value.toLowerCase())) return false;
                }
            }
            return true;
        });
    }, [data, globalFilters]);

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

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
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
        exportToExcel(filteredData, 'pedidos_export');
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
                data={filteredData} // KPIs reflect filtered data? Or total? Usually filtered.
                activeSummaryTab={activeSummaryTab}
                setActiveSummaryTab={setActiveSummaryTab}
                globalFilters={globalFilters}
                onCardClick={(header, value) => {
                    // Generic filter toggle
                    const current = globalFilters[header];
                    let newVal: string[] = [];
                    if (Array.isArray(current)) {
                        if (current.includes(value)) newVal = current.filter(v => v !== value);
                        else newVal = [...current, value];
                    } else {
                        newVal = current === value ? [] : [value];
                    }
                    onFiltersChange({ ...globalFilters, [header]: newVal });
                }}
                getHeaderKey={getHeaderKey}
                situacaoHeader="situacao" // Assuming 'situacao' is the key in data
            />

            <PedidosFilterBar
                globalFilters={globalFilters}
                onFilterChange={(key, val) => onFiltersChange({ ...globalFilters, [key]: val })}
                onSync={handleSync}
                onExport={handleExport}
                isSyncing={isSyncing}
                totalRecords={filteredData.length}
                // lastUpdated passed if available props
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
            />
        </div>
    );
};
