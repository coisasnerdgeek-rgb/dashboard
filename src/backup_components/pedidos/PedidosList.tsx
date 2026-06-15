import React from 'react';
import { ProcessedTableRow, TableRow } from '../../types';
import { Pagination } from '../common/Pagination';
import { getStatusBadgeClasses, getNewStatusColor, formatCurrency } from './utils';
import { HEADER_TITLE_MAP } from './utils';

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
    getHeaderTitle
}) => {

    const renderCellContent = (row: ProcessedTableRow, header: string) => {
        const val = row[header];

        if (header === 'situacao') {
            const statusClass = getStatusBadgeClasses(String(val));
            return (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
                    {String(val)}
                </span>
            )
        }

        if (header === 'valor unitario' || header === 'valor total') {
            return formatCurrency(Number(val));
        }

        if (header === 'data' || header === 'data maxima de despacho') {
            // Already formatted in ProcessedTableRow usually, or use formatDate from utils if needed.
            // Assuming data is ProcessedTableRow where simple rendering is fine.
            return String(val || '-');
        }

        // Default
        return String(val || '-');
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Mobile / Card View can be implemented here if needed. Focusing on Table first. */}

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-10">
                            </th>
                            {headers.map((header) => (
                                <th
                                    key={header}
                                    scope="col"
                                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors select-none"
                                    onClick={() => requestSort(header)}
                                >
                                    <div className="flex items-center space-x-1">
                                        <span>{getHeaderTitle(header)}</span>
                                        {sortConfig && sortConfig.key === header && (
                                            <span className="text-gray-400">
                                                {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {data.map((row, index) => {
                            const isExpanded = expandedRows.has(row.id as (string | number));
                            // Assuming 'id' exists on ProcessedTableRow via type extension or casting

                            return (
                                <React.Fragment key={row.originalIndex || index}>
                                    <tr
                                        className={`${isExpanded ? 'bg-gray-50 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} transition-colors cursor-pointer`}
                                        onClick={() => onRowClick && onRowClick(row as any)}
                                    >
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleRow(row.id as string | number);
                                                }}
                                                className="text-gray-400 hover:text-gray-600 focus:outline-none"
                                            >
                                                {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                                            </button>
                                        </td>
                                        {headers.map(header => (
                                            <td key={`${row.id}-${header}`} className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                                {renderCellContent(row, header)}
                                            </td>
                                        ))}
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-gray-50 dark:bg-gray-700">
                                            <td colSpan={headers.length + 1} className="px-6 py-4">
                                                <div className="text-sm text-gray-700 dark:text-gray-200">
                                                    {/* Detail View - placeholder for now, mimic original if needed */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <h4 className="font-bold mb-2">Detalhes do Pedido</h4>
                                                            <p><strong>Cliente:</strong> {row['nome']}</p>
                                                            <p><strong>Endereço:</strong> {row['endereco'] || 'N/A'}</p>
                                                            {/* Add more details that are NOT in the columns */}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold mb-2">Produtos</h4>
                                                            {/* If we had a nested list of products, showing here would be great.
                                                                Currently flat structure assumes 1 row = 1 product usually?
                                                                Or 1 row = 1 order?
                                                                If ProcessedTableRow is Order, it might have 'items'.
                                                                If not, this detail view is just extra fields.
                                                             */}
                                                            <p>Produto: {row['produto']}</p>
                                                            <p>SKU: {row['sku']}</p>
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
