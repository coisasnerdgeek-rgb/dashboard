import * as React from 'react';
import { View } from '../App';

interface ViewSwitcherProps {
    currentView: View;
    setCurrentView: (view: View, subView?: string) => void;
    savedOrdersCount: number;
    availableOrdersCount: number;
    isDataLoaded: boolean;
    fazerArteCount: number;
    invalidSkuCount: number;
    pendingVerificationCount: number;
    pendingCasesCount: number;
    pendingRoupasCount: number;
    backorderedItemsCount: number;
    onSubViewChange?: (subView: string) => void;
}

interface SubMenuItem {
    label: string;
    tab: string;
}

interface NavItem {
    id: View;
    label: string;
    icon: React.ReactElement;
    count?: number;
    badgeColor?: string;
    subMenus?: SubMenuItem[];
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
    currentView,
    setCurrentView,
    savedOrdersCount,
    availableOrdersCount,
    isDataLoaded,
    fazerArteCount,
    invalidSkuCount,
    pendingVerificationCount,
    pendingCasesCount,
    pendingRoupasCount,
    backorderedItemsCount,
    onSubViewChange
}) => {
    const [hoveredItem, setHoveredItem] = React.useState<View | null>(null);

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /> },
        { id: 'pedidos', label: 'Pedidos', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
        { id: 'montar-pedido', label: 'Montar', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />, count: availableOrdersCount, badgeColor: 'bg-red-500' },
        { id: 'enviar-pedido', label: 'Enviar', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />, count: savedOrdersCount, badgeColor: 'bg-red-500' },
        { id: 'verificacao', label: 'Verificar', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
        { id: 'atrasados', label: 'Atrasados', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />, count: backorderedItemsCount, badgeColor: 'bg-yellow-500' },
        {
            id: 'estampas',
            label: 'Estampas',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />,
            count: fazerArteCount,
            badgeColor: 'bg-red-500',
            subMenus: [
                { label: 'Dashboard', tab: 'dashboard' },
                { label: 'Lista', tab: 'lista' }
            ]
        },
        {
            id: 'capinhas',
            label: 'Capinhas',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />,
            count: pendingCasesCount,
            badgeColor: 'bg-red-500',
            subMenus: [
                { label: 'Dashboard', tab: 'dashboard' },
                { label: 'Pedidos', tab: 'analise' },
                { label: 'Modelos', tab: 'modelos' }
            ]
        },
        {
            id: 'separacao',
            label: 'Separação',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
            count: pendingRoupasCount,
            badgeColor: 'bg-red-500',
            subMenus: [
                { label: 'Dashboard', tab: 'dashboard' },
                { label: 'Roupas', tab: 'roupas' },
                { label: 'Capinhas', tab: 'capinhas' }
            ]
        },
        {
            id: 'pagamento',
            label: 'Pagamentos',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
            subMenus: [
                { label: 'Dashboard', tab: 'dashboard' },
                { label: 'Lista', tab: 'lista' }
            ]
        },
        {
            id: 'precos',
            label: 'Preços',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
            subMenus: [
                { label: 'Dashboard', tab: 'dashboard' },
                { label: 'Tabela', tab: 'tabela' }
            ]
        },
        {
            id: 'sku',
            label: 'SKU',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />,
            count: invalidSkuCount,
            badgeColor: 'bg-red-500',
            subMenus: [
                { label: 'Dashboard', tab: 'dashboard' },
                { label: 'Tratar', tab: 'treat' },
                { label: 'Regras', tab: 'rules' }
            ]
        },
        {
            id: 'imagem',
            label: 'Imagem',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
            subMenus: [
                { label: 'Dashboard', tab: 'dashboard' },
                { label: 'Gerenciar', tab: 'gerenciar' }
            ]
        },
    ];

    return (
        <nav className="sticky top-16 z-40 bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-md shadow-lg rounded-xl p-2 mb-6 w-full border border-gray-200 dark:border-gray-700/50 overflow-visible">
            <ul className="flex items-center justify-between w-full overflow-x-visible gap-1 px-2">
                {navItems.map((item) => {
                    const isActive = currentView === item.id;
                    return (
                        <li
                            key={item.id}
                            className="flex-1 min-w-[70px] relative"
                            onMouseEnter={() => setHoveredItem(item.id)}
                            onMouseLeave={() => setHoveredItem(null)}
                        >
                            <button
                                onClick={() => {
                                    setCurrentView(item.id);
                                }}
                                className={`group relative flex flex-col items-center justify-center w-full py-2 px-1 rounded-lg transition-all duration-200 ${isActive
                                    ? 'bg-blue-50 dark:bg-[#2563eb]/20 text-blue-600 dark:text-blue-400'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                <div className={`relative mb-1 ${isActive ? 'text-blue-600 dark:text-blue-500' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {item.icon}
                                    </svg>
                                    {'count' in item && typeof item.count === 'number' && item.count > 0 && (
                                        <span className={`absolute -top-1 left-full ml-1 ${item.badgeColor || 'bg-red-500'} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm min-w-[1.25rem] flex items-center justify-center border-2 border-white dark:border-[#1e293b]`}>
                                            {item.count}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[11px] font-medium tracking-wide ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-400'}`}>
                                    {String(item.label)}
                                </span>
                                {isActive && (
                                    <div className="absolute inset-0 border border-blue-500/30 rounded-lg pointer-events-none"></div>
                                )}
                            </button>

                            {/* Dropdown Submenu */}
                            {item.subMenus && hoveredItem === item.id && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 min-w-[140px] animate-fade-in">
                                    <ul className="py-1">
                                        {item.subMenus.map((subItem) => (
                                            <li key={subItem.tab}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Store desired tab in localStorage
                                                        localStorage.setItem(`${item.id}_activeTab`, subItem.tab);

                                                        // Call the onSubViewChange prop if provided
                                                        if (onSubViewChange) {
                                                            onSubViewChange(subItem.tab);
                                                        }

                                                        // Navigate to view with subview
                                                        setCurrentView(item.id, subItem.tab);
                                                        setHoveredItem(null);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                >
                                                    {subItem.label}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
};
