import * as React from 'react';
import { PaymentItem } from '../types';
import StatCard from './common/StatCard';
import PagamentoDashboard from './PagamentoDashboard';
import { useAppContext } from '../contexts/AppContext';

interface PagamentoProps {
    pendingPayments: PaymentItem[];
    archivedPayments: PaymentItem[];
    onMultiplePaymentUpdate: (updatedItems: PaymentItem[]) => void;
    showModal: (
        type: 'alert' | 'confirm',
        title: string,
        message: string | React.ReactNode,
        onConfirm?: () => void,
        options?: {
            confirmText?: string;
            cancelText?: string;
        }
    ) => void;
    activeTab?: 'dashboard' | 'lista';
    onOpenDriveSelection: (callback: (url: string) => void) => void;
}

type CnpjFilterMode = 'AMBOS_SEPARADOS' | 'AMBOS_UNIDOS' | 'MM' | 'MVF';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    // Fix: Handle timezone offset effectively by treating YYYY-MM-DD as UTC or append time
    // But simplest for display:
    const date = new Date(dateString);
    // Adjust for timezone offset if needed (optional based on logic, but simple format usually works)
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return new Intl.DateTimeFormat('pt-BR').format(date);
};

const getStatusBadgeClasses = (status: string) => {
    switch (status) {
        case 'paid':
            return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        case 'partially_paid':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        case 'pending':
        default:
            return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
};

export const Pagamento: React.FC<PagamentoProps> = ({ pendingPayments, archivedPayments, onMultiplePaymentUpdate, showModal, activeTab: propActiveTab, onOpenDriveSelection }) => {
    const { globalSearchTerm } = useAppContext();
    const [activeTab, setActiveTab] = React.useState<'dashboard' | 'lista'>('dashboard');
    const [modalGroup, setModalGroup] = React.useState<{ store: string; cnpj: string; date: string; items: PaymentItem[] } | null>(null);
    const [paymentAmount, setPaymentAmount] = React.useState<string>('');
    const [observationText, setObservationText] = React.useState<string>('');
    const [proofUrl, setProofUrl] = React.useState<string>(''); // Novo estado para comprovante
    const [error, setError] = React.useState<string>('');
    const [cnpjFilterMode, setCnpjFilterMode] = React.useState<CnpjFilterMode>('AMBOS_SEPARADOS');

    // Sync activeTab prop with state
    React.useEffect(() => {
        if (propActiveTab && (propActiveTab === 'dashboard' || propActiveTab === 'lista')) {
            setActiveTab(propActiveTab);
        }
    }, [propActiveTab]);

    // Read activeTab from localStorage (fallback/initial load)
    React.useEffect(() => {
        const savedTab = localStorage.getItem('pagamento_activeTab');
        if (savedTab && (savedTab === 'dashboard' || savedTab === 'lista')) {
            setActiveTab(savedTab);
            localStorage.removeItem('pagamento_activeTab');
        }
    }, []);

    const hasMultipleCnpjs = React.useMemo(() => new Set(pendingPayments.map(o => o.cnpj)).size > 1, [pendingPayments]);

    const groupedByStoreCnpjAndDate = React.useMemo(() => {
        const groups: Record<string, Record<string, Record<string, PaymentItem[]>>> = {};

        let filteredPayments = pendingPayments.filter(item => {
            if (cnpjFilterMode === 'MM' || cnpjFilterMode === 'MVF') {
                return item.cnpj === cnpjFilterMode;
            }
            return true;
        });

        // Apply global search filter
        if (globalSearchTerm) {
            const search = globalSearchTerm.toLowerCase();
            filteredPayments = filteredPayments.filter(item =>
                String(item.product || '').toLowerCase().includes(search) ||
                String(item.store || '').toLowerCase().includes(search) ||
                String(item.totalValue || '').includes(search)
            );
        }

        filteredPayments.forEach(item => {
            const dateKey = new Date(item.sentDate).toISOString().split('T')[0];
            const cnpjKey = cnpjFilterMode === 'AMBOS_UNIDOS' ? 'Ambos Unidos' : item.cnpj;

            if (!groups[item.store]) groups[item.store] = {};
            if (!groups[item.store][cnpjKey]) groups[item.store][cnpjKey] = {};
            if (!groups[item.store][cnpjKey][dateKey]) groups[item.store][cnpjKey][dateKey] = [];

            groups[item.store][cnpjKey][dateKey].push(item);
        });
        return groups;
    }, [pendingPayments, cnpjFilterMode, globalSearchTerm]);

    const handleOpenModal = (store: string, cnpj: string, date: string, items: PaymentItem[]) => {
        setModalGroup({ store, cnpj, date, items });
        setPaymentAmount('');
        setObservationText(items[0]?.observation || '');
        setProofUrl('');
        setError('');
    };

    const handlePayStoreTotal = (store: string) => {
        const itemsToPay = pendingPayments.filter(p => p.store === store);
        if (itemsToPay.length === 0) return;

        const totalToPay = itemsToPay.reduce((sum: number, item: PaymentItem) => sum + (item.totalValue - item.amountPaid), 0);

        showModal(
            'confirm',
            'Confirmar Pagamento Total',
            `Você tem certeza que deseja quitar todos os ${itemsToPay.length} pagamentos pendentes para a loja ${store}, no valor total de ${formatCurrency(totalToPay)}?`,
            () => { // onConfirm
                const updatedItems: PaymentItem[] = itemsToPay.map(item => {
                    const amountToPay = item.totalValue - item.amountPaid;
                    if (amountToPay <= 0) return item;

                    const newPaymentRecord = {
                        date: new Date().toISOString(),
                        amount: amountToPay
                    };

                    return {
                        ...item,
                        amountPaid: item.totalValue,
                        status: 'paid',
                        paymentHistory: [...item.paymentHistory, newPaymentRecord]
                    };
                });
                onMultiplePaymentUpdate(updatedItems);
            },
            { confirmText: 'Confirmar Pagamento' }
        );
    };


    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, "");
        const numberValue = Number(value) / 100;
        const formatted = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(numberValue);
        setPaymentAmount(formatted);
    };

    const handleCloseModal = () => setModalGroup(null);

    const handleRegisterPayment = () => {
        if (!modalGroup) return;

        // Parse formatted string: remove everything except digits, divide by 100
        const numericString = paymentAmount.replace(/[^\d]/g, '');
        let paymentToApply = parseFloat(numericString) / 100;

        if (isNaN(paymentToApply)) paymentToApply = 0;

        const groupItems = modalGroup.items as PaymentItem[];
        const groupPendingValue = groupItems.reduce((sum: number, item: PaymentItem) => sum + (item.totalValue - item.amountPaid), 0);

        // Tolerance for float errors
        if (paymentToApply <= 0 || paymentToApply > groupPendingValue + 0.01) {
            setError(`Valor inválido. Deve ser entre R$ 0,01 e ${formatCurrency(groupPendingValue)}.`);
            return;
        }

        const updatedItems: PaymentItem[] = [];
        const newPaymentRecord = paymentToApply > 0 ? { date: new Date().toISOString(), amount: paymentToApply, proofUrl: proofUrl || undefined } : null;

        for (const item of groupItems) {
            // ... (rest of logic)
            if (paymentToApply <= 0) {
                if (item.observation !== observationText) {
                    updatedItems.push({ ...item, observation: observationText });
                }
                continue;
            }

            const itemPending = item.totalValue - item.amountPaid;
            const amountToPayOnThisItem = Math.min(paymentToApply, itemPending);

            const newAmountPaid = item.amountPaid + amountToPayOnThisItem;
            const isFullyPaid = Math.abs(newAmountPaid - item.totalValue) < 0.01; // Safer float comparison

            const updatedItem: PaymentItem = {
                ...item,
                amountPaid: newAmountPaid,
                status: isFullyPaid ? 'paid' : 'partially_paid',
                observation: observationText,
                paymentHistory: newPaymentRecord ? [...item.paymentHistory, { ...newPaymentRecord, amount: amountToPayOnThisItem }] : item.paymentHistory,
            };
            updatedItems.push(updatedItem);

            paymentToApply -= amountToPayOnThisItem;
        }

        if (updatedItems.length > 0) {
            onMultiplePaymentUpdate(updatedItems);
        }

        handleCloseModal();
    };

    const handleRevertPayment = (item: PaymentItem) => {
        showModal('confirm', 'Desfazer Pagamento', `Tem certeza que deseja desfazer o último pagamento de ${item.product}? O item voltará para Pendente.`, () => {
            const lastPayment = item.paymentHistory[item.paymentHistory.length - 1];
            if (!lastPayment) return;

            const newHistory = item.paymentHistory.slice(0, -1);
            const newAmountPaid = item.amountPaid - lastPayment.amount;

            // Ensure we don't go below zero due to float errors
            const safeAmountPaid = Math.max(0, newAmountPaid);

            const updatedItem: PaymentItem = {
                ...item,
                amountPaid: safeAmountPaid,
                status: safeAmountPaid < item.totalValue - 0.01 ? (safeAmountPaid > 0 ? 'partially_paid' : 'pending') : 'paid',
                paymentHistory: newHistory
            };

            onMultiplePaymentUpdate([updatedItem]);
        });
    };

    const renderListaPagamentos = () => (
        <div className="animate-fade-in-scale">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Controle de Pagamentos</h1>
                {hasMultipleCnpjs && (
                    <div>
                        <label htmlFor="cnpj-filter-pagamento" className="sr-only">Filtrar por CNPJ</label>
                        <select
                            id="cnpj-filter-pagamento"
                            value={cnpjFilterMode}
                            onChange={e => setCnpjFilterMode(e.target.value as CnpjFilterMode)}
                            className="block w-full sm:w-auto pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                        >
                            <option value="AMBOS_SEPARADOS">Ambos (Separados)</option>
                            <option value="AMBOS_UNIDOS">Ambos (Unidos)</option>
                            <option value="MM">Apenas MM</option>
                            <option value="MVF">Apenas MVF</option>
                        </select>
                    </div>
                )}
            </div>

            <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Pagamentos Pendentes por Loja</h2>
                <div className="space-y-4">
                    {Object.entries(groupedByStoreCnpjAndDate).map(([store, cnpjs]) => (
                        <details key={store} className="bg-white dark:bg-gray-800/50 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700" open>
                            <summary className="p-4 font-semibold text-lg cursor-pointer flex justify-between items-center list-none group">
                                <div className="flex items-center gap-4">
                                    <span>{store}</span>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handlePayStoreTotal(store);
                                        }}
                                        className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-75"
                                    >
                                        Pagar Total da Loja
                                    </button>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                            </summary>
                            <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    {Object.entries(cnpjs).map(([cnpj, dates]) => (
                                        <details key={cnpj} className="bg-gray-50 dark:bg-gray-800 rounded-md border dark:border-gray-600" open>
                                            <summary className="p-3 font-semibold cursor-pointer flex justify-between items-center list-none group">
                                                {cnpj === 'Ambos Unidos' ? (
                                                    <span className="font-semibold px-2 py-1 rounded-full text-sm bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100">{cnpj}</span>
                                                ) : (
                                                    <span className={`font-semibold px-2 py-1 rounded-full text-sm ${cnpj === 'MM' ? 'bg-purple-200 text-purple-800 dark:bg-purple-700 dark:text-purple-100' : 'bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-100'}`}>{cnpj}</span>
                                                )}
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                            </summary>
                                            <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                                                {Object.entries(dates).map(([date, items]: [string, PaymentItem[]]) => {
                                                    const groupTotal = items.reduce((sum, item) => sum + item.totalValue, 0);
                                                    const groupPaid = items.reduce((sum, item) => sum + item.amountPaid, 0);
                                                    const groupPending = groupTotal - groupPaid;
                                                    return (
                                                        <div key={date} className="border rounded-md bg-white dark:bg-gray-900/50">
                                                            <div className="p-3 flex justify-between items-center rounded-t-md">
                                                                <h4 className="font-bold">{formatDate(date)}</h4>
                                                                <div className="flex items-center gap-4 text-xs">
                                                                    <span>Total: <span className="font-semibold">{formatCurrency(groupTotal)}</span></span>
                                                                    <span>Pago: <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(groupPaid)}</span></span>
                                                                    <span>Pendente: <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(groupPending)}</span></span>
                                                                    <button onClick={() => handleOpenModal(store, cnpj, date, items)} className="px-3 py-1 bg-primary-600 text-white text-xs font-semibold rounded-md hover:bg-primary-700">
                                                                        Editar / Pagar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="overflow-x-auto border-t dark:border-gray-700">
                                                                <table className="min-w-full text-sm">
                                                                    <thead className="bg-gray-100 dark:bg-gray-800">
                                                                        <tr>
                                                                            <th className="py-1 px-2 text-left font-medium text-gray-600 dark:text-gray-400">Produto</th>
                                                                            <th className="py-1 px-2 text-right font-medium text-gray-600 dark:text-gray-400">Valor Total</th>
                                                                            <th className="py-1 px-2 text-right font-medium text-gray-600 dark:text-gray-400">Pago</th>
                                                                            <th className="py-1 px-2 text-right font-medium text-gray-600 dark:text-gray-400">Pendente</th>
                                                                            <th className="py-1 px-2 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                                                        {items.map(item => (
                                                                            <tr key={item.id}>
                                                                                <td className="px-2 py-1.5 whitespace-nowrap">{item.product}</td>
                                                                                <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono">{formatCurrency(item.totalValue)}</td>
                                                                                <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono text-green-600 dark:text-green-400">{formatCurrency(item.amountPaid)}</td>
                                                                                <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono text-red-600 dark:text-red-400">{formatCurrency(item.totalValue - item.amountPaid)}</td>
                                                                                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClasses(item.status)}`}>
                                                                                        {item.status === 'partially_paid' ? 'Parcial' : 'Pendente'}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </div>
                        </details>
                    ))}
                </div>
            </div>

            <details className="mt-10 group">
                <summary className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 cursor-pointer list-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    Histórico de Pagamentos Concluídos ({archivedPayments.length})
                </summary>
                <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 dark:ring-gray-700 sm:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="py-2 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Data Pag.</th>
                                <th className="py-2 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Loja</th>
                                <th className="py-2 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">CNPJ</th>
                                <th className="py-2 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Produto</th>
                                <th className="py-2 px-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Valor Total</th>
                                <th className="py-2 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Observação</th>
                                <th className="py-2 px-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">Anexo</th>
                                <th className="py-2 px-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800/50">
                            {archivedPayments.map(item => {
                                const lastHistory = item.paymentHistory[item.paymentHistory.length - 1];
                                const proof = lastHistory?.proofUrl;

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 opacity-70">
                                        <td className="whitespace-nowrap py-2 px-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(lastHistory?.date || item.sentDate)}</td>
                                        <td className="whitespace-nowrap py-2 px-3 text-sm text-gray-700 dark:text-gray-300">{item.store}</td>
                                        <td className="whitespace-nowrap py-2 px-3 text-sm text-gray-700 dark:text-gray-300">{item.cnpj}</td>
                                        <td className="whitespace-nowrap py-2 px-3 text-sm text-gray-700 dark:text-gray-300">{item.product}</td>
                                        <td className="whitespace-nowrap py-2 px-3 text-sm text-gray-700 dark:text-gray-300 text-right">{formatCurrency(item.totalValue)}</td>
                                        <td className="whitespace-nowrap py-2 px-3 text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs" title={item.observation}>{item.observation}</td>
                                        <td className="whitespace-nowrap py-2 px-3 text-sm text-center">
                                            {proof ? (
                                                <a href={proof} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title="Ver Comprovante">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                                </a>
                                            ) : <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="whitespace-nowrap py-2 px-3 text-right text-sm">
                                            <button onClick={() => handleRevertPayment(item)} className="text-red-600 hover:text-red-800 flex items-center justify-end gap-1 ml-auto text-xs font-semibold uppercase">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                                Desfazer
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    );

    return (
        <div className="animate-fade-in-scale">
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'dashboard' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('lista')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'lista' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'}`}
                    >
                        Lista de Pagamentos
                    </button>
                </nav>
            </div>

            {activeTab === 'dashboard' ? (
                <PagamentoDashboard pendingPayments={pendingPayments} archivedPayments={archivedPayments} />
            ) : (
                renderListaPagamentos()
            )}

            {modalGroup && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4" onClick={handleCloseModal}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Registrar Pagamento para {modalGroup.store}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Data: {formatDate(modalGroup.date)} | CNPJ: {modalGroup.cnpj}</p>
                            </div>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label htmlFor="payment-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Valor a Pagar</label>
                                <input id="payment-amount" type="text" value={paymentAmount} onChange={handleAmountChange}
                                    placeholder="R$ 0,00"
                                    className="mt-1 w-full p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Valor pendente para este grupo: {formatCurrency(modalGroup.items.reduce((sum, item) => sum + (item.totalValue - item.amountPaid), 0))}</p>
                            </div>
                            <div>
                                <label htmlFor="observation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Observação</label>
                                <textarea id="observation" value={observationText} onChange={e => setObservationText(e.target.value)}
                                    rows={2}
                                    className="mt-1 w-full p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comprovante (Link / Drive)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={proofUrl}
                                        onChange={e => setProofUrl(e.target.value)}
                                        placeholder="Cole o link ou selecione do Drive"
                                        className="flex-1 p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                    />
                                    <button
                                        onClick={() => onOpenDriveSelection((url) => setProofUrl(url))}
                                        className="px-3 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 flex items-center gap-1 text-sm font-medium"
                                        title="Selecionar do Google Drive"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                                        Drive
                                    </button>
                                </div>
                            </div>
                            {error && <p className="text-red-500 text-sm">{error}</p>}
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex justify-end gap-3">
                            <button onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-sm font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                            <button onClick={handleRegisterPayment} className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-md hover:bg-primary-700">Registrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};