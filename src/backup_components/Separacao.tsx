import * as React from 'react';
import Picking from './Picking';
import PickingRoupas from './PickingRoupas';
import { TableRow } from '../types';
import SeparacaoDashboard from './SeparacaoDashboard';

interface PickingProps {
    headers: string[];
    data: TableRow[];
    onRowClick: (row: TableRow) => void;
    trackingMappings: Record<string, string>;
    imageMappings: Record<string, string>;
}

interface PickingRoupasProps {
    headers: string[];
    data: TableRow[];
    onRowClick: (row: TableRow) => void;
    trackingMappings: Record<string, string>;
    imageMappings: Record<string, string>;
}

interface SeparacaoProps {
    pickingProps: PickingProps;
    pickingRoupasProps: PickingRoupasProps;
    pendingRoupasCount: number;
    pendingCasesCount: number;
    activeTab?: 'dashboard' | 'roupas' | 'capinhas';
    globalSearchTerm?: string;
}

const Separacao: React.FC<SeparacaoProps> = ({ pickingProps, pickingRoupasProps, pendingRoupasCount, pendingCasesCount, activeTab }) => {
    const [activeView, setActiveView] = React.useState<'dashboard' | 'roupas' | 'capinhas'>('dashboard');

    React.useEffect(() => {
        const savedTab = localStorage.getItem('separacao_activeTab');
        if (savedTab && (savedTab === 'dashboard' || savedTab === 'roupas' || savedTab === 'capinhas')) {
            setActiveView(savedTab);
            localStorage.removeItem('separacao_activeTab');
        } else if (activeTab) {
            setActiveView(activeTab);
        }
    }, [activeTab]);

    return (
        <div className="animate-fade-in-scale">
            <div className="flex justify-center mb-6">
                <div className="flex items-center rounded-lg bg-gray-100 dark:bg-gray-700/50 p-1 border dark:border-gray-600">
                    <button
                        onClick={() => setActiveView('dashboard')}
                        className={`relative px-6 py-2 text-sm font-medium rounded-md transition-colors ${activeView === 'dashboard' ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveView('roupas')}
                        className={`relative px-6 py-2 text-sm font-medium rounded-md transition-colors ${activeView === 'roupas' ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                        Roupas
                        {pendingRoupasCount > 0 && (
                            <span className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full bg-indigo-500 text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800">
                                {pendingRoupasCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveView('capinhas')}
                        className={`relative px-6 py-2 text-sm font-medium rounded-md transition-colors ${activeView === 'capinhas' ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                        Capinhas
                        {pendingCasesCount > 0 && (
                            <span className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full bg-cyan-500 text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800">
                                {pendingCasesCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>
            {activeView === 'dashboard' && <SeparacaoDashboard headers={pickingProps.headers} data={pickingProps.data} />}
            {activeView === 'roupas' && <PickingRoupas {...pickingRoupasProps} />}
            {activeView === 'capinhas' && <Picking {...pickingProps} />}
        </div>
    );
};

export default Separacao;
