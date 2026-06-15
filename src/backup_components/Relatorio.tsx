import * as React from 'react';
import { TableRow } from '../types';
import { getSalesChannel } from '../services/ecommerceService';
import { normalizeString } from '../utils/stringUtils';
import { cleanAndParse } from '../utils/numberUtils';
import { storeStyles, defaultStoreStyle } from '../utils/ecommerceUtils';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import StatCard from './common/StatCard';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface RelatorioProps {
    headers: string[];
    data: TableRow[];
}

// Formata um número como moeda brasileira
const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

type ReportType = 'produto' | 'loja';
type SortableProductKeys = 'productName' | 'totalQuantity' | 'totalValue' | 'avgTicket' | 'mmValue' | 'mvfValue';
type SortableStoreKeys = 'storeName' | 'totalOrders' | 'totalItems' | 'totalValue' | 'avgTicket';

export const Relatorio: React.FC<RelatorioProps> = ({ headers, data }) => {
    const [activeReport, setActiveReport] = React.useState<ReportType>('produto');
    const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

    const { nomeHeader, quantidadeHeader, valorUnitarioHeader, idVendaHeader } = React.useMemo(() => {
        const findHeader = (key: string) => headers.find(h => normalizeString(h).includes(key));
        return {
            nomeHeader: findHeader('nome'),
            quantidadeHeader: findHeader('quantidade'),
            valorUnitarioHeader: findHeader('valor unitario'),
            idVendaHeader: findHeader('numero da ordem de compra'),
        };
    }, [headers]);

    const { productReport, storeReport, metrics, top10Products, top10Stores } = React.useMemo(() => {
        if (!nomeHeader || !quantidadeHeader || !valorUnitarioHeader || !idVendaHeader) {
            return { productReport: [], storeReport: [], metrics: { totalValue: 0, totalOrders: 0, totalItems: 0 }, top10Products: [], top10Stores: [] };
        }

        const productAgg: Record<string, { totalQuantity: number; totalValue: number; cnpjs: Record<string, number> }> = {};
        const storeAgg: Record<string, { totalItems: number; totalValue: number; orderIds: Set<string | number> }> = {};
        const allOrderIds = new Set<string | number>();

        data.forEach(row => {
            const quantity = cleanAndParse(row[quantidadeHeader]);
            const unitValue = cleanAndParse(row[valorUnitarioHeader]);
            const totalRowValue = quantity * unitValue;
            const orderId = row[idVendaHeader];
            const cnpj = row.cnpj;
            const storeName = getSalesChannel(String(orderId), cnpj || null);

            // FIX: Argument of type 'string | number | boolean | Record<string, boolean> | TableRow[] | undefined' is not assignable to parameter of type 'string | number'.
            if (orderId) allOrderIds.add(orderId as string | number);

            // Aggregate by Product
            const productName = String(row[nomeHeader] ?? 'Desconhecido');
            if (productName) {
                if (!productAgg[productName]) {
                    productAgg[productName] = { totalQuantity: 0, totalValue: 0, cnpjs: { MM: 0, MVF: 0 } };
                }
                productAgg[productName].totalQuantity += quantity;
                productAgg[productName].totalValue += totalRowValue;
                if (cnpj) {
                    productAgg[productName].cnpjs[cnpj] = (productAgg[productName].cnpjs[cnpj] || 0) + totalRowValue;
                }
            }

            // Aggregate by Store
            if (storeName !== 'N/A') {
                if (!storeAgg[storeName]) {
                    storeAgg[storeName] = { totalItems: 0, totalValue: 0, orderIds: new Set() };
                }
                storeAgg[storeName].totalItems += quantity;
                storeAgg[storeName].totalValue += totalRowValue;
                // FIX: Argument of type 'string | number | boolean | Record<string, boolean> | TableRow[] | undefined' is not assignable to parameter of type 'string | number'.
                if (orderId) storeAgg[storeName].orderIds.add(orderId as string | number);
            }
        });

        const finalProductReport = Object.entries(productAgg).map(([name, data]) => ({
            productName: name,
            totalQuantity: data.totalQuantity,
            totalValue: data.totalValue,
            avgTicket: data.totalQuantity > 0 ? data.totalValue / data.totalQuantity : 0,
            mmValue: data.cnpjs.MM || 0,
            mvfValue: data.cnpjs.MVF || 0,
        }));

        const finalStoreReport = Object.entries(storeAgg).map(([name, data]) => ({
            storeName: name,
            totalOrders: data.orderIds.size,
            totalItems: data.totalItems,
            totalValue: data.totalValue,
            avgTicket: data.orderIds.size > 0 ? data.totalValue / data.orderIds.size : 0,
        }));

        const totalValue = finalStoreReport.reduce((sum, store) => sum + store.totalValue, 0);
        const totalItems = finalStoreReport.reduce((sum, store) => sum + store.totalItems, 0);

        const top10ProductsData = [...finalProductReport].sort((a, b) => b.totalValue - a.totalValue).slice(0, 10);
        const top10StoresData = [...finalStoreReport].sort((a, b) => b.totalValue - a.totalValue).slice(0, 10);

        return {
            productReport: finalProductReport,
            storeReport: finalStoreReport,
            metrics: {
                totalValue,
                totalOrders: allOrderIds.size,
                totalItems,
            },
            top10Products: top10ProductsData,
            top10Stores: top10StoresData
        };

    }, [data, nomeHeader, quantidadeHeader, valorUnitarioHeader, idVendaHeader]);

    const requestSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedProductReport = React.useMemo(() => {
        const sortableData = [...productReport];
        if (sortConfig && activeReport === 'produto') {
            sortableData.sort((a, b) => {
                const key = sortConfig.key as SortableProductKeys;
                const valA = a[key];
                const valB = b[key];

                if (typeof valA === 'number' && typeof valB === 'number') {
                    // FIX: Replaced an unsafe subtraction with a safe conditional comparison to prevent arithmetic errors.
                    const comparison = valA < valB ? -1 : (valA > valB ? 1 : 0);
                    return sortConfig.direction === 'ascending' ? comparison : -comparison;
                }

                const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        return sortableData;
    }, [productReport, sortConfig, activeReport]);

    const sortedStoreReport = React.useMemo(() => {
        const sortableData = [...storeReport];
        if (sortConfig && activeReport === 'loja') {
            sortableData.sort((a, b) => {
                const key = sortConfig.key as SortableStoreKeys;
                const valA = a[key];
                const valB = b[key];

                if (typeof valA === 'number' && typeof valB === 'number') {
                    // FIX: Replaced an unsafe subtraction with a safe conditional comparison to prevent arithmetic errors.
                    const comparison = valA < valB ? -1 : (valA > valB ? 1 : 0);
                    return sortConfig.direction === 'ascending' ? comparison : -comparison;
                }

                const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        return sortableData;
    }, [storeReport, sortConfig, activeReport]);


    const barChartData = React.useMemo(() => {
        const dataSet = activeReport === 'produto' ? top10Products : top10Stores;
        const labels = dataSet.map(item => 'productName' in item ? item.productName : item.storeName);
        const dataValues = dataSet.map(item => item.totalValue);

        return {
            labels,
            datasets: [
                {
                    label: 'Valor Total',
                    data: dataValues,
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                },
            ],
        };
    }, [activeReport, top10Products, top10Stores]);

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y' as const,
        plugins: {
            legend: { display: false },
            title: { display: true, text: `Top 10 por Valor Total` },
        },
    };

    const renderProductTable = () => (
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                    {/* Headers for Product Table */}
                    <th onClick={() => requestSort('productName')} className="cursor-pointer">Produto</th>
                    <th onClick={() => requestSort('totalQuantity')} className="cursor-pointer">Qt. Itens</th>
                    <th onClick={() => requestSort('totalValue')} className="cursor-pointer">Valor Total</th>
                    <th onClick={() => requestSort('avgTicket')} className="cursor-pointer">Ticket Médio</th>
                    <th onClick={() => requestSort('mmValue')} className="cursor-pointer">Valor MM</th>
                    <th onClick={() => requestSort('mvfValue')} className="cursor-pointer">Valor MVF</th>
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800/50 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedProductReport.map((item, index) => (
                    <tr key={index}>
                        <td>{item.productName}</td>
                        <td>{item.totalQuantity}</td>
                        <td>{formatCurrency(item.totalValue)}</td>
                        <td>{formatCurrency(item.avgTicket)}</td>
                        <td>{formatCurrency(item.mmValue)}</td>
                        <td>{formatCurrency(item.mvfValue)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const renderStoreTable = () => (
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                    {/* Headers for Store Table */}
                    <th onClick={() => requestSort('storeName')} className="cursor-pointer">Loja</th>
                    <th onClick={() => requestSort('totalOrders')} className="cursor-pointer">Nº Pedidos</th>
                    <th onClick={() => requestSort('totalItems')} className="cursor-pointer">Qt. Itens</th>
                    <th onClick={() => requestSort('totalValue')} className="cursor-pointer">Valor Total</th>
                    <th onClick={() => requestSort('avgTicket')} className="cursor-pointer">Ticket Médio</th>
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800/50 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedStoreReport.map((item, index) => (
                    <tr key={index}>
                        <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(storeStyles[item.storeName] || defaultStoreStyle).bg} ${(storeStyles[item.storeName] || defaultStoreStyle).text}`}>{item.storeName}</span></td>
                        <td>{item.totalOrders}</td>
                        <td>{item.totalItems}</td>
                        <td>{formatCurrency(item.totalValue)}</td>
                        <td>{formatCurrency(item.avgTicket)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    // FIX: Added return statement for the component's JSX.
    return (
        <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Relatório Gerencial</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard title="Valor Total" value={formatCurrency(metrics.totalValue)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>} />
                <StatCard title="Total de Pedidos" value={metrics.totalOrders.toLocaleString('pt-BR')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>} />
                <StatCard title="Total de Itens" value={metrics.totalItems.toLocaleString('pt-BR')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
            </div>

            <div className="flex justify-center mb-6">
                <div className="flex items-center rounded-lg bg-gray-100 dark:bg-gray-700/50 p-1 border dark:border-gray-600">
                    <button onClick={() => setActiveReport('produto')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeReport === 'produto' ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                        Por Produto
                    </button>
                    <button onClick={() => setActiveReport('loja')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeReport === 'loja' ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                        Por Loja
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                <div className="xl:col-span-2 overflow-x-auto">
                    {activeReport === 'produto' ? renderProductTable() : renderStoreTable()}
                </div>
                <div className="xl:col-span-1 h-[500px] p-4 bg-white dark:bg-gray-800/50 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <Bar options={barChartOptions} data={barChartData} />
                </div>
            </div>
        </div>
    );
};