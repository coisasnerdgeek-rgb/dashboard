import * as React from 'react';

const range = (start: number, end: number) => {
    const length = end - start + 1;
    return Array.from({ length }, (_, idx) => idx + start);
};

const getPaginationItems = (totalPages: number, currentPage: number, pageNeighbours: number = 1): (string | number)[] => {
    const totalNumbers = pageNeighbours * 2 + 3;
    const totalBlocks = totalNumbers + 2;

    if (totalPages > totalBlocks) {
        const startPage = Math.max(2, currentPage - pageNeighbours);
        const endPage = Math.min(totalPages - 1, currentPage + pageNeighbours);
        let pages: (string | number)[] = range(startPage, endPage);

        const hasLeftSpill = startPage > 2;
        const hasRightSpill = (totalPages - endPage) > 1;
        const spillOffset = totalNumbers - (pages.length + 1);

        switch (true) {
            case (hasLeftSpill && !hasRightSpill): {
                const extraPages = range(startPage - spillOffset, startPage - 1);
                pages = ['...', ...extraPages, ...pages];
                break;
            }
            case (!hasLeftSpill && hasRightSpill): {
                const extraPages = range(endPage + 1, endPage + spillOffset);
                pages = [...pages, ...extraPages, '...'];
                break;
            }
            case (hasLeftSpill && hasRightSpill):
            default: {
                pages = ['...', ...pages, '...'];
                break;
            }
        }
        return [1, ...pages, totalPages];
    }
    return range(1, totalPages);
};

interface PaginationControlsProps {
    totalResults: number;
    rowsPerPage: number;
    setRowsPerPage: (value: number) => void;
    currentPage: number;
    // FIX: Updated the type definition for setCurrentPage to accept a function for state updates.
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    totalPages: number;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
    totalResults,
    rowsPerPage,
    setRowsPerPage,
    currentPage,
    setCurrentPage,
    totalPages,
}) => {
    if (totalPages <= 1) return null;

    const paginationRange = getPaginationItems(totalPages, currentPage, 1);

    const buttonClasses = "flex items-center justify-center h-9 w-9 text-gray-600 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-2";
    const activeClasses = "bg-primary-600 border-primary-600 text-white dark:bg-primary-500 dark:border-primary-500";
    
    return (
        <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-800 dark:text-gray-200">{totalResults.toLocaleString('pt-BR')}</span> resultados
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                    <label htmlFor="rows-per-page" className="text-gray-600 dark:text-gray-400">Linhas:</label>
                    <select
                        id="rows-per-page"
                        value={rowsPerPage}
                        onChange={(e) => setRowsPerPage(Number(e.target.value))}
                        className="h-9 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md pl-2 pr-7 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    >
                        {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                </div>
                
                <nav className="flex items-center gap-1" aria-label="Paginação">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className={buttonClasses} aria-label="Primeira página">&laquo;</button>
                    {/* FIX: Add explicit type annotation to `setCurrentPage` callback parameter to resolve `any` type error. */}
                    <button onClick={() => setCurrentPage((p: number) => p - 1)} disabled={currentPage === 1} className={buttonClasses} aria-label="Página anterior">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </button>

                    {paginationRange.map((page, index) => {
                        if (typeof page === 'string') {
                            return <span key={`${page}-${index}`} className="flex items-center justify-center h-9 w-9 text-gray-500">...</span>;
                        }
                        return (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`${buttonClasses} ${currentPage === page ? activeClasses : ''}`}
                                aria-current={currentPage === page ? 'page' : undefined}
                            >
                                {page}
                            </button>
                        );
                    })}
                    
                    {/* FIX: Add explicit type annotation to `setCurrentPage` callback parameter to resolve `any` type error. */}
                    <button onClick={() => setCurrentPage((p: number) => p + 1)} disabled={currentPage === totalPages} className={buttonClasses} aria-label="Próxima página">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    </button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className={buttonClasses} aria-label="Última página">&raquo;</button>
                </nav>
            </div>
        </div>
    );
};

export default PaginationControls;
