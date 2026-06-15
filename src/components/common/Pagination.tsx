import React from 'react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rows: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, rowsPerPage, onPageChange, onRowsPerPageChange }) => {
    if (totalPages <= 1) return null;

    const buttonClasses = "flex items-center justify-center h-8 min-w-[32px] px-1 text-sm font-medium border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const activeClasses = "bg-primary-600 text-white border-primary-600 hover:bg-primary-700";
    const inactiveClasses = "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700";

    const getPageNumbers = () => {
        const delta = 1; // Number of pages to show on each side of current
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i);
            }
        }

        for (let i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    };

    return (
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 mt-4 rounded-lg shadow-sm">
            <div className="flex items-center">
                <p className="text-sm text-gray-700 dark:text-gray-300 mr-4">
                    Linhas por página:
                </p>
                <select
                    value={rowsPerPage}
                    onChange={(e) => {
                        onRowsPerPageChange(Number(e.target.value));
                        onPageChange(1);
                    }}
                    className="block w-20 pl-3 pr-8 py-1.5 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 dark:text-white"
                >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                </select>
            </div>

            <div className="flex gap-1">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`${buttonClasses} ${inactiveClasses} `}
                >
                    &lsaquo;
                </button>

                {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                        <span key={`dots-${index}`} className="flex items-center justify-center h-8 px-2 text-gray-500 dark:text-gray-400">...</span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => onPageChange(page as number)}
                            className={`${buttonClasses} ${currentPage === page ? activeClasses : inactiveClasses} `}
                        >
                            {page}
                        </button>
                    )
                ))}

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`${buttonClasses} ${inactiveClasses} `}
                >
                    &rsaquo;
                </button>
            </div>
        </div>
    );
};
