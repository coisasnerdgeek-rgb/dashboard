import * as React from 'react';
import { TableRow } from '../types';
import { normalizeString } from '../utils/stringUtils';
import { parseSku, getCategory } from '../services/skuService';
import { getSalesChannel } from '../services/ecommerceService';
import { useAppContext } from '../contexts/AppContext';

interface DataTableProps {
  headers: string[];
  data: TableRow[];
  initialFilter?: Record<string, string> | null;
  onFilterApplied?: () => void;
  savedProductNames: Set<string>;
  trackingMappings?: Record<string, string>;
}

// Colunas que o usuário solicitou para filtrar
const FILTERABLE_KEYS = ['data', 'nome', 'situacao', 'quantidade', 'valor unitario', 'numero da ordem de compra', 'sku'];

const formatDate = (dateString: string | number): string => {
  const str = String(dateString);
  if (!str || !str.includes('/')) return str;
  const parts = str.split('/');
  if (parts.length === 3) { // Handles DD/MM/YYYY and others
    return `${parts[0]}/${parts[1]}`;
  }
  return str;
};


const DataTable: React.FC<DataTableProps> = ({ headers, data, initialFilter, onFilterApplied, savedProductNames, trackingMappings }) => {
  const { globalSearchTerm } = useAppContext();
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = React.useState({ canScrollLeft: false, canScrollRight: false });
  const [isTableInView, setIsTableInView] = React.useState(false);

  const dateHeader = React.useMemo(() => headers.find(h => normalizeString(h) === 'data'), [headers]);
  const previstaHeader = React.useMemo(() => headers.find(h => normalizeString(h).includes('data prevista')), [headers]);
  const skuHeader = React.useMemo(() => headers.find(h => normalizeString(h).includes('sku')), [headers]);
  const nomeHeader = React.useMemo(() => headers.find(h => normalizeString(h).includes('nome')), [headers]);
  const idVendaHeader = React.useMemo(() => headers.find(h => normalizeString(h).includes('numero da ordem de compra')), [headers]);

  const headerTitleMap: { [key: string]: string } = {
    'codigo (sku)': 'sku',
    'quantidade': 'qt.',
    'valor unitario': 'Valor',
    'nome do contato': 'Nome',
    'nome': 'Nome',
    'desconto item': 'desconto',
    'desconto do pedido (% ou valor)': 'desconto',
    'numero da ordem de compra': 'ID',
    'numero do pedido': 'ID',
    'data prevista': 'Prevista',
    'tipo de pessoa': 'PJ/PF',
  };

  React.useEffect(() => {
    if (initialFilter) {
      setFilters(initialFilter);
      if (onFilterApplied) {
        onFilterApplied();
      }
    }
  }, [initialFilter, onFilterApplied]);

  const checkScroll = React.useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const buffer = 2; // Helps prevent flickering on some browsers
      const canScrollLeft = el.scrollLeft > buffer;
      const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - buffer;
      if (canScrollLeft !== scrollState.canScrollLeft || canScrollRight !== scrollState.canScrollRight) {
        setScrollState({ canScrollLeft, canScrollRight });
      }
    }
  }, [scrollState.canScrollLeft, scrollState.canScrollRight]);

  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      checkScroll();
      el.addEventListener('scroll', checkScroll, { passive: true });
      const resizeObserver = new ResizeObserver(checkScroll);
      resizeObserver.observe(el);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        resizeObserver.unobserve(el);
      };
    }
  }, [checkScroll, data]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsTableInView(entry.isIntersecting);
      },
      { threshold: 0.1 } // Aparece quando 10% da tabela estiver visível
    );

    const currentEl = scrollContainerRef.current;
    if (currentEl) {
      observer.observe(currentEl);
    }

    return () => {
      if (currentEl) {
        observer.unobserve(currentEl);
      }
    };
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = el.clientWidth * 0.8;
      el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };


  const handleFilterChange = (header: string, value: string) => {
    setFilters(prev => ({ ...prev, [header]: value }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  // Filtra os cabeçalhos para mostrar apenas os que são relevantes para a filtragem
  const availableFilterHeaders = React.useMemo(() => {
    return headers.filter(header =>
      FILTERABLE_KEYS.some(key => normalizeString(header).includes(normalizeString(key)))
    );
  }, [headers]);

  const filteredData = React.useMemo(() => {
    const activeFilters = Object.entries(filters).filter(([, value]) => String(value).trim() !== '');
    const normalizedSearch = normalizeString(globalSearchTerm || '');

    if (activeFilters.length === 0 && !normalizedSearch) {
      return data;
    }
    return data.filter(row => {
      const matchesLocalFilters = activeFilters.every(([header, value]) => {
        const rowValue = row[header];
        return normalizeString(String(rowValue ?? '')).includes(normalizeString(String(value)));
      });
      if (!matchesLocalFilters) return false;

      if (normalizedSearch) {
        const matchesRowContent = Object.values(row).some(val =>
          normalizeString(String(val ?? '')).includes(normalizedSearch)
        );
        if (matchesRowContent) return true;

        if (trackingMappings && idVendaHeader) {
          const orderId = String(row[idVendaHeader] ?? '');
          const trackingCode = trackingMappings[orderId];
          if (trackingCode && normalizeString(trackingCode).includes(normalizedSearch)) {
            return true;
          }
        }
        return false;
      }

      return true;
    });
  }, [data, filters, globalSearchTerm, trackingMappings, idVendaHeader]);

  const hasCnpjColumn = React.useMemo(() => data.some(row => row.cnpj), [data]);

  const displayHeaders = React.useMemo(() => {
    const originalHeaders = [...headers];

    const orderedKeys: string[][] = [
      ['nome'],
      ['sku'],
      ['quantidade'],
      ['valor unitario'],
      ['desconto'],
      ['numero da ordem de compra', 'numero do pedido'],
    ];

    const orderedHeaders: string[] = [];
    const foundHeaders = new Set<string>();

    orderedKeys.forEach(keys => {
      const header = originalHeaders.find(h =>
        !foundHeaders.has(h) && keys.some(k => normalizeString(h).includes(k))
      );
      if (header) {
        orderedHeaders.push(header);
        foundHeaders.add(header);
      }
    });

    const remainingHeaders = originalHeaders.filter(h => !foundHeaders.has(h));
    const finalHeaders = [...orderedHeaders, ...remainingHeaders];

    // User request: swap 'rg/ie' (tipo de pessoa) with 'n pedido'
    const rgIeHeader = finalHeaders.find(h => normalizeString(h).includes('rg/ie') || normalizeString(h).includes('tipo de pessoa'));
    const nPedidoHeader = finalHeaders.find(h => normalizeString(h).includes('numero da ordem de compra') || normalizeString(h).includes('numero do pedido'));

    if (rgIeHeader && nPedidoHeader) {
      const rgIeIndex = finalHeaders.indexOf(rgIeHeader);
      const nPedidoIndex = finalHeaders.indexOf(nPedidoHeader);
      if (rgIeIndex > -1 && nPedidoIndex > -1) {
        // Swap
        [finalHeaders[rgIeIndex], finalHeaders[nPedidoIndex]] = [finalHeaders[nPedidoIndex], finalHeaders[rgIeIndex]];
      }
    }


    if (!hasCnpjColumn) {
      return finalHeaders;
    }

    const insertIndex = finalHeaders.length > 1 ? 2 : 1;
    const newHeadersWithCnpj = [...finalHeaders];
    if (!newHeadersWithCnpj.includes('CNPJ')) {
      newHeadersWithCnpj.splice(insertIndex, 0, 'CNPJ');
    }
    return newHeadersWithCnpj;
  }, [headers, hasCnpjColumn]);

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Uma listagem de todos os registros da sua planilha. Encontrado <span className="font-bold text-primary-600 dark:text-primary-400">{filteredData.length}</span> registros.
        </p>
      </div>

      {/* Filter Section */}
      {availableFilterHeaders.length > 0 && (
        <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border dark:border-gray-700">
          <div className="flex flex-wrap items-end gap-4">
            {availableFilterHeaders.map(header => (
              <div key={header} className="flex-grow min-w-[200px]">
                <label htmlFor={`filter-${header}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {header}
                </label>
                <input
                  type="text"
                  id={`filter-${header}`}
                  value={filters[header] || ''}
                  onChange={e => handleFilterChange(header, e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                  placeholder={`Filtrar por ${header}...`}
                />
              </div>
            ))}
            <button
              onClick={clearFilters}
              className="flex-shrink-0 h-10 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <div className="flow-root">
          <div ref={scrollContainerRef} className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-gray-700 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {displayHeaders.map((header) => (
                        <th
                          key={header}
                          scope="col"
                          className="whitespace-nowrap py-0.5 px-1 text-left text-xs font-semibold text-gray-900 dark:text-gray-100"
                        >
                          {headerTitleMap[normalizeString(header)] || header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800/50">
                    {filteredData.map((row, rowIndex) => {
                      const sku = skuHeader ? String(row[skuHeader] ?? '') : '';
                      const parsedSku = sku ? parseSku(sku) : null;
                      const isRoupa = sku ? getCategory(sku) === 'Roupas' : false;
                      const hasInvalidSku = isRoupa && (!parsedSku || parsedSku.colorName === 'N/A' || !parsedSku.sizeName || parsedSku.sizeName === 'N/A');
                      const productName = parsedSku?.productName;
                      const isSaved = productName ? savedProductNames.has(productName) : false;

                      return (
                        <tr key={rowIndex} className={`transition-colors ${hasInvalidSku
                          ? 'bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60'
                          : isSaved
                            ? 'bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-900/60'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}>
                          {displayHeaders.map((header, colIndex) => {
                            if (header === 'CNPJ') {
                              const cnpj = row.cnpj;
                              const cnpjColor = cnpj === 'MVF' ? 'text-blue-500 font-bold' : cnpj === 'MM' ? 'text-purple-500 font-bold' : '';
                              return (
                                <td key={`${rowIndex}-cnpj`} className="whitespace-nowrap py-0.5 px-1 text-xs">
                                  <span className={cnpjColor}>{cnpj}</span>
                                </td>
                              );
                            }
                            const cellValue = String(row[header] ?? '');
                            let displayValue = (header === dateHeader || header === previstaHeader) ? formatDate(cellValue) : cellValue;
                            if (header === nomeHeader && displayValue.length > 23) {
                              displayValue = `${displayValue.substring(0, 23)}...`;
                            }
                            if (header === skuHeader && displayValue.length > 25) {
                              displayValue = `${displayValue.substring(0, 25)}...`;
                            }

                            const isUpdated = row._updatedFields?.[header];
                            const isIdVendaHeader = idVendaHeader && header === idVendaHeader;

                            // FIX: Explicitly cast row[idVendaHeader] to a string to ensure type compatibility.
                            const storeName = isIdVendaHeader ? getSalesChannel(String(row[idVendaHeader]!), (row.cnpj as 'MM' | 'MVF' | null) || null) : '';
                            const isMLStore = storeName.startsWith('ML');

                            return (
                              <td
                                key={`${rowIndex}-${colIndex}`}
                                className={`whitespace-nowrap py-0.5 px-1 text-xs font-medium ${isUpdated ? 'text-green-500 font-bold' : 'text-gray-800 dark:text-gray-200'}`}
                                title={(header === nomeHeader && cellValue.length > 23) || (header === skuHeader && cellValue.length > 25) ? cellValue : ''}
                              >
                                {isIdVendaHeader && isMLStore ? (
                                  <a
                                    href={`https://www.mercadolivre.com.br/vendas/novo/mensagens/${cellValue}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    {displayValue}
                                  </a>
                                ) : (
                                  displayValue
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        {isTableInView && scrollState.canScrollLeft && (
          <button
            onClick={() => handleScroll('left')}
            className="fixed top-1/2 left-2 sm:left-4 -translate-y-1/2 z-30 bg-white/80 dark:bg-gray-900/80 p-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Rolar para esquerda"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        {isTableInView && scrollState.canScrollRight && (
          <button
            onClick={() => handleScroll('right')}
            className="fixed top-1/2 right-2 sm:right-4 -translate-y-1/2 z-30 bg-white/80 dark:bg-gray-900/80 p-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Rolar para direita"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default DataTable;